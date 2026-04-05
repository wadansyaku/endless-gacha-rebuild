import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test("battle shell loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Endless Gacha" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tap Attack" })).toBeVisible();
});

test("invalid local save surfaces a visible notice instead of silently failing", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("endless-gacha/local-save", "{broken");
  });
  await page.goto("/settings");
  await expect(page.getByText(/Save Notice:/)).toBeVisible();
});

test("summon route shows the latest pull result", async ({ page }) => {
  await page.goto("/summon");
  await page.getByRole("button", { name: "1 Pull" }).first().click();
  await expect(page.getByRole("heading", { name: "Latest Pull Result" })).toBeVisible();
  await expect(page.getByText(/instance /)).toBeVisible();
});

test("midgame preset produces a playable state for browser verification", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Midgame" }).click();

  const snapshot = await page.evaluate(() => {
    const raw = window.render_game_to_text?.() ?? "{}";
    return JSON.parse(raw) as {
      run?: { stage?: number };
      board?: Array<{ heroId: string } | null>;
      overflowCount?: number;
      expeditionCount?: number;
    };
  });

  expect(snapshot.run?.stage).toBeGreaterThanOrEqual(35);
  expect(snapshot.board?.some((entry) => entry !== null)).toBeTruthy();
  expect(snapshot.expeditionCount).toBeGreaterThanOrEqual(0);
});
