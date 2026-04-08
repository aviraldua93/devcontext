/**
 * MCP Protocol Types — simplified JSON-RPC types for the Model Context Protocol.
 *
 * No external MCP SDK dependency — these types cover the subset of the
 * protocol needed for tool-based servers (initialize, tools/list, tools/call).
 */

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tool invocation
// ---------------------------------------------------------------------------

export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tool result
// ---------------------------------------------------------------------------

export interface McpToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

// ---------------------------------------------------------------------------
// Server config
// ---------------------------------------------------------------------------

export interface McpServerConfig {
  name: string;
  version: string;
  workspaceDir: string;
}

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 message types
// ---------------------------------------------------------------------------

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ---------------------------------------------------------------------------
// Standard JSON-RPC error codes
// ---------------------------------------------------------------------------

export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// ---------------------------------------------------------------------------
// MCP protocol constants
// ---------------------------------------------------------------------------

export const MCP_PROTOCOL_VERSION = "2024-11-05";
