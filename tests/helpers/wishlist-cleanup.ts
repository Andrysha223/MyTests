import { Page } from '@playwright/test';
import { WishlistPage } from '../pages/WishlistPage';

// Списки бажань — стан спільного тестового акаунта на СЕРВЕРІ, а не
// клієнта, тому очищати їх можна через будь-який viewport. На мобільній
// верстці сторінка /ukr/lk/wish-list/ використовує іншу розмітку і не має
// видимої кнопки видалення списку цілком (див. WishlistPage.deleteAllLists) —
// тому очищення йде через окремий desktop-контекст (без device-емуляції),
// навіть якщо сам тест запущений на Mobile Chrome.
//
// Авторизація в новому контексті — копіюванням cookies поточної сторінки, а
// НЕ повторним логіном по email/паролю: два одночасних логіни одним
// акаунтом інвалідують access_token один одного на сервері (схоже, дозволена
// лише одна активна сесія), через що подальші кліки "додати в
// бажання" на вихідній сторінці переставали приводити до реального
// додавання. Копіювання cookies дає desktop-контексту ТУ Ж САМУ сесію, не
// створюючи нову, тому вихідна сторінка не страждає.

export async function deleteAllListsViaDesktop(page: Page) {
  const browser = page.context().browser();
  if (!browser) {
    await new WishlistPage(page).deleteAllLists();
    return;
  }

  const cookies = await page.context().cookies();

  // viewport/userAgent задані явно: без цього newContext() чомусь
  // успадковує device-емуляцію (viewport/UA) з test.use() поточного файлу
  // замість звичайних desktop-дефолтів Playwright, і сторінка
  // /ukr/lk/wish-list/ рендериться в мобільній розмітці без .WLwrapper.
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
    // deleteAllLists() видаляє лише зайві списки (у яких є кнопка
    // видалення списку цілком) — дефолтний невидаляємий список залишається, і
    // якщо в ньому з минулих прогонів застряг товар, він туди ніколи не
    // дінеться сам. clearWishlist() окремо чистить товари ВСЕРЕДИНІ поточного
    // списку (по кнопці видалення конкретного товару) — без цього кроку клік
    // "додати в бажання" на вже favorited товарі в тесті перемикав би
    // його в OFF замість ON.
    await wishlistPage.deleteAllLists();
    await wishlistPage.clearWishlist();

    // deleteAllLists() іноді спустошує акаунт до НУЛЯ списків (не завжди
    // залишається один захищений, як передбачалося раніше) — а клік
    // "додати в бажань" при нулі списків йде іншим флоу сайту: замість
    // звичайного AJAX-додавання сайт створює список і робить РЕАЛЬНИЙ перехід
    // на /ukr/lk/wish-list/, через що тест, який очікує залишитися на
    // поточній сторінці, зависає/падає. Гарантуємо, що після очищення
    // залишається хоча б один список — тоді клік завжди йде звичайним
    // AJAX-шляхом без навігації.
    await desktopPage.goto('https://web1-bi.ua/ukr/lk/wish-list/');
    const listCount = await desktopPage.locator('.WLwrapper').count();
    if (listCount === 0) {
      await wishlistPage.createList('Список бажань');
    }
  } finally {
    await desktopContext.close();
  }
}
