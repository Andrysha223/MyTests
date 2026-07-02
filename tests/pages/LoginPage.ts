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
    this.emailPhoneInput = page.locator('#emailPhone');
    this.nextButton = page.locator('input[value="Далі"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.locator('input[value="Увійти"]');
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
