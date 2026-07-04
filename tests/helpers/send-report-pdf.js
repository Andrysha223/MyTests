// Запускается КАК ОТДЕЛЬНЫЙ процесс (см. вызов через child_process.spawn в
// telegram-reporter.ts), а не внутри самого Playwright-раннера — запуск
// нового Chromium прямо в процессе раннера, параллельно с его собственным
// завершением, стабильно ронял Node с нативным ассертом libuv
// ("!(handle->flags & UV_HANDLE_CLOSING)", src\win\async.c) на Windows.
// Отдельный процесс полностью изолирует жизненный цикл браузера.
//
// Строим HTML-отчёт САМИ (а не рендерим встроенный playwright-report/), т.к.
// встроенный отчёт — это SPA, где шаги теста скрыты до клика по строке; при
// прямом рендере "как есть" в PDF попал бы только свёрнутый список тестов
// без единого шага.
const fs = require('fs');
const { chromium } = require('@playwright/test');

// Лимит caption в Telegram — 1024 символа (у обычных текстовых сообщений
// лимит больше, 4096, но здесь текст едет ВМЕСТЕ с документом одним
// сообщением, поэтому действует более короткий лимит caption).
const CAPTION_LIMIT = 1024;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(tests) {
  const rows = tests
    .map((t) => {
      const statusColor = t.status === 'passed' ? '#1a7f37' : t.status === 'skipped' ? '#9a6700' : '#cf222e';
      const statusLabel = t.status === 'passed' ? 'PASSED' : t.status === 'skipped' ? 'SKIPPED' : 'FAILED';
      const steps = t.steps
        .map((s) => {
          const stepColor = s.status === 'failed' ? '#cf222e' : '#57606a';
          return `<div class="step" style="color:${stepColor}">${s.status === 'failed' ? '✗' : '✓'} ${escapeHtml(s.title)} <span class="dur">(${s.durationMs}ms)</span></div>`;
        })
        .join('');
      const error = t.error ? `<div class="error">${escapeHtml(t.error)}</div>` : '';

      return `
        <div class="test">
          <div class="test-header">
            <span class="status" style="color:${statusColor}">${statusLabel}</span>
            <span class="title">${escapeHtml(t.title)}</span>
            <span class="dur">${(t.durationMs / 1000).toFixed(1)}s</span>
          </div>
          <div class="meta">${escapeHtml(t.file)} · ${escapeHtml(t.project)}</div>
          ${steps ? `<div class="steps">${steps}</div>` : ''}
          ${error}
        </div>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2328; margin: 24px; }
  h1 { font-size: 18px; margin-bottom: 16px; }
  .test { border: 1px solid #d0d7de; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
  .test-header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .status { font-weight: bold; font-size: 11px; min-width: 60px; }
  .title { flex: 1; font-weight: 600; }
  .meta { color: #57606a; font-size: 10px; margin-top: 2px; }
  .steps { margin-top: 6px; padding-left: 8px; border-left: 2px solid #d0d7de; }
  .step { font-size: 11px; margin-bottom: 2px; }
  .dur { color: #57606a; font-size: 10px; }
  .error { margin-top: 6px; padding: 6px 8px; background: #fff0ef; border: 1px solid #ffcecb; border-radius: 4px; color: #cf222e; font-size: 11px; }
</style>
</head>
<body>
  <h1>Playwright test report</h1>
  ${rows}
</body>
</html>`;
}

async function sendTextMessage(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const dataPath = process.argv[2];
  if (!dataPath) return;

  const { summary, tests } = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // caption короче обычного текстового сообщения (лимит 1024 символа) —
  // урезаем и указываем, что полная сводка есть в самом PDF.
  const caption =
    summary.length > CAPTION_LIMIT
      ? `${summary.slice(0, CAPTION_LIMIT - 40)}…\n\n(полная сводка — в PDF)`
      : summary;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(buildHtml(tests), { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16px', bottom: '16px' },
    });

    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption);
    form.append('document', new Blob([pdfBuffer], { type: 'application/pdf' }), 'test-report.pdf');
    await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: form,
    });
  } catch (error) {
    console.error('Не удалось сгенерировать/отправить PDF-отчёт, отправляю только текст:', error);
    await sendTextMessage(token, chatId, summary);
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((error) => {
  console.error('Не удалось отправить отчёт в Telegram:', error);
  process.exit(1);
});
