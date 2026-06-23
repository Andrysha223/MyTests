import { test, expect, Page, Locator } from '@playwright/test';

type Element = {
  locator: (page: Page) => Locator;
  name: string;
  text?: string;
  attribute?: string;
  value?: string;
};

const elements: Element[] = [
  {
    locator: (page: Page) => page.getByRole('link', { name: 'Docs', exact: true }),
    name: 'Docs',
    text: 'Docs',
    attribute: 'href',
    value: '/docs/intro',
  },
  {
    locator: (page: Page) => page.getByRole('link', { name: 'CLI', exact: true }),
    name: 'CLI',
    text: 'CLI',
  },
  {
    locator: (page: Page) => page.getByRole('link', { name: 'MCP', exact: true }),
    name: 'MCP',
    text: 'MCP',
  },
  {
    locator: (page: Page) => page.getByRole('link', { name: 'API', exact: true }),
    name: 'API',
    text: 'API',
  },
  {
    locator: (page: Page) => page.getByRole('link', { name: 'GitHub repository', exact: true }),
    name: 'GitHub repository',
    text: 'GitHub repository',
    attribute: 'href',
    value: 'https://github.com/microsoft/playwright',
  },
  {
    locator: (page: Page) => page.getByRole('link', { name: 'Discord server', exact: true }),
    name: 'Discord server',
    text: 'Discord server',
    attribute: 'href',
    value: 'https://aka.ms/playwright/discord',
  },
];

test.describe('Проверка главной страницы', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://playwright.dev/');
  });

  test('Проверка елем навигации Header', async ({ page }) => {
    for (const element of elements) {
      await test.step(`Проверка отображения навигации Header: ${element.name}`, async () => {
        await expect.soft(element.locator(page)).toBeVisible();
      });
    }
  });

  test('Проверка елем названия навигации Header', async ({ page }) => {
    for (const element of elements) {
      await test.step(`Проверка названия элемента навигации Header: ${element.name}`, async () => {
        await expect.soft(element.locator(page)).toContainText(element.text || element.name);
      });
    }
  });

  test('Проверка аттрибутов href', async ({ page }) => {
    for (const element of elements) {
      if (element.attribute && element.value) {
        await test.step(`Проверка атрибута href для элемента: ${element.name}`, async () => {
          await expect
            .soft(element.locator(page))
            .toHaveAttribute(element.attribute!, element.value!);
        });
      }
    }
  });

  test('Проверка Заголовка страницы', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Playwright enables reliable' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Playwright enables reliable' })).toContainText(
      'Playwright enables reliable web automation for testing, scripting, and AI agents.',
    );
  });

  test('Проверка Get started кнопки', async ({ page }) => {
    await expect.soft(page.getByRole('link', { name: 'Get started' })).toBeVisible();
    await expect.soft(page.getByRole('banner')).toContainText('Get started');
    await expect
      .soft(page.getByRole('link', { name: 'Get started' }))
      .toHaveAttribute('href', '/docs/intro');
  });
});
