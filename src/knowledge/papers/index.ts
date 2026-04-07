/**
 * Papers Module — barrel export for research paper ingestion.
 *
 * Re-exports all paper-related types, clients, curator, ingestor, and mocks.
 */

// Types
export type {
  ResearchPaper,
  PaperSource,
  PaperSearchQuery,
  PaperSearchResult,
  CurationConfig,
  IngestResult,
  ArxivClient,
  SemanticScholarClient,
} from "./types.js";

// ArXiv client
export {
  searchPapers as searchArxiv,
  parsePaperFromAtom,
  createArxivClient,
  resetRateLimit,
} from "./arxiv.js";

// Semantic Scholar client
export {
  searchPapers as searchSemanticScholar,
  getPaper as getSemanticScholarPaper,
  mapS2Paper,
  createSemanticScholarClient,
} from "./semantic-scholar.js";

// Curator
export {
  curatePapers,
  scorePaper,
  filterAndRank,
  deduplicatePapers,
} from "./curator.js";

// Ingestor
export {
  ingestPaper,
  ingestBatch,
} from "./ingestor.js";

// Mocks
export {
  createMockPaper,
  createMockPapers,
  createMockArxivClient,
  createMockSemanticScholarClient,
} from "./mock.js";
