import { expect } from '@playwright/test';
import { ThankYouPage } from '../pages/ThankYouPage';

// Ищем совпадение сразу по article и name, чтобы тест падал,
// если в корзину попал похожий, но не тот товар.
export function expectProductInBasketResponse(body: any, productName: string, article: string) {
  const goods = body?.data?.goods ?? [];
  const product = goods.find((g: any) => g.article === article && g.name === productName);
  const received = goods.map((g: any) => ({ article: g.article, name: g.name }));
  expect(
    product,
    `Товар з артикулом "${article}" та назвою "${productName}" не знайдено у відповіді API кошика. Отримано: ${JSON.stringify(received)}`,
  ).toBeTruthy();
}

// Достаёт товар из ответа POST /api/v1/basket/good по article — используется,
// чтобы получить внутренний код магазина (code) и цену для последующей
// сверки со страницей подтверждения заказа (см. expectOrderProductDetails).
export function getProductFromBasketResponse(body: any, article: string) {
  const goods = body?.data?.goods ?? [];
  return goods.find((g: any) => g.article === article);
}

// Проверяет на странице подтверждения заказа (thank you page), что реально
// сохранились название, код товара, количество и сумма — а не дефолт/пусто.
// code/price берутся из ответа API добавления в корзину (см.
// getProductFromBasketResponse), а не хардкодятся в тестах.
export async function expectOrderProductDetails(
  thankYouPage: ThankYouPage,
  details: { name: string; code: number; price: number; quantity: number },
) {
  await expect(
    thankYouPage.orderProductName(details.name),
    `В заказе должен быть указан товар «${details.name}»`,
  ).toBeVisible();
  await expect(
    thankYouPage.orderProductCode(details.code),
    `В заказе должен быть указан код товара "${details.code}"`,
  ).toBeVisible();
  await expect(
    thankYouPage.orderProductQuantity(details.quantity),
    `В заказе должно быть указано количество "${details.quantity} шт."`,
  ).toBeVisible();

  const productsTotalOnPage = await thankYouPage.getProductsTotalFromPage();
  const expectedTotal = details.price * details.quantity;
  expect(
    productsTotalOnPage,
    `Сумма товаров на странице подтверждения ("${productsTotalOnPage} ₴") должна совпадать с ожидаемой суммой (цена ${details.price} ₴ × ${details.quantity} шт. = ${expectedTotal} ₴)`,
  ).toBe(expectedTotal);
}
