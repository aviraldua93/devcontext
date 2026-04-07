/**
 * Knowledge Visualize — public API surface.
 */

export type {
  VisualizationType,
  VisualizationConfig,
  GraphNode,
  GraphEdge,
  KnowledgeGraph,
  TopicCluster,
  TimelineEvent,
} from "./types.js";

export {
  buildKnowledgeGraph,
  buildTopicClusters,
  buildTimeline,
  extractWikilinks,
  getTypeColor,
} from "./graph-builder.js";

export {
  renderKnowledgeGraph,
  renderTopicClusters,
  renderTimeline,
  renderResearchLandscape,
} from "./html-renderer.js";

export { generateVisualization, loadEntitiesFromDir } from "./generator.js";
