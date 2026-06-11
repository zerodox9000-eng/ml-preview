import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const backend = path.join(process.env.TEMP, "manhwa_db_export", "db", "exports", "frontend");
const all = JSON.parse(fs.readFileSync(path.join(backend, "series", "all.json"), "utf8"));
const detailDir = path.join(backend, "details");
const byId = new Map(all.map((item) => [item.id, item]));
const output = [];

for (const file of fs.readdirSync(detailDir)) {
  if (!file.endsWith(".json")) continue;
  const detail = JSON.parse(fs.readFileSync(path.join(detailDir, file), "utf8"));
  const base = byId.get(detail.id) ?? {};
  const links = { ...(detail.links ?? {}) };
  links.mangabaka = `https://mangabaka.org/${detail.id}`;
  output.push({
    ...base,
    id: detail.id,
    display_title: detail.display_title,
    cover: detail.cover ?? base.cover ?? null,
    year: detail.year ?? base.year ?? null,
    status: detail.status ?? base.status ?? null,
    content_rating: detail.content_rating ?? base.content_rating ?? null,
    total_chapters: detail.total_chapters ?? base.total_chapters ?? null,
    tag_ids: detail.tag_ids ?? base.tag_ids ?? [],
    stats: detail.stats ?? base.stats ?? { popularity: null, favourites: null, meanScore: null },
    analytics: detail.analytics ?? base.analytics ?? {},
    published: detail.published ?? null,
    first_seen_at: detail.first_seen_at ?? base.first_seen_at ?? null,
    first_seen_at_is_trusted: detail.first_seen_at_is_trusted ?? base.first_seen_at_is_trusted ?? false,
    last_updated_at: detail.last_updated_at ?? base.last_updated_at ?? null,
    mangabaka_latest_rank: detail.mangabaka_latest_rank ?? base.mangabaka_latest_rank ?? null,
    mangabaka_latest_snapshot_at: detail.mangabaka_latest_snapshot_at ?? base.mangabaka_latest_snapshot_at ?? null,
    authors: detail.authors ?? [],
    artists: detail.artists ?? [],
    links,
    source: detail.source ?? null,
  });
}

output.sort((a, b) => a.id - b.id);
const json = JSON.stringify(output);
fs.writeFileSync("public/data/query-index.json.gz", zlib.gzipSync(json, { level: 9 }));
fs.writeFileSync(
  "public/data/query-index-meta.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), totalSeries: output.length }, null, 2),
);
console.log(`Generated ${output.length} query-index records (${Buffer.byteLength(json)} bytes json).`);
