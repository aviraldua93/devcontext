/**
 * Unit tests for src/mcp/tools.ts — MCP tool definitions and schemas
 */

import { describe, test, expect } from "bun:test";
import { ALL_TOOLS, getToolByName } from "../../src/mcp/tools.js";
import type { McpTool } from "../../src/mcp/types.js";

// ---------------------------------------------------------------------------
// Tool registry completeness
// ---------------------------------------------------------------------------

describe("ALL_TOOLS registry", () => {
  test("exports a non-empty array", () => {
    expect(ALL_TOOLS).toBeArray();
    expect(ALL_TOOLS.length).toBeGreaterThanOrEqual(15);
  });

  test("every tool has a name", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.name).toBeString();
      expect(tool.name.length).toBeGreaterThan(0);
    }
  });

  test("every tool has a description", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.description).toBeString();
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  test("every tool has an inputSchema object", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.inputSchema).toBeObject();
    }
  });

  test("all tool names are unique", () => {
    const names = ALL_TOOLS.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  test("all tool names follow snake_case convention", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  test("all inputSchemas have type 'object'", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  test("all inputSchemas have a properties field", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.inputSchema.properties).toBeDefined();
      expect(typeof tool.inputSchema.properties).toBe("object");
    }
  });
});

// ---------------------------------------------------------------------------
// Knowledge tools
// ---------------------------------------------------------------------------

describe("knowledge tools", () => {
  test("knowledge_search is defined", () => {
    const tool = getToolByName("knowledge_search");
    expect(tool).toBeDefined();
  });

  test("knowledge_search requires query parameter", () => {
    const tool = getToolByName("knowledge_search")!;
    expect(tool.inputSchema.required).toContain("query");
  });

  test("knowledge_search has query and limit properties", () => {
    const tool = getToolByName("knowledge_search")!;
    const props = tool.inputSchema.properties as Record<string, unknown>;
    expect(props.query).toBeDefined();
    expect(props.limit).toBeDefined();
  });

  test("knowledge_get_entity requires slug", () => {
    const tool = getToolByName("knowledge_get_entity")!;
    expect(tool).toBeDefined();
    expect(tool.inputSchema.required).toContain("slug");
  });

  test("knowledge_list_entities accepts optional type filter", () => {
    const tool = getToolByName("knowledge_list_entities")!;
    expect(tool).toBeDefined();
    const props = tool.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props.type).toBeDefined();
    expect(props.type.enum).toBeArray();
  });

  test("knowledge_list_entities type enum has all entity types", () => {
    const tool = getToolByName("knowledge_list_entities")!;
    const props = tool.inputSchema.properties as Record<string, Record<string, unknown>>;
    const typeEnum = props.type.enum as string[];
    expect(typeEnum).toContain("platform");
    expect(typeEnum).toContain("system");
    expect(typeEnum).toContain("repo");
    expect(typeEnum).toContain("tool");
    expect(typeEnum).toContain("concept");
    expect(typeEnum).toContain("person");
    expect(typeEnum).toContain("team");
  });

  test("knowledge_create_entity requires title and type", () => {
    const tool = getToolByName("knowledge_create_entity")!;
    expect(tool).toBeDefined();
    const required = tool.inputSchema.required as string[];
    expect(required).toContain("title");
    expect(required).toContain("type");
  });

  test("knowledge_create_entity has tags and related array schemas", () => {
    const tool = getToolByName("knowledge_create_entity")!;
    const props = tool.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props.tags).toBeDefined();
    expect(props.tags.type).toBe("array");
    expect(props.related).toBeDefined();
    expect(props.related.type).toBe("array");
  });

  test("knowledge_update_entity requires slug", () => {
    const tool = getToolByName("knowledge_update_entity")!;
    expect(tool).toBeDefined();
    expect(tool.inputSchema.required).toContain("slug");
  });

  test("knowledge_update_entity has optional fields", () => {
    const tool = getToolByName("knowledge_update_entity")!;
    const props = tool.inputSchema.properties as Record<string, unknown>;
    expect(props.title).toBeDefined();
    expect(props.type).toBeDefined();
    expect(props.content).toBeDefined();
    expect(props.tags).toBeDefined();
    expect(props.related).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Scenario tools
// ---------------------------------------------------------------------------

describe("scenario tools", () => {
  test("scenario_list is defined with optional status filter", () => {
    const tool = getToolByName("scenario_list")!;
    expect(tool).toBeDefined();
    const props = tool.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props.status).toBeDefined();
    expect(props.status.enum).toBeArray();
  });

  test("scenario_list status enum has all lifecycle states", () => {
    const tool = getToolByName("scenario_list")!;
    const props = tool.inputSchema.properties as Record<string, Record<string, unknown>>;
    const statuses = props.status.enum as string[];
    expect(statuses).toContain("active");
    expect(statuses).toContain("paused");
    expect(statuses).toContain("handed-off");
    expect(statuses).toContain("archived");
  });

  test("scenario_get requires name", () => {
    const tool = getToolByName("scenario_get")!;
    expect(tool).toBeDefined();
    expect(tool.inputSchema.required).toContain("name");
  });

  test("scenario_create requires name and description", () => {
    const tool = getToolByName("scenario_create")!;
    expect(tool).toBeDefined();
    const required = tool.inputSchema.required as string[];
    expect(required).toContain("name");
    expect(required).toContain("description");
  });

  test("scenario_create has template enum", () => {
    const tool = getToolByName("scenario_create")!;
    const props = tool.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props.template).toBeDefined();
    expect(props.template.enum).toBeArray();
    expect((props.template.enum as string[]).length).toBeGreaterThan(0);
  });

  test("scenario_save requires name", () => {
    const tool = getToolByName("scenario_save")!;
    expect(tool).toBeDefined();
    expect(tool.inputSchema.required).toContain("name");
  });

  test("scenario_save has context fields", () => {
    const tool = getToolByName("scenario_save")!;
    const props = tool.inputSchema.properties as Record<string, unknown>;
    expect(props.summary).toBeDefined();
    expect(props.next_steps).toBeDefined();
    expect(props.blockers).toBeDefined();
    expect(props.notes).toBeDefined();
    expect(props.open_prs).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Memory tools
// ---------------------------------------------------------------------------

describe("memory tools", () => {
  test("memory_query is defined and requires query", () => {
    const tool = getToolByName("memory_query")!;
    expect(tool).toBeDefined();
    expect(tool.inputSchema.required).toContain("query");
  });

  test("memory_identity is defined with empty properties", () => {
    const tool = getToolByName("memory_identity")!;
    expect(tool).toBeDefined();
    const props = tool.inputSchema.properties as Record<string, unknown>;
    expect(Object.keys(props).length).toBe(0);
  });

  test("memory_stats is defined with empty properties", () => {
    const tool = getToolByName("memory_stats")!;
    expect(tool).toBeDefined();
    const props = tool.inputSchema.properties as Record<string, unknown>;
    expect(Object.keys(props).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Paper tools
// ---------------------------------------------------------------------------

describe("paper tools", () => {
  test("papers_search is defined and requires query", () => {
    const tool = getToolByName("papers_search")!;
    expect(tool).toBeDefined();
    expect(tool.inputSchema.required).toContain("query");
  });

  test("papers_search has maxResults and topics", () => {
    const tool = getToolByName("papers_search")!;
    const props = tool.inputSchema.properties as Record<string, unknown>;
    expect(props.maxResults).toBeDefined();
    expect(props.topics).toBeDefined();
  });

  test("papers_curate requires topics and keywords", () => {
    const tool = getToolByName("papers_curate")!;
    expect(tool).toBeDefined();
    const required = tool.inputSchema.required as string[];
    expect(required).toContain("topics");
    expect(required).toContain("keywords");
  });

  test("papers_curate has minRelevanceScore and maxPapers", () => {
    const tool = getToolByName("papers_curate")!;
    const props = tool.inputSchema.properties as Record<string, unknown>;
    expect(props.minRelevanceScore).toBeDefined();
    expect(props.maxPapers).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Visualization tools
// ---------------------------------------------------------------------------

describe("visualization tools", () => {
  test("visualize_knowledge is defined", () => {
    const tool = getToolByName("visualize_knowledge")!;
    expect(tool).toBeDefined();
  });

  test("visualize_knowledge requires type and outputPath", () => {
    const tool = getToolByName("visualize_knowledge")!;
    const required = tool.inputSchema.required as string[];
    expect(required).toContain("type");
    expect(required).toContain("outputPath");
  });

  test("visualize_knowledge type has valid enum", () => {
    const tool = getToolByName("visualize_knowledge")!;
    const props = tool.inputSchema.properties as Record<string, Record<string, unknown>>;
    const types = props.type.enum as string[];
    expect(types).toContain("knowledge-graph");
    expect(types).toContain("topic-clusters");
    expect(types).toContain("timeline");
    expect(types).toContain("research-landscape");
    expect(types).toContain("entity-connections");
  });

  test("visualize_knowledge has optional title and query", () => {
    const tool = getToolByName("visualize_knowledge")!;
    const props = tool.inputSchema.properties as Record<string, unknown>;
    expect(props.title).toBeDefined();
    expect(props.query).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getToolByName
// ---------------------------------------------------------------------------

describe("getToolByName", () => {
  test("returns undefined for unknown tool", () => {
    expect(getToolByName("nonexistent_tool")).toBeUndefined();
  });

  test("returns the correct tool for each known name", () => {
    for (const tool of ALL_TOOLS) {
      const found = getToolByName(tool.name);
      expect(found).toBeDefined();
      expect(found!.name).toBe(tool.name);
      expect(found!.description).toBe(tool.description);
    }
  });

  test("returned tool has matching inputSchema", () => {
    const tool = getToolByName("knowledge_search")!;
    expect(tool.inputSchema).toStrictEqual(
      ALL_TOOLS.find((t) => t.name === "knowledge_search")!.inputSchema,
    );
  });
});

// ---------------------------------------------------------------------------
// Schema validation structure
// ---------------------------------------------------------------------------

describe("schema structure validation", () => {
  test("tools with required fields declare them as arrays", () => {
    for (const tool of ALL_TOOLS) {
      if (tool.inputSchema.required !== undefined) {
        expect(tool.inputSchema.required).toBeArray();
      }
    }
  });

  test("property definitions have type field", () => {
    for (const tool of ALL_TOOLS) {
      const props = tool.inputSchema.properties as Record<string, Record<string, unknown>>;
      for (const [key, prop] of Object.entries(props)) {
        expect(prop.type).toBeDefined();
      }
    }
  });

  test("array properties have items field", () => {
    for (const tool of ALL_TOOLS) {
      const props = tool.inputSchema.properties as Record<string, Record<string, unknown>>;
      for (const [key, prop] of Object.entries(props)) {
        if (prop.type === "array") {
          expect(prop.items).toBeDefined();
        }
      }
    }
  });

  test("all properties have description", () => {
    for (const tool of ALL_TOOLS) {
      const props = tool.inputSchema.properties as Record<string, Record<string, unknown>>;
      for (const [key, prop] of Object.entries(props)) {
        expect(prop.description).toBeString();
      }
    }
  });
});
