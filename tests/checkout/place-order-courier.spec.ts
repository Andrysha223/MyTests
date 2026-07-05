import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { ThankYouPage } from '../pages/ThankYouPage';
import { CartPage } from '../pages/CartPage';
import { getProductFromBasketResponse, expectOrderProductDetails } from '../helpers/basket';
import { TEST_USER, isTestUserConfigured, loginAsTestUser } from '../helpers/auth';

const PRODUCT_NAME = 'Конструктор LEGO Speed champions Автомобіль McLaren Senna (75892)';
const PRODUCT_ARTICLE = '75892';
const CITY = 'Київ';
const STREET = 'Хрещатик';
const HOUSE_NUMBER = '1';
const APARTMENT_NUMBER = '1';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Перевіряє оформлення замовлення з кур'єрською доставкою «Нова Пошта» (аналогічно
// place-order-nova-poshta/place-order-ukrposhta, але інший спосіб доставки —
// замість вибору відділення заповнюється адреса): логін -> очищення кошика ->
// додавання LEGO Speed Champions McLaren Senna (75892) -> перевірка
// заповнених контактних даних (як в place-order-pickup) -> вибір
// способу доставки "Кур'єром «Нова Пошта»" з адресою (вулиця/будинок/квартира)
// -> перевірка вартості доставки в чекауті і на сторінці підтвердження (як
// в place-order-nova-poshta) -> оплата при отриманні -> підтвердження замовлення.
test("Оформление заказа с кур'єрською доставкою «Нова Пошта» (web1-bi.ua)", async ({ page }) => {
  test.skip(
    !isTestUserConfigured,
    'LOGIN_EMAIL / LOGIN_PASSWORD / LOGIN_LAST_NAME / LOGIN_FIRST_NAME / LOGIN_PATRONYMIC / LOGIN_PHONE не заданы в .env',
  );
  test.setTimeout(90000);

  const brandPage = new LegoBrandPage(page);
  const checkoutPage = new CheckoutPage(page);
  const thankYouPage = new ThankYouPage(page);
  const cartPage = new CartPage(page);

  await test.step('Авторизоваться', async () => {
    await loginAsTestUser(page);
  });

  await test.step('Очистить корзину', async () => {
    // Тестовий акаунт спільний — в кошику можуть залишитися сторонні товари
    // з минулих прогонів/промо сайту, через що чекаут стартує не з кроку 1.
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
    // Перевіряємо, що чекаут реально підтягує дані з авторизованого
    // акаунта, а не залишає поля порожніми/дефолтними.
    await expect(
      checkoutPage.lastNameInput,
      'Поле «Прізвище» должно быть предзаполнено фамилией из аккаунта',
    ).toHaveValue(TEST_USER.lastName!);
    await expect(
      checkoutPage.firstNameInput,
      "Поле «Ім'я» должно быть предзаполнено именем из аккаунта",
    ).toHaveValue(TEST_USER.firstName!);
    await expect(
      checkoutPage.patronymicInput,
      'Поле «По-батькові» должно быть предзаполнено отчеством из аккаунта',
    ).toHaveValue(TEST_USER.patronymic!);
    await expect(
      checkoutPage.phoneInput,
      'Поле «Номер телефону» должно быть предзаполнено телефоном из аккаунта',
    ).toHaveValue(TEST_USER.phone!);
    await expect(
      checkoutPage.emailInput,
      'Поле «Email» должно быть предзаполнено почтой из аккаунта',
    ).toHaveValue(TEST_USER.email!);
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
    // Звіряємо, що ціна, яку повернув GET /api/v1/basket/delivery,
    // реально відображається в сайдбарі "Ваше замовлення" на кроці оплати.
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

    // Номер замовлення на сторінці повинен збігатися з orderId з відповіді API,
    // а не просто бути "якимось числом".
    const orderNumberOnPage = await thankYouPage.getOrderNumberFromPage();
    expect(
      orderNumberOnPage,
      `Номер заказа на странице ("${orderNumberOnPage}") должен совпадать с orderId из ответа API ("${orderIdFromApi}")`,
    ).toBe(String(orderIdFromApi));

    // Спосіб доставки в підтвердженні повинен бути саме "Кур'єром «Нова
    // Пошта»", а не самовивіз/відділення/дефолт — перевіряємо, що вибір
    // реально зберігся.
    await expect(
      thankYouPage.orderDeliveryMethodCourier,
      "В подтверждении заказа должен быть указан способ доставки «Кур'єром «Нова Пошта»»",
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

    // Вартість доставки на сторінці підтвердження повинна збігатися з тією,
    // що повернув API (див. крок "Проверить стоимость доставки в чекауте"),
    // а не бути, наприклад, нульовою/дефолтною.
    const deliveryCostOnThankYouPage = await thankYouPage.getDeliveryCostFromPage();
    expect(
      deliveryCostOnThankYouPage,
      `Стоимость доставки на странице подтверждения ("${deliveryCostOnThankYouPage} грн.") должна совпадать со стоимостью из API ("${deliveryPriceFromApi} ₴")`,
    ).toBe(deliveryPriceFromApi);

    // Рядок "Адреса доставки" з'являється лише у кур'єрської доставки —
    // перевіряємо, що в ньому реально ті вулиця/будинок/квартира, що вводили на
    // кроці 2, а не порожнє/дефолтне значення. Формат: "вул. {street}, буд.
    // {house}, кв. {apartment}" (місто стоїть перед цим через кому).
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
