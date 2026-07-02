import { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly url = 'https://bi.ua/ukr/';
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
}
