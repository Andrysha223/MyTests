import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { ThankYouPage } from '../pages/ThankYouPage';
import { generateRandomContactDetails } from '../helpers/randomData';
import { getProductFromBasketResponse, expectOrderProductDetails } from '../helpers/basket';

const PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';
const PRODUCT_ARTICLE = '60238';
const CITY = 'Київ';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Перевіряє оформлення замовлення НЕавторизованим (гостьовим) користувачем зі
// випадковими контактними даними: без логіну додаємо товар в кошик,
// на кроці 1 самі заповнюємо згенеровані ПІБ/телефон/email (на відміну від
// авторизованого флоу — там поля вже заповнені акаунтом), обираємо
// самовивіз (перший доступний магазин — конкретна адреса тут не принципова,
// на відміну від авторизованого тесту) і оплату при отриманні, підтверджуємо.
test('Оформление заказа неавторизованным пользователем со случайными данными (web1-bi.ua)', async ({
  page,
}) => {
  test.setTimeout(90000);

  const brandPage = new LegoBrandPage(page);
  const checkoutPage = new CheckoutPage(page);
  const thankYouPage = new ThankYouPage(page);
  const contactDetails = generateRandomContactDetails();

  let productCodeFromApi: number;
  let productPriceFromApi: number;

  await test.step('Добавить товар в корзину как гость', async () => {
    const addToCartApiResponse = page.waitForResponse(
      (r) => r.url().includes('/api/v1/basket/good') && r.request().method() === 'POST',
    );

    await brandPage.goto();
    await brandPage.addToCart(PRODUCT_NAME);

    const product = getProductFromBasketResponse(
      await (await addToCartApiResponse).json(),
      PRODUCT_ARTICLE,
    );
    productCodeFromApi = product?.code;
    productPriceFromApi = product?.price;

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

    // Номер замовлення на сторінці повинен збігатися з orderId з відповіді API
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
    // Назва, код товару, кількість і сума повинні збігатися з тим, що
    // реально повернув API при додаванні в кошик, а не бути дефолтом/порожнім.
    await expectOrderProductDetails(thankYouPage, {
      name: PRODUCT_NAME,
      code: productCodeFromApi,
      price: productPriceFromApi,
      quantity: 1,
    });
  });
});
