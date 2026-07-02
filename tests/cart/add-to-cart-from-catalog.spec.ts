import { test, expect } from '@playwright/test';
import { LegoBrandPage } from './pages/LegoBrandPage';
import { CartPage } from './pages/CartPage';

const PRODUCT_NAME =
  'Конструктор LEGO Ideas Жах перед Різдвом від Тіма Бертона та студії Disney (21351)';
const PRODUCT_ARTICLE = '21351';

// Ищем совпадение сразу по article и name, чтобы тест падал,
// если в корзину попал похожий, но не тот товар.
function expectProductInBasketResponse(body: any, productName: string, article: string) {
  const goods = body?.data?.goods ?? [];
  const product = goods.find((g: any) => g.article === article && g.name === productName);
  const received = goods.map((g: any) => ({ article: g.article, name: g.name }));
  expect(
    product,
    `Товар з артикулом "${article}" та назвою "${productName}" не знайдено у відповіді API кошика. Отримано: ${JSON.stringify(received)}`,
  ).toBeTruthy();
}

test('Проверка добавления товара в коризну, через кнопку купить в каталоге', async ({ page }) => {
  const brandPage = new LegoBrandPage(page);
  const cartPage = new CartPage(page);

  await test.step('Open LEGO catalog page', async () => {
    await brandPage.goto();
  });

  // Подписываемся на ответы ДО клика по "Купити" — иначе можно
  // пропустить событие, если запрос улетит раньше, чем начнётся await.
  const addToCartApiResponse = page.waitForResponse(
    (r) => r.url().includes('/api/v1/basket/good') && r.request().method() === 'POST',
  );
  // Этот запрос сайт делает сам при рендере страницы корзины
  // (после редиректа, который происходит сразу за кликом).
  const cartGoodsApiResponse = page.waitForResponse(
    (r) => r.url().includes('/api/v1/basket/goods') && r.request().method() === 'GET',
  );

  await test.step('Add product to cart', async () => {
    // Клик по "Купити" сам добавляет товар и редиректит на /basket/cart/,
    // отдельного перехода в корзину не требуется.
    await brandPage.addToCart(PRODUCT_NAME);

    const response = await addToCartApiResponse;
    expect(response.status()).toBe(200);
    expectProductInBasketResponse(await response.json(), PRODUCT_NAME, PRODUCT_ARTICLE);

    await page.waitForURL('**/basket/cart/**');
  });

  await test.step('Verify product is in the cart', async () => {
    // Проверяем и UI (карточка товара видна в корзине), и API (данные в ответе сервера).
    await expect(cartPage.cartItem(PRODUCT_NAME)).toBeVisible();

    const response = await cartGoodsApiResponse;
    expect(response.status()).toBe(200);
    expectProductInBasketResponse(await response.json(), PRODUCT_NAME, PRODUCT_ARTICLE);
  });

  await test.step('Verify header cart counter is updated', async () => {
    // Счётчик в хедере должен показывать 1, т.к. добавили один товар.
    await expect(cartPage.headerCartCounter).toHaveText('1');
  });
});
