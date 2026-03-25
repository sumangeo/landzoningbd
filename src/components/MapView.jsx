import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import { useEffect } from "react";
import division from "../data/division.json";
import district from "../data/district.json";

// ✅ Get name from different datasets
const getName = (p) =>
  p.name || p.shapeName || p.upazila || p.ADM3_EN || "Unknown";

// ✅ Color based on status (Firebase ready)
const getColor = (status) => {
  switch (status) {
    case "done":
      return "#22c55e"; // green
    case "ongoing":
      return "#facc15"; // yellow
    default:
      return "#9ca3af"; // gray
  }
};

// ✅ Style function
const style = (feature, selectedId) => {
  const status = feature.properties?.status;
  const isSelected = feature.id === selectedId;

  return {
    color: isSelected ? "#000" : "#333",
    weight: isSelected ? 3 : 1,
    fillColor: getColor(status),
    fillOpacity: isSelected ? 1 : 0.7
  };
};

// ✅ Auto zoom when data changes
function ZoomToFeature({ geojson }) {
  const map = useMap();

  useEffect(() => {
    if (!geojson || geojson.features.length === 0) return;

    const bounds = [];

    geojson.features.forEach((f) => {
      if (!f.geometry || !f.geometry.coordinates) return;

      let coords = [];

      if (f.geometry.type === "Polygon") {
        coords = f.geometry.coordinates[0];
      } else if (f.geometry.type === "MultiPolygon") {
        coords = f.geometry.coordinates[0][0];
      }

      coords.forEach((c) => bounds.push([c[1], c[0]]));
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds);
    }
  }, [geojson]);

  return null;
}

// ✅ MAIN COMPONENT
export default function MapView({
  geojson,
  onFeatureClick,
  search,
  selectedId,
  showDivision,
  showDistrict,
  showUpazila
}) {
  return (
    <MapContainer
      center={[23.7, 90.4]}
      zoom={7}
      style={{ height: "100vh", width: "100%" }}
    >
      {/* Base Map */}
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* Auto zoom */}
      <ZoomToFeature geojson={geojson} />

      {/* GeoJSON Layer */}
<>
  {showDivision && (
    <GeoJSON
      data={division}
      style={{ color: "#000", weight: 2, fillOpacity: 0 }}
    />
  )}

  {showDistrict && (
    <GeoJSON
      data={district}
      style={{ color: "#555", weight: 1, fillOpacity: 0 }}
    />
  )}

  {showUpazila && (
    <GeoJSON
      key={JSON.stringify(geojson)}
      data={geojson}
      style={(feature) => style(feature, selectedId)}
      onEachFeature={(feature, layer) => {

        const name = getName(feature.properties);

        // Popup
        layer.bindPopup(name);

        // 🔥 AUTO POPUP ON SEARCH
        if (
          search &&
          // name.toLowerCase() === search.toLowerCase()
          name.toLowerCase().includes(search.toLowerCase())
        ) {
          setTimeout(() => {
            layer.openPopup();
            const bounds = layer.getBounds();
            layer._map.fitBounds(bounds);
          }, 200);
        }

        // 🔥 HOVER
        layer.on("mouseover", (e) => {
          const l = e.target;

          l.setStyle({
            weight: 2,
            color: "#000",
            fillOpacity: 0.9
          });

          l.bringToFront();
          l._path.style.cursor = "pointer";
        });

        layer.on("mouseout", (e) => {
          const l = e.target;

          l.setStyle({
            weight: 1,
            color: "#333",
            fillOpacity: 0.7
          });
        });

        // 🔥 CLICK
        layer.on("click", () => {
          const bounds = layer.getBounds();
          layer._map.fitBounds(bounds);

          if (onFeatureClick) {
            onFeatureClick(feature);
          }
        });
      }}
    />
  )}
</>
//---------------------
    {/* 🔥 LEGEND */}
    <div
      style={{
        position: "absolute",
        top: "20px",
        right: "20px",
        background: "#fff",
        padding: "10px 12px",
        borderRadius: "8px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        fontSize: "14px",
        zIndex: 1000
      }}
    >
      <strong>Legend</strong>

      <div style={{ display: "flex", alignItems: "center", marginTop: "6px" }}>
        <div style={{
          width: "14px",
          height: "14px",
          background: "#22c55e",
          marginRight: "8px"
        }} />
        Done
      </div>

      <div style={{ display: "flex", alignItems: "center", marginTop: "4px" }}>
        <div style={{
          width: "14px",
          height: "14px",
          background: "#facc15",
          marginRight: "8px"
        }} />
        Ongoing
      </div>

      <div style={{ display: "flex", alignItems: "center", marginTop: "4px" }}>
        <div style={{
          width: "14px",
          height: "14px",
          background: "#9ca3af",
          marginRight: "8px"
        }} />
        Pending
      </div>
    </div>


    </MapContainer>
  );
}