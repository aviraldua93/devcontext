/**
 * ArXiv API Client — search and parse papers from the arXiv Atom feed.
 *
 * Uses native fetch (Bun) and regex-based Atom XML parsing.
 * Respects arXiv rate limit policy: 3-second delay between requests.
 */

import { createLogger } from "../../logger.js";
import type {
  ResearchPaper,
  PaperSearchQuery,
  PaperSearchResult,
  ArxivClient,
} from "./types.js";

const log = createLogger("papers:arxiv");

const ARXIV_API_BASE = "http://export.arxiv.org/api/query";

// Track last request time for rate limiting
let lastRequestTime = 0;
const RATE_LIMIT_MS = 3000;

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS && lastRequestTime > 0) {
    const delay = RATE_LIMIT_MS - elapsed;
    log.debug({ delay }, "Rate limiting arXiv request");
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  lastRequestTime = Date.now();
}

// ---------------------------------------------------------------------------
// Atom XML parsing
// ---------------------------------------------------------------------------

/**
 * Extract text content from an XML tag. Returns empty string if not found.
 */
function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * Extract all occurrences of a tag from XML.
 */
function extractAllTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

/**
 * Extract an attribute value from an XML tag.
 */
function extractAttr(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * Extract all link hrefs with a specific rel attribute.
 */
function extractLinks(xml: string, rel: string): string[] {
  const regex = new RegExp(`<link[^>]*rel="${rel}"[^>]*href="([^"]*)"`, "gi");
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

/**
 * Parse a single Atom <entry> element into a ResearchPaper.
 */
export function parsePaperFromAtom(entry: string): ResearchPaper {
  const id = extractTag(entry, "id");
  const title = extractTag(entry, "title").replace(/\s+/g, " ");
  const abstract = extractTag(entry, "summary").replace(/\s+/g, " ");
  const published = extractTag(entry, "published");

  // Extract arXiv ID from the entry ID URL
  const arxivIdMatch = id.match(/abs\/(.+?)(?:v\d+)?$/);
  const arxivId = arxivIdMatch ? arxivIdMatch[1] : undefined;

  // Authors — extract <name> tags within <author> blocks
  const authorBlocks = extractAllTags(entry, "author");
  const authors = authorBlocks.map(block => extractTag(block, "name")).filter(Boolean);

  // Categories as topics
  const categoryRegex = /term="([^"]+)"/g;
  const categories: string[] = [];
  let catMatch: RegExpExecArray | null;
  // Use a copy of the entry to find category terms
  const categorySection = entry;
  while ((catMatch = categoryRegex.exec(categorySection)) !== null) {
    // Filter out non-arXiv category patterns (like link types)
    if (catMatch[1].includes(".") || catMatch[1].match(/^[a-z-]+$/)) {
      categories.push(catMatch[1]);
    }
  }

  // URL — prefer the abstract link
  const absLinks = extractLinks(entry, "alternate");
  const url = absLinks[0] ?? id;

  const paperId = arxivId
    ? `arxiv-${arxivId.replace(/[./]/g, "-")}`
    : `arxiv-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64)}`;

  return {
    id: paperId,
    title,
    authors,
    abstract,
    url,
    arxivId,
    publishedDate: published ? published.split("T")[0] : new Date().toISOString().split("T")[0],
    topics: [...new Set(categories)],
    source: "arxiv",
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search arXiv for papers matching the query.
 */
export async function searchPapers(query: PaperSearchQuery): Promise<PaperSearchResult> {
  await enforceRateLimit();

  const params = new URLSearchParams({
    search_query: `all:${query.query}`,
    start: "0",
    max_results: String(Math.min(query.maxResults, 100)),
    sortBy: "submittedDate",
    sortOrder: "descending",
  });

  const url = `${ARXIV_API_BASE}?${params.toString()}`;
  log.info({ url, query: query.query }, "Searching arXiv");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();

  // Extract total results from opensearch:totalResults
  const totalResultsStr = extractTag(xml, "opensearch:totalResults");
  const totalResults = parseInt(totalResultsStr, 10) || 0;

  // Split into entries and parse
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  const papers: ResearchPaper[] = [];
  let entryMatch: RegExpExecArray | null;

  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    try {
      papers.push(parsePaperFromAtom(entryMatch[1]));
    } catch (err) {
      log.warn({ err }, "Failed to parse arXiv entry");
    }
  }

  log.info({ count: papers.length, totalResults }, "arXiv search complete");

  return { papers, totalResults, source: "arxiv" };
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/**
 * Create an ArXiv client instance.
 */
export function createArxivClient(): ArxivClient {
  return { searchPapers };
}

/**
 * Reset rate limit state — useful for tests.
 */
export function resetRateLimit(): void {
  lastRequestTime = 0;
}
