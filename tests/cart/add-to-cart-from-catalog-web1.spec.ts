import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { CartPage } from '../pages/CartPage';
import { expectProductInBasketResponse } from '../helpers/basket';

const PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';
const PRODUCT_ARTICLE = '60238';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Проверяет добавление товара в корзину на тестовом домене web1-bi.ua:
// открывает каталог LEGO, находит нужный товар, кликает "Купити" и проверяет,
// что товар попал в корзину (по API и в UI) и счётчик в хедере обновился.
test('Проверка добавления товара в корзину через кнопку купить в каталоге (web1-bi.ua)', async ({
  page,
}) => {
  const brandPage = new LegoBrandPage(page);
  const cartPage = new CartPage(page);

  await test.step('Open LEGO catalog page', async () => {
    await brandPage.goto();
  });

  await test.step('Verify buy button is visible', async () => {
    await brandPage.hoverProductCard(PRODUCT_NAME);
    await expect(brandPage.buyButton(PRODUCT_NAME)).toBeVisible();
  });

  const addToCartApiResponse = page.waitForResponse(
    (r) => r.url().includes('/api/v1/basket/good') && r.request().method() === 'POST',
  );
  const cartGoodsApiResponse = page.waitForResponse(
    (r) => r.url().includes('/api/v1/basket/goods') && r.request().method() === 'GET',
  );

  await test.step('Add product to cart', async () => {
    await brandPage.addToCart(PRODUCT_NAME);

    const response = await addToCartApiResponse;
    expect(response.status()).toBe(200);
    expectProductInBasketResponse(await response.json(), PRODUCT_NAME, PRODUCT_ARTICLE);

    await page.waitForURL('**/basket/cart/**');
  });

  await test.step('Verify product is in the cart', async () => {
    await expect(cartPage.cartItem(PRODUCT_NAME)).toBeVisible();

    const response = await cartGoodsApiResponse;
    expect(response.status()).toBe(200);
    expectProductInBasketResponse(await response.json(), PRODUCT_NAME, PRODUCT_ARTICLE);
  });

  await test.step('Verify header cart counter is updated', async () => {
    await expect(brandPage.header.cartCounter).toHaveText('1');
  });
});
