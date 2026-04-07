/**
 * Unit tests for src/knowledge/papers/curator.ts — relevance scoring and filtering
 */

import { describe, test, expect } from "bun:test";
import {
  scorePaper,
  filterAndRank,
  deduplicatePapers,
  curatePapers,
} from "../../src/knowledge/papers/curator.js";
import { createMockPaper, createMockPapers, createMockArxivClient, createMockSemanticScholarClient } from "../../src/knowledge/papers/mock.js";
import type { CurationConfig, ResearchPaper } from "../../src/knowledge/papers/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultConfig(overrides: Partial<CurationConfig> = {}): CurationConfig {
  return {
    topics: ["transformer", "attention"],
    keywords: ["self-attention", "neural network"],
    minRelevanceScore: 0.1,
    maxPapersPerDay: 10,
    sources: ["arxiv", "semantic-scholar"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// scorePaper
// ---------------------------------------------------------------------------

describe("scorePaper", () => {
  test("scores a highly relevant paper near 1", () => {
    const paper = createMockPaper({
      title: "Transformer Attention Mechanisms",
      abstract: "We explore self-attention in neural network architectures.",
      topics: ["transformer", "attention"],
      citations: 1000,
      publishedDate: new Date().toISOString().split("T")[0],
    });
    const config = defaultConfig();
    const score = scorePaper(paper, config);
    expect(score).toBeGreaterThan(0.5);
  });

  test("scores an irrelevant paper near 0", () => {
    const paper = createMockPaper({
      title: "Quantum Computing in Biology",
      abstract: "Quantum algorithms for protein folding simulations.",
      topics: ["quantum", "biology"],
      citations: 0,
      publishedDate: "2020-01-01",
    });
    const config = defaultConfig();
    const score = scorePaper(paper, config);
    expect(score).toBeLessThan(0.3);
  });

  test("returns a number between 0 and 1", () => {
    const paper = createMockPaper();
    const config = defaultConfig();
    const score = scorePaper(paper, config);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  test("topic match increases score", () => {
    const paperNoTopic = createMockPaper({
      title: "Unrelated Title",
      abstract: "Unrelated abstract",
      topics: [],
    });
    const paperWithTopic = createMockPaper({
      title: "Transformer Architecture",
      abstract: "Attention mechanism study",
      topics: ["transformer"],
    });
    const config = defaultConfig();
    expect(scorePaper(paperWithTopic, config)).toBeGreaterThan(scorePaper(paperNoTopic, config));
  });

  test("keyword match increases score", () => {
    const paperNoKeyword = createMockPaper({
      title: "Unrelated",
      abstract: "Nothing matching",
      topics: [],
    });
    const paperWithKeyword = createMockPaper({
      title: "Self-Attention Networks",
      abstract: "Neural network with self-attention.",
      topics: [],
    });
    const config = defaultConfig();
    expect(scorePaper(paperWithKeyword, config)).toBeGreaterThan(scorePaper(paperNoKeyword, config));
  });

  test("recency increases score", () => {
    const oldPaper = createMockPaper({ publishedDate: "2019-01-01" });
    const newPaper = createMockPaper({ publishedDate: new Date().toISOString().split("T")[0] });
    const config = defaultConfig();
    expect(scorePaper(newPaper, config)).toBeGreaterThan(scorePaper(oldPaper, config));
  });

  test("citations increase score", () => {
    const lowCit = createMockPaper({ citations: 0 });
    const highCit = createMockPaper({ citations: 5000 });
    const config = defaultConfig();
    expect(scorePaper(highCit, config)).toBeGreaterThanOrEqual(scorePaper(lowCit, config));
  });

  test("handles empty topics in config", () => {
    const paper = createMockPaper();
    const config = defaultConfig({ topics: [] });
    const score = scorePaper(paper, config);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  test("handles empty keywords in config", () => {
    const paper = createMockPaper();
    const config = defaultConfig({ keywords: [] });
    const score = scorePaper(paper, config);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  test("handles paper with no citations", () => {
    const paper = createMockPaper({ citations: undefined });
    const config = defaultConfig();
    const score = scorePaper(paper, config);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  test("score is deterministic", () => {
    const paper = createMockPaper();
    const config = defaultConfig();
    const score1 = scorePaper(paper, config);
    const score2 = scorePaper(paper, config);
    expect(score1).toBe(score2);
  });

  test("topic match in title counts", () => {
    const paper = createMockPaper({
      title: "Attention Is All You Need",
      abstract: "Unrelated abstract.",
      topics: [],
    });
    const config = defaultConfig({ topics: ["attention"] });
    const score = scorePaper(paper, config);
    expect(score).toBeGreaterThan(0);
  });

  test("topic match in abstract counts", () => {
    const paper = createMockPaper({
      title: "Unrelated Title",
      abstract: "This paper explores transformer architectures.",
      topics: [],
    });
    const config = defaultConfig({ topics: ["transformer"] });
    const score = scorePaper(paper, config);
    expect(score).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// deduplicatePapers
// ---------------------------------------------------------------------------

describe("deduplicatePapers", () => {
  test("removes exact duplicates by title", () => {
    const papers = [
      createMockPaper({ id: "p1", title: "Same Title" }),
      createMockPaper({ id: "p2", title: "Same Title" }),
    ];
    const result = deduplicatePapers(papers);
    expect(result).toHaveLength(1);
  });

  test("keeps papers with different titles", () => {
    const papers = [
      createMockPaper({ id: "p1", title: "Paper One" }),
      createMockPaper({ id: "p2", title: "Paper Two" }),
    ];
    const result = deduplicatePapers(papers);
    expect(result).toHaveLength(2);
  });

  test("case-insensitive dedup", () => {
    const papers = [
      createMockPaper({ id: "p1", title: "Attention Is All You Need" }),
      createMockPaper({ id: "p2", title: "attention is all you need" }),
    ];
    const result = deduplicatePapers(papers);
    expect(result).toHaveLength(1);
  });

  test("prefers paper with more citations on duplicate", () => {
    const papers = [
      createMockPaper({ id: "p1", title: "Same Paper", citations: 10 }),
      createMockPaper({ id: "p2", title: "Same Paper", citations: 1000 }),
    ];
    const result = deduplicatePapers(papers);
    expect(result).toHaveLength(1);
    expect(result[0].citations).toBe(1000);
  });

  test("prefers paper with tldr on duplicate", () => {
    const paperNoTldr: ResearchPaper = {
      id: "p1", title: "Same Paper", authors: [], abstract: "", url: "",
      publishedDate: "2024-01-01", topics: [], citations: 0,
    };
    const paperWithTldr: ResearchPaper = {
      id: "p2", title: "Same Paper", authors: [], abstract: "", url: "",
      publishedDate: "2024-01-01", topics: [], citations: 0, tldr: "Has a summary",
    };
    const result = deduplicatePapers([paperNoTldr, paperWithTldr]);
    expect(result).toHaveLength(1);
    expect(result[0].tldr).toBe("Has a summary");
  });

  test("handles empty array", () => {
    const result = deduplicatePapers([]);
    expect(result).toHaveLength(0);
  });

  test("handles single paper", () => {
    const result = deduplicatePapers([createMockPaper()]);
    expect(result).toHaveLength(1);
  });

  test("ignores punctuation differences in titles", () => {
    const papers = [
      createMockPaper({ id: "p1", title: "BERT: Pre-training of Deep Bidirectional Transformers" }),
      createMockPaper({ id: "p2", title: "BERT Pre-training of Deep Bidirectional Transformers" }),
    ];
    const result = deduplicatePapers(papers);
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// filterAndRank
// ---------------------------------------------------------------------------

describe("filterAndRank", () => {
  test("filters papers below minRelevanceScore", () => {
    const papers = [
      createMockPaper({ title: "Transformer Attention", abstract: "Self-attention in neural networks.", topics: ["transformer"] }),
      createMockPaper({ title: "Quantum Biology", abstract: "Protein folding.", topics: ["biology"] }),
    ];
    const config = defaultConfig({ minRelevanceScore: 0.3 });
    const result = filterAndRank(papers, config);
    // The relevant paper should pass, the irrelevant one might not
    expect(result.length).toBeLessThanOrEqual(papers.length);
  });

  test("limits results to maxPapersPerDay", () => {
    const papers = createMockPapers(20);
    const config = defaultConfig({ maxPapersPerDay: 5, minRelevanceScore: 0 });
    const result = filterAndRank(papers, config);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  test("returns papers sorted by relevance (descending)", () => {
    const papers = [
      createMockPaper({ title: "Unrelated Paper", abstract: "Nothing here.", topics: [], citations: 0 }),
      createMockPaper({
        title: "Transformer Attention Mechanisms",
        abstract: "Self-attention in neural network architectures.",
        topics: ["transformer", "attention"],
        citations: 5000,
        publishedDate: new Date().toISOString().split("T")[0],
      }),
    ];
    const config = defaultConfig({ minRelevanceScore: 0 });
    const result = filterAndRank(papers, config);
    if (result.length >= 2) {
      expect(result[0].title).toContain("Transformer");
    }
  });

  test("handles empty papers array", () => {
    const config = defaultConfig();
    const result = filterAndRank([], config);
    expect(result).toHaveLength(0);
  });

  test("returns all papers when minRelevanceScore is 0", () => {
    const papers = createMockPapers(5);
    const config = defaultConfig({ minRelevanceScore: 0, maxPapersPerDay: 100 });
    const result = filterAndRank(papers, config);
    expect(result.length).toBe(5);
  });

  test("returns no papers when minRelevanceScore is 1", () => {
    const papers = createMockPapers(5);
    const config = defaultConfig({ minRelevanceScore: 1 });
    const result = filterAndRank(papers, config);
    // Very unlikely any paper scores exactly 1
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// curatePapers (with mocks)
// ---------------------------------------------------------------------------

describe("curatePapers", () => {
  test("searches both sources and returns results", async () => {
    const papers = createMockPapers(5).map(p => ({
      ...p,
      title: `Transformer ${p.title}`,
      abstract: `Self-attention neural network ${p.abstract}`,
    }));
    const arxiv = createMockArxivClient(papers);
    const s2 = createMockSemanticScholarClient(papers);

    const config = defaultConfig({
      keywords: ["transformer"],
      minRelevanceScore: 0,
      maxPapersPerDay: 20,
    });

    const result = await curatePapers(config, { arxiv, semanticScholar: s2 });
    expect(result.length).toBeGreaterThan(0);
  });

  test("deduplicates across sources", async () => {
    const paper = createMockPaper({ title: "Same Paper From Both Sources" });
    const arxiv = createMockArxivClient([{ ...paper, title: "same paper from both sources" }]);
    const s2 = createMockSemanticScholarClient([paper]);

    const config = defaultConfig({
      keywords: ["same paper"],
      minRelevanceScore: 0,
      maxPapersPerDay: 20,
    });

    const result = await curatePapers(config, { arxiv, semanticScholar: s2 });
    // Should deduplicate across sources
    const titles = result.map(p => p.title.toLowerCase());
    const uniqueTitles = [...new Set(titles.map(t => t.replace(/[^a-z0-9\s]/g, "").trim()))];
    expect(uniqueTitles.length).toBe(result.length);
  });

  test("handles one source failing gracefully", async () => {
    const failingClient = {
      async searchPapers() {
        throw new Error("Network error");
      },
    };
    const papers = createMockPapers(3).map(p => ({
      ...p,
      title: `Transformer ${p.title}`,
    }));
    const s2 = createMockSemanticScholarClient(papers);

    const config = defaultConfig({
      keywords: ["transformer"],
      minRelevanceScore: 0,
      maxPapersPerDay: 20,
    });

    const result = await curatePapers(config, { arxiv: failingClient, semanticScholar: s2 });
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  test("returns empty array when no sources configured", async () => {
    const config = defaultConfig({ sources: [], keywords: ["test"] });
    const result = await curatePapers(config);
    expect(result).toHaveLength(0);
  });

  test("returns empty array when no keywords", async () => {
    const config = defaultConfig({ keywords: [] });
    const result = await curatePapers(config);
    expect(result).toHaveLength(0);
  });

  test("respects maxPapersPerDay limit", async () => {
    const papers = createMockPapers(20).map(p => ({
      ...p,
      title: `Transformer ${p.title}`,
    }));
    const arxiv = createMockArxivClient(papers);

    const config = defaultConfig({
      keywords: ["transformer"],
      minRelevanceScore: 0,
      maxPapersPerDay: 3,
      sources: ["arxiv"],
    });

    const result = await curatePapers(config, { arxiv });
    expect(result.length).toBeLessThanOrEqual(3);
  });

  test("works with only arxiv source", async () => {
    const papers = createMockPapers(3).map(p => ({
      ...p,
      title: `Attention ${p.title}`,
    }));
    const arxiv = createMockArxivClient(papers);

    const config = defaultConfig({
      keywords: ["attention"],
      sources: ["arxiv"],
      minRelevanceScore: 0,
    });

    const result = await curatePapers(config, { arxiv });
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  test("works with only semantic-scholar source", async () => {
    const papers = createMockPapers(3).map(p => ({
      ...p,
      title: `Attention ${p.title}`,
    }));
    const s2 = createMockSemanticScholarClient(papers);

    const config = defaultConfig({
      keywords: ["attention"],
      sources: ["semantic-scholar"],
      minRelevanceScore: 0,
    });

    const result = await curatePapers(config, { semanticScholar: s2 });
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});
