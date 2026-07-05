import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { ThankYouPage } from '../pages/ThankYouPage';
import { CartPage } from '../pages/CartPage';
import { getProductFromBasketResponse, expectOrderProductDetails } from '../helpers/basket';
import { TEST_USER, isTestUserConfigured, loginAsTestUser } from '../helpers/auth';

const PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';
const PRODUCT_ARTICLE = '60238';
const CITY = 'Київ';
const SHOP_NAME_CONTAINS = 'Басейна';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Перевіряє повний флоу оформлення замовлення: логін -> додавання товару в
// кошик -> оформлення замовлення (контактні дані вже заповнені з
// акаунта -> самовивіз з конкретного магазину -> оплата при отриманні) ->
// підтвердження з номером замовлення.
test('Оформление заказа с самовывозом и оплатой при получении (web1-bi.ua)', async ({ page }) => {
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
      'Поле «Ім\'я» должно быть предзаполнено именем из аккаунта',
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

    // Номер замовлення на сторінці повинен збігатися з orderId з відповіді API,
    // а не просто бути "якимось числом".
    const orderNumberOnPage = await thankYouPage.getOrderNumberFromPage();
    expect(
      orderNumberOnPage,
      `Номер заказа на странице ("${orderNumberOnPage}") должен совпадать с orderId из ответа API ("${orderIdFromApi}")`,
    ).toBe(String(orderIdFromApi));

    // Дані в блоці "Інформація про замовлення" повинні збігатися з тим,
    // що реально обирали на кроках 2-3, а не показувати дефолт/старе значення.
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

    // Назва, код товару, кількість і сума повинні збігатися з тим, що
    // реально повернув API при додаванні в кошик, а не бути дефолтом/порожнім.
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
