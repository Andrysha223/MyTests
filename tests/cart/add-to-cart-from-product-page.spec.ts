import { test, expect } from '@playwright/test';
import { ProductPage } from '../pages/ProductPage';
import { CartPage } from '../pages/CartPage';
import { expectProductInBasketResponse } from '../helpers/basket';

const PRODUCT_NAME =
  'Конструктор LEGO Ideas Жах перед Різдвом від Тіма Бертона та студії Disney (21351)';
const PRODUCT_ARTICLE = '21351';
const PRODUCT_URL =
  'https://bi.ua/ukr/product/konstruktor-lego-ideas-wicked-koshmar-pered-rozhdestvom-ot-tima-bertona-i-studii-disney-21351.html';

// Проверяет добавление товара в корзину со страницы самого товара: сначала
// убеждается, что кнопка "Купити" видна и название товара совпадает с ожидаемым,
// затем кликает по кнопке и проверяет, что товар попал в корзину (по API и в UI)
// и счётчик в хедере обновился.
test('Проверка добавления товара в корзину со страницы товара', async ({ page }) => {
  const productPage = new ProductPage(page, PRODUCT_URL);
  const cartPage = new CartPage(page);

  await test.step('Open product page', async () => {
    await productPage.goto();
  });

  await test.step('Verify buy button is visible', async () => {
    await expect(productPage.buyButton).toBeVisible();
  });

  await test.step('Verify product name', async () => {
    await expect(productPage.title).toHaveText(PRODUCT_NAME);
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

  await test.step('Click buy button', async () => {
    // Клик по "Купити" сам добавляет товар и редиректит на /basket/cart/,
    // отдельного перехода в корзину не требуется.
    await productPage.clickBuy();

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
