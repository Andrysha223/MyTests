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
  // "На ел. пошту" — способ доставки цифрового товару (наприклад,
  // електронного подарункового сертифіката), без фізичної доставки.
  readonly orderDeliveryMethodEmail: Locator;
  readonly orderPaymentMethod: Locator;
  // Способ оплаты картой на сайте (LiqPay) — вместо "При отриманні" у заказов
  // с доставкой у поштомат «Нова Пошта» (там нет варианта оплаты при получении).
  readonly orderPaymentMethodCard: Locator;
  // Строка таблицы "Вартість доставки: 30 грн." в блоке "Інформація про замовлення".
  readonly orderDeliveryCostRow: Locator;
  // Строка "Адреса доставки  м. Київ, ..., вул. Хрещатик, буд. 1, кв. 1" —
  // появляется только для кур'єрської доставки (у "в відділення"/самовивозу её нет).
  readonly orderDeliveryAddressRow: Locator;
  // "Статус оплати: Очікування платежу" — появляется у заказов с оплатой
  // карткою на сайті, если оплата ещё не прошла (в т.ч. после отмены оплаты
  // на стороне LiqPay) — у заказов "При отриманні" этой строки нет.
  readonly orderPaymentStatusPending: Locator;
  // Строка "Товарів на суму: 483 ₴" в блоке "Ваші товари:" — суммарная
  // стоимость товаров без учёта доставки.
  readonly orderProductsTotalRow: Locator;
  // Для електронного подарункового сертифіката з неоплаченим замовленням
  // (наприклад, оплата скасована на LiqPay) сайт показує ЗОВСІМ ІНШИЙ текст
  // замість звичайного successMessage — товар цифровий і без оплати не може
  // бути виданий, тому замість "Вітаємо..." сайт просить повторити оплату.
  readonly certificatePaymentNotCompletedMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.successMessage = page.locator('text=Вітаємо, замовлення успішно оформлено.');
    this.orderNumber = page.locator('text=/№\\d+/');
    this.orderDeliveryMethod = page.getByText('Самовивіз із магазину');
    this.orderDeliveryMethodNovaPoshta = page.getByText('У відділення «Нова Пошта»');
    this.orderDeliveryMethodUkrPoshta = page.getByText('У відділення Укрпошта');
    this.orderDeliveryMethodCourier = page.getByText("Кур'єром «Нова Пошта»");
    this.orderDeliveryMethodEmail = page.getByText('На ел. пошту');
    this.orderPaymentMethod = page.getByText('При отриманні (готівкою/карткою)');
    this.orderPaymentMethodCard = page.getByText('Карткою на сайті');
    this.orderDeliveryCostRow = page.locator('tr', { has: page.locator('text=Вартість доставки') });
    this.orderDeliveryAddressRow = page.locator('tr', { has: page.locator('text=Адреса доставки') });
    this.orderPaymentStatusPending = page.getByText('Очікування платежу');
    this.orderProductsTotalRow = page.locator('li.fJbAc', { hasText: 'Товарів на суму' });
    this.certificatePaymentNotCompletedMessage = page.getByText('оплата не пройшла успішно');
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
  // слово "грн.", а не символ "₴", как в сайдбаре чекаута). Суммы от 1000
  // форматируются с пробелом-разделителем тысяч (см. getProductsTotalFromPage).
  async getDeliveryCostFromPage(): Promise<number> {
    const text = await this.orderDeliveryCostRow.textContent();
    const match = (text ?? '').match(/([\d\s ]+)грн/);
    return match ? Number(match[1].replace(/[\s ]/g, '')) : NaN;
  }

  // Извлекает число из строки "Товарів на суму: 1 902 ₴" (валюта здесь —
  // символ "₴", как в сайдбаре чекаута, в отличие от "Вартість доставки").
  // Суммы от 1000 форматируются с пробелом-разделителем тысяч (обычным или
  // неразрывным  ) — поэтому захватываем все цифры и пробелы подряд,
  // а не один блок \d+, и убираем пробелы перед Number(...).
  async getProductsTotalFromPage(): Promise<number> {
    const text = await this.orderProductsTotalRow.textContent();
    const match = (text ?? '').match(/([\d\s ]+)₴/);
    return match ? Number(match[1].replace(/[\s ]/g, '')) : NaN;
  }
}
