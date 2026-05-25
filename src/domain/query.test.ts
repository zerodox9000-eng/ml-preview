import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, createFeed } from "./defaults";
import { runFeedQuery } from "./query";
import type { HistoryMap, SeriesCatalog, TagNode } from "./types";

const tags: TagNode[] = [
  { id: 1, name: "Action", path: "Genres > Action", is_genre: true, parent_id: null, level: 1 },
  { id: 2, name: "Hentai", path: "Sexual Content > Intensity > Hentai", is_genre: true, parent_id: null, level: 2 },
  { id: 3, name: "Fantasy", path: "Themes > Fantasy", is_genre: true, parent_id: null, level: 2 },
];

const baseSeries: SeriesCatalog[] = [
  {
    id: 1,
    display_title: "A Clean Action",
    cover: null,
    year: 2024,
    status: "releasing",
    content_rating: "safe",
    total_chapters: "20",
    tag_ids: [1],
    stats: { popularity: 100, favourites: 10, meanScore: 80 },
    analytics: { fanFavouriteRaw: 10, fanFavouriteDiscoveryScore: 90 },
    published: { start_date: "2024-05-01", end_date: null },
  },
  {
    id: 2,
    display_title: "Sensitive Fantasy",
    cover: null,
    year: 2024,
    status: "completed",
    content_rating: "safe",
    total_chapters: "40",
    tag_ids: [2, 3],
    stats: { popularity: 200, favourites: 20, meanScore: 70 },
    analytics: { fanFavouriteRaw: 10, fanFavouriteDiscoveryScore: 80 },
    published: { start_date: "2024-05-03", end_date: "2024-05-10" },
  },
  {
    id: 3,
    display_title: "No AniList",
    cover: null,
    year: 2024,
    status: "completed",
    content_rating: "safe",
    total_chapters: "8",
    tag_ids: [1],
    stats: { popularity: null, favourites: null, meanScore: null },
    analytics: {},
    published: { start_date: "2024-05-04", end_date: "2024-05-11" },
  },
];

const history: HistoryMap = {
  "1": [
    { d: "2024-05-01", p: 10, f: 1, s: 80, r: 10, rp: 1, pp: 1, ds: 20, dp: 1 },
    { d: "2024-05-10", p: 100, f: 10, s: 80, r: 10, rp: 1, pp: 1, ds: 90, dp: 1 },
  ],
  "2": [
    { d: "2024-05-01", p: 190, f: 19, s: 70, r: 10, rp: 1, pp: 1, ds: 70, dp: 1 },
    { d: "2024-05-10", p: 200, f: 20, s: 70, r: 10, rp: 1, pp: 1, ds: 80, dp: 1 },
  ],
};

describe("runFeedQuery", () => {
  it("hides sensitive tags unless adult content is unlocked", () => {
    const feed = createFeed("safe");
    feed.filters.sourceMode = "mixed";
    const result = runFeedQuery({
      feed,
      series: baseSeries,
      tags,
      history,
      labels: [],
      settings: DEFAULT_SETTINGS,
      metaHistoryFirst: "2024-05-01",
      metaHistoryLast: "2024-05-10",
    });
    expect(result.items.map((item) => item.id)).toEqual([1, 3]);
  });

  it("segments non-AniList titles by source mode", () => {
    const feed = createFeed("non anilist");
    feed.filters.sourceMode = "non-anilist";
    const result = runFeedQuery({
      feed,
      series: baseSeries,
      tags,
      history,
      labels: [],
      settings: { ...DEFAULT_SETTINGS, adultUnlocked: true, nonAniListPlacement: "mixed" },
      metaHistoryFirst: "2024-05-01",
      metaHistoryLast: "2024-05-10",
    });
    expect(result.items.map((item) => item.id)).toEqual([3]);
  });

  it("sorts by rolling growth inside available history", () => {
    const feed = createFeed("growth");
    feed.filters.sourceMode = "anilist";
    feed.filters.rolling = { mode: "fixed", amount: 1, unit: "days", from: "2024-05-01", to: "2024-05-10" };
    feed.sort = [{ id: "growth", metric: "popularityGrowth", direction: "desc" }];
    const result = runFeedQuery({
      feed,
      series: baseSeries,
      tags,
      history,
      labels: [],
      settings: { ...DEFAULT_SETTINGS, adultUnlocked: true, nonAniListPlacement: "mixed" },
      metaHistoryFirst: "2024-05-01",
      metaHistoryLast: "2024-05-10",
    });
    expect(result.items[0].id).toBe(1);
  });

  it("sorts by release date when query index dates are present", () => {
    const feed = createFeed("release");
    feed.filters.sourceMode = "mixed";
    feed.sort = [{ id: "release", metric: "releaseDate", direction: "desc" }];
    const result = runFeedQuery({
      feed,
      series: baseSeries,
      tags,
      history,
      labels: [],
      settings: { ...DEFAULT_SETTINGS, adultUnlocked: true, nonAniListPlacement: "mixed" },
      metaHistoryFirst: "2024-05-01",
      metaHistoryLast: "2024-05-10",
    });
    expect(result.items.map((item) => item.id)).toEqual([3, 2, 1]);
  });
});
