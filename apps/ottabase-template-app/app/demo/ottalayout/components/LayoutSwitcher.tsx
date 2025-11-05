"use client";

import React, { useState } from "react";
import { getLayoutPresetNames, getLayoutPreset } from "@ottabase/ottalayout";

interface LayoutSwitcherProps {
  currentPreset: string;
  onPresetChange: (preset: string) => void;
}

export function LayoutSwitcher({
  currentPreset,
  onPresetChange,
}: LayoutSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const presetNames = getLayoutPresetNames();

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 10000,
      }}
    >
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            padding: "12px 20px",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600",
            boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow =
              "0 6px 16px rgba(102, 126, 234, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(102, 126, 234, 0.3)";
          }}
        >
          <span>🎨</span>
          <span>Layout Presets</span>
          <span style={{ marginLeft: "4px" }}>{isOpen ? "▲" : "▼"}</span>
        </button>

        {isOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              minWidth: "280px",
              background: "white",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
              border: "1px solid #e0e0e0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #e0e0e0",
                background: "#f8f9fa",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#666" }}>
                SELECT LAYOUT
              </div>
            </div>
            <div
              style={{
                maxHeight: "400px",
                overflowY: "auto",
              }}
            >
              {presetNames.map((presetName) => {
                const preset = getLayoutPreset(presetName);
                const isActive = currentPreset === presetName;

                return (
                  <button
                    key={presetName}
                    onClick={() => {
                      onPresetChange(presetName);
                      setIsOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      background: isActive
                        ? "rgba(102, 126, 234, 0.1)"
                        : "white",
                      border: "none",
                      borderBottom: "1px solid #f0f0f0",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "#f8f9fa";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "white";
                      }
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: "500",
                            color: isActive ? "#667eea" : "#333",
                            marginBottom: "4px",
                          }}
                        >
                          {preset?.name}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#666",
                          }}
                        >
                          {preset?.description}
                        </div>
                      </div>
                      {isActive && (
                        <div
                          style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background: "#667eea",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "12px",
                          }}
                        >
                          ✓
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Backdrop to close dropdown when clicking outside */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: -1,
          }}
        />
      )}
    </div>
  );
}
