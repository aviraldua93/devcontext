/**
 * Paper Curator — automated paper discovery, scoring, and ranking.
 *
 * Searches multiple sources, deduplicates by title similarity,
 * and ranks papers by relevance to configured topics and keywords.
 */

import { createLogger } from "../../logger.js";
import type {
  ResearchPaper,
  PaperSearchQuery,
  PaperSearchResult,
  CurationConfig,
  ArxivClient,
  SemanticScholarClient,
} from "./types.js";

const log = createLogger("papers:curator");

// ---------------------------------------------------------------------------
// Relevance scoring
// ---------------------------------------------------------------------------

/**
 * Score a paper's relevance to the curation config (0–1 scale).
 *
 * Factors:
 *  - Topic match (0.4 weight): how many config topics appear in paper topics/title/abstract
 *  - Keyword match (0.3 weight): how many config keywords appear in title/abstract
 *  - Recency (0.2 weight): papers published within 30 days score higher
 *  - Citation signal (0.1 weight): citation count (log-scaled)
 */
export function scorePaper(paper: ResearchPaper, config: CurationConfig): number {
  const titleLower = paper.title.toLowerCase();
  const abstractLower = paper.abstract.toLowerCase();
  const paperTopicsLower = paper.topics.map(t => t.toLowerCase());

  // Topic match — proportion of config topics found
  let topicHits = 0;
  for (const topic of config.topics) {
    const tl = topic.toLowerCase();
    if (
      paperTopicsLower.some(pt => pt.includes(tl)) ||
      titleLower.includes(tl) ||
      abstractLower.includes(tl)
    ) {
      topicHits++;
    }
  }
  const topicScore = config.topics.length > 0 ? topicHits / config.topics.length : 0;

  // Keyword match — proportion of keywords found
  let keywordHits = 0;
  for (const keyword of config.keywords) {
    const kl = keyword.toLowerCase();
    if (titleLower.includes(kl) || abstractLower.includes(kl)) {
      keywordHits++;
    }
  }
  const keywordScore = config.keywords.length > 0 ? keywordHits / config.keywords.length : 0;

  // Recency score — papers within 30 days get full score, decay linearly over 365 days
  const publishedDate = new Date(paper.publishedDate);
  const now = new Date();
  const daysSincePublished = Math.max(0, (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24));
  const recencyScore = daysSincePublished <= 30 ? 1 : Math.max(0, 1 - (daysSincePublished - 30) / 335);

  // Citation signal — log-scaled (capped contribution)
  const citations = paper.citations ?? 0;
  const citationScore = citations > 0 ? Math.min(1, Math.log10(citations + 1) / 3) : 0;

  const score = topicScore * 0.4 + keywordScore * 0.3 + recencyScore * 0.2 + citationScore * 0.1;

  return Math.round(score * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Normalize a title for deduplication comparison.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deduplicate papers by normalized title.
 * When duplicates exist, prefer the one with more metadata (citations, tldr).
 */
export function deduplicatePapers(papers: ResearchPaper[]): ResearchPaper[] {
  const seen = new Map<string, ResearchPaper>();

  for (const paper of papers) {
    const key = normalizeTitle(paper.title);
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, paper);
    } else {
      // Keep the paper with more metadata
      const existingScore = (existing.citations ?? 0) + (existing.tldr ? 10 : 0);
      const newScore = (paper.citations ?? 0) + (paper.tldr ? 10 : 0);
      if (newScore > existingScore) {
        seen.set(key, paper);
      }
    }
  }

  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Filter and rank
// ---------------------------------------------------------------------------

/**
 * Apply minimum relevance score filter, sort by relevance, and limit results.
 */
export function filterAndRank(
  papers: ResearchPaper[],
  config: CurationConfig,
): ResearchPaper[] {
  const scored = papers.map(paper => ({
    paper,
    score: scorePaper(paper, config),
  }));

  return scored
    .filter(({ score }) => score >= config.minRelevanceScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, config.maxPapersPerDay)
    .map(({ paper }) => paper);
}

// ---------------------------------------------------------------------------
// Curation orchestrator
// ---------------------------------------------------------------------------

export interface CuratorDependencies {
  arxiv?: ArxivClient;
  semanticScholar?: SemanticScholarClient;
}

/**
 * Run automated paper curation across configured sources.
 *
 * 1. Search each source with each keyword
 * 2. Merge and deduplicate results
 * 3. Score and rank by relevance
 * 4. Apply filters (minRelevanceScore, maxPapersPerDay)
 */
export async function curatePapers(
  config: CurationConfig,
  deps: CuratorDependencies = {},
): Promise<ResearchPaper[]> {
  const allPapers: ResearchPaper[] = [];

  for (const keyword of config.keywords) {
    const searchQuery: PaperSearchQuery = {
      query: keyword,
      maxResults: Math.min(config.maxPapersPerDay * 2, 50),
      topics: config.topics.length > 0 ? config.topics : undefined,
    };

    // Search arXiv
    if (config.sources.includes("arxiv") && deps.arxiv) {
      try {
        const result = await deps.arxiv.searchPapers(searchQuery);
        allPapers.push(...result.papers);
        log.info({ keyword, count: result.papers.length }, "arXiv results");
      } catch (err) {
        log.warn({ keyword, err }, "arXiv search failed");
      }
    }

    // Search Semantic Scholar
    if (config.sources.includes("semantic-scholar") && deps.semanticScholar) {
      try {
        const result = await deps.semanticScholar.searchPapers(searchQuery);
        allPapers.push(...result.papers);
        log.info({ keyword, count: result.papers.length }, "Semantic Scholar results");
      } catch (err) {
        log.warn({ keyword, err }, "Semantic Scholar search failed");
      }
    }
  }

  log.info({ total: allPapers.length }, "Total papers before deduplication");

  const deduplicated = deduplicatePapers(allPapers);
  log.info({ count: deduplicated.length }, "Papers after deduplication");

  const ranked = filterAndRank(deduplicated, config);
  log.info({ count: ranked.length }, "Papers after ranking and filtering");

  return ranked;
}
