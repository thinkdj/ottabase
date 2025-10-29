/**
 * Preset Example - Using layout presets
 */
import React, { useState } from "react";
import { OttaLayout, getLayoutPreset, getLayoutPresetNames } from "../src";
import "../styles/index.css";

const selectStyle: React.CSSProperties = {
  padding: "8px 16px",
  border: "1px solid #ccc",
  borderRadius: "4px",
  backgroundColor: "#fff",
  fontSize: "14px",
  cursor: "pointer",
};

export function PresetExample() {
  const [currentPreset, setCurrentPreset] = useState("default");
  const presetNames = getLayoutPresetNames();
  const preset = getLayoutPreset(currentPreset);

  return (
    <OttaLayout
      header={{
        height: preset?.config.header?.height || undefined,
        children: preset?.config.header ? (
          <div style={{ padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "100%", width: "100%" }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Preset: {preset?.name}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <label htmlFor="preset-select" style={{ fontSize: "14px", fontWeight: "500" }}>
                Select Layout:
              </label>
              <select
                id="preset-select"
                value={currentPreset}
                onChange={(e) => setCurrentPreset(e.target.value)}
                style={selectStyle}
              >
                {presetNames.map((name) => {
                  const p = getLayoutPreset(name);
                  return (
                    <option key={name} value={name}>
                      {p?.name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        ) : undefined,
      }}
      navbar={{
        width: preset?.config.navbar?.width || undefined,
        children: preset?.config.navbar ? (
          <div style={{ padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>Navbar</h3>
            <p style={{ fontSize: "0.9rem", color: "#666" }}>Left sidebar content</p>
            <ul style={{ listStyle: "none", padding: 0, marginTop: "16px" }}>
              <li style={{ padding: "8px 0" }}>
                <a href="#item1" style={{ textDecoration: "none", color: "#333" }}>Menu Item 1</a>
              </li>
              <li style={{ padding: "8px 0" }}>
                <a href="#item2" style={{ textDecoration: "none", color: "#333" }}>Menu Item 2</a>
              </li>
              <li style={{ padding: "8px 0" }}>
                <a href="#item3" style={{ textDecoration: "none", color: "#333" }}>Menu Item 3</a>
              </li>
            </ul>
          </div>
        ) : undefined,
      }}
      aside={{
        width: preset?.config.aside?.width || undefined,
        children: preset?.config.aside ? (
          <div style={{ padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>Aside</h3>
            <p style={{ fontSize: "0.9rem", color: "#666" }}>Right sidebar content</p>
            <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#f0f0f0", borderRadius: "4px" }}>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                This is the right sidebar, perfect for additional information or tools.
              </p>
            </div>
          </div>
        ) : undefined,
      }}
      footer={{
        height: preset?.config.footer?.height || undefined,
        children: preset?.config.footer ? (
          <div style={{ padding: "0 20px", display: "flex", alignItems: "center", height: "100%" }}>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>
              {preset?.description}
            </p>
          </div>
        ) : undefined,
      }}
    >
      <div style={{ padding: 20, maxWidth: "800px" }}>
        <h2>Preset Layout Demo</h2>
        <p>
          Current preset: <strong>{preset?.name}</strong>
        </p>
        <p style={{ color: "#666" }}>{preset?.description}</p>

        <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "#f9f9f9", borderRadius: "4px" }}>
          <h3 style={{ marginTop: 0 }}>About Presets</h3>
          <p style={{ fontSize: "0.9rem" }}>
            Switch between different presets using the dropdown in the header to see different layout configurations.
            Each preset represents a common layout pattern used in web applications.
          </p>
        </div>

        <div style={{ marginTop: "24px" }}>
          <h3>Available Presets:</h3>
          <ul style={{ lineHeight: "1.8" }}>
            {presetNames.map((name) => {
              const p = getLayoutPreset(name);
              return (
                <li key={name} style={{ marginBottom: "8px" }}>
                  <strong>{p?.name}</strong> - {p?.description}
                </li>
              );
            })}
          </ul>
        </div>

        <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "#e3f2fd", borderRadius: "4px", borderLeft: "4px solid #2196f3" }}>
          <h4 style={{ marginTop: 0, color: "#1976d2" }}>Current Configuration:</h4>
          <pre style={{ margin: 0, fontSize: "0.85rem", overflow: "auto" }}>
            {JSON.stringify(preset?.config, null, 2)}
          </pre>
        </div>
      </div>
    </OttaLayout>
  );
}

export default PresetExample;
