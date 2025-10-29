/**
 * Basic Example - Simple layout with header and navbar
 */
import React from "react";
import { OttaLayout } from "../src";
import "../styles/index.css";

export function BasicExample() {
  return (
    <OttaLayout
      header={{
        height: 60,
        children: (
          <div style={{ padding: "0 20px", display: "flex", alignItems: "center", height: "100%" }}>
            <h1>My App</h1>
          </div>
        ),
      }}
      navbar={{
        width: 300,
        children: (
          <div style={{ padding: 20 }}>
            <h3>Navigation</h3>
            <ul>
              <li>Home</li>
              <li>About</li>
              <li>Contact</li>
            </ul>
          </div>
        ),
      }}
    >
      <div style={{ padding: 20 }}>
        <h2>Main Content</h2>
        <p>This is the main content area.</p>
      </div>
    </OttaLayout>
  );
}
