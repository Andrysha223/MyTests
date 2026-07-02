import { Page, Locator } from '@playwright/test';

export class LegoBrandPage {
  readonly page: Page;
  readonly url = 'https://bi.ua/ukr/brands/lego/';
  readonly cookieAcceptButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cookieAcceptButton = page.locator('button.cookie_accept');
  }

  async goto() {
    await this.page.goto(this.url);
    await this.acceptCookiesIfVisible();
  }

  async acceptCookiesIfVisible() {
    if (await this.cookieAcceptButton.isVisible().catch(() => false)) {
      await this.cookieAcceptButton.click();
    }
  }

  productCard(productName: string): Locator {
    return this.page.locator('.goodsItem', { hasText: productName });
  }

  async addToCart(productName: string) {
    const card = this.productCard(productName);
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await card.locator('a.addPTBj').click();
  }
}
