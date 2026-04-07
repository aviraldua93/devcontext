/**
 * Unit tests for src/knowledge/papers/types.ts — paper type validation
 */

import { describe, test, expect } from "bun:test";
import type {
  ResearchPaper,
  PaperSource,
  PaperSearchQuery,
  PaperSearchResult,
  CurationConfig,
  IngestResult,
  ArxivClient,
  SemanticScholarClient,
} from "../../src/knowledge/papers/types.js";

// ---------------------------------------------------------------------------
// ResearchPaper type shape
// ---------------------------------------------------------------------------

describe("ResearchPaper type", () => {
  test("accepts a fully populated paper", () => {
    const paper: ResearchPaper = {
      id: "test-paper-1",
      title: "Test Paper",
      authors: ["Author A", "Author B"],
      abstract: "This is a test abstract.",
      url: "https://example.com/paper",
      arxivId: "2301.00001",
      publishedDate: "2023-01-01",
      topics: ["cs.AI", "cs.LG"],
      citations: 42,
      tldr: "A test paper for testing.",
      source: "arxiv",
    };
    expect(paper.id).toBe("test-paper-1");
    expect(paper.title).toBe("Test Paper");
    expect(paper.authors).toHaveLength(2);
    expect(paper.topics).toContain("cs.AI");
    expect(paper.citations).toBe(42);
    expect(paper.tldr).toBe("A test paper for testing.");
  });

  test("accepts a minimal paper (optional fields omitted)", () => {
    const paper: ResearchPaper = {
      id: "min-paper",
      title: "Minimal",
      authors: [],
      abstract: "",
      url: "https://example.com",
      publishedDate: "2024-01-01",
      topics: [],
    };
    expect(paper.arxivId).toBeUndefined();
    expect(paper.citations).toBeUndefined();
    expect(paper.tldr).toBeUndefined();
    expect(paper.source).toBeUndefined();
  });

  test("id is a non-empty string", () => {
    const paper: ResearchPaper = {
      id: "abc-123",
      title: "T",
      authors: [],
      abstract: "",
      url: "",
      publishedDate: "2024-01-01",
      topics: [],
    };
    expect(typeof paper.id).toBe("string");
    expect(paper.id.length).toBeGreaterThan(0);
  });

  test("publishedDate is a valid ISO date string", () => {
    const paper: ResearchPaper = {
      id: "x",
      title: "T",
      authors: [],
      abstract: "",
      url: "",
      publishedDate: "2024-06-15",
      topics: [],
    };
    expect(paper.publishedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("authors is an array of strings", () => {
    const paper: ResearchPaper = {
      id: "x",
      title: "T",
      authors: ["Alice", "Bob", "Charlie"],
      abstract: "",
      url: "",
      publishedDate: "2024-01-01",
      topics: [],
    };
    expect(Array.isArray(paper.authors)).toBe(true);
    expect(paper.authors.every(a => typeof a === "string")).toBe(true);
  });

  test("topics is an array of strings", () => {
    const paper: ResearchPaper = {
      id: "x",
      title: "T",
      authors: [],
      abstract: "",
      url: "",
      publishedDate: "2024-01-01",
      topics: ["cs.AI", "cs.CL"],
    };
    expect(paper.topics.every(t => typeof t === "string")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PaperSource type
// ---------------------------------------------------------------------------

describe("PaperSource type", () => {
  test("accepts arxiv", () => {
    const source: PaperSource = "arxiv";
    expect(source).toBe("arxiv");
  });

  test("accepts semantic-scholar", () => {
    const source: PaperSource = "semantic-scholar";
    expect(source).toBe("semantic-scholar");
  });

  test("accepts manual", () => {
    const source: PaperSource = "manual";
    expect(source).toBe("manual");
  });
});

// ---------------------------------------------------------------------------
// PaperSearchQuery type
// ---------------------------------------------------------------------------

describe("PaperSearchQuery type", () => {
  test("accepts a basic query", () => {
    const query: PaperSearchQuery = {
      query: "transformer attention",
      maxResults: 10,
    };
    expect(query.query).toBe("transformer attention");
    expect(query.maxResults).toBe(10);
    expect(query.dateRange).toBeUndefined();
    expect(query.topics).toBeUndefined();
  });

  test("accepts query with all optional fields", () => {
    const query: PaperSearchQuery = {
      query: "LLM scaling",
      maxResults: 50,
      dateRange: ["2023-01-01", "2024-12-31"],
      topics: ["cs.AI", "cs.CL"],
    };
    expect(query.dateRange).toHaveLength(2);
    expect(query.topics).toHaveLength(2);
  });

  test("dateRange is a tuple of two strings", () => {
    const query: PaperSearchQuery = {
      query: "test",
      maxResults: 5,
      dateRange: ["2023-01-01", "2023-12-31"],
    };
    expect(query.dateRange![0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(query.dateRange![1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// PaperSearchResult type
// ---------------------------------------------------------------------------

describe("PaperSearchResult type", () => {
  test("accepts a result with papers", () => {
    const result: PaperSearchResult = {
      papers: [{
        id: "p1",
        title: "Paper One",
        authors: ["A"],
        abstract: "Abstract",
        url: "https://example.com",
        publishedDate: "2024-01-01",
        topics: ["cs.AI"],
      }],
      totalResults: 100,
      source: "arxiv",
    };
    expect(result.papers).toHaveLength(1);
    expect(result.totalResults).toBe(100);
    expect(result.source).toBe("arxiv");
  });

  test("accepts empty results", () => {
    const result: PaperSearchResult = {
      papers: [],
      totalResults: 0,
      source: "semantic-scholar",
    };
    expect(result.papers).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// CurationConfig type
// ---------------------------------------------------------------------------

describe("CurationConfig type", () => {
  test("accepts a full config", () => {
    const config: CurationConfig = {
      topics: ["transformers", "attention"],
      keywords: ["self-attention", "multi-head"],
      minRelevanceScore: 0.3,
      maxPapersPerDay: 10,
      sources: ["arxiv", "semantic-scholar"],
    };
    expect(config.topics).toHaveLength(2);
    expect(config.keywords).toHaveLength(2);
    expect(config.minRelevanceScore).toBe(0.3);
    expect(config.maxPapersPerDay).toBe(10);
    expect(config.sources).toContain("arxiv");
  });

  test("minRelevanceScore is between 0 and 1", () => {
    const config: CurationConfig = {
      topics: [],
      keywords: [],
      minRelevanceScore: 0.5,
      maxPapersPerDay: 5,
      sources: ["arxiv"],
    };
    expect(config.minRelevanceScore).toBeGreaterThanOrEqual(0);
    expect(config.minRelevanceScore).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// IngestResult type
// ---------------------------------------------------------------------------

describe("IngestResult type", () => {
  test("accepts a mixed result", () => {
    const result: IngestResult = {
      ingested: [{ paperId: "p1", slug: "paper-one" }],
      skipped: [{ paperId: "p2", reason: "Already ingested" }],
      errors: [{ paperId: "p3", error: "Parse failure" }],
    };
    expect(result.ingested).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });

  test("accepts an empty result", () => {
    const result: IngestResult = {
      ingested: [],
      skipped: [],
      errors: [],
    };
    expect(result.ingested).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Client interfaces
// ---------------------------------------------------------------------------

describe("ArxivClient interface", () => {
  test("can be implemented with a mock", () => {
    const client: ArxivClient = {
      async searchPapers(_query) {
        return { papers: [], totalResults: 0, source: "arxiv" };
      },
    };
    expect(typeof client.searchPapers).toBe("function");
  });
});

describe("SemanticScholarClient interface", () => {
  test("can be implemented with a mock", () => {
    const client: SemanticScholarClient = {
      async searchPapers(_query) {
        return { papers: [], totalResults: 0, source: "semantic-scholar" };
      },
      async getPaper(_id) {
        return {
          id: "x", title: "X", authors: [], abstract: "", url: "",
          publishedDate: "2024-01-01", topics: [],
        };
      },
    };
    expect(typeof client.searchPapers).toBe("function");
    expect(typeof client.getPaper).toBe("function");
  });
});
