import { Page, Locator } from '@playwright/test';

export class CheckoutPage {
  readonly page: Page;
  // Кнопка "Оформити замовлення" на странице корзины — переводит на /ukr/basket/ (сам чекаут).
  readonly startCheckoutButton: Locator;

  // Шаг 1: Контактні дані. Форма ищется по лейблу "Прізвище", т.к. на странице
  // одновременно лежит несколько форм (поиск, попапы, чекаут).
  readonly contactDetailsForm: Locator;
  // Поля предзаполняются данными авторизованного аккаунта. У инпутов нет
  // ни id, ни name (кроме телефона) — различаем только по порядку в форме.
  readonly lastNameInput: Locator;
  readonly firstNameInput: Locator;
  readonly patronymicInput: Locator;
  readonly phoneInput: Locator;
  readonly emailInput: Locator;

  // Шаг 2: Вибір способу доставки.
  readonly cityInput: Locator;
  readonly pickupDeliveryOption: Locator;
  // У некоторых элементов формы на странице есть скрытый (visibility:hidden) дубль —
  // поэтому большинство локаторов ниже фильтруются через :visible.
  readonly shopSelectDropdown: Locator;

  // Шаг 3: Метод оплати. По умолчанию выбран безопасный вариант "При отриманні" —
  // отдельного локатора для выбора не нужно.
  readonly placeOrderButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.startCheckoutButton = page.locator('text=Оформити замовлення');
    this.contactDetailsForm = page.locator('form', { has: page.locator('text=Прізвище') });
    const contactTextInputs = this.contactDetailsForm.locator('input[type="text"]');
    this.lastNameInput = contactTextInputs.nth(0);
    this.firstNameInput = contactTextInputs.nth(1);
    this.patronymicInput = contactTextInputs.nth(2);
    this.phoneInput = this.contactDetailsForm.locator('input[name="phone"]');
    this.emailInput = contactTextInputs.nth(4);
    this.cityInput = page.locator('input[placeholder="Почніть вводити назву"]');
    this.pickupDeliveryOption = page.locator('text=Самовивіз із магазину');
    this.shopSelectDropdown = page.locator('span.iSel.sel', { hasText: 'Виберіть магазин' }).nth(1);
    this.placeOrderButton = page.locator('input[type="submit"][value="Оформити замовлення"]:visible');
  }

  async startCheckout() {
    await this.startCheckoutButton.click();
    await this.page.waitForURL('**/basket/**');
  }

  // Поля контактных данных уже предзаполнены из аккаунта авторизованного пользователя,
  // поэтому шаг просто подтверждает их кликом "Далі".
  async confirmContactDetails() {
    await this.contactDetailsForm.locator('input[type="submit"][value="Далі"]').click();
    // SPA перерисовывает шаг 2 не мгновенно: JS-обработчики на новых полях
    // (автокомплит города) навешиваются с небольшой задержкой после рендера,
    // поэтому печать в cityInput сразу после клика теряется.
    await this.cityInput.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(500);
  }

  async selectPickupInCity(city: string, shopNameContains: string) {
    // Автокомплит city ищет по частичному совпадению; полное слово почему-то
    // не всегда триггерит подсказку, поэтому вводим только первые 2 буквы.
    await this.cityInput.pressSequentially(city.slice(0, 2), { delay: 50 });
    const cityOption = this.page.locator(`text=м. ${city}`).first();
    await cityOption.waitFor({ state: 'visible' });
    await cityOption.click();
    await this.page.waitForTimeout(500);

    await this.pickupDeliveryOption.click();
    await this.page.waitForTimeout(500);

    await this.shopSelectDropdown.click();
    await this.page.waitForTimeout(300);
    await this.page.locator('li.iSelOp', { hasText: shopNameContains }).nth(1).click();
    await this.page.waitForTimeout(300);

    await this.page.locator('input[type="submit"][value="Далі"]:visible').first().click();
    // Дожидаемся, пока реально отрисуется шаг 3 (метод оплаты) — иначе
    // клик по "Оформити замовлення" в placeOrder() может произойти
    // до того, как кнопка станет кликабельной, и запрос не улетит вовсе.
    await this.placeOrderButton.waitFor({ state: 'visible' });
  }

  // Шаг 3 (метод оплаты) не требует действий — по умолчанию выбрано
  // безопасное "При отриманні (готівкою/карткою)", без ввода платёжних данных.
  // Тело ответа читаем сразу после resolve, до навигации на /thankyou/ —
  // иначе Chromium выгружает буфер ответа и response.json() падает.
  //
  // На web1-bi.ua сломана конфигурация reCAPTCHA для этого домена ("Invalid
  // domain for site key" в консоли) — invisible-recaptcha перед отправкой
  // заказа иногда молча не срабатывает, и клик не приводит к реальному
  // запросу. Это баг тестового окружения, а не теста; лечим повторным кликом.
  async placeOrder(): Promise<{ orderId: number }> {
    await this.placeOrderButton.waitFor({ state: 'visible' });

    const waitForOrderResponse = () =>
      this.page.waitForResponse(
        (r) => r.url().includes('/api/v1/orders/order') && r.request().method() === 'POST',
        { timeout: 15000 },
      );

    let orderResponse;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        [orderResponse] = await Promise.all([waitForOrderResponse(), this.placeOrderButton.click()]);
        break;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }

    const body = await orderResponse!.json();

    await this.page.waitForURL('**/thankyou/**');

    return { orderId: body?.data?.orderId };
  }
}
