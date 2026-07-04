import { Page, Locator } from '@playwright/test';

// Хедер присутствует на каждой странице сайта, поэтому вынесен в отдельный
// компонент и подключается (композицией) во все Page Object'ы, а не
// наследуется — так у каждой страницы остаётся один `page.goto()`, но общая
// разметка хедера описана в одном месте.
export class HeaderComponent {
  readonly page: Page;
  readonly cookieAcceptButton: Locator;
  // Ссылка "Вхід" в хедере (для гостя), ведёт на /ukr/login/.
  readonly loginLink: Locator;
  // После логина эта ссылка в хедере показывает имя пользователя вместо "Вхід".
  readonly accountLink: Locator;
  readonly logoutLink: Locator;
  readonly cartCounter: Locator;
  // Ссылка "Бажання" (список избранного) — ведёт на /ukr/lk/wish-list/.
  readonly favoritesLink: Locator;
  readonly favoritesCounter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cookieAcceptButton = page.locator('button.cookie_accept');
    this.loginLink = page.locator('a.hIco[href*="/login/"]');
    this.accountLink = page.locator('a.hIco[href$="/lk/user-info"]');
    // На странице есть скрытый дубль с классом "exitJ" (visibility: hidden),
    // реальная видимая ссылка "Вийти" — это <p class="bOpExit">.
    this.logoutLink = page.locator('p.bOpExit');
    this.cartCounter = page.locator('.cartCounterJs');
    this.favoritesLink = page.locator('a.hIco.wishj');
    this.favoritesCounter = this.favoritesLink.locator('.counter');
  }

  async acceptCookiesIfVisible() {
    if (await this.cookieAcceptButton.isVisible().catch(() => false)) {
      await this.cookieAcceptButton.click();
    }
  }

  async openLogin() {
    await this.loginLink.click();
  }
}
