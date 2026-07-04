import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { ProductPage } from '../pages/ProductPage';
import { WishlistPage } from '../pages/WishlistPage';
import { loginAsTestUser } from '../helpers/auth';

const FAVORITED_PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';
const FAVORITED_PRODUCT_URL =
  'https://web1-bi.ua/ukr/product/konstruktor-lego-city-strelochnyy-perevod-60238.html';
// "Контрольный" товар, который НЕ добавляем в избранное — используется, чтобы
// убедиться, что активное состояние сердечка относится именно к нужному
// товару, а не является глобальным глюком отображения на странице.
const OTHER_PRODUCT_NAME = 'Конструктор LEGO Speed champions Автомобіль McLaren Senna (75892)';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Проверяет, что уже добавленный в избранное товар корректно отображается
// как "в списку бажань" (сердечко активно, класс "ac") при обычном заходе на
// каталог и на страницу товара — без клика, т.е. состояние подтягивается из
// аккаунта при рендере страницы, а не хранится только локально в памяти
// вкладки. Заодно проверяем, что товар, который НЕ добавлялся, остаётся
// неактивным — активное состояние не "протекает" на все карточки подряд.
test('Отображение уже добавленного в избранное товара в каталоге и на странице товара (web1-bi.ua)', async ({
  page,
}) => {
  test.setTimeout(60000);

  const brandPage = new LegoBrandPage(page);
  const productPage = new ProductPage(page, FAVORITED_PRODUCT_URL);
  const wishlistPage = new WishlistPage(page);

  await test.step('Авторизоваться, очистить список бажань и добавить товар', async () => {
    await loginAsTestUser(page);
    // Тестовый аккаунт общий — в списке бажань могут остаться товары
    // с прошлых прогонов, из-за чего проверка "контрольного" товара не совпадёт.
    await wishlistPage.clearWishlist();

    await brandPage.goto();
    await brandPage.addToFavorites(FAVORITED_PRODUCT_NAME);
    await expect(
      brandPage.wishButton(FAVORITED_PRODUCT_NAME),
      'Добавление в избранное должно сразу перевести кнопку в активное состояние',
    ).toHaveClass(/\bac\b/);
  });

  await test.step('Проверить отображение в каталоге при свежем заходе', async () => {
    // Заходим на каталог заново (полная навигация, а не переиспользование
    // текущего состояния страницы) — состояние должно подтянуться с сервера.
    await brandPage.goto();

    await expect(
      brandPage.wishButton(FAVORITED_PRODUCT_NAME),
      `Товар «${FAVORITED_PRODUCT_NAME}» уже в избранном — сердечко на карточке в каталоге должно быть активным без повторного клика`,
    ).toHaveClass(/\bac\b/);
    await expect(
      brandPage.wishButton(OTHER_PRODUCT_NAME),
      `Товар «${OTHER_PRODUCT_NAME}» НЕ добавлялся в избранное — его сердечко должно оставаться неактивным`,
    ).not.toHaveClass(/\bac\b/);
  });

  await test.step('Проверить отображение на странице товара', async () => {
    await productPage.goto();

    await expect(
      productPage.wishButton,
      'Товар уже в избранном — сердечко на странице товара должно быть активным без повторного клика',
    ).toHaveClass(/\bac\b/);
  });
});
