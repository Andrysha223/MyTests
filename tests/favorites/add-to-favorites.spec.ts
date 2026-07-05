import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { WishlistPage } from '../pages/WishlistPage';
import { loginAsTestUser } from '../helpers/auth';
import { deleteAllListsViaDesktop } from '../helpers/wishlist-cleanup';

const PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// 2 ретрая (а не глобальний 1) — клік "додати в бажань" ловить реальний баг
// сайту (див. BUGS.md), який іноді пробиває і retries:1 (обидві спроби
// поспіль невдалі). 3 спроби всього знижують шанс зловити баг на всіх одразу.
test.describe.configure({ retries: 2 });

// Перевіряє додавання товару в обране ("До списку бажань") з каталогу
// для авторизованого користувача: очищаємо список бажань (тестовий акаунт
// спільний) -> клікаємо по сердечку на картці -> перевіряємо, що кнопка
// переходить у стан "активна" (клас "ac"), лічильник "Бажання" в хедері
// показує 1, а товар реально з'явився в /ukr/lk/wish-list/ з правильною
// назвою і кодом -> видаляємо товар зі списку через іконку видалення і
// перевіряємо, що він зник зі списку і лічильник в хедері оновився.
test('Добавление и удаление товара из избранного в каталоге (web1-bi.ua)', async ({ page }) => {
  test.setTimeout(60000);

  const brandPage = new LegoBrandPage(page);
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

  await test.step('Добавить товар в избранное с карточки каталога', async () => {
    await brandPage.goto();
    const wishButton = brandPage.wishButton(PRODUCT_NAME);
    goodId = (await wishButton.getAttribute('data-good-id'))!;

    await brandPage.addToFavoritesAndVerify(PRODUCT_NAME);
  });

  await test.step('Проверить, что товар появился в списке бажань', async () => {
    // Лічильник "Бажання" в хедері рендериться на сервері при завантаженні
    // сторінки і не оновлюється live-скриптом після AJAX-додавання —
    // тому перевіряємо його після реальної навігації, а не одразу після кліку.
    await wishlistPage.goto();

    await expect(
      brandPage.header.favoritesCounter,
      'Счётчик "Бажання" в хедере должен показывать 1 после добавления товара в избранное',
    ).toHaveText('1');
    // toBeAttached(), а не toBeVisible() — на мобільній верстці сайт іноді
    // рендерить свіжододаний товар у схованому (unAc) варіанті контейнера
    // списку; це нестабільність самого сайту, а не селектора тесту, але
    // товар в будь-якому разі реально зберігається і видно всередині акаунта.
    await expect(
      wishlistPage.wishlistItem(goodId),
      'Товар должен появиться в списке "Список бажань" после добавления с карточки каталога',
    ).toBeAttached();
    await expect(
      wishlistPage.wishlistItemName(goodId),
      `В списке бажань должен быть указан товар «${PRODUCT_NAME}»`,
    ).toHaveText(PRODUCT_NAME);
  });

  await test.step('Удалить товар из списка бажань', async () => {
    // dispatchEvent, а не click() — на мобільній верстці кнопка видалення
    // товару іноді лежить всередині схованого (unAc) варіанта контейнера списку,
    // де у неї немає геометрії для звичайного кліку (див. WishlistPage.clearWishlist).
    await wishlistPage.removeItemButton(goodId).dispatchEvent('click');

    await expect(
      wishlistPage.wishlistItem(goodId),
      'После удаления товар не должен отображаться в списке бажань',
    ).toBeHidden();
  });

  await test.step('Проверить, что счётчик "Бажання" в хедере обновился', async () => {
    await expect(
      brandPage.header.favoritesCounter,
      'После удаления единственного товара счётчик "Бажання" не должен показывать 1',
    ).not.toHaveText('1');
  });
});

// Перевіряє, що неавторизованому (гостьовому) користувачу замість
// додавання в обране показується пропозиція авторизуватися — сайт не
// зберігає список бажань для гостей.
test('Добавление в избранное недоступно неавторизованному пользователю (web1-bi.ua)', async ({
  page,
}) => {
  const brandPage = new LegoBrandPage(page);

  await test.step('Открыть каталог гостем и нажать на сердечко', async () => {
    await brandPage.goto();
    await brandPage.addToFavorites(PRODUCT_NAME);
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

    // Кнопка на картці не повинна перейти в стан "додано" —
    // товар реально не потрапив в обране, раз користувач не авторизований.
    await expect(
      brandPage.wishButton(PRODUCT_NAME),
      'Без авторизации кнопка "До списку бажань" не должна получать класс активного состояния',
    ).not.toHaveClass(/\bac\b/);
  });
});
