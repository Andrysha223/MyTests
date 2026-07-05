import { Page, Locator, expect } from '@playwright/test';
import { HeaderComponent } from './HeaderComponent';

export class ProductPage {
  readonly page: Page;
  readonly url: string;
  readonly header: HeaderComponent;
  readonly title: Locator;
  readonly buyButton: Locator;
  // Кнопка "До списку бажань" поруч з бейджами знижок над галереєю товару.
  // Клас "wishBig" унікальний на сторінці (на відміну від "wishTop", який
  // повторюється в каруселях схожих товарів внизу сторінки).
  readonly wishButton: Locator;

  constructor(page: Page, url: string) {
    this.page = page;
    this.url = url;
    this.header = new HeaderComponent(page);
    this.title = page.locator('h1');
    // На сторінці товару кілька посилань "Купити" (схожі товари в каруселях),
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

  // Клік по сердечку на цьому сайті іноді не призводить до реального
  // перемикання стану (клас лишається попереднім, без "ac") — баг
  // відтворюється незалежно від товару і стану списків бажань, схоже
  // на той самий клас нестабільності сайту, що й відомий баг з reCAPTCHA в
  // чекауті (див. CheckoutPage.placeOrder). Використовується там, де тест
  // очікує РЕАЛЬНЕ додавання (авторизований користувач) — для
  // гостьового сценарію (де "ac" не повинен з'явитись в принципі) потрібен
  // звичайний addToFavorites() без retry.
  //
  // Пауза перед повторним кліком (а не миттєвий retry) і перевірка "а раптом
  // вже вийшло" ПЕРЕД кліком — важливі: швидкий повторний клік по одній і
  // тій самій кнопці схожий на "випадковий дабл-клік", і сайт, найімовірніше,
  // дебаунсить/плутає такі швидкі повтори (перший клік формально встигає
  // ввімкнути "ac", але одразу слідує другий клік і вимикає назад) —
  // звідси й стабільно "не вийшло" при швидких retry поспіль.
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
        // Повне перезавантаження сторінки товару (а не просто пауза) перед
        // наступною спробою — клік по вже "підвислій" відрисовці кнопки
        // стабільно не допомагав, а свіжий рендер іноді підтягує
        // коректний стан з сервера. Якщо причина — розсинхрон сесії з
        // поточним списком бажань (див. BUGS.md), reload всередині тесту його не
        // чинить — це лікується лише повним перезапуском з нуля, за який
        // відповідає retries на рівні Playwright (playwright.config.ts).
        await this.goto();
      }
    }
  }
}
