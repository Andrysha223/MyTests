import { Page, Locator } from '@playwright/test';

// Страница подтверждения /ukr/thankyou/, на которую редиректит после
// успешного оформления заказа (см. CheckoutPage.placeOrder()).
export class ThankYouPage {
  readonly page: Page;
  readonly successMessage: Locator;
  readonly orderNumber: Locator;
  // Блок "Інформація про замовлення" дублирует то, что выбиралось на шагах
  // 2-3 чекаута — сверяем, что реально сохранилось нужное.
  readonly orderDeliveryMethod: Locator;
  readonly orderPaymentMethod: Locator;

  constructor(page: Page) {
    this.page = page;
    this.successMessage = page.locator('text=Вітаємо, замовлення успішно оформлено.');
    this.orderNumber = page.locator('text=/№\\d+/');
    this.orderDeliveryMethod = page.getByText('Самовивіз із магазину');
    this.orderPaymentMethod = page.getByText('При отриманні (готівкою/карткою)');
  }

  // Адрес магазина зависит от того, что выбрали на шаге 2 (параметризовано в тесте).
  orderShopAddress(shopNameContains: string): Locator {
    return this.page.getByText(shopNameContains, { exact: false });
  }

  orderProductName(productName: string): Locator {
    return this.page.getByText(productName, { exact: false });
  }

  // Извлекает числовой ID заказа из текста "№990004339".
  async getOrderNumberFromPage(): Promise<string> {
    const text = await this.orderNumber.textContent();
    return (text ?? '').replace('№', '').trim();
  }
}
