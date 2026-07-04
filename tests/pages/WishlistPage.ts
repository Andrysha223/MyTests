import { Page, Locator } from '@playwright/test';

// Страница "Список бажань" в личном кабинеті (/ukr/lk/wish-list/) — доступна
// только авторизованному пользователю (гостю показывается попап с
// предложением авторизуватися вместо добавления в список).
export class WishlistPage {
  readonly page: Page;
  readonly url = 'https://web1-bi.ua/ukr/lk/wish-list/';

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(this.url);
  }

  // Товар в списке ищется по data-good-id (тот же id, что передаётся в
  // rtbWishListAddProduct(id) на карточке каталога), а не по названию — так
  // проще связать состояние каталога и список бажань в тестах.
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
    const deleteButtons = this.page.locator('span.i-delete[name="item_one"]');
    while ((await deleteButtons.count()) > 0) {
      await deleteButtons.first().click();
      await this.page.waitForTimeout(500);
    }
  }
}
