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
  readonly novaPoshtaDeliveryOption: Locator;
  readonly postomatDeliveryOption: Locator;
  readonly ukrPoshtaDeliveryOption: Locator;
  readonly courierDeliveryOption: Locator;
  // Плейсхолдер начинается с "Виберіть номер ..." одинаково у всех способов
  // доставки "в пункт" (відділення/поштомат Нової Пошти, Укрпошта), поэтому
  // в DOM одновременно несколько таких инпутов — фильтр :visible оставляет
  // только активный, а префиксный селектор покрывает разный текст в конце
  // ("відділення" / "поштомата").
  readonly branchInput: Locator;
  // Поля адреса для кур'єрської доставки — появляются после выбора
  // "Кур'єром «Нова Пошта»" вместо поля выбора відділення.
  readonly streetInput: Locator;
  readonly houseNumberInput: Locator;
  readonly apartmentNumberInput: Locator;
  // Строка "Доставка: 30 ₴" в сайдбаре "Ваше замовлення" — появляется после
  // выбора способу доставки (видна начиная с шага 3).
  readonly deliveryCostInCheckout: Locator;
  // Общее предупреждение над кнопкою "Далі" на шаге 2 — появляется, если
  // способ доставки обрано, але не заповнені залежні поля (наприклад, не
  // вибрано конкретне відділення/поштомат зі списку).
  readonly deliveryValidationHint: Locator;

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
    this.shopSelectDropdown = page.locator('span.iSel.sel:visible', {
      hasText: 'Виберіть магазин',
    });
    this.novaPoshtaDeliveryOption = page.locator('text=У відділення «Нова Пошта»');
    this.postomatDeliveryOption = page.locator('text=У поштоматі «Нова Пошта»');
    this.ukrPoshtaDeliveryOption = page.locator('text=У відділення Укрпошта');
    this.courierDeliveryOption = page.locator("text=Кур'єром «Нова Пошта»");
    this.branchInput = page.locator('input[placeholder^="Виберіть номер"]:visible');
    this.streetInput = page.locator('input[placeholder="Вулиця"]');
    this.houseNumberInput = page.locator('input[placeholder="№ Будинку"]');
    this.apartmentNumberInput = page.locator('input[placeholder="№ Квартири"]');
    this.deliveryCostInCheckout = page
      .locator('li.chPrice', { hasText: 'Доставка:' })
      .locator('.cost');
    this.deliveryValidationHint = page.locator('.hintContent', {
      hasText: 'заповніть усі дані щодо доставки',
    });
    this.placeOrderButton = page.locator(
      'input[type="submit"][value="Оформити замовлення"]:visible',
    );
  }

  // Общий локатор инлайновых ошибок валидации полей — на разных полях это то
  // <span>, то <p>, но у всех общий набор классов "iUnT cEr" (например,
  // "Введіть прізвище кирилицею" под Прізвище или "Виберіть місто зі списку"
  // под полем міста).
  validationError(text: string): Locator {
    return this.page.locator('.iUnT.cEr', { hasText: text });
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

  // Ответ со списком способов доставки и их ценами (GET /api/v1/basket/delivery)
  // сайт запрашивает сразу при рендере шага 2 — ещё до того, как пользователь
  // успевает выбрать город или способ доставки. Подписываемся здесь же, в
  // confirmContactDetails() (переход 1 -> 2), это самое раннее безопасное
  // место — иначе, если подписаться позже (например, в selectNovaPoshtaBranch),
  // запрос может успеть улететь и await зависнет до таймаута.
  private deliveryResponsePromise?: Promise<import('@playwright/test').Response>;

  // Поля контактных данных либо уже предзаполнены из аккаунта (авторизованный
  // флоу), либо только что заполнены через fillContactDetails() (гостевой) —
  // в обоих случаях остаётся просто подтвердить их кликом "Далі".
  async confirmContactDetails() {
    this.deliveryResponsePromise = this.page.waitForResponse(
      (r) => r.url().includes('/api/v1/basket/delivery') && r.request().method() === 'GET',
    );

    await this.contactDetailsForm.locator('input[type="submit"][value="Далі"]').click();
    // SPA перерисовывает шаг 2 не мгновенно: JS-обработчики на новых полях
    // (автокомплит города) навешиваются с небольшой задержкой после рендера,
    // поэтому печать в cityInput сразу после клика теряется.
    await this.cityInput.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(500);
  }

  // Возвращает цену конкретного способа доставки (по codeName из ответа API,
  // например "StorehouseNovaposta") из ответа, пойманного в confirmContactDetails().
  async getDeliveryPrice(codeName: string): Promise<number | undefined> {
    if (!this.deliveryResponsePromise) return undefined;
    const body = await (await this.deliveryResponsePromise).json();
    const delivery = (body?.data?.delivery ?? []).find(
      (d: { codeName: string; price: number }) => d.codeName === codeName,
    );
    return delivery?.price;
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

  // Общая логика для способов доставки "в отделение" (Нова Пошта / Укрпошта) —
  // отличаются только radio-опция и codeName в ответе API. branchNumberQuery
  // не задан — берём первое отделение, совпавшее с "1" (в списке всегда много
  // отделений с "1" в номере), конкретное отделение не принципиально для теста.
  //
  // Возвращает стоимость доставки (в грн) из ответа, пойманного ещё в
  // confirmContactDetails() (см. getDeliveryPrice). По этому значению тест
  // сверяет то, что реально показывается в сайдбаре чекаута и на странице
  // подтверждения.
  private async selectBranchDelivery(
    deliveryOption: Locator,
    codeName: string,
    city: string,
    branchNumberQuery: string,
  ): Promise<{ deliveryPrice: number }> {
    const deliveryPrice = await this.getDeliveryPrice(codeName);

    await this.cityInput.pressSequentially(city.slice(0, 2), { delay: 50 });
    const cityOption = this.page.locator(`text=м. ${city}`).first();
    await cityOption.waitFor({ state: 'visible' });
    await cityOption.click();
    await this.page.waitForTimeout(500);

    await deliveryOption.click();
    await this.page.waitForTimeout(500);

    await this.branchInput.pressSequentially(branchNumberQuery, { delay: 50 });
    await this.page.waitForTimeout(800);
    // Опции отделения используют тот же класс, что и опции магазина
    // самовивозу, и так же имеют скрытые дубли — фильтруем через :visible.
    await this.page.locator('li.iSelOp:visible').first().click();
    await this.page.waitForTimeout(500);

    await this.page.locator('input[type="submit"][value="Далі"]:visible').first().click();
    // Дожидаемся, пока реально отрисуется шаг 3 (метод оплаты) — иначе
    // клик по "Оформити замовлення" в placeOrder() может произойти
    // до того, как кнопка станет кликабельной, и запрос не улетит вовсе.
    await this.placeOrderButton.waitFor({ state: 'visible' });

    return { deliveryPrice: deliveryPrice! };
  }

  async selectNovaPoshtaBranch(
    city: string,
    branchNumberQuery = '1',
  ): Promise<{ deliveryPrice: number }> {
    return this.selectBranchDelivery(
      this.novaPoshtaDeliveryOption,
      'StorehouseNovaposta',
      city,
      branchNumberQuery,
    );
  }

  // У Укрпошти список відділень грузится сразу целиком (без запроса по мере
  // ввода, в отличие от Нової Пошти), а автокомплит фильтрует по подстроке
  // в ПОЛНОМ отображаемом тексте "№XXXXX, вул. ...". Запрос "1" совпадений не
  // даёт (значит, отфильтровывается не по номеру), а "вул" — стабильно один
  // результат, поэтому дефолт здесь отличается от Нової Пошти.
  async selectUkrPoshtaBranch(
    city: string,
    branchNumberQuery = 'вул',
  ): Promise<{ deliveryPrice: number }> {
    return this.selectBranchDelivery(this.ukrPoshtaDeliveryOption, 'Ukrposhta', city, branchNumberQuery);
  }

  // Поштомат «Нова Пошта» — тот же принцип пошуку відділення, що й в
  // Укрпошти: запит "1" не дає збігів (список поштоматів не фільтрується по
  // номеру), тому дефолтна query — "вул".
  async selectPostomatDelivery(
    city: string,
    branchNumberQuery = 'вул',
  ): Promise<{ deliveryPrice: number }> {
    return this.selectBranchDelivery(this.postomatDeliveryOption, 'NpCell', city, branchNumberQuery);
  }

  // Кур'єрська доставка — единственный способ доставки "в отделение", у неё
  // вместо выбора відділення нужно заполнить адрес: Вулиця (тоже автокомплит,
  // как city/branch — печатаем и выбираем из выпадающего списка), № Будинку
  // и № Квартири (обычные текстовые поля, без маски/автокомплита).
  async selectCourierDelivery(
    city: string,
    street: string,
    houseNumber: string,
    apartmentNumber: string,
  ): Promise<{ deliveryPrice: number }> {
    const deliveryPrice = await this.getDeliveryPrice('Courier');

    await this.cityInput.pressSequentially(city.slice(0, 2), { delay: 50 });
    const cityOption = this.page.locator(`text=м. ${city}`).first();
    await cityOption.waitFor({ state: 'visible' });
    await cityOption.click();
    await this.page.waitForTimeout(500);

    await this.courierDeliveryOption.click();
    await this.page.waitForTimeout(500);

    await this.streetInput.pressSequentially(street, { delay: 50 });
    await this.page.waitForTimeout(1000);
    // Как и у відділень, опции улиц имеют скрытые дубли — фильтруем через :visible.
    await this.page.locator('li.iSelOp:visible', { hasText: street }).first().click();
    await this.page.waitForTimeout(500);

    await this.houseNumberInput.pressSequentially(houseNumber, { delay: 30 });
    await this.apartmentNumberInput.pressSequentially(apartmentNumber, { delay: 30 });
    await this.page.waitForTimeout(500);

    await this.page.locator('input[type="submit"][value="Далі"]:visible').first().click();
    // Дожидаемся, пока реально отрисуется шаг 3 (метод оплаты) — иначе
    // клик по "Оформити замовлення" в placeOrder() может произойти
    // до того, как кнопка станет кликабельной, и запрос не улетит вовсе.
    await this.placeOrderButton.waitFor({ state: 'visible' });

    return { deliveryPrice: deliveryPrice! };
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
  // запрос на сервер не уходит вовсе.
  //
  // Сам <input type="checkbox"> скрыт (визуально стилизован через соседний
  // <div class="check">), и его checked-состояние управляется JS/Vue, а не
  // нативно: клик по <label> или программный .check() на скрытом input не
  // переключает состояние вообще. Кликать нужно именно по видимому
  // div.check внутри label — только так стейт реально меняется.
  
  async placeOrder(): Promise<{ orderId: number }> {
    await this.placeOrderButton.waitFor({ state: 'visible' });

    const consentLabel = this.page.locator('li', {
      has: this.page.locator('text=Публічним договором'),
    });
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
        [orderResponse] = await Promise.all([
          waitForOrderResponse(),
          this.placeOrderButton.click(),
        ]);
        break;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }

    const body = await orderResponse!.json();

    await this.page.waitForURL('**/thankyou/**');

    return { orderId: body?.data?.orderId };
  }

  // У доставки "У поштоматі «Нова Пошта»" єдиний доступний спосіб оплати —
  // "Карткою на сайті" (він же відмічений за замовчуванням, окремого кліку
  // не треба; способу "При отриманні" тут просто немає в списку).
  //
  // Клік по "Оформити замовлення" одразу створює замовлення і переадресовує
  // на зовнішній домен LiqPay (www.liqpay.ua) — а не напряму на /thankyou/,
  // як у інших способів оплати. Тест не повинен реально оплачувати замовлення
  // карткою, тому на сторінці LiqPay натискаємо посилання скасування оплати
  // (текст залежить від локалі браузера — "Скасувати оплату" укр. або
  // "Decline payment" англ.), після чого LiqPay сам повертає користувача
  // назад на /ukr/thankyou/ зі статусом "Очікування платежу".
  async placeOrderAndDeclineCardPayment(): Promise<{ orderId: number }> {
    await this.placeOrderButton.waitFor({ state: 'visible' });

    const waitForOrderResponse = () =>
      this.page.waitForResponse(
        (r) => r.url().includes('/api/v1/orders/order') && r.request().method() === 'POST',
        { timeout: 15000 },
      );

    let orderResponse;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        [orderResponse] = await Promise.all([
          waitForOrderResponse(),
          this.placeOrderButton.click(),
        ]);
        break;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }

    const body = await orderResponse!.json();

    await this.page.waitForURL(/liqpay\.ua/, { timeout: 20000 });

    const declinePaymentLink = this.page.getByText(/Скасувати оплату|Decline payment/i);
    await declinePaymentLink.click();

    await this.page.waitForURL('**/thankyou/**');

    return { orderId: body?.data?.orderId };
  }
}
