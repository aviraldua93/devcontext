/**
 * Mock Paper Clients — mock implementations for testing paper ingestion.
 *
 * Zero network calls. Deterministic, configurable responses.
 */

import type {
  ResearchPaper,
  PaperSearchQuery,
  PaperSearchResult,
  ArxivClient,
  SemanticScholarClient,
} from "./types.js";

// ---------------------------------------------------------------------------
// Sample paper factory
// ---------------------------------------------------------------------------

/**
 * Create a sample ResearchPaper for testing.
 */
export function createMockPaper(overrides: Partial<ResearchPaper> = {}): ResearchPaper {
  return {
    id: overrides.id ?? "mock-paper-1",
    title: overrides.title ?? "Attention Is All You Need",
    authors: overrides.authors ?? ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"],
    abstract: overrides.abstract ?? "We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.",
    url: overrides.url ?? "https://arxiv.org/abs/1706.03762",
    arxivId: overrides.arxivId ?? "1706.03762",
    publishedDate: overrides.publishedDate ?? "2017-06-12",
    topics: overrides.topics ?? ["cs.CL", "cs.LG"],
    citations: overrides.citations ?? 90000,
    tldr: overrides.tldr ?? "Introduces the Transformer architecture based on self-attention.",
    source: overrides.source ?? "arxiv",
  };
}

/**
 * Create multiple mock papers for testing.
 */
export function createMockPapers(count: number): ResearchPaper[] {
  const titles = [
    "Attention Is All You Need",
    "BERT: Pre-training of Deep Bidirectional Transformers",
    "GPT-4 Technical Report",
    "Scaling Laws for Neural Language Models",
    "Chain-of-Thought Prompting Elicits Reasoning",
    "Constitutional AI: Harmlessness from AI Feedback",
    "Retrieval-Augmented Generation for Knowledge-Intensive Tasks",
    "LoRA: Low-Rank Adaptation of Large Language Models",
    "FlashAttention: Fast and Memory-Efficient Exact Attention",
    "Llama 2: Open Foundation and Fine-Tuned Chat Models",
  ];

  return Array.from({ length: count }, (_, i) => createMockPaper({
    id: `mock-paper-${i + 1}`,
    title: titles[i % titles.length] + (i >= titles.length ? ` (v${Math.floor(i / titles.length) + 1})` : ""),
    authors: [`Author ${i + 1}`, `Co-Author ${i + 1}`],
    publishedDate: `2024-${String(Math.min(12, i + 1)).padStart(2, "0")}-15`,
    citations: Math.floor(Math.random() * 10000),
    topics: ["cs.CL", "cs.LG", "cs.AI"].slice(0, (i % 3) + 1),
  }));
}

// ---------------------------------------------------------------------------
// Mock ArXiv client
// ---------------------------------------------------------------------------

/**
 * Create a mock ArXiv client that returns configured papers without network calls.
 */
export function createMockArxivClient(papers?: ResearchPaper[]): ArxivClient {
  const mockPapers = papers ?? [createMockPaper()];

  return {
    async searchPapers(query: PaperSearchQuery): Promise<PaperSearchResult> {
      // Simulate filtering by query text
      const filtered = mockPapers.filter(p => {
        const q = query.query.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.abstract.toLowerCase().includes(q) ||
          p.topics.some(t => t.toLowerCase().includes(q))
        );
      });

      const results = filtered.slice(0, query.maxResults);

      return {
        papers: results.map(p => ({ ...p, source: "arxiv" as const })),
        totalResults: filtered.length,
        source: "arxiv",
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Mock Semantic Scholar client
// ---------------------------------------------------------------------------

/**
 * Create a mock Semantic Scholar client that returns configured papers.
 */
export function createMockSemanticScholarClient(papers?: ResearchPaper[]): SemanticScholarClient {
  const mockPapers = papers ?? [createMockPaper({ source: "semantic-scholar" })];

  return {
    async searchPapers(query: PaperSearchQuery): Promise<PaperSearchResult> {
      const filtered = mockPapers.filter(p => {
        const q = query.query.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.abstract.toLowerCase().includes(q) ||
          p.topics.some(t => t.toLowerCase().includes(q))
        );
      });

      const results = filtered.slice(0, query.maxResults);

      return {
        papers: results.map(p => ({ ...p, source: "semantic-scholar" as const })),
        totalResults: filtered.length,
        source: "semantic-scholar",
      };
    },

    async getPaper(paperId: string): Promise<ResearchPaper> {
      const found = mockPapers.find(p => p.id === paperId);
      if (!found) {
        throw new Error(`Paper not found: ${paperId}`);
      }
      return { ...found, source: "semantic-scholar" };
    },
  };
}
