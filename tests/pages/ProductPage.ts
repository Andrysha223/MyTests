import { Page, Locator } from '@playwright/test';

export class ProductPage {
  readonly page: Page;
  readonly url: string;
  readonly cookieAcceptButton: Locator;
  readonly title: Locator;
  readonly buyButton: Locator;

  constructor(page: Page, url: string) {
    this.page = page;
    this.url = url;
    this.cookieAcceptButton = page.locator('button.cookie_accept');
    this.title = page.locator('h1');
    // На странице товара несколько ссылок "Купити" (похожі товари в каруселях),
    // основна кнопка лежить у блоці .prodBuy.
    this.buyButton = page.locator('.prodBuy a.addPTBj');
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

  async clickBuy() {
    await this.buyButton.click();
  }
}
