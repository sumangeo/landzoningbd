/**
 * Sidebar.jsx
 * Modern GIS control panel sidebar.
 * - isCollapsed prop: hides sidebar on desktop (width → 0)
 * - isOpen prop: shows sidebar as drawer on mobile
 */

const getName = (p) => p?.name || p?.shapeName || "—";

const STATUS_COLORS = {
  done:    "#10b981",
  ongoing: "#f59e0b",
  pending: "#64748b",
};

const LAYER_LABELS = {
  division: "Division",
  district: "District",
  upazila:  "Upazila",
};

export default function Sidebar({
  isOpen,
  isCollapsed,
  onClose,
  data = [],
  filter,
  setFilter,
  search,
  onSearch,
  layer,
  setLayer,
  onBack,
  onBackToDivision,
  showDivision,
  setShowDivision,
  showDistrict,
  setShowDistrict,
  showUpazila,
  setShowUpazila,
}) {
  const done    = data.filter((d) => d.properties?.status === "done").length;
  const ongoing = data.filter((d) => d.properties?.status === "ongoing").length;
  const pending = data.filter((d) => d.properties?.status === "pending").length;
  const total   = data.length;
  const overallPct = total ? Math.round((done / total) * 100) : 0;

  const searchCount = search
    ? data.filter((f) => {
        const name = (f.properties?.name || f.properties?.shapeName || "").toLowerCase();
        return name.includes(search.toLowerCase());
      }).length
    : null;

  const classNames = [
    "sidebar",
    isOpen ? "mobile-open" : "",
    isCollapsed ? "desktop-collapsed" : "",
  ].filter(Boolean).join(" ");

  return (
    <aside className={classNames} aria-label="Control panel">

      {/* ── Header ── */}
      <div className="sb-header">
        <div className="sb-header-brand">
          <div className="sb-logo">🗺</div>
          <div>
            <div className="sb-title">Land Zoning BD</div>
            <div className="sb-subtitle">
              <span className="sb-layer-badge">{LAYER_LABELS[layer]}</span>
            </div>
          </div>
        </div>
        <button className="sb-close-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="sb-body">

        {/* OVERALL PROGRESS RING */}
        <div className="sb-overall">
          <svg className="sb-ring" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border-hi)" strokeWidth="7" />
            <circle
              cx="40" cy="40" r="32" fill="none"
              stroke="var(--done)" strokeWidth="7"
              strokeDasharray={`${overallPct * 2.01} 201`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
            />
            <text x="40" y="37" textAnchor="middle" fill="var(--text)" fontSize="14" fontWeight="700">{overallPct}%</text>
            <text x="40" y="52" textAnchor="middle" fill="var(--text-muted)" fontSize="7">complete</text>
          </svg>
          <div className="sb-overall-stats">
            <Stat value={done}    label="Done"    color={STATUS_COLORS.done}    />
            <Stat value={ongoing} label="Ongoing" color={STATUS_COLORS.ongoing} />
            <Stat value={pending} label="Pending" color={STATUS_COLORS.pending} />
          </div>
        </div>

        <Divider />

        {/* DATA LAYER SELECT */}
        <Section label="Data Layer">
          <select
            className="sb-select"
            value={layer}
            onChange={(e) => setLayer(e.target.value)}
          >
            <option value="division">Division</option>
            <option value="district">District</option>
            <option value="upazila">Upazila</option>
          </select>
        </Section>

        {/* NAVIGATION */}
        <Section label="Navigation">
          <div className="sb-nav-row">
            <button
              className="sb-nav-btn"
              onClick={onBack}
              disabled={layer === "division"}
            >
              ← Back
            </button>
            <button
              className="sb-nav-btn"
              onClick={onBackToDivision}
              disabled={layer === "division"}
            >
              ⌂ Division
            </button>
          </div>
        </Section>

        <Divider />

        {/* MAP OVERLAYS */}
        <Section label="Map Overlays">
          <div className="sb-toggles">
            <Toggle label="Division Borders" color="#60a5fa" checked={showDivision} onChange={setShowDivision} />
            <Toggle label="District Borders" color="#a78bfa" checked={showDistrict} onChange={setShowDistrict} />
            <Toggle label="Upazila Fill"     color="#34d399" checked={showUpazila}  onChange={setShowUpazila}  />
          </div>
        </Section>

        <Divider />

        {/* SEARCH */}
        <Section label={searchCount !== null ? `Search — ${searchCount} match${searchCount !== 1 ? "es" : ""}` : "Search"}>
          <div className="sb-search-wrap">
            <span className="sb-search-icon">⌕</span>
            <input
              type="search"
              className="sb-search"
              placeholder={`Search ${LAYER_LABELS[layer]}…`}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              style={{ fontSize: "16px" }} /* prevent iOS zoom */
            />
            {search && (
              <button className="sb-search-clear" onClick={() => onSearch("")} aria-label="Clear search">✕</button>
            )}
          </div>
        </Section>

        {/* STATUS FILTER */}
        <Section label="Filter by Status">
          <div className="sb-filters">
            <FilterPill label="All"     value="all"     current={filter} onSelect={setFilter} color="#38bdf8" />
            <FilterPill label="Done"    value="done"    current={filter} onSelect={setFilter} color={STATUS_COLORS.done} />
            <FilterPill label="Ongoing" value="ongoing" current={filter} onSelect={setFilter} color={STATUS_COLORS.ongoing} />
            <FilterPill label="Pending" value="pending" current={filter} onSelect={setFilter} color={STATUS_COLORS.pending} />
          </div>
        </Section>

        <Divider />

        {/* PROGRESS LIST */}
        <Section label={`Progress · ${data.length} areas`}>
          <div className="sb-progress-list">
            {data.length === 0 ? (
              <div className="sb-empty">No areas match current filters</div>
            ) : (
              data.map((f, i) => {
                const p = f.properties || {};
                const name = getName(p);
                const pct = p.progress ?? 0;
                const status = p.status || "pending";
                return (
                  <div key={f.id ?? i} className="sb-progress-item">
                    <div className="sb-progress-row">
                      <span className="sb-progress-dot" style={{ background: STATUS_COLORS[status] }} />
                      <span className="sb-progress-name" title={name}>{name}</span>
                      <span className="sb-progress-pct">{pct}%</span>
                    </div>
                    <div className="sb-bar-track">
                      <div
                        className="sb-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: STATUS_COLORS[status],
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Section>

      </div>

      {/* Footer */}
      <div className="sb-footer">
        <span>Land Zoning Monitoring · Bangladesh</span>
      </div>
    </aside>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ label, children }) {
  return (
    <div className="sb-section">
      <div className="sb-section-label">{label}</div>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="sb-divider" />;
}

function Stat({ value, label, color }) {
  return (
    <div className="sb-stat">
      <div className="sb-stat-value" style={{ color }}>{value}</div>
      <div className="sb-stat-label">{label}</div>
    </div>
  );
}

function Toggle({ label, color, checked, onChange }) {
  return (
    <div
      className="sb-toggle"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onChange(!checked)}
    >
      <div className="sb-toggle-dot" style={{ background: color }} />
      <span className="sb-toggle-label">{label}</span>
      <div className={`sb-switch${checked ? " on" : ""}`}>
        <div className="sb-switch-thumb" />
      </div>
    </div>
  );
}

function FilterPill({ label, value, current, onSelect, color }) {
  const isActive = current === value;
  return (
    <button
      className={`sb-pill${isActive ? " active" : ""}`}
      style={isActive ? { background: color + "22", borderColor: color, color } : {}}
      onClick={() => onSelect(value)}
      aria-pressed={isActive}
    >
      {isActive && <span className="sb-pill-dot" style={{ background: color }} />}
      {label}
    </button>
  );
}
