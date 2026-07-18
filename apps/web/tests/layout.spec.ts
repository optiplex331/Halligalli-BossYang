import { expect, test, type Locator, type Page } from "@playwright/test";

const VIEWPORT_WIDTHS = [390, 640, 721, 981, 1440] as const;
const TABLE_SEAT_COUNTS = [4, 5, 6, 7, 8] as const;

type Box = NonNullable<Awaited<ReturnType<Locator["boundingBox"]>>>;

function overlapArea(first: Box, second: Box): number {
  const width = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));
  const height = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));
  return width * height;
}

async function box(locator: Locator): Promise<Box> {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

async function expectCompleteTable(page: Page, tableSeatCount: number): Promise<void> {
  const felt = await box(page.locator(".table-felt"));
  const bell = await box(page.locator(".center-bell"));
  const cards = page.locator(".table-card-shell");
  await expect(cards).toHaveCount(tableSeatCount);

  const cardBoxes = await Promise.all(
    Array.from({ length: tableSeatCount }, (_, index) => box(cards.nth(index))),
  );
  for (const card of cardBoxes) {
    expect(card.x).toBeGreaterThanOrEqual(felt.x - 0.5);
    expect(card.y).toBeGreaterThanOrEqual(felt.y - 0.5);
    expect(card.x + card.width).toBeLessThanOrEqual(felt.x + felt.width + 0.5);
    expect(card.y + card.height).toBeLessThanOrEqual(felt.y + felt.height + 0.5);
    expect(overlapArea(card, bell)).toBeLessThanOrEqual(1);
  }

  cardBoxes.forEach((card, index) => {
    cardBoxes.slice(index + 1).forEach((other) => {
      expect(overlapArea(card, other)).toBeLessThanOrEqual(1);
    });
  });
}

test("all Table Seat cards remain complete across responsive table layouts", async ({ page }) => {
  test.setTimeout(120_000);
  for (const width of VIEWPORT_WIDTHS) {
    await page.setViewportSize({ width, height: 1000 });
    for (const tableSeatCount of TABLE_SEAT_COUNTS) {
      await page.goto("/");
      await page.getByRole("button", { name: "English", exact: true }).click({ force: true });
      await page.getByRole("button", { name: `${tableSeatCount} seats`, exact: true }).click({ force: true });
      await page.getByRole("button", { name: "Start Practice", exact: true }).click({ force: true });
      await expectCompleteTable(page, tableSeatCount);
    }
  }
});

for (const language of ["en", "zh"] as const) {
  test(`the ${language} flow remains usable from home through results at 320 px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: language === "en" ? "English" : "中文", exact: true }).click();

    const documentOverflow = () => page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(await documentOverflow()).toBe(0);

    for (const control of await page.locator("button, input, select").all()) {
      const bounds = await box(control);
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole("button", { name: language === "en" ? "8 seats" : "8 个座位", exact: true }).click();
    await page.getByRole("button", { name: language === "en" ? "Start Practice" : "开始练习", exact: true }).click();
    const endRound = page.getByRole("button", { name: language === "en" ? "End Round" : "结束本局", exact: true });
    await expect(endRound).toBeDisabled();
    await expect(endRound).toBeEnabled({ timeout: 5_000 });
    await expectCompleteTable(page, 8);
    await endRound.click();
    await expect(page.locator(".result-hero")).toBeVisible();
    expect(await documentOverflow()).toBe(0);
  });
}
