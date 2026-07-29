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
  EventType,
  RiskLevel
} from "@terra-pulse/earth-domain";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  ChevronDown,
  CircleHelp,
  Database,
  Layers3,
  MapPin,
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
type PriorityFilter = Extract<RiskLevel, "critical" | "high">;

export default function App() {
  const [data, setData] = useState<EventListResponse>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [search, setSearch] = useState("");
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(
    () => new Set(allEventTypes)
  );
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>();
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<EventDetailResponse>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [mobileLayersOpen, setMobileLayersOpen] = useState(false);
  const [showOrientation, setShowOrientation] = useState(false);
  const [showAlertSummary, setShowAlertSummary] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem("terra-pulse:onboarding-v1") !== "complete") {
      setShowOrientation(true);
    }
  }, []);

  useEffect(() => {
    if (!showOrientation && !showAlertSummary) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowOrientation(false);
        setShowAlertSummary(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showAlertSummary, showOrientation]);

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

  const priorityEvents = useMemo(
    () =>
      (data?.events ?? []).filter(
        (event) => !priorityFilter || event.riskLevel === priorityFilter
      ),
    [data?.events, priorityFilter]
  );

  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return priorityEvents.filter(
      (event) =>
        activeTypes.has(event.type) &&
        (!query ||
          event.title.toLowerCase().includes(query) ||
          event.location.toLowerCase().includes(query))
    );
  }, [activeTypes, priorityEvents, search]);

  const toggleType = (type: EventType) => {
    setActiveTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const togglePriorityFilter = (level: PriorityFilter) => {
    setPriorityFilter((current) => (current === level ? undefined : level));
    setActiveTypes(new Set(allEventTypes));
    setSearch("");
    setSelectedId(undefined);
    setDetail(undefined);
    setMobileLayersOpen(false);
  };

  const clearPriorityFilter = () => {
    setPriorityFilter(undefined);
  };

  const sourceSummary = data
    ? `${data.sources.filter((source) => source.state === "live").length} live · ${
        data.sources.filter((source) => source.state === "cached").length
      } cached`
    : "Connecting";

  const dismissOrientation = () => {
    window.localStorage.setItem("terra-pulse:onboarding-v1", "complete");
    setShowOrientation(false);
  };

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
            data-tooltip="Refresh live Earth data"
            title="Refresh live Earth data"
            onClick={() => void load(true)}
          >
            <RefreshCw size={16} className={refreshing ? "is-spinning" : ""} />
          </button>
          <button
            type="button"
            className={`top-icon-button ${showAlertSummary ? "active" : ""}`}
            aria-label="View priority alert summary"
            aria-expanded={showAlertSummary}
            data-tooltip="View priority alert summary"
            title="View priority alert summary"
            onClick={() => setShowAlertSummary((current) => !current)}
          >
            <Bell size={16} />
          </button>
          <button
            type="button"
            className="top-icon-button"
            aria-label="How to use Terra Pulse"
            data-tooltip="How to use Terra Pulse"
            title="How to use Terra Pulse"
            onClick={() => {
              setShowAlertSummary(false);
              setShowOrientation(true);
            }}
          >
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

      {showAlertSummary ? (
        <>
          <button
            type="button"
            className="popover-scrim"
            aria-label="Close priority alert summary"
            onClick={() => setShowAlertSummary(false)}
          />
          <section className="alert-summary-popover" aria-label="Priority alert summary">
            <div className="popover-heading">
              <div>
                <span className="section-kicker">Live alert summary</span>
                <strong>Signals needing attention</strong>
              </div>
              <button
                type="button"
                aria-label="Close priority alert summary"
                onClick={() => setShowAlertSummary(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="alert-summary-stats">
              <article>
                <i className="legend-critical" />
                <span>Critical</span>
                <strong>{data?.status.critical ?? "—"}</strong>
              </article>
              <article>
                <i className="legend-high" />
                <span>High priority</span>
                <strong>{data?.status.high ?? "—"}</strong>
              </article>
            </div>
            <p>
              Select a signal in the map or feed to open its evidence brief.
              Terra Pulse does not send browser push notifications.
            </p>
          </section>
        </>
      ) : null}

      {showOrientation ? (
        <div className="orientation-overlay" role="presentation">
          <section
            className="orientation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="orientation-title"
          >
            <button
              type="button"
              className="orientation-close"
              aria-label="Close getting started guide"
              onClick={dismissOrientation}
            >
              <X size={16} />
            </button>
            <span className="section-kicker">Welcome to Terra Pulse</span>
            <h2 id="orientation-title">Read the planet in three moves</h2>
            <p className="orientation-intro">
              Start with the priority signals. Every claim remains connected to
              the evidence—and its limitations.
            </p>
            <div className="orientation-steps">
              <article>
                <span><Layers3 size={17} /></span>
                <div>
                  <small>1 · Filter</small>
                  <strong>Choose observation layers</strong>
                  <p>Turn event types on or off in the left panel.</p>
                </div>
              </article>
              <article>
                <span><MapPin size={17} /></span>
                <div>
                  <small>2 · Explore</small>
                  <strong>Select a map signal or feed card</strong>
                  <p>The same live events appear on the globe and priority feed.</p>
                </div>
              </article>
              <article>
                <span><ShieldCheck size={17} /></span>
                <div>
                  <small>3 · Verify</small>
                  <strong>Read the brief, then Ask Earth</strong>
                  <p>Observed, computed, inferred, and unknown facts stay labeled.</p>
                </div>
              </article>
            </div>
            <button
              type="button"
              className="orientation-start"
              onClick={dismissOrientation}
            >
              Start exploring <ArrowRight size={15} />
            </button>
            <small className="orientation-reopen">
              Reopen this guide anytime with the ? icon.
            </small>
          </section>
        </div>
      ) : null}

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
              <button
                type="button"
                className={`score-orbit priority-filter-control ${
                  priorityFilter === "critical" ? "active" : ""
                }`}
                aria-label={
                  priorityFilter === "critical"
                    ? "Clear critical event filter"
                    : "Show critical events"
                }
                aria-pressed={priorityFilter === "critical"}
                onClick={() => togglePriorityFilter("critical")}
              >
                <span>{data?.status.critical ?? 0}</span>
                <small>critical</small>
              </button>
            </div>
            <div className="overview-stats">
              <button
                type="button"
                className={`priority-stat priority-filter-control ${
                  priorityFilter === "high" ? "active" : ""
                }`}
                aria-label={
                  priorityFilter === "high"
                    ? "Clear high priority event filter"
                    : "Show high priority events"
                }
                aria-pressed={priorityFilter === "high"}
                onClick={() => togglePriorityFilter("high")}
              >
                <span className="status-dot status-high" />
                <div>
                  <small>High priority</small>
                  <strong>{data?.status.high ?? 0}</strong>
                </div>
              </button>
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
              events={priorityEvents}
              activeTypes={activeTypes}
              selectedId={selectedId}
              viewerLocation={data?.viewerLocation}
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
                  <span className="section-kicker">
                    {priorityFilter
                      ? `${priorityFilter} priority filter`
                      : "Intelligence feed"}
                  </span>
                  <h2>
                    {priorityFilter
                      ? `${priorityFilter === "critical" ? "Critical" : "High"} signals`
                      : "Priority signals"}
                  </h2>
                </div>
                <div className="feed-header-actions">
                  {priorityFilter ? (
                    <button
                      type="button"
                      className="feed-filter-clear"
                      onClick={clearPriorityFilter}
                    >
                      Clear filter
                    </button>
                  ) : null}
                  <span>{visibleEvents.length}</span>
                </div>
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
