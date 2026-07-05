import { Page, Locator } from '@playwright/test';

// Відповідає лише за саму форму логіну на /ukr/login/.
// Перехід у хедер ("Вхід"/"Вийти"/ім'я акаунта) — в HeaderComponent.
export class LoginPage {
  readonly page: Page;
  readonly emailPhoneInput: Locator;
  readonly nextButton: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // На мобільній верстці на сторінці одночасно рендеряться форми логіну
    // і реєстрації з однаковим id="emailPhone" — фільтруємо через :visible,
    // як і більшість "дублікованих" елементів на цьому сайті.
    this.emailPhoneInput = page.locator('#emailPhone:visible');
    this.nextButton = page.locator('input[value="Далі"]:visible');
    this.passwordInput = page.locator('input[type="password"]:visible');
    this.submitButton = page.locator('input[value="Увійти"]:visible');
  }

  // Форма двокрокова: спочатку email/телефон + "Далі", потім з'являється
  // поле пароля + "Увійти". Кнопки задизейблені, поки поле порожнє,
  // тому використовуємо pressSequentially, а не fill().
  async login(emailOrPhone: string, password: string) {
    await this.emailPhoneInput.pressSequentially(emailOrPhone);
    await this.nextButton.click();

    await this.passwordInput.waitFor({ state: 'visible' });
    await this.passwordInput.pressSequentially(password);
    await this.submitButton.click();
  }
}
