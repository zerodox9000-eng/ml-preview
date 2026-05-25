# Manhwa Library

Mobile-first local PWA for building custom manhwa discovery feeds from the `zerodox9000-eng/manhwa_db` frontend exports.

## What Is Implemented

- GitHub Pages-ready Vite + React + TypeScript PWA.
- Smart offline sync into IndexedDB for catalog, tags, history, settings, feeds, folders, labels, and opened details.
- Feed builder with source mode, ratings, statuses, chapter/year/metric ranges, tag include/exclude, rolling windows, multi-sort, and per-feed title view settings.
- Grid view defaults to 3 columns and supports 1-5 columns.
- List view supports small, medium, and large cover sizes.
- Full-page title detail route with fixed MangaBaka links.
- Settings page for app name, accent, data source, safety, feed defaults, detail defaults, controls, sharing, and backup.
- Learn page explaining MangaBaka, AniList, discovery metrics, safety defaults, offline mode, sharing, and data limits.
- Same-domain compressed share links for feeds, folders, settings, labels, and full config.

## Commands

```bash
npm install
npm run icons
npm run dev
npm run lint
npm test -- --environment jsdom
npm run build
```

## Data Source

The app defaults to:

```text
https://raw.githubusercontent.com/zerodox9000-eng/manhwa_db/main/db/exports/frontend
```

It also tries the backend GitHub Pages export URL when available:

```text
https://zerodox9000-eng.github.io/manhwa_db/db/exports/frontend
```

## Deploy

The included GitHub Actions workflow builds and deploys `dist/` to GitHub Pages for a repo named `Manhwa_pwa`.
