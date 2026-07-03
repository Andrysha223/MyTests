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
const PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';
const PRODUCT_ARTICLE = '60238';
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
      'Поле «Ім\'я» должно быть предзаполнено именем из аккаунта',
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

  await test.step('Выбрать самовывоз', async () => {
    await checkoutPage.selectPickupInCity(CITY, SHOP_NAME_CONTAINS);
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

    // Данные в блоке "Інформація про замовлення" должны совпадать с тем,
    // что реально выбирали на шагах 2-3, а не показывать дефолт/старое значение.
    await expect(
      thankYouPage.orderDeliveryMethod,
      'В подтверждении заказа должен быть указан способ доставки «Самовивіз із магазину»',
    ).toBeVisible();
    await expect(
      thankYouPage.orderShopAddress(SHOP_NAME_CONTAINS),
      `В подтверждении заказа должен быть указан магазин самовывоза, содержащий «${SHOP_NAME_CONTAINS}»`,
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
  });

  await test.step('Проверить, что корзина пуста после заказа', async () => {
    await expect(
      brandPage.header.cartCounter,
      'После успешного оформления заказа корзина должна опустеть (счётчик в хедере = 0)',
    ).toHaveText('0');
  });
});
