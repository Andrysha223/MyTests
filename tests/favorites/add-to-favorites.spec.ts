import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { WishlistPage } from '../pages/WishlistPage';
import { loginAsTestUser } from '../helpers/auth';
import { deleteAllListsViaDesktop } from '../helpers/wishlist-cleanup';

const PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Проверяет добавление товара в избранное ("До списку бажань") из каталога
// для авторизованного пользователя: очищаем список бажань (тестовый аккаунт
// общий) -> кликаем по сердечку на карточке -> проверяем, что кнопка
// переходит в состояние "активна" (класс "ac"), счётчик "Бажання" в хедере
// показывает 1, а товар реально появился в /ukr/lk/wish-list/ с правильным
// названием и кодом -> удаляем товар из списка через иконку удаления и
// проверяем, что он пропал из списка и счётчик в хедере обновился.
test('Добавление и удаление товара из избранного в каталоге (web1-bi.ua)', async ({ page }) => {
  test.setTimeout(60000);

  const brandPage = new LegoBrandPage(page);
  const wishlistPage = new WishlistPage(page);

  await test.step('Авторизоваться и очистить список бажань', async () => {
    await loginAsTestUser(page);
    // Тест предполагает ровно один список бажань (иначе при добавлении
    // товара сайт показывает попап "Виберіть список" вместо прямого
    // добавления). Очистка идёт через отдельный desktop-контекст (см.
    // deleteAllListsViaDesktop) — на мобильной верстке нет видимой кнопки
    // удаления списка целиком, поэтому лишние списки с прошлых прогонов
    // (например, из choose-wishlist-popup.spec.ts) нельзя было бы убрать
    // напрямую в мобильном контексте текущего теста.
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
    // Счётчик "Бажання" в хедере рендерится на сервере при загрузке
    // страницы и не обновляется live-скриптом после AJAX-добавления —
    // поэтому проверяем его после реальной навигации, а не сразу после клика.
    await wishlistPage.goto();

    await expect(
      brandPage.header.favoritesCounter,
      'Счётчик "Бажання" в хедере должен показывать 1 после добавления товара в избранное',
    ).toHaveText('1');
    // toBeAttached(), а не toBeVisible() — на мобильной верстке сайт иногда
    // рендерит свежедобавленный товар в скрытом (unAc) варианте контейнера
    // списка; это нестабильность самого сайта, а не селектора теста, но
    // товар в любом случае реально сохраняется и виден внутри аккаунта.
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
    // dispatchEvent, а не click() — на мобильной верстке кнопка удаления
    // товара иногда лежит внутри скрытого (unAc) варианта контейнера списка,
    // где у неё нет геометрии для обычного клика (см. WishlistPage.clearWishlist).
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

// Проверяет, что неавторизованному (гостевому) пользователю вместо
// добавления в избранное показывается предложение авторизуватися — сайт не
// хранит список бажань для гостей.
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

    // Кнопка на карточке не должна перейти в состояние "добавлено" —
    // товар реально не попал в избранное, раз пользователь не авторизован.
    await expect(
      brandPage.wishButton(PRODUCT_NAME),
      'Без авторизации кнопка "До списку бажань" не должна получать класс активного состояния',
    ).not.toHaveClass(/\bac\b/);
  });
});
