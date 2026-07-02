import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';

const EMAIL = process.env['LOGIN_EMAIL'];
const PASSWORD = process.env['LOGIN_PASSWORD'];

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Проверяет авторизацию по email через ссылку "Вхід" в хедере: вводим email,
// затем пароль, и убеждаемся, что произошёл вход (редирект в личный кабинет,
// в хедере вместо "Вхід" появляется имя пользователя и ссылка "Вийти").
test('Авторизация по email через хедер (web1-bi.ua)', async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, 'LOGIN_EMAIL / LOGIN_PASSWORD не заданы в .env');

  const homePage = new HomePage(page);
  const loginPage = new LoginPage(page);

  await test.step('Open home page', async () => {
    await homePage.goto();
  });

  await test.step('Open login page from header', async () => {
    await loginPage.openFromHeader();
    await page.waitForURL('**/login/**');
  });

  await test.step('Login with email and password', async () => {
    await loginPage.login(EMAIL!, PASSWORD!);
    await page.waitForURL('**/lk/**');
  });

  await test.step('Verify user is logged in', async () => {
    await expect(loginPage.headerAccountLink).toBeVisible();
    await expect(loginPage.logoutLink).toBeVisible();
  });
});
