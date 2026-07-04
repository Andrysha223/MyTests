import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { CartPage } from '../pages/CartPage';

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
  const cartPage = new CartPage(page);

  await test.step('Открыть главную страницу', async () => {
    await homePage.goto();
  });

  await test.step('Открыть страницу логина через хедер', async () => {
    await homePage.header.openLogin();
    await page.waitForURL('**/login/**');
  });

  let tokenResponseStatus: number;
  let tokenResponseBody: any;

  await test.step('Авторизоваться по email и паролю', async () => {
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

  await test.step('Проверить, что токен авторизации выдан', async () => {
    expect(tokenResponseStatus!, 'Ответ POST /api/v1/oauth2/token должен быть 200 OK').toBe(200);

    const accessToken = tokenResponseBody?.data?.access_token;
    expect(
      accessToken,
      `Access token отсутствует в ответе: ${JSON.stringify(tokenResponseBody)}`,
    ).toBeTruthy();
    const cookies = await page.context().cookies();
    const tokenCookie = cookies.find((c) => c.name === 'access_token');
    expect(tokenCookie, 'Cookie "access_token" не найдена после логина').toBeTruthy();
    expect(
      tokenCookie!.value,
      'Значение cookie "access_token" должно совпадать с access_token из ответа API',
    ).toBe(accessToken);
  });

  await test.step('Проверить, что пользователь авторизован', async () => {
    // На мобильной верстке эти ссылки лежат внутри гамбургер-меню и физически
    // скрыты, пока меню не открыто, поэтому проверяем не видимость, а сам факт
    // наличия в DOM (toBeAttached) — этого достаточно, чтобы подтвердить, что
    // сайт признал пользователя авторизованным.
    await expect(
      homePage.header.accountLink,
      'После логина в хедере вместо "Вхід" должна появиться ссылка на аккаунт пользователя',
    ).toBeAttached();
    await expect(
      homePage.header.logoutLink,
      'После логина в хедере должна быть ссылка "Вийти"',
    ).toBeAttached();
  });

  await test.step('Очистить корзину', async () => {
    // Тестовый аккаунт общий для всех тестов — в корзине могут остаться
    // посторонние товары с прошлых прогонов/промо сайта. Чистим после
    // каждого логина, чтобы следующие тесты стартовали с пустой корзины.
    await cartPage.clearCart();
  });
});
