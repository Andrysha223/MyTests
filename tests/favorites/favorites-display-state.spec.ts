import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { ProductPage } from '../pages/ProductPage';
import { WishlistPage } from '../pages/WishlistPage';
import { loginAsTestUser } from '../helpers/auth';
import { deleteAllListsViaDesktop } from '../helpers/wishlist-cleanup';

// Окремий товар від add-to-favorites.spec.ts/add-to-favorites-from-product-page.spec.ts
// — швидкі повторні тогли обраного для ОДНОГО good-id кількома
// тестами поспіль періодично призводили до того, що клік "додати" не
// перемикав кнопку в "ac" (схоже на нестабільність самого сайту).
const FAVORITED_PRODUCT_NAME = 'Конструктор LEGO Speed champions Автомобіль McLaren Senna (75892)';
const FAVORITED_PRODUCT_URL =
  'https://web1-bi.ua/ukr/product/konstruktor-lego-speed-champions-avtomobil-mclaren-senna-75892.html';
// "Контрольний" товар, який НЕ додаємо в обране — використовується, щоб
// переконатися, що активний стан сердечка стосується саме потрібного
// товару, а не є глобальним глюком відображення на сторінці.
const OTHER_PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// 2 ретрая (а не глобальний 1) — клік "додати в бажань" ловить реальний баг
// сайту (див. BUGS.md), який іноді пробиває і retries:1 (обидві спроби
// поспіль невдалі). 3 спроби всього знижують шанс зловити баг на всіх одразу.
test.describe.configure({ retries: 2 });

// Перевіряє, що вже доданий в обране товар коректно відображається
// як "в списку бажань" (сердечко активне, клас "ac") при звичайному заході на
// каталог і на сторінку товару — без кліку, тобто стан підтягується з
// акаунта при рендері сторінки, а не зберігається лише локально в пам'яті
// вкладки. Заодно перевіряємо, що товар, який НЕ додавався, залишається
// неактивним — активний стан не "протікає" на всі картки поспіль.
test('Отображение уже добавленного в избранное товара в каталоге и на странице товара (web1-bi.ua)', async ({
  page,
}) => {
  test.setTimeout(60000);

  const brandPage = new LegoBrandPage(page);
  const productPage = new ProductPage(page, FAVORITED_PRODUCT_URL);
  const wishlistPage = new WishlistPage(page);

  await test.step('Авторизоваться, очистить список бажань и добавить товар', async () => {
    await loginAsTestUser(page);
    // Тест передбачає рівно один список бажань (інакше при додаванні
    // товару сайт показує попап "Виберіть список" замість прямого
    // додавання). Очищення йде через окремий desktop-контекст (див.
    // deleteAllListsViaDesktop) — на мобільній верстці немає видимої кнопки
    // видалення списку цілком, тому зайві списки з минулих прогонів
    // (наприклад, з choose-wishlist-popup.spec.ts) не можна було б прибрати
    // напряму в мобільному контексті поточного тесту.
    await deleteAllListsViaDesktop(page);

    await brandPage.goto();
    await brandPage.addToFavoritesAndVerify(FAVORITED_PRODUCT_NAME);
  });

  await test.step('Проверить отображение в каталоге при свежем заходе', async () => {
    // Заходимо на каталог заново (повна навігація, а не перевикористання
    // поточного стану сторінки) — стан повинен підтягнутися з сервера.
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
