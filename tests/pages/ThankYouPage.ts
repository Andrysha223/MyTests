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
  readonly orderDeliveryMethodCourier: Locator;
  readonly orderPaymentMethod: Locator;
  // Строка таблицы "Вартість доставки: 30 грн." в блоке "Інформація про замовлення".
  readonly orderDeliveryCostRow: Locator;
  // Строка "Адреса доставки  м. Київ, ..., вул. Хрещатик, буд. 1, кв. 1" —
  // появляется только для кур'єрської доставки (у "в відділення"/самовивозу её нет).
  readonly orderDeliveryAddressRow: Locator;
  // Строка "Товарів на суму: 483 ₴" в блоке "Ваші товари:" — суммарная
  // стоимость товаров без учёта доставки.
  readonly orderProductsTotalRow: Locator;

  constructor(page: Page) {
    this.page = page;
    this.successMessage = page.locator('text=Вітаємо, замовлення успішно оформлено.');
    this.orderNumber = page.locator('text=/№\\d+/');
    this.orderDeliveryMethod = page.getByText('Самовивіз із магазину');
    this.orderDeliveryMethodNovaPoshta = page.getByText('У відділення «Нова Пошта»');
    this.orderDeliveryMethodUkrPoshta = page.getByText('У відділення Укрпошта');
    this.orderDeliveryMethodCourier = page.getByText("Кур'єром «Нова Пошта»");
    this.orderPaymentMethod = page.getByText('При отриманні (готівкою/карткою)');
    this.orderDeliveryCostRow = page.locator('tr', { has: page.locator('text=Вартість доставки') });
    this.orderDeliveryAddressRow = page.locator('tr', { has: page.locator('text=Адреса доставки') });
    this.orderProductsTotalRow = page.locator('li.fJbAc', { hasText: 'Товарів на суму' });
  }

  // Адрес магазина зависит от того, что выбрали на шаге 2 (параметризовано в тесте).
  orderShopAddress(shopNameContains: string): Locator {
    return this.page.getByText(shopNameContains, { exact: false });
  }

  orderProductName(productName: string): Locator {
    return this.page.getByText(productName, { exact: false });
  }

  // "Код товару: 541057" — внутренний код магазина, НЕ артикул LEGO из
  // названия товара (например, "75892" в скобках) — это разные значения.
  orderProductCode(code: number | string): Locator {
    return this.page.locator('p.goodCod', { hasText: `Код товару: ${code}` });
  }

  // "2 шт." в блоке товара — количество, добавленное в корзину.
  orderProductQuantity(quantity: number): Locator {
    return this.page.locator('.counterWr .count', { hasText: `${quantity} шт.` });
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

  // Извлекает число из строки "Товарів на суму: 483 ₴" (валюта здесь —
  // символ "₴", как в сайдбаре чекаута, в отличие от "Вартість доставки").
  async getProductsTotalFromPage(): Promise<number> {
    const text = await this.orderProductsTotalRow.textContent();
    const match = (text ?? '').match(/(\d+)\s*₴/);
    return match ? Number(match[1]) : NaN;
  }
}
