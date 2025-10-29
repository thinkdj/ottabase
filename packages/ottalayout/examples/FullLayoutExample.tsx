/**
 * Full Layout Example - Layout with all sections
 */
import React from "react";
import { OttaLayout, useOttaLayout } from "../src";
import "../styles/index.css";

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
          <div style={{ padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "100%" }}>
            <h1>Full Layout</h1>
            <div>
              <button onClick={layout.toggleNavbar}>Toggle Navbar</button>
              <button onClick={layout.toggleAside}>Toggle Aside</button>
              <button onClick={layout.toggleFooter}>Toggle Footer</button>
            </div>
          </div>
        ),
      }}
      navbar={{
        width: 300,
        collapsed: !layout.navbarOpened,
        children: (
          <div style={{ padding: 20 }}>
            <h3>Left Navigation</h3>
            <nav>
              <ul>
                <li>Dashboard</li>
                <li>Projects</li>
                <li>Tasks</li>
                <li>Settings</li>
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
            <h3>Right Sidebar</h3>
            <div>
              <h4>Activity Feed</h4>
              <p>Recent activities will appear here...</p>
            </div>
          </div>
        ),
      }}
      footer={{
        height: 60,
        collapsed: !layout.footerVisible,
        children: (
          <div style={{ padding: "0 20px", display: "flex", alignItems: "center", height: "100%" }}>
            <p>&copy; 2024 My App. All rights reserved.</p>
          </div>
        ),
      }}
    >
      <div style={{ padding: 20 }}>
        <h2>Main Content Area</h2>
        <p>This layout includes all possible sections:</p>
        <ul>
          <li>Header (top)</li>
          <li>Navbar (left sidebar)</li>
          <li>Aside (right sidebar)</li>
          <li>Footer (bottom)</li>
          <li>Main content (this area)</li>
        </ul>
        <p>Use the buttons in the header to toggle each section and see the smooth transitions!</p>
      </div>
    </OttaLayout>
  );
}
