import { test, expect } from '@playwright/test';
import { ProductPage } from '../pages/ProductPage';
import { WishlistPage } from '../pages/WishlistPage';
import { loginAsTestUser } from '../helpers/auth';

const PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';
const PRODUCT_URL =
  'https://web1-bi.ua/ukr/product/konstruktor-lego-city-strelochnyy-perevod-60238.html';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Проверяет добавление товара в избранное со страницы самого товара (кнопка
// "До списку бажань" рядом с бейджами знижок, класс "wishBig" — отличается
// от карточки каталога, где используется класс "wishTop"): очищаем список
// бажань -> кликаем по сердечку на странице товара -> проверяем, что кнопка
// переходит в состояние "активна" и запрос POST /api/v1/wish-lists/good
// реально ушёл -> товар появился в /ukr/lk/wish-list/ -> удаляем его через
// иконку удаления и проверяем, что список снова пуст.
test('Добавление и удаление товара из избранного со страницы товара (web1-bi.ua)', async ({
  page,
}) => {
  test.setTimeout(60000);

  const productPage = new ProductPage(page, PRODUCT_URL);
  const wishlistPage = new WishlistPage(page);

  await test.step('Авторизоваться и очистить список бажань', async () => {
    await loginAsTestUser(page);
    // Тестовый аккаунт общий — в списке бажань могут остаться товары
    // с прошлых прогонов, из-за чего проверка счётчика/состава не совпадёт.
    await wishlistPage.clearWishlist();
  });

  let goodId: string;

  await test.step('Добавить товар в избранное со страницы товара', async () => {
    await productPage.goto();

    // good-id не вынесен в атрибут на этой кнопке (в отличие от карточки
    // каталога) — берём его из query-параметра реального запроса добавления.
    const addToWishlistRequestPromise = page.waitForRequest(
      (r) => r.url().includes('/api/v1/wish-lists/good') && r.method() === 'POST',
    );

    await productPage.addToFavorites();

    const addToWishlistRequest = await addToWishlistRequestPromise;
    goodId = new URL(addToWishlistRequest.url()).searchParams.get('good-id')!;

    await expect(
      productPage.wishButton,
      'После добавления в избранное кнопка "До списку бажань" должна получить класс активного состояния ("ac")',
    ).toHaveClass(/\bac\b/);
  });

  await test.step('Проверить, что товар появился в списке бажань', async () => {
    await wishlistPage.goto();

    await expect(
      productPage.header.favoritesCounter,
      'Счётчик "Бажання" в хедере должен показывать 1 после добавления товара в избранное',
    ).toHaveText('1');
    await expect(
      wishlistPage.wishlistItem(goodId),
      'Товар должен появиться в списке "Список бажань" после добавления со страницы товара',
    ).toBeVisible();
    await expect(
      wishlistPage.wishlistItemName(goodId),
      `В списке бажань должен быть указан товар «${PRODUCT_NAME}»`,
    ).toHaveText(PRODUCT_NAME);
  });

  await test.step('Удалить товар из списка бажань', async () => {
    await wishlistPage.removeItemButton(goodId).click();

    await expect(
      wishlistPage.wishlistItem(goodId),
      'После удаления товар не должен отображаться в списке бажань',
    ).toBeHidden();
  });

  await test.step('Проверить, что счётчик "Бажання" в хедере обновился', async () => {
    await expect(
      productPage.header.favoritesCounter,
      'После удаления единственного товара счётчик "Бажання" не должен показывать 1',
    ).not.toHaveText('1');
  });
});

// Проверяет, что неавторизованному (гостевому) пользователю на странице
// товара тоже показывается предложение авторизуватися, а не реальное
// добавление в избранное — поведение должно быть одинаковым с каталогом.
test('Добавление в избранное со страницы товара недоступно неавторизованному пользователю (web1-bi.ua)', async ({
  page,
}) => {
  const productPage = new ProductPage(page, PRODUCT_URL);

  await test.step('Открыть страницу товара гостем и нажать на сердечко', async () => {
    await productPage.goto();
    await productPage.addToFavorites();
  });

  await test.step('Проверить предложение авторизоваться', async () => {
    await expect(
      page.locator('text=У Вас немає списків бажань'),
      'Гостю должно показываться сообщение об отсутствии списка бажань вместо реального добавления',
    ).toBeVisible();
    await expect(
      page.locator('text=Авторизуватися').last(),
      'В попапе должна быть кнопка/ссылка "Авторизуватися"',
    ).toBeVisible();

    await expect(
      productPage.wishButton,
      'Без авторизации кнопка "До списку бажань" не должна получать класс активного состояния',
    ).not.toHaveClass(/\bac\b/);
  });
});
