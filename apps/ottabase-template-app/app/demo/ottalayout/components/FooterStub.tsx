"use client";

import React from "react";

export function FooterStub() {
  return (
    <div
      style={{
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "100%",
        background: "#1a1a1a",
        color: "#888",
        fontSize: "14px",
        borderTop: "1px solid #333",
      }}
    >
      <div>© 2024 OttaLayout. All rights reserved.</div>
      <div style={{ display: "flex", gap: "20px" }}>
        <a href="#" style={{ color: "#888", textDecoration: "none" }}>
          Privacy
        </a>
        <a href="#" style={{ color: "#888", textDecoration: "none" }}>
          Terms
        </a>
        <a href="#" style={{ color: "#888", textDecoration: "none" }}>
          Contact
        </a>
      </div>
    </div>
  );
}
