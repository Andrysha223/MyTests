import { Page, Locator } from '@playwright/test';

export class CartPage {
  readonly page: Page;
  readonly url = 'https://web1-bi.ua/ukr/basket/cart/';

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(this.url);
  }

  // На десктопі картка товару в кошику — ".goodsItem.chGoods", на
  // мобільній версії той самий товар рендериться без модифікатора "chGoods"
  // (просто ".goodsItem" всередині ".cartWr") — інша адаптивна розмітка,
  // а не просто інший CSS. Матчимо обидва варіанти.
  cartItem(productName: string): Locator {
    return this.page.locator('.goodsItem.chGoods, .cartWr .goodsItem', { hasText: productName });
  }

  // Тестовий акаунт спільний для всіх тестів, і в кошику іноді залишаються
  // сторонні товари (з минулих прогонів або промо-акцій сайту) —
  // це ламає детермінованість чекаут-тестів (сума замовлення, кількість
  // товарів, стан візарда). Викликати перед початком чекауту,
  // коли важливо, що в кошику лежить рівно один потрібний товар.
  async clearCart() {
    await this.goto();
    const deleteButtons = this.page.locator('a.icoDEl');
    while (await deleteButtons.count() > 0) {
      await deleteButtons.first().click();
      await this.page.waitForTimeout(500);
    }
  }
}
