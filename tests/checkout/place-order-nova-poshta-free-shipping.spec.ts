import { test, expect } from '@playwright/test';
import { ProductPage } from '../pages/ProductPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { ThankYouPage } from '../pages/ThankYouPage';
import { CartPage } from '../pages/CartPage';
import { getProductFromBasketResponse, expectOrderProductDetails } from '../helpers/basket';
import { TEST_USER, isTestUserConfigured, loginAsTestUser } from '../helpers/auth';

// Цена товара (1 902 ₴) сама по себе выше порога бесплатной доставки Нової
// Пошти (freeShippingMinPrice: 1700 ₴ в ответе API) — поэтому одной штуки
// достаточно, докупать количество не нужно.
const PRODUCT_NAME = 'Конструктор LEGO Marvel super heroes Шолом Залізної Людини (76165)';
const PRODUCT_ARTICLE = '76165';
const PRODUCT_URL =
  'https://web1-bi.ua/ukr/product/konstruktor-lego-marvel-super-heroes-shlem-zheleznogo-cheloveka-76165.html';
const CITY = 'Київ';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Проверяет бесплатную доставку у відділення «Нова Пошта» при сумме
// замовлення від 1700 ₴ (freeShippingMinPrice у відповіді
// GET /api/v1/basket/delivery): логин -> очистка корзины -> добавление
// дорогого товара (LEGO Marvel Шолом Залізної Людини, 1902 ₴, вище порогу) ->
// контактні дані предзаповнені аккаунтом -> вибір способу доставки "Нова
// Пошта", перше доступне відділення -> перевірка, що і в сайдбарі чекауту, і
// на сторінці підтвердження доставка показана як "Безкоштовно" (а не
// "0 ₴"/"0 грн." — сайт саме так відображає безкоштовну доставку) ->
// оплата при отриманні -> підтвердження замовлення.
test('Оформление заказа с безкоштовною доставкою Нової Пошти при сумі від 1700 ₴ (web1-bi.ua)', async ({
  page,
}) => {
  test.skip(
    !isTestUserConfigured,
    'LOGIN_EMAIL / LOGIN_PASSWORD / LOGIN_LAST_NAME / LOGIN_FIRST_NAME / LOGIN_PATRONYMIC / LOGIN_PHONE не заданы в .env',
  );
  test.setTimeout(90000);

  const productPage = new ProductPage(page, PRODUCT_URL);
  const checkoutPage = new CheckoutPage(page);
  const thankYouPage = new ThankYouPage(page);
  const cartPage = new CartPage(page);

  await test.step('Авторизоваться', async () => {
    await loginAsTestUser(page);
  });

  await test.step('Очистить корзину', async () => {
    // Тестовый аккаунт общий — в корзине могут остаться посторонние товары
    // с прошлых прогонов/промо сайта, из-за чего чекаут стартует не с шага 1
    // и сумма заказа не совпадёт с ожидаемой.
    await cartPage.clearCart();
  });

  let productCodeFromApi: number;
  let productPriceFromApi: number;

  await test.step('Добавить дорогой товар в корзину', async () => {
    const addToCartApiResponse = page.waitForResponse(
      (r) => r.url().includes('/api/v1/basket/good') && r.request().method() === 'POST',
    );

    await productPage.goto();
    await productPage.clickBuy();

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

  await test.step('Выбрать доставку в отделение Новой почты', async () => {
    const delivery = await checkoutPage.selectNovaPoshtaBranch(CITY);
    deliveryPriceFromApi = delivery.deliveryPrice;
  });

  await test.step('Проверить, что API вернул бесплатную доставку (сума ≥ 1700 ₴)', async () => {
    expect(
      deliveryPriceFromApi,
      `Стоимость доставки из ответа API должна быть 0 ₴, т.к. сумма заказа (${productPriceFromApi} ₴) превышает порог бесплатной доставки (1700 ₴)`,
    ).toBe(0);
  });

  await test.step('Проверить, что доставка бесплатная в чекауте', async () => {
    // При бесплатной доставке сайт показывает в сайдбаре именно текст
    // "Безкоштовно", а не "0 ₴" — поэтому сверяем со строкой, а не с ценой.
    await expect(
      checkoutPage.deliveryCostInCheckout,
      'В сайдбаре чекаута доставка Новой Почты должна отображаться как "Безкоштовно", т.к. сумма заказа превышает 1700 ₴',
    ).toHaveText('Безкоштовно');
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

    const orderNumberOnPage = await thankYouPage.getOrderNumberFromPage();
    expect(
      orderNumberOnPage,
      `Номер заказа на странице ("${orderNumberOnPage}") должен совпадать с orderId из ответа API ("${orderIdFromApi}")`,
    ).toBe(String(orderIdFromApi));

    await expect(
      thankYouPage.orderDeliveryMethodNovaPoshta,
      'В подтверждении заказа должен быть указан способ доставки «У відділення «Нова Пошта»',
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

    // На странице подтверждения доставка тоже должна быть подписана как
    // "Безкоштовно" (а не "0 грн."), как и в сайдбаре чекаута.
    await expect(
      thankYouPage.orderDeliveryCostRow,
      'На странице подтверждения доставка Новой Почты должна отображаться как "Безкоштовно", т.к. сумма заказа превышает 1700 ₴',
    ).toContainText('Безкоштовно');
  });

  await test.step('Проверить, что корзина пуста после заказа', async () => {
    await expect(
      productPage.header.cartCounter,
      'После успешного оформления заказа корзина должна опустеть (счётчик в хедере = 0)',
    ).toHaveText('0');
  });
});
