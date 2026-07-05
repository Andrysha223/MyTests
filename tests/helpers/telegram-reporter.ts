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
  // Номер фінальної спроби (0 — пройшла з першого разу, 1+ — знадобився
  // retry). Використовується в PDF, щоб позначити "пройшов, але не одразу"
  // окремо від чистого PASSED — статус тесту (status) при цьому лишається
  // 'passed', щоб не ламати підрахунок passed/failed в onEnd.
  retryCount: number;
}

// Надсилає коротку зведену інформацію про прогін (passed/failed/skipped +
// список впалих тестів) текстом у Telegram-чат, плюс повний PDF-звіт з усіма
// тестами та їх кроками — через Bot API. Токен і chat_id беруться з .env
// (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) — якщо їх немає, репортер нічого не
// робить (не ламає прогін).
export default class TelegramReporter implements Reporter {
  // onTestEnd викликається ОКРЕМО на кожну спробу (початковий запуск +
  // кожен retry) — при retries > 0 (див. playwright.config.ts) один і той
  // самий тест може впасти на спробі №1 і пройти на retry. Ключ — test.id,
  // значення щоразу ПЕРЕЗАПИСУЄТЬСЯ, тому в підсумку залишається лише
  // ОСТАННЯ (фінальна) спроба — без цього репортер вважав впалою і
  // показував у звіті спробу, яка в підсумку була успішно перепройдена.
  private testsById = new Map<string, TestInfo>();
  private flakyCount = 0;
  private startTime = 0;

  onBegin(_config: FullConfig, _suite: Suite) {
    this.startTime = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const rawError = result.error?.message;
    const errorFirstLine = rawError?.split('\n')[0].trim();

    // Скриншот при падінні (див. screenshot: 'only-on-failure' в
    // playwright.config.ts) — збережений на диску, передаємо в дочірній процес
    // просто шлях до файлу (сам PDF-процес прочитає і закодує його).
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
        // Залишаємо лише кроки верхнього рівня, оголошені явно через
        // test.step() — внутрішні кроки Playwright (expect, page.click і
        // т.п.) не несуть смислового навантаження у звіті й роздули б PDF.
        .filter((s) => s.category === 'test.step')
        .map((s) => ({
          title: s.title,
          status: s.error ? 'failed' : 'passed',
          durationMs: s.duration,
        })),
    });

    // outcome() враховує ВСІ спроби тесту на даний момент — 'flaky'
    // означає, що фінальна спроба пройшла, але не з першого разу.
    // Рахуємо лише на останній спробі (інакше один і той самий "flaky"
    // зарахувався б кілька разів — по разу на кожну проміжну спробу).
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

    // Текст і PDF надсилаються ОДНИМ повідомленням — caption у sendDocument, а не
    // окремий sendMessage + sendDocument. PDF з усіма тестами й кроками
    // генерується в ОКРЕМОМУ процесі (див. send-report-pdf.js): запуск
    // Chromium прямо в процесі Playwright-раннера паралельно з його
    // власним завершенням стабільно валив Node нативним ассертом libuv на
    // Windows. Якщо генерація PDF чомусь не вдасться, send-report-pdf.js
    // сам надішле текст звичайним sendMessage — це єдиний fallback,
    // дублювання повідомлень тут немає.
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
