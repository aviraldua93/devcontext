/**
 * Visualization types for interactive knowledge graph rendering.
 *
 * Defines the data structures used to build and render knowledge graphs,
 * topic clusters, timelines, and research landscapes as self-contained HTML.
 */

import type { KnowledgeEntity } from "../../types.js";

// ---------------------------------------------------------------------------
// Visualization type enum
// ---------------------------------------------------------------------------

export type VisualizationType =
  | "knowledge-graph"
  | "topic-clusters"
  | "timeline"
  | "research-landscape"
  | "entity-connections";

// ---------------------------------------------------------------------------
// Visualization configuration
// ---------------------------------------------------------------------------

export interface VisualizationConfig {
  /** Which visualization to generate. */
  type: VisualizationType;
  /** Title displayed in the rendered output. */
  title: string;
  /** Optional pre-loaded entities (skips filesystem scan). */
  entities?: KnowledgeEntity[];
  /** Optional FTS5 query to filter entities. */
  query?: string;
  /** File path for the rendered HTML output. */
  outputPath: string;
  /** Whether the output should include interactive JS controls. */
  interactive: boolean;
}

// ---------------------------------------------------------------------------
// Graph primitives
// ---------------------------------------------------------------------------

export interface GraphNode {
  /** Unique identifier (typically the entity slug). */
  id: string;
  /** Display label (entity title). */
  label: string;
  /** Entity type — drives colour coding. */
  type: string;
  /** Node radius / importance weight. */
  size: number;
  /** Arbitrary metadata carried through to the renderer. */
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  /** Relationship label. */
  label: string;
  /** Edge weight (higher = stronger relationship). */
  weight: number;
}

// ---------------------------------------------------------------------------
// Composite graph
// ---------------------------------------------------------------------------

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ---------------------------------------------------------------------------
// Topic cluster
// ---------------------------------------------------------------------------

export interface TopicCluster {
  /** Cluster topic name (tag). */
  topic: string;
  /** Entities belonging to this cluster. */
  entities: KnowledgeEntity[];
}

// ---------------------------------------------------------------------------
// Timeline event
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  /** ISO date string. */
  date: string;
  /** The entity associated with this event. */
  entity: KnowledgeEntity;
  /** Description of the event (e.g. "created", "updated"). */
  event: string;
}
