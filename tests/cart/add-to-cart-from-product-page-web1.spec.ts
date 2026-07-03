import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { ProductPage } from '../pages/ProductPage';
import { CartPage } from '../pages/CartPage';
import { expectProductInBasketResponse } from '../helpers/basket';

const PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';
const PRODUCT_ARTICLE = '60238';
const PRODUCT_URL =
  'https://web1-bi.ua/ukr/product/konstruktor-lego-city-strelochnyy-perevod-60238.html';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Проверяет добавление товара в корзину со страницы самого товара на тестовом
// домене web1-bi.ua: сначала заходим в каталог и переходим на страницу товара
// кликом по карточке (а не прямым переходом по URL), затем убеждаемся, что
// кнопка "Купити" видна и название товара совпадает с ожидаемым, кликаем по
// кнопке и проверяем, что товар попал в корзину (по API и в UI) и счётчик
// в хедере обновился.
test('Проверка добавления товара в корзину со страницы товара (web1-bi.ua)', async ({ page }) => {
  const brandPage = new LegoBrandPage(page);
  const productPage = new ProductPage(page, PRODUCT_URL);
  const cartPage = new CartPage(page);

  await test.step('Открыть страницу каталога LEGO', async () => {
    await brandPage.goto();
  });

  await test.step('Перейти на страницу товара из каталога', async () => {
    await brandPage.openProduct(PRODUCT_NAME);
    await page.waitForURL('**/product/**');
  });

  await test.step('Проверить видимость кнопки «Купити»', async () => {
    await expect(
      productPage.buyButton,
      'Основная кнопка «Купити» (в блоке .prodBuy) должна быть видна на странице товара',
    ).toBeVisible();
  });

  await test.step('Проверить название товара', async () => {
    await expect(
      productPage.title,
      'Заголовок страницы товара должен совпадать с ожидаемым названием',
    ).toHaveText(PRODUCT_NAME);
  });

  const addToCartApiResponse = page.waitForResponse(
    (r) => r.url().includes('/api/v1/basket/good') && r.request().method() === 'POST',
  );
  const cartGoodsApiResponse = page.waitForResponse(
    (r) => r.url().includes('/api/v1/basket/goods') && r.request().method() === 'GET',
  );

  await test.step('Нажать кнопку «Купити»', async () => {
    await productPage.clickBuy();

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
      productPage.header.cartCounter,
      'Счётчик товаров в хедере должен показывать 1 после добавления товара',
    ).toHaveText('1');
  });
});
