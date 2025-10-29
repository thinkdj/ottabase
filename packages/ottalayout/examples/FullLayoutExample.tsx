/**
 * Full Layout Example - Layout with all sections
 */
import React from "react";
import { OttaLayout, useOttaLayout } from "../src";
import "../styles/index.css";

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  marginLeft: "8px",
  border: "1px solid #ccc",
  borderRadius: "4px",
  backgroundColor: "#fff",
  cursor: "pointer",
  fontSize: "14px",
};

export function FullLayoutExample() {
  const layout = useOttaLayout({
    initialNavbarOpened: true,
    initialAsideOpened: true,
  });

  return (
    <OttaLayout
      header={{
        height: 60,
        collapsed: !layout.headerVisible,
        children: (
          <div style={{ padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "100%", width: "100%" }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Full Layout</h1>
            <div>
              <button onClick={layout.toggleNavbar} style={buttonStyle}>
                Toggle Navbar
              </button>
              <button onClick={layout.toggleAside} style={buttonStyle}>
                Toggle Aside
              </button>
              <button onClick={layout.toggleFooter} style={buttonStyle}>
                Toggle Footer
              </button>
            </div>
          </div>
        ),
      }}
      navbar={{
        width: 300,
        collapsed: !layout.navbarOpened,
        children: (
          <div style={{ padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>Left Navigation</h3>
            <nav>
              <ul style={{ listStyle: "none", padding: 0 }}>
                <li style={{ padding: "8px 0" }}>
                  <a href="#dashboard" style={{ textDecoration: "none", color: "#333" }}>Dashboard</a>
                </li>
                <li style={{ padding: "8px 0" }}>
                  <a href="#projects" style={{ textDecoration: "none", color: "#333" }}>Projects</a>
                </li>
                <li style={{ padding: "8px 0" }}>
                  <a href="#tasks" style={{ textDecoration: "none", color: "#333" }}>Tasks</a>
                </li>
                <li style={{ padding: "8px 0" }}>
                  <a href="#settings" style={{ textDecoration: "none", color: "#333" }}>Settings</a>
                </li>
              </ul>
            </nav>
          </div>
        ),
      }}
      aside={{
        width: 300,
        collapsed: !layout.asideOpened,
        children: (
          <div style={{ padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>Right Sidebar</h3>
            <div>
              <h4 style={{ fontSize: "1rem", marginBottom: "8px" }}>Activity Feed</h4>
              <p style={{ fontSize: "0.9rem", color: "#666" }}>Recent activities will appear here...</p>
              <ul style={{ listStyle: "none", padding: 0, marginTop: "16px" }}>
                <li style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                  <small style={{ color: "#999" }}>2 hours ago</small>
                  <p style={{ margin: "4px 0", fontSize: "0.9rem" }}>Task completed</p>
                </li>
                <li style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                  <small style={{ color: "#999" }}>5 hours ago</small>
                  <p style={{ margin: "4px 0", fontSize: "0.9rem" }}>New comment</p>
                </li>
              </ul>
            </div>
          </div>
        ),
      }}
      footer={{
        height: 60,
        collapsed: !layout.footerVisible,
        children: (
          <div style={{ padding: "0 20px", display: "flex", alignItems: "center", height: "100%" }}>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>
              © 2024 My App. All rights reserved.
            </p>
          </div>
        ),
      }}
    >
      <div style={{ padding: 20 }}>
        <h2>Main Content Area</h2>
        <p>This layout includes all possible sections:</p>
        <ul>
          <li><strong>Header</strong> (top) - with toggle controls</li>
          <li><strong>Navbar</strong> (left sidebar) - collapsible</li>
          <li><strong>Aside</strong> (right sidebar) - collapsible</li>
          <li><strong>Footer</strong> (bottom) - collapsible</li>
          <li><strong>Main content</strong> (this area)</li>
        </ul>
        <p>Use the buttons in the header to toggle each section and see the smooth transitions!</p>

        <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "#f9f9f9", borderRadius: "4px" }}>
          <h3 style={{ marginTop: 0 }}>Current State:</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            <li>Navbar: {layout.navbarOpened ? "✓ Open" : "✗ Closed"}</li>
            <li>Aside: {layout.asideOpened ? "✓ Open" : "✗ Closed"}</li>
            <li>Header: {layout.headerVisible ? "✓ Visible" : "✗ Hidden"}</li>
            <li>Footer: {layout.footerVisible ? "✓ Visible" : "✗ Hidden"}</li>
          </ul>
        </div>
      </div>
    </OttaLayout>
  );
}

export default FullLayoutExample;
