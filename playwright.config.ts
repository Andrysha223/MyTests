import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  // Ретраи включены и локально: часть тестов избранного (tests/favorites)
  // упирается в подтверждённую случайную нестабильность самого сайта —
  // клик "додати в бажань" примерно в половине случаев не срабатывает,
  // независимо от товара, состояния списков или паузы между попытками
  // (см. README.md, раздел 13.2/13.3). Ретрай на уровне Playwright
  // перезапускает упавший тест целиком с нуля — это ловит проблему
  // надёжнее, чем ретрай одного клика внутри теста. retries:1 всё ещё
  // иногда пропускает genuine fail (~50% × ~50% = ~25% шанс не повезти
  // оба раза подряд) — 2 ретрая (3 попытки всего) снижают до ~12.5%.
  retries: 2,
  /* Opt out of parallel tests on CI. */
  // 1 воркер: тесты используют один общий тестовый аккаунт (логин, корзина,
  // список избранного) — при 2+ воркерах параллельные тесты гоняются за одним
  // и тем же состоянием на сервере (корзина, оформление заказа) и падают.
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list', { printSteps: true }],
    ['html'],
    ['./tests/helpers/telegram-reporter.ts'],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace on failure. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',

    /* Скриншот при падении — попадает в HTML-отчёт и в PDF для Telegram. */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },

  
});
