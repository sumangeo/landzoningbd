import { useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import divisionGeo from "../data/division.json";
import districtGeo from "../data/district.json";

// ─── Helpers ────────────────────────────────────────────────────────────────

const getName = (p) => p?.name || p?.shapeName || p?.upazila || p?.ADM3_EN || "Unknown";

const STATUS_COLORS = {
  done: "#059669",   // emerald — strong on light map
  ongoing: "#d97706",   // amber
  pending: "#94a3b8",   // lighter slate — more visible on CARTO light
};

const SEARCH_HIGHLIGHT_COLOR = "#2563eb"; // bold royal blue stands out on light map

const featureStyle = (feature, selectedId) => {
  const status = feature.properties?.status || "pending";
  const isSelected = feature.id === selectedId;
  return {
    color: isSelected ? "#1e293b" : "#475569",
    weight: isSelected ? 2.5 : 0.7,
    fillColor: STATUS_COLORS[status] || STATUS_COLORS.pending,
    fillOpacity: isSelected ? 0.88 : 0.55,
  };
};

// ─── Map Container Resize Fix ───────────────────────────────────────────────
function ResizeHandler() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

// ─── ZoomToFeature ───────────────────────────────────────────────────────────

function ZoomToFeature({ geojson, layer }) {
  const map = useMap();
  useEffect(() => {
    if (!geojson?.features?.length) return;
    const latLngs = [];
    geojson.features.forEach((f) => {
      if (!f.geometry?.coordinates) return;
      const rings =
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates[0]]
          : f.geometry.coordinates.map((p) => p[0]);
      rings.forEach((ring) => ring.forEach(([lng, lat]) => latLngs.push([lat, lng])));
    });
    if (latLngs.length) map.fitBounds(latLngs, { padding: [4, 4] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson, layer]);
  return null;
}

// ─── WebView Touch Fix ───────────────────────────────────────────────────────

function WebViewTouchFix() {
  const map = useMap();
  useEffect(() => {
    map.getContainer().style.touchAction = "pan-x pan-y";
  }, [map]);
  return null;
}

// ─── GeoJSON Layer with search-aware highlighting ────────────────────────────

function GeoJsonLayer({ geojson, selectedId, search, onFeatureClick }) {
  const map = useMap();
  const selectedRef = useRef(selectedId);
  const onClickRef = useRef(onFeatureClick);
  const searchRef = useRef(search);
  // KEY FIX ②③: store every Leaflet layer instance as it mounts
  const layerMapRef = useRef({});

  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => { onClickRef.current = onFeatureClick; }, [onFeatureClick]);
  useEffect(() => { searchRef.current = search; }, [search]);

  // FIX: Stable style function that bypasses Leaflet's stale cache and grabs the latest data
  const styleFn = useCallback((leafletFeature) => {
    const name = getName(leafletFeature.properties);
    const key = leafletFeature.id ?? name;
    const freshFeature = layerMapRef.current[key]?.feature || leafletFeature;
    return featureStyle(freshFeature, selectedRef.current);
  }, []);

  // ── KEY FIX ①②③: react to search changes ──────────────────────────────
  useEffect(() => {
    const entries = Object.values(layerMapRef.current);
    if (!entries.length) return;

    // Always close ALL open popups first (FIX ② — clears stale popup)
    entries.forEach(({ lyr }) => {
      try { lyr.closePopup(); } catch { }
    });

    if (!search.trim()) {
      // Restore every feature to its default style (FIX ③)
      entries.forEach(({ lyr, feature }) => {
        try { lyr.setStyle(featureStyle(feature, selectedRef.current)); } catch { }
      });

      // Reset map view to full bounds when clearing search
      const latLngs = [];
      if (geojson && geojson.features) {
        geojson.features.forEach((f) => {
          if (!f.geometry?.coordinates) return;
          const rings =
            f.geometry.type === "Polygon"
              ? [f.geometry.coordinates[0]]
              : f.geometry.coordinates.map((p) => p[0]);
          rings.forEach((ring) => ring.forEach(([lng, lat]) => latLngs.push([lat, lng])));
        });
        if (latLngs.length) {
          try {
            map.fitBounds(latLngs, { padding: [4, 4], animate: true, duration: 0.5 });
          } catch { }
        }
      }
      return;
    }

    const query = search.toLowerCase().trim();
    let firstMatchLyr = null;

    entries.forEach(({ lyr, feature }) => {
      const name = getName(feature.properties);
      const isMatch = name.toLowerCase().includes(query);

      if (isMatch) {
        // FIX ①: highlight matched feature with blue glow
        try {
          lyr.setStyle({
            color: "#fff",
            weight: 2.5,
            fillColor: SEARCH_HIGHLIGHT_COLOR,
            fillOpacity: 0.88,
          });
          lyr.bringToFront();
          lyr.openPopup();
        } catch { }
        if (!firstMatchLyr) firstMatchLyr = lyr;
      } else {
        // FIX ①: dim non-matching features
        try {
          lyr.setStyle({
            ...featureStyle(feature, selectedRef.current),
            fillOpacity: 0.15,
            weight: 0.4,
          });
        } catch { }
      }
    });

    // Zoom to first match — maxZoom:11 keeps adjacent areas visible for context
    if (firstMatchLyr) {
      setTimeout(() => {
        try {
          firstMatchLyr._map.fitBounds(firstMatchLyr.getBounds(), {
            padding: [100, 100],
            maxZoom: 11,          // never zoom closer than zoom-11 (shows ~3-4 adjacent upazilas)
            animate: true,
            duration: 0.5,
          });
        } catch { }
      }, 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── KEY FIX ④: React to prop changes (geojson/selectedId) ──────────────────
  // Leaflet's GeoJSON component doesn't re-style on data update. We fix it here.
  useEffect(() => {
    const entries = Object.values(layerMapRef.current);
    if (!entries.length) return;

    geojson.features.forEach((f) => {
      const name = getName(f.properties);
      const key = f.id ?? name;
      const entry = layerMapRef.current[key];
      if (entry) {
        // Only update style if we're NOT in a search highlight mode
        if (!search.trim()) {
          try { entry.lyr.setStyle(featureStyle(f, selectedId)); } catch { }
        }
        // Always update the stored feature object
        entry.feature = f;
      }
    });
  }, [geojson, selectedId, search]);

  // ── onEachFeature: bind popup, store layer ref, add events ───────────────
  const onEachFeature = useCallback((feature, lyr) => {
    const name = getName(feature.properties);
    const status = feature.properties?.status || "pending";
    const progress = feature.properties?.progress ?? 0;
    // IMPORTANT FIX: Fallback to name if feature.id is undefined
    const featureId = feature.id || name;

    // Extract district and division context
    const district = feature.properties?.district;
    const division = feature.properties?.division;
    let subTextHtml = "";
    if (district && division) {
      subTextHtml = `<div class="map-popup-sub">${district} District, ${division} Division</div>`;
    } else if (division) {
      subTextHtml = `<div class="map-popup-sub">${division} Division</div>`;
    } else if (district) {
      subTextHtml = `<div class="map-popup-sub">${district} District</div>`;
    }

    // Rich popup content
    const statusColor = STATUS_COLORS[status];
    lyr.bindPopup(
      `<div class="map-popup">
        <div class="map-popup-name">${name}</div>
        ${subTextHtml}
        <div class="map-popup-meta">
          <span class="map-popup-dot" style="background:${statusColor}"></span>
          <span class="map-popup-status">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
          <span class="map-popup-pct">${progress}%</span>
        </div>
        <div class="map-popup-bar-track">
          <div class="map-popup-bar-fill" style="width:${progress}%;background:${statusColor}"></div>
        </div>
        <div class="admin-controls">
          <button class="update-status-btn" data-id="${feature.id || ""}" data-status="done" data-district="${district || ""}" data-division="${division || ""}">Done</button>
          <button class="update-status-btn" data-id="${feature.id || ""}" data-status="ongoing" data-district="${district || ""}" data-division="${division || ""}">Ongoing</button>
          <button class="update-status-btn" data-id="${feature.id || ""}" data-status="pending" data-district="${district || ""}" data-division="${division || ""}">Pending</button>
        </div>
      </div>`,
      { closeButton: false, className: "custom-popup", maxWidth: 220 }
    );

    // Store layer ref by feature id or name (FIX ②③)
    const key = feature.id ?? getName(feature.properties);
    layerMapRef.current[key] = { lyr, feature };

    lyr.on("mouseover", (e) => {
      e.target.setStyle({ weight: 2.5, fillOpacity: 0.92, color: "#fff" });
      e.target.bringToFront();
    });

    lyr.on("mouseout", (e) => {
      const currentSearch = searchRef.current || "";
      const isSearchMatch = currentSearch.trim() && name.toLowerCase().includes(currentSearch.toLowerCase().trim());

      if (isSearchMatch) {
        e.target.setStyle({
          color: "#fff",
          weight: 2.5,
          fillColor: SEARCH_HIGHLIGHT_COLOR,
          fillOpacity: 0.88,
        });
      } else if (currentSearch.trim()) {
        e.target.setStyle({
          ...featureStyle(feature, selectedRef.current),
          fillOpacity: 0.15,
          weight: 0.4,
        });
      } else {
        // MODIFIED: Look up the freshest feature data before applying style
        const freshFeat = layerMapRef.current[key]?.feature || feature;
        e.target.setStyle(featureStyle(freshFeat, selectedRef.current));
      }
    });

    lyr.on("click", (e) => {
      try { e.target._map.fitBounds(e.target.getBounds(), { padding: [40, 40] }); } catch { }
      onClickRef.current?.(feature);
    });
    // search is intentionally NOT in deps — event handlers are bound once on mount.
    // The search-driven styling is handled by the useEffect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GeoJSON
      data={geojson}
      style={styleFn}
      onEachFeature={onEachFeature}
    />
  );
}

// ─── Static Outline Layers ───────────────────────────────────────────────────

function StaticOutlines({ showDivision, showDistrict }) {
  return (
    <>
      {showDivision && (
        <GeoJSON
          data={divisionGeo}
          style={{ color: "#1e3a5f", weight: 2, fillOpacity: 0 }}
        />
      )}
      {showDistrict && (
        <GeoJSON
          data={districtGeo}
          style={{ color: "#475569", weight: 0.8, fillOpacity: 0 }}
        />
      )}
    </>
  );
}

function CaptureMap({ onMapReady }) {
  const map = useMap();
  useEffect(() => {
    if (onMapReady) onMapReady(map);
  }, [map, onMapReady]);
  return null;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MapView({
  geojson,
  search,
  layer,
  filter,
  selectedId,
  onFeatureClick,
  showDivision,
  showDistrict,
  showUpazila,
  isAdmin,
  onStatusUpdate,
  onMapReady,
}) {
  const totalFeatures = geojson?.features?.length ?? 0;
  const done = geojson?.features?.filter((f) => f.properties?.status === "done").length ?? 0;
  const ongoing = geojson?.features?.filter((f) => f.properties?.status === "ongoing").length ?? 0;
  const pending = geojson?.features?.filter((f) => f.properties?.status === "pending").length ?? 0;
  const pct = totalFeatures ? Math.round((done / totalFeatures) * 100) : 0;

  useEffect(() => {
    if (!isAdmin) return;
    const handlePopupClick = (e) => {
      const btn = e.target.closest('.update-status-btn');
      if (btn) {
        const id = btn.dataset.id;
        const status = btn.dataset.status;
        const district = btn.dataset.district;
        const division = btn.dataset.division;
        if (id && status && onStatusUpdate) {
          onStatusUpdate(id, status, district, division);
        }
      }
    };
    document.addEventListener('click', handlePopupClick);
    return () => document.removeEventListener('click', handlePopupClick);
  }, [isAdmin, onStatusUpdate]);

  return (
    <>
      <MapContainer
        center={[23.7, 90.4]}
        zoom={7}
        style={{ width: "100%", height: "100%" }}
        tap={false}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          tileSize={512}
          zoomOffset={-1}
        />

        <CaptureMap onMapReady={onMapReady} />
        <ResizeHandler />
        <WebViewTouchFix />
        <ZoomToFeature geojson={geojson} layer={layer} />
        <StaticOutlines showDivision={showDivision} showDistrict={showDistrict} />

        {showUpazila && (
          <GeoJsonLayer
            key={`${layer}-${filter}`}
            geojson={geojson}
            selectedId={selectedId}
            search={search}
            onFeatureClick={onFeatureClick}
          />
        )}
      </MapContainer>

      {/* Legend */}
      <div className="map-legend">
        <div className="map-legend-header">Legend</div>
        {[
          { label: "Done", color: STATUS_COLORS.done },
          { label: "Ongoing", color: STATUS_COLORS.ongoing },
          { label: "Pending", color: STATUS_COLORS.pending },
        ].map(({ label, color }) => (
          <div key={label} className="legend-row">
            <div className="legend-swatch" style={{ background: color }} />
            <span className="legend-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Map status bar — shows what's visible */}
      <div className="map-statusbar">
        <span className="statusbar-layer">{layer.charAt(0).toUpperCase() + layer.slice(1)}</span>
        <span className="statusbar-divider">·</span>
        <span className="statusbar-count">{totalFeatures} areas</span>
        <span className="statusbar-divider">·</span>
        <span className="statusbar-done" style={{ color: STATUS_COLORS.done }}>{done} done</span>
        <span className="statusbar-divider">·</span>
        <span className="statusbar-ongoing" style={{ color: STATUS_COLORS.ongoing }}>{ongoing} ongoing</span>
        <span className="statusbar-divider">·</span>
        <span className="statusbar-pct">{pct}% complete</span>
        {search && (
          <>
            <span className="statusbar-divider">·</span>
            <span className="statusbar-search">🔍 "{search}"</span>
          </>
        )}
      </div>
    </>
  );
}
