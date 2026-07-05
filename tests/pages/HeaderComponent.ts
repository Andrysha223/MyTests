import { Page, Locator } from '@playwright/test';

// Хедер присутній на кожній сторінці сайту, тому винесений в окремий
// компонент і підключається (композицією) в усі Page Object'и, а не
// успадковується — так у кожної сторінки залишається один `page.goto()`, але
// спільна розмітка хедера описана в одному місці.
export class HeaderComponent {
  readonly page: Page;
  readonly cookieAcceptButton: Locator;
  // Посилання "Вхід" в хедері (для гостя), веде на /ukr/login/.
  readonly loginLink: Locator;
  // Кнопка гамбургер-меню — на мобільній верстці посилання входу фізично
  // сховане всередині цього меню, поки воно не відкрите.
  readonly hamburgerMenuToggle: Locator;
  // Після логіну це посилання в хедері показує ім'я користувача замість "Вхід".
  readonly accountLink: Locator;
  readonly logoutLink: Locator;
  readonly cartCounter: Locator;
  // Посилання "Бажання" (список обраного) — веде на /ukr/lk/wish-list/.
  readonly favoritesLink: Locator;
  readonly favoritesCounter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cookieAcceptButton = page.locator('button.cookie_accept');
    // На мобільній верстці класу "hIco" у посилання входу немає взагалі — там
    // використовується "hILink" (лежить схованим всередині гамбургер-меню).
    this.loginLink = page.locator('a.hIco[href*="/login/"], a.hILink[href*="/login/"]');
    this.hamburgerMenuToggle = page.locator('span.ico.i-mmenu');
    // На мобільній верстці використовується клас "hILink" замість "hIco", і
    // обидва варіанти одночасно присутні в DOM (десктопний видимий + мобільний
    // схований всередині гамбургер-меню, або навпаки) — щоб не зловити strict
    // mode violation через два збіги, беремо .first() і перевіряємо через
    // toBeAttached() (не toBeVisible()), не вимагаючи відкриття меню на мобілці.
    this.accountLink = page
      .locator('a.hIco[href$="/lk/user-info"], a.hILink[href*="/lk/user-info"]')
      .first();
    // Десктоп: схований дубль з класом "exitJ", видиме посилання — <p class="bOpExit">.
    // Мобілка: своє посилання "Вийти" з класом "hILink.exitJ" всередині гамбургер-меню.
    this.logoutLink = page.locator('p.bOpExit, a.hILink.exitJ').first();
    // На мобільній верстці компактний хедер показує лише іконки без
    // лічильників — реальні лічильники (span.counter.counterMenu, з
    // модифікатором bgBaseP для кошика / bgBaseB для обраного) лежать
    // всередині гамбургер-меню і фізично сховані, поки меню не відкрите.
    // toHaveText() не вимагає видимості елемента, тому матчимо обидва
    // варіанти розмітки без потреби відкривати меню в кожному тесті.
    this.cartCounter = page.locator('.cartCounterJs, span.counter.counterMenu.bgBaseP');
    this.favoritesLink = page.locator('a.hIco.wishj, a.i-heart[href*="wish-list"]');
    this.favoritesCounter = page.locator(
      '.hIco.wishj .counter, span.counter.counterMenu.bgBaseB',
    );
  }

  async acceptCookiesIfVisible() {
    if (await this.cookieAcceptButton.isVisible().catch(() => false)) {
      await this.cookieAcceptButton.click();
    }
  }

  async openLogin() {
    // На мобільній верстці посилання входу сховане всередині гамбургер-меню —
    // спочатку відкриваємо меню, якщо посилання ще не видно.
    if (!(await this.loginLink.isVisible())) {
      await this.hamburgerMenuToggle.click();
    }
    await this.loginLink.click();
  }
}
