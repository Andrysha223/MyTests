import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { LoginPage } from '../pages/LoginPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { ThankYouPage } from '../pages/ThankYouPage';
import { CartPage } from '../pages/CartPage';
import { getProductFromBasketResponse, expectOrderProductDetails } from '../helpers/basket';

const EMAIL = process.env['LOGIN_EMAIL'];
const PASSWORD = process.env['LOGIN_PASSWORD'];
const LAST_NAME = process.env['LOGIN_LAST_NAME'];
const FIRST_NAME = process.env['LOGIN_FIRST_NAME'];
const PATRONYMIC = process.env['LOGIN_PATRONYMIC'];
const PHONE = process.env['LOGIN_PHONE'];
const PRODUCT_NAME = 'Конструктор LEGO Speed champions Автомобіль McLaren Senna (75892)';
const PRODUCT_ARTICLE = '75892';
const CITY = 'Київ';
const STREET = 'Хрещатик';
const HOUSE_NUMBER = '1';
const APARTMENT_NUMBER = '1';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Проверяет оформление заказа с кур'єрською доставкою «Нова Пошта» (аналогично
// place-order-nova-poshta/place-order-ukrposhta, но другой спосіб доставки —
// вместо выбора відділення заполняется адрес): логин -> очистка корзины ->
// добавление LEGO Speed Champions McLaren Senna (75892) -> проверка
// предзаполненных контактних даних (как в place-order-pickup) -> вибір
// способу доставки "Кур'єром «Нова Пошта»" с адресом (вулиця/будинок/квартира)
// -> проверка стоимости доставки в чекауте и на странице подтверждения (как
// в place-order-nova-poshta) -> оплата при отриманні -> подтверждение заказа.
test("Оформление заказа с кур'єрською доставкою «Нова Пошта» (web1-bi.ua)", async ({ page }) => {
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

  let productCodeFromApi: number;
  let productPriceFromApi: number;

  await test.step('Добавить товар в корзину', async () => {
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

  await test.step('Проверить предзаполненные контактные данные', async () => {
    // Проверяем, что чекаут реально подтягивает данные из авторизованного
    // аккаунта, а не оставляет поля пустыми/дефолтными.
    await expect(
      checkoutPage.lastNameInput,
      'Поле «Прізвище» должно быть предзаполнено фамилией из аккаунта',
    ).toHaveValue(LAST_NAME!);
    await expect(
      checkoutPage.firstNameInput,
      "Поле «Ім'я» должно быть предзаполнено именем из аккаунта",
    ).toHaveValue(FIRST_NAME!);
    await expect(
      checkoutPage.patronymicInput,
      'Поле «По-батькові» должно быть предзаполнено отчеством из аккаунта',
    ).toHaveValue(PATRONYMIC!);
    await expect(
      checkoutPage.phoneInput,
      'Поле «Номер телефону» должно быть предзаполнено телефоном из аккаунта',
    ).toHaveValue(PHONE!);
    await expect(
      checkoutPage.emailInput,
      'Поле «Email» должно быть предзаполнено почтой из аккаунта',
    ).toHaveValue(EMAIL!);
  });

  await test.step('Подтвердить предзаполненные контактные данные', async () => {
    await checkoutPage.confirmContactDetails();
  });

  let deliveryPriceFromApi: number;

  await test.step("Выбрать кур'єрську доставку Нової Пошти", async () => {
    const delivery = await checkoutPage.selectCourierDelivery(
      CITY,
      STREET,
      HOUSE_NUMBER,
      APARTMENT_NUMBER,
    );
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

    // Способ доставки в подтверждении должен быть именно "Кур'єром «Нова
    // Пошта»", а не самовивіз/відділення/дефолт — проверяем, что выбор
    // реально сохранился.
    await expect(
      thankYouPage.orderDeliveryMethodCourier,
      "В подтверждении заказа должен быть указан способ доставки «Кур'єром «Нова Пошта»»",
    ).toBeVisible();
    await expect(
      thankYouPage.orderPaymentMethod,
      'В подтверждении заказа должен быть указан способ оплаты «При отриманні (готівкою/карткою)»',
    ).toBeVisible();
    // Название, код товара, количество и сумма должны совпадать с тем, что
    // реально вернул API при добавлении в корзину, а не быть дефолтом/пустым.
    await expectOrderProductDetails(thankYouPage, {
      name: PRODUCT_NAME,
      code: productCodeFromApi,
      price: productPriceFromApi,
      quantity: 1,
    });

    // Стоимость доставки на странице подтверждения должна совпадать с той,
    // что вернул API (см. шаг "Проверить стоимость доставки в чекауте"),
    // а не быть, например, нулевой/дефолтной.
    const deliveryCostOnThankYouPage = await thankYouPage.getDeliveryCostFromPage();
    expect(
      deliveryCostOnThankYouPage,
      `Стоимость доставки на странице подтверждения ("${deliveryCostOnThankYouPage} грн.") должна совпадать со стоимостью из API ("${deliveryPriceFromApi} ₴")`,
    ).toBe(deliveryPriceFromApi);

    // Строка "Адреса доставки" появляется только у кур'єрської доставки —
    // проверяем, что в ней реально те улица/дом/квартира, что вводили на
    // шаге 2, а не пустое/дефолтное значение. Формат: "вул. {street}, буд.
    // {house}, кв. {apartment}" (город стоит перед этим через запятую).
    await expect(
      thankYouPage.orderDeliveryAddressRow,
      `В подтверждении заказа должен быть указан адрес доставки "вул. ${STREET}, буд. ${HOUSE_NUMBER}, кв. ${APARTMENT_NUMBER}"`,
    ).toContainText(`вул. ${STREET}, буд. ${HOUSE_NUMBER}, кв. ${APARTMENT_NUMBER}`);
  });

  await test.step('Проверить, что корзина пуста после заказа', async () => {
    await expect(
      brandPage.header.cartCounter,
      'После успешного оформления заказа корзина должна опустеть (счётчик в хедере = 0)',
    ).toHaveText('0');
  });
});
