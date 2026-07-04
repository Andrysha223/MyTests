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
    // Нет доступа к browser (например, persistent context) — fallback на
    // очистку в текущем контексте как есть.
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
    await new WishlistPage(desktopPage).deleteAllLists();
  } finally {
    await desktopContext.close();
  }
}
