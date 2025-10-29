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
          <div style={{ padding: "0 20px", display: "flex", alignItems: "center", height: "100%", width: "100%" }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>My App</h1>
          </div>
        ),
      }}
      navbar={{
        width: 300,
        children: (
          <div style={{ padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>Navigation</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              <li style={{ padding: "8px 0" }}>
                <a href="#home" style={{ textDecoration: "none", color: "#333" }}>Home</a>
              </li>
              <li style={{ padding: "8px 0" }}>
                <a href="#about" style={{ textDecoration: "none", color: "#333" }}>About</a>
              </li>
              <li style={{ padding: "8px 0" }}>
                <a href="#contact" style={{ textDecoration: "none", color: "#333" }}>Contact</a>
              </li>
            </ul>
          </div>
        ),
      }}
    >
      <div style={{ padding: 20 }}>
        <h2>Main Content</h2>
        <p>This is the main content area.</p>
        <p>The layout uses CSS Grid to create a flexible, responsive layout with smooth transitions.</p>
      </div>
    </OttaLayout>
  );
}

export default BasicExample;
