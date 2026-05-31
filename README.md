# Manhwa Lib

Mobile-first local PWA for building custom manhwa discovery grids from the `zerodox9000-eng/manhwa_db` frontend exports.

## Live App

[Open Manhwa Lib on GitHub Pages](https://zerodox9000-eng.github.io/Manhwa_pwa/)

## What Is Implemented

- GitHub Pages-ready Vite + React + TypeScript PWA with install metadata, rounded app icons, and offline shell caching.
- Live-first data sync from the backend export, then local enriched query-index data is merged in for dates, links, authors, and extra search fields.
- Smart offline sync into IndexedDB for catalog, tags, history, settings, feeds, folders, recommendations, and opened details.
- Grid-only UI across home, feeds, folders, search, recommendation shelves, and details.
- Feed builder with AniList/non-AniList source toggles, content ratings, chapter/year/all-metric min/max ranges, hierarchical tag include/exclude, rolling windows, and per-feed grid settings.
- Default cover stats are Fan%, Pop, and Fav, capped at three visible metrics and scaled for dense grids.
- Full-page Komikku-inspired title detail route with current catalog stats, external links, folder action, recommendation action, and per-detail visibility settings.
- Search page with horizontal grid sections for titles, feeds, folders, and recommendation drawers.
- Recommendation page with editable shelves, tag-match scoring, metric ranges, source toggles, and save-as-folder support.
- Same-domain compressed share links for feeds, folders, settings, recommendation config, and full backups.

## Commands

```bash
npm install
npm run icons
npm run dev
npm run lint
npm test
npm run build
```

## Data Source

The app defaults to the raw backend export because it works reliably with CORS:

```text
https://raw.githubusercontent.com/zerodox9000-eng/manhwa_db/main/db/exports/frontend
```

It can also use the backend GitHub Pages export URL when available:

```text
https://zerodox9000-eng.github.io/manhwa_db/db/exports/frontend
```

## Deploy

The included GitHub Actions workflow builds and deploys `dist/` to GitHub Pages for this repo at:

```text
https://zerodox9000-eng.github.io/Manhwa_pwa/
```
