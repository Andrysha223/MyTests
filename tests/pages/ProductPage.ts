import { Page, Locator, expect } from '@playwright/test';
import { HeaderComponent } from './HeaderComponent';
import { loginAsTestUser } from '../helpers/auth';

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

      // Подслушиваем реальный ответ API добавления — если сервер отвечает
      // 400 "Список не знайдено", проблема не в клике (запрос долетает
      // каждый раз), а в рассинхроне сессии с текущим списком бажань (см.
      // wishlist-cleanup.ts). Обычная перезагрузка страницы это не чинит —
      // подтверждено трейсом, где 3 попытки подряд слали ОДИН И ТОТ ЖЕ
      // невалидный wishlist-id. Полный повторный логин пересобирает сессию
      // с нуля и снимает застрявший на сервере указатель "текущий список".
      const addResponsePromise = this.page
        .waitForResponse((r) => r.url().includes('/api/v1/wish-lists/good'), { timeout: 5000 })
        .catch(() => null);

      await this.addToFavorites();
      const addResponse = await addResponsePromise;
      let sessionDesynced = false;
      if (addResponse && addResponse.status() === 400) {
        const body = await addResponse.text().catch(() => '');
        sessionDesynced = body.includes('не знайдено');
      }

      await this.page.waitForTimeout(2000);

      try {
        await expect(
          this.wishButton,
          `Попытка ${attempt}: после клика кнопка "До списку бажань" должна получить класс активного состояния ("ac")`,
        ).toHaveClass(/\bac\b/, { timeout: 3000 });
        return;
      } catch (error) {
        if (attempt === 3) throw error;
        if (sessionDesynced) {
          await loginAsTestUser(this.page);
          await this.goto();
        } else {
          // Полная перезагрузка страницы товара (а не просто пауза) перед
          // следующей попыткой — клик по уже "подвисшей" отрисовке кнопки
          // стабильно не помогал, а свежий рендер иногда подтягивает
          // корректное состояние с сервера.
          await this.goto();
        }
      }
    }
  }
}
