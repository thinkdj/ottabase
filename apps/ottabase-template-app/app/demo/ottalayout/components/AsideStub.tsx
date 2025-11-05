"use client";

import React from "react";

const activities = [
  { time: "2 min ago", text: "Task completed", icon: "✓" },
  { time: "15 min ago", text: "New comment", icon: "💬" },
  { time: "1 hour ago", text: "File uploaded", icon: "📎" },
  { time: "2 hours ago", text: "Meeting scheduled", icon: "📅" },
];

export function AsideStub() {
  return (
    <div
      style={{
        padding: "20px",
        height: "100%",
        background: "#f8f9fa",
        borderLeft: "1px solid #e0e0e0",
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
          Activity Feed
        </h3>
      </div>

      <div>
        {activities.map((activity, index) => (
          <div
            key={index}
            style={{
              marginBottom: "16px",
              paddingBottom: "16px",
              borderBottom:
                index < activities.length - 1 ? "1px solid #e0e0e0" : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "start",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "rgba(102, 126, 234, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  flexShrink: 0,
                }}
              >
                {activity.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#333",
                    marginBottom: "4px",
                  }}
                >
                  {activity.text}
                </div>
                <div style={{ fontSize: "12px", color: "#999" }}>
                  {activity.time}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "24px",
          padding: "16px",
          borderRadius: "8px",
          background: "#fff",
          border: "1px solid #e0e0e0",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: "600",
            color: "#333",
            marginBottom: "8px",
          }}
        >
          Quick Stats
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", color: "#666" }}>Tasks</span>
            <span style={{ fontSize: "12px", fontWeight: "600" }}>24</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", color: "#666" }}>Projects</span>
            <span style={{ fontSize: "12px", fontWeight: "600" }}>8</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", color: "#666" }}>Team</span>
            <span style={{ fontSize: "12px", fontWeight: "600" }}>12</span>
          </div>
        </div>
      </div>
    </div>
  );
}
