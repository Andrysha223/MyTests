import { Page, Locator } from '@playwright/test';
import { HeaderComponent } from './HeaderComponent';

export class ProductPage {
  readonly page: Page;
  readonly url: string;
  readonly header: HeaderComponent;
  readonly title: Locator;
  readonly buyButton: Locator;
  // Кнопка "До списку бажань" рядом с бейджами знижок над галереєю товару.
  // Класс "wishBig" уникальный на странице (в отличие от "wishTop", который
  // повторяется в каруселях похожих товарів внизу сторінки).
  readonly wishButton: Locator;

  constructor(page: Page, url: string) {
    this.page = page;
    this.url = url;
    this.header = new HeaderComponent(page);
    this.title = page.locator('h1');
    // На странице товара несколько ссылок "Купити" (похожі товари в каруселях),
    // основна кнопка лежить у блоці .prodBuy.
    this.buyButton = page.locator('.prodBuy a.addPTBj');
    this.wishButton = page.locator('a.wishBig');
  }

  async goto() {
    await this.page.goto(this.url);
    await this.header.acceptCookiesIfVisible();
  }

  async clickBuy() {
    await this.buyButton.click();
  }

  async addToFavorites() {
    await this.wishButton.click();
  }
}
