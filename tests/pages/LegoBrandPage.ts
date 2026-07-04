import { Page, Locator } from '@playwright/test';
import { HeaderComponent } from './HeaderComponent';

export class LegoBrandPage {
  readonly page: Page;
  readonly url: string;
  readonly header: HeaderComponent;

  constructor(page: Page, url = 'https://web1-bi.ua/ukr/brands/lego/') {
    this.page = page;
    this.url = url;
    this.header = new HeaderComponent(page);
  }

  async goto() {
    await this.page.goto(this.url);
    await this.header.acceptCookiesIfVisible();
  }

  productCard(productName: string): Locator {
    return this.page.locator('.goodsItem', { hasText: productName });
  }

  buyButton(productName: string): Locator {
    return this.productCard(productName).locator('a.addPTBj');
  }

  // Кнопка "До списку бажань" (сердечко) — как и "Купити", показується лише
  // по hover. После добавления в избранное к классу добавляется "ac"
  // (active) — это же значение используется для проверки текущего стану.
  wishButton(productName: string): Locator {
    return this.productCard(productName).locator('a.wishTop');
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

  async addToFavorites(productName: string) {
    await this.hoverProductCard(productName);
    await this.wishButton(productName).click();
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
