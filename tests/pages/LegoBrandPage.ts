import { Page, Locator } from '@playwright/test';

export class LegoBrandPage {
  readonly page: Page;
  readonly url: string;
  readonly cookieAcceptButton: Locator;

  constructor(page: Page, url = 'https://web1-bi.ua/ukr/brands/lego/') {
    this.page = page;
    this.url = url;
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

  buyButton(productName: string): Locator {
    return this.productCard(productName).locator('a.addPTBj');
  }

  // Кнопка "Купити" на карточці показується лише по hover,
  // тому перед перевіркою видимості чи кліком картку треба навести.
  async hoverProductCard(productName: string) {
    const card = this.productCard(productName);
    await card.scrollIntoViewIfNeeded();
    await card.hover();
  }

  async addToCart(productName: string) {
    await this.hoverProductCard(productName);
    await this.buyButton(productName).click();
  }

  productLink(productName: string): Locator {
    return this.productCard(productName).locator('a.goodsItemLink').first();
  }

  async openProduct(productName: string) {
    const card = this.productCard(productName);
    await card.scrollIntoViewIfNeeded();
    await this.productLink(productName).click();
  }
}
