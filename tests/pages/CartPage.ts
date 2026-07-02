import { Page, Locator } from '@playwright/test';

export class CartPage {
  readonly page: Page;
  readonly url = 'https://bi.ua/ukr/basket/cart/';
  readonly headerCartCounter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.headerCartCounter = page.locator('.cartCounterJs');
  }

  async goto() {
    await this.page.goto(this.url);
  }

  cartItem(productName: string): Locator {
    return this.page.locator('.goodsItem.chGoods', { hasText: productName });
  }
}
