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
    await homePage.header.openLogin();
    await page.waitForURL('**/login/**');
  });

  let tokenResponseStatus: number;
  let tokenResponseBody: any;

  await test.step('Login with email and password', async () => {
    // Тело ответа нужно прочитать сразу, пока не началась навигация на /lk/ —
    // после неё Chromium выгружает буфер ответа и response.json() падает
    // с "No resource with given identifier found".
    const [tokenResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/oauth2/token') && r.request().method() === 'POST',
      ),
      loginPage.login(EMAIL!, PASSWORD!),
    ]);
    tokenResponseStatus = tokenResponse.status();
    tokenResponseBody = await tokenResponse.json();

    await page.waitForURL('**/lk/**');
  });

  await test.step('Verify auth token is issued', async () => {
    expect(tokenResponseStatus!).toBe(200);

    const accessToken = tokenResponseBody?.data?.access_token;
    expect(
      accessToken,
      `Access token отсутствует в ответе: ${JSON.stringify(tokenResponseBody)}`,
    ).toBeTruthy();
    const cookies = await page.context().cookies();
    const tokenCookie = cookies.find((c) => c.name === 'access_token');
    expect(tokenCookie, 'Cookie "access_token" не найдена после логина').toBeTruthy();
    expect(tokenCookie!.value).toBe(accessToken);
  });

  await test.step('Verify user is logged in', async () => {
    await expect(homePage.header.accountLink).toBeVisible();
    await expect(homePage.header.logoutLink).toBeVisible();
  });
});
