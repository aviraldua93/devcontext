/**
 * Graph Builder — transform knowledge entities into graph structures.
 *
 * Builds knowledge graphs, topic clusters, and timelines from a list of
 * KnowledgeEntity objects. Extracts relationships from the `related` field
 * in frontmatter and [[wikilink]] references in Markdown content.
 */

import type { KnowledgeEntity } from "../../types.js";
import type {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  TopicCluster,
  TimelineEvent,
} from "./types.js";

// ---------------------------------------------------------------------------
// Colour palette by entity type
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  concept: "#6366f1",   // indigo
  tool: "#10b981",      // emerald
  platform: "#f59e0b",  // amber
  system: "#ef4444",    // red
  repo: "#3b82f6",      // blue
  person: "#ec4899",    // pink
  team: "#8b5cf6",      // violet
};

export function getTypeColor(type: string): string {
  return TYPE_COLORS[type] ?? "#94a3b8"; // slate fallback
}

// ---------------------------------------------------------------------------
// Slugify — mirror the slug logic used in entities.ts
// ---------------------------------------------------------------------------

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 128);
}

// ---------------------------------------------------------------------------
// Wikilink extractor
// ---------------------------------------------------------------------------

/**
 * Extract [[wikilink]] references from Markdown content.
 * Returns an array of slugified link targets.
 */
export function extractWikilinks(content: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    links.push(slugify(match[1]));
  }
  return links;
}

// ---------------------------------------------------------------------------
// buildKnowledgeGraph
// ---------------------------------------------------------------------------

/**
 * Build a KnowledgeGraph from an array of entities.
 *
 * - Each entity becomes a node coloured by type and sized by connection count.
 * - Edges come from the `related` frontmatter field + extracted [[wikilinks]].
 * - Edge weight reflects co-occurrence count (duplicate edges are merged).
 */
export function buildKnowledgeGraph(entities: KnowledgeEntity[]): KnowledgeGraph {
  // Build a slug → entity lookup
  const slugMap = new Map<string, KnowledgeEntity>();
  for (const entity of entities) {
    slugMap.set(slugify(entity.title), entity);
  }

  // Collect raw edges (source slug → target slug)
  const edgeCounts = new Map<string, { source: string; target: string; count: number }>();

  for (const entity of entities) {
    const sourceSlug = slugify(entity.title);

    // Edges from `related` field
    const relatedSlugs = entity.related ?? [];

    // Edges from wikilinks in content
    const wikilinkSlugs = extractWikilinks(entity.content ?? "");

    const allTargets = [...relatedSlugs, ...wikilinkSlugs];

    for (const target of allTargets) {
      // Normalise edge key so A→B and B→A merge into one undirected edge
      const [a, b] = [sourceSlug, target].sort();
      const key = `${a}::${b}`;
      const existing = edgeCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        edgeCounts.set(key, { source: a, target: b, count: 1 });
      }
    }
  }

  // Count connections per node for sizing
  const connectionCount = new Map<string, number>();
  for (const { source, target, count } of edgeCounts.values()) {
    connectionCount.set(source, (connectionCount.get(source) ?? 0) + count);
    connectionCount.set(target, (connectionCount.get(target) ?? 0) + count);
  }

  // Build nodes
  const nodes: GraphNode[] = entities.map((entity) => {
    const slug = slugify(entity.title);
    const connections = connectionCount.get(slug) ?? 0;
    return {
      id: slug,
      label: entity.title,
      type: entity.type,
      size: Math.max(10, Math.min(50, 10 + connections * 5)),
      metadata: {
        tags: entity.tags ?? [],
        updated: entity.updated,
        related: entity.related ?? [],
        color: getTypeColor(entity.type),
      },
    };
  });

  // Build edges
  const edges: GraphEdge[] = [];
  for (const { source, target, count } of edgeCounts.values()) {
    edges.push({
      source,
      target,
      label: "related",
      weight: count,
    });
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// buildTopicClusters
// ---------------------------------------------------------------------------

/**
 * Group entities by tags into topic clusters.
 * Each tag produces one cluster containing all entities with that tag.
 * Entities with no tags end up in an "uncategorized" cluster.
 */
export function buildTopicClusters(
  entities: KnowledgeEntity[],
): { clusters: TopicCluster[] } {
  const tagMap = new Map<string, KnowledgeEntity[]>();

  for (const entity of entities) {
    const tags = entity.tags && entity.tags.length > 0 ? entity.tags : ["uncategorized"];
    for (const tag of tags) {
      const list = tagMap.get(tag) ?? [];
      list.push(entity);
      tagMap.set(tag, list);
    }
  }

  const clusters: TopicCluster[] = Array.from(tagMap.entries())
    .map(([topic, ents]) => ({ topic, entities: ents }))
    .sort((a, b) => b.entities.length - a.entities.length);

  return { clusters };
}

// ---------------------------------------------------------------------------
// buildTimeline
// ---------------------------------------------------------------------------

/**
 * Build a chronological timeline from entities sorted by their `updated` date.
 * Also includes creation events when `created` differs from `updated`.
 */
export function buildTimeline(
  entities: KnowledgeEntity[],
): { events: TimelineEvent[] } {
  const events: TimelineEvent[] = [];

  for (const entity of entities) {
    // Add creation event if created date exists and differs from updated
    if (entity.created && entity.created !== entity.updated) {
      events.push({
        date: entity.created,
        entity,
        event: "created",
      });
    }

    events.push({
      date: entity.updated,
      entity,
      event: entity.created && entity.created !== entity.updated ? "updated" : "created",
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  return { events };
}
