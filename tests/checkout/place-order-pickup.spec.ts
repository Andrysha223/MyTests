import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { LoginPage } from '../pages/LoginPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { ThankYouPage } from '../pages/ThankYouPage';
import { CartPage } from '../pages/CartPage';

const EMAIL = process.env['LOGIN_EMAIL'];
const PASSWORD = process.env['LOGIN_PASSWORD'];
const LAST_NAME = process.env['LOGIN_LAST_NAME'];
const FIRST_NAME = process.env['LOGIN_FIRST_NAME'];
const PATRONYMIC = process.env['LOGIN_PATRONYMIC'];
const PHONE = process.env['LOGIN_PHONE'];
const PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';
const CITY = 'Київ';
const SHOP_NAME_CONTAINS = 'Басейна';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Проверяет полный флоу оформления заказа: логин -> добавление товара в
// корзину -> оформлення замовлення (контактні дані уже предзаполнены из
// аккаунта -> самовивіз з конкретного магазину -> оплата при отриманні) ->
// подтверждение с номером заказа.
test('Оформление заказа с самовывозом и оплатой при получении (web1-bi.ua)', async ({ page }) => {
  test.skip(
    !EMAIL || !PASSWORD || !LAST_NAME || !FIRST_NAME || !PATRONYMIC || !PHONE,
    'LOGIN_EMAIL / LOGIN_PASSWORD / LOGIN_LAST_NAME / LOGIN_FIRST_NAME / LOGIN_PATRONYMIC / LOGIN_PHONE не заданы в .env',
  );
  test.setTimeout(90000);

  const brandPage = new LegoBrandPage(page);
  const loginPage = new LoginPage(page);
  const checkoutPage = new CheckoutPage(page);
  const thankYouPage = new ThankYouPage(page);
  const cartPage = new CartPage(page);

  await test.step('Login', async () => {
    await brandPage.goto();
    await loginPage.openFromHeader();
    await page.waitForURL('**/login/**');
    await loginPage.login(EMAIL!, PASSWORD!);
    await page.waitForURL('**/lk/**');
  });

  await test.step('Add product to cart', async () => {
    await brandPage.goto();
    await brandPage.addToCart(PRODUCT_NAME);
    await page.waitForURL('**/basket/cart/**');
  });

  await test.step('Start checkout', async () => {
    await checkoutPage.startCheckout();
  });

  await test.step('Verify pre-filled contact details', async () => {
    // Проверяем, что чекаут реально подтягивает данные из авторизованного
    // аккаунта, а не оставляет поля пустыми/дефолтными.
    await expect(checkoutPage.lastNameInput).toHaveValue(LAST_NAME!);
    await expect(checkoutPage.firstNameInput).toHaveValue(FIRST_NAME!);
    await expect(checkoutPage.patronymicInput).toHaveValue(PATRONYMIC!);
    await expect(checkoutPage.phoneInput).toHaveValue(PHONE!);
    await expect(checkoutPage.emailInput).toHaveValue(EMAIL!);
  });

  await test.step('Confirm pre-filled contact details', async () => {
    await checkoutPage.confirmContactDetails();
  });

  await test.step('Choose pickup delivery', async () => {
    await checkoutPage.selectPickupInCity(CITY, SHOP_NAME_CONTAINS);
  });

  let orderIdFromApi: number;

  await test.step('Place order (pay on pickup)', async () => {
    const order = await checkoutPage.placeOrder();
    orderIdFromApi = order.orderId;
  });

  await test.step('Verify order confirmation', async () => {
    await expect(thankYouPage.successMessage).toBeVisible();
    await expect(thankYouPage.orderNumber).toBeVisible();

    // Номер заказа на странице должен совпадать с orderId из ответа API,
    // а не просто быть "каким-то числом".
    const orderNumberOnPage = await thankYouPage.getOrderNumberFromPage();
    expect(orderNumberOnPage).toBe(String(orderIdFromApi));

    // Данные в блоке "Інформація про замовлення" должны совпадать с тем,
    // что реально выбирали на шагах 2-3, а не показывать дефолт/старое значение.
    await expect(thankYouPage.orderDeliveryMethod).toBeVisible();
    await expect(thankYouPage.orderShopAddress(SHOP_NAME_CONTAINS)).toBeVisible();
    await expect(thankYouPage.orderPaymentMethod).toBeVisible();
    await expect(thankYouPage.orderProductName(PRODUCT_NAME)).toBeVisible();
  });

  await test.step('Verify cart is empty after order', async () => {
    await expect(cartPage.headerCartCounter).toHaveText('0');
  });
});
