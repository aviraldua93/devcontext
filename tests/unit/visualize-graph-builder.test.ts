/**
 * Unit tests for src/knowledge/visualize/graph-builder.ts
 */

import { describe, test, expect } from "bun:test";
import type { KnowledgeEntity } from "../../src/types.js";
import {
  buildKnowledgeGraph,
  buildTopicClusters,
  buildTimeline,
  extractWikilinks,
  getTypeColor,
} from "../../src/knowledge/visualize/graph-builder.js";

// ---------------------------------------------------------------------------
// Mock entities
// ---------------------------------------------------------------------------

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

function mockEntities(): KnowledgeEntity[] {
  return [
    mockEntity({
      title: "Retry Patterns",
      type: "concept",
      tags: ["resilience", "patterns"],
      related: ["circuit-breakers"],
      content: "Retry logic with [[circuit-breakers]] and [[timeouts]].",
      updated: "2025-01-10",
      created: "2025-01-01",
    }),
    mockEntity({
      title: "Circuit Breakers",
      type: "concept",
      tags: ["resilience", "patterns"],
      related: ["retry-patterns"],
      content: "Circuit breaker pattern for fault tolerance.",
      updated: "2025-01-12",
      created: "2025-01-02",
    }),
    mockEntity({
      title: "Kubernetes",
      type: "platform",
      tags: ["infrastructure", "containers"],
      related: [],
      content: "Container orchestration platform. See [[helm]].",
      updated: "2025-01-14",
    }),
    mockEntity({
      title: "Helm",
      type: "tool",
      tags: ["infrastructure", "kubernetes"],
      related: ["kubernetes"],
      content: "Package manager for Kubernetes.",
      updated: "2025-01-15",
      created: "2025-01-05",
    }),
    mockEntity({
      title: "OAuth2",
      type: "concept",
      tags: ["security", "auth"],
      content: "Authorization framework. Related to [[jwt-tokens]].",
      updated: "2025-01-08",
    }),
  ];
}

// ---------------------------------------------------------------------------
// extractWikilinks
// ---------------------------------------------------------------------------

describe("extractWikilinks", () => {
  test("extracts single wikilink", () => {
    const links = extractWikilinks("See [[retry-patterns]] for details.");
    expect(links).toEqual(["retry-patterns"]);
  });

  test("extracts multiple wikilinks", () => {
    const links = extractWikilinks("Uses [[circuit-breakers]] and [[timeouts]].");
    expect(links).toEqual(["circuit-breakers", "timeouts"]);
  });

  test("returns empty for no wikilinks", () => {
    const links = extractWikilinks("No links here.");
    expect(links).toEqual([]);
  });

  test("slugifies wikilink targets", () => {
    const links = extractWikilinks("See [[Circuit Breakers]] pattern.");
    expect(links).toEqual(["circuit-breakers"]);
  });

  test("handles empty string", () => {
    const links = extractWikilinks("");
    expect(links).toEqual([]);
  });

  test("handles wikilinks with special characters", () => {
    const links = extractWikilinks("Check [[OAuth 2.0]] standard.");
    expect(links).toEqual(["oauth-2-0"]);
  });

  test("handles adjacent wikilinks", () => {
    const links = extractWikilinks("[[foo]][[bar]]");
    expect(links).toEqual(["foo", "bar"]);
  });

  test("ignores nested brackets", () => {
    const links = extractWikilinks("[[valid]] and [not-a-link] are different.");
    expect(links).toEqual(["valid"]);
  });
});

// ---------------------------------------------------------------------------
// getTypeColor
// ---------------------------------------------------------------------------

describe("getTypeColor", () => {
  test("returns colour for known types", () => {
    expect(getTypeColor("concept")).toBe("#6366f1");
    expect(getTypeColor("tool")).toBe("#10b981");
    expect(getTypeColor("platform")).toBe("#f59e0b");
  });

  test("returns fallback for unknown types", () => {
    expect(getTypeColor("unknown")).toBe("#94a3b8");
  });

  test("returns colour for all defined types", () => {
    const types = ["concept", "tool", "platform", "system", "repo", "person", "team"];
    for (const t of types) {
      expect(getTypeColor(t)).not.toBe("#94a3b8");
    }
  });
});

// ---------------------------------------------------------------------------
// buildKnowledgeGraph
// ---------------------------------------------------------------------------

describe("buildKnowledgeGraph", () => {
  test("creates nodes for each entity", () => {
    const entities = mockEntities();
    const graph = buildKnowledgeGraph(entities);
    expect(graph.nodes.length).toBe(5);
  });

  test("node ids are slugified titles", () => {
    const graph = buildKnowledgeGraph([mockEntity({ title: "My Cool Entity" })]);
    expect(graph.nodes[0].id).toBe("my-cool-entity");
  });

  test("node labels match entity titles", () => {
    const graph = buildKnowledgeGraph([mockEntity({ title: "OAuth2" })]);
    expect(graph.nodes[0].label).toBe("OAuth2");
  });

  test("node type matches entity type", () => {
    const graph = buildKnowledgeGraph([mockEntity({ type: "tool" })]);
    expect(graph.nodes[0].type).toBe("tool");
  });

  test("nodes carry metadata with colour", () => {
    const graph = buildKnowledgeGraph([mockEntity({ type: "platform" })]);
    expect(graph.nodes[0].metadata.color).toBe("#f59e0b");
  });

  test("creates edges from related field", () => {
    const entities = [
      mockEntity({ title: "A", related: ["b"] }),
      mockEntity({ title: "B", related: [] }),
    ];
    const graph = buildKnowledgeGraph(entities);
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0].source).toBe("a");
    expect(graph.edges[0].target).toBe("b");
  });

  test("creates edges from wikilinks", () => {
    const entities = [
      mockEntity({ title: "A", content: "See [[b]]." }),
      mockEntity({ title: "B" }),
    ];
    const graph = buildKnowledgeGraph(entities);
    expect(graph.edges.length).toBe(1);
  });

  test("merges duplicate edges and increments weight", () => {
    const entities = [
      mockEntity({ title: "A", related: ["b"], content: "Also [[b]]." }),
      mockEntity({ title: "B" }),
    ];
    const graph = buildKnowledgeGraph(entities);
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0].weight).toBe(2);
  });

  test("merges bidirectional edges (A→B and B→A)", () => {
    const entities = [
      mockEntity({ title: "A", related: ["b"] }),
      mockEntity({ title: "B", related: ["a"] }),
    ];
    const graph = buildKnowledgeGraph(entities);
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0].weight).toBe(2);
  });

  test("node size scales with connection count", () => {
    const entities = [
      mockEntity({ title: "Hub", related: ["a", "b", "c"] }),
      mockEntity({ title: "A" }),
      mockEntity({ title: "B" }),
      mockEntity({ title: "C" }),
    ];
    const graph = buildKnowledgeGraph(entities);
    const hubNode = graph.nodes.find((n) => n.id === "hub");
    const leafNode = graph.nodes.find((n) => n.id === "a");
    expect(hubNode!.size).toBeGreaterThan(leafNode!.size);
  });

  test("handles empty entity list", () => {
    const graph = buildKnowledgeGraph([]);
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  test("handles entities with no relationships", () => {
    const entities = [mockEntity({ title: "Isolated" })];
    const graph = buildKnowledgeGraph(entities);
    expect(graph.nodes.length).toBe(1);
    expect(graph.edges.length).toBe(0);
    expect(graph.nodes[0].size).toBe(10); // minimum size
  });

  test("full mock entities produce correct node count", () => {
    const graph = buildKnowledgeGraph(mockEntities());
    expect(graph.nodes.length).toBe(5);
  });

  test("full mock entities produce edges", () => {
    const graph = buildKnowledgeGraph(mockEntities());
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  test("edge label defaults to related", () => {
    const entities = [
      mockEntity({ title: "A", related: ["b"] }),
      mockEntity({ title: "B" }),
    ];
    const graph = buildKnowledgeGraph(entities);
    expect(graph.edges[0].label).toBe("related");
  });
});

// ---------------------------------------------------------------------------
// buildTopicClusters
// ---------------------------------------------------------------------------

describe("buildTopicClusters", () => {
  test("groups entities by tags", () => {
    const entities = mockEntities();
    const { clusters } = buildTopicClusters(entities);
    const topicNames = clusters.map((c) => c.topic);
    expect(topicNames).toContain("resilience");
    expect(topicNames).toContain("infrastructure");
    expect(topicNames).toContain("security");
  });

  test("entity appears in multiple clusters if it has multiple tags", () => {
    const entities = [mockEntity({ title: "Multi", tags: ["a", "b"] })];
    const { clusters } = buildTopicClusters(entities);
    expect(clusters.length).toBe(2);
  });

  test("entities with no tags go to uncategorized", () => {
    const entities = [mockEntity({ title: "No Tags", tags: [] })];
    const { clusters } = buildTopicClusters(entities);
    expect(clusters[0].topic).toBe("uncategorized");
  });

  test("clusters are sorted by entity count descending", () => {
    const { clusters } = buildTopicClusters(mockEntities());
    for (let i = 1; i < clusters.length; i++) {
      expect(clusters[i].entities.length).toBeLessThanOrEqual(clusters[i - 1].entities.length);
    }
  });

  test("handles empty entity list", () => {
    const { clusters } = buildTopicClusters([]);
    expect(clusters).toEqual([]);
  });

  test("single entity single tag produces one cluster", () => {
    const entities = [mockEntity({ title: "Solo", tags: ["alpha"] })];
    const { clusters } = buildTopicClusters(entities);
    expect(clusters.length).toBe(1);
    expect(clusters[0].topic).toBe("alpha");
    expect(clusters[0].entities.length).toBe(1);
  });

  test("cluster entity titles match input", () => {
    const entities = [
      mockEntity({ title: "Alpha", tags: ["test"] }),
      mockEntity({ title: "Beta", tags: ["test"] }),
    ];
    const { clusters } = buildTopicClusters(entities);
    const titles = clusters[0].entities.map((e) => e.title);
    expect(titles).toContain("Alpha");
    expect(titles).toContain("Beta");
  });
});

// ---------------------------------------------------------------------------
// buildTimeline
// ---------------------------------------------------------------------------

describe("buildTimeline", () => {
  test("creates events sorted by date", () => {
    const { events } = buildTimeline(mockEntities());
    for (let i = 1; i < events.length; i++) {
      expect(events[i].date >= events[i - 1].date).toBe(true);
    }
  });

  test("includes created and updated events when dates differ", () => {
    const entity = mockEntity({
      title: "Dual Date",
      created: "2025-01-01",
      updated: "2025-01-15",
    });
    const { events } = buildTimeline([entity]);
    expect(events.length).toBe(2);
    const eventTypes = events.map((e) => e.event);
    expect(eventTypes).toContain("created");
    expect(eventTypes).toContain("updated");
  });

  test("single event when created equals updated", () => {
    const entity = mockEntity({
      title: "Same Date",
      created: "2025-01-15",
      updated: "2025-01-15",
    });
    const { events } = buildTimeline([entity]);
    expect(events.length).toBe(1);
    expect(events[0].event).toBe("created");
  });

  test("single event when no created date", () => {
    const entity = mockEntity({ title: "No Created" });
    delete (entity as unknown as Record<string, unknown>).created;
    const { events } = buildTimeline([entity]);
    expect(events.length).toBe(1);
    expect(events[0].event).toBe("created");
  });

  test("handles empty entity list", () => {
    const { events } = buildTimeline([]);
    expect(events).toEqual([]);
  });

  test("event entities match input", () => {
    const entity = mockEntity({ title: "Timeline Test" });
    const { events } = buildTimeline([entity]);
    expect(events[0].entity.title).toBe("Timeline Test");
  });

  test("events preserve entity type", () => {
    const entity = mockEntity({ title: "Platform", type: "platform" });
    const { events } = buildTimeline([entity]);
    expect(events[0].entity.type).toBe("platform");
  });

  test("multiple entities produce multiple events", () => {
    const entities = mockEntities();
    const { events } = buildTimeline(entities);
    expect(events.length).toBeGreaterThan(entities.length - 1);
  });
});
