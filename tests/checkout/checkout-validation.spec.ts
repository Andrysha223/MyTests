import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { generateRandomContactDetails } from '../helpers/randomData';

// Товар для позитивных шагов "добавить в корзину -> начать оформление" —
// сам продукт не важен, нужен любой доступный самовивозом/у відділення.
const PRODUCT_NAME_PICKUP_ONLY = 'Конструктор LEGO City Залізничні стрілки (60238)';
const PRODUCT_NAME_ALL_DELIVERY = 'Конструктор LEGO Speed champions Автомобіль McLaren Senna (75892)';
const CITY = 'Київ';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Негативные кейсы валидации чекаута (гостевой флоу — авторизация тут не
// нужна, поля не предзаполнены аккаунтом, что и требуется для проверки
// клиентской валидации). Каждый тест — отдельный сценарий, независимый от
// остальных (общего состояния между ними нет, кроме шагов "добавить в
// корзину -> начать оформление", которые повторяются в каждом).

test('Пустая форма контактных данных не проходит валидацию (web1-bi.ua)', async ({ page }) => {
  const brandPage = new LegoBrandPage(page);
  const checkoutPage = new CheckoutPage(page);

  await test.step('Добавить товар в корзину и начать оформление', async () => {
    await brandPage.goto();
    await brandPage.addToCart(PRODUCT_NAME_PICKUP_ONLY);
    await page.waitForURL('**/basket/cart/**');
    await checkoutPage.startCheckout();
  });

  await test.step('Нажать "Далі" на пустой форме и проверить ошибки полей', async () => {
    await checkoutPage.contactDetailsForm.locator('input[type="submit"][value="Далі"]').click();

    await expect(
      checkoutPage.validationError('Введіть прізвище кирилицею'),
      'При пустом поле «Прізвище» должна появиться ошибка о вводе кирилицею',
    ).toBeVisible();
    await expect(
      checkoutPage.validationError('Введіть ім’я кирилицею'),
      "При пустом поле «Ім'я» должна появиться ошибка о вводе кирилицею",
    ).toBeVisible();
    await expect(
      checkoutPage.validationError('Ваше по-батькові кирилицею'),
      'При пустом поле «По-батькові» должна появиться ошибка о вводе кирилицею',
    ).toBeVisible();
    await expect(
      checkoutPage.validationError('Будь ласка, перевірте коректність введеного номера'),
      'При пустом поле «Номер телефону» должна появиться ошибка о некорректном номере',
    ).toBeVisible();

    // Форма не должна пропустить на шаг 2 — поле міста ещё не должно
    // существовать/быть видимым, т.к. предыдущий шаг не пройден.
    await expect(
      checkoutPage.cityInput,
      'После неудачной валидации формы контактных данных чекаут не должен перейти на шаг 2 (поле «Місто» не должно быть видно)',
    ).toBeHidden();
  });
});

test('Латиница и цифры в ФИО не проходят валидацию (web1-bi.ua)', async ({ page }) => {
  const brandPage = new LegoBrandPage(page);
  const checkoutPage = new CheckoutPage(page);

  await test.step('Добавить товар в корзину и начать оформление', async () => {
    await brandPage.goto();
    await brandPage.addToCart(PRODUCT_NAME_PICKUP_ONLY);
    await page.waitForURL('**/basket/cart/**');
    await checkoutPage.startCheckout();
  });

  await test.step('Заполнить ФИО латиницей/цифрами и проверить ошибки', async () => {
    await checkoutPage.lastNameInput.fill('Ivanov123');
    await checkoutPage.firstNameInput.fill('Ivan');
    await checkoutPage.patronymicInput.fill('Ivanovich');
    await checkoutPage.contactDetailsForm.locator('input[type="submit"][value="Далі"]').click();

    await expect(
      checkoutPage.validationError('Введіть прізвище кирилицею'),
      'Латиница с цифрами в «Прізвище» должна давать ошибку о вводе кирилицею',
    ).toBeVisible();
    await expect(
      checkoutPage.validationError('Введіть ім’я кирилицею'),
      "Латиница в «Ім'я» должна давать ошибку о вводе кирилицею",
    ).toBeVisible();
    await expect(
      checkoutPage.validationError('Ваше по-батькові кирилицею'),
      'Латиница в «По-батькові» должна давать ошибку о вводе кирилицею',
    ).toBeVisible();
  });
});

test('Невалидный формат email не проходит валидацию (web1-bi.ua)', async ({ page }) => {
  const brandPage = new LegoBrandPage(page);
  const checkoutPage = new CheckoutPage(page);
  const contactDetails = generateRandomContactDetails();

  await test.step('Добавить товар в корзину и начать оформление', async () => {
    await brandPage.goto();
    await brandPage.addToCart(PRODUCT_NAME_PICKUP_ONLY);
    await page.waitForURL('**/basket/cart/**');
    await checkoutPage.startCheckout();
  });

  await test.step('Заполнить корректные ФИО/телефон, но невалидный email', async () => {
    // Email — необязательное поле (пустое не даёт ошибки), но если
    // заполнено — должно проходить проверку формата.
    await checkoutPage.fillContactDetails({ ...contactDetails, email: 'not-an-email' });
    await checkoutPage.contactDetailsForm.locator('input[type="submit"][value="Далі"]').click();

    await expect(
      checkoutPage.validationError('Введіть Email в форматі email@gmail.com'),
      'Email без "@" и домена должен давать ошибку о неверном формате',
    ).toBeVisible();
    await expect(
      checkoutPage.cityInput,
      'С невалидным email чекаут не должен перейти на шаг 2 (поле «Місто» не должно быть видно)',
    ).toBeHidden();
  });
});

test('Незаполненное поле "Місто" на шаге 2 не проходит валидацию (web1-bi.ua)', async ({ page }) => {
  const brandPage = new LegoBrandPage(page);
  const checkoutPage = new CheckoutPage(page);
  const contactDetails = generateRandomContactDetails();

  await test.step('Пройти шаг 1 и попасть на шаг 2', async () => {
    await brandPage.goto();
    await brandPage.addToCart(PRODUCT_NAME_PICKUP_ONLY);
    await page.waitForURL('**/basket/cart/**');
    await checkoutPage.startCheckout();
    await checkoutPage.fillContactDetails(contactDetails);
    await checkoutPage.confirmContactDetails();
  });

  await test.step('Нажать "Далі" с пустым полем "Місто"', async () => {
    await page.locator('input[type="submit"][value="Далі"]:visible').first().click();

    await expect(
      checkoutPage.validationError('Виберіть місто зі списку'),
      'Без выбора города из списка должна появиться ошибка "Виберіть місто зі списку"',
    ).toBeVisible();
    // Способы доставки рендерятся только после выбора города — их отсутствие
    // подтверждает, что чекаут реально не продвинулся дальше.
    await expect(
      checkoutPage.pickupDeliveryOption,
      'Без выбранного города способы доставки не должны отображаться',
    ).toBeHidden();
  });
});

test('Способ доставки "у відділення" без выбора конкретного відділення не проходит валидацию (web1-bi.ua)', async ({
  page,
}) => {
  const brandPage = new LegoBrandPage(page);
  const checkoutPage = new CheckoutPage(page);
  const contactDetails = generateRandomContactDetails();

  await test.step('Пройти шаг 1 и выбрать місто', async () => {
    await brandPage.goto();
    await brandPage.addToCart(PRODUCT_NAME_ALL_DELIVERY);
    await page.waitForURL('**/basket/cart/**');
    await checkoutPage.startCheckout();
    await checkoutPage.fillContactDetails(contactDetails);
    await checkoutPage.confirmContactDetails();

    await checkoutPage.cityInput.pressSequentially(CITY.slice(0, 2), { delay: 50 });
    const cityOption = page.locator(`text=м. ${CITY}`).first();
    await cityOption.waitFor({ state: 'visible' });
    await cityOption.click();
  });

  await test.step('Выбрать "У відділення «Нова Пошта»", не выбирая відділення, и нажать "Далі"', async () => {
    await checkoutPage.novaPoshtaDeliveryOption.click();
    await page.locator('input[type="submit"][value="Далі"]:visible').first().click();

    await expect(
      checkoutPage.deliveryValidationHint,
      'Без выбора конкретного відділення должно появиться предупреждение "Будь ласка, заповніть усі дані щодо доставки."',
    ).toBeVisible();
    await expect(
      checkoutPage.branchInput,
      'Поле выбора відділення должно быть подсвечено как невалидное (класс ошибки "er")',
    ).toHaveClass(/\ber\b/);
  });
});

test('Гостевой чекаут без согласия с публичным договором не оформляет заказ (web1-bi.ua)', async ({
  page,
}) => {
  const brandPage = new LegoBrandPage(page);
  const checkoutPage = new CheckoutPage(page);
  const contactDetails = generateRandomContactDetails();

  await test.step('Дойти до шага 3, не отмечая согласие с договором', async () => {
    await brandPage.goto();
    await brandPage.addToCart(PRODUCT_NAME_PICKUP_ONLY);
    await page.waitForURL('**/basket/cart/**');
    await checkoutPage.startCheckout();
    await checkoutPage.fillContactDetails(contactDetails);
    await checkoutPage.confirmContactDetails();
    await checkoutPage.selectPickupInCity(CITY);
  });

  await test.step('Нажать "Оформити замовлення" без галочки согласия', async () => {
    // Чекбокс согласия с "Публічним договором купівлі-продажу" по умолчанию
    // не отмечен у гостевого чекаута — намеренно НЕ кликаем по нему.
    const orderRequestPromise = page
      .waitForRequest(
        (r) => r.url().includes('/api/v1/orders/order') && r.method() === 'POST',
        { timeout: 3000 },
      )
      .then(() => true)
      .catch(() => false);

    await checkoutPage.placeOrderButton.click();
    const orderRequestFired = await orderRequestPromise;

    expect(
      orderRequestFired,
      'Без согласия с публичным договором запрос на создание заказа (POST /api/v1/orders/order) не должен отправляться',
    ).toBe(false);
    expect(
      page.url(),
      'Без согласия с публичным договором чекаут не должен переходить на страницу подтверждения заказа',
    ).not.toContain('/thankyou/');
  });
});
