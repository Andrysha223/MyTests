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

// Перевіряє застосування промокоду на 20% знижки і реально доводить замовлення до
// кінця: додаємо товар -> запам'ятовуємо початкову ціну з відповіді API додавання
// в кошик -> переконуємось, що сайдбар "Ваше замовлення" спочатку показує
// цю ціну без знижки -> розгортаємо блок "Додати промокод", вводимо код і
// чекаємо відповідь GET /api/v1/basket/promo -> перевіряємо, що з'явився
// рядок "Знижка: ...", сума товарів і підсумок до оплати перерахувалися на 20%
// менше початкової ціни (і ціна самого товару в картці сайдбара теж
// оновилась) -> проходимо гостьовим чекаутом (самовивіз, оплата при
// отриманні) -> на сторінці підтвердження перевіряємо, що і там сума товару
// показана вже зі знижкою (сайт переносить ціну зі знижкою в "Товарів на
// суму", окремого рядка "Знижка" там немає — на відміну від сайдбара чекауту).
test('Применение промокода на 20% скидки меняет цену товара и сохраняется в заказе (web1-bi.ua)', async ({
  page,
}, testInfo) => {
  // На мобільній верстці сайдбар "Ваше замовлення" (а разом з ним і блок
  // "Додати промокод") на кроці 1 взагалі не рендериться — він з'являється лише
  // на кроці 3 (метод оплати), на відміну від десктопу, де видно з кроку 1.
  // Тест за змістом перевіряє застосування промокоду ДО заповнення контактних
  // даних, що на мобільній верстці фізично неможливо — це відмінність
  // самого флоу, а не селектора.
  test.skip(
    testInfo.project.name === 'Mobile Chrome',
    'На мобильной верстке блок "Ваше замовлення"/"Додати промокод" появляется только на шаге 3, а не с шага 1 — сценарий теста не применим в текущем виде',
  );
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
    // Звіряємо з ціною з API, а не з хардкодом — ціна товару може змінюватись.
    await expect(
      checkoutPage.productsTotalInCheckout,
      `До применения промокода сумма товаров в сайдбаре должна быть "${productPriceFromApi} ₴" (цена из API добавления в корзину)`,
    ).toHaveText(`${productPriceFromApi} ₴`);
  });

  const expectedDiscount = Math.round((productPriceFromApi * PROMO_DISCOUNT_PERCENT) / 100);
  const expectedPriceAfterPromo = productPriceFromApi - expectedDiscount;

  await test.step(`Применить промокод "${PROMO_CODE}"`, async () => {
    await checkoutPage.applyPromoCode(PROMO_CODE);
    // Чекаємо, поки перерахунок реально відобразиться, перш ніж йти
    // далі — інакше крок 1 може стартувати раніше, ніж Vue встигне
    // перемалювати сайдбар після відповіді API.
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
    // Ціна в самій картці товару (не лише в підсумкових рядках) теж
    // повинна оновитися на знижену — інакше промокод впливає лише на
    // відображення суми, але не на реальну ціну позиції.
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

    // Назва, код, кількість і сума товару повинні збігатися з ЦІНОЮ ЗІ
    // ЗНИЖКОЮ (не з початковою ціною з API додавання в кошик) — сайт
    // переносить знижку від промокоду в реальну суму замовлення, а не лише
    // у відображення на кроці чекауту.
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
