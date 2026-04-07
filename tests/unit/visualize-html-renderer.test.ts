/**
 * Unit tests for src/knowledge/visualize/html-renderer.ts
 */

import { describe, test, expect } from "bun:test";
import type { KnowledgeEntity } from "../../src/types.js";
import type { KnowledgeGraph, TopicCluster, TimelineEvent, VisualizationConfig } from "../../src/knowledge/visualize/types.js";
import {
  renderKnowledgeGraph,
  renderTopicClusters,
  renderTimeline,
  renderResearchLandscape,
} from "../../src/knowledge/visualize/html-renderer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockConfig(overrides: Partial<VisualizationConfig> = {}): VisualizationConfig {
  return {
    type: "knowledge-graph",
    title: "Test Graph",
    outputPath: "test-output.html",
    interactive: true,
    ...overrides,
  };
}

function mockGraph(): KnowledgeGraph {
  return {
    nodes: [
      { id: "retry-patterns", label: "Retry Patterns", type: "concept", size: 20, metadata: { color: "#6366f1", tags: ["resilience"], updated: "2025-01-10", related: ["circuit-breakers"] } },
      { id: "circuit-breakers", label: "Circuit Breakers", type: "concept", size: 15, metadata: { color: "#6366f1", tags: ["resilience"], updated: "2025-01-12", related: ["retry-patterns"] } },
      { id: "kubernetes", label: "Kubernetes", type: "platform", size: 10, metadata: { color: "#f59e0b", tags: ["infrastructure"], updated: "2025-01-14", related: [] } },
    ],
    edges: [
      { source: "retry-patterns", target: "circuit-breakers", label: "related", weight: 2 },
    ],
  };
}

function mockEntity(overrides: Partial<KnowledgeEntity> = {}): KnowledgeEntity {
  return {
    title: "Test Concept",
    type: "concept",
    updated: "2025-01-15",
    tags: ["testing"],
    related: [],
    content: "A test entity.",
    ...overrides,
  };
}

function mockClusters(): TopicCluster[] {
  return [
    {
      topic: "resilience",
      entities: [
        mockEntity({ title: "Retry Patterns", type: "concept" }),
        mockEntity({ title: "Circuit Breakers", type: "concept" }),
      ],
    },
    {
      topic: "infrastructure",
      entities: [
        mockEntity({ title: "Kubernetes", type: "platform" }),
      ],
    },
  ];
}

function mockTimeline(): TimelineEvent[] {
  return [
    { date: "2025-01-01", entity: mockEntity({ title: "Retry Patterns" }), event: "created" },
    { date: "2025-01-05", entity: mockEntity({ title: "Kubernetes", type: "platform" }), event: "created" },
    { date: "2025-01-10", entity: mockEntity({ title: "Retry Patterns" }), event: "updated" },
  ];
}

// ---------------------------------------------------------------------------
// renderKnowledgeGraph
// ---------------------------------------------------------------------------

describe("renderKnowledgeGraph", () => {
  test("produces valid HTML with doctype", () => {
    const html = renderKnowledgeGraph(mockGraph(), mockConfig());
    expect(html).toStartWith("<!DOCTYPE html>");
  });

  test("includes vis.js CDN script tag", () => {
    const html = renderKnowledgeGraph(mockGraph(), mockConfig());
    expect(html).toContain("vis-network");
    expect(html).toContain("<script src=");
  });

  test("includes config title", () => {
    const html = renderKnowledgeGraph(mockGraph(), mockConfig({ title: "My Knowledge Graph" }));
    expect(html).toContain("My Knowledge Graph");
  });

  test("includes node count in stats", () => {
    const html = renderKnowledgeGraph(mockGraph(), mockConfig());
    expect(html).toContain("3");
  });

  test("includes edge count in stats", () => {
    const html = renderKnowledgeGraph(mockGraph(), mockConfig());
    expect(html).toContain("1");
  });

  test("includes node labels in data", () => {
    const html = renderKnowledgeGraph(mockGraph(), mockConfig());
    expect(html).toContain("Retry Patterns");
    expect(html).toContain("Circuit Breakers");
    expect(html).toContain("Kubernetes");
  });

  test("includes graph container div", () => {
    const html = renderKnowledgeGraph(mockGraph(), mockConfig());
    expect(html).toContain('id="graph-container"');
  });

  test("includes sidebar for details", () => {
    const html = renderKnowledgeGraph(mockGraph(), mockConfig());
    expect(html).toContain('id="sidebar"');
  });

  test("includes search input", () => {
    const html = renderKnowledgeGraph(mockGraph(), mockConfig());
    expect(html).toContain('id="searchInput"');
  });

  test("includes filter buttons for each type", () => {
    const html = renderKnowledgeGraph(mockGraph(), mockConfig());
    expect(html).toContain('data-type="concept"');
    expect(html).toContain('data-type="platform"');
  });

  test("includes dark theme background colour", () => {
    const html = renderKnowledgeGraph(mockGraph(), mockConfig());
    expect(html).toContain("#0f172a");
  });

  test("includes inline CSS (self-contained)", () => {
    const html = renderKnowledgeGraph(mockGraph(), mockConfig());
    expect(html).toContain("<style>");
  });

  test("produces closing html tag", () => {
    const html = renderKnowledgeGraph(mockGraph(), mockConfig());
    expect(html).toContain("</html>");
  });
});

// ---------------------------------------------------------------------------
// renderTopicClusters
// ---------------------------------------------------------------------------

describe("renderTopicClusters", () => {
  test("produces valid HTML", () => {
    const html = renderTopicClusters(mockClusters(), mockConfig({ type: "topic-clusters" }));
    expect(html).toStartWith("<!DOCTYPE html>");
  });

  test("includes cluster topic names", () => {
    const html = renderTopicClusters(mockClusters(), mockConfig());
    expect(html).toContain("resilience");
    expect(html).toContain("infrastructure");
  });

  test("includes entity counts per cluster", () => {
    const html = renderTopicClusters(mockClusters(), mockConfig());
    expect(html).toContain(">2<"); // resilience has 2
    expect(html).toContain(">1<"); // infrastructure has 1
  });

  test("includes entity titles within clusters", () => {
    const html = renderTopicClusters(mockClusters(), mockConfig());
    expect(html).toContain("Retry Patterns");
    expect(html).toContain("Kubernetes");
  });

  test("includes total entity count in header", () => {
    const html = renderTopicClusters(mockClusters(), mockConfig());
    expect(html).toContain("3"); // 3 unique entities
  });

  test("includes cluster count in header", () => {
    const html = renderTopicClusters(mockClusters(), mockConfig());
    expect(html).toContain("2"); // 2 clusters
  });

  test("has dark theme styling", () => {
    const html = renderTopicClusters(mockClusters(), mockConfig());
    expect(html).toContain("#0f172a");
  });

  test("includes cluster grid layout", () => {
    const html = renderTopicClusters(mockClusters(), mockConfig());
    expect(html).toContain("cluster-grid");
  });
});

// ---------------------------------------------------------------------------
// renderTimeline
// ---------------------------------------------------------------------------

describe("renderTimeline", () => {
  test("produces valid HTML", () => {
    const html = renderTimeline(mockTimeline(), mockConfig({ type: "timeline" }));
    expect(html).toStartWith("<!DOCTYPE html>");
  });

  test("includes event dates", () => {
    const html = renderTimeline(mockTimeline(), mockConfig());
    expect(html).toContain("2025-01-01");
    expect(html).toContain("2025-01-10");
  });

  test("includes entity titles", () => {
    const html = renderTimeline(mockTimeline(), mockConfig());
    expect(html).toContain("Retry Patterns");
    expect(html).toContain("Kubernetes");
  });

  test("includes event type badges", () => {
    const html = renderTimeline(mockTimeline(), mockConfig());
    expect(html).toContain("created");
    expect(html).toContain("updated");
  });

  test("includes event count in header", () => {
    const html = renderTimeline(mockTimeline(), mockConfig());
    expect(html).toContain("3");
  });

  test("includes timeline line element", () => {
    const html = renderTimeline(mockTimeline(), mockConfig());
    expect(html).toContain("timeline-line");
  });

  test("includes timeline dot elements", () => {
    const html = renderTimeline(mockTimeline(), mockConfig());
    expect(html).toContain("timeline-dot");
  });

  test("has dark theme", () => {
    const html = renderTimeline(mockTimeline(), mockConfig());
    expect(html).toContain("#0f172a");
  });
});

// ---------------------------------------------------------------------------
// renderResearchLandscape
// ---------------------------------------------------------------------------

describe("renderResearchLandscape", () => {
  test("produces valid HTML", () => {
    const html = renderResearchLandscape(mockGraph(), mockClusters(), mockConfig({ type: "research-landscape" }));
    expect(html).toStartWith("<!DOCTYPE html>");
  });

  test("includes vis.js CDN", () => {
    const html = renderResearchLandscape(mockGraph(), mockClusters(), mockConfig());
    expect(html).toContain("vis-network");
  });

  test("includes tab navigation", () => {
    const html = renderResearchLandscape(mockGraph(), mockClusters(), mockConfig());
    expect(html).toContain("Knowledge Graph");
    expect(html).toContain("Topic Clusters");
  });

  test("includes entity count stats", () => {
    const html = renderResearchLandscape(mockGraph(), mockClusters(), mockConfig());
    expect(html).toContain("3"); // nodes
  });

  test("includes cluster count stats", () => {
    const html = renderResearchLandscape(mockGraph(), mockClusters(), mockConfig());
    expect(html).toContain("2"); // clusters
  });

  test("includes type breakdown badges", () => {
    const html = renderResearchLandscape(mockGraph(), mockClusters(), mockConfig());
    expect(html).toContain("concept");
    expect(html).toContain("platform");
  });

  test("includes graph container", () => {
    const html = renderResearchLandscape(mockGraph(), mockClusters(), mockConfig());
    expect(html).toContain('id="graph-container"');
  });

  test("includes cluster cards", () => {
    const html = renderResearchLandscape(mockGraph(), mockClusters(), mockConfig());
    expect(html).toContain("cluster-card");
  });

  test("includes sidebar for node details", () => {
    const html = renderResearchLandscape(mockGraph(), mockClusters(), mockConfig());
    expect(html).toContain('id="sidebar"');
  });

  test("includes search input", () => {
    const html = renderResearchLandscape(mockGraph(), mockClusters(), mockConfig());
    expect(html).toContain('id="searchInput"');
  });

  test("includes dark theme", () => {
    const html = renderResearchLandscape(mockGraph(), mockClusters(), mockConfig());
    expect(html).toContain("#0f172a");
  });

  test("has closing html tag", () => {
    const html = renderResearchLandscape(mockGraph(), mockClusters(), mockConfig());
    expect(html).toContain("</html>");
  });
});
