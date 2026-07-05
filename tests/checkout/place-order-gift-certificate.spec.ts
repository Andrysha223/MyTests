import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { ThankYouPage } from '../pages/ThankYouPage';
import { generateRandomContactDetails } from '../helpers/randomData';
import { getProductFromBasketResponse, expectOrderProductDetails } from '../helpers/basket';

const PRODUCT_NAME = 'Електронний подарунковий сертифікат Будинок іграшок номіналом 1000 грн';
const PRODUCT_ARTICLE = '1000';
const CERTIFICATES_URL = 'https://web1-bi.ua/ukr/gifts/certificates/';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
// locale: 'uk-UA' — щоб зовнішня сторінка оплати LiqPay гарантовано показувала
// українську кнопку "Скасувати оплату" (без цього LiqPay визначає мову за
// замовчуванням браузера Playwright, тобто en-US, і показує "Decline payment").
test.use({ ignoreHTTPSErrors: true, locale: 'uk-UA' });

// Чекаут електронного подарункового сертифіката суттєво відрізняється від
// звичайного товару (виявлено аналізом реального флоу на сайті):
// - Крок 2 "Вибір способу доставки" ПОВНІСТЮ ВІДСУТНІЙ — після контактних
//   даних чекаут одразу переходить на крок 3 (метод оплати), без вибору
//   міста/відділення/самовивозу. Тому тут НЕ можна викликати
//   confirmContactDetails() — він чекає появи cityInput, якого для
//   сертифіката просто не буде, і тест завис би до таймауту.
// - Доставка — "На ел. пошту", безкоштовно (не залежить від суми замовлення).
// - Єдиний доступний спосіб оплати — "Карткою на сайті" (як у поштоматі
//   «Нова Пошта»), варіанту "При отриманні" немає в принципі — цифровий
//   товар не можна видати "при отриманні" фізично.
// - Оскільки реально оплачувати карткою в тесті не можна, оплату скасовуємо
//   на LiqPay (як і в place-order-postomat.spec.ts). Але для сертифіката це
//   веде до ІНШОГО тексту на /thankyou/, ніж завичайного товару: замість
//   загального "Вітаємо, замовлення успішно оформлено." сайт показує окреме
//   повідомлення про те, що оплата не пройшла і сертифікат не буде
//   згенеровано, поки оплата не надійде.
test('Оформление заказа электронного подарункового сертификата номиналом 1000 грн (web1-bi.ua)', async ({
  page,
}) => {
  test.setTimeout(60000);

  const brandPage = new LegoBrandPage(page, CERTIFICATES_URL);
  const checkoutPage = new CheckoutPage(page);
  const thankYouPage = new ThankYouPage(page);
  const contactDetails = generateRandomContactDetails();

  let productCodeFromApi: number;
  let productPriceFromApi: number;

  await test.step('Добавить сертификат в корзину как гость', async () => {
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

  await test.step('Заполнить случайные контактные данные и перейти сразу к оплате', async () => {
    await checkoutPage.fillContactDetails(contactDetails);
    // Не confirmContactDetails() — у сертифіката немає кроку 2, тому просто
    // тиснемо "Далі" й одразу опиняємось на кроці 3 (метод оплати).
    await checkoutPage.contactDetailsForm.locator('input[type="submit"][value="Далі"]').click();
  });

  await test.step('Проверить, что шаг 2 (доставка) отсутствует, а доставка бесплатная', async () => {
    // Для сертифіката немає вибору способу доставки — сайдбар одразу показує
    // "Доставка: Безкоштовно" замість числової вартості, як у звичайних товарів.
    await expect(
      checkoutPage.deliveryCostInCheckout,
      'Для електронного сертифіката доставка має бути позначена як "Безкоштовно" (без вибору способу доставки)',
    ).toHaveText('Безкоштовно');
  });

  let orderIdFromApi: number;

  await test.step('Оформить заказ и отменить оплату картой на LiqPay', async () => {
    // Єдиний доступний спосіб оплати сертифіката — карткою на сайті, тому
    // реально не платимо, а скасовуємо оплату (як і в place-order-postomat).
    const order = await checkoutPage.placeOrderAndDeclineCardPayment();
    orderIdFromApi = order.orderId;
  });

  await test.step('Проверить подтверждение заказа (оплата не завершена)', async () => {
    // На відміну від звичайних товарів, для сертифіката з незавершеною
    // оплатою сайт НЕ показує загальний successMessage — замість нього окреме
    // повідомлення про те, що потрібно повторити оплату.
    await expect(
      thankYouPage.certificatePaymentNotCompletedMessage,
      'Для сертифіката з незавершеною оплатою на /ukr/thankyou/ має з’явитись повідомлення про необхідність повторити оплату',
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
      thankYouPage.orderDeliveryMethodEmail,
      'В подтверждении заказа способ доставки сертификата должен быть указан как "На ел. пошту"',
    ).toBeVisible();
    await expect(
      thankYouPage.orderPaymentMethodCard,
      'В подтверждении заказа должен быть указан способ оплаты «Карткою на сайті»',
    ).toBeVisible();
    await expect(
      thankYouPage.orderPaymentStatusPending,
      'Статус оплати должен быть «Очікування платежу», т.к. оплата картой была отменена на LiqPay',
    ).toBeVisible();
    // Стоимость доставки в подтверждении должна остаться "Безкоштовно", как
    // и в сайдбаре чекаута, а не превратиться в числовое значение/0 грн.
    await expect(
      thankYouPage.orderDeliveryCostRow,
      'Стоимость доставки в подтверждении заказа должна быть "Безкоштовно"',
    ).toContainText('Безкоштовно');

    await expectOrderProductDetails(thankYouPage, {
      name: PRODUCT_NAME,
      code: productCodeFromApi,
      price: productPriceFromApi,
      quantity: 1,
    });
  });
});
