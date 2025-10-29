/**
 * Preset Example - Using layout presets
 */
import React, { useState } from "react";
import { OttaLayout, getLayoutPreset, getLayoutPresetNames } from "../src";
import "../styles/index.css";

export function PresetExample() {
  const [currentPreset, setCurrentPreset] = useState("default");
  const presetNames = getLayoutPresetNames();
  const preset = getLayoutPreset(currentPreset);

  return (
    <OttaLayout
      header={{
        height: preset?.config.header?.height || 0,
        children: preset?.config.header ? (
          <div style={{ padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "100%" }}>
            <h1>Preset: {preset?.name}</h1>
            <select value={currentPreset} onChange={(e) => setCurrentPreset(e.target.value)}>
              {presetNames.map((name) => (
                <option key={name} value={name}>
                  {getLayoutPreset(name)?.name}
                </option>
              ))}
            </select>
          </div>
        ) : undefined,
      }}
      navbar={{
        width: preset?.config.navbar?.width || 0,
        children: preset?.config.navbar ? (
          <div style={{ padding: 20 }}>
            <h3>Navbar</h3>
            <p>Left sidebar content</p>
          </div>
        ) : undefined,
      }}
      aside={{
        width: preset?.config.aside?.width || 0,
        children: preset?.config.aside ? (
          <div style={{ padding: 20 }}>
            <h3>Aside</h3>
            <p>Right sidebar content</p>
          </div>
        ) : undefined,
      }}
      footer={{
        height: preset?.config.footer?.height || 0,
        children: preset?.config.footer ? (
          <div style={{ padding: "0 20px", display: "flex", alignItems: "center", height: "100%" }}>
            <p>{preset?.description}</p>
          </div>
        ) : undefined,
      }}
    >
      <div style={{ padding: 20 }}>
        <h2>Preset Layout Demo</h2>
        <p>Current preset: <strong>{preset?.name}</strong></p>
        <p>{preset?.description}</p>
        <p>Switch between different presets using the dropdown in the header to see different layout configurations.</p>
      </div>
    </OttaLayout>
  );
}
