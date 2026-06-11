import { metricValue } from "./metrics";
import { isGenreTag, tagRoot } from "./query";
import type { HistoryMap, MetricId, RecommendationFeature, RecommendationShelf, SeriesCatalog, TagNode } from "./types";

interface ScoredRecommendation {
  item: SeriesCatalog;
  finalScore: number;
  profileScore: number;
  textScore: number;
  tagScore: number;
  qualityScore: number;
  sharedPrimaryAnchors: number;
}

const PROFILE_WEIGHTS: Record<string, number> = {
  "business-career-regression": 5.6,
  "corporate-workplace": 3.4,
  "korean-business": 2.7,
  "business-career": 2.4,
  "regression-return": 2.4,
  "modern-workplace": 2,
  "modern-korea": 1.6,
  "horror-survival": 5.2,
  "murim-wuxia": 5.2,
  "game-system": 4.6,
  "euro-fantasy": 4.1,
  "medical-career": 4.2,
  "showbiz-career": 3.4,
  "sports-career": 3.8,
  "food-career": 3.4,
  "office-romance": 3.2,
  "romance-core": 1.2,
  "school-life": 1.2,
};

const PRIMARY_PROFILE_GROUPS = new Set([
  "business-career-regression",
  "corporate-workplace",
  "korean-business",
  "horror-survival",
  "murim-wuxia",
  "game-system",
  "euro-fantasy",
  "medical-career",
  "showbiz-career",
  "sports-career",
  "food-career",
  "office-romance",
]);

const WORLD_PROFILE_GROUPS = new Set([
  "horror-survival",
  "murim-wuxia",
  "game-system",
  "euro-fantasy",
  "medical-career",
  "showbiz-career",
  "food-career",
]);

const TEXT_STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "and",
  "back",
  "been",
  "but",
  "for",
  "from",
  "has",
  "have",
  "her",
  "him",
  "his",
  "into",
  "life",
  "manhwa",
  "new",
  "not",
  "one",
  "source",
  "that",
  "the",
  "their",
  "them",
  "then",
  "this",
  "with",
  "world",
]);

function normalizeText(value: string) {
  return value
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function featureTermText(series: SeriesCatalog) {
  return normalizeText(
    [
      series.display_title,
      series.mangabaka_title,
      series.native_title,
      series.romanized_title,
      ...(series.authors ?? []),
      ...(series.artists ?? []),
    ].join(" "),
  );
}

function hasText(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function tagText(tag: TagNode) {
  return `${tag.name} ${tag.path}`.toLowerCase();
}

function addFeature(features: Record<string, number>, key: string, value: number) {
  features[key] = Number(((features[key] ?? 0) + value).toFixed(4));
}

function fallbackTagWeight(tag: TagNode) {
  const root = tagRoot(tag);
  const name = tag.name.trim().toLowerCase();
  const level = Math.max(tag.level ?? 1, 1);

  if (root === "Work Info") return 0.05;
  if (root === "Derivative Work") return 0.08;
  if (root === "Audience Demographics") return 0.15;
  if (root === "Sexual Content") return 0.1;
  if (root === "Character Traits") return 0.18 / Math.sqrt(level);
  if (root === "Character Types") {
    if (/(male lead|female lead|protagonist|cast)$/.test(name)) return 0.16;
    return 0.44 / Math.sqrt(level);
  }
  if (root === "Settings") {
    if (name === "fantasy" || name === "supernatural" || name === "sci-fi") return 0.4;
    return 0.9 / Math.sqrt(level);
  }
  if (root === "Themes") {
    if (name === "drama" || name === "romance" || name === "comedy" || name === "slice of life") return 0.26;
    if (isGenreTag(tag)) return 1.5 / Math.sqrt(level);
    return 1.1 / Math.sqrt(level);
  }
  if (root === "Occupations" || root === "Activities") return 1.35 / Math.sqrt(level);
  if (root === "Locations") return 1 / Math.sqrt(level);
  if (root === "Narrative Tropes" || root === "World Building") return 1.15 / Math.sqrt(level);
  return isGenreTag(tag) ? 1 : 0.7 / Math.sqrt(level);
}

export function buildFallbackRecommendationFeature(series: SeriesCatalog, tagsById: Map<number, TagNode>): RecommendationFeature {
  const text = `${featureTermText(series)} ${(series.tag_ids ?? []).map((id) => tagsById.get(id)).filter(Boolean).map((tag) => tagText(tag!)).join(" ")}`;
  const profileGroups = new Set<string>();

  if (hasText(text, /business|economics|merchant|company|corporate|conglomerate|ceo|director|office|employee|workplace|career|trading|hostile takeover|politic|revenge|betrayal|murder|smart protagonist/)) profileGroups.add("business-career");
  if (hasText(text, /regression|regressed|return|returned|reborn|reincarnation|second chance|time rewind|time travel|time manipulation|age regression|back in time/)) profileGroups.add("regression-return");
  if (hasText(text, /south korea|korean|seoul|chaebol|kdrama|naver|kakao|webtoon/)) profileGroups.add("modern-korea");
  if (hasText(text, /working|office|company|ceo|director|secretary|coworker|employee|career|manager/)) profileGroups.add("modern-workplace");
  if (hasText(text, /romance|marriage|pregnancy|dating|couple|wife|husband|fiance|one-night stand|love triangle|male lead falls in love|mature romance/)) profileGroups.add("romance-core");
  if (hasText(text, /horror|gore|ghost|zombie|death game|survival horror|psychological horror/)) profileGroups.add("horror-survival");
  if (hasText(text, /murim|wuxia|martial arts|cultivation|sect|swordplay|martial artist|swordsman|ancient china|chinese ambience|chinese mythology/)) profileGroups.add("murim-wuxia");
  if (hasText(text, /dungeon|tower|hunter|ranker|level system|game system|guild|virtual reality|game world|rpg/)) profileGroups.add("game-system");
  if (hasText(text, /european ambience|medieval|nobility|royalty|duke|prince|princess|emperor|villainess|castle|kingdom/)) profileGroups.add("euro-fantasy");
  if (hasText(text, /doctor|medical|hospital|surgeon|nurse|clinic|patient/)) profileGroups.add("medical-career");
  if (hasText(text, /actor|actress|idol|celebrity|showbiz|entertainment industry|manager/)) profileGroups.add("showbiz-career");
  if (hasText(text, /boxing|sports|baseball|basketball|football|tennis|golf|wrestling|athletics|racing/)) profileGroups.add("sports-career");
  if (profileGroups.has("business-career") && profileGroups.has("regression-return")) profileGroups.add("business-career-regression");
  if (profileGroups.has("business-career") && profileGroups.has("modern-workplace")) profileGroups.add("corporate-workplace");
  if (profileGroups.has("business-career") && profileGroups.has("modern-korea")) profileGroups.add("korean-business");
  if (profileGroups.has("romance-core") && profileGroups.has("modern-workplace")) profileGroups.add("office-romance");

  const tagFeatures: Record<string, number> = {};
  for (const tagId of series.tag_ids ?? []) {
    const tag = tagsById.get(tagId);
    if (!tag) continue;
    const weight = fallbackTagWeight(tag);
    addFeature(tagFeatures, `tag:${tagId}`, weight);
    if (tag.parent_id != null) addFeature(tagFeatures, `parent:${tag.parent_id}`, weight * 0.22);
    const root = tagRoot(tag);
    if (root) addFeature(tagFeatures, `root:${root}`, Math.min(0.12, weight * 0.08));
  }

  const textFeatures: Record<string, number> = {};
  for (const token of featureTermText(series).split(" ")) {
    if (token.length >= 3 && !TEXT_STOPWORDS.has(token)) addFeature(textFeatures, token, 1);
  }

  return {
    id: series.id,
    profileGroups: [...profileGroups].sort(),
    primaryAnchors: [...profileGroups].filter((group) => PRIMARY_PROFILE_GROUPS.has(group)).sort(),
    tagFeatures,
    textFeatures,
    quality: {
      discPct: series.analytics?.fanFavouriteDiscoveryPercentile ?? null,
      fanPct: series.analytics?.fanFavouriteRaw ?? null,
      popularity: series.stats?.popularity ?? null,
    },
  };
}

function weightedOverlap(baseGroups: string[], candidateGroups: string[]) {
  const candidate = new Set(candidateGroups);
  let matched = 0;
  let total = 0;
  for (const group of baseGroups) {
    const weight = PROFILE_WEIGHTS[group] ?? 1;
    total += weight;
    if (candidate.has(group)) matched += weight;
  }
  return total > 0 ? matched / total : 0;
}

function cosine(left: Record<string, number>, right: Record<string, number>) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const value of Object.values(left)) leftNorm += value * value;
  for (const value of Object.values(right)) rightNorm += value * value;
  for (const [key, value] of Object.entries(left)) dot += value * (right[key] ?? 0);
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function groupSet(feature: RecommendationFeature) {
  return new Set(feature.profileGroups);
}

function anchorSet(feature: RecommendationFeature) {
  return new Set(feature.primaryAnchors);
}

function sharedCount(left: Set<string>, right: Set<string>) {
  let count = 0;
  for (const value of left) if (right.has(value)) count += 1;
  return count;
}

function hasAny(groups: Set<string>, values: string[]) {
  return values.some((value) => groups.has(value));
}

function compatibleProfiles(base: RecommendationFeature, candidate: RecommendationFeature) {
  const baseGroups = groupSet(base);
  const candidateGroups = groupSet(candidate);
  const baseAnchors = anchorSet(base);
  const candidateAnchors = anchorSet(candidate);
  const sharedAnchors = sharedCount(baseAnchors, candidateAnchors);

  if (baseAnchors.size > 0 && sharedAnchors === 0) return false;

  for (const group of WORLD_PROFILE_GROUPS) {
    if (baseGroups.has(group) && !candidateGroups.has(group)) return false;
  }

  if (baseGroups.has("business-career-regression")) {
    if (!candidateGroups.has("business-career-regression") && !candidateGroups.has("corporate-workplace")) return false;
    if (candidateGroups.has("office-romance") && !candidateGroups.has("business-career-regression")) return false;
    if (hasAny(candidateGroups, ["murim-wuxia", "game-system", "euro-fantasy", "horror-survival"]) && !candidateGroups.has("business-career-regression")) return false;
  }

  if (baseGroups.has("office-romance") && hasAny(candidateGroups, ["murim-wuxia", "game-system", "horror-survival"])) return false;
  if (baseGroups.has("horror-survival") && candidateGroups.has("romance-core") && !candidateGroups.has("horror-survival")) return false;
  if (baseGroups.has("murim-wuxia") && !candidateGroups.has("murim-wuxia")) return false;
  if (baseGroups.has("game-system") && !candidateGroups.has("game-system")) return false;

  return true;
}

function qualityScore(feature: RecommendationFeature) {
  const disc = feature.quality.discPct == null ? 0 : Math.min(1, Math.max(0, feature.quality.discPct / 100));
  const fan = feature.quality.fanPct == null ? 0 : Math.min(1, Math.max(0, feature.quality.fanPct / 12));
  const popularity = feature.quality.popularity == null ? 0 : Math.min(1, Math.log10(feature.quality.popularity + 1) / 5);
  return disc * 0.65 + fan * 0.2 + popularity * 0.15;
}

export function scoreRecommendation(base: RecommendationFeature, candidate: RecommendationFeature) {
  if (!compatibleProfiles(base, candidate)) return null;
  const profileScore = weightedOverlap(base.profileGroups, candidate.profileGroups);
  const tagScore = cosine(base.tagFeatures, candidate.tagFeatures);
  const textScore = cosine(base.textFeatures, candidate.textFeatures);
  const qScore = qualityScore(candidate);
  const sharedPrimaryAnchors = sharedCount(anchorSet(base), anchorSet(candidate));

  const finalScore =
    profileScore * 0.35 +
    tagScore * 0.3 +
    textScore * 0.25 +
    qScore * 0.1 +
    Math.min(sharedPrimaryAnchors, 3) * 0.04;

  if (finalScore < 0.08) return null;
  return {
    finalScore,
    profileScore,
    textScore,
    tagScore,
    qualityScore: qScore,
    sharedPrimaryAnchors,
  };
}

export function rankRecommendations(args: {
  base: SeriesCatalog;
  candidates: SeriesCatalog[];
  tags: TagNode[];
  features: RecommendationFeature[];
  shelf: RecommendationShelf;
  history: HistoryMap;
  latestDate?: string | null;
}) {
  const { base, candidates, tags, features, shelf, history, latestDate } = args;
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  const featuresById = new Map(features.map((feature) => [feature.id, feature]));
  const baseFeature = featuresById.get(base.id) ?? buildFallbackRecommendationFeature(base, tagsById);

  return candidates
    .map((item): ScoredRecommendation | null => {
      const candidateFeature = featuresById.get(item.id) ?? buildFallbackRecommendationFeature(item, tagsById);
      const score = scoreRecommendation(baseFeature, candidateFeature);
      return score ? { item, ...score } : null;
    })
    .filter((item): item is ScoredRecommendation => Boolean(item))
    .sort((a, b) => {
      if (Math.abs(a.finalScore - b.finalScore) > 0.0001) return b.finalScore - a.finalScore;
      if (Math.abs(a.profileScore - b.profileScore) > 0.0001) return b.profileScore - a.profileScore;
      if (Math.abs(a.textScore - b.textScore) > 0.0001) return b.textScore - a.textScore;
      if (Math.abs(a.tagScore - b.tagScore) > 0.0001) return b.tagScore - a.tagScore;
      for (const rule of shelf.sort) {
        const av = metricValue(a.item, rule.metric as MetricId, history, latestDate);
        const bv = metricValue(b.item, rule.metric as MetricId, history, latestDate);
        const aMissing = typeof av !== "string" && (av === -Infinity || av == null || Number.isNaN(Number(av)));
        const bMissing = typeof bv !== "string" && (bv === -Infinity || bv == null || Number.isNaN(Number(bv)));
        if (aMissing || bMissing) {
          if (aMissing && bMissing) continue;
          return aMissing ? 1 : -1;
        }
        if (av === bv) continue;
        const direction = rule.direction === "asc" ? 1 : -1;
        return av > bv ? direction : -direction;
      }
      if (Math.abs(a.qualityScore - b.qualityScore) > 0.0001) return b.qualityScore - a.qualityScore;
      return a.item.display_title.localeCompare(b.item.display_title);
    })
    .map(({ item }) => item);
}
