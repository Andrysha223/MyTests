import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { CartPage } from '../pages/CartPage';

const EMAIL = process.env['LOGIN_EMAIL'];
const PASSWORD = process.env['LOGIN_PASSWORD'];

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Перевіряє авторизацію по email через посилання "Вхід" в хедері: вводимо email,
// потім пароль, і переконуємось, що відбувся вхід (редирект в особистий кабінет,
// в хедері замість "Вхід" з'являється ім'я користувача і посилання "Вийти").
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
    // Тіло відповіді потрібно прочитати одразу, поки не почалась навігація на /lk/ —
    // після неї Chromium вивантажує буфер відповіді і response.json() падає
    // з "No resource with given identifier found".
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
    // На мобільній верстці ці посилання лежать всередині гамбургер-меню і фізично
    // сховані, поки меню не відкрите, тому перевіряємо не видимість, а сам факт
    // наявності в DOM (toBeAttached) — цього достатньо, щоб підтвердити, що
    // сайт визнав користувача авторизованим.
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
    // Тестовий акаунт спільний для всіх тестів — в кошику можуть залишитися
    // сторонні товари з минулих прогонів/промо сайту. Чистимо після
    // кожного логіну, щоб наступні тести стартували з порожнього кошика.
    await cartPage.clearCart();
  });
});
