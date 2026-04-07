/**
 * Unit tests for src/knowledge/papers/mock.ts — mock paper clients
 */

import { describe, test, expect } from "bun:test";
import {
  createMockPaper,
  createMockPapers,
  createMockArxivClient,
  createMockSemanticScholarClient,
} from "../../src/knowledge/papers/mock.js";
import type { PaperSearchQuery, ResearchPaper } from "../../src/knowledge/papers/types.js";

// ---------------------------------------------------------------------------
// createMockPaper
// ---------------------------------------------------------------------------

describe("createMockPaper", () => {
  test("creates a paper with default values", () => {
    const paper = createMockPaper();
    expect(paper.id).toBe("mock-paper-1");
    expect(paper.title).toBe("Attention Is All You Need");
    expect(paper.authors).toHaveLength(3);
    expect(paper.abstract.length).toBeGreaterThan(0);
    expect(paper.url).toContain("arxiv.org");
    expect(paper.arxivId).toBe("1706.03762");
    expect(paper.publishedDate).toBe("2017-06-12");
    expect(paper.topics).toContain("cs.CL");
    expect(paper.citations).toBe(90000);
    expect(paper.tldr).toBeTruthy();
    expect(paper.source).toBe("arxiv");
  });

  test("accepts custom overrides", () => {
    const paper = createMockPaper({
      id: "custom-1",
      title: "Custom Paper",
      authors: ["Me"],
      citations: 42,
    });
    expect(paper.id).toBe("custom-1");
    expect(paper.title).toBe("Custom Paper");
    expect(paper.authors).toEqual(["Me"]);
    expect(paper.citations).toBe(42);
    // Non-overridden fields keep defaults
    expect(paper.source).toBe("arxiv");
  });

  test("can override source", () => {
    const paper = createMockPaper({ source: "semantic-scholar" });
    expect(paper.source).toBe("semantic-scholar");
  });

  test("can override all fields", () => {
    const paper = createMockPaper({
      id: "x",
      title: "X",
      authors: [],
      abstract: "Y",
      url: "Z",
      arxivId: "0000.00000",
      publishedDate: "2020-01-01",
      topics: ["test"],
      citations: 0,
      tldr: "summary",
      source: "manual",
    });
    expect(paper.id).toBe("x");
    expect(paper.title).toBe("X");
    expect(paper.topics).toEqual(["test"]);
  });
});

// ---------------------------------------------------------------------------
// createMockPapers
// ---------------------------------------------------------------------------

describe("createMockPapers", () => {
  test("creates the requested number of papers", () => {
    const papers = createMockPapers(5);
    expect(papers).toHaveLength(5);
  });

  test("each paper has a unique id", () => {
    const papers = createMockPapers(10);
    const ids = papers.map(p => p.id);
    const uniqueIds = [...new Set(ids)];
    expect(uniqueIds.length).toBe(10);
  });

  test("creates zero papers", () => {
    const papers = createMockPapers(0);
    expect(papers).toHaveLength(0);
  });

  test("papers have varied titles", () => {
    const papers = createMockPapers(5);
    const titles = papers.map(p => p.title);
    const uniqueTitles = [...new Set(titles)];
    expect(uniqueTitles.length).toBe(5);
  });

  test("papers have valid publishedDate", () => {
    const papers = createMockPapers(5);
    for (const p of papers) {
      expect(p.publishedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("papers have topics", () => {
    const papers = createMockPapers(5);
    for (const p of papers) {
      expect(Array.isArray(p.topics)).toBe(true);
      expect(p.topics.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// createMockArxivClient
// ---------------------------------------------------------------------------

describe("createMockArxivClient", () => {
  test("returns a client with searchPapers method", () => {
    const client = createMockArxivClient();
    expect(typeof client.searchPapers).toBe("function");
  });

  test("searchPapers returns results matching query", async () => {
    const client = createMockArxivClient();
    const result = await client.searchPapers({ query: "attention", maxResults: 10 });
    expect(result.source).toBe("arxiv");
    expect(result.papers.length).toBeGreaterThan(0);
    expect(result.papers[0].source).toBe("arxiv");
  });

  test("searchPapers filters by query text", async () => {
    const papers: ResearchPaper[] = [
      { id: "p1", title: "Transformer Paper", authors: [], abstract: "About transformers.", url: "", publishedDate: "2024-01-01", topics: [] },
      { id: "p2", title: "Quantum Computing Paper", authors: [], abstract: "About quantum.", url: "", publishedDate: "2024-01-01", topics: [] },
    ];
    const client = createMockArxivClient(papers);

    const result = await client.searchPapers({ query: "transformer", maxResults: 10 });
    expect(result.papers).toHaveLength(1);
    expect(result.papers[0].title).toContain("Transformer");
  });

  test("searchPapers respects maxResults", async () => {
    const papers = createMockPapers(10).map(p => ({
      ...p,
      title: `Attention ${p.title}`,
    }));
    const client = createMockArxivClient(papers);

    const result = await client.searchPapers({ query: "attention", maxResults: 3 });
    expect(result.papers.length).toBeLessThanOrEqual(3);
  });

  test("searchPapers returns empty for non-matching query", async () => {
    const client = createMockArxivClient();
    const result = await client.searchPapers({ query: "xyznonexistent", maxResults: 10 });
    expect(result.papers).toHaveLength(0);
    expect(result.totalResults).toBe(0);
  });

  test("uses custom papers when provided", async () => {
    const custom = [createMockPaper({ title: "Custom Paper About Cats" })];
    const client = createMockArxivClient(custom);

    const result = await client.searchPapers({ query: "cats", maxResults: 10 });
    expect(result.papers).toHaveLength(1);
    expect(result.papers[0].title).toContain("Cats");
  });

  test("totalResults matches filtered count", async () => {
    const papers = createMockPapers(5).map(p => ({
      ...p,
      title: `Attention ${p.title}`,
    }));
    const client = createMockArxivClient(papers);

    const result = await client.searchPapers({ query: "attention", maxResults: 100 });
    expect(result.totalResults).toBe(result.papers.length);
  });
});

// ---------------------------------------------------------------------------
// createMockSemanticScholarClient
// ---------------------------------------------------------------------------

describe("createMockSemanticScholarClient", () => {
  test("returns a client with searchPapers and getPaper methods", () => {
    const client = createMockSemanticScholarClient();
    expect(typeof client.searchPapers).toBe("function");
    expect(typeof client.getPaper).toBe("function");
  });

  test("searchPapers returns results matching query", async () => {
    const client = createMockSemanticScholarClient();
    const result = await client.searchPapers({ query: "attention", maxResults: 10 });
    expect(result.source).toBe("semantic-scholar");
    expect(result.papers.length).toBeGreaterThan(0);
  });

  test("searchPapers filters by query text", async () => {
    const papers = [
      createMockPaper({ title: "Deep Learning Paper" }),
      createMockPaper({ id: "p2", title: "Gardening Tips" }),
    ];
    const client = createMockSemanticScholarClient(papers);

    const result = await client.searchPapers({ query: "deep learning", maxResults: 10 });
    expect(result.papers).toHaveLength(1);
    expect(result.papers[0].title).toContain("Deep Learning");
  });

  test("getPaper returns a specific paper by id", async () => {
    const papers = [
      createMockPaper({ id: "target-paper", title: "Target Paper" }),
      createMockPaper({ id: "other-paper", title: "Other Paper" }),
    ];
    const client = createMockSemanticScholarClient(papers);

    const paper = await client.getPaper("target-paper");
    expect(paper.title).toBe("Target Paper");
    expect(paper.source).toBe("semantic-scholar");
  });

  test("getPaper throws for non-existent paper", async () => {
    const client = createMockSemanticScholarClient();
    await expect(client.getPaper("nonexistent-id")).rejects.toThrow("Paper not found");
  });

  test("searchPapers sets source to semantic-scholar", async () => {
    const client = createMockSemanticScholarClient();
    const result = await client.searchPapers({ query: "attention", maxResults: 10 });
    for (const p of result.papers) {
      expect(p.source).toBe("semantic-scholar");
    }
  });

  test("searchPapers respects maxResults", async () => {
    const papers = createMockPapers(10).map(p => ({
      ...p,
      title: `Neural ${p.title}`,
    }));
    const client = createMockSemanticScholarClient(papers);

    const result = await client.searchPapers({ query: "neural", maxResults: 2 });
    expect(result.papers.length).toBeLessThanOrEqual(2);
  });

  test("uses default papers when none provided", async () => {
    const client = createMockSemanticScholarClient();
    const result = await client.searchPapers({ query: "attention", maxResults: 10 });
    expect(result.papers.length).toBeGreaterThan(0);
  });
});
