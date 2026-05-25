import Fuse from "fuse.js";
import type {
  AppSettings,
  Feed,
  HistoryEntry,
  HistoryMap,
  QueryResult,
  SeriesCatalog,
  TagNode,
  UserLabel,
} from "./types";
import { isDateWithin, parseDate, resolveRollingWindow } from "./dates";

const SENSITIVE_MATCH = /\b(Boys Love|Girls Love|Smut|Hentai|Yaoi|Yuri|Shounen Ai|Shoujo Ai|Danmei|Bara)\b/i;

export function hasAniList(series: SeriesCatalog) {
  return Boolean(
    series.source?.anilist ||
      series.stats?.popularity != null ||
      series.stats?.favourites != null ||
      series.stats?.meanScore != null,
  );
}

export function chapterNumber(value: SeriesCatalog["total_chapters"]) {
  if (value == null) return null;
  const number = Number.parseFloat(String(value));
  return Number.isFinite(number) ? number : null;
}

export function buildSensitiveTagSet(tags: TagNode[]) {
  const sensitive = new Set<number>();
  const byParent = new Map<number, TagNode[]>();
  for (const tag of tags) {
    if (tag.parent_id != null) {
      const existing = byParent.get(tag.parent_id) ?? [];
      existing.push(tag);
      byParent.set(tag.parent_id, existing);
    }
  }

  const visit = (tag: TagNode) => {
    sensitive.add(tag.id);
    for (const child of byParent.get(tag.id) ?? []) visit(child);
  };

  for (const tag of tags) {
    if (SENSITIVE_MATCH.test(`${tag.name} ${tag.path}`)) visit(tag);
  }
  return sensitive;
}

export function tagRoot(tag: TagNode) {
  return tag.path?.split(" > ")[0] || "Other";
}

export function isGenreTag(tag: TagNode) {
  return tag.is_genre || tagRoot(tag) === "Genres";
}

export function buildFuse(items: SeriesCatalog[], tagsById: Map<number, TagNode>) {
  return new Fuse(items, {
    includeScore: true,
    threshold: 0.24,
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: [
      { name: "display_title", weight: 0.82 },
      { name: "authors", weight: 0.22 },
      { name: "artists", weight: 0.22 },
      {
        name: "tagText",
        weight: 0.16,
        getFn: (series) =>
          (series as SeriesCatalog).tag_ids
            ?.map((id) => tagsById.get(id)?.name)
            .filter(Boolean)
            .join(" ") ?? "",
      },
    ],
  });
}

export function labelMatchesSeries(label: UserLabel, item: SeriesCatalog) {
  if (label.manualTitleIds.includes(item.id)) return true;
  const rule = label.rule;
  if (!rule) return false;
  if (rule.minMeanScore != null && (item.stats.meanScore == null || item.stats.meanScore < rule.minMeanScore)) return false;
  if (rule.minPopularity != null && (item.stats.popularity == null || item.stats.popularity < rule.minPopularity)) return false;
  if (rule.minFavourites != null && (item.stats.favourites == null || item.stats.favourites < rule.minFavourites)) return false;
  if (rule.includeTagIds?.length && !rule.includeTagIds.every((tagId) => item.tag_ids.includes(tagId))) return false;
  return true;
}

function metricValue(series: SeriesCatalog, metric: string, history: HistoryMap, latestDate?: string | null) {
  const stats = series.stats ?? {};
  const analytics = series.analytics ?? {};
  if (metric === "title") return series.display_title.toLocaleLowerCase();
  if (metric === "year") return series.year ?? -Infinity;
  if (metric === "chapters") return chapterNumber(series.total_chapters) ?? -Infinity;
  if (metric === "popularity") return stats.popularity ?? -Infinity;
  if (metric === "favourites") return stats.favourites ?? -Infinity;
  if (metric === "meanScore") return stats.meanScore ?? -Infinity;
  if (metric === "fanFavouriteRaw") return analytics.fanFavouriteRaw ?? -Infinity;
  if (metric === "fanRatioPercentile") return analytics.fanRatioPercentile ?? -Infinity;
  if (metric === "popularityPercentile") return analytics.popularityPercentile ?? -Infinity;
  if (metric === "fanFavouriteDiscoveryScore") return analytics.fanFavouriteDiscoveryScore ?? -Infinity;
  if (metric === "fanFavouriteDiscoveryPercentile") return analytics.fanFavouriteDiscoveryPercentile ?? -Infinity;
  if (metric === "releaseDate") return parseDate(series.published?.start_date)?.getTime() ?? -Infinity;
  if (metric === "endDate") return parseDate(series.published?.end_date)?.getTime() ?? -Infinity;

  const entries = history[String(series.id)] ?? [];
  const latest = latestDate ? closestHistory(entries, latestDate, "before") : entries.at(-1);
  const earliest = entries[0];
  if (!latest || !earliest) return -Infinity;

  const delta = (a: number | null | undefined, b: number | null | undefined) =>
    a == null || b == null ? -Infinity : a - b;
  const percent = (a: number | null | undefined, b: number | null | undefined) =>
    a == null || b == null || b === 0 ? -Infinity : ((a - b) / b) * 100;

  if (metric === "popularityGrowth") return delta(latest.p, earliest.p);
  if (metric === "popularityGrowthPercent") return percent(latest.p, earliest.p);
  if (metric === "favouritesGrowth") return delta(latest.f, earliest.f);
  if (metric === "favouritesGrowthPercent") return percent(latest.f, earliest.f);
  if (metric === "meanScoreDelta") return delta(latest.s, earliest.s);
  if (metric === "fanFavouriteDelta") return delta(latest.r, earliest.r);
  if (metric === "discoveryScoreDelta") return delta(latest.ds, earliest.ds);
  if (metric === "discoveryPercentileDelta") return delta(latest.dp, earliest.dp);
  return -Infinity;
}

function closestHistory(entries: HistoryEntry[], targetDate: string, direction: "before" | "after") {
  const filtered = entries.filter((entry) =>
    direction === "before" ? entry.d <= targetDate : entry.d >= targetDate,
  );
  return direction === "before" ? filtered.at(-1) : filtered[0];
}

function historyDeltaForWindow(seriesId: number, metric: string, history: HistoryMap, from: string, to: string) {
  const entries = history[String(seriesId)] ?? [];
  const start = closestHistory(entries, from, "after");
  const end = closestHistory(entries, to, "before");
  if (!start || !end) return null;
  const read = (entry: HistoryEntry) => {
    if (metric.includes("popularity")) return entry.p;
    if (metric.includes("favourites")) return entry.f;
    if (metric.includes("meanScore")) return entry.s;
    if (metric.includes("fanFavourite")) return entry.r;
    if (metric.includes("discoveryPercentile")) return entry.dp;
    if (metric.includes("discoveryScore")) return entry.ds;
    return null;
  };
  const a = read(start);
  const b = read(end);
  if (a == null || b == null) return null;
  if (metric.includes("Percent") && a !== 0) return ((b - a) / a) * 100;
  return b - a;
}

export function runFeedQuery(args: {
  feed: Feed;
  series: SeriesCatalog[];
  tags: TagNode[];
  history: HistoryMap;
  labels: UserLabel[];
  settings: AppSettings;
  metaHistoryFirst?: string | null;
  metaHistoryLast?: string | null;
}): QueryResult {
  const { feed, series, tags, history, labels, settings, metaHistoryFirst, metaHistoryLast } = args;
  const filters = feed.filters;
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  const sensitiveTagIds = buildSensitiveTagSet(tags);
  const activeNotes: string[] = [];
  let limitedHistory = false;
  let missingDateData = false;
  let candidates = series;

  if (filters.query.trim()) {
    const q = filters.query.trim().toLocaleLowerCase();
    const exactMatches = series.filter((item) => {
      const tagText = item.tag_ids
        .map((id) => tagsById.get(id)?.name)
        .filter(Boolean)
        .join(" ");
      return `${item.display_title} ${(item.authors ?? []).join(" ")} ${(item.artists ?? []).join(" ")} ${tagText}`
        .toLocaleLowerCase()
        .includes(q);
    });
    if (exactMatches.length > 0) {
      candidates = exactMatches;
    } else {
    const fuse = buildFuse(series, tagsById);
    candidates = fuse.search(filters.query.trim()).map((result) => result.item);
    }
  }

  const window = resolveRollingWindow(filters.rolling, metaHistoryLast);
  if (window && metaHistoryFirst && window.from < metaHistoryFirst) {
    limitedHistory = true;
    activeNotes.push(`History is currently available from ${metaHistoryFirst} to ${metaHistoryLast}.`);
  }

  const result = candidates.filter((item) => {
    const rating = item.content_rating as AppSettings["contentRatings"][number] | null;
    if (rating && !filters.contentRatings.includes(rating)) return false;
    if (!settings.adultUnlocked && item.tag_ids.some((id) => sensitiveTagIds.has(id))) return false;

    const ani = hasAniList(item);
    if (filters.sourceMode === "anilist" && !ani) return false;
    if (filters.sourceMode === "non-anilist" && ani) return false;

    if (filters.statuses.length > 0 && (!item.status || !filters.statuses.includes(item.status))) return false;
    if (filters.minYear != null && (item.year == null || item.year < filters.minYear)) return false;
    if (filters.maxYear != null && (item.year == null || item.year > filters.maxYear)) return false;

    const chapters = chapterNumber(item.total_chapters);
    if (filters.minChapters != null && (chapters == null || chapters < filters.minChapters)) return false;
    if (filters.maxChapters != null && (chapters == null || chapters > filters.maxChapters)) return false;

    if (filters.minPopularity != null && (item.stats.popularity == null || item.stats.popularity < filters.minPopularity)) return false;
    if (filters.maxPopularity != null && (item.stats.popularity == null || item.stats.popularity > filters.maxPopularity)) return false;
    if (filters.minFavourites != null && (item.stats.favourites == null || item.stats.favourites < filters.minFavourites)) return false;
    if (filters.maxFavourites != null && (item.stats.favourites == null || item.stats.favourites > filters.maxFavourites)) return false;
    if (filters.minMeanScore != null && (item.stats.meanScore == null || item.stats.meanScore < filters.minMeanScore)) return false;
    if (filters.maxMeanScore != null && (item.stats.meanScore == null || item.stats.meanScore > filters.maxMeanScore)) return false;

    if (filters.includeTagIds.length > 0) {
      const hasTag = (id: number) => item.tag_ids.includes(id);
      const ok = filters.tagMatch === "all" ? filters.includeTagIds.every(hasTag) : filters.includeTagIds.some(hasTag);
      if (!ok) return false;
    }
    if (filters.excludeTagIds.some((id) => item.tag_ids.includes(id))) return false;

    if (filters.labelIds.length > 0) {
      const matchingLabels = labels.filter((label) => filters.labelIds.includes(label.id));
      const itemLabelIds = matchingLabels.filter((label) => labelMatchesSeries(label, item)).map((label) => label.id);
      if (itemLabelIds.length === 0) return false;
    }

    if (window && filters.dateField !== "none") {
      const dateValue = filters.dateField === "release" ? item.published?.start_date : item.published?.end_date;
      if (!dateValue) {
        missingDateData = true;
        return false;
      }
      if (!isDateWithin(dateValue, window.from, window.to)) return false;
    }

    return true;
  });

  const sorted = [...result].sort((a, b) => {
    const aAni = hasAniList(a);
    const bAni = hasAniList(b);
    if (filters.sourceMode === "mixed" && aAni !== bAni && settings.nonAniListPlacement !== "mixed") {
      return settings.nonAniListPlacement === "top" ? (aAni ? 1 : -1) : aAni ? -1 : 1;
    }

    for (const rule of feed.sort) {
      let av = metricValue(a, rule.metric, history, metaHistoryLast);
      let bv = metricValue(b, rule.metric, history, metaHistoryLast);
      if (window && rule.metric.includes("Growth")) {
        av = historyDeltaForWindow(a.id, rule.metric, history, window.from, window.to) ?? av;
        bv = historyDeltaForWindow(b.id, rule.metric, history, window.from, window.to) ?? bv;
      }
      if (av === bv) continue;
      const direction = rule.direction === "asc" ? 1 : -1;
      return av > bv ? direction : -direction;
    }
    return a.display_title.localeCompare(b.display_title);
  });

  return {
    items: sorted,
    limitedHistory,
    missingDateData,
    activeNotes,
  };
}
