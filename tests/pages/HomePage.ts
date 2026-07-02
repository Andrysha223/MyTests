import { Page } from '@playwright/test';
import { HeaderComponent } from './HeaderComponent';

export class HomePage {
  readonly page: Page;
  readonly url = 'https://web1-bi.ua/ukr/';
  readonly header: HeaderComponent;

  constructor(page: Page) {
    this.page = page;
    this.header = new HeaderComponent(page);
  }

  async goto() {
    await this.page.goto(this.url);
    await this.header.acceptCookiesIfVisible();
  }
}
