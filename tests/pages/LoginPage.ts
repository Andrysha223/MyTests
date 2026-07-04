import { Page, Locator } from '@playwright/test';

// Отвечает только за саму форму логина на /ukr/login/.
// Переход в хедер ("Вхід"/"Вийти"/имя аккаунта) — в HeaderComponent.
export class LoginPage {
  readonly page: Page;
  readonly emailPhoneInput: Locator;
  readonly nextButton: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // На мобильной верстке на странице одновременно рендерятся формы логина
    // и регистрации с одинаковым id="emailPhone" — фильтруем через :visible,
    // как и большинство "дублирующихся" элементов на этом сайте.
    this.emailPhoneInput = page.locator('#emailPhone:visible');
    this.nextButton = page.locator('input[value="Далі"]:visible');
    this.passwordInput = page.locator('input[type="password"]:visible');
    this.submitButton = page.locator('input[value="Увійти"]:visible');
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
