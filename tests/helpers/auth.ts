import { Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { HeaderComponent } from '../pages/HeaderComponent';

// Єдине місце, де облікові дані спільного тестового акаунта читаються
// з .env — раніше process.env['LOGIN_...'] дублювався в кожному чекаут-тесті.
export const TEST_USER = {
  email: process.env['LOGIN_EMAIL'],
  password: process.env['LOGIN_PASSWORD'],
  lastName: process.env['LOGIN_LAST_NAME'],
  firstName: process.env['LOGIN_FIRST_NAME'],
  patronymic: process.env['LOGIN_PATRONYMIC'],
  phone: process.env['LOGIN_PHONE'],
};

// Якщо хоч одна зі змінних не задана в .env, авторизовані чекаут-тести
// не можуть пройти далі логіну — їх потрібно скіпати, а не валити з незрозумілою
// помилкою на порожньому полі. Використовувати в test.skip(!isTestUserConfigured, ...).
export const isTestUserConfigured = Boolean(
  TEST_USER.email &&
    TEST_USER.password &&
    TEST_USER.lastName &&
    TEST_USER.firstName &&
    TEST_USER.patronymic &&
    TEST_USER.phone,
);

// Спільний флоу логіну тестовим акаунтом, однаковий у всіх авторизованих
// чекаут-тестах: одразу переходимо на сторінку логіну за прямим посиланням,
// авторизуємось і чекаємо редиректу в особистий кабінет.
export async function loginAsTestUser(page: Page) {
  const header = new HeaderComponent(page);
  const loginPage = new LoginPage(page);

  await page.goto('https://web1-bi.ua/ukr/login/');
  await header.acceptCookiesIfVisible();
  await loginPage.login(TEST_USER.email!, TEST_USER.password!);
  await page.waitForURL('**/lk/**');
}
