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
  // Кнопка гамбургер-меню — на мобильной верстке ссылка входа физически
  // скрыта внутри этого меню, пока оно не открыто.
  readonly hamburgerMenuToggle: Locator;
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
    // На мобильной верстке класса "hIco" у ссылки входа нет вовсе — там
    // используется "hILink" (лежит скрытой внутри гамбургер-меню).
    this.loginLink = page.locator('a.hIco[href*="/login/"], a.hILink[href*="/login/"]');
    this.hamburgerMenuToggle = page.locator('span.ico.i-mmenu');
    // На мобильной верстке используется класс "hILink" вместо "hIco", и оба
    // варианта одновременно присутствуют в DOM (десктопный видимый + мобильный
    // скрытый внутри гамбургер-меню, или наоборот) — чтобы не ловить strict
    // mode violation из-за двух совпадений, берём .first() и проверяем через
    // toBeAttached() (не toBeVisible()), не требуя открытия меню на мобилке.
    this.accountLink = page
      .locator('a.hIco[href$="/lk/user-info"], a.hILink[href*="/lk/user-info"]')
      .first();
    // Десктоп: скрытый дубль с классом "exitJ", видимая ссылка — <p class="bOpExit">.
    // Мобилка: своя ссылка "Вийти" с классом "hILink.exitJ" внутри гамбургер-меню.
    this.logoutLink = page.locator('p.bOpExit, a.hILink.exitJ').first();
    // На мобильной верстке компактный хедер показывает только иконки без
    // счётчиков — реальные счётчики (span.counter.counterMenu, с
    // модификатором bgBaseP для корзини / bgBaseB для избранного) лежат
    // внутри гамбургер-меню и физически скрыты, пока меню не открыто.
    // toHaveText() не требует видимости элемента, поэтому матчим оба
    // варианта разметки без необходимости открывать меню в каждом тесте.
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
    // На мобильной верстке ссылка входа скрыта внутри гамбургер-меню —
    // сначала открываем меню, если ссылка ещё не видна.
    if (!(await this.loginLink.isVisible())) {
      await this.hamburgerMenuToggle.click();
    }
    await this.loginLink.click();
  }
}
