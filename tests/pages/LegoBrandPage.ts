import { Page, Locator, expect } from '@playwright/test';
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

  // На сторінці одночасно може бути кілька карток з однаковою
  // назвою (наприклад, схована картка в блоці "Ви переглядали" або в
  // рекомендаціях, без кнопок купівлі/бажань) — фільтруємо через :visible,
  // щоб потрапляти саме в основну картку каталогу.
  productCard(productName: string): Locator {
    return this.page.locator('.goodsItem:visible', { hasText: productName });
  }

  buyButton(productName: string): Locator {
    return this.productCard(productName).locator('a.addPTBj');
  }

  // Кнопка "До списку бажань" (сердечко) — як і "Купити", показується лише
  // по hover. Після додавання в обране до класу додається "ac"
  // (active) — це ж значення використовується для перевірки поточного стану.
  wishButton(productName: string): Locator {
    return this.productCard(productName).locator('a.wishTop');
  }

  // Кнопка "Купити" на картці показується лише по hover,
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

  async addToFavoritesAndVerify(productName: string) {
    const wishButton = this.wishButton(productName);
    for (let attempt = 1; attempt <= 3; attempt++) {
      const alreadyActive = (await wishButton.getAttribute('class'))?.includes('ac');
      if (alreadyActive) return;

      await this.addToFavorites(productName);
      await this.page.waitForTimeout(2000);

      try {
        await expect(
          wishButton,
          `Попытка ${attempt}: после клика кнопка "До списку бажань" должна получить класс активного состояния ("ac")`,
        ).toHaveClass(/\bac\b/, { timeout: 3000 });
        return;
      } catch (error) {
        if (attempt === 3) throw error;
        await this.goto();
      }
    }
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
