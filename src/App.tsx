import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  Database,
  Download,
  Filter,
  FolderOpen,
  Home,
  Import,
  Info,
  ListPlus,
  Library,
  ListFilter,
  Plus,
  RotateCw,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  HashRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { createFeed, DEFAULT_FILTERS, DEFAULT_SORT, DEFAULT_VISIBLE_TITLE_FIELDS } from "./domain/defaults";
import { isGenreTag, labelMatchesSeries, runFeedQuery, tagRoot } from "./domain/query";
import { decodeSharePayload, exportCsv, makeShareUrl, type SharePayload } from "./domain/share";
import type {
  AppSettings,
  ContentRating,
  Feed,
  FeedViewSettings,
  Folder,
  SeriesCatalog,
  SeriesDetail,
  SortRule,
  TagNode,
  UserLabel,
  ViewMode,
} from "./domain/types";
import { fetchSeriesDetail } from "./services/dataService";
import { AppStoreProvider, useAppStore } from "./store/useAppStore";

const NAV_ITEMS = [
  { id: "home", to: "/", label: "Home", icon: Home },
  { id: "feeds", to: "/feeds", label: "Feeds", icon: ListFilter },
  { id: "search", to: "/search", label: "Search", icon: Search },
  { id: "folders", to: "/folders", label: "Folders", icon: FolderOpen },
  { id: "settings", to: "/settings", label: "Settings", icon: Settings },
];

const SORT_OPTIONS: SortRule["metric"][] = [
  "popularity",
  "favourites",
  "meanScore",
  "fanFavouriteRaw",
  "fanRatioPercentile",
  "fanFavouriteDiscoveryScore",
  "fanFavouriteDiscoveryPercentile",
  "releaseDate",
  "endDate",
  "popularityGrowth",
  "popularityGrowthPercent",
  "favouritesGrowth",
  "favouritesGrowthPercent",
  "meanScoreDelta",
  "fanFavouriteDelta",
  "discoveryScoreDelta",
  "discoveryPercentileDelta",
  "year",
  "chapters",
  "title",
];

const TITLE_FIELD_LABELS: Record<keyof FeedViewSettings["visible"], string> = {
  cover: "Cover",
  title: "Title",
  rank: "Rank",
  genreChips: "Genre chips",
  status: "Status",
  year: "Year",
  chapters: "Chapters",
  contentRating: "Content rating",
  popularity: "Popularity",
  favourites: "Favourites",
  meanScore: "Mean score",
  fanFavouriteRatio: "Fan favourite ratio",
  discoveryScore: "Discovery score",
  growthDelta: "Growth delta",
  labels: "Labels",
  sourceBadges: "Source badges",
  quickActions: "Quick actions",
  description: "Description",
  links: "Links",
};

const SESSION_RESTORE_KEY = "manhwa-library-route-v1";

function App() {
  return (
    <AppStoreProvider>
      <HashRouter>
        <AppFrame />
      </HashRouter>
    </AppStoreProvider>
  );
}

function AppFrame() {
  const store = useAppStore();
  const nav = NAV_ITEMS.filter((item) => store.settings.bottomNavItems.includes(item.id));

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", store.settings.accentColor);
    document.title = store.settings.appName || "Manhwa Library";
  }, [store.settings.accentColor, store.settings.appName]);

  return (
    <div className="app-shell">
      <SessionRestorer />
      <header className="top-app-bar">
        <Link to="/" className="brand" aria-label="Home">
          <span className="brand-mark">M</span>
          <span className="brand-title">{store.settings.appName}</span>
        </Link>
        <div className="row">
          <button className="icon-button" type="button" onClick={() => void store.refreshData()} aria-label="Refresh data">
            <RotateCw size={18} />
          </button>
          <Link className="icon-button" to="/learn" aria-label="Learn">
            <Info size={18} />
          </Link>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/feeds" element={<FeedsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/folders" element={<FoldersPage />} />
          <Route path="/folders/:id" element={<FolderDetailPage />} />
          <Route path="/labels" element={<LabelsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/title/:id" element={<TitleDetailPage />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.id} to={item.to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

function SessionRestorer() {
  const store = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current || !store.ready) return;
    restored.current = true;
    if (!store.settings.restoreLastSession) return;
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_RESTORE_KEY) ?? "{}") as { path?: string };
      const openedAtRoot = location.pathname === "/" && !location.search && (!window.location.hash || window.location.hash === "#/");
      if (saved.path && saved.path !== "/" && openedAtRoot) navigate(saved.path, { replace: true });
    } catch {
      // Bad restore metadata should never block the app.
    }
  }, [location.pathname, location.search, navigate, store.ready, store.settings.restoreLastSession]);

  useEffect(() => {
    if (!store.settings.restoreLastSession) return;
    const path = `${location.pathname}${location.search}`;
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_RESTORE_KEY) ?? "{}") as { scroll?: Record<string, number> };
      const y = saved.scroll?.[path] ?? 0;
      if (y > 0) requestAnimationFrame(() => window.scrollTo({ top: y }));
    } catch {
      // Ignore stale restore payloads.
    }
  }, [location.pathname, location.search, store.settings.restoreLastSession]);

  useEffect(() => {
    if (!store.settings.restoreLastSession) return;
    const path = `${location.pathname}${location.search}`;
    const save = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(SESSION_RESTORE_KEY) ?? "{}") as {
          path?: string;
          scroll?: Record<string, number>;
        };
        localStorage.setItem(
          SESSION_RESTORE_KEY,
          JSON.stringify({ ...saved, path, scroll: { ...(saved.scroll ?? {}), [path]: window.scrollY } }),
        );
      } catch {
        // localStorage can be unavailable in private contexts.
      }
    };
    save();
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [location.pathname, location.search, store.settings.restoreLastSession]);

  return null;
}

function BottomDrawer({
  title,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content className="drawer-content" onOpenAutoFocus={(event) => event.preventDefault()}>
          <div className="drawer-header">
            <Dialog.Title className="drawer-title">{title}</Dialog.Title>
            <Dialog.Description className="visually-hidden">
              Mobile-first drawer with controls for {title}. Use close, cancel, or apply actions to leave this panel.
            </Dialog.Description>
            <Dialog.Close className="icon-button" aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function HomePage() {
  const store = useAppStore();
  const [editorOpen, setEditorOpen] = useState(false);
  const activeFeed = store.feeds.find((feed) => feed.id === store.activeFeedId) ?? store.feeds[0] ?? null;

  useEffect(() => {
    if (!store.activeFeedId && store.feeds[0]) store.setActiveFeedId(store.feeds[0].id);
  }, [store]);

  return (
    <div className="page">
      <FeedTabs />
      {!store.ready ? (
        <div className="empty-state">
          <strong>Loading local library</strong>
          <span className="muted">{store.syncStatus || "Opening IndexedDB cache"}</span>
        </div>
      ) : !activeFeed ? (
        <div className="empty-state">
          <Library size={34} />
          <h1>Build your first feed</h1>
          <p className="muted">
            Home stays empty until you create a feed, so every shelf here is intentional instead of a random default.
          </p>
          <button className="button primary" type="button" onClick={() => setEditorOpen(true)}>
            <Plus size={18} /> Create feed
          </button>
        </div>
      ) : (
        <FeedView feed={activeFeed} />
      )}
      <BottomDrawer title="Create Feed" open={editorOpen} onOpenChange={setEditorOpen}>
        <FeedEditor
          feed={createFeed("My Feed")}
          onCancel={() => setEditorOpen(false)}
          onSave={(feed) => {
            store.upsertFeed(feed);
            setEditorOpen(false);
          }}
        />
      </BottomDrawer>
    </div>
  );
}

function FeedTabs() {
  const store = useAppStore();
  if (store.feeds.length === 0) return null;
  return (
    <div className="feed-tabs" aria-label="Feed tabs">
      {store.feeds.map((feed, index) => (
        <button
          type="button"
          key={feed.id}
          className={`feed-tab ${store.activeFeedId === feed.id ? "active" : ""}`}
          onClick={() => store.setActiveFeedId(feed.id)}
        >
          <span className="feed-tab-title">{feed.name}</span>
          <span className="feed-tab-meta">#{index + 1} in Home</span>
        </button>
      ))}
    </div>
  );
}

function FeedView({ feed }: { feed: Feed }) {
  const store = useAppStore();
  const [editorOpen, setEditorOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [feedSearch, setFeedSearch] = useState("");
  const runtimeFeed = useMemo(
    () =>
      feedSearch.trim()
        ? {
            ...feed,
            filters: { ...feed.filters, query: feedSearch.trim() },
          }
        : feed,
    [feed, feedSearch],
  );
  const query = useMemo(
    () =>
      runFeedQuery({
        feed: runtimeFeed,
        series: store.catalog,
        tags: store.tags,
        history: store.history,
        labels: store.labels,
        settings: store.settings,
        metaHistoryFirst: store.syncMeta?.historyFirstDate,
        metaHistoryLast: store.syncMeta?.historyLastDate,
      }),
    [runtimeFeed, store.catalog, store.history, store.labels, store.settings, store.syncMeta, store.tags],
  );

  return (
    <>
      <section className="section">
        <div className="row">
          <div>
            <h1 style={{ margin: 0 }}>{feed.name}</h1>
            <div className="muted tiny">
              {query.items.length.toLocaleString()} titles
              {store.syncMeta ? ` / synced ${new Date(store.syncMeta.lastSync ?? "").toLocaleString()}` : ""}
            </div>
          </div>
          <span className="spacer" />
          <button className="icon-button" type="button" onClick={() => setSearchOpen((open) => !open)} aria-label="Search in feed">
            <Search size={18} />
          </button>
          <button className="icon-button" type="button" onClick={() => setEditorOpen(true)} aria-label="Filter feed">
            <Filter size={18} />
          </button>
          <button className="icon-button" type="button" onClick={() => setEditorOpen(true)} aria-label="Sort and view feed">
            <SlidersHorizontal size={18} />
          </button>
          <button className="icon-button" type="button" onClick={() => setShareOpen(true)} aria-label="Share feed">
            <Share2 size={18} />
          </button>
        </div>
        {searchOpen && (
          <div className="field feed-search">
            <label>Search in this feed</label>
            <input
              className="input"
              value={feedSearch}
              onChange={(event) => setFeedSearch(event.target.value)}
              placeholder="Filter current feed without changing saved settings"
              autoComplete="off"
            />
          </div>
        )}
        <ActiveFilterChips feed={runtimeFeed} />
        {query.activeNotes.map((note) => (
          <p className="muted tiny" key={note}>
            {note}
          </p>
        ))}
        {query.missingDateData && (
          <p className="muted tiny">Some current exports do not include date fields in the catalog yet.</p>
        )}
      </section>
      <TitleCollection items={query.items} feed={runtimeFeed} tags={store.tags} />
      <BottomDrawer title="Feed Settings" open={editorOpen} onOpenChange={setEditorOpen}>
        <FeedEditor
          feed={feed}
          onCancel={() => setEditorOpen(false)}
          onSave={(updated) => {
            store.upsertFeed(updated);
            setEditorOpen(false);
          }}
        />
      </BottomDrawer>
      <BottomDrawer title="Share Feed" open={shareOpen} onOpenChange={setShareOpen}>
        <SharePanel payload={{ kind: "feed", version: 1, feed }} />
      </BottomDrawer>
    </>
  );
}

function ActiveFilterChips({ feed }: { feed: Feed }) {
  const chips = [
    feed.filters.sourceMode,
    ...(feed.filters.query ? [`search: ${feed.filters.query}`] : []),
    ...feed.filters.contentRatings,
    ...feed.filters.statuses,
    feed.view.mode,
    `${feed.view.mode === "grid" ? `${feed.view.gridColumns} columns` : `${feed.view.listCoverSize} covers`}`,
  ];
  return (
    <div className="chips" style={{ marginTop: 12 }}>
      {chips.map((chip) => (
        <span className="chip" key={chip}>
          {chip}
        </span>
      ))}
    </div>
  );
}

function TitleCollection({ items, feed, tags }: { items: SeriesCatalog[]; feed: Feed; tags: TagNode[] }) {
  const store = useAppStore();
  const [visibleCount, setVisibleCount] = useState(120);
  const tagsById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  useEffect(() => {
    setVisibleCount(120);
  }, [feed.id, items.length, feed.view.mode, feed.view.gridColumns, feed.view.listCoverSize]);
  const visibleItems = items.slice(0, visibleCount);

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <Filter size={28} />
        <strong>No titles matched this feed</strong>
        <span className="muted">Loosen filters, unlock adult content if intended, or switch source mode.</span>
      </div>
    );
  }
  if (feed.view.mode === "list") {
    const coverSize = feed.view.listCoverSize === "small" ? "58px" : feed.view.listCoverSize === "large" ? "116px" : "82px";
    return (
      <>
        <div className={`title-list density-${feed.view.listDensity}`} style={{ "--row-cover": coverSize } as React.CSSProperties}>
          {visibleItems.map((series, index) => (
            <TitleRow key={series.id} series={series} rank={index + 1} view={feed.view} tagsById={tagsById} labels={store.labels} />
          ))}
        </div>
        <LoadMore visibleCount={visibleCount} total={items.length} onMore={() => setVisibleCount((count) => count + 120)} />
      </>
    );
  }
  return (
    <>
      <div
        className={`title-grid columns-${feed.view.gridColumns} density-${feed.view.gridDensity}`}
        style={{ "--grid-columns": feed.view.gridColumns } as React.CSSProperties}
      >
        {visibleItems.map((series, index) => (
          <TitleCard key={series.id} series={series} rank={index + 1} view={feed.view} tagsById={tagsById} labels={store.labels} />
        ))}
      </div>
      <LoadMore visibleCount={visibleCount} total={items.length} onMore={() => setVisibleCount((count) => count + 120)} />
    </>
  );
}

function LoadMore({ visibleCount, total, onMore }: { visibleCount: number; total: number; onMore: () => void }) {
  if (visibleCount >= total) return null;
  return (
    <div className="toolbar" style={{ justifyContent: "center", margin: "18px 0" }}>
      <button className="button" type="button" onClick={onMore}>
        Load more ({Math.min(visibleCount, total).toLocaleString()} / {total.toLocaleString()})
      </button>
    </div>
  );
}

function Cover({ series }: { series: SeriesCatalog }) {
  return (
    <div className="cover-wrap">
      {series.cover ? <img src={series.cover} alt="" loading="lazy" /> : <div className="cover-fallback">{series.display_title}</div>}
    </div>
  );
}

function metricText(series: SeriesCatalog, metric: keyof AppSettings["metricNames"] | string) {
  if (metric === "popularity") return series.stats.popularity?.toLocaleString() ?? "No pop";
  if (metric === "favourites") return series.stats.favourites?.toLocaleString() ?? "No fav";
  if (metric === "meanScore") return series.stats.meanScore == null ? "No score" : `${series.stats.meanScore}`;
  if (metric === "fanFavouriteRaw") return series.analytics.fanFavouriteRaw == null ? "No ratio" : `${series.analytics.fanFavouriteRaw}%`;
  if (metric === "fanFavouriteDiscoveryScore") {
    return series.analytics.fanFavouriteDiscoveryScore == null ? "No discovery" : `${series.analytics.fanFavouriteDiscoveryScore}`;
  }
  return "";
}

function GenreChips({ series, tagsById }: { series: SeriesCatalog; tagsById: Map<number, TagNode> }) {
  const genreTags = series.tag_ids
    .map((id) => tagsById.get(id))
    .filter((tag): tag is TagNode => Boolean(tag && isGenreTag(tag)))
    .slice(0, 3);
  if (genreTags.length === 0) return null;
  return (
    <div className="chips">
      {genreTags.map((tag) => (
        <span className="chip" key={tag.id}>
          {tag.name}
        </span>
      ))}
    </div>
  );
}

function TitleCard({
  series,
  rank,
  view,
  tagsById,
  labels,
}: {
  series: SeriesCatalog;
  rank: number;
  view: FeedViewSettings;
  tagsById: Map<number, TagNode>;
  labels: UserLabel[];
}) {
  const visible = view.visible;
  return (
    <div className="title-card-wrap">
      <Link to={`/title/${series.id}`} className="title-card" data-testid="title-card">
        {visible.cover && (
          <div style={{ position: "relative" }}>
            <Cover series={series} />
            {visible.rank && <span className="rank">{rank}</span>}
            <div className="poster-metrics">
              <TitleMetrics series={series} view={view} compact />
            </div>
          </div>
        )}
        <div className="title-meta">
          {visible.title && <span className="title-name">{series.display_title}</span>}
          {visible.genreChips && <GenreChips series={series} tagsById={tagsById} />}
          {visible.labels && <SeriesLabelChips series={series} labels={labels} />}
          {!visible.cover && <TitleMetrics series={series} view={view} />}
        </div>
      </Link>
      {visible.quickActions && <QuickTitleAction series={series} />}
    </div>
  );
}

function TitleRow({
  series,
  rank,
  view,
  tagsById,
  labels,
}: {
  series: SeriesCatalog;
  rank: number;
  view: FeedViewSettings;
  tagsById: Map<number, TagNode>;
  labels: UserLabel[];
}) {
  return (
    <div className="title-row-wrap">
      <Link to={`/title/${series.id}`} className="title-row" data-testid="title-row">
        {view.visible.cover ? <Cover series={series} /> : <span className="rank">{rank}</span>}
        <div className="title-meta">
          <div className="row">
            {view.visible.rank && <span className="chip">#{rank}</span>}
            {view.visible.title && <span className="title-name">{series.display_title}</span>}
          </div>
          {view.visible.description && <p className="muted tiny">Description loads on the full detail page.</p>}
          {view.visible.genreChips && <GenreChips series={series} tagsById={tagsById} />}
          {view.visible.labels && <SeriesLabelChips series={series} labels={labels} />}
          <TitleMetrics series={series} view={view} />
        </div>
      </Link>
      {view.visible.quickActions && <QuickTitleAction series={series} />}
    </div>
  );
}

function QuickTitleAction({ series }: { series: SeriesCatalog }) {
  const copy = () => {
    const url = `${window.location.origin}${window.location.pathname}#/title/${series.id}`;
    void navigator.clipboard.writeText(url);
  };
  return (
    <button className="quick-title-action" type="button" onClick={copy} aria-label={`Copy link for ${series.display_title}`}>
      <Share2 size={15} />
    </button>
  );
}

function SeriesLabelChips({ series, labels }: { series: SeriesCatalog; labels: UserLabel[] }) {
  const visibleLabels = labels.filter((label) => labelMatchesSeries(label, series)).slice(0, 3);
  if (visibleLabels.length === 0) return null;
  return (
    <div className="chips label-chips">
      {visibleLabels.map((label) => (
        <span className="chip label-chip" style={{ "--label-color": label.color } as React.CSSProperties} key={label.id}>
          {label.name}
        </span>
      ))}
    </div>
  );
}

function TitleMetrics({ series, view, compact = false }: { series: SeriesCatalog; view: FeedViewSettings; compact?: boolean }) {
  const fields = view.visible;
  return (
    <div className={`metrics ${compact ? "compact-metrics" : ""}`}>
      {fields.popularity && <span>Pop {metricText(series, "popularity")}</span>}
      {fields.favourites && <span>Fav {metricText(series, "favourites")}</span>}
      {fields.meanScore && <span>Score {metricText(series, "meanScore")}</span>}
      {fields.fanFavouriteRatio && <span>Ratio {metricText(series, "fanFavouriteRaw")}</span>}
      {fields.discoveryScore && <span>Disc {metricText(series, "fanFavouriteDiscoveryScore")}</span>}
      {fields.status && series.status && <span>{series.status}</span>}
      {fields.year && series.year && <span>{series.year}</span>}
      {fields.chapters && series.total_chapters && <span>{series.total_chapters} ch</span>}
      {fields.contentRating && series.content_rating && <span>{series.content_rating}</span>}
      {fields.sourceBadges && <span>{series.stats.popularity == null ? "Non-AniList" : "AniList"}</span>}
    </div>
  );
}

function FeedsPage() {
  const store = useAppStore();
  const [editorFeed, setEditorFeed] = useState<Feed | null>(null);
  const [sortMode, setSortMode] = useState<"manual" | "created" | "updated" | "title">("manual");
  const displayed = useMemo(() => {
    const copy = [...store.feeds];
    if (sortMode === "created") copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (sortMode === "updated") copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (sortMode === "title") copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }, [sortMode, store.feeds]);

  return (
    <div className="page">
      <div className="row">
        <h1>Feeds</h1>
        <span className="spacer" />
        <select className="select" style={{ width: 150 }} value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
          <option value="manual">Manual</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="title">Title</option>
        </select>
        <button className="icon-button" type="button" onClick={() => setEditorFeed(createFeed("New Feed"))} aria-label="Create feed">
          <Plus size={18} />
        </button>
      </div>
      <div className="settings-list">
        {displayed.map((feed) => (
          <div className="setting-row" key={feed.id}>
            <div>
              <strong>{feed.name}</strong>
              <div className="muted tiny">
                {feed.view.mode} / {feed.filters.sourceMode} / {feed.filters.contentRatings.join(", ")}
              </div>
            </div>
            <div className="row">
              <button className="icon-button" type="button" onClick={() => store.reorderFeeds(feed.id, -1)} aria-label="Move up">
                <ArrowUp size={16} />
              </button>
              <button className="icon-button" type="button" onClick={() => store.reorderFeeds(feed.id, 1)} aria-label="Move down">
                <ArrowDown size={16} />
              </button>
              <button className="button" type="button" onClick={() => setEditorFeed(feed)}>
                Edit
              </button>
              <button className="icon-button" type="button" onClick={() => store.deleteFeed(feed.id)} aria-label="Delete feed">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <BottomDrawer title={editorFeed?.name ?? "Feed"} open={Boolean(editorFeed)} onOpenChange={(open) => !open && setEditorFeed(null)}>
        {editorFeed && (
          <FeedEditor
            feed={editorFeed}
            onCancel={() => setEditorFeed(null)}
            onSave={(feed) => {
              store.upsertFeed(feed);
              setEditorFeed(null);
            }}
          />
        )}
      </BottomDrawer>
    </div>
  );
}

function FeedEditor({ feed, onSave, onCancel }: { feed: Feed; onSave: (feed: Feed) => void; onCancel: () => void }) {
  const store = useAppStore();
  const [draft, setDraft] = useState<Feed>(() => structuredClone(feed));
  const [tagSearch, setTagSearch] = useState("");
  const statusOptions = useMemo(
    () => [...new Set(store.catalog.map((item) => item.status).filter(Boolean) as string[])].sort(),
    [store.catalog],
  );
  const filteredTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    const tags = q
      ? store.tags.filter((tag) => `${tag.name} ${tag.path}`.toLowerCase().includes(q))
      : store.tags.filter((tag) => tag.level <= 2 || tag.is_genre);
    const visibleTags = store.settings.adultUnlocked
      ? tags
      : tags.filter((tag) => !/(Boys Love|Girls Love|Smut|Hentai|Yaoi|Yuri|Shounen Ai|Shoujo Ai|Danmei|Bara)/i.test(`${tag.name} ${tag.path}`));
    return visibleTags.slice(0, 260);
  }, [store.settings.adultUnlocked, store.tags, tagSearch]);

  const updateFilters = (patch: Partial<Feed["filters"]>) => {
    setDraft((current) => ({ ...current, filters: { ...current.filters, ...patch } }));
  };
  const updateView = (patch: Partial<FeedViewSettings>) => {
    setDraft((current) => ({ ...current, view: { ...current.view, ...patch } }));
  };
  const toggleVisible = (key: keyof FeedViewSettings["visible"]) => {
    setDraft((current) => ({
      ...current,
      view: {
        ...current.view,
        visible: { ...current.view.visible, [key]: !current.view.visible[key] },
      },
    }));
  };
  const toggleArrayValue = <T,>(values: T[], value: T) => (values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const cycleTag = (tagId: number) => {
    const include = draft.filters.includeTagIds.includes(tagId);
    const exclude = draft.filters.excludeTagIds.includes(tagId);
    if (!include && !exclude) updateFilters({ includeTagIds: [...draft.filters.includeTagIds, tagId] });
    if (include) {
      updateFilters({
        includeTagIds: draft.filters.includeTagIds.filter((id) => id !== tagId),
        excludeTagIds: [...draft.filters.excludeTagIds, tagId],
      });
    }
    if (exclude) updateFilters({ excludeTagIds: draft.filters.excludeTagIds.filter((id) => id !== tagId) });
  };

  return (
    <div>
      <div className="field">
        <label htmlFor="feed-name">Feed name</label>
        <input id="feed-name" className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </div>

      <h2 className="section-title">Filters</h2>
      <div className="field-grid">
        <div className="field">
          <label>Source mode</label>
          <select className="select" value={draft.filters.sourceMode} onChange={(event) => updateFilters({ sourceMode: event.target.value as Feed["filters"]["sourceMode"] })}>
            <option value="anilist">AniList only</option>
            <option value="non-anilist">Non-AniList only</option>
            <option value="mixed">Mixed/manual</option>
          </select>
        </div>
        <div className="field">
          <label>Search text</label>
          <input className="input" value={draft.filters.query} onChange={(event) => updateFilters({ query: event.target.value })} placeholder="Title, tag, author" />
        </div>
      </div>

      <div className="field">
        <span className="small-label">Content ratings</span>
        <div className="chips">
          {(["safe", "suggestive", "erotica", "pornographic"] as ContentRating[]).map((rating) => (
            <button
              className={`chip chipbutton ${draft.filters.contentRatings.includes(rating) ? "active" : ""}`}
              type="button"
              key={rating}
              onClick={() => updateFilters({ contentRatings: toggleArrayValue(draft.filters.contentRatings, rating) })}
            >
              {rating}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="small-label">Statuses</span>
        <div className="chips">
          {statusOptions.map((status) => (
            <button
              className={`chip chipbutton ${draft.filters.statuses.includes(status) ? "active" : ""}`}
              type="button"
              key={status}
              onClick={() => updateFilters({ statuses: toggleArrayValue(draft.filters.statuses, status) })}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="field-grid">
        <NumberField label="Min chapters" value={draft.filters.minChapters} onChange={(value) => updateFilters({ minChapters: value })} />
        <NumberField label="Max chapters" value={draft.filters.maxChapters} onChange={(value) => updateFilters({ maxChapters: value })} />
        <NumberField label="Min year" value={draft.filters.minYear} onChange={(value) => updateFilters({ minYear: value })} />
        <NumberField label="Max year" value={draft.filters.maxYear} onChange={(value) => updateFilters({ maxYear: value })} />
        <NumberField label="Min popularity" value={draft.filters.minPopularity} onChange={(value) => updateFilters({ minPopularity: value })} />
        <NumberField label="Min favourites" value={draft.filters.minFavourites} onChange={(value) => updateFilters({ minFavourites: value })} />
        <NumberField label="Min mean score" value={draft.filters.minMeanScore} onChange={(value) => updateFilters({ minMeanScore: value })} />
      </div>

      <h2 className="section-title">Rolling Dates</h2>
      <div className="field-grid">
        <div className="field">
          <label>Date field</label>
          <select className="select" value={draft.filters.dateField} onChange={(event) => updateFilters({ dateField: event.target.value as Feed["filters"]["dateField"] })}>
            <option value="none">No date filter</option>
            <option value="release">Release date</option>
            <option value="end">End/completion date</option>
          </select>
        </div>
        <div className="field">
          <label>Window mode</label>
          <select className="select" value={draft.filters.rolling.mode} onChange={(event) => updateFilters({ rolling: { ...draft.filters.rolling, mode: event.target.value as Feed["filters"]["rolling"]["mode"] } })}>
            <option value="none">None</option>
            <option value="last">Last X duration</option>
            <option value="fixed">Fixed range</option>
          </select>
        </div>
        <NumberField
          label="Amount"
          value={draft.filters.rolling.amount}
          onChange={(value) => updateFilters({ rolling: { ...draft.filters.rolling, amount: value ?? 1 } })}
        />
        <div className="field">
          <label>Unit</label>
          <select className="select" value={draft.filters.rolling.unit} onChange={(event) => updateFilters({ rolling: { ...draft.filters.rolling, unit: event.target.value as Feed["filters"]["rolling"]["unit"] } })}>
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
            <option value="years">Years</option>
          </select>
        </div>
        <div className="field">
          <label>From</label>
          <input className="input" type="date" value={draft.filters.rolling.from ?? ""} onChange={(event) => updateFilters({ rolling: { ...draft.filters.rolling, from: event.target.value } })} />
        </div>
        <div className="field">
          <label>To</label>
          <input className="input" type="date" value={draft.filters.rolling.to ?? ""} onChange={(event) => updateFilters({ rolling: { ...draft.filters.rolling, to: event.target.value } })} />
        </div>
      </div>

      <h2 className="section-title">Tags</h2>
      <div className="field">
        <label>Tag search</label>
        <input className="input" value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Genres, themes, tropes" />
      </div>
      <div className="field">
        <label>Tag match</label>
        <select className="select" value={draft.filters.tagMatch} onChange={(event) => updateFilters({ tagMatch: event.target.value as Feed["filters"]["tagMatch"] })}>
          <option value="any">Any included tag</option>
          <option value="all">All included tags</option>
        </select>
      </div>
      <TagChipCloud tags={filteredTags} feed={draft} onTagClick={cycleTag} />

      <h2 className="section-title">Sort</h2>
      <div className="settings-list">
        {draft.sort.map((rule, index) => (
          <div className="setting-row" key={rule.id}>
            <div className="field-grid" style={{ margin: 0 }}>
              <select
                className="select"
                value={rule.metric}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sort: current.sort.map((item) => (item.id === rule.id ? { ...item, metric: event.target.value as SortRule["metric"] } : item)),
                  }))
                }
              >
                {SORT_OPTIONS.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={rule.direction}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sort: current.sort.map((item) => (item.id === rule.id ? { ...item, direction: event.target.value as SortRule["direction"] } : item)),
                  }))
                }
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setDraft((current) => ({ ...current, sort: current.sort.filter((item) => item.id !== rule.id) }))}
              aria-label={`Remove sort ${index + 1}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          className="button"
          type="button"
          onClick={() => setDraft((current) => ({ ...current, sort: [...current.sort, { ...DEFAULT_SORT[0], id: crypto.randomUUID() }] }))}
        >
          <Plus size={16} /> Add sort
        </button>
      </div>

      <h2 className="section-title">Title View</h2>
      <div className="field-grid">
        <div className="field">
          <label>View mode</label>
          <select className="select" value={draft.view.mode} onChange={(event) => updateView({ mode: event.target.value as ViewMode })}>
            <option value="grid">Grid</option>
            <option value="list">List</option>
          </select>
        </div>
        <div className="field">
          <label>Grid columns</label>
          <select className="select" value={draft.view.gridColumns} onChange={(event) => updateView({ gridColumns: Number(event.target.value) as FeedViewSettings["gridColumns"] })}>
            {[1, 2, 3, 4, 5].map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>List cover</label>
          <select className="select" value={draft.view.listCoverSize} onChange={(event) => updateView({ listCoverSize: event.target.value as FeedViewSettings["listCoverSize"] })}>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
      </div>
      <div className="chips">
        {(Object.keys(DEFAULT_VISIBLE_TITLE_FIELDS) as (keyof FeedViewSettings["visible"])[]).map((key) => (
          <button className={`chip chipbutton ${draft.view.visible[key] ? "active" : ""}`} type="button" key={key} onClick={() => toggleVisible(key)}>
            {TITLE_FIELD_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <button className="button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <span className="spacer" />
        <button className="button" type="button" onClick={() => setDraft({ ...draft, filters: { ...DEFAULT_FILTERS } })}>
          Reset filters
        </button>
        <button className="button primary" type="button" onClick={() => onSave(draft)}>
          <Check size={16} /> Save feed
        </button>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        className="input"
        type="number"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
      />
    </div>
  );
}

function TagChipCloud({ tags, feed, onTagClick }: { tags: TagNode[]; feed: Feed; onTagClick: (id: number) => void }) {
  const grouped = useMemo(() => {
    const map = new Map<string, TagNode[]>();
    for (const tag of tags) {
      const root = tag.is_genre ? "Genres" : tagRoot(tag);
      map.set(root, [...(map.get(root) ?? []), tag]);
    }
    const order = ["Genres", "Themes", "Settings", "Activities", "Narrative Tropes", "Work Info", "Relationship", "Character Types"];
    return [...map.entries()].sort((a, b) => {
      const ai = order.includes(a[0]) ? order.indexOf(a[0]) : 999;
      const bi = order.includes(b[0]) ? order.indexOf(b[0]) : 999;
      return ai - bi || a[0].localeCompare(b[0]);
    });
  }, [tags]);

  return (
    <div className="tag-tree">
      {grouped.map(([root, group]) => (
        <details className="tag-group" key={root} open={root === "Genres"}>
          <summary className="tag-summary">
            <span>{root}</span>
            <span className="muted tiny">{group.length}</span>
          </summary>
          <div className="chips">
            {group.map((tag) => {
              const included = feed.filters.includeTagIds.includes(tag.id);
              const excluded = feed.filters.excludeTagIds.includes(tag.id);
              return (
                <button
                  className={`chip chipbutton ${included ? "active" : ""} ${excluded ? "exclude" : ""}`}
                  type="button"
                  style={{ marginLeft: Math.max(0, tag.level - 1) * 8 }}
                  key={tag.id}
                  onClick={() => onTagClick(tag.id)}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}

function SearchPage() {
  const store = useAppStore();
  const [query, setQuery] = useState("");
  const searchFeed = useMemo(() => {
    const feed = createFeed("Search results");
    feed.filters.query = query;
    feed.filters.sourceMode = "mixed";
    feed.filters.contentRatings = store.settings.adultUnlocked ? ["safe", "suggestive", "erotica", "pornographic"] : store.settings.contentRatings;
    feed.view = store.settings.defaultFeedView;
    return feed;
  }, [query, store.settings.adultUnlocked, store.settings.contentRatings, store.settings.defaultFeedView]);
  const results = useMemo(
    () =>
      query.trim()
        ? runFeedQuery({
            feed: searchFeed,
            series: store.catalog,
            tags: store.tags,
            history: store.history,
            labels: store.labels,
            settings: store.settings,
            metaHistoryFirst: store.syncMeta?.historyFirstDate,
            metaHistoryLast: store.syncMeta?.historyLastDate,
          }).items
        : [],
    [query, searchFeed, store],
  );
  return (
    <div className="page">
      <h1>Search</h1>
      <div className="field">
        <label>Title, tag, author, year</label>
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search without keyboard collapse"
          autoComplete="off"
        />
      </div>
      {query.trim() ? <TitleCollection items={results} feed={searchFeed} tags={store.tags} /> : <p className="muted">Start typing to search the local catalog.</p>}
    </div>
  );
}

function FoldersPage() {
  const store = useAppStore();
  const [name, setName] = useState("");
  const [smartFeedId, setSmartFeedId] = useState(store.feeds[0]?.id ?? "");
  const createFolder = () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const folder: Folder = {
      id: crypto.randomUUID(),
      name: name.trim(),
      kind: "manual",
      titleIds: [],
      createdAt: now,
      updatedAt: now,
    };
    store.upsertFolder(folder);
    setName("");
  };
  const createSmartFolder = () => {
    const feed = store.feeds.find((item) => item.id === smartFeedId);
    if (!feed) return;
    const now = new Date().toISOString();
    store.upsertFolder({
      id: crypto.randomUUID(),
      name: `${feed.name} Smart Folder`,
      kind: "smart",
      titleIds: [],
      feedId: feed.id,
      createdAt: now,
      updatedAt: now,
    });
  };
  return (
    <div className="page">
      <div className="row">
        <h1>Folders</h1>
        <span className="spacer" />
        <Link className="button" to="/labels">
          <TagsIcon /> Labels
        </Link>
      </div>
      <section className="panel form-panel">
        <h2 className="section-title">Manual Folder</h2>
        <div className="toolbar">
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Folder name" />
          <button className="button primary" type="button" onClick={createFolder} disabled={!name.trim()}>
            <Plus size={16} /> Create
          </button>
        </div>
      </section>
      <section className="panel form-panel">
        <h2 className="section-title">Smart Folder From Feed</h2>
        <div className="toolbar">
          <select className="select" value={smartFeedId} onChange={(event) => setSmartFeedId(event.target.value)}>
            {store.feeds.map((feed) => (
              <option value={feed.id} key={feed.id}>
                {feed.name}
              </option>
            ))}
          </select>
          <button className="button" type="button" onClick={createSmartFolder} disabled={!smartFeedId}>
            <ListPlus size={16} /> Create smart
          </button>
        </div>
      </section>
      <div className="settings-list">
        {store.folders.map((folder) => (
          <div className="setting-row" key={folder.id}>
            <div>
              <Link to={`/folders/${folder.id}`}>
                <strong>{folder.name}</strong>
              </Link>
              <div className="muted tiny">
                {folder.kind} / {folder.kind === "manual" ? `${folder.titleIds.length} titles` : "dynamic feed results"}
              </div>
            </div>
            <div className="row">
              <Link className="button" to={`/folders/${folder.id}`}>
                Open
              </Link>
              <SharePanelButton payload={{ kind: "folder", version: 1, folder }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TagsIcon() {
  return <span aria-hidden="true">#</span>;
}

function FolderDetailPage() {
  const store = useAppStore();
  const navigate = useNavigate();
  const params = useParams();
  const folder = store.folders.find((item) => item.id === params.id);
  const [manualDetails, setManualDetails] = useState<SeriesCatalog[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!folder || folder.kind !== "manual") return;
    const missingIds = folder.titleIds.filter((id) => !store.catalog.some((item) => item.id === id));
    if (missingIds.length === 0) {
      setManualDetails([]);
      return;
    }
    void Promise.all(missingIds.map((id) => fetchSeriesDetail(store.settings.dataSourceUrl, id)))
      .then((details) => {
        if (!cancelled) setManualDetails(details);
      })
      .catch(() => {
        if (!cancelled) setManualDetails([]);
      });
    return () => {
      cancelled = true;
    };
  }, [folder, store.catalog, store.settings.dataSourceUrl]);
  if (!folder) {
    return (
      <div className="page">
        <button className="button" type="button" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="empty-state">Folder not found.</div>
      </div>
    );
  }
  const feed =
    folder.kind === "smart"
      ? store.feeds.find((item) => item.id === folder.feedId) ?? createFeed(folder.name)
      : {
          ...createFeed(folder.name),
          view: store.settings.defaultFeedView,
          filters: { ...DEFAULT_FILTERS, sourceMode: "mixed" as const, contentRatings: store.settings.contentRatings },
        };
  const items =
    folder.kind === "smart"
      ? runFeedQuery({
          feed,
          series: store.catalog,
          tags: store.tags,
          history: store.history,
          labels: store.labels,
          settings: store.settings,
          metaHistoryFirst: store.syncMeta?.historyFirstDate,
          metaHistoryLast: store.syncMeta?.historyLastDate,
        }).items
      : [...store.catalog.filter((item) => folder.titleIds.includes(item.id)), ...manualDetails];
  return (
    <div className="page">
      <button className="button" type="button" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>
      <div className="row">
        <div>
          <h1>{folder.name}</h1>
          <p className="muted">{folder.kind === "smart" ? "Smart folder" : `${items.length} manual titles`}</p>
        </div>
        <span className="spacer" />
        <SharePanelButton payload={{ kind: "folder", version: 1, folder }} />
      </div>
      <TitleCollection items={items} feed={feed} tags={store.tags} />
    </div>
  );
}

function LabelsPage() {
  const store = useAppStore();
  const [name, setName] = useState("");
  const [color, setColor] = useState(store.settings.accentColor);
  const [minMeanScore, setMinMeanScore] = useState<number | null>(null);
  const [minPopularity, setMinPopularity] = useState<number | null>(null);
  const createLabel = () => {
    if (!name.trim()) return;
    store.upsertLabel({
      id: crypto.randomUUID(),
      name: name.trim(),
      color,
      manualTitleIds: [],
      rule: minMeanScore != null || minPopularity != null ? { minMeanScore, minPopularity } : null,
    });
    setName("");
    setMinMeanScore(null);
    setMinPopularity(null);
  };
  return (
    <div className="page">
      <div className="row">
        <button className="button" type="button" onClick={() => history.back()}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>Labels</h1>
      </div>
      <section className="panel form-panel">
        <h2 className="section-title">Create Label</h2>
        <div className="field-grid">
          <div className="field">
            <label>Label name</label>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Peak, Favorite, Try Later" />
          </div>
          <div className="field">
            <label>Color</label>
            <input className="input" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
          </div>
          <NumberField label="Rule: min mean score" value={minMeanScore} onChange={setMinMeanScore} />
          <NumberField label="Rule: min popularity" value={minPopularity} onChange={setMinPopularity} />
        </div>
        <button className="button primary" type="button" onClick={createLabel}>
          <Plus size={16} /> Create label
        </button>
      </section>
      <div className="settings-list">
        {store.labels.map((label) => (
          <div className="setting-row" key={label.id}>
            <div>
              <strong>{label.name}</strong>
              <div className="muted tiny">{label.manualTitleIds.length} manual titles</div>
            </div>
            <span className="chip active" style={{ background: label.color }}>
              Label
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  const store = useAppStore();
  const updateDetail = (key: keyof AppSettings["detailVisible"]) =>
    store.updateSettings({ detailVisible: { ...store.settings.detailVisible, [key]: !store.settings.detailVisible[key] } });
  const updateDefaultVisible = (key: keyof FeedViewSettings["visible"]) =>
    store.updateSettings({
      defaultFeedView: {
        ...store.settings.defaultFeedView,
        visible: { ...store.settings.defaultFeedView.visible, [key]: !store.settings.defaultFeedView.visible[key] },
      },
    });
  return (
    <div className="page">
      <h1>Settings</h1>

      <SettingsSection title="App Settings">
        <div className="field">
          <label>In-app app name</label>
          <input className="input" value={store.settings.appName} onChange={(event) => store.updateSettings({ appName: event.target.value })} />
        </div>
        <div className="field">
          <label>Accent color</label>
          <input className="input" type="color" value={store.settings.accentColor} onChange={(event) => store.updateSettings({ accentColor: event.target.value })} />
        </div>
      </SettingsSection>

      <SettingsSection title="Data & Sync">
        <div className="field">
          <label>Data source URL</label>
          <input className="input" value={store.settings.dataSourceUrl} onChange={(event) => store.updateSettings({ dataSourceUrl: event.target.value })} />
        </div>
        <div className="setting-row">
          <div>
            <strong>{store.syncMeta?.totalSeries.toLocaleString() ?? 0} titles cached</strong>
            <div className="muted tiny">{store.syncStatus || store.syncMeta?.source || "No sync yet"}</div>
          </div>
          <button className="button" type="button" onClick={() => void store.refreshData()}>
            <Database size={16} /> Refresh
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title="Safety & Content">
        <ToggleRow
          label="Adult/sensitive unlock"
          description="Unlocks erotica/pornographic ratings and sensitive tag families."
          value={store.settings.adultUnlocked}
          onChange={(adultUnlocked) => store.updateSettings({ adultUnlocked })}
        />
        <div className="chips">
          {(["safe", "suggestive", "erotica", "pornographic"] as ContentRating[]).map((rating) => (
            <button
              className={`chip chipbutton ${store.settings.contentRatings.includes(rating) ? "active" : ""}`}
              type="button"
              key={rating}
              onClick={() =>
                store.updateSettings({
                  contentRatings: store.settings.contentRatings.includes(rating)
                    ? store.settings.contentRatings.filter((item) => item !== rating)
                    : [...store.settings.contentRatings, rating],
                })
              }
            >
              {rating}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Feed Defaults">
        <div className="field-grid">
          <div className="field">
            <label>Default view</label>
            <select
              className="select"
              value={store.settings.defaultFeedView.mode}
              onChange={(event) => store.updateSettings({ defaultFeedView: { ...store.settings.defaultFeedView, mode: event.target.value as ViewMode } })}
            >
              <option value="grid">Grid</option>
              <option value="list">List</option>
            </select>
          </div>
          <div className="field">
            <label>Default grid columns</label>
            <select
              className="select"
              value={store.settings.defaultFeedView.gridColumns}
              onChange={(event) =>
                store.updateSettings({
                  defaultFeedView: { ...store.settings.defaultFeedView, gridColumns: Number(event.target.value) as FeedViewSettings["gridColumns"] },
                })
              }
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="chips">
          {(Object.keys(DEFAULT_VISIBLE_TITLE_FIELDS) as (keyof FeedViewSettings["visible"])[]).map((key) => (
            <button
              className={`chip chipbutton ${store.settings.defaultFeedView.visible[key] ? "active" : ""}`}
              type="button"
              key={key}
              onClick={() => updateDefaultVisible(key)}
            >
              {TITLE_FIELD_LABELS[key]}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Detail Page Defaults">
        <div className="chips">
          {(Object.keys(store.settings.detailVisible) as (keyof AppSettings["detailVisible"])[]).map((key) => (
            <button className={`chip chipbutton ${store.settings.detailVisible[key] ? "active" : ""}`} type="button" key={key} onClick={() => updateDetail(key)}>
              {key}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Navigation & Controls">
        <div className="field">
          <label>Feed controls placement</label>
          <select className="select" value={store.settings.controlPlacement} onChange={(event) => store.updateSettings({ controlPlacement: event.target.value as AppSettings["controlPlacement"] })}>
            <option value="drawer">Bottom drawer only</option>
            <option value="toolbar">Top toolbar + drawer</option>
            <option value="fab">Floating action button + drawer</option>
          </select>
        </div>
        <ToggleRow label="Restore last session" description="Reopen at the prior route/feed/scroll when possible." value={store.settings.restoreLastSession} onChange={(restoreLastSession) => store.updateSettings({ restoreLastSession })} />
      </SettingsSection>

      <SettingsSection title="Sharing & Backup">
        <SharePanelButton payload={{ kind: "settings", version: 1, settings: store.settings }} label="Share settings" />
        <button
          className="button"
          type="button"
          onClick={() => downloadText("manhwa-library-backup.json", JSON.stringify(makeSnapshot(store), null, 2))}
        >
          <Download size={16} /> Export JSON backup
        </button>
        <button
          className="button"
          type="button"
          onClick={() =>
            downloadText(
              "manhwa-library-feeds.csv",
              exportCsv(store.feeds.map((feed) => ({ name: feed.name, sourceMode: feed.filters.sourceMode, view: feed.view.mode, createdAt: feed.createdAt }))),
            )
          }
        >
          <Download size={16} /> Export feeds CSV
        </button>
        <button className="button danger" type="button" onClick={() => void store.resetLocalState()}>
          Reset local app state
        </button>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      <div className="settings-list">{children}</div>
    </section>
  );
}

function ToggleRow({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="setting-row">
      <div>
        <strong>{label}</strong>
        <div className="muted tiny">{description}</div>
      </div>
      <Switch.Root className={`switch ${value ? "on" : ""}`} checked={value} onCheckedChange={onChange} aria-label={label}>
        <Switch.Thumb className="switch-thumb" />
      </Switch.Root>
    </div>
  );
}

function TitleDetailPage() {
  const store = useAppStore();
  const navigate = useNavigate();
  const params = useParams();
  const id = Number(params.id);
  const catalogItem = store.catalog.find((item) => item.id === id);
  const [detail, setDetail] = useState<SeriesDetail | null>(null);
  const [status, setStatus] = useState("Loading detail");
  const tagsById = useMemo(() => new Map(store.tags.map((tag) => [tag.id, tag])), [store.tags]);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    void fetchSeriesDetail(store.settings.dataSourceUrl, id)
      .then((value) => {
        if (!cancelled) setDetail(value);
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : "Could not load detail"));
    return () => {
      cancelled = true;
    };
  }, [id, store.settings.dataSourceUrl]);

  const series = detail ?? catalogItem;
  const visible = store.settings.detailVisible;
  if (!series) {
    return (
      <div className="page">
        <button className="button" type="button" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <p className="muted">{status}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <button className="button" type="button" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>
      <section className="detail-hero">
        {visible.cover && (series.cover ? <img className="detail-cover" src={series.cover} alt="" /> : <div className="detail-cover cover-fallback">No cover</div>)}
        <div>
          {visible.title && <h1 className="detail-title">{series.display_title}</h1>}
          {visible.genreTags && <GenreChips series={series} tagsById={tagsById} />}
          <div className="metrics" style={{ marginTop: 12 }}>
            {visible.popularity && <span>Popularity: {metricText(series, "popularity")}</span>}
            {visible.favourites && <span>Favourites: {metricText(series, "favourites")}</span>}
            {visible.meanScore && <span>Mean Score: {metricText(series, "meanScore")}</span>}
            {visible.fanFavouriteRatio && <span>Ratio: {metricText(series, "fanFavouriteRaw")}</span>}
            {visible.discoveryMetrics && <span>Discovery: {metricText(series, "fanFavouriteDiscoveryScore")}</span>}
            {visible.status && series.status && <span>Status: {series.status}</span>}
            {visible.year && series.year && <span>Year: {series.year}</span>}
            {visible.chapters && series.total_chapters && <span>Chapters: {series.total_chapters}</span>}
            {visible.contentRating && series.content_rating && <span>Rating: {series.content_rating}</span>}
          </div>
          <div className="toolbar">
            {detail?.links?.mangabaka && (
              <a className="button" href={detail.links.mangabaka} target="_blank" rel="noreferrer">
                MangaBaka
              </a>
            )}
            {detail?.source?.anilist?.url && (
              <a className="button" href={detail.source.anilist.url} target="_blank" rel="noreferrer">
                AniList
              </a>
            )}
          </div>
          <TitleActions series={series} />
        </div>
      </section>
      {visible.description && detail?.description && (
        <section className="detail-block">
          <h2 className="section-title">Description</h2>
          <p>{detail.description}</p>
        </section>
      )}
      {visible.authorsArtists && detail && (
        <section className="detail-block">
          <h2 className="section-title">Creators</h2>
          <p className="muted">
            {[...(detail.authors ?? []), ...(detail.artists ?? [])].filter(Boolean).join(", ") || "No creator data"}
          </p>
        </section>
      )}
      {visible.allTags && (
        <section className="detail-block">
          <h2 className="section-title">Tags</h2>
          <div className="chips">
            {series.tag_ids
              .map((tagId) => tagsById.get(tagId))
              .filter(Boolean)
              .map((tag) => (
                <span className="chip" key={tag!.id}>
                  {tag!.name}
                </span>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TitleActions({ series }: { series: SeriesCatalog }) {
  const store = useAppStore();
  const [folderId, setFolderId] = useState(store.folders[0]?.id ?? "");
  const [labelId, setLabelId] = useState(store.labels[0]?.id ?? "");
  const manualFolders = store.folders.filter((folder) => folder.kind === "manual");
  const attachedLabels = store.labels.filter((label) => labelMatchesSeries(label, series));
  useEffect(() => {
    if (!folderId && manualFolders[0]) setFolderId(manualFolders[0].id);
  }, [folderId, manualFolders]);
  useEffect(() => {
    if (!labelId && store.labels[0]) setLabelId(store.labels[0].id);
  }, [labelId, store.labels]);
  const addToFolder = () => {
    const folder = manualFolders.find((item) => item.id === folderId);
    if (!folder) return;
    store.upsertFolder({
      ...folder,
      titleIds: folder.titleIds.includes(series.id) ? folder.titleIds : [...folder.titleIds, series.id],
      updatedAt: new Date().toISOString(),
    });
  };
  const addLabel = () => {
    const label = store.labels.find((item) => item.id === labelId);
    if (!label) return;
    store.upsertLabel({
      ...label,
      manualTitleIds: label.manualTitleIds.includes(series.id) ? label.manualTitleIds : [...label.manualTitleIds, series.id],
    });
  };
  const removeLabel = (label: UserLabel) => {
    store.upsertLabel({
      ...label,
      manualTitleIds: label.manualTitleIds.filter((id) => id !== series.id),
    });
  };
  return (
    <section className="detail-actions">
      <h2 className="section-title">Library Actions</h2>
      <div className="field-grid">
        <div className="field">
          <label>Add to manual folder</label>
          <div className="row">
            <select className="select" value={folderId} onChange={(event) => setFolderId(event.target.value)}>
              <option value="">Choose folder</option>
              {manualFolders.map((folder) => (
                <option value={folder.id} key={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <button className="button" type="button" onClick={addToFolder} disabled={!folderId}>
              Add
            </button>
          </div>
        </div>
        <div className="field">
          <label>Apply label</label>
          <div className="row">
            <select className="select" value={labelId} onChange={(event) => setLabelId(event.target.value)}>
              <option value="">Choose label</option>
              {store.labels.map((label) => (
                <option value={label.id} key={label.id}>
                  {label.name}
                </option>
              ))}
            </select>
            <button className="button" type="button" onClick={addLabel} disabled={!labelId}>
              Apply
            </button>
          </div>
        </div>
      </div>
      {attachedLabels.length > 0 && (
        <div className="chips">
          {attachedLabels.map((label) => (
            label.manualTitleIds.includes(series.id) ? (
              <button className="chip chipbutton active" type="button" key={label.id} onClick={() => removeLabel(label)}>
                {label.name} x
              </button>
            ) : (
              <span className="chip active" key={label.id}>
                {label.name} auto
              </span>
            )
          ))}
        </div>
      )}
    </section>
  );
}

function LearnPage() {
  return (
    <div className="page">
      <h1>Learn</h1>
      <div className="learn-grid">
        <LearnItem title="MangaBaka">
          MangaBaka is the catalog backbone: titles, covers, chapters, status, dates, content rating, links, and the detailed tag
          hierarchy come from the backend export.
        </LearnItem>
        <LearnItem title="AniList Metrics">
          Popularity, favourites, and mean score are used only for AniList-mapped titles. Non-AniList titles can still be browsed
          through common filters such as text, tags, year, chapters, status, and folders.
        </LearnItem>
        <LearnItem title="Discovery Metrics">
          Fan-favourite ratio is favourites divided by popularity. Discovery score combines fandom attachment and popularity confidence
          so niche titles do not unfairly dominate.
        </LearnItem>
        <LearnItem title="Safe Defaults">
          Safe and suggestive content are enabled by default. Erotica, pornographic ratings, and sensitive tag families are hidden until
          unlocked in Settings.
        </LearnItem>
        <LearnItem title="Offline And Sharing">
          Catalog, tags, history, feeds, folders, labels, settings, and opened details are cached locally. Share links contain compressed
          config data and open an import preview before changing anything.
        </LearnItem>
        <LearnItem title="Data Limits">
          Long growth windows become more useful as backend history accumulates. Until then, the app runs against available history and
          tells you when a query is limited.
        </LearnItem>
      </div>
    </div>
  );
}

function LearnItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="learn-item">
      <h2 className="section-title">{title}</h2>
      <p className="muted">{children}</p>
    </section>
  );
}

function ImportPage() {
  const store = useAppStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const payload = useMemo(() => {
    const encoded = params.get("p");
    if (!encoded) return null;
    try {
      return decodeSharePayload(encoded);
    } catch {
      return null;
    }
  }, [params]);

  const apply = (mode: "merge" | "replace") => {
    if (!payload) return;
    if (payload.kind === "feed") store.importSnapshot({ feeds: [payload.feed] }, "merge");
    if (payload.kind === "folder") store.importSnapshot({ folders: [payload.folder] }, "merge");
    if (payload.kind === "settings") store.importSnapshot({ settings: payload.settings as AppSettings }, mode);
    if (payload.kind === "labels") store.importSnapshot({ labels: payload.labels }, mode);
    if (payload.kind === "full") store.importSnapshot(payload.snapshot, mode);
    navigate("/");
  };

  return (
    <div className="page">
      <h1>Import Preview</h1>
      {!payload ? (
        <div className="empty-state">This share link could not be decoded.</div>
      ) : (
        <div className="empty-state">
          <Import size={28} />
          <strong>{payload.kind} share</strong>
          <span className="muted">Review before applying. Merge keeps existing local data; replace is for settings/full backups.</span>
          <div className="toolbar">
            <button className="button primary" type="button" onClick={() => apply("merge")}>
              Merge
            </button>
            <button className="button" type="button" onClick={() => apply("replace")}>
              Replace
            </button>
            <button className="button" type="button" onClick={() => navigate("/")}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SharePanelButton({ payload, label = "Share" }: { payload: SharePayload; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="button" type="button" onClick={() => setOpen(true)}>
        <Share2 size={16} /> {label}
      </button>
      <BottomDrawer title={label} open={open} onOpenChange={setOpen}>
        <SharePanel payload={payload} />
      </BottomDrawer>
    </>
  );
}

function SharePanel({ payload }: { payload: SharePayload }) {
  const url = useMemo(() => makeShareUrl(payload), [payload]);
  return (
    <div>
      <p className="muted">Same-domain compressed share link. No URL shortener, no tracker.</p>
      <textarea className="textarea" readOnly value={url} />
      <div className="toolbar">
        <button className="button primary" type="button" onClick={() => void navigator.clipboard.writeText(url)}>
          <Copy size={16} /> Copy link
        </button>
      </div>
    </div>
  );
}

function makeSnapshot(store: ReturnType<typeof useAppStore>) {
  return {
    feeds: store.feeds,
    folders: store.folders,
    labels: store.labels,
    settings: store.settings,
    activeFeedId: store.activeFeedId,
    lastRoute: window.location.hash,
  };
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default App;
