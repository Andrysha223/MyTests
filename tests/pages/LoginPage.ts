import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  // Ссылка "Вхід" в хедере, ведёт на /ukr/login/.
  readonly headerLoginLink: Locator;
  readonly emailPhoneInput: Locator;
  readonly nextButton: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  // После логина эта ссылка в хедере показывает имя пользователя вместо "Вхід".
  readonly headerAccountLink: Locator;
  readonly logoutLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.headerLoginLink = page.locator('a.hIco[href*="/login/"]');
    this.emailPhoneInput = page.locator('#emailPhone');
    this.nextButton = page.locator('input[value="Далі"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.locator('input[value="Увійти"]');
    this.headerAccountLink = page.locator('a.hIco[href$="/lk/user-info"]');
    // На странице есть скрытый дубль с классом "exitJ" (visibility: hidden),
    // реальная видимая ссылка "Вийти" — это <p class="bOpExit">.
    this.logoutLink = page.locator('p.bOpExit');
  }

  async openFromHeader() {
    await this.headerLoginLink.click();
  }

  // Форма двухшаговая: сначала email/телефон + "Далі", затем появляется
  // поле пароля + "Увійти". Кнопки задизейблены, пока поле пустое,
  // поэтому используем pressSequentially, а не fill().
  async login(emailOrPhone: string, password: string) {
    await this.emailPhoneInput.pressSequentially(emailOrPhone);
    await this.nextButton.click();

    await this.passwordInput.waitFor({ state: 'visible' });
    await this.passwordInput.pressSequentially(password);
    await this.submitButton.click();
  }
}
