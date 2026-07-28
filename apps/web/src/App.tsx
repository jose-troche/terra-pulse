import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import type {
  EarthEvent,
  EventDetailResponse,
  EventListResponse,
  EventType
} from "@terra-pulse/earth-domain";
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  CircleHelp,
  Database,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  X
} from "lucide-react";
import { getEventDetail, getEvents } from "./lib/api";
import { eventColors, eventLabels, relativeTime } from "./lib/format";
import { AskEarth } from "./components/AskEarth";
import { DetailPanel } from "./components/DetailPanel";
import { EventCard } from "./components/EventCard";
import { EventIcon, TerraMark } from "./components/Icons";

const MapCanvas = lazy(async () => {
  const module = await import("./components/MapCanvas");
  return { default: module.MapCanvas };
});

const allEventTypes = Object.keys(eventLabels) as EventType[];

export default function App() {
  const [data, setData] = useState<EventListResponse>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [search, setSearch] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(
    () => new Set(allEventTypes)
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<EventDetailResponse>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [mobileLayersOpen, setMobileLayersOpen] = useState(false);

  const load = useCallback(async (refresh = false) => {
    const controller = new AbortController();
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(undefined);
    try {
      const response = await getEvents(controller.signal);
      setData(response);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to connect to Earth data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    return () => controller.abort();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectEvent = useCallback(async (eventId: string) => {
    setSelectedId(eventId);
    setDetail(undefined);
    setDetailLoading(true);
    try {
      setDetail(await getEventDetail(eventId));
    } catch (detailError) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : "Unable to build this event brief."
      );
      setSelectedId(undefined);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = () => {
    setSelectedId(undefined);
    setDetail(undefined);
  };

  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.events ?? []).filter(
      (event) =>
        activeTypes.has(event.type) &&
        (!query ||
          event.title.toLowerCase().includes(query) ||
          event.location.toLowerCase().includes(query))
    );
  }, [activeTypes, data?.events, search]);

  const toggleType = (type: EventType) => {
    setActiveTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const sourceSummary = data
    ? `${data.sources.filter((source) => source.state === "live").length} live · ${
        data.sources.filter((source) => source.state === "cached").length
      } cached`
    : "Connecting";

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Terra Pulse home">
          <TerraMark />
          <span>
            Terra <b>Pulse</b>
          </span>
          <em>EARTH INTELLIGENCE</em>
        </a>
        <div className="system-status">
          <span className="live-indicator" />
          <span>Live intelligence</span>
          <i />
          <span>{sourceSummary}</span>
          {data ? <small>Updated {relativeTime(data.generatedAt)}</small> : null}
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="top-icon-button"
            aria-label="Refresh Earth data"
            onClick={() => void load(true)}
          >
            <RefreshCw size={16} className={refreshing ? "is-spinning" : ""} />
          </button>
          <button type="button" className="top-icon-button" aria-label="Notifications">
            <Bell size={16} />
          </button>
          <button type="button" className="top-icon-button" aria-label="About Terra Pulse">
            <CircleHelp size={16} />
          </button>
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Open layer controls"
            onClick={() => setMobileLayersOpen((current) => !current)}
          >
            {mobileLayersOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {error ? (
        <div className="global-alert" role="alert">
          <AlertTriangle size={15} />
          <span>{error}</span>
          <button type="button" onClick={() => setError(undefined)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ) : null}

      <div className="dashboard">
        <aside className={`left-rail ${mobileLayersOpen ? "mobile-open" : ""}`}>
          <section className="earth-overview">
            <div className="section-kicker">
              <span>Planetary overview</span>
              <i>NOW</i>
            </div>
            <div className="earth-score">
              <div>
                <span>Active signals</span>
                <strong>{loading ? "—" : data?.status.totalActive ?? 0}</strong>
              </div>
              <div className="score-orbit" aria-hidden="true">
                <span>{data?.status.critical ?? 0}</span>
                <small>critical</small>
              </div>
            </div>
            <div className="overview-stats">
              <article>
                <span className="status-dot status-high" />
                <div>
                  <small>High priority</small>
                  <strong>{data?.status.high ?? 0}</strong>
                </div>
              </article>
              <article>
                <span className="status-dot status-stable" />
                <div>
                  <small>Global trend</small>
                  <strong>{data?.status.trend ?? "—"}</strong>
                </div>
              </article>
            </div>
          </section>

          <section className="layer-section">
            <div className="rail-heading">
              <span>Observation layers</span>
              <button
                type="button"
                onClick={() =>
                  setActiveTypes(
                    activeTypes.size === allEventTypes.length
                      ? new Set()
                      : new Set(allEventTypes)
                  )
                }
              >
                {activeTypes.size === allEventTypes.length ? "Clear" : "All"}
              </button>
            </div>
            <div className="layer-list">
              {allEventTypes.map((type) => {
                const count = data?.status.byType[type] ?? 0;
                const active = activeTypes.has(type);
                return (
                  <label
                    key={type}
                    className={`layer-row ${active ? "active" : ""}`}
                    style={{ "--event-color": eventColors[type] } as React.CSSProperties}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleType(type)}
                    />
                    <span className="layer-check">
                      <EventIcon type={type} size={15} />
                    </span>
                    <span>{eventLabels[type]}</span>
                    <b>{count}</b>
                  </label>
                );
              })}
            </div>
          </section>

          <AskEarth />

          <section className="source-integrity">
            <div>
              <ShieldCheck size={14} />
              <span>Source integrity</span>
            </div>
            <p>
              Facts, calculations, inferences, and unknowns stay visibly separate.
            </p>
            <button type="button">
              View methodology <ChevronDown size={12} />
            </button>
          </section>
        </aside>

        <section className="globe-stage">
          <div className="map-title">
            <div>
              <span className="section-kicker">Living Earth · Real time</span>
              <h1>What is happening<br />on Earth today?</h1>
            </div>
            <div className="map-legend">
              <span><i className="legend-critical" /> Critical</span>
              <span><i className="legend-high" /> High</span>
              <span><i className="legend-moderate" /> Moderate</span>
            </div>
          </div>
          <Suspense
            fallback={
              <div className="map-loading" aria-live="polite">
                <span className="loading-orbit" />
                <strong>Initializing living Earth</strong>
              </div>
            }
          >
            <MapCanvas
              events={data?.events ?? []}
              activeTypes={activeTypes}
              selectedId={selectedId}
              onSelect={(eventId) => void selectEvent(eventId)}
            />
          </Suspense>
          <div className="map-bottom-status">
            <span>
              <Database size={13} />
              {data?.sources.length ?? 0} connected source feeds
            </span>
            <span>
              <ShieldCheck size={13} />
              Evidence labels active
            </span>
          </div>
        </section>

        <aside className={`intelligence-rail ${selectedId ? "has-detail" : ""}`}>
          {detail ? (
            <DetailPanel detail={detail} onClose={closeDetail} />
          ) : detailLoading ? (
            <div className="detail-loading" aria-live="polite">
              <span className="loading-orbit" />
              <strong>Connecting signals</strong>
              <p>Weather, population, infrastructure, and evidence are being resolved.</p>
            </div>
          ) : (
            <>
              <div className="feed-header">
                <div>
                  <span className="section-kicker">Intelligence feed</span>
                  <h2>Priority signals</h2>
                </div>
                <span>{visibleEvents.length}</span>
              </div>
              <div className="feed-search">
                <Search size={14} />
                <label className="sr-only" htmlFor="signal-search">Search signals</label>
                <input
                  id="signal-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search location or event"
                />
                {search ? (
                  <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                    <X size={13} />
                  </button>
                ) : null}
              </div>
              <div className="event-feed" data-testid="event-feed">
                {loading
                  ? Array.from({ length: 6 }, (_, index) => (
                      <div className="event-skeleton" key={index} />
                    ))
                  : visibleEvents.map((event: EarthEvent) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        selected={selectedId === event.id}
                        onSelect={(eventId) => void selectEvent(eventId)}
                      />
                    ))}
                {!loading && visibleEvents.length === 0 ? (
                  <div className="empty-feed">
                    <Search size={22} />
                    <strong>No matching signals</strong>
                    <p>Adjust layers or search terms to widen the current view.</p>
                  </div>
                ) : null}
              </div>
              <footer className="feed-footer">
                <span className="live-indicator" />
                Auto-refreshing source packet
              </footer>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
