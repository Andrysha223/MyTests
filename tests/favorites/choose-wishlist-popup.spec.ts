import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { ProductPage } from '../pages/ProductPage';
import { WishlistPage } from '../pages/WishlistPage';
import { loginAsTestUser } from '../helpers/auth';

const CATALOG_PRODUCT_NAME = 'Конструктор LEGO City Залізничні стрілки (60238)';
const PRODUCT_PAGE_PRODUCT_NAME =
  'Конструктор LEGO Speed champions Автомобіль McLaren Senna (75892)';
const PRODUCT_PAGE_PRODUCT_URL =
  'https://web1-bi.ua/ukr/product/konstruktor-lego-speed-champions-avtomobil-mclaren-senna-75892.html';
const FIRST_LIST_NAME = 'Список для тестування 1';
const SECOND_LIST_NAME = 'Список для тестування 2';

// У web1-bi.ua сертифікат виданий на bi.ua (*.bi.ua), тому без цієї опції
// Playwright відмовиться відкривати сторінку через ERR_CERT_COMMON_NAME_INVALID.
test.use({ ignoreHTTPSErrors: true });

// Тест создаёт списки бажань на общем тестовом аккаунте — убираем их за
// собой и после прогона (не только перед следующим), чтобы не оставлять
// мусор в аккаунте, даже если тест упал на середине.
test.afterEach(async ({ page }) => {
  const wishlistPage = new WishlistPage(page);
  await wishlistPage.deleteAllLists();
});

// Проверяет попап "Виберіть список", который появляется при добавлении
// товара в избранное, если у пользователя больше одного списка бажань (с
// единственным списком товар молча уходит в него, без попапа — это уже
// проверено в add-to-favorites.spec.ts / add-to-favorites-from-product-page.spec.ts):
// удаляем ВСЕ существующие списки (тестовый аккаунт общий, могли остаться
// списки/дубли с прошлых прогонов) -> создаём два новых списка с известными
// названиями -> с карточки каталога добавляем товар и выбираем в попапе
// первый список -> проверяем, что товар попал именно в него, а не во второй
// -> повторяем со страницы товара для другого товара, выбирая второй список,
// и проверяем обратное распределение.
test('Выбор списка бажань при добавлении товара, если списков несколько (web1-bi.ua)', async ({
  page,
}) => {
  test.setTimeout(90000);

  const brandPage = new LegoBrandPage(page);
  const productPage = new ProductPage(page, PRODUCT_PAGE_PRODUCT_URL);
  const wishlistPage = new WishlistPage(page);

  await test.step('Авторизоваться и удалить все существующие списки бажань', async () => {
    await loginAsTestUser(page);
    // Тестовый аккаунт общий — в личном кабинете могут остаться списки
    // с прошлых прогонов, из-за чего попап выбора покажет не те опции,
    // которые ожидает тест.
    await wishlistPage.deleteAllLists();
  });

  await test.step('Создать два списка бажань', async () => {
    await wishlistPage.createList(FIRST_LIST_NAME);
    await wishlistPage.createList(SECOND_LIST_NAME);
  });

  await test.step('Добавить товар с карточки каталога и выбрать первый список в попапе', async () => {
    await brandPage.goto();
    await brandPage.addToFavorites(CATALOG_PRODUCT_NAME);

    await expect(
      wishlistPage.chooseListPopupTitle,
      'Раз списков бажань больше одного, при добавлении товара должен появиться попап "Виберіть список"',
    ).toBeVisible();
    await expect(
      wishlistPage.chooseListPopupOption(FIRST_LIST_NAME),
      `В попапе выбора должна быть опция списка "${FIRST_LIST_NAME}"`,
    ).toBeVisible();
    await expect(
      wishlistPage.chooseListPopupOption(SECOND_LIST_NAME),
      `В попапе выбора должна быть опция списка "${SECOND_LIST_NAME}"`,
    ).toBeVisible();

    await wishlistPage.chooseListPopupOption(FIRST_LIST_NAME).click();
  });

  await test.step('Проверить, что товар попал именно в выбранный список', async () => {
    await wishlistPage.goto();

    await expect(
      wishlistPage.listBlock(FIRST_LIST_NAME),
      `Товар с карточки каталога должен появиться в списке "${FIRST_LIST_NAME}", т.к. он был выбран в попапе`,
    ).toContainText(CATALOG_PRODUCT_NAME);
    await expect(
      wishlistPage.listBlock(SECOND_LIST_NAME),
      `Список "${SECOND_LIST_NAME}" не был выбран в попапе — товар не должен появиться в нём`,
    ).not.toContainText(CATALOG_PRODUCT_NAME);
  });

  await test.step('Добавить другой товар со страницы товара и выбрать второй список в попапе', async () => {
    await productPage.goto();
    await productPage.addToFavorites();

    await expect(
      wishlistPage.chooseListPopupTitle,
      'Попап "Виберіть список" должен появляться и при добавлении со страницы товара, а не только из каталога',
    ).toBeVisible();

    await wishlistPage.chooseListPopupOption(SECOND_LIST_NAME).click();
  });

  await test.step('Проверить, что второй товар попал во второй список', async () => {
    await wishlistPage.goto();

    await expect(
      wishlistPage.listBlock(SECOND_LIST_NAME),
      `Товар со страницы товара должен появиться в списке "${SECOND_LIST_NAME}", т.к. он был выбран в попапе`,
    ).toContainText(PRODUCT_PAGE_PRODUCT_NAME);
    await expect(
      wishlistPage.listBlock(FIRST_LIST_NAME),
      `Список "${FIRST_LIST_NAME}" не был выбран для второго товара — он не должен появиться в нём`,
    ).not.toContainText(PRODUCT_PAGE_PRODUCT_NAME);
  });
});
