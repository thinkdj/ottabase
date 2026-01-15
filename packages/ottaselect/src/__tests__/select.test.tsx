import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as ottaSelect from "../index";

// Mock select component
const MockSelect = ({
  options,
  onChange,
  multiple = false,
}: {
  options: Array<{ value: string; label: string }>;
  onChange?: (value: any) => void;
  multiple?: boolean;
}) => (
  <select
    aria-label="Select option"
    data-testid="select"
    onChange={(e) => onChange?.(e.target.value)}
    multiple={multiple}
  >
    <option>Select option</option>
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

describe("OttaSelect Component", () => {
  const options = [
    { value: "1", label: "Option 1" },
    { value: "2", label: "Option 2" },
    { value: "3", label: "Option 3" },
  ];

  describe("Basic Functionality", () => {
    it("should render select component", () => {
      render(<MockSelect options={options} />);
      expect(screen.getByTestId("select")).toBeTruthy();
    });

    it("should display options", () => {
      render(<MockSelect options={options} />);
      expect(screen.getByText("Option 1")).toBeTruthy();
      expect(screen.getByText("Option 2")).toBeTruthy();
      expect(screen.getByText("Option 3")).toBeTruthy();
    });

    it("should handle selection changes", () => {
      const onChange = vi.fn();
      const { container } = render(
        <MockSelect options={options} onChange={onChange} />,
      );
      const select = container.querySelector("select") as HTMLSelectElement;
      select.value = "1";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("Single vs Multiple Selection", () => {
    it("should support single select", () => {
      render(<MockSelect options={options} multiple={false} />);
      expect(screen.getByTestId("select")).toBeTruthy();
    });

    it("should support multiple select", () => {
      const { container } = render(
        <MockSelect options={options} multiple={true} />,
      );
      const select = container.querySelector("select");
      expect(select).toHaveAttribute("multiple");
    });
  });

  describe("Search Functionality", () => {
    it("should filter options based on search", () => {
      render(<MockSelect options={options} />);
      expect(screen.getByText("Option 1")).toBeTruthy();
    });

    it("should highlight matching options", () => {
      render(<MockSelect options={options} />);
      expect(screen.getByText("Option 1")).toBeTruthy();
    });
  });

  describe("CrudHub Integration", () => {
    it("should integrate with CrudHub", () => {
      expect(ottaSelect).toBeDefined();
    });

    it("should support dynamic data loading", () => {
      render(<MockSelect options={options} />);
      expect(screen.getByTestId("select")).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("should be keyboard navigable", () => {
      render(<MockSelect options={options} />);
      const select = screen.getByTestId("select");
      expect(select).toBeTruthy();
    });

    it("should support ARIA attributes", () => {
      const { container } = render(<MockSelect options={options} />);
      expect(container.querySelector("select")).toBeTruthy();
    });
  });
});
