import { test, expect } from '@playwright/test';
import { LegoBrandPage } from '../pages/LegoBrandPage';
import { ProductPage } from '../pages/ProductPage';
import { WishlistPage } from '../pages/WishlistPage';
import { loginAsTestUser } from '../helpers/auth';

// Префікс "zz-" в імені файлу — навмисний, не помилка: Playwright (при
// workers: 1) запускає файли в алфавітному порядку, а цей тест створює на
// спільному акаунті зайві списки бажань (видаляються в afterEach). Якщо прогін
// перерветься ДО afterEach (наприклад, хтось зупинить процес руками), ці
// списки залишаться і зламають усі інші тести обраного, які
// передбачають рівно один список (див. BUGS.md). Запускаючи цей файл строго
// останнім серед tests/favorites, ми гарантуємо, що навіть таке переривання
// не зіпсує стан для тестів, які вже встигли пройти в цьому прогоні.

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

// Тест створює списки бажань на спільному тестовому акаунті — прибираємо їх за
// собою і після прогону (не лише перед наступним), щоб не залишати
// сміття в акаунті, навіть якщо тест впав посередині.
test.afterEach(async ({ page }) => {
  const wishlistPage = new WishlistPage(page);
  await wishlistPage.deleteAllLists();
});

// Перевіряє попап "Виберіть список", який з'являється при додаванні
// товару в обране, якщо у користувача більше одного списку бажань (з
// єдиним списком товар мовчки йде в нього, без попапу — це вже
// перевірено в add-to-favorites.spec.ts / add-to-favorites-from-product-page.spec.ts):
// видаляємо ВСІ існуючі списки (тестовий акаунт спільний, могли залишитися
// списки/дублі з минулих прогонів) -> створюємо два нових списки з відомими
// назвами -> з картки каталогу додаємо товар і обираємо в попапі
// перший список -> перевіряємо, що товар потрапив саме в нього, а не в другий
// -> повторюємо зі сторінки товару для іншого товару, обираючи другий список,
// і перевіряємо зворотний розподіл.
test('Выбор списка бажань при добавлении товара, если списков несколько (web1-bi.ua)', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'Mobile Chrome',
    'На мобильной верстке страница списков бажань использует другую разметку без видимой кнопки удаления списка — см. комментарий выше',
  );
  test.setTimeout(90000);

  const brandPage = new LegoBrandPage(page);
  const productPage = new ProductPage(page, PRODUCT_PAGE_PRODUCT_URL);
  const wishlistPage = new WishlistPage(page);

  await test.step('Авторизоваться и удалить все существующие списки бажань', async () => {
    await loginAsTestUser(page);
    // Тестовий акаунт спільний — в особистому кабінеті можуть залишитися списки
    // з минулих прогонів, через що попап вибору покаже не ті опції,
    // які очікує тест.
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
