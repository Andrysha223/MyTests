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
}

// Отправляет краткую сводку прогона (passed/failed/skipped + список упавших
// тестов) текстом в Telegram-чат, плюс полный PDF-отчёт со всеми тестами и их
// шагами — через Bot API. Токен и chat_id берутся из .env
// (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) — если их нет, репортер ничего не
// делает (не ломает прогон).
export default class TelegramReporter implements Reporter {
  private allTests: TestInfo[] = [];
  private passed = 0;
  private failed = 0;
  private skipped = 0;
  private startTime = 0;

  onBegin(_config: FullConfig, _suite: Suite) {
    this.startTime = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'passed') {
      this.passed++;
    } else if (result.status === 'skipped') {
      this.skipped++;
    } else {
      this.failed++;
    }

    const rawError = result.error?.message;
    const errorFirstLine = rawError?.split('\n')[0].trim();

    this.allTests.push({
      title: test.title,
      file: path.basename(test.location.file),
      project: test.parent.project()?.name ?? '',
      status: result.status,
      durationMs: result.duration,
      error: errorFirstLine ? (errorFirstLine.length > 300 ? `${errorFirstLine.slice(0, 300)}…` : errorFirstLine) : undefined,
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
  }

  async onEnd(result: FullResult) {
    const token = process.env['TELEGRAM_BOT_TOKEN'];
    const chatId = process.env['TELEGRAM_CHAT_ID'];
    if (!token || !chatId) {
      return;
    }

    const durationSec = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const statusIcon = result.status === 'passed' ? '✅' : '❌';
    const failedTests = this.allTests.filter((t) => t.status !== 'passed' && t.status !== 'skipped');

    let text =
      `${statusIcon} Прогон тестов завершён (${result.status})\n` +
      `Пройдено: ${this.passed} | Упало: ${this.failed} | Пропущено: ${this.skipped}\n` +
      `Время: ${durationSec}s`;

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
      fs.writeFileSync(dataPath, JSON.stringify({ summary: text, tests: this.allTests }));

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
