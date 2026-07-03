import { Page, Locator } from '@playwright/test';

// Страница подтверждения /ukr/thankyou/, на которую редиректит после
// успешного оформления заказа
export class ThankYouPage {
  readonly page: Page;
  readonly successMessage: Locator;
  readonly orderNumber: Locator;
  // Блок "Інформація про замовлення" дублирует то, что выбиралось на шагах
  // 2-3 чекаута — сверяем, что реально сохранилось нужное.
  readonly orderDeliveryMethod: Locator;
  readonly orderDeliveryMethodNovaPoshta: Locator;
  readonly orderDeliveryMethodUkrPoshta: Locator;
  readonly orderPaymentMethod: Locator;
  // Строка таблицы "Вартість доставки: 30 грн." в блоке "Інформація про замовлення".
  readonly orderDeliveryCostRow: Locator;

  constructor(page: Page) {
    this.page = page;
    this.successMessage = page.locator('text=Вітаємо, замовлення успішно оформлено.');
    this.orderNumber = page.locator('text=/№\\d+/');
    this.orderDeliveryMethod = page.getByText('Самовивіз із магазину');
    this.orderDeliveryMethodNovaPoshta = page.getByText('У відділення «Нова Пошта»');
    this.orderDeliveryMethodUkrPoshta = page.getByText('У відділення Укрпошта');
    this.orderPaymentMethod = page.getByText('При отриманні (готівкою/карткою)');
    this.orderDeliveryCostRow = page.locator('tr', { has: page.locator('text=Вартість доставки') });
  }

  // Адрес магазина зависит от того, что выбрали на шаге 2 (параметризовано в тесте).
  orderShopAddress(shopNameContains: string): Locator {
    return this.page.getByText(shopNameContains, { exact: false });
  }

  orderProductName(productName: string): Locator {
    return this.page.getByText(productName, { exact: false });
  }

  // Извлекает числовой ID заказа из текста
  async getOrderNumberFromPage(): Promise<string> {
    const text = await this.orderNumber.textContent();
    return (text ?? '').replace('№', '').trim();
  }

  // Извлекает число из строки "Вартість доставки: 30 грн." (валюта здесь —
  // слово "грн.", а не символ "₴", как в сайдбаре чекаута).
  async getDeliveryCostFromPage(): Promise<number> {
    const text = await this.orderDeliveryCostRow.textContent();
    const match = (text ?? '').match(/(\d+)\s*грн/);
    return match ? Number(match[1]) : NaN;
  }
}
