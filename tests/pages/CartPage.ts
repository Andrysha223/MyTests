import { Page, Locator } from '@playwright/test';

export class CartPage {
  readonly page: Page;
  readonly url = 'https://web1-bi.ua/ukr/basket/cart/';

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(this.url);
  }

  // На десктопе карточка товара в корзине — ".goodsItem.chGoods", на
  // мобильной версии тот же товар рендерится без модификатора "chGoods"
  // (просто ".goodsItem" внутри ".cartWr") — другая адаптивная разметка,
  // а не просто другой CSS. Матчим оба варианта.
  cartItem(productName: string): Locator {
    return this.page.locator('.goodsItem.chGoods, .cartWr .goodsItem', { hasText: productName });
  }

  // Тестовый аккаунт общий для всех тестов, и в корзине иногда остаются
  // посторонние товары (с прошлых прогонов или промо-акций сайта) —
  // это ломает детерминированность чекаут-тестов (сумма заказа, число
  // товаров, состояние визарда). Вызывать перед началом чекаута,
  // когда важно, что в корзине лежит ровно один нужный товар.
  async clearCart() {
    await this.goto();
    const deleteButtons = this.page.locator('a.icoDEl');
    while (await deleteButtons.count() > 0) {
      await deleteButtons.first().click();
      await this.page.waitForTimeout(500);
    }
  }
}
