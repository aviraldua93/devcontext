/**
 * Semantic Scholar API Client — search and retrieve papers.
 *
 * Uses the free-tier Semantic Scholar Academic Graph API.
 * No API key required for basic access.
 */

import { createLogger } from "../../logger.js";
import type {
  ResearchPaper,
  PaperSearchQuery,
  PaperSearchResult,
  SemanticScholarClient,
} from "./types.js";

const log = createLogger("papers:semantic-scholar");

const S2_API_BASE = "https://api.semanticscholar.org/graph/v1";
const PAPER_FIELDS = "paperId,title,abstract,authors,url,year,citationCount,tldr,externalIds,fieldsOfStudy,publicationDate";

// ---------------------------------------------------------------------------
// Response types (Semantic Scholar JSON shapes)
// ---------------------------------------------------------------------------

interface S2Author {
  authorId: string;
  name: string;
}

interface S2Paper {
  paperId: string;
  title: string;
  abstract: string | null;
  authors: S2Author[];
  url: string;
  year: number | null;
  citationCount: number | null;
  tldr: { text: string } | null;
  externalIds: Record<string, string> | null;
  fieldsOfStudy: string[] | null;
  publicationDate: string | null;
}

interface S2SearchResponse {
  total: number;
  data: S2Paper[];
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Convert a Semantic Scholar paper object to a ResearchPaper.
 */
export function mapS2Paper(paper: S2Paper): ResearchPaper {
  const arxivId = paper.externalIds?.ArXiv ?? undefined;
  const slug = paper.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return {
    id: `s2-${paper.paperId}`,
    title: paper.title,
    authors: paper.authors.map(a => a.name),
    abstract: paper.abstract ?? "",
    url: paper.url,
    arxivId,
    publishedDate: paper.publicationDate ?? (paper.year ? `${paper.year}-01-01` : new Date().toISOString().split("T")[0]),
    topics: paper.fieldsOfStudy ?? [],
    citations: paper.citationCount ?? undefined,
    tldr: paper.tldr?.text ?? undefined,
    source: "semantic-scholar",
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search Semantic Scholar for papers matching the query.
 */
export async function searchPapers(query: PaperSearchQuery): Promise<PaperSearchResult> {
  const params = new URLSearchParams({
    query: query.query,
    limit: String(Math.min(query.maxResults, 100)),
    fields: PAPER_FIELDS,
  });

  // Date range filter — S2 supports year filter
  if (query.dateRange) {
    const startYear = query.dateRange[0].split("-")[0];
    const endYear = query.dateRange[1].split("-")[0];
    params.set("year", `${startYear}-${endYear}`);
  }

  const url = `${S2_API_BASE}/paper/search?${params.toString()}`;
  log.info({ url, query: query.query }, "Searching Semantic Scholar");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as S2SearchResponse;

  const papers = (data.data ?? [])
    .filter((p): p is S2Paper => p.title != null)
    .map(mapS2Paper);

  // Filter by topics if specified
  const filtered = query.topics?.length
    ? papers.filter(p =>
        p.topics.some(t =>
          query.topics!.some(qt => t.toLowerCase().includes(qt.toLowerCase()))
        )
      )
    : papers;

  log.info({ count: filtered.length, total: data.total }, "Semantic Scholar search complete");

  return {
    papers: filtered,
    totalResults: data.total ?? 0,
    source: "semantic-scholar",
  };
}

// ---------------------------------------------------------------------------
// Get single paper
// ---------------------------------------------------------------------------

/**
 * Retrieve a single paper by its Semantic Scholar paper ID.
 */
export async function getPaper(paperId: string): Promise<ResearchPaper> {
  const url = `${S2_API_BASE}/paper/${encodeURIComponent(paperId)}?fields=${PAPER_FIELDS}`;
  log.info({ paperId }, "Fetching paper from Semantic Scholar");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as S2Paper;
  return mapS2Paper(data);
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/**
 * Create a Semantic Scholar client instance.
 */
export function createSemanticScholarClient(): SemanticScholarClient {
  return { searchPapers, getPaper };
}
