import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";

import upazila from "./data/upazila_light.json";
import district from "./data/district.json";
import division from "./data/division.json";

import { useState, useEffect } from "react";

import { db } from "./services/firebase";
import { collection, onSnapshot } from "firebase/firestore";

// ✅ Status logic
const getStatusFromChildren = (list) => {
  if (!list || list.length === 0) return "pending";

  const doneCount = list.filter((d) => d.status === "done").length;

  if (doneCount === list.length) return "done";
  if (doneCount > 0) return "ongoing";
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
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [firebaseData, setFirebaseData] = useState([]);
  const [showDivision, setShowDivision] = useState(true);
  const [showDistrict, setShowDistrict] = useState(true);
  const [showUpazila, setShowUpazila] = useState(true);  
  const [selectedId, setSelectedId] = useState(null);

  // 🔥 Firebase realtime
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "upazila_status"), (snap) => {
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFirebaseData(list);
    });

    return () => unsub();
  }, []);

  // 🔥 Select dataset
  let activeData = upazila;

  if (layer === "division") {
    activeData = division;
  } else if (layer === "district") {
    activeData = district;
  }

  // 🔍 Filter
  const filteredData = {
    ...activeData,
    features: activeData.features.filter((f) => {
      const name =
        f.properties.name ||
        f.properties.shapeName ||
        "";

      const matchSearch = name
        .toLowerCase()
        .includes(search.toLowerCase());

      return matchSearch;
    }),
  };

  // 🔥 Merge Firebase status
  const mergedData = {
    ...filteredData,
    features: filteredData.features.map((f) => {
      const name =
        f.properties.name || f.properties.shapeName;

      // 🟢 Upazila
      if (layer === "upazila") {
        const match = firebaseData.find((d) => d.id === f.id);

        return {
          ...f,
          properties: {
            ...f.properties,
            status: match ? match.status : "pending",
            progress: match && match.status === "done" ? 100 : 0
          },
        };
      }

      // 🟡 District
      if (layer === "district") {
        const related = firebaseData.filter(
          (d) => d.district && d.district === name
        );

        return {
          ...f,
          properties: {
            ...f.properties,
            status:
              related.length === 0
                ? "pending"
                : getStatusFromChildren(related),
            progress: getProgress(related)
          },
        };
      }

      // 🔵 Division
      if (layer === "division") {
        const related = firebaseData.filter(
          (d) => d.division && d.division === name
        );

        return {
          ...f,
          properties: {
            ...f.properties,
            status:
              related.length === 0
                ? "pending"
                : getStatusFromChildren(related),
            progress: getProgress(related)
          },
        };
      }

      return f;
    }),
  };
  // 🎯 Final data (search zoom)
  const finalFilteredData = {
    ...mergedData,
    features: mergedData.features.filter((f) => {
      if (filter === "all") return true;
      return f.properties.status === filter;
    }),
  };

  const finalData =
    finalFilteredData.features.length === 1
      ? finalFilteredData
      : finalFilteredData;
  // ✅ RETURN UI (THIS WAS MISSING ❌)
  return (
    <div style={{ display: "flex" }}>
      <Sidebar
        data={mergedData.features}
        setFilter={setFilter}
        filter={filter}
        onSearch={setSearch}
        setLayer={setLayer}
        layer={layer}
        showDivision={showDivision}
        setShowDivision={setShowDivision}
        showDistrict={showDistrict}
        setShowDistrict={setShowDistrict}
        showUpazila={showUpazila}
        setShowUpazila={setShowUpazila}
      />

      <div style={{ flex: 1 }}>
        <MapView
          geojson={finalData}
          search={search}
          selectedId={selectedId}
          onFeatureClick={(feature) => {
            setSelectedId(feature.id);
            if (layer === "division") {
              setSelectedFeature(feature);
              setLayer("district");
            } else if (layer === "district") {
              setSelectedFeature(feature);
              setLayer("upazila");
            }
          }}
          showDivision={showDivision}
          showDistrict={showDistrict}
          showUpazila={showUpazila}
        />
      </div>
    </div>
  );
}