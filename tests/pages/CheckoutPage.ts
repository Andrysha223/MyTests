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
    this.shopSelectDropdown = page.locator('span.iSel.sel:visible', { hasText: 'Виберіть магазин' });
    this.placeOrderButton = page.locator('input[type="submit"][value="Оформити замовлення"]:visible');
  }

  async startCheckout() {
    await this.startCheckoutButton.click();
    await this.page.waitForURL('**/basket/**');
  }

  // Для неавторизованного (гостевого) чекаута поля пустые и их нужно
  // заполнить самим — в отличие от авторизованного флоу, где они уже
  // предзаполнены аккаунтом (там просто вызывается confirmContactDetails()).
  //
  // Важные ограничения валидации, с которыми столкнулись при исследовании:
  // - Прізвище/Ім'я/По-батькові принимают только кирилицю, цифры дают ошибку
  //   "Введіть ... кирилицею".
  // - Телефон — маскированное поле "+38 (0__) ___-__-__", где ведущий "0" —
  //   часть фиксированного шаблона (курсор сразу становится на первый
  //   редактируемый разряд). details.phone должен содержать РОВНО 9 цифр:
  //   код оператора (2 цифры) + номер (7 цифр), БЕЗ ведущего "0" —
  //   см. generateRandomContactDetails(). Печатать нужно строго по одному
  //   символу с паузой: пакетный pressSequentially(fullString) на этом поле
  //   мешает цифры местами (реактивная маска не успевает за пачкой инпутов).
  async fillContactDetails(details: {
    lastName: string;
    firstName: string;
    patronymic: string;
    phone: string;
    email: string;
  }) {
    await this.lastNameInput.pressSequentially(details.lastName, { delay: 20 });
    await this.firstNameInput.pressSequentially(details.firstName, { delay: 20 });
    await this.patronymicInput.pressSequentially(details.patronymic, { delay: 20 });
    await this.fillPhoneWithRetry(details.phone);
    await this.emailInput.pressSequentially(details.email, { delay: 20 });
  }

  // Даже печатая по одному символу, маска телефона иногда "теряет" цифру
  // (реактивный компонент не всегда успевает обработать keydown вовремя) —
  // тогда валидация показывает "Будь ласка, перевірте коректність...".
  // Проверяем это после ввода и, если нужно, очищаем поле и вводим заново.
  private async fillPhoneWithRetry(phone: string) {
    const phoneError = this.page.locator('text=Будь ласка, перевірте коректність');

    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.phoneInput.click();
      await this.phoneInput.press('Control+A');
      await this.phoneInput.press('Delete');

      for (const digit of phone) {
        await this.phoneInput.pressSequentially(digit, { delay: 0 });
        await this.page.waitForTimeout(120);
      }
      await this.page.waitForTimeout(200);

      if (!(await phoneError.isVisible().catch(() => false))) {
        return;
      }
    }
  }

  // Поля контактных данных либо уже предзаполнены из аккаунта (авторизованный
  // флоу), либо только что заполнены через fillContactDetails() (гостевой) —
  // в обоих случаях остаётся просто подтвердить их кликом "Далі".
  async confirmContactDetails() {
    await this.contactDetailsForm.locator('input[type="submit"][value="Далі"]').click();
    // SPA перерисовывает шаг 2 не мгновенно: JS-обработчики на новых полях
    // (автокомплит города) навешиваются с небольшой задержкой после рендера,
    // поэтому печать в cityInput сразу после клика теряется.
    await this.cityInput.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(500);
  }

  // shopNameContains не задан — берём первый доступный в списке магазин.
  // Список магазинов зависит от наличия товара и отличается между
  // окружениями/аккаунтами, поэтому жёстко задавать конкретный адрес имеет
  // смысл только там, где это явно проверяется тестом (см. логин-тест).
  async selectPickupInCity(city: string, shopNameContains?: string) {
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
    // У списка магазинов есть скрытые (visibility:hidden) дубли элементов —
    // фильтруем через :visible вместо предположений о конкретном индексе.
    const shopOptions = shopNameContains
      ? this.page.locator('li.iSelOp:visible', { hasText: shopNameContains })
      : this.page.locator('li.iSelOp:visible');
    await shopOptions.first().click();
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
  //
  // У гостевого (неавторизованного) чекаута на шаге 3 есть дополнительный
  // чекбокс согласия с "Публічним договором купівлі-продажу" — он НЕ отмечен
  // по умолчанию и без него сабмит молча не срабатывает (клик проходит, но
  // запрос на сервер не уходит вовсе — раньше это ошибочно списывалось на
  // ту же нестабильную reCAPTCHA). У авторизованных пользователей такого
  // чекбокса нет вообще, поэтому отмечаем его только если он есть на странице.
  //
  // Сам <input type="checkbox"> скрыт (визуально стилизован через соседний
  // <div class="check">), и его checked-состояние управляется JS/Vue, а не
  // нативно: клик по <label> или программный .check() на скрытом input не
  // переключает состояние вообще. Кликать нужно именно по видимому
  // div.check внутри label — только так стейт реально меняется.
  async placeOrder(): Promise<{ orderId: number }> {
    await this.placeOrderButton.waitFor({ state: 'visible' });

    const consentLabel = this.page.locator('li', { has: this.page.locator('text=Публічним договором') });
    if (await consentLabel.isVisible().catch(() => false)) {
      await consentLabel.locator('div.check').click();
    }

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
