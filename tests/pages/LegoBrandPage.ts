import { Page, Locator, expect } from '@playwright/test';
import { HeaderComponent } from './HeaderComponent';
import { loginAsTestUser } from '../helpers/auth';

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
    // Релогин делаем максимум 1 раз за тест — если он не помог с первого
    // раза, повторять его ещё раз в рамках той же попытки только тратит
    // время (до test.setTimeout) без реальных шансов на другой результат;
    // дальше пусть сработает внешний retry Playwright'а (полностью свежий
    // браузерный контекст + логин, что эквивалентно, но не грозит вылезти
    // за таймаут ЭТОГО теста).
    let alreadyRelogged = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const alreadyActive = (await wishButton.getAttribute('class'))?.includes('ac');
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

      await this.addToFavorites(productName);
      const addResponse = await addResponsePromise;
      let sessionDesynced = false;
      if (addResponse && addResponse.status() === 400) {
        const body = await addResponse.text().catch(() => '');
        sessionDesynced = body.includes('не знайдено');
      }

      await this.page.waitForTimeout(2000);

      try {
        await expect(
          wishButton,
          `Попытка ${attempt}: после клика кнопка "До списку бажань" должна получить класс активного состояния ("ac")`,
        ).toHaveClass(/\bac\b/, { timeout: 3000 });
        return;
      } catch (error) {
        if (attempt === 3) throw error;
        if (sessionDesynced && !alreadyRelogged) {
          alreadyRelogged = true;
          await loginAsTestUser(this.page);
          await this.goto();
        } else {
          // Полная перезагрузка каталога (а не просто пауза) перед следующей
          // попыткой — клик по уже "подвисшей" отрисовке кнопки стабильно не
          // помогал, а свежий рендер страницы иногда подтягивает корректное
          // состояние с сервера.
          await this.goto();
        }
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
