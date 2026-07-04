import { Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { HeaderComponent } from '../pages/HeaderComponent';

// Единственное место, где учётные данные общего тестового аккаунта читаются
// из .env — раньше process.env['LOGIN_...'] дублировался в каждом чекаут-тесте.
export const TEST_USER = {
  email: process.env['LOGIN_EMAIL'],
  password: process.env['LOGIN_PASSWORD'],
  lastName: process.env['LOGIN_LAST_NAME'],
  firstName: process.env['LOGIN_FIRST_NAME'],
  patronymic: process.env['LOGIN_PATRONYMIC'],
  phone: process.env['LOGIN_PHONE'],
};

// Если хоть одна из переменных не задана в .env, авторизованные чекаут-тесты
// не могут пройти дальше логина — их нужно скипать, а не роняти с непонятной
// ошибкой на пустом поле. Использовать в test.skip(!isTestUserConfigured, ...).
export const isTestUserConfigured = Boolean(
  TEST_USER.email &&
    TEST_USER.password &&
    TEST_USER.lastName &&
    TEST_USER.firstName &&
    TEST_USER.patronymic &&
    TEST_USER.phone,
);

// Общий флоу логина тестовым аккаунтом, одинаковый во всех авторизованных
// чекаут-тестах: сразу переходим на страницу логина по прямой ссылке,
// авторизуемся и дожидаемся редиректа в личный кабинет.
export async function loginAsTestUser(page: Page) {
  const header = new HeaderComponent(page);
  const loginPage = new LoginPage(page);

  await page.goto('https://web1-bi.ua/ukr/login/');
  await header.acceptCookiesIfVisible();
  await loginPage.login(TEST_USER.email!, TEST_USER.password!);
  await page.waitForURL('**/lk/**');
}
