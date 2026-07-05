import { Page, Locator } from '@playwright/test';

export class CheckoutPage {
  readonly page: Page;
  // Кнопка "Оформити замовлення" на сторінці кошика — переводить на /ukr/basket/ (сам чекаут).
  readonly startCheckoutButton: Locator;

  // Крок 1: Контактні дані. Форма шукається за лейблом "Прізвище", бо на сторінці
  // одночасно лежить кілька форм (пошук, попапи, чекаут).
  readonly contactDetailsForm: Locator;
  // Поля попередньо заповнюються даними авторизованого акаунта. У інпутів немає
  // ні id, ні name (крім телефону) — розрізняємо лише за порядком у формі.
  readonly lastNameInput: Locator;
  readonly firstNameInput: Locator;
  readonly patronymicInput: Locator;
  readonly phoneInput: Locator;
  readonly emailInput: Locator;

  // Крок 2: Вибір способу доставки.
  readonly cityInput: Locator;
  readonly pickupDeliveryOption: Locator;
  // У деяких елементів форми на сторінці є схований (visibility:hidden) дубль —
  // тому більшість локаторів нижче фільтруються через :visible.
  readonly shopSelectDropdown: Locator;
  readonly novaPoshtaDeliveryOption: Locator;
  readonly postomatDeliveryOption: Locator;
  readonly ukrPoshtaDeliveryOption: Locator;
  readonly courierDeliveryOption: Locator;
  // Плейсхолдер починається з "Виберіть номер ..." однаково у всіх способів
  // доставки "в пункт" (відділення/поштомат Нової Пошти, Укрпошта), тому
  // в DOM одночасно кілька таких інпутів — фільтр :visible залишає
  // лише активний, а префіксний селектор покриває різний текст в кінці
  // ("відділення" / "поштомата").
  readonly branchInput: Locator;
  // Поля адреси для кур'єрської доставки — з'являються після вибору
  // "Кур'єром «Нова Пошта»" замість поля вибору відділення.
  readonly streetInput: Locator;
  readonly houseNumberInput: Locator;
  readonly apartmentNumberInput: Locator;
  // Рядок "Доставка: 30 ₴" в сайдбарі "Ваше замовлення" — з'являється після
  // вибору способу доставки (видно починаючи з кроку 3).
  readonly deliveryCostInCheckout: Locator;
  // Загальне попередження над кнопкою "Далі" на кроці 2 — з'являється, якщо
  // спосіб доставки обрано, але не заповнені залежні поля (наприклад, не
  // вибрано конкретне відділення/поштомат зі списку).
  readonly deliveryValidationHint: Locator;

  // Промокод в сайдбарі "Ваше замовлення" — видно на будь-якому кроці чекауту.
  // За замовчуванням згорнутий у посилання "Додати промокод", розгортається кліком.
  readonly promoCodeLink: Locator;
  readonly promoCodeInput: Locator;
  readonly promoCodeApplyButton: Locator;
  // Рядки "Товарів на суму:" / "Знижка:" / "Всього до сплати:" в сайдбарі —
  // "Знижка:" з'являється лише після застосування промокоду/сертифіката.
  readonly productsTotalInCheckout: Locator;
  readonly discountInCheckout: Locator;
  readonly totalToPayInCheckout: Locator;

  // Крок 3: Метод оплати. За замовчуванням обрано безпечний варіант "При отриманні" —
  // окремого локатора для вибору не потрібно.
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
    // Як і багато елементів на цьому сайті, має схований дубль — фільтруємо через :visible.
    this.promoCodeLink = page.locator('span:text("Додати промокод"):visible');
    this.promoCodeInput = page.locator('input[placeholder="Введіть № промокоду"]');
    this.promoCodeApplyButton = page.locator('input[type="button"][value="Застосувати"]');
    this.productsTotalInCheckout = page
      .locator('li.chPrice', { hasText: 'Товарів на суму:' })
      .locator('.cost');
    this.discountInCheckout = page
      .locator('li.chPrice', { hasText: 'Знижка:' })
      .locator('.cost');
    this.totalToPayInCheckout = page
      .locator('li.chPrice', { hasText: 'Всього до сплати:' })
      .locator('.cost');
    // На мобільній верстці та сама кнопка підписана інакше — "Оформлення
    // замовлення" замість "Оформити замовлення" (десктоп). Матчимо обидва тексти.
    this.placeOrderButton = page.locator(
      'input[type="submit"][value="Оформити замовлення"]:visible, input[type="submit"][value="Оформлення замовлення"]:visible',
    );
  }

  // Розгортає блок промокоду, вводить код і чекає відповідь
  // GET /api/v1/basket/promo?promo=... з перерахованою ціною/знижкою.
  async applyPromoCode(code: string) {
    await this.promoCodeLink.click();
    await this.promoCodeInput.fill(code);

    const promoResponsePromise = this.page.waitForResponse((r) =>
      r.url().includes('/api/v1/basket/promo'),
    );
    await this.promoCodeApplyButton.click();
    await promoResponsePromise;
  }

  // Ціна конкретного товару в блоці "Ваше замовлення" — після застосування
  // промокоду має показувати вже знижену ціну (наприклад, "799").
  sidebarProductPrice(productName: string): Locator {
    return this.page
      .locator('.goodsItem', { hasText: productName })
      .locator('p.costIco .mr2');
  }

  // Загальний локатор інлайнових помилок валідації полів — на різних полях це то
  // <span>, то <p>, але у всіх спільний набір класів "iUnT cEr" (наприклад,
  // "Введіть прізвище кирилицею" під Прізвище або "Виберіть місто зі списку"
  // під полем міста).
  validationError(text: string): Locator {
    return this.page.locator('.iUnT.cEr', { hasText: text });
  }

  async startCheckout() {
    await this.startCheckoutButton.click();
    await this.page.waitForURL('**/basket/**');
  }

  // Для неавторизованого (гостьового) чекауту поля порожні і їх потрібно
  // заповнити самим — на відміну від авторизованого флоу, де вони вже
  // попередньо заповнені акаунтом (там просто викликається confirmContactDetails()).
  //
  // Важливі обмеження валідації, з якими зіткнулися при дослідженні:
  // - Прізвище/Ім'я/По-батькові приймають лише кирилицю, цифри дають помилку
  //   "Введіть ... кирилицею".
  // - Телефон — маскіроване поле "+38 (0__) ___-__-__", де ведучий "0" —
  //   частина фіксованого шаблону (курсор одразу стає на перший
  //   редагований розряд). details.phone має містити РІВНО 9 цифр:
  //   код оператора (2 цифри) + номер (7 цифр), БЕЗ ведучого "0" —
  //   див. generateRandomContactDetails(). Друкувати потрібно строго по одному
  //   символу з паузою: пакетний pressSequentially(fullString) на цьому полі
  //   плутає цифри місцями (реактивна маска не встигає за пачкою інпутів).
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

  // Навіть друкуючи по одному символу, маска телефону іноді "втрачає" цифру
  // (реактивний компонент не завжди встигає обробити keydown вчасно) —
  // тоді валідація показує "Будь ласка, перевірте коректність...".
  // Перевіряємо це після введення і, якщо потрібно, очищаємо поле і вводимо заново.
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

  // Відповідь зі списком способів доставки та їх цінами (GET /api/v1/basket/delivery)
  // сайт запитує одразу при рендері кроку 2 — ще до того, як користувач
  // встигає обрати місто чи спосіб доставки. Підписуємось тут же, в
  // confirmContactDetails() (перехід 1 -> 2), це найраніше безпечне
  // місце — інакше, якщо підписатися пізніше (наприклад, в selectNovaPoshtaBranch),
  // запит може встигнути піти і await зависне до таймауту.
  private deliveryResponsePromise?: Promise<import('@playwright/test').Response>;

  // Поля контактних даних або вже попередньо заповнені з акаунта (авторизований
  // флоу), або щойно заповнені через fillContactDetails() (гостьовий) —
  // в обох випадках залишається просто підтвердити їх кліком "Далі".
  async confirmContactDetails() {
    this.deliveryResponsePromise = this.page.waitForResponse(
      (r) => r.url().includes('/api/v1/basket/delivery') && r.request().method() === 'GET',
    );

    await this.contactDetailsForm.locator('input[type="submit"][value="Далі"]').click();
    // SPA перемальовує крок 2 не миттєво: JS-обробники на нових полях
    // (автокомпліт міста) навішуються з невеликою затримкою після рендеру,
    // тому друк в cityInput одразу після кліку губиться.
    await this.cityInput.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(500);
  }

  // Повертає ціну конкретного способу доставки (за codeName з відповіді API,
  // наприклад "StorehouseNovaposta") з відповіді, спійманої в confirmContactDetails().
  async getDeliveryPrice(codeName: string): Promise<number | undefined> {
    if (!this.deliveryResponsePromise) return undefined;
    const body = await (await this.deliveryResponsePromise).json();
    const delivery = (body?.data?.delivery ?? []).find(
      (d: { codeName: string; price: number }) => d.codeName === codeName,
    );
    return delivery?.price;
  }

  // shopNameContains не задано — беремо перший доступний в списку магазин.
  // Список магазинів залежить від наявності товару і відрізняється між
  // оточеннями/акаунтами, тому жорстко задавати конкретну адресу має
  // сенс лише там, де це явно перевіряється тестом (див. логін-тест).
  async selectPickupInCity(city: string, shopNameContains?: string) {
    // Автокомпліт city шукає за частковим збігом; повне слово чомусь
    // не завжди тригерить підказку, тому вводимо лише перші 2 літери.
    await this.cityInput.pressSequentially(city.slice(0, 2), { delay: 50 });
    const cityOption = this.page.locator(`text=м. ${city}`).first();
    await cityOption.waitFor({ state: 'visible' });
    await cityOption.click();
    await this.page.waitForTimeout(500);

    await this.pickupDeliveryOption.click();
    await this.page.waitForTimeout(500);

    await this.shopSelectDropdown.click();
    await this.page.waitForTimeout(300);
    // У списку магазинів є сховані (visibility:hidden) дублі елементів —
    // фільтруємо через :visible замість припущень про конкретний індекс.
    const shopOptions = shopNameContains
      ? this.page.locator('li.iSelOp:visible', { hasText: shopNameContains })
      : this.page.locator('li.iSelOp:visible');
    await shopOptions.first().click();
    await this.page.waitForTimeout(300);

    await this.page.locator('input[type="submit"][value="Далі"]:visible').first().click();
    // Чекаємо, поки реально відрисується крок 3 (метод оплати) — інакше
    // клік по "Оформити замовлення" в placeOrder() може статись
    // до того, як кнопка стане клікабельною, і запит взагалі не піде.
    await this.placeOrderButton.waitFor({ state: 'visible' });
  }

  // Спільна логіка для способів доставки "у відділення" (Нова Пошта / Укрпошта) —
  // відрізняються лише radio-опція і codeName у відповіді API. branchNumberQuery
  // не задано — беремо перше відділення, що збіглося з "1" (у списку завжди багато
  // відділень з "1" в номері), конкретне відділення не принципове для тесту.
  //
  // Повертає вартість доставки (в грн) з відповіді, спійманої ще в
  // confirmContactDetails() (див. getDeliveryPrice). За цим значенням тест
  // звіряє те, що реально показується в сайдбарі чекауту і на сторінці
  // підтвердження.
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
    // Опції відділення використовують той самий клас, що й опції магазину
    // самовивозу, і так само мають сховані дублі — фільтруємо через :visible.
    await this.page.locator('li.iSelOp:visible').first().click();
    await this.page.waitForTimeout(500);

    await this.page.locator('input[type="submit"][value="Далі"]:visible').first().click();
    // Чекаємо, поки реально відрисується крок 3 (метод оплати) — інакше
    // клік по "Оформити замовлення" в placeOrder() може статись
    // до того, як кнопка стане клікабельною, і запит взагалі не піде.
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

  // У Укрпошти список відділень грузиться одразу цілком (без запиту в міру
  // введення, на відміну від Нової Пошти), а автокомпліт фільтрує за підрядком
  // в ПОВНОМУ відображеному тексті "№XXXXX, вул. ...". Запит "1" збігів не
  // дає (отже, відфільтровується не за номером), а "вул" — стабільно один
  // результат, тому дефолт тут відрізняється від Нової Пошти.
  async selectUkrPoshtaBranch(
    city: string,
    branchNumberQuery = 'вул',
  ): Promise<{ deliveryPrice: number }> {
    return this.selectBranchDelivery(this.ukrPoshtaDeliveryOption, 'Ukrposhta', city, branchNumberQuery);
  }

  // Поштомат «Нова Пошта» — той самий принцип пошуку відділення, що й в
  // Укрпошти: запит "1" не дає збігів (список поштоматів не фільтрується за
  // номером), тому дефолтна query — "вул".
  async selectPostomatDelivery(
    city: string,
    branchNumberQuery = 'вул',
  ): Promise<{ deliveryPrice: number }> {
    return this.selectBranchDelivery(this.postomatDeliveryOption, 'NpCell', city, branchNumberQuery);
  }

  // Кур'єрська доставка — єдиний спосіб доставки "в відділення", у неї
  // замість вибору відділення потрібно заповнити адресу: Вулиця (теж автокомпліт,
  // як city/branch — друкуємо і обираємо з випадного списку), № Будинку
  // і № Квартири (звичайні текстові поля, без маски/автокомпліту).
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
    // Як і у відділень, опції вулиць мають сховані дублі — фільтруємо через :visible.
    await this.page.locator('li.iSelOp:visible', { hasText: street }).first().click();
    await this.page.waitForTimeout(500);

    await this.houseNumberInput.pressSequentially(houseNumber, { delay: 30 });
    await this.apartmentNumberInput.pressSequentially(apartmentNumber, { delay: 30 });
    await this.page.waitForTimeout(500);

    await this.page.locator('input[type="submit"][value="Далі"]:visible').first().click();
    // Чекаємо, поки реально відрисується крок 3 (метод оплати) — інакше
    // клік по "Оформити замовлення" в placeOrder() може статись
    // до того, як кнопка стане клікабельною, і запит взагалі не піде.
    await this.placeOrderButton.waitFor({ state: 'visible' });

    return { deliveryPrice: deliveryPrice! };
  }

  // Крок 3 (метод оплати) не потребує дій — за замовчуванням обрано
  // безпечне "При отриманні (готівкою/карткою)", без введення платіжних даних.
  // Тіло відповіді читаємо одразу після resolve, до навігації на /thankyou/ —
  // інакше Chromium вивантажує буфер відповіді і response.json() падає.
  //
  // На web1-bi.ua зламана конфігурація reCAPTCHA для цього домену ("Invalid
  // domain for site key" в консолі) — invisible-recaptcha перед відправкою
  // замовлення іноді мовчки не спрацьовує, і клік не приводить до реального
  // запиту. Це баг тестового оточення, а не тесту; лікуємо повторним кліком.
  //
  // У гостьового (неавторизованого) чекауту на кроці 3 є додатковий
  // чекбокс згоди з "Публічним договором купівлі-продажу" — він НЕ відмічений
  // за замовчуванням і без нього сабміт мовчки не спрацьовує (клік проходить, але
  // запит на сервер взагалі не йде.
  //
  // Сам <input type="checkbox"> схований (візуально стилізований через сусідній
  // <div class="check">), і його checked-стан керується JS/Vue, а не
  // нативно: клік по <label> або програмний .check() на схованому input не
  // перемикає стан взагалі. Клікати потрібно саме по видимому
  // div.check всередині label — лише так стан реально змінюється.

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

    // Гостьовий чекаут з оплатою тільки карткою (наприклад, поштомат або
    // електронний подарунковий сертифікат) — тут теж є чекбокс згоди з
    // "Публічним договором купівлі-продажу", як і в звичайному placeOrder().
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

    await this.page.waitForURL(/liqpay\.ua/, { timeout: 20000 });

    const declinePaymentLink = this.page.getByText(/Скасувати оплату|Decline payment/i);
    await declinePaymentLink.click();

    await this.page.waitForURL('**/thankyou/**');

    return { orderId: body?.data?.orderId };
  }
}
