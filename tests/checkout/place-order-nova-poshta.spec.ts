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
const PRODUCT_NAME = 'Конструктор LEGO Speed champions Автомобіль McLaren Senna (75892)';
const CITY = 'Київ';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Проверяет оформление заказа с доставкой у відділення «Нова Пошта» (в отличие
// от других чекаут-тестов, где проверяется самовивіз): логин -> очистка
// корзины -> добавление LEGO Speed Champions McLaren Senna (75892) -> контактні
// дані уже предзаполнены аккаунтом -> вибір способу доставки "Нова Пошта",
// первое доступное відділення -> оплата при отриманні -> подтверждение заказа.
test('Оформление заказа с доставкою у відділення Нової Пошти (web1-bi.ua)', async ({ page }) => {
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

  await test.step('Авторизоваться', async () => {
    await brandPage.goto();
    await brandPage.header.openLogin();
    await page.waitForURL('**/login/**');
    await loginPage.login(EMAIL!, PASSWORD!);
    await page.waitForURL('**/lk/**');
  });

  await test.step('Очистить корзину', async () => {
    // Тестовый аккаунт общий — в корзине могут остаться посторонние товары
    // с прошлых прогонов/промо сайта, из-за чего чекаут стартует не с шага 1.
    await cartPage.clearCart();
  });

  await test.step('Добавить товар в корзину', async () => {
    await brandPage.goto();
    await brandPage.addToCart(PRODUCT_NAME);
    await page.waitForURL('**/basket/cart/**');
  });

  await test.step('Начать оформление заказа', async () => {
    await checkoutPage.startCheckout();
  });

  await test.step('Подтвердить предзаполненные контактные данные', async () => {
    await checkoutPage.confirmContactDetails();
  });

  let deliveryPriceFromApi: number;

  await test.step('Выбрать доставку в отделение Новой почты', async () => {
    const delivery = await checkoutPage.selectNovaPoshtaBranch(CITY);
    deliveryPriceFromApi = delivery.deliveryPrice;
  });

  await test.step('Проверить стоимость доставки в чекауте', async () => {
    // Сверяем, что цена, которую вернул GET /api/v1/basket/delivery,
    // реально отображается в сайдбаре "Ваше замовлення" на шаге оплаты.
    await expect(
      checkoutPage.deliveryCostInCheckout,
      `В сайдбаре чекаута должна отображаться стоимость доставки "${deliveryPriceFromApi} ₴" из ответа API`,
    ).toHaveText(`${deliveryPriceFromApi} ₴`);
  });

  let orderIdFromApi: number;

  await test.step('Оформить заказ (оплата при получении)', async () => {
    const order = await checkoutPage.placeOrder();
    orderIdFromApi = order.orderId;
  });

  await test.step('Проверить подтверждение заказа', async () => {
    await expect(
      thankYouPage.successMessage,
      'После оформления заказа должно появиться сообщение об успехе на /ukr/thankyou/',
    ).toBeVisible();
    await expect(
      thankYouPage.orderNumber,
      'На странице подтверждения должен быть виден номер заказа (№...)',
    ).toBeVisible();

    // Номер заказа на странице должен совпадать с orderId из ответа API,
    // а не просто быть "каким-то числом".
    const orderNumberOnPage = await thankYouPage.getOrderNumberFromPage();
    expect(
      orderNumberOnPage,
      `Номер заказа на странице ("${orderNumberOnPage}") должен совпадать с orderId из ответа API ("${orderIdFromApi}")`,
    ).toBe(String(orderIdFromApi));

    // Способ доставки в подтверждении должен быть именно "Нова Пошта",
    // а не самовивіз/дефолт — проверяем, что выбор реально сохранился.
    await expect(
      thankYouPage.orderDeliveryMethodNovaPoshta,
      'В подтверждении заказа должен быть указан способ доставки «У відділення «Нова Пошта»',
    ).toBeVisible();
    await expect(
      thankYouPage.orderPaymentMethod,
      'В подтверждении заказа должен быть указан способ оплаты «При отриманні (готівкою/карткою)»',
    ).toBeVisible();
    await expect(
      thankYouPage.orderProductName(PRODUCT_NAME),
      `В заказе должен быть указан товар «${PRODUCT_NAME}»`,
    ).toBeVisible();

    // Стоимость доставки на странице подтверждения должна совпадать с той,
    // что вернул API (см. шаг "Проверить стоимость доставки в чекауте"),
    // а не быть, например, нулевой/дефолтной.
    const deliveryCostOnThankYouPage = await thankYouPage.getDeliveryCostFromPage();
    expect(
      deliveryCostOnThankYouPage,
      `Стоимость доставки на странице подтверждения ("${deliveryCostOnThankYouPage} грн.") должна совпадать со стоимостью из API ("${deliveryPriceFromApi} ₴")`,
    ).toBe(deliveryPriceFromApi);
  });

  await test.step('Проверить, что корзина пуста после заказа', async () => {
    await expect(
      brandPage.header.cartCounter,
      'После успешного оформления заказа корзина должна опустеть (счётчик в хедере = 0)',
    ).toHaveText('0');
  });
});
