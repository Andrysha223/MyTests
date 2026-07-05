import { Page, Locator } from '@playwright/test';

// Сторінка підтвердження /ukr/thankyou/, на яку редиректить після
// успішного оформлення замовлення
export class ThankYouPage {
  readonly page: Page;
  readonly successMessage: Locator;
  readonly orderNumber: Locator;
  // Блок "Інформація про замовлення" дублює те, що обиралося на кроках
  // 2-3 чекауту — звіряємо, що реально збереглося потрібне.
  readonly orderDeliveryMethod: Locator;
  readonly orderDeliveryMethodNovaPoshta: Locator;
  readonly orderDeliveryMethodUkrPoshta: Locator;
  readonly orderDeliveryMethodCourier: Locator;
  // "На ел. пошту" — способ доставки цифрового товару (наприклад,
  // електронного подарункового сертифіката), без фізичної доставки.
  readonly orderDeliveryMethodEmail: Locator;
  readonly orderPaymentMethod: Locator;
  // Спосіб оплати карткою на сайті (LiqPay) — замість "При отриманні" у замовлень
  // з доставкою у поштомат «Нова Пошта» (там немає варіанту оплати при отриманні).
  readonly orderPaymentMethodCard: Locator;
  // Рядок таблиці "Вартість доставки: 30 грн." в блоці "Інформація про замовлення".
  readonly orderDeliveryCostRow: Locator;
  // Рядок "Адреса доставки  м. Київ, ..., вул. Хрещатик, буд. 1, кв. 1" —
  // з'являється лише для кур'єрської доставки (у "в відділення"/самовивозу його нема).
  readonly orderDeliveryAddressRow: Locator;
  // "Статус оплати: Очікування платежу" — з'являється у замовлень з оплатою
  // карткою на сайті, якщо оплата ще не пройшла (в т.ч. після скасування оплати
  // на стороні LiqPay) — у замовлень "При отриманні" цього рядка нема.
  readonly orderPaymentStatusPending: Locator;
  // Рядок "Товарів на суму: 483 ₴" в блоці "Ваші товари:" — сумарна
  // вартість товарів без урахування доставки.
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

  // Адреса магазину залежить від того, що обрали на кроці 2 (параметризовано в тесті).
  orderShopAddress(shopNameContains: string): Locator {
    return this.page.getByText(shopNameContains, { exact: false });
  }

  orderProductName(productName: string): Locator {
    return this.page.getByText(productName, { exact: false });
  }

  // "Код товару: 541057" — внутрішній код магазину, НЕ артикул LEGO з
  // назви товару (наприклад, "75892" у дужках) — це різні значення.
  orderProductCode(code: number | string): Locator {
    return this.page.locator('p.goodCod', { hasText: `Код товару: ${code}` });
  }

  // "2 шт." у блоці товару — кількість, додана до кошика.
  orderProductQuantity(quantity: number): Locator {
    return this.page.locator('.counterWr .count', { hasText: `${quantity} шт.` });
  }

  // Витягує числовий ID замовлення з тексту
  async getOrderNumberFromPage(): Promise<string> {
    const text = await this.orderNumber.textContent();
    return (text ?? '').replace('№', '').trim();
  }

  // Витягує число з рядка "Вартість доставки: 30 грн." (валюта тут —
  // слово "грн.", а не символ "₴", як у сайдбарі чекауту). Суми від 1000
  // форматуються з пробілом-роздільником тисяч (див. getProductsTotalFromPage).
  async getDeliveryCostFromPage(): Promise<number> {
    const text = await this.orderDeliveryCostRow.textContent();
    const match = (text ?? '').match(/([\d\s ]+)грн/);
    return match ? Number(match[1].replace(/[\s ]/g, '')) : NaN;
  }

  // Витягує число з рядка "Товарів на суму: 1 902 ₴" (валюта тут —
  // символ "₴", як у сайдбарі чекауту, на відміну від "Вартість доставки").
  // Суми від 1000 форматуються з пробілом-роздільником тисяч (звичайним або
  // нерозривним  ) — тому захоплюємо всі цифри й пробіли поспіль,
  // а не один блок \d+, і прибираємо пробіли перед Number(...).
  async getProductsTotalFromPage(): Promise<number> {
    const text = await this.orderProductsTotalRow.textContent();
    const match = (text ?? '').match(/([\d\s ]+)₴/);
    return match ? Number(match[1].replace(/[\s ]/g, '')) : NaN;
  }
}
