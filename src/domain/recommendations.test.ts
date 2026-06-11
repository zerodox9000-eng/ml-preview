import { describe, expect, it } from "vitest";
import { rankRecommendations } from "./recommendations";
import type { RecommendationFeature, SeriesCatalog } from "./types";

function series(id: number, title: string): SeriesCatalog {
  return {
    id,
    display_title: title,
    cover: null,
    year: 2024,
    status: "releasing",
    content_rating: "safe",
    total_chapters: "40",
    tag_ids: [],
    stats: { popularity: 5000, favourites: 200, meanScore: 75 },
    analytics: { fanFavouriteDiscoveryPercentile: 80, fanFavouriteRaw: 4 },
    published: { start_date: "2024-01-01", end_date: null },
  };
}

function feature(
  id: number,
  profileGroups: string[],
  textFeatures: Record<string, number>,
  discPct = 80,
): RecommendationFeature {
  return {
    id,
    profileGroups,
    primaryAnchors: profileGroups.filter((group) =>
      [
        "business-career-regression",
        "corporate-workplace",
        "korean-business",
        "office-romance",
        "game-system",
        "murim-wuxia",
      ].includes(group),
    ),
    tagFeatures: Object.fromEntries(profileGroups.map((group) => [`profile:${group}`, 1])),
    textFeatures,
    quality: {
      discPct,
      fanPct: 4,
      popularity: 5000,
    },
  };
}

const shelf = {
  id: "similar-loved",
  name: "Most loved matches",
  statusMode: "any" as const,
  dateMode: "any" as const,
  sourceModes: ["anilist" as const],
  sort: [{ id: "disc", metric: "fanFavouriteDiscoveryPercentile" as const, direction: "desc" as const }],
  metricRanges: [],
};

const titles = [
  series(189, "Reborn Rich"),
  series(45119, "A Man's Man"),
  series(67834, "Sinip Sawon Kim Cheolsu"),
  series(49377, "Return of the Mad Demon"),
  series(1451, "SSS-Class Revival Hunter"),
  series(41002, "Positively Yours"),
  series(3671, "Daytime Star"),
];

const features = [
  feature(
    189,
    ["business-career-regression", "corporate-workplace", "korean-business", "business-career", "regression-return", "modern-workplace", "modern-korea"],
    { corporate: 3, business: 2, conglomerate: 3, betrayal: 2, revenge: 2, employee: 2, takeover: 3, regression: 2 },
    89,
  ),
  feature(
    45119,
    ["business-career-regression", "corporate-workplace", "korean-business", "business-career", "regression-return", "modern-workplace", "modern-korea", "sports-career"],
    { company: 3, ceo: 3, career: 3, employee: 2, corporate: 2, workplace: 2, regression: 2, past: 2 },
    95,
  ),
  feature(
    67834,
    ["business-career-regression", "corporate-workplace", "korean-business", "business-career", "regression-return", "modern-workplace", "modern-korea"],
    { company: 3, employee: 3, trading: 2, ceo: 3, career: 3, success: 2, regression: 2, workplace: 2 },
    47,
  ),
  feature(
    49377,
    ["murim-wuxia", "regression-return"],
    { murim: 3, martial: 3, sect: 2, sword: 2, revenge: 1, regression: 1 },
    99,
  ),
  feature(
    1451,
    ["game-system", "regression-return"],
    { dungeon: 3, hunter: 3, level: 2, tower: 2, game: 2, regression: 1 },
    100,
  ),
  feature(
    41002,
    ["office-romance", "romance-core", "modern-workplace", "modern-korea"],
    { romance: 3, pregnancy: 3, ceo: 1, workplace: 1, dating: 2, marriage: 2 },
    96,
  ),
  feature(
    3671,
    ["office-romance", "romance-core", "modern-workplace", "showbiz-career", "modern-korea"],
    { romance: 3, celebrity: 2, office: 1, love: 2, dating: 2 },
    98,
  ),
];

function rankedIds(baseId: number) {
  const base = titles.find((item) => item.id === baseId)!;
  return rankRecommendations({
    base,
    candidates: titles.filter((item) => item.id !== baseId),
    tags: [],
    features,
    shelf,
    history: {},
    latestDate: null,
  }).map((item) => item.id);
}

function expectPreferredOver(ranked: number[], preferred: number, bad: number) {
  const preferredIndex = ranked.indexOf(preferred);
  const badIndex = ranked.indexOf(bad);
  expect(preferredIndex).toBeGreaterThanOrEqual(0);
  if (badIndex >= 0) expect(preferredIndex).toBeLessThan(badIndex);
}

describe("rankRecommendations", () => {
  it("keeps the business career regression golden cluster at the top", () => {
    for (const baseId of [189, 45119, 67834]) {
      const ranked = rankedIds(baseId);
      const cluster = [189, 45119, 67834].filter((id) => id !== baseId);
      for (const expectedId of cluster) {
        expect(ranked.indexOf(expectedId)).toBeGreaterThanOrEqual(0);
        expect(ranked.indexOf(expectedId)).toBeLessThan(5);
      }
    }
  });

  it("does not let high quality murim, game, or pure romance titles outrank the business cluster", () => {
    const ranked = rankedIds(189);
    expectPreferredOver(ranked, 45119, 49377);
    expectPreferredOver(ranked, 67834, 1451);
    expectPreferredOver(ranked, 45119, 41002);
  });
});
