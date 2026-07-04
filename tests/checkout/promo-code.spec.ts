import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { ThankYouPage } from '../pages/ThankYouPage';
import { generateRandomContactDetails } from '../helpers/randomData';
import { getProductFromBasketResponse, expectOrderProductDetails } from '../helpers/basket';

const PRODUCT_NAME = 'Конструктор LEGO Ninjago Подорож до підземель Черепа (71717)';
const PRODUCT_ARTICLE = '71717';
const PROMO_CODE = 'L5LF5M6L';
const PROMO_DISCOUNT_PERCENT = 20;
const CITY = 'Київ';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Проверяет применение промокода на 20% скидки и реально доводит заказ до
// конца: добавляем товар -> запоминаем исходную цену из ответа API добавления
// в корзину -> убеждаемся, что сайдбар "Ваше замовлення" изначально показывает
// эту цену без скидки -> разворачиваем блок "Додати промокод", вводим код и
// дожидаемся ответа GET /api/v1/basket/promo -> проверяем, что появилась
// строка "Знижка: ...", сумма товаров и итог к оплате пересчитались на 20%
// меньше исходной цены (и цена самого товара в карточке сайдбара тоже
// обновилась) -> проходим гостевым чекаутом (самовивіз, оплата при
// отриманні) -> на странице подтверждения проверяем, что и там сумма товара
// показана уже со скидкой (сайт переносит цену со скидкой в "Товарів на
// суму", отдельной строки "Знижка" там нет — в отличие от сайдбара чекаута).
test('Применение промокода на 20% скидки меняет цену товара и сохраняется в заказе (web1-bi.ua)', async ({
  page,
}) => {
  test.setTimeout(60000);

  const brandPage = new LegoBrandPage(page);
  const checkoutPage = new CheckoutPage(page);
  const thankYouPage = new ThankYouPage(page);
  const contactDetails = generateRandomContactDetails();

  let productCodeFromApi!: number;
  let productPriceFromApi!: number;

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

  await test.step('Проверить цену товара до применения промокода', async () => {
    // Сверяем с ценой из API, а не с хардкодом — цена товара может меняться.
    await expect(
      checkoutPage.productsTotalInCheckout,
      `До применения промокода сумма товаров в сайдбаре должна быть "${productPriceFromApi} ₴" (цена из API добавления в корзину)`,
    ).toHaveText(`${productPriceFromApi} ₴`);
  });

  const expectedDiscount = Math.round((productPriceFromApi * PROMO_DISCOUNT_PERCENT) / 100);
  const expectedPriceAfterPromo = productPriceFromApi - expectedDiscount;

  await test.step(`Применить промокод "${PROMO_CODE}"`, async () => {
    await checkoutPage.applyPromoCode(PROMO_CODE);
    // Дожидаемся, пока перерасчёт реально отобразится, прежде чем идти
    // дальше — иначе шаг 1 может стартовать раньше, чем Vue успеет
    // перерисовать сайдбар после ответа API.
    await checkoutPage.discountInCheckout.waitFor({ state: 'visible', timeout: 15000 });
  });

  await test.step('Проверить пересчёт цены после применения промокода (скидка 20%)', async () => {
    await expect(
      checkoutPage.discountInCheckout,
      `После применения промокода должна появиться строка "Знижка: ${expectedDiscount} ₴" (20% от исходной цены ${productPriceFromApi} ₴)`,
    ).toHaveText(`${expectedDiscount} ₴`);
    await expect(
      checkoutPage.productsTotalInCheckout,
      `Сумма товаров после применения промокода должна уменьшиться до "${expectedPriceAfterPromo} ₴"`,
    ).toHaveText(`${expectedPriceAfterPromo} ₴`);
    await expect(
      checkoutPage.totalToPayInCheckout,
      `Итоговая сумма к оплате после применения промокода должна быть "${expectedPriceAfterPromo} ₴"`,
    ).toHaveText(`${expectedPriceAfterPromo} ₴`);
    // Цена в самой карточке товара (не только в итоговых строках) тоже
    // должна обновиться на сниженную — иначе промокод влияет только на
    // отображение суммы, но не на реальную цену позиции.
    await expect(
      checkoutPage.sidebarProductPrice(PRODUCT_NAME),
      `Цена товара в карточке сайдбара должна обновиться до сниженной "${expectedPriceAfterPromo}"`,
    ).toHaveText(String(expectedPriceAfterPromo));
  });

  await test.step('Заполнить контактные данные и выбрать самовивіз', async () => {
    await checkoutPage.fillContactDetails(contactDetails);
    await checkoutPage.confirmContactDetails();
    await checkoutPage.selectPickupInCity(CITY);
  });

  let orderIdFromApi!: number;

  await test.step('Оформить заказ (оплата при получении)', async () => {
    const order = await checkoutPage.placeOrder();
    orderIdFromApi = order.orderId;
  });

  await test.step('Проверить, что сумма со скидкой сохранилась в подтверждении заказа', async () => {
    await expect(
      thankYouPage.successMessage,
      'После оформления заказа должно появиться сообщение об успехе на /ukr/thankyou/',
    ).toBeVisible();

    const orderNumberOnPage = await thankYouPage.getOrderNumberFromPage();
    expect(
      orderNumberOnPage,
      `Номер заказа на странице ("${orderNumberOnPage}") должен совпадать с orderId из ответа API ("${orderIdFromApi}")`,
    ).toBe(String(orderIdFromApi));

    // Название, код, количество и сумма товара должны совпадать с ЦЕНОЙ СО
    // СКИДКОЙ (не с исходной ценой из API добавления в корзину) — сайт
    // переносит скидку от промокода в реальную сумму заказа, а не только
    // в отображение на шаге чекаута.
    await expectOrderProductDetails(thankYouPage, {
      name: PRODUCT_NAME,
      code: productCodeFromApi,
      price: expectedPriceAfterPromo,
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
