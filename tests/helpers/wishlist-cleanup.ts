import { Page } from '@playwright/test';
import { WishlistPage } from '../pages/WishlistPage';

// Списки бажань — состояние общего тестового аккаунта на СЕРВЕРЕ, а не
// клиента, поэтому очищать их можно через любой viewport. На мобильной
// верстке страница /ukr/lk/wish-list/ использует другую разметку и не имеет
// видимой кнопки удаления списка целиком (см. WishlistPage.deleteAllLists) —
// поэтому очистка идёт через отдельный desktop-контекст (без device-эмуляции),
// даже если сам тест запущен на Mobile Chrome.
//
// Авторизация в новом контексте — копированием cookies текущей страницы, а
// НЕ повторным логином по email/паролю: два одновременных логина одним
// аккаунтом инвалидируют access_token друг друга на сервере (похоже, разрешена
// только одна активная сессия), из-за чего последующие клики "добавить в
// избранное" на исходной странице переставали приводить к реальному
// добавлению. Копирование cookies даёт desktop-контексту ТУ ЖЕ сессию, не
// создавая новую, поэтому исходная страница не страдает.

export async function deleteAllListsViaDesktop(page: Page) {
  const browser = page.context().browser();
  if (!browser) {
    await new WishlistPage(page).deleteAllLists();
    return;
  }

  const cookies = await page.context().cookies();

  // viewport/userAgent заданы явно: без этого newContext() почему-то
  // наследует device-эмуляцию (viewport/UA) из test.use() текущего файла
  // вместо обычных desktop-дефолтов Playwright, и страница
  // /ukr/lk/wish-list/ рендерится в мобильной разметке без .WLwrapper.
  const desktopContext = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 720 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  try {
    await desktopContext.addCookies(cookies);
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto('https://web1-bi.ua/ukr/lk/wish-list/');
    const wishlistPage = new WishlistPage(desktopPage);
    // deleteAllLists() удаляет только лишние списки (у которых есть кнопка
    // удаления списка целиком) — дефолтный неудаляемый список остаётся, и
    // если в нём с прошлых прогонов застрял товар, он туда никогда не
    // денется сам. clearWishlist() отдельно чистит товары ВНУТРИ текущего
    // списка (по кнопке удаления конкретного товара) — без этого шага клик
    // "добавить в избранное" на уже favorited товаре в тесте переключал бы
    // его в OFF вместо ON.
    await wishlistPage.deleteAllLists();
    await wishlistPage.clearWishlist();

    // deleteAllLists() иногда опустошает аккаунт до НУЛЯ списков (не всегда
    // остаётся один защищённый, как предполагалось раньше) — а клик
    // "додати в бажань" при нуле списков идёт по другому флоу сайта: вместо
    // обычного AJAX-добавления сайт создаёт список и делает РЕАЛЬНЫЙ переход
    // на /ukr/lk/wish-list/, из-за которого тест, ожидающий остаться на
    // текущей странице, зависает/падает. Гарантируем, что после очистки
    // остаётся хотя бы один список — тогда клик всегда идёт по обычному
    // AJAX-пути без навигации.
    await desktopPage.goto('https://web1-bi.ua/ukr/lk/wish-list/');
    const listCount = await desktopPage.locator('.WLwrapper').count();
    if (listCount === 0) {
      await wishlistPage.createList('Список бажань');
    }
  } finally {
    await desktopContext.close();
  }
}
