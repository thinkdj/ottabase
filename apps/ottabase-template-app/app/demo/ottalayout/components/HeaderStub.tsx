"use client";

import React from "react";

export function HeaderStub() {
  return (
    <div
      style={{
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "100%",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "rgba(255, 255, 255, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
          }}
        >
          O
        </div>
        <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "600" }}>
          OttaLayout Demo
        </h1>
      </div>
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <button
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            background: "rgba(255, 255, 255, 0.1)",
            color: "white",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Action
        </button>
      </div>
    </div>
  );
}
