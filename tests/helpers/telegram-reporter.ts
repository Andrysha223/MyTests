import path from 'path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

// Отправляет краткую сводку прогона (passed/failed/skipped + список упавших
// тестов) в Telegram-чат через Bot API после каждого прогона тестов.
// Токен и chat_id берутся из .env (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) —
// если их нет, репортер просто ничего не делает (не ломает прогон).
export default class TelegramReporter implements Reporter {
  private failedTests: { title: string; file: string; project: string; error: string }[] = [];
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
      // Название теста и так полностью описывает сценарий по-русски — не
      // засоряем его технической частью (путь к файлу, describe-цепочка).
      // Файл и проект (viewport) выносим отдельной строкой для навигации.
      const rawError = result.error?.message ?? 'Неизвестная ошибка';
      const firstLine = rawError.split('\n')[0].trim();
      const errorText = firstLine.length > 200 ? `${firstLine.slice(0, 200)}…` : firstLine;
      this.failedTests.push({
        title: test.title,
        file: path.basename(test.location.file),
        project: test.parent.project()?.name ?? '',
        error: errorText,
      });
    }
  }

  async onEnd(result: FullResult) {
    const token = process.env['TELEGRAM_BOT_TOKEN'];
    const chatId = process.env['TELEGRAM_CHAT_ID'];
    if (!token || !chatId) {
      return;
    }

    const durationSec = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const statusIcon = result.status === 'passed' ? '✅' : '❌';

    let text =
      `${statusIcon} Прогон тестов завершён (${result.status})\n` +
      `Пройдено: ${this.passed} | Упало: ${this.failed} | Пропущено: ${this.skipped}\n` +
      `Время: ${durationSec}s`;

    if (this.failedTests.length > 0) {
      const list = this.failedTests
        .slice(0, 10)
        .map((t) => `• ${t.title}\n  📄 ${t.file} [${t.project}]\n  ↳ ${t.error}`)
        .join('\n');
      text += `\n\nУпавшие тесты:\n${list}`;
      if (this.failedTests.length > 10) {
        text += `\n… и ещё ${this.failedTests.length - 10}`;
      }
    }

    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch (error) {
      // Не роняем прогон тестов, если Telegram недоступен.
      console.error('Не удалось отправить отчёт в Telegram:', error);
    }
  }
}
