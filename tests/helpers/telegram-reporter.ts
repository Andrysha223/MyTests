import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

interface StepInfo {
  title: string;
  status: 'passed' | 'failed';
  durationMs: number;
}

interface TestInfo {
  title: string;
  file: string;
  project: string;
  status: string;
  durationMs: number;
  error?: string;
  steps: StepInfo[];
  screenshotPath?: string;
  // Номер финальной попытки (0 — прошла с первого раза, 1+ — понадобился
  // ретрай). Используется в PDF, чтобы пометить "прошёл, но не сразу"
  // отдельно от чистого PASSED — статус теста (status) при этом остаётся
  // 'passed', чтобы не ломать подсчёт passed/failed в onEnd.
  retryCount: number;
}

// Отправляет краткую сводку прогона (passed/failed/skipped + список упавших
// тестов) текстом в Telegram-чат, плюс полный PDF-отчёт со всеми тестами и их
// шагами — через Bot API. Токен и chat_id берутся из .env
// (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) — если их нет, репортер ничего не
// делает (не ломает прогон).
export default class TelegramReporter implements Reporter {
  // onTestEnd вызывается ОТДЕЛЬНО на каждую попытку (изначальный запуск +
  // каждый retry) — при retries > 0 (см. playwright.config.ts) один и тот же
  // тест может упасть на попытке №1 и пройти на retry. Ключ — test.id,
  // значение каждый раз ПЕРЕЗАПИСЫВАЕТСЯ, поэтому в итоге остаётся только
  // ПОСЛЕДНЯЯ (финальная) попытка — без этого репортер считал упавшей и
  // показывал в отчёте попытку, которая в итоге была успешно перепройдена.
  private testsById = new Map<string, TestInfo>();
  private flakyCount = 0;
  private startTime = 0;

  onBegin(_config: FullConfig, _suite: Suite) {
    this.startTime = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const rawError = result.error?.message;
    const errorFirstLine = rawError?.split('\n')[0].trim();

    // Скриншот при падении (см. screenshot: 'only-on-failure' в
    // playwright.config.ts) — сохранён на диске, передаём в дочерний процесс
    // просто путь к файлу (сам PDF-процесс прочитает и закодирует его).
    const screenshotAttachment = result.attachments.find(
      (a) => a.name === 'screenshot' && a.path,
    );

    this.testsById.set(test.id, {
      title: test.title,
      file: path.basename(test.location.file),
      project: test.parent.project()?.name ?? '',
      status: result.status,
      durationMs: result.duration,
      error: errorFirstLine ? (errorFirstLine.length > 300 ? `${errorFirstLine.slice(0, 300)}…` : errorFirstLine) : undefined,
      screenshotPath: screenshotAttachment?.path,
      retryCount: result.retry,
      steps: result.steps
        // Оставляем только шаги верхнего уровня, объявленные явно через
        // test.step() — внутренние шаги Playwright (expect, page.click и
        // т.п.) не несут смысловой нагрузки в отчёте и раздули бы PDF.
        .filter((s) => s.category === 'test.step')
        .map((s) => ({
          title: s.title,
          status: s.error ? 'failed' : 'passed',
          durationMs: s.duration,
        })),
    });

    // outcome() учитывает ВСЕ попытки теста на данный момент — 'flaky'
    // означает, что финальная попытка прошла, но не с первого раза.
    // Считаем только на последней попытке (иначе одно и то же "flaky"
    // засчиталось бы несколько раз — по разу на каждую промежуточную попытку).
    if (result.retry === test.retries && test.outcome() === 'flaky') {
      this.flakyCount++;
    }
  }

  async onEnd(result: FullResult) {
    const token = process.env['TELEGRAM_BOT_TOKEN'];
    const chatId = process.env['TELEGRAM_CHAT_ID'];
    if (!token || !chatId) {
      return;
    }

    const allTests = [...this.testsById.values()];
    const passed = allTests.filter((t) => t.status === 'passed').length;
    const skipped = allTests.filter((t) => t.status === 'skipped').length;
    const failedTests = allTests.filter((t) => t.status !== 'passed' && t.status !== 'skipped');

    const durationSec = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const statusIcon = result.status === 'passed' ? '✅' : '❌';

    let text =
      `${statusIcon} Прогон тестов завершён (${result.status})\n` +
      `Пройдено: ${passed} | Упало: ${failedTests.length} | Пропущено: ${skipped}` +
      (this.flakyCount > 0 ? ` | Со ретраем: ${this.flakyCount}` : '') +
      `\nВремя: ${durationSec}s`;

    if (failedTests.length > 0) {
      const list = failedTests
        .slice(0, 10)
        .map((t) => `• ${t.title}\n  📄 ${t.file} [${t.project}]\n  ↳ ${t.error ?? 'Неизвестная ошибка'}`)
        .join('\n');
      text += `\n\nУпавшие тесты:\n${list}`;
      if (failedTests.length > 10) {
        text += `\n… и ещё ${failedTests.length - 10}`;
      }
    }

    // Текст и PDF отправляются ОДНИМ сообщением — caption у sendDocument, а не
    // отдельный sendMessage + sendDocument. PDF со всеми тестами и шагами
    // генерируется в ОТДЕЛЬНОМ процессе (см. send-report-pdf.js): запуск
    // Chromium прямо в процессе Playwright-раннера параллельно с его
    // собственным завершением стабильно ронял Node нативным ассертом libuv на
    // Windows. Если генерация PDF почему-то не удастся, send-report-pdf.js
    // сам отправит текст обычным sendMessage — это единственный fallback,
    // дублирования сообщений тут нет.
    const dataPath = path.resolve('playwright-report/telegram-report-data.json');
    try {
      fs.mkdirSync(path.dirname(dataPath), { recursive: true });
      fs.writeFileSync(dataPath, JSON.stringify({ summary: text, tests: allTests }));

      await new Promise<void>((resolve) => {
        const child = spawn(
          process.execPath,
          [path.resolve(__dirname, 'send-report-pdf.js'), dataPath],
          { stdio: 'inherit' },
        );
        child.on('exit', () => resolve());
        child.on('error', (error) => {
          console.error('Не удалось запустить отправку отчёта в Telegram:', error);
          resolve();
        });
      });
    } catch (error) {
      console.error('Не удалось подготовить данные для отчёта в Telegram:', error);
    }
  }
}
