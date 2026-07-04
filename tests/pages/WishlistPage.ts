import { Page, Locator } from '@playwright/test';

// Страница "Список бажань" в личном кабинеті (/ukr/lk/wish-list/) — доступна
// только авторизованному пользователю (гостю показывается попап с
// предложением авторизуватися вместо добавления в список).
export class WishlistPage {
  readonly page: Page;
  readonly url = 'https://web1-bi.ua/ukr/lk/wish-list/';
  // Ссылка "+ Створити список" — открывает инлайн-форму с полем названия.
  readonly createListLink: Locator;
  readonly newListNameInput: Locator;
  // На странице одновременно есть скрытый дубль кнопки "Зберегти" (в другом
  // попапе, #PopAttention). Кроме того, при создании списка с маркетингового
  // пустого экрана (см. bigCreateListButton) кнопка сохранения — это
  // <a>Зберегти</a>, а не <input type="submit">, как в остальных случаях.
  readonly saveNewListButton: Locator;
  // Попап "Виберіть список" появляется при добавлении товара в избранное
  // (клик по сердечку в каталоге/на странице товара), если списков больше
  // одного — иначе товар молча уходит в единственный существующий список.
  readonly chooseListPopupTitle: Locator;

  // "a#addNewList" (крупная кнопка на маркетинговом пустом экране) рендерится
  // ТОЛЬКО когда у аккаунта вообще никогда не было ни одного списка бажань.
  // Как только появляется хотя бы один список (даже впоследствии удалённый и
  // созданный заново), вместо неё используется маленькая ссылка "+ Створити
  // список" (span.iaddWL, с скрытым дублем — фильтруем через :visible).
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

  // Товар в списке ищется по data-good-id (тот же id, что передаётся в
  // rtbWishListAddProduct(id) на карточке каталога), а не по названию — так
  // проще связать состояние каталога и список бажань в тестах. Без :visible —
  // на мобильной верстке карточка товара иногда рендерится ТОЛЬКО внутри
  // скрытого (unAc, display:none) варианта контейнера списка, без видимого
  // дубля вообще; фильтр :visible в этом случае не находил бы вообще ничего.
  wishlistItem(goodId: string): Locator {
    return this.page.locator(`.goodsItem[data-good-id="${goodId}"]`);
  }

  wishlistItemName(goodId: string): Locator {
    return this.wishlistItem(goodId).locator('a.goodsItemLink.itemDes');
  }

  // Иконка удаления конкретного товара — отличается от иконки удаления
  // всего листа (у той нет атрибута name) наличием name="item_one".
  removeItemButton(goodId: string): Locator {
    return this.wishlistItem(goodId).locator('span.i-delete[name="item_one"]');
  }

  // Тестовый аккаунт общий — список бажань может содержать товары с прошлых
  // прогонов. Вызывать перед тестами, где важно, что список либо пуст, либо
  // содержит ровно нужный товар.
  async clearWishlist() {
    await this.goto();
    // На мобильной верстке товар иногда рендерится ТОЛЬКО в скрытом (unAc,
    // display:none) варианте контейнера списка — у элемента нет геометрии
    // вовсе, поэтому даже click({force: true}) не срабатывает ("Element is
    // not visible"). dispatchEvent('click') шлёт событие напрямую в DOM,
    // без проверки видимости/координат.
    const deleteButtons = this.page.locator('span.i-delete[name="item_one"]');
    while ((await deleteButtons.count()) > 0) {
      await deleteButtons.first().dispatchEvent('click');
      await this.page.waitForTimeout(500);
    }
  }

  async createList(name: string) {
    await this.goto();

    // На маркетинговом пустом экране (аккаунт вообще без единого списка)
    // используется крупная кнопка #addNewList, в остальных случаях —
    // маленькая ссылка "+ Створити список" (span.iaddWL).
    if (await this.bigCreateListButton.isVisible().catch(() => false)) {
      await this.bigCreateListButton.click();
    } else {
      await this.createListLink.click();
    }
    await this.newListNameInput.fill(name);
    await this.saveNewListButton.click();

    // Сохранение реально сабмітить форму на /ukr/lk/wish-list/ (перезагрузка
    // страницы) — ждём саму перезагрузку и появление нового списка по
    // названию. Ждём именно attached, а не visible: на мобильной верстке
    // список иногда рендерится в скрытом (unAc) варианте контейнера —
    // тот же сайтовый глюк, что и с товарами (см. wishlistItem()).
    await this.page.waitForLoadState('load');
    await this.listBlock(name).waitFor({ state: 'attached' });
  }

  // Блок конкретного списка бажань (заголовок + его товары) — списки с
  // одинаковым названием (например, задвоенные "Тестовий список" от
  // предыдущих неудачных прогонов) неотличимы по названию, поэтому очистка
  // списков всегда удаляет ВСЕ списки подряд, а не по имени.
  listBlock(listName: string): Locator {
    return this.page.locator('.WLwrapper', { hasText: listName });
  }

  // Тестовый аккаунт общий — до/после прогонов могут остаться списки
  // (в т.ч. дефолтный "Лист бажання" и созданные тестами дубли). Вызывать
  // перед тестами на выбор списка, чтобы состав списков был предсказуем.
  async deleteAllLists() {
    await this.goto();
    // Иконка удаления целого списка — в отличие от удаления товара внутри
    // списка (span.i-delete[name="item_one"]), у неё нет атрибута name.
    const listDeleteButtons = this.page.locator('.WLwrapper > span.i-delete');
    while ((await listDeleteButtons.count()) > 0) {
      await listDeleteButtons.first().click();
      // Клик по иконке удаления списка открывает модалку подтверждения
      // "Видалення списку бажань" — без явного подтверждения список не
      // удаляется, а модалка остаётся перекрывать страницу. Важно: текст
      // модалки тоже содержит слово "видалити" (в предложении), поэтому
      // text=Видалити матчит его первым — нужен точный селектор кнопки.
      await this.page.locator('input[type="submit"][value="Видалити"]').click();
      await this.page.waitForTimeout(500);
    }
  }

  // Опция конкретного списка в попапе "Виберіть список".
  chooseListPopupOption(listName: string): Locator {
    return this.page.locator('li[data-wlist-id]', { hasText: listName }).first();
  }
}
