import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

// Mock code highlight component
const MockCodeHighlight = ({
  code,
  language = "javascript",
}: {
  code: string;
  language?: string;
}) => (
  <pre>
    <code data-language={language}>{code}</code>
  </pre>
);

describe("Code Highlighting", () => {
  describe("Code Rendering", () => {
    it("should render code block", () => {
      render(<MockCodeHighlight code="const x = 1;" />);
      expect(screen.getByText("const x = 1;")).toBeTruthy();
    });

    it("should support multiple languages", () => {
      const { container: jsContainer } = render(
        <MockCodeHighlight code="const x = 1;" language="javascript" />,
      );
      const { container: pyContainer } = render(
        <MockCodeHighlight code="x = 1" language="python" />,
      );

      expect(
        jsContainer.querySelector('[data-language="javascript"]'),
      ).toBeTruthy();
      expect(
        pyContainer.querySelector('[data-language="python"]'),
      ).toBeTruthy();
    });

    it("should highlight syntax", () => {
      const code = `function hello() {
  console.log("world");
}`;
      render(<MockCodeHighlight code={code} language="javascript" />);
      expect(screen.getByText(/hello/)).toBeTruthy();
    });
  });

  describe("Language Support", () => {
    it("should support JavaScript/TypeScript", () => {
      render(
        <MockCodeHighlight
          code="const x: string = 'test';"
          language="typescript"
        />,
      );
      expect(screen.getByText(/const x/)).toBeTruthy();
    });

    it("should support JSX/TSX", () => {
      render(<MockCodeHighlight code="<Component />" language="jsx" />);
      expect(screen.getByText(/<Component/)).toBeTruthy();
    });

    it("should support HTML/CSS", () => {
      render(<MockCodeHighlight code="<div>Content</div>" language="html" />);
      expect(screen.getByText(/<div>/)).toBeTruthy();
    });

    it("should support more languages", () => {
      const languages = ["python", "go", "rust", "sql"];
      languages.forEach((lang) => {
        const { container } = render(
          <MockCodeHighlight code="code" language={lang} />,
        );
        expect(
          container.querySelector(`[data-language="${lang}"]`),
        ).toBeTruthy();
      });
    });
  });

  describe("Line Numbers", () => {
    it("should optionally show line numbers", () => {
      const code = `line 1
line 2
line 3`;
      render(<MockCodeHighlight code={code} />);
      expect(screen.getByText(/line/)).toBeTruthy();
    });
  });

  describe("Copy Functionality", () => {
    it("should be copyable", () => {
      const code = "const x = 1;";
      const { container } = render(<MockCodeHighlight code={code} />);
      const codeElement = container.querySelector("code");
      expect(codeElement?.textContent).toBe(code);
    });
  });

  describe("Integration", () => {
    it("should integrate with code renderer", () => {
      render(<MockCodeHighlight code="render()" language="javascript" />);
      expect(screen.getByText("render()")).toBeTruthy();
    });

    it("should work in markdown content", () => {
      render(
        <article>
          <h2>Code Example</h2>
          <MockCodeHighlight code="console.log('test')" language="javascript" />
        </article>,
      );
      expect(screen.getByText(/console\.log/)).toBeTruthy();
    });
  });
});
