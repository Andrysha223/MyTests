import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { ProductPage } from '../pages/ProductPage';
import { WishlistPage } from '../pages/WishlistPage';
import { loginAsTestUser } from '../helpers/auth';
import { deleteAllListsViaDesktop } from '../helpers/wishlist-cleanup';

// Отдельный товар от add-to-favorites.spec.ts/add-to-favorites-from-product-page.spec.ts
// — быстрые повторные тогглы избранного для ОДНОГО good-id несколькими
// тестами подряд периодически приводили к тому, что клик "добавить" не
// переключал кнопку в "ac" (похоже на нестабильность самого сайта).
const FAVORITED_PRODUCT_NAME = 'Конструктор LEGO Speed champions Автомобіль McLaren Senna (75892)';
const FAVORITED_PRODUCT_URL =
  'https://web1-bi.ua/ukr/product/konstruktor-lego-speed-champions-avtomobil-mclaren-senna-75892.html';
// "Контрольный" товар, который НЕ добавляем в избранное — используется, чтобы
// убедиться, что активное состояние сердечка относится именно к нужному
// товару, а не является глобальным глюком отображения на странице.
const OTHER_PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Без ретраев на уровне Playwright — здесь исследуется реальный баг сайта
// (рассинхрон сессии с текущим списком бажань, см. BUGS.md), и цель прогона
// сейчас — видеть честный результат точечного фикса внутри
// addToFavoritesAndVerify(), а не прятать его за повторным запуском теста.
test.describe.configure({ retries: 0 });

// Проверяет, что уже добавленный в избранное товар корректно отображается
// как "в списку бажань" (сердечко активно, класс "ac") при обычном заходе на
// каталог и на страницу товара — без клика, т.е. состояние подтягивается из
// аккаунта при рендере страницы, а не хранится только локально в памяти
// вкладки. Заодно проверяем, что товар, который НЕ добавлялся, остаётся
// неактивным — активное состояние не "протекает" на все карточки подряд.
test('Отображение уже добавленного в избранное товара в каталоге и на странице товара (web1-bi.ua)', async ({
  page,
}) => {
  // 90000, а не 60000: addToFavoritesAndVerify() при обнаружении рассинхрона
  // сессии (см. BUGS.md) теперь дополнительно делает полный повторный логин
  // внутри retry-цикла — это заметно дороже простого reload и может съесть
  // больше времени в рамках одного прогона теста, особенно если рассинхрон
  // срабатывает на нескольких из 3 внутренних попыток подряд.
  test.setTimeout(90000);

  const brandPage = new LegoBrandPage(page);
  const productPage = new ProductPage(page, FAVORITED_PRODUCT_URL);
  const wishlistPage = new WishlistPage(page);

  await test.step('Авторизоваться, очистить список бажань и добавить товар', async () => {
    await loginAsTestUser(page);
    // Тест предполагает ровно один список бажань (иначе при добавлении
    // товара сайт показывает попап "Виберіть список" вместо прямого
    // добавления). Очистка идёт через отдельный desktop-контекст (см.
    // deleteAllListsViaDesktop) — на мобильной верстке нет видимой кнопки
    // удаления списка целиком, поэтому лишние списки с прошлых прогонов
    // (например, из choose-wishlist-popup.spec.ts) нельзя было бы убрать
    // напрямую в мобильном контексте текущего теста.
    await deleteAllListsViaDesktop(page);

    await brandPage.goto();
    await brandPage.addToFavoritesAndVerify(FAVORITED_PRODUCT_NAME);
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
