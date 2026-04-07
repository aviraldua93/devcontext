/**
 * Research Paper Types — type definitions for paper ingestion module.
 *
 * Inspired by Elvis Saravia's (DAIR.AI) paper curation approach and
 * Karpathy's LLM Knowledge Base pattern.
 */

// ---------------------------------------------------------------------------
// Paper source classification
// ---------------------------------------------------------------------------

export type PaperSource = "arxiv" | "semantic-scholar" | "manual";

// ---------------------------------------------------------------------------
// Research paper entity
// ---------------------------------------------------------------------------

export interface ResearchPaper {
  /** Unique identifier (slug derived from title or external ID). */
  id: string;
  /** Paper title. */
  title: string;
  /** List of author names. */
  authors: string[];
  /** Paper abstract text. */
  abstract: string;
  /** URL to the paper (PDF or landing page). */
  url: string;
  /** ArXiv identifier (e.g. "2301.07041"), if sourced from arXiv. */
  arxivId?: string;
  /** ISO 8601 date string when the paper was published. */
  publishedDate: string;
  /** Topic/category tags. */
  topics: string[];
  /** Citation count (if available from source). */
  citations?: number;
  /** One-sentence summary (TL;DR). */
  tldr?: string;
  /** Which source this paper was retrieved from. */
  source?: PaperSource;
}

// ---------------------------------------------------------------------------
// Paper search types
// ---------------------------------------------------------------------------

export interface PaperSearchQuery {
  /** Free-text search query. */
  query: string;
  /** Maximum number of results to return. */
  maxResults: number;
  /** Optional date range filter [start, end] as ISO 8601 date strings. */
  dateRange?: [string, string];
  /** Optional topic filter — only return papers matching these topics. */
  topics?: string[];
}

export interface PaperSearchResult {
  /** List of papers matching the query. */
  papers: ResearchPaper[];
  /** Total number of results available (may exceed papers.length). */
  totalResults: number;
  /** Source that produced these results. */
  source: PaperSource;
}

// ---------------------------------------------------------------------------
// Curation configuration
// ---------------------------------------------------------------------------

export interface CurationConfig {
  /** Topics of interest for paper discovery. */
  topics: string[];
  /** Keywords to search for across sources. */
  keywords: string[];
  /** Minimum relevance score (0–1) to include a paper. */
  minRelevanceScore: number;
  /** Maximum papers to include per curation run. */
  maxPapersPerDay: number;
  /** Which sources to search. */
  sources: PaperSource[];
}

// ---------------------------------------------------------------------------
// Ingestion result
// ---------------------------------------------------------------------------

export interface IngestResult {
  /** Papers successfully ingested. */
  ingested: Array<{ paperId: string; slug: string }>;
  /** Papers skipped (e.g. already ingested). */
  skipped: Array<{ paperId: string; reason: string }>;
  /** Papers that failed to ingest. */
  errors: Array<{ paperId: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Client interfaces — for mocking API clients
// ---------------------------------------------------------------------------

export interface ArxivClient {
  searchPapers(query: PaperSearchQuery): Promise<PaperSearchResult>;
}

export interface SemanticScholarClient {
  searchPapers(query: PaperSearchQuery): Promise<PaperSearchResult>;
  getPaper(paperId: string): Promise<ResearchPaper>;
}
