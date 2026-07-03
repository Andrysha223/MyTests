import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { ThankYouPage } from '../pages/ThankYouPage';
import { generateRandomContactDetails } from '../helpers/randomData';

const PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';
const CITY = 'Київ';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Проверяет оформление заказа НЕавторизованным (гостевым) пользователем со
// случайными контактными данными: без логина добавляем товар в корзину,
// на шаге 1 сами заполняем сгенерированные ФИО/телефон/email (в отличие от
// авторизованного флоу — там поля уже предзаполнены аккаунтом), выбираем
// самовивіз (первый доступный магазин — конкретный адрес тут не принципиален,
// в отличие от авторизованного теста) и оплату при отриманні, подтверждаем.
test('Оформление заказа неавторизованным пользователем со случайными данными (web1-bi.ua)', async ({
  page,
}) => {
  test.setTimeout(90000);

  const brandPage = new LegoBrandPage(page);
  const checkoutPage = new CheckoutPage(page);
  const thankYouPage = new ThankYouPage(page);
  const contactDetails = generateRandomContactDetails();

  await test.step('Добавить товар в корзину как гость', async () => {
    await brandPage.goto();
    await brandPage.addToCart(PRODUCT_NAME);
    await page.waitForURL('**/basket/cart/**');
  });

  await test.step('Начать оформление заказа', async () => {
    await checkoutPage.startCheckout();
  });

  await test.step('Заполнить случайные контактные данные', async () => {
    await checkoutPage.fillContactDetails(contactDetails);
    await checkoutPage.confirmContactDetails();
  });

  await test.step('Выбрать самовывоз (любой доступный магазин)', async () => {
    await checkoutPage.selectPickupInCity(CITY);
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

    // Номер заказа на странице должен совпадать с orderId из ответа API
    const orderNumberOnPage = await thankYouPage.getOrderNumberFromPage();
    expect(
      orderNumberOnPage,
      `Номер заказа на странице ("${orderNumberOnPage}") должен совпадать с orderId из ответа API ("${orderIdFromApi}")`,
    ).toBe(String(orderIdFromApi));

    await expect(
      thankYouPage.orderDeliveryMethod,
      'В подтверждении заказа должен быть указан способ доставки «Самовивіз із магазину»',
    ).toBeVisible();
    await expect(
      thankYouPage.orderPaymentMethod,
      'В подтверждении заказа должен быть указан способ оплаты «При отриманні (готівкою/карткою)»',
    ).toBeVisible();
    await expect(
      thankYouPage.orderProductName(PRODUCT_NAME),
      `В заказе должен быть указан товар «${PRODUCT_NAME}»`,
    ).toBeVisible();
  });
});
