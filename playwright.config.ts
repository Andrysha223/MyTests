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
  // Ретраи включены и локально — ловят настоящую случайную нестабильность
  // сайта вне tests/favorites (например, сломанную reCAPTCHA в чекауте, см.
  // README.md 11.4). tests/favorites отдельно отключает retries через
  // test.describe.configure({ retries: 0 }) в своих файлах — там баг на
  // стороне сайта (BUGS.md), и цель прогона сейчас — честно видеть, реально
  // ли помог точечный фикс (релогин при рассинхроне), а не прятать результат
  // за повторными попытками.
  retries: 1,
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
      // tests/favorites временно только на desktop — там баг на стороне
      // сайта (рассинхрон сессии с текущим списком бажань, см. BUGS.md),
      // который не зависит от viewport'а, но лишний прогон на мобилке только
      // удваивает шанс словить его и замедляет сьют. Вернуть после фикса на
      // стороне сайта.
      testIgnore: /favorites[\\/]/,
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
