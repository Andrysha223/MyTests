import { Page, Locator } from '@playwright/test';

// Сторінка "Список бажань" в особистому кабінеті (/ukr/lk/wish-list/) — доступна
// лише авторизованому користувачу (гостю показується попап з
// пропозицією авторизуватися замість додавання в список).
export class WishlistPage {
  readonly page: Page;
  readonly url = 'https://web1-bi.ua/ukr/lk/wish-list/';
  // Посилання "+ Створити список" — відкриває інлайн-форму з полем назви.
  readonly createListLink: Locator;
  readonly newListNameInput: Locator;
  // На сторінці одночасно є схований дубль кнопки "Зберегти" (в іншому
  // попапі, #PopAttention). Крім того, при створенні списку з маркетингового
  // порожнього екрану (див. bigCreateListButton) кнопка збереження — це
  // <a>Зберегти</a>, а не <input type="submit">, як в інших випадках.
  readonly saveNewListButton: Locator;
  // Попап "Виберіть список" з'являється при додаванні товару в обране
  // (клік по сердечку в каталозі/на сторінці товару), якщо списків більше
  // одного — інакше товар мовчки йде в єдиний існуючий список.
  readonly chooseListPopupTitle: Locator;

  // "a#addNewList" (велика кнопка на маркетинговому порожньому екрані) рендериться
  // ЛИШЕ коли в акаунта взагалі ніколи не було жодного списку бажань.
  // Щойно з'являється хоча б один список (навіть згодом видалений і
  // створений заново), замість неї використовується маленьке посилання "+ Створити
  // список" (span.iaddWL, зі схованим дублем — фільтруємо через :visible).
  private readonly bigCreateListButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.bigCreateListButton = page.locator('#addNewList');
    this.createListLink = page.locator('span.iaddWL:visible');
    this.newListNameInput = page.locator('input[placeholder="Назвіть список"]');
    this.saveNewListButton = page
      .locator('input[type="submit"][value="Зберегти"]:visible')
      .or(page.locator('a:visible', { hasText: 'Зберегти' }));
    this.chooseListPopupTitle = page.locator('text=Виберіть список');
  }

  async goto() {
    await this.page.goto(this.url);
  }

  // Товар у списку шукається за data-good-id (той самий id, що передається в
  // rtbWishListAddProduct(id) на картці каталогу), а не за назвою — так
  // простіше зв'язати стан каталогу і список бажань в тестах. Без :visible —
  // на мобільній верстці картка товару іноді рендериться ЛИШЕ всередині
  // схованого (unAc, display:none) варіанта контейнера списку, без видимого
  // дубля взагалі; фільтр :visible в цьому випадку не знаходив би нічого.
  wishlistItem(goodId: string): Locator {
    return this.page.locator(`.goodsItem[data-good-id="${goodId}"]`);
  }

  wishlistItemName(goodId: string): Locator {
    return this.wishlistItem(goodId).locator('a.goodsItemLink.itemDes');
  }

  // Іконка видалення конкретного товару — відрізняється від іконки видалення
  // всього листа (у тієї немає атрибута name) наявністю name="item_one".
  removeItemButton(goodId: string): Locator {
    return this.wishlistItem(goodId).locator('span.i-delete[name="item_one"]');
  }

  // Тестовий акаунт спільний — список бажань може містити товари з минулих
  // прогонів. Викликати перед тестами, де важливо, що список або порожній, або
  // містить рівно потрібний товар.
  async clearWishlist() {
    await this.goto();
    // На мобільній верстці товар іноді рендериться ЛИШЕ в схованому (unAc,
    // display:none) варіанті контейнера списку — у елемента немає геометрії
    // взагалі, тому навіть click({force: true}) не спрацьовує ("Element is
    // not visible"). dispatchEvent('click') шле подію напряму в DOM,
    // без перевірки видимості/координат.
    const deleteButtons = this.page.locator('span.i-delete[name="item_one"]');
    while ((await deleteButtons.count()) > 0) {
      await deleteButtons.first().dispatchEvent('click');
      await this.page.waitForTimeout(500);
    }
  }

  async createList(name: string) {
    await this.goto();

    // На маркетинговому порожньому екрані (акаунт взагалі без жодного списку)
    // використовується велика кнопка #addNewList, в інших випадках —
    // маленьке посилання "+ Створити список" (span.iaddWL).
    if (await this.bigCreateListButton.isVisible().catch(() => false)) {
      await this.bigCreateListButton.click();
    } else {
      await this.createListLink.click();
    }
    await this.newListNameInput.fill(name);
    await this.saveNewListButton.click();

    // Збереження реально сабмітить форму на /ukr/lk/wish-list/ (перезавантаження
    // сторінки) — чекаємо саме перезавантаження і появу нового списку за
    // назвою. Чекаємо саме attached, а не visible: на мобільній верстці
    // список іноді рендериться в схованому (unAc) варіанті контейнера —
    // той самий сайтовий глюк, що й з товарами (див. wishlistItem()).
    await this.page.waitForLoadState('load');
    await this.listBlock(name).waitFor({ state: 'attached' });
  }

  listBlock(listName: string): Locator {
    return this.page.locator('.WLwrapper', { hasText: listName });
  }

  // Тестовий акаунт спільний — до/після прогонів можуть залишитися списки
  // (в т.ч. дефолтний "Лист бажання" і створені тестами дублі). Викликати
  // перед тестами на вибір списку, щоб склад списків був передбачуваним.
  async deleteAllLists() {
    await this.goto();
    // Іконка видалення цілого списку — на відміну від видалення товару всередині
    // списку (span.i-delete[name="item_one"]), у неї немає атрибута name.
    const listDeleteButtons = this.page.locator('.WLwrapper > span.i-delete');
    while ((await listDeleteButtons.count()) > 0) {
      await listDeleteButtons.first().click();
      // Клік по іконці видалення списку відкриває модалку підтвердження
      // "Видалення списку бажань" — без явного підтвердження список не
      // видаляється, а модалка залишається перекривати сторінку. Важливо: текст
      // модалки теж містить слово "видалити" (в реченні), тому
      // text=Видалити матчить його першим — потрібен точний селектор кнопки.
      await this.page.locator('input[type="submit"][value="Видалити"]').click();
      await this.page.waitForTimeout(500);
    }
  }

  // Опція конкретного списку в попапі "Виберіть список".
  chooseListPopupOption(listName: string): Locator {
    return this.page.locator('li[data-wlist-id]', { hasText: listName }).first();
  }
}
