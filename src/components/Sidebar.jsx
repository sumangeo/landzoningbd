export default function Sidebar({
  data,
  setFilter,
  filter,
  onSearch,
  setLayer,
  layer,
  showDivision,
  setShowDivision,
  showDistrict,
  setShowDistrict,
  showUpazila,
  setShowUpazila
}) {

  const done = data.filter(d => d.properties.status === "done").length;
  const ongoing = data.filter(d => d.properties.status === "ongoing").length;
  const todo = data.filter(d => d.properties.status === "pending").length;

  return (
    <div style={{
      width: "250px",
      background: "#fff",
      padding: "15px",
      boxShadow: "0 0 10px rgba(0,0,0,0.2)"
    }}>
      <h2>Land Zoning</h2>
      <div style={{ marginBottom: "10px" }}>
        <strong>Layers</strong>

        <div>
          <label>
            <input
              type="checkbox"
              checked={showDivision}
              onChange={() => setShowDivision(!showDivision)}
            />
            Division
          </label>
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              checked={showDistrict}
              onChange={() => setShowDistrict(!showDistrict)}
            />
            District
          </label>
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              checked={showUpazila}
              onChange={() => setShowUpazila(!showUpazila)}
            />
            Upazila
          </label>
        </div>
      </div>

      {layer !== "division" && (
        <button
          onClick={() => {
            if (layer === "upazila") setLayer("district");
            else if (layer === "district") setLayer("division");
          }}
          style={{
            width: "100%",
            padding: "8px",
            marginBottom: "10px",
            background: "#eee",
            border: "1px solid #ccc",
            cursor: "pointer"
          }}
        >
          ⬅ Back
        </button>
      )}      
      <button
        onClick={() => setLayer("division")}
        style={{
          width: "100%",
          padding: "8px",
          marginBottom: "10px",
          background: "#eee",
          border: "1px solid #ccc",
          cursor: "pointer"
        }}
      >
        ⬅ Back to Division
      </button>      
      <select
        value={layer}
        onChange={(e) => {
          setLayer(e.target.value);
          setSelectedFeature(null); // 👈 ADD THIS
        }}
      >
        <option value="division">Division</option>
        <option value="district">District</option>
        <option value="upazila">Upazila</option>
      </select>     
      <input
        type="text"
        placeholder="Search Upazila..."
        onChange={(e) => onSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "8px",
          marginBottom: "10px"
        }}
      />      

      <p>Done: {done}</p>
      <p>Ongoing: {ongoing}</p>
      <p>ToDo: {todo}</p>

      <hr />

    <div style={{ marginTop: "10px" }}>
      <strong>Filter</strong>

      <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
        
        {/* ALL */}
        <div
          onClick={() => setFilter("all")}
          style={{
            padding: "6px 12px",
            borderRadius: "20px",
            cursor: "pointer",
            background: filter === "all" ? "#333" : "#eee",
            color: filter === "all" ? "#fff" : "#000"
          }}
        >
          All
        </div>

        {/* DONE */}
        <div
          onClick={() => setFilter("done")}
          style={{
            padding: "6px 12px",
            borderRadius: "20px",
            cursor: "pointer",
            background: filter === "done" ? "#22c55e" : "#e5e7eb",
            color: filter === "done" ? "#fff" : "#000"
          }}
        >
          Done
        </div>

        {/* ONGOING */}
        <div
          onClick={() => setFilter("ongoing")}
          style={{
            padding: "6px 12px",
            borderRadius: "20px",
            cursor: "pointer",
            background: filter === "ongoing" ? "#facc15" : "#e5e7eb",
            color: "#000"
          }}
        >
          Ongoing
        </div>

        {/* PENDING */}
        <div
          onClick={() => setFilter("pending")}
          style={{
            padding: "6px 12px",
            borderRadius: "20px",
            cursor: "pointer",
            background: filter === "pending" ? "#9ca3af" : "#e5e7eb",
            color: "#000"
          }}
        >
          Pending
        </div>

      </div>
    </div>
      {/* 🔥 PROGRESS LIST */}
      <div style={{ marginTop: "15px" }}>
        <strong>Progress</strong>

        <div style={{ marginTop: "8px", maxHeight: "300px", overflowY: "auto" }}>
          {data.map((f, i) => {
            const p = f.properties;

            return (
              <div
                key={i}
                style={{
                  marginBottom: "10px",
                  padding: "6px",
                  borderBottom: "1px solid #eee"
                }}
              >
                {/* NAME */}
                <div>
                  <strong>{p.name || p.shapeName}</strong>
                </div>

                {/* % TEXT */}
                <div style={{ fontSize: "12px", marginTop: "2px" }}>
                  {p.progress || 0}% complete
                </div>

                {/* BAR */}
                <div
                  style={{
                    height: "6px",
                    background: "#eee",
                    borderRadius: "4px",
                    marginTop: "4px"
                  }}
                >
                  <div
                    style={{
                      width: `${p.progress || 0}%`,
                      height: "100%",
                      background:
                        p.status === "done"
                          ? "#22c55e"
                          : p.status === "ongoing"
                          ? "#facc15"
                          : "#9ca3af",
                      borderRadius: "4px"
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>    
      {/* progress list panel end */}  
    </div>
  );
}