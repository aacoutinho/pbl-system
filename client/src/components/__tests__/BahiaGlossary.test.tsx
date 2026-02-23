import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BahiaGlossary } from "../BahiaGlossary";

describe("BahiaGlossary", () => {
  it("renders compact version with all glossary terms", () => {
    render(<BahiaGlossary compact />);

    // Verify title
    expect(screen.getByText("Glossário Bahianês")).toBeTruthy();

    // Verify all evaluation concepts are present
    expect(screen.getByText(/Calado/)).toBeTruthy();
    expect(screen.getByText(/Paia/)).toBeTruthy();
    expect(screen.getByText(/Na estica/)).toBeTruthy();
    // Massa and Brocou may appear in text
    expect(screen.getByText(/Brocou/)).toBeTruthy();

    // Verify penalty terms
    expect(screen.getByText(/De boa/)).toBeTruthy();
    expect(screen.getByText(/Vacilou/)).toBeTruthy();
    expect(screen.getByText(/Pisou na bola/)).toBeTruthy();
    expect(screen.getByText(/Mancou feio/)).toBeTruthy();
    expect(screen.getByText(/Lascou tudo/)).toBeTruthy();
  });

  it("renders full version with section headers", () => {
    render(<BahiaGlossary />);

    // Verify main title
    expect(screen.getByText("Glossário Bahianês — Escala de Avaliação")).toBeTruthy();

    // Verify section headers
    expect(screen.getByText("Conceitos de Avaliação")).toBeTruthy();
    expect(screen.getByText("Penalidades (Desempenho no Papel)")).toBeTruthy();

    // Verify explanatory text
    expect(screen.getByText(/Expressões típicas da Bahia/)).toBeTruthy();
  });

  it("renders all 5 evaluation concepts in full version", () => {
    render(<BahiaGlossary />);

    const terms = ["Calado", "Paia", "Na estica", "Massa", "Brocou"];
    terms.forEach((term) => {
      expect(screen.getAllByText(term).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders all 5 penalty terms in full version", () => {
    render(<BahiaGlossary />);

    const terms = ["De boa", "Vacilou", "Pisou na bola", "Mancou feio", "Lascou tudo"];
    terms.forEach((term) => {
      expect(screen.getAllByText(term).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders correct numeric values for concepts in full version", () => {
    const { container } = render(<BahiaGlossary />);

    // Check that the container has all the numeric values
    const text = container.textContent || "";
    expect(text).toContain("0");
    expect(text).toContain("0.25");
    expect(text).toContain("0.5");
    expect(text).toContain("0.75");
    expect(text).toContain("1.0");
  });

  it("compact version includes penalty section", () => {
    const { container } = render(<BahiaGlossary compact />);

    const text = container.textContent || "";
    expect(text).toContain("Penalidades");
    expect(text).toContain("Desempenho no Papel");
  });
});
