import { expect } from '@playwright/test';

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
