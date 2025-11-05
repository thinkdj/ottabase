"use client";

import React, { useState } from "react";
import { OttaLayout, getLayoutPreset } from "@ottabase/ottalayout";
import "@ottabase/ottalayout/styles";

import { HeaderStub } from "./components/HeaderStub";
import { FooterStub } from "./components/FooterStub";
import { NavbarStub } from "./components/NavbarStub";
import { AsideStub } from "./components/AsideStub";
import { LayoutSwitcher } from "./components/LayoutSwitcher";

export default function OttaLayoutDemo() {
  const [currentPreset, setCurrentPreset] = useState("default");
  const preset = getLayoutPreset(currentPreset);

  return (
    <>
      {/* Layout Switcher - Absolutely positioned outside of OttaLayout */}
      <LayoutSwitcher
        currentPreset={currentPreset}
        onPresetChange={setCurrentPreset}
      />

      {/* The actual layout */}
      <OttaLayout
        header={
          preset?.config.header
            ? {
                height: preset.config.header.height,
                children: <HeaderStub />,
              }
            : undefined
        }
        footer={
          preset?.config.footer
            ? {
                height: preset.config.footer.height,
                children: <FooterStub />,
              }
            : undefined
        }
        navbar={
          preset?.config.navbar
            ? {
                width: preset.config.navbar.width,
                children: <NavbarStub />,
              }
            : undefined
        }
        aside={
          preset?.config.aside
            ? {
                width: preset.config.aside.width,
                children: <AsideStub />,
              }
            : undefined
        }
        transitionDuration={300}
        transitionTimingFunction="cubic-bezier(0.4, 0, 0.2, 1)"
      >
        {/* Main Content Area */}
        <div style={{ padding: "32px", maxWidth: "1200px" }}>
          <div
            style={{
              marginBottom: "32px",
              padding: "24px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "12px",
              color: "white",
            }}
          >
            <h1 style={{ margin: "0 0 12px 0", fontSize: "2rem" }}>
              {preset?.name}
            </h1>
            <p style={{ margin: 0, fontSize: "1.1rem", opacity: 0.9 }}>
              {preset?.description}
            </p>
          </div>

          <div
            style={{
              marginBottom: "32px",
              padding: "24px",
              background: "#f8f9fa",
              borderRadius: "12px",
              border: "1px solid #e0e0e0",
            }}
          >
            <h2
              style={{
                margin: "0 0 16px 0",
                fontSize: "1.5rem",
                color: "#333",
              }}
            >
              📐 Current Configuration
            </h2>
            <pre
              style={{
                background: "white",
                padding: "16px",
                borderRadius: "8px",
                overflow: "auto",
                fontSize: "13px",
                border: "1px solid #e0e0e0",
              }}
            >
              {JSON.stringify(preset?.config, null, 2)}
            </pre>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "24px",
              marginBottom: "32px",
            }}
          >
            <div
              style={{
                padding: "24px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e0e0e0",
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>🎨</div>
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "1.25rem",
                  color: "#333",
                }}
              >
                Flexible Layouts
              </h3>
              <p style={{ margin: 0, color: "#666", lineHeight: "1.6" }}>
                Switch between 13 different preset layouts using the switcher in
                the top-right corner. Each preset demonstrates a different
                layout configuration.
              </p>
            </div>

            <div
              style={{
                padding: "24px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e0e0e0",
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>⚡</div>
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "1.25rem",
                  color: "#333",
                }}
              >
                Smooth Transitions
              </h3>
              <p style={{ margin: 0, color: "#666", lineHeight: "1.6" }}>
                Notice the smooth 300ms transitions when switching between
                layouts. All animations use CSS Grid and transform for optimal
                performance.
              </p>
            </div>

            <div
              style={{
                padding: "24px",
                background: "white",
                borderRadius: "12px",
                border: "1px solid #e0e0e0",
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>🚀</div>
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "1.25rem",
                  color: "#333",
                }}
              >
                Zero Dependencies
              </h3>
              <p style={{ margin: 0, color: "#666", lineHeight: "1.6" }}>
                OttaLayout is a standalone package with no Mantine or other UI
                library dependencies. Pure React + CSS Grid implementation.
              </p>
            </div>
          </div>

          <div
            style={{
              padding: "24px",
              background: "white",
              borderRadius: "12px",
              border: "1px solid #e0e0e0",
            }}
          >
            <h2
              style={{
                margin: "0 0 16px 0",
                fontSize: "1.5rem",
                color: "#333",
              }}
            >
              🧩 Layout Sections
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
              }}
            >
              {[
                {
                  section: "Header",
                  active: !!preset?.config.header,
                  icon: "⬆️",
                },
                {
                  section: "Footer",
                  active: !!preset?.config.footer,
                  icon: "⬇️",
                },
                {
                  section: "Navbar",
                  active: !!preset?.config.navbar,
                  icon: "⬅️",
                },
                {
                  section: "Aside",
                  active: !!preset?.config.aside,
                  icon: "➡️",
                },
              ].map((item) => (
                <div
                  key={item.section}
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    background: item.active
                      ? "rgba(102, 126, 234, 0.1)"
                      : "#f8f9fa",
                    border: item.active
                      ? "2px solid #667eea"
                      : "2px solid #e0e0e0",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>
                    {item.icon}
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: item.active ? "#667eea" : "#999",
                    }}
                  >
                    {item.section}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: item.active ? "#667eea" : "#999",
                      marginTop: "4px",
                    }}
                  >
                    {item.active ? "Active" : "Inactive"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: "32px",
              padding: "24px",
              background: "rgba(255, 193, 7, 0.1)",
              borderRadius: "12px",
              border: "2px solid rgba(255, 193, 7, 0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "start",
                gap: "16px",
              }}
            >
              <div style={{ fontSize: "32px" }}>💡</div>
              <div>
                <h3
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "1.25rem",
                    color: "#333",
                  }}
                >
                  Try It Out!
                </h3>
                <p style={{ margin: 0, color: "#666", lineHeight: "1.6" }}>
                  Use the <strong>Layout Presets</strong> button in the top-right
                  corner to explore all 13 different layout configurations. Watch
                  how sections smoothly transition in and out!
                </p>
              </div>
            </div>
          </div>
        </div>
      </OttaLayout>
    </>
  );
}
