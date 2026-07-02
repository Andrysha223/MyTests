import { Page, Locator } from '@playwright/test';
import { HeaderComponent } from './HeaderComponent';

export class ProductPage {
  readonly page: Page;
  readonly url: string;
  readonly header: HeaderComponent;
  readonly title: Locator;
  readonly buyButton: Locator;

  constructor(page: Page, url: string) {
    this.page = page;
    this.url = url;
    this.header = new HeaderComponent(page);
    this.title = page.locator('h1');
    // На странице товара несколько ссылок "Купити" (похожі товари в каруселях),
    // основна кнопка лежить у блоці .prodBuy.
    this.buyButton = page.locator('.prodBuy a.addPTBj');
  }

  async goto() {
    await this.page.goto(this.url);
    await this.header.acceptCookiesIfVisible();
  }

  async clickBuy() {
    await this.buyButton.click();
  }
}
