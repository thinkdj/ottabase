"use client";

import React from "react";

const menuItems = [
  { icon: "📊", label: "Dashboard", active: true },
  { icon: "📁", label: "Projects" },
  { icon: "✅", label: "Tasks" },
  { icon: "👥", label: "Team" },
  { icon: "📈", label: "Analytics" },
  { icon: "⚙️", label: "Settings" },
];

export function NavbarStub() {
  return (
    <div
      style={{
        padding: "20px",
        height: "100%",
        background: "#f8f9fa",
        borderRight: "1px solid #e0e0e0",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
        <h3
          style={{
            margin: "0 0 8px 0",
            fontSize: "12px",
            fontWeight: "600",
            textTransform: "uppercase",
            color: "#666",
            letterSpacing: "0.5px",
          }}
        >
          Navigation
        </h3>
      </div>

      <nav>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {menuItems.map((item, index) => (
            <li key={index} style={{ marginBottom: "4px" }}>
              <a
                href="#"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  color: item.active ? "#667eea" : "#333",
                  background: item.active
                    ? "rgba(102, 126, 234, 0.1)"
                    : "transparent",
                  fontWeight: item.active ? "500" : "400",
                  transition: "all 150ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!item.active) {
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!item.active) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <span style={{ fontSize: "18px" }}>{item.icon}</span>
                <span style={{ fontSize: "14px" }}>{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div
        style={{
          marginTop: "32px",
          padding: "16px",
          borderRadius: "8px",
          background: "rgba(102, 126, 234, 0.1)",
          border: "1px solid rgba(102, 126, 234, 0.2)",
        }}
      >
        <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
          💡 Pro Tip
        </div>
        <div style={{ fontSize: "13px", color: "#333", lineHeight: "1.5" }}>
          Use the layout switcher in the top-right to try different layouts!
        </div>
      </div>
    </div>
  );
}
