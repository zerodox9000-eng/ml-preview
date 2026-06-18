import { expect, test, type Page } from "@playwright/test";
import { gzipSync } from "node:zlib";

async function mockBackendData(page: Page) {
  const gzipJson = (value: unknown) => gzipSync(Buffer.from(JSON.stringify(value)));
  const catalog = [
    {
      id: 9,
      display_title: "Latest Mock Manhwa",
      cover: null,
      year: 2026,
      status: "releasing",
      content_rating: "safe",
      total_chapters: "12",
      tag_ids: [1, 2],
      stats: { popularity: null, favourites: null, meanScore: null },
      analytics: { fanFavouriteRaw: null, fanFavouriteDiscoveryScore: null },
      published: { start_date: null, end_date: null },
      last_updated_at: "2026-06-10T12:00:00.000Z",
      mangabaka_latest_rank: 1,
      authors: ["QA"],
      artists: ["QA"],
      links: { mangabaka: "https://mangabaka.org/9" },
      source: {},
    },
    {
      id: 1252,
      display_title: "Solo Leveling: Ragnarok",
      cover: null,
      year: 2024,
      status: "hiatus",
      content_rating: "safe",
      total_chapters: "68",
      tag_ids: [1, 2],
      stats: { popularity: 30298, favourites: 1147, meanScore: 76 },
      analytics: {
        fanFavouriteRaw: 3.7857,
        fanRatioPercentile: 92.0655,
        popularityPercentile: 99.744,
        fanFavouriteDiscoveryScore: 91.9459,
        fanFavouriteDiscoveryPercentile: 95.9668,
      },
      published: { start_date: "2024-07-31", end_date: null },
      last_updated_at: "2026-05-24T02:31:20.226Z",
      authors: ["Daul", "Do Dang"],
      artists: ["JIN", "REDICE"],
      links: { mangabaka: "https://mangabaka.org/1252" },
      source: { anilist: { id: 179445, rating: 76, url: "https://anilist.co/manga/179445" } },
    },
    {
      id: 4,
      display_title: "High School Boy",
      cover: null,
      year: 2023,
      status: "releasing",
      content_rating: "suggestive",
      total_chapters: "102",
      tag_ids: [1, 2],
      stats: { popularity: 999, favourites: 35, meanScore: 69 },
      analytics: { fanFavouriteRaw: 3.5035, fanFavouriteDiscoveryScore: 89.7064 },
      published: { start_date: "2023-12-24", end_date: null },
      last_updated_at: "2026-05-23T16:34:11.462Z",
      authors: ["Bakji"],
      artists: ["Bakji"],
      links: { mangabaka: "https://mangabaka.org/4" },
      source: { anilist: { id: 179451, rating: 69, url: "https://anilist.co/manga/179451" } },
    },
  ];
  for (let index = 0; index < 36; index += 1) {
    catalog.push({
      ...catalog[1],
      id: 3000 + index,
      display_title: `Scroll Test ${index + 1}`,
      stats: { popularity: 6000 + index, favourites: 200 + index, meanScore: 72 },
      analytics: {
        fanFavouriteRaw: 3.2,
        fanRatioPercentile: 85,
        popularityPercentile: 90,
        fanFavouriteDiscoveryScore: 84 + index / 10,
        fanFavouriteDiscoveryPercentile: 82 + index / 10,
      },
      links: { mangabaka: `https://mangabaka.org/${3000 + index}` },
      source: {},
    });
  }
  await page.route("**/data/query-index.json.gz", async (route) => {
    await route.fulfill({
      status: 200,
      body: gzipJson(catalog),
      headers: { "content-type": "application/gzip" },
    });
  });
  await page.route("**/series/all.json.gz", async (route) => {
    await route.fulfill({
      status: 200,
      body: gzipJson(catalog),
      headers: { "content-type": "application/gzip" },
    });
  });
  await page.route("**/details/*.json", async (route) => {
    const id = Number(route.request().url().match(/details\/(\d+)\.json/)?.[1]);
    const item = catalog.find((series) => series.id === id);
    await route.fulfill({
      status: item ? 200 : 404,
      json: item ? { ...item, description: "QA detail description." } : { error: "missing" },
    });
  });
  await page.route("**/meta/tags.json.gz", async (route) => {
    await route.fulfill({
      status: 200,
      body: gzipJson({
        "1": { id: 1, name: "Action", path: "Genres > Action", is_genre: true, parent_id: null, level: 1 },
        "2": { id: 2, name: "Fantasy", path: "Genres > Fantasy", is_genre: true, parent_id: null, level: 1 },
        "3": { id: 3, name: "Hentai", path: "Genres > Hentai", is_genre: true, parent_id: null, level: 1 },
      }),
      headers: { "content-type": "application/gzip" },
    });
  });
  await page.route("**/stats/history.json.gz", async (route) => {
    await route.fulfill({
      status: 200,
      body: gzipJson({
        "1252": [
          { d: "2026-05-01", p: 29000, f: 1000, s: 75, r: 3.44, rp: 80, pp: 98, ds: 86, dp: 92 },
          { d: "2026-06-01", p: 30200, f: 1130, s: 76, r: 3.74, rp: 92, pp: 99, ds: 91, dp: 95 },
        ],
        "4": [
          { d: "2026-05-01", p: 900, f: 30, s: 68, r: 3.33, rp: 40, pp: 60, ds: 70, dp: 55 },
        ],
      }),
      headers: { "content-type": "application/gzip" },
    });
  });
  await page.route("**/recommendations/features.json.gz", async (route) => {
    await route.fulfill({
      status: 200,
      body: gzipJson([
        {
          id: 1252,
          profileGroups: ["game-system"],
          primaryAnchors: ["game-system"],
          tagFeatures: { "tag:1": 1, "tag:2": 1 },
          textFeatures: { solo: 1, leveling: 1, ragnarok: 1 },
          quality: { discPct: 95.9668, fanPct: 3.7857, popularity: 30298 },
        },
        {
          id: 4,
          profileGroups: ["game-system"],
          primaryAnchors: ["game-system"],
          tagFeatures: { "tag:1": 1, "tag:2": 1 },
          textFeatures: { high: 1, school: 1, boy: 1 },
          quality: { discPct: 55, fanPct: 3.5035, popularity: 999 },
        },
      ]),
      headers: { "content-type": "application/gzip" },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockBackendData(page);
  await page.addInitScript(() => {
    localStorage.clear();
    indexedDB.deleteDatabase("manhwa-library");
  });
});

test("mobile feeds, search, detail, recommendations, and navigation state work", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Latest Listings" })).toBeVisible();
  await expect(page.getByTestId("title-card").first()).toBeVisible();
  await expect(page.locator(".compact-metrics").first()).toContainText("Year");
  await expect(page.locator(".bottom-nav")).not.toContainText("Folders");

  await page.getByRole("link", { name: "Search" }).click();
  const searchInput = page.getByPlaceholder("Search titles");
  await searchInput.fill("Solo Leveling");
  await expect(searchInput).toBeFocused();
  await expect(page.getByTestId("title-card").first()).toBeVisible();
  await searchInput.press("Enter");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Search" }).click();
  await expect(page.getByPlaceholder("Search titles")).toHaveValue("Solo Leveling");
  await page.getByPlaceholder("Search titles").fill("");
  await expect(page.getByRole("button", { name: "Solo Leveling" })).toBeVisible();
  await page.getByRole("button", { name: "Solo Leveling" }).click();
  await page.getByTestId("title-card").first().click();
  await expect(page.getByRole("heading", { name: "Solo Leveling: Ragnarok" })).toBeVisible();
  await expect(page.locator(".detail-stat-grid")).toContainText("30,298");
  await page.getByRole("button", { name: "Detail settings" }).click();
  await expect(page.getByText("Show the full available synopsis.")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("QA detail description.")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByPlaceholder("Search titles")).toHaveValue("Solo Leveling");

  await page.getByRole("link", { name: "Recs" }).click();
  await page.getByLabel("Base title").fill("Solo");
  await page.locator(".recommendation-pick").first().click();
  await expect(page.getByText("Most loved matches")).toBeVisible();
  await expect(page.getByTestId("title-card").first()).toBeVisible();

  await page.getByRole("link", { name: "Feeds" }).click();
  await expect(page.locator(".feed-cover-card").first()).toBeVisible();
  await expect(page.locator(".mosaic-cover").first()).toHaveCSS("aspect-ratio", "0.72 / 1");
});

test("home shell gestures, tabs, menu, and drawer stay usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Latest Listings" })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.getByRole("heading", { name: "Latest Listings" })).toBeVisible();

  await page.getByRole("button", { name: "Feed menu" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Feed Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  const activeBefore = (await page.locator(".feed-tab.active").innerText()).trim();
  await page.locator(".feed-scroll").first().evaluate((node) => {
    node.scrollTo({ top: 600, left: 0, behavior: "auto" });
  });
  await page.waitForTimeout(120);
  await expect(page.locator(".feed-tab.active")).toHaveText(activeBefore);

  await page.locator(".feed-pager").evaluate((node) => {
    node.scrollTo({ left: node.clientWidth, top: 0, behavior: "auto" });
  });
  await expect.poll(async () => (await page.locator(".feed-tab.active").innerText()).trim()).not.toBe(activeBefore);
  await expect
    .poll(async () => page.locator(".feed-scroll").nth(1).evaluate((node) => Math.round(node.scrollTop)))
    .toBe(0);

  const targetTab = page.locator(".feed-tab").nth(0);
  const targetName = (await targetTab.innerText()).trim();
  await targetTab.click();
  await expect(page.locator(".feed-tab.active")).toHaveText(targetName);
  const populatedTab = page.locator(".feed-tab").nth(1);
  const populatedName = (await populatedTab.innerText()).trim();
  await populatedTab.click();
  await expect(page.locator(".feed-tab.active")).toHaveText(populatedName);

  const activeScroll = page.locator('.feed-pane[aria-hidden="false"] .feed-scroll');
  await activeScroll.evaluate((node) => {
    node.scrollTo({ top: 700, left: 0, behavior: "auto" });
  });
  await page.waitForTimeout(80);
  await page.locator('.feed-pane[aria-hidden="false"] [data-testid="title-card"]').last().click();
  await expect(page.getByRole("heading", { name: /Solo Leveling|Latest Mock|High School|Scroll Test/ })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect
    .poll(async () => page.locator('.feed-pane[aria-hidden="false"] .feed-scroll').evaluate((node) => node.scrollTop > 0))
    .toBe(true);
});
