import { Page, Locator, expect } from '@playwright/test';
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
  async addToFavoritesAndVerify() {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const alreadyActive = (await this.wishButton.getAttribute('class'))?.includes('ac');
      if (alreadyActive) return;

      await this.addToFavorites();
      await this.page.waitForTimeout(2000);

      try {
        await expect(
          this.wishButton,
          `Попытка ${attempt}: после клика кнопка "До списку бажань" должна получить класс активного состояния ("ac")`,
        ).toHaveClass(/\bac\b/, { timeout: 3000 });
        return;
      } catch (error) {
        if (attempt === 3) throw error;
        // Полная перезагрузка страницы товара (а не просто пауза) перед
        // следующей попыткой — клик по уже "подвисшей" отрисовке кнопки
        // стабильно не помогал, а свежий рендер иногда подтягивает
        // корректное состояние с сервера. Если причина — рассинхрон сессии с
        // текущим списком бажань (см. BUGS.md), reload внутри теста его не
        // чинит — это лечится только полным перезапуском с нуля, за который
        // отвечает retries на уровне Playwright (playwright.config.ts).
        await this.goto();
      }
    }
  }
}
