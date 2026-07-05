import { test, expect } from '@playwright/test';
import { ProductPage } from '../pages/ProductPage';
import { WishlistPage } from '../pages/WishlistPage';
import { loginAsTestUser } from '../helpers/auth';
import { deleteAllListsViaDesktop } from '../helpers/wishlist-cleanup';

// Окремий товар (не той самий, що в add-to-favorites.spec.ts/
// favorites-display-state.spec.ts) — швидкі повторні тогли обраного
// для ОДНОГО good-id кількома тестами поспіль періодично призводили до
// того, що клік "додати" не перемикав кнопку в "ac" (схоже на
// нестабільність самого сайту при частому повторному тоглі одного товару).
const PRODUCT_NAME = 'Конструктор LEGO Marvel super heroes Шолом Залізної Людини (76165)';
const PRODUCT_URL =
  'https://web1-bi.ua/ukr/product/konstruktor-lego-marvel-super-heroes-shlem-zheleznogo-cheloveka-76165.html';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// 2 ретрая (а не глобальний 1) — клік "додати в бажань" ловить реальний баг
// сайту (див. BUGS.md), який іноді пробиває і retries:1 (обидві спроби
// поспіль невдалі). 3 спроби всього знижують шанс зловити баг на всіх одразу.
test.describe.configure({ retries: 2 });

// Перевіряє додавання товару в обране зі сторінки самого товару (кнопка
// "До списку бажань" поруч з бейджами знижок, клас "wishBig" — відрізняється
// від картки каталогу, де використовується клас "wishTop"): очищаємо список
// бажань -> клікаємо по сердечку на сторінці товару -> перевіряємо, що кнопка
// переходить у стан "активна" і запит POST /api/v1/wish-lists/good
// реально пішов -> товар з'явився в /ukr/lk/wish-list/ -> видаляємо його через
// іконку видалення і перевіряємо, що список знову порожній.
test('Добавление и удаление товара из избранного со страницы товара (web1-bi.ua)', async ({
  page,
}) => {
  test.setTimeout(60000);

  const productPage = new ProductPage(page, PRODUCT_URL);
  const wishlistPage = new WishlistPage(page);

  await test.step('Авторизоваться и очистить список бажань', async () => {
    await loginAsTestUser(page);
    // Тест передбачає рівно один список бажань (інакше при додаванні
    // товару сайт показує попап "Виберіть список" замість прямого
    // додавання). Очищення йде через окремий desktop-контекст (див.
    // deleteAllListsViaDesktop) — на мобільній верстці немає видимої кнопки
    // видалення списку цілком, тому зайві списки з минулих прогонів
    // (наприклад, з choose-wishlist-popup.spec.ts) не можна було б прибрати
    // напряму в мобільному контексті поточного тесту.
    await deleteAllListsViaDesktop(page);
  });

  let goodId: string;

  await test.step('Добавить товар в избранное со страницы товара', async () => {
    await productPage.goto();

    // good-id не винесений в атрибут на цій кнопці (на відміну від картки
    // каталогу) — беремо його з query-параметра реального запиту додавання.
    const addToWishlistRequestPromise = page.waitForRequest(
      (r) => r.url().includes('/api/v1/wish-lists/good') && r.method() === 'POST',
    );

    await productPage.addToFavoritesAndVerify();

    const addToWishlistRequest = await addToWishlistRequestPromise;
    goodId = new URL(addToWishlistRequest.url()).searchParams.get('good-id')!;
  });

  await test.step('Проверить, что товар появился в списке бажань', async () => {
    await wishlistPage.goto();

    await expect(
      productPage.header.favoritesCounter,
      'Счётчик "Бажання" в хедере должен показывать 1 после добавления товара в избранное',
    ).toHaveText('1');
    // toBeAttached(), а не toBeVisible() — на мобільній верстці сайт іноді
    // рендерить свіжододаний товар у схованому (unAc) варіанті контейнера
    // списку; це нестабільність самого сайту, а не селектора тесту.
    await expect(
      wishlistPage.wishlistItem(goodId),
      'Товар должен появиться в списке "Список бажань" после добавления со страницы товара',
    ).toBeAttached();
    await expect(
      wishlistPage.wishlistItemName(goodId),
      `В списке бажань должен быть указан товар «${PRODUCT_NAME}»`,
    ).toHaveText(PRODUCT_NAME);
  });

  await test.step('Удалить товар из списка бажань', async () => {
    // dispatchEvent, а не click() — на мобільній верстці кнопка видалення
    // товару іноді лежить всередині схованого (unAc) варіанта контейнера списку,
    // де у неї немає геометрії для звичайного кліку.
    await wishlistPage.removeItemButton(goodId).dispatchEvent('click');

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

// Перевіряє, що неавторизованому (гостьовому) користувачу на сторінці
// товару теж показується пропозиція авторизуватися, а не реальне
// додавання в обране — поведінка повинна бути однаковою з каталогом.
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
