/**
 * MapView.jsx
 *
 * FIXES in this version:
 * ① Search now HIGHLIGHTS matching features (blue glow) and DIMS non-matches
 * ② Previous search popup is CLOSED before the new one opens (via map.closePopup())
 * ③ Clearing search restores all feature styles to normal
 * ④ Uses layerMapRef to store all Leaflet layer instances so a useEffect
 *    can imperatively manage them when `search` changes — without remounting
 *    the entire GeoJSON layer on every keystroke.
 */

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
  const selectedRef = useRef(selectedId);
  const onClickRef = useRef(onFeatureClick);
  const searchRef = useRef(search);
  // KEY FIX ②③: store every Leaflet layer instance as it mounts
  const layerMapRef = useRef({});

  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => { onClickRef.current = onFeatureClick; }, [onFeatureClick]);
  useEffect(() => { searchRef.current = search; }, [search]);

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

  // ── onEachFeature: bind popup, store layer ref, add events ───────────────
  const onEachFeature = useCallback((feature, lyr) => {
    const name = getName(feature.properties);
    const status = feature.properties?.status || "pending";
    const progress = feature.properties?.progress ?? 0;

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
        e.target.setStyle(featureStyle(feature, selectedRef.current));
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
      style={(f) => featureStyle(f, selectedId)}
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
}) {
  const totalFeatures = geojson?.features?.length ?? 0;
  const done = geojson?.features?.filter((f) => f.properties?.status === "done").length ?? 0;
  const ongoing = geojson?.features?.filter((f) => f.properties?.status === "ongoing").length ?? 0;
  const pending = geojson?.features?.filter((f) => f.properties?.status === "pending").length ?? 0;
  const pct = totalFeatures ? Math.round((done / totalFeatures) * 100) : 0;

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
          detectRetina={true}
        />

        <ZoomControl position="bottomright" />
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
