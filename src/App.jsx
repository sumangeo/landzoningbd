import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import { db } from "./services/firebase";
import upazilaGeo from "./data/upazila_light.json";
import districtGeo from "./data/district.json";
import divisionGeo from "./data/division.json";
import "./index.css";

const getStatusFromChildren = (list) => {
  if (!list || list.length === 0) return "pending";
  const done = list.filter((d) => d.status === "done").length;
  if (done === list.length) return "done";
  if (done > 0) return "ongoing";
  return "pending";
};

const getProgress = (list) => {
  if (!list || list.length === 0) return 0;
  const done = list.filter((d) => d.status === "done").length;
  return Math.round((done / list.length) * 100);
};

export default function App() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [layer, setLayer] = useState("upazila");
  const [selectedId, setSelectedId] = useState(null);
  const [firebaseData, setFirebaseData] = useState([]);
  // Admin toggle
  const [isAdmin, setIsAdmin] = useState(false);
  // About Page toggle
  const [showAbout, setShowAbout] = useState(false);

  // Unified collapse state — starts collapsed on mobile, expanded on desktop
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 768);

  // Map Instance
  const [map, setMap] = useState(null);

  const handleZoomIn = useCallback(() => {
    if (map) map.zoomIn();
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (map) map.zoomOut();
  }, [map]);

  const [showDivision, setShowDivision] = useState(true);
  const [showDistrict, setShowDistrict] = useState(true);
  const [showUpazila, setShowUpazila] = useState(true);

  const updateUpazilaStatus = useCallback(async (id, newStatus, district, division) => {
    if (!isAdmin) return;
    try {
      await setDoc(doc(db, "upazila_status", id), { 
        status: newStatus,
        district: district,
        division: division
      }, { merge: true });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  }, [isAdmin]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "upazila_status"), (snap) => {
      const data = snap.docs.map((doc) => {
        const d = doc.data();
        // Enrich with district/division if missing (fixes grouping for old data)
        if (!d.district || !d.division) {
          const match = upazilaGeo.features.find((f) => f.id === doc.id);
          if (match) {
            d.district = d.district || match.properties.district;
            d.division = d.division || match.properties.division;
          }
        }
        return { id: doc.id, ...d };
      });
      setFirebaseData(data);
    });
    return () => unsub();
  }, []);

  const activeGeo = useMemo(() => {
    if (layer === "division") return divisionGeo;
    if (layer === "district") return districtGeo;
    return upazilaGeo;
  }, [layer]);

  const mergedData = useMemo(() => {
    const features = activeGeo.features.map((f) => {
      const name = f.properties.name || f.properties.shapeName;
      if (layer === "upazila") {
        const match = firebaseData.find((d) => d.id === f.id);
        return { ...f, properties: { ...f.properties, status: match ? match.status : "pending", progress: match?.status === "done" ? 100 : 0 } };
      }
      if (layer === "district") {
        const related = firebaseData.filter((d) => d.district === name);
        const childMatch = upazilaGeo.features.find((u) => (u.properties.district || "") === name);
        const divInfo = childMatch ? childMatch.properties.division : "";
        return { ...f, properties: { ...f.properties, status: getStatusFromChildren(related), progress: getProgress(related), division: divInfo } };
      }
      const related = firebaseData.filter((d) => d.division === name);
      return { ...f, properties: { ...f.properties, status: getStatusFromChildren(related), progress: getProgress(related) } };
    });
    return { ...activeGeo, features };
  }, [layer, activeGeo, firebaseData]);

  const finalData = useMemo(() => {
    const features = mergedData.features.filter((f) => {
      const matchFilter = filter === "all" || f.properties.status === filter;
      // We pass all items to the map (ignoring search filter here),
      // because MapView uses the `search` prop to dim/highlight them directly.
      return matchFilter;
    });
    return { ...mergedData, features };
  }, [mergedData, filter]);

  const handleFeatureClick = useCallback((feature) => {
    setSelectedId(feature.id);
    if (layer === "division") setLayer("district");
    else if (layer === "district") setLayer("upazila");
  }, [layer]);

  const goBack = useCallback(() => {
    if (layer === "upazila") setLayer("district");
    else if (layer === "district") setLayer("division");
    setSelectedId(null);
  }, [layer]);

  const goToDivision = useCallback(() => {
    setLayer("division");
    setSelectedId(null);
  }, []);

  const handleLayerChange = useCallback((newLayer) => {
    setLayer(newLayer);
    setSelectedId(null);
  }, []);

  return (
    <div className="app-shell">
      {/* Mobile backdrop */}
      <div
        className={`sidebar-backdrop${!sidebarCollapsed ? " open" : ""}`}
        onClick={() => setSidebarCollapsed(true)}
        aria-hidden="true"
      />

      {/* Unified collapse tab — sits on the seam between sidebar and map */}
      <button
        className={`collapse-tab${sidebarCollapsed ? " is-collapsed" : ""}`}
        onClick={() => setSidebarCollapsed((v) => !v)}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {sidebarCollapsed ? "›" : "‹"}
      </button>

      <Sidebar
        isOpen={!sidebarCollapsed}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarCollapsed(true)}
        onAboutClick={() => setShowAbout(true)}
        data={mergedData.features}
        filter={filter}
        setFilter={setFilter}
        search={search}
        onSearch={setSearch}
        layer={layer}
        setLayer={handleLayerChange}
        onBack={goBack}
        onBackToDivision={goToDivision}
        showDivision={showDivision}
        setShowDivision={setShowDivision}
        showDistrict={showDistrict}
        setShowDistrict={setShowDistrict}
        showUpazila={showUpazila}
        setShowUpazila={setShowUpazila}
        isAdmin={isAdmin}
        setIsAdmin={setIsAdmin}
        onStatusUpdate={updateUpazilaStatus}
      />

      <div className={`map-wrapper ${isAdmin ? "is-admin-mode" : ""}`}>
        <MapView
          geojson={finalData}
          search={search}
          layer={layer}
          filter={filter}
          selectedId={selectedId}
          onFeatureClick={handleFeatureClick}
          showDivision={showDivision}
          showDistrict={showDistrict}
          showUpazila={showUpazila}
          isAdmin={isAdmin}
          onStatusUpdate={updateUpazilaStatus}
          onMapReady={setMap}
        />
      </div>

      {showAbout && (
        <div className="about-overlay" onClick={() => setShowAbout(false)}>
          <div className="about-modal" onClick={(e) => e.stopPropagation()}>
            <button className="about-close" onClick={() => setShowAbout(false)}>✕</button>
            <div className="about-header">
              <div className="about-logo">🗺</div>
              <h2 className="about-title">Landzoning Project</h2>
              <p className="about-subtitle">Ministry of Land, BD</p>
            </div>
            <div className="about-content">
              <h3>Objective</h3>
              <p>To monitor and manage Landzoning data, zoning report and track progress.</p>

              <h3>Project Scope</h3>
              <p>Structured land usage development and real-time tracking of provision progress for Upazilas nationwide across all Divisions and Districts.</p>

              <div className="about-stats">
                <div className="about-stat-box">
                  <div className="about-stat-num">495(507)</div>
                  <div className="about-stat-txt">Upazilas</div>
                </div>
                <div className="about-stat-box">
                  <div className="about-stat-num">64</div>
                  <div className="about-stat-txt">Districts</div>
                </div>
                <div className="about-stat-box">
                  <div className="about-stat-num">8</div>
                  <div className="about-stat-txt">Divisions</div>
                </div>
              </div>
            </div>
            <div className="about-footer">
              © 2026 Suman, LZ
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
