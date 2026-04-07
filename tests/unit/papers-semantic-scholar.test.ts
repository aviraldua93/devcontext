/**
 * Unit tests for src/knowledge/papers/semantic-scholar.ts — S2 JSON parsing
 */

import { describe, test, expect } from "bun:test";
import { mapS2Paper } from "../../src/knowledge/papers/semantic-scholar.js";

// ---------------------------------------------------------------------------
// Sample S2 paper objects
// ---------------------------------------------------------------------------

const SAMPLE_S2_FULL = {
  paperId: "abc123def456",
  title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
  abstract: "Large pre-trained language models have been shown to store factual knowledge in their parameters. We explore a general-purpose fine-tuning recipe for retrieval-augmented generation.",
  authors: [
    { authorId: "1", name: "Patrick Lewis" },
    { authorId: "2", name: "Ethan Perez" },
    { authorId: "3", name: "Aleksandra Piktus" },
  ],
  url: "https://www.semanticscholar.org/paper/abc123def456",
  year: 2020,
  citationCount: 3500,
  tldr: { text: "Introduces RAG: combining retrieval with generation for knowledge-intensive tasks." },
  externalIds: { ArXiv: "2005.11401", DOI: "10.5555/3495724.3496517" },
  fieldsOfStudy: ["Computer Science"],
  publicationDate: "2020-05-22",
};

const SAMPLE_S2_MINIMAL = {
  paperId: "min-paper-id",
  title: "A Minimal S2 Paper",
  abstract: null,
  authors: [],
  url: "https://www.semanticscholar.org/paper/min-paper-id",
  year: null,
  citationCount: null,
  tldr: null,
  externalIds: null,
  fieldsOfStudy: null,
  publicationDate: null,
};

const SAMPLE_S2_NO_ARXIV = {
  paperId: "no-arxiv-id",
  title: "Paper Without ArXiv ID",
  abstract: "This paper is not on arXiv.",
  authors: [{ authorId: "10", name: "Journal Author" }],
  url: "https://www.semanticscholar.org/paper/no-arxiv-id",
  year: 2023,
  citationCount: 50,
  tldr: null,
  externalIds: { DOI: "10.1234/test" },
  fieldsOfStudy: ["Computer Science", "Mathematics"],
  publicationDate: "2023-06-15",
};

const SAMPLE_S2_ZERO_CITATIONS = {
  paperId: "zero-cit",
  title: "Brand New Paper",
  abstract: "Just published, no citations yet.",
  authors: [{ authorId: "20", name: "Fresh Author" }],
  url: "https://www.semanticscholar.org/paper/zero-cit",
  year: 2024,
  citationCount: 0,
  tldr: { text: "A new paper with zero citations." },
  externalIds: { ArXiv: "2401.99999" },
  fieldsOfStudy: ["Computer Science"],
  publicationDate: "2024-01-20",
};

// ---------------------------------------------------------------------------
// mapS2Paper
// ---------------------------------------------------------------------------

describe("mapS2Paper", () => {
  test("maps a full S2 paper correctly", () => {
    const paper = mapS2Paper(SAMPLE_S2_FULL);
    expect(paper.id).toBe("s2-abc123def456");
    expect(paper.title).toBe("Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks");
    expect(paper.authors).toEqual(["Patrick Lewis", "Ethan Perez", "Aleksandra Piktus"]);
    expect(paper.abstract).toContain("retrieval-augmented generation");
    expect(paper.url).toContain("semanticscholar.org");
    expect(paper.arxivId).toBe("2005.11401");
    expect(paper.publishedDate).toBe("2020-05-22");
    expect(paper.topics).toContain("Computer Science");
    expect(paper.citations).toBe(3500);
    expect(paper.tldr).toContain("RAG");
    expect(paper.source).toBe("semantic-scholar");
  });

  test("handles minimal paper with nulls", () => {
    const paper = mapS2Paper(SAMPLE_S2_MINIMAL);
    expect(paper.id).toBe("s2-min-paper-id");
    expect(paper.title).toBe("A Minimal S2 Paper");
    expect(paper.authors).toEqual([]);
    expect(paper.abstract).toBe("");
    expect(paper.arxivId).toBeUndefined();
    expect(paper.topics).toEqual([]);
    expect(paper.citations).toBeUndefined();
    expect(paper.tldr).toBeUndefined();
    expect(paper.source).toBe("semantic-scholar");
  });

  test("generates publishedDate from year when publicationDate is null", () => {
    const s2Paper = { ...SAMPLE_S2_MINIMAL, year: 2022 };
    const paper = mapS2Paper(s2Paper);
    expect(paper.publishedDate).toBe("2022-01-01");
  });

  test("defaults publishedDate to today when both are null", () => {
    const paper = mapS2Paper(SAMPLE_S2_MINIMAL);
    expect(paper.publishedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("handles paper without ArXiv external ID", () => {
    const paper = mapS2Paper(SAMPLE_S2_NO_ARXIV);
    expect(paper.arxivId).toBeUndefined();
  });

  test("maps multiple fields of study as topics", () => {
    const paper = mapS2Paper(SAMPLE_S2_NO_ARXIV);
    expect(paper.topics).toContain("Computer Science");
    expect(paper.topics).toContain("Mathematics");
    expect(paper.topics).toHaveLength(2);
  });

  test("maps zero citations correctly", () => {
    const paper = mapS2Paper(SAMPLE_S2_ZERO_CITATIONS);
    expect(paper.citations).toBe(0);
  });

  test("extracts ArXiv ID from externalIds", () => {
    const paper = mapS2Paper(SAMPLE_S2_ZERO_CITATIONS);
    expect(paper.arxivId).toBe("2401.99999");
  });

  test("source is always semantic-scholar", () => {
    const papers = [SAMPLE_S2_FULL, SAMPLE_S2_MINIMAL, SAMPLE_S2_NO_ARXIV, SAMPLE_S2_ZERO_CITATIONS];
    for (const s2 of papers) {
      expect(mapS2Paper(s2).source).toBe("semantic-scholar");
    }
  });

  test("id is prefixed with s2-", () => {
    const paper = mapS2Paper(SAMPLE_S2_FULL);
    expect(paper.id.startsWith("s2-")).toBe(true);
  });

  test("id is deterministic for same paperId", () => {
    const paper1 = mapS2Paper(SAMPLE_S2_FULL);
    const paper2 = mapS2Paper(SAMPLE_S2_FULL);
    expect(paper1.id).toBe(paper2.id);
  });

  test("handles empty authors array", () => {
    const paper = mapS2Paper(SAMPLE_S2_MINIMAL);
    expect(paper.authors).toEqual([]);
    expect(Array.isArray(paper.authors)).toBe(true);
  });

  test("handles paper with only DOI external ID", () => {
    const s2 = {
      ...SAMPLE_S2_NO_ARXIV,
      externalIds: { DOI: "10.1234/test" },
    };
    const paper = mapS2Paper(s2);
    expect(paper.arxivId).toBeUndefined();
  });

  test("tldr is extracted from text field", () => {
    const paper = mapS2Paper(SAMPLE_S2_FULL);
    expect(paper.tldr).toBe("Introduces RAG: combining retrieval with generation for knowledge-intensive tasks.");
  });

  test("tldr is undefined when null", () => {
    const paper = mapS2Paper(SAMPLE_S2_MINIMAL);
    expect(paper.tldr).toBeUndefined();
  });
});
