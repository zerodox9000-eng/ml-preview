import { expect, test, type Page } from "@playwright/test";
import { gzipSync } from "node:zlib";

async function mockBackendData(page: Page) {
  const gzipJson = (value: unknown) => gzipSync(Buffer.from(JSON.stringify(value)));
  const catalog = [
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
      tag_ids: [1],
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
      body: gzipJson({}),
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

test("mobile grid, folder, detail, search, and recommendation workflow works", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Build your first feed")).toBeVisible();
  await page.getByRole("button", { name: "Create feed" }).click();
  await page.getByLabel("Feed name").fill("QA Feed");
  await page.getByRole("button", { name: "Save feed" }).click();
  await expect(page.getByTestId("title-card").first()).toBeVisible();
  await expect(page.locator(".compact-metrics").first()).toContainText("Fan%");

  await page.getByRole("link", { name: "Search" }).click();
  const searchInput = page.getByPlaceholder("Search without keyboard collapse");
  await searchInput.fill("Solo Leveling");
  await expect(searchInput).toBeFocused();
  await expect(page.getByTestId("title-card").first()).toBeVisible();
  await expect(page.getByText(/Titles \(1\)/)).toBeVisible();

  await page.getByRole("link", { name: "Folders" }).click();
  await page.getByPlaceholder("Folder name").fill("Favorites");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("Favorites")).toBeVisible();

  await page.getByRole("link", { name: "Search" }).click();
  await page.getByPlaceholder("Search without keyboard collapse").fill("Solo Leveling");
  await page.getByTestId("title-card").first().click();
  await expect(page.getByRole("heading", { name: "Solo Leveling: Ragnarok" })).toBeVisible();
  await page.getByRole("button", { name: "Detail settings" }).click();
  await page.getByRole("button", { name: "description" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("QA detail description.")).toBeVisible();
  await expect(page.getByText("Fan%")).toBeVisible();
  await page.getByRole("button", { name: "Add to folder" }).click();

  await page.getByRole("link", { name: "Folders" }).click();
  await page.getByRole("link", { name: /Favorites/ }).click();
  await expect(page.getByText("1 manual titles")).toBeVisible();
  await expect(page.getByTestId("title-card").first()).toBeVisible();

  await page.getByRole("link", { name: "Recs" }).click();
  await page.getByLabel("Base title").fill("Solo");
  await page.getByRole("button", { name: /Solo Leveling: Ragnarok/ }).click();
  await expect(page.getByText("Most similar and loved")).toBeVisible();
  await expect(page.getByTestId("title-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Save as folder" }).first().click();
  await page.getByRole("link", { name: "Folders" }).click();
  await expect(page.getByText("Most similar and loved")).toBeVisible();
});
