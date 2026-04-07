/**
 * Unit tests for src/knowledge/papers/arxiv.ts — arXiv API client and XML parsing
 */

import { describe, test, expect } from "bun:test";
import { parsePaperFromAtom, resetRateLimit } from "../../src/knowledge/papers/arxiv.js";

// ---------------------------------------------------------------------------
// Sample Atom XML entries for testing
// ---------------------------------------------------------------------------

const SAMPLE_ENTRY_FULL = `
  <id>http://arxiv.org/abs/1706.03762v7</id>
  <updated>2023-08-02T00:00:00Z</updated>
  <published>2017-06-12T17:57:34Z</published>
  <title>Attention Is All You Need</title>
  <summary>The dominant sequence transduction models are based on complex recurrent or
convolutional neural networks that include an encoder and a decoder. The best
performing models also connect the encoder and decoder through an attention
mechanism. We propose a new simple network architecture, the Transformer,
based solely on attention mechanisms, dispensing with recurrence and
convolutions entirely.</summary>
  <author>
    <name>Ashish Vaswani</name>
  </author>
  <author>
    <name>Noam Shazeer</name>
  </author>
  <author>
    <name>Niki Parmar</name>
  </author>
  <link href="http://arxiv.org/abs/1706.03762v7" rel="alternate" type="text/html"/>
  <link title="pdf" href="http://arxiv.org/pdf/1706.03762v7" rel="related" type="application/pdf"/>
  <arxiv:primary_category xmlns:arxiv="http://arxiv.org/schemas/atom" term="cs.CL" scheme="http://arxiv.org/schemas/atom"/>
  <category term="cs.CL" scheme="http://arxiv.org/schemas/atom"/>
  <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
`;

const SAMPLE_ENTRY_MINIMAL = `
  <id>http://arxiv.org/abs/2401.12345v1</id>
  <published>2024-01-15T10:00:00Z</published>
  <title>A Minimal Paper</title>
  <summary>Short abstract.</summary>
  <author>
    <name>Solo Author</name>
  </author>
  <link href="http://arxiv.org/abs/2401.12345v1" rel="alternate" type="text/html"/>
`;

const SAMPLE_ENTRY_NO_LINK = `
  <id>http://arxiv.org/abs/9999.99999v1</id>
  <published>2024-06-01T00:00:00Z</published>
  <title>Paper Without Alternate Link</title>
  <summary>Some abstract text here.</summary>
  <author>
    <name>Test Author</name>
  </author>
`;

const SAMPLE_ENTRY_MULTILINE_TITLE = `
  <id>http://arxiv.org/abs/2305.11111v1</id>
  <published>2023-05-20T00:00:00Z</published>
  <title>A Very Long Paper Title
  That Spans Multiple Lines</title>
  <summary>Abstract for multiline title paper.</summary>
  <author>
    <name>Author One</name>
  </author>
  <author>
    <name>Author Two</name>
  </author>
  <link href="http://arxiv.org/abs/2305.11111v1" rel="alternate" type="text/html"/>
  <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
`;

const SAMPLE_ENTRY_MANY_CATEGORIES = `
  <id>http://arxiv.org/abs/2302.54321v2</id>
  <published>2023-02-10T00:00:00Z</published>
  <title>Multi-Category Paper</title>
  <summary>A paper with many categories.</summary>
  <author>
    <name>Cat Author</name>
  </author>
  <link href="http://arxiv.org/abs/2302.54321v2" rel="alternate" type="text/html"/>
  <category term="cs.CL" scheme="http://arxiv.org/schemas/atom"/>
  <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
  <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
  <category term="stat.ML" scheme="http://arxiv.org/schemas/atom"/>
`;

// ---------------------------------------------------------------------------
// parsePaperFromAtom
// ---------------------------------------------------------------------------

describe("parsePaperFromAtom", () => {
  test("parses a full entry with all fields", () => {
    const paper = parsePaperFromAtom(SAMPLE_ENTRY_FULL);
    expect(paper.title).toBe("Attention Is All You Need");
    expect(paper.arxivId).toBe("1706.03762");
    expect(paper.authors).toEqual(["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"]);
    expect(paper.publishedDate).toBe("2017-06-12");
    expect(paper.source).toBe("arxiv");
    expect(paper.url).toBe("http://arxiv.org/abs/1706.03762v7");
  });

  test("generates id from arxivId", () => {
    const paper = parsePaperFromAtom(SAMPLE_ENTRY_FULL);
    expect(paper.id).toContain("arxiv-");
    expect(paper.id).toContain("1706");
  });

  test("extracts abstract from summary tag", () => {
    const paper = parsePaperFromAtom(SAMPLE_ENTRY_FULL);
    expect(paper.abstract).toContain("Transformer");
    expect(paper.abstract).toContain("attention mechanisms");
  });

  test("extracts categories as topics", () => {
    const paper = parsePaperFromAtom(SAMPLE_ENTRY_FULL);
    expect(paper.topics).toContain("cs.CL");
    expect(paper.topics).toContain("cs.LG");
  });

  test("handles minimal entry", () => {
    const paper = parsePaperFromAtom(SAMPLE_ENTRY_MINIMAL);
    expect(paper.title).toBe("A Minimal Paper");
    expect(paper.authors).toEqual(["Solo Author"]);
    expect(paper.abstract).toBe("Short abstract.");
    expect(paper.publishedDate).toBe("2024-01-15");
    expect(paper.arxivId).toBe("2401.12345");
  });

  test("falls back to id URL when no alternate link", () => {
    const paper = parsePaperFromAtom(SAMPLE_ENTRY_NO_LINK);
    expect(paper.url).toBe("http://arxiv.org/abs/9999.99999v1");
  });

  test("handles multiline titles", () => {
    const paper = parsePaperFromAtom(SAMPLE_ENTRY_MULTILINE_TITLE);
    expect(paper.title).toContain("A Very Long Paper Title");
    expect(paper.title).toContain("That Spans Multiple Lines");
    // Should be collapsed to single line
    expect(paper.title).not.toContain("\n");
  });

  test("extracts multiple categories", () => {
    const paper = parsePaperFromAtom(SAMPLE_ENTRY_MANY_CATEGORIES);
    expect(paper.topics).toContain("cs.CL");
    expect(paper.topics).toContain("cs.AI");
    expect(paper.topics).toContain("cs.LG");
    expect(paper.topics).toContain("stat.ML");
  });

  test("deduplicates topics", () => {
    const paper = parsePaperFromAtom(SAMPLE_ENTRY_MANY_CATEGORIES);
    const uniqueTopics = [...new Set(paper.topics)];
    expect(paper.topics.length).toBe(uniqueTopics.length);
  });

  test("source is always 'arxiv'", () => {
    const paper1 = parsePaperFromAtom(SAMPLE_ENTRY_FULL);
    const paper2 = parsePaperFromAtom(SAMPLE_ENTRY_MINIMAL);
    expect(paper1.source).toBe("arxiv");
    expect(paper2.source).toBe("arxiv");
  });

  test("handles entry with no categories", () => {
    const paper = parsePaperFromAtom(SAMPLE_ENTRY_MINIMAL);
    expect(Array.isArray(paper.topics)).toBe(true);
  });

  test("published date defaults to today when missing", () => {
    const entry = `
      <id>http://arxiv.org/abs/0000.00000v1</id>
      <title>No Date Paper</title>
      <summary>No date.</summary>
      <author><name>Test</name></author>
    `;
    const paper = parsePaperFromAtom(entry);
    expect(paper.publishedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("id is deterministic for same arxivId", () => {
    const paper1 = parsePaperFromAtom(SAMPLE_ENTRY_FULL);
    const paper2 = parsePaperFromAtom(SAMPLE_ENTRY_FULL);
    expect(paper1.id).toBe(paper2.id);
  });

  test("abstract whitespace is normalized", () => {
    const paper = parsePaperFromAtom(SAMPLE_ENTRY_FULL);
    expect(paper.abstract).not.toMatch(/\n/);
    expect(paper.abstract).not.toMatch(/  +/);
  });

  test("handles empty author list gracefully", () => {
    const entry = `
      <id>http://arxiv.org/abs/0000.00001v1</id>
      <title>No Author Paper</title>
      <summary>No authors.</summary>
    `;
    const paper = parsePaperFromAtom(entry);
    expect(Array.isArray(paper.authors)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resetRateLimit
// ---------------------------------------------------------------------------

describe("resetRateLimit", () => {
  test("resets without error", () => {
    expect(() => resetRateLimit()).not.toThrow();
  });

  test("can be called multiple times", () => {
    resetRateLimit();
    resetRateLimit();
    resetRateLimit();
    expect(true).toBe(true);
  });
});
