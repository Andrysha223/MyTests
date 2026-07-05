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

  // На странице одновременно может быть несколько карточек с одинаковым
  // названием (например, скрытая карточка в блоке "Ви переглядали" или в
  // рекомендациях, без кнопок покупки/бажань) — фильтруем через :visible,
  // чтобы попадать именно в основную карточку каталога.
  productCard(productName: string): Locator {
    return this.page.locator('.goodsItem:visible', { hasText: productName });
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

  // Клик по сердечку на этом сайте иногда не приводит к реальному
  // переключению состояния (класс остаётся прежним, без "ac") — баг
  // воспроизводится независимо от товара и состояния списков бажань, похоже
  // на тот же класс нестабильности сайта, что и известный баг с reCAPTCHA в
  // чекауте (см. CheckoutPage.placeOrder). Используется там, где тест
  // ожидает РЕАЛЬНОЕ добавление (авторизованный пользователь) — для
  // гостевого сценария (где "ac" не должен появиться в принципе) нужен
  // обычный addToFavorites() без ретрая.
  //
  // Пауза перед повторным кликом (а не мгновенный retry) и проверка "а вдруг
  // уже получилось" ПЕРЕД кликом — важны: быстрый повторный клик по одной и
  // той же кнопке похож на "случайный дабл-клик", и сайт, скорее всего,
  // дебаунсит/путает такие быстрые повторы (первый клик формально успевает
  // включить "ac", но тут же следует второй клик и выключает обратно) —
  // отсюда и стабильно "не получилось" при быстрых ретраях подряд.
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
        // Полная перезагрузка каталога (а не просто пауза) перед следующей
        // попыткой — клик по уже "подвисшей" отрисовке кнопки стабильно не
        // помогал, а свежий рендер страницы иногда подтягивает корректное
        // состояние с сервера. Если причина — рассинхрон сессии с текущим
        // списком бажань (см. BUGS.md), reload внутри теста его не чинит —
        // это лечится только полным перезапуском с нуля, за который отвечает
        // retries на уровне Playwright (playwright.config.ts).
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
