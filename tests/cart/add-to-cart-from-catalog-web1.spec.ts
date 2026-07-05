import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { CartPage } from '../pages/CartPage';
import { expectProductInBasketResponse } from '../helpers/basket';

const PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';
const PRODUCT_ARTICLE = '60238';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Перевіряє додавання товару в кошик на тестовому домені web1-bi.ua:
// відкриває каталог LEGO, знаходить потрібний товар, клікає "Купити" і перевіряє,
// що товар потрапив в кошик (за API і в UI) і лічильник в хедері оновився.
test('Проверка добавления товара в корзину через кнопку купить в каталоге (web1-bi.ua)', async ({
  page,
}) => {
  const brandPage = new LegoBrandPage(page);
  const cartPage = new CartPage(page);

  await test.step('Открыть страницу каталога LEGO', async () => {
    await brandPage.goto();
  });

  await test.step('Проверить видимость кнопки «Купити»', async () => {
    await brandPage.hoverProductCard(PRODUCT_NAME);
    await expect(
      brandPage.buyButton(PRODUCT_NAME),
      'Кнопка «Купити» на карточке товара должна быть видна при наведении',
    ).toBeVisible();
  });

  const addToCartApiResponse = page.waitForResponse(
    (r) => r.url().includes('/api/v1/basket/good') && r.request().method() === 'POST',
  );
  const cartGoodsApiResponse = page.waitForResponse(
    (r) => r.url().includes('/api/v1/basket/goods') && r.request().method() === 'GET',
  );

  await test.step('Добавить товар в корзину', async () => {
    await brandPage.addToCart(PRODUCT_NAME);

    const response = await addToCartApiResponse;
    expect(response.status(), 'Ответ POST /api/v1/basket/good должен быть 200 OK').toBe(200);
    expectProductInBasketResponse(await response.json(), PRODUCT_NAME, PRODUCT_ARTICLE);

    await page.waitForURL('**/basket/cart/**');
  });

  await test.step('Проверить, что товар в корзине', async () => {
    await expect(
      cartPage.cartItem(PRODUCT_NAME),
      'Товар должен появиться в списке товаров корзины после добавления',
    ).toBeVisible();

    const response = await cartGoodsApiResponse;
    expect(response.status(), 'Ответ GET /api/v1/basket/goods должен быть 200 OK').toBe(200);
    expectProductInBasketResponse(await response.json(), PRODUCT_NAME, PRODUCT_ARTICLE);
  });

  await test.step('Проверить обновление счётчика корзины в хедере', async () => {
    await expect(
      brandPage.header.cartCounter,
      'Счётчик товаров в хедере должен показывать 1 после добавления товара',
    ).toHaveText('1');
  });
});
