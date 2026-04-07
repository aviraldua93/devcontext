/**
 * Unit tests for src/sync/auth.ts — git authentication utilities.
 *
 * Tests transient auth argument generation, branch name validation,
 * and token redaction. Zero external calls.
 */

import { describe, test, expect } from "bun:test";
import { gitAuthArgs, validateBranchName, redactToken } from "../../src/sync/auth.js";

// ---------------------------------------------------------------------------
// gitAuthArgs — transient authentication
// ---------------------------------------------------------------------------

describe("gitAuthArgs", () => {
  test("returns empty array when token is undefined", () => {
    expect(gitAuthArgs(undefined)).toEqual([]);
  });

  test("returns empty array when token is empty string", () => {
    expect(gitAuthArgs("")).toEqual([]);
  });

  test("returns -c http.extraheader args for a valid token", () => {
    const args = gitAuthArgs("ghp_test123");
    expect(args).toHaveLength(2);
    expect(args[0]).toBe("-c");
    expect(args[1]).toContain("http.extraheader=Authorization: Basic ");
  });

  test("base64-encodes x-access-token:<token>", () => {
    const token = "ghp_mytoken";
    const args = gitAuthArgs(token);
    const encoded = Buffer.from(`x-access-token:${token}`).toString("base64");
    expect(args[1]).toBe(`http.extraheader=Authorization: Basic ${encoded}`);
  });

  test("uses x-access-token format (not username:password)", () => {
    const args = gitAuthArgs("abc");
    const base64Part = args[1].split("Basic ")[1];
    const decoded = Buffer.from(base64Part, "base64").toString("utf8");
    expect(decoded).toStartWith("x-access-token:");
    expect(decoded).toBe("x-access-token:abc");
  });

  test("handles tokens with special characters", () => {
    const token = "ghp_!@#$%^&*()_+=";
    const args = gitAuthArgs(token);
    expect(args).toHaveLength(2);
    const base64Part = args[1].split("Basic ")[1];
    const decoded = Buffer.from(base64Part, "base64").toString("utf8");
    expect(decoded).toBe(`x-access-token:${token}`);
  });

  test("handles very long tokens", () => {
    const token = "ghp_" + "a".repeat(1000);
    const args = gitAuthArgs(token);
    expect(args).toHaveLength(2);
    expect(args[1]).toContain("Basic ");
  });
});

// ---------------------------------------------------------------------------
// validateBranchName — input validation / injection prevention
// ---------------------------------------------------------------------------

describe("validateBranchName", () => {
  test("accepts simple alphanumeric names", () => {
    expect(validateBranchName("main")).toBe("main");
    expect(validateBranchName("develop")).toBe("develop");
    expect(validateBranchName("v1")).toBe("v1");
  });

  test("accepts names with hyphens", () => {
    expect(validateBranchName("feature-branch")).toBe("feature-branch");
    expect(validateBranchName("my-long-branch-name")).toBe("my-long-branch-name");
  });

  test("accepts names with underscores", () => {
    expect(validateBranchName("feature_branch")).toBe("feature_branch");
  });

  test("accepts names with dots", () => {
    expect(validateBranchName("release.1.0")).toBe("release.1.0");
  });

  test("accepts names with forward slashes", () => {
    expect(validateBranchName("feature/my-feature")).toBe("feature/my-feature");
    expect(validateBranchName("handoff/my-scenario")).toBe("handoff/my-scenario");
  });

  test("accepts complex valid branch names", () => {
    expect(validateBranchName("releases/v1.2.3")).toBe("releases/v1.2.3");
    expect(validateBranchName("user/feature_branch-v2")).toBe("user/feature_branch-v2");
  });

  test("rejects empty string", () => {
    expect(() => validateBranchName("")).toThrow("Invalid branch name");
  });

  test("rejects names starting with hyphen", () => {
    expect(() => validateBranchName("-main")).toThrow("Invalid branch name");
  });

  test("rejects names starting with dot", () => {
    expect(() => validateBranchName(".hidden")).toThrow("Invalid branch name");
  });

  test("rejects names starting with slash", () => {
    expect(() => validateBranchName("/invalid")).toThrow("Invalid branch name");
  });

  test("rejects double dots (directory traversal)", () => {
    expect(() => validateBranchName("foo..bar")).toThrow("Double dots");
  });

  test("rejects shell metacharacters — semicolon", () => {
    expect(() => validateBranchName("main;rm -rf")).toThrow("Invalid branch name");
  });

  test("rejects shell metacharacters — backtick", () => {
    expect(() => validateBranchName("main`whoami`")).toThrow("Invalid branch name");
  });

  test("rejects shell metacharacters — dollar sign", () => {
    expect(() => validateBranchName("main$HOME")).toThrow("Invalid branch name");
  });

  test("rejects shell metacharacters — pipe", () => {
    expect(() => validateBranchName("main|cat")).toThrow("Invalid branch name");
  });

  test("rejects shell metacharacters — ampersand", () => {
    expect(() => validateBranchName("main&&echo")).toThrow("Invalid branch name");
  });

  test("rejects spaces", () => {
    expect(() => validateBranchName("my branch")).toThrow("Invalid branch name");
  });

  test("rejects parentheses", () => {
    expect(() => validateBranchName("main(1)")).toThrow("Invalid branch name");
  });

  test("rejects curly braces", () => {
    expect(() => validateBranchName("main{1}")).toThrow("Invalid branch name");
  });

  test("rejects tilde", () => {
    expect(() => validateBranchName("main~1")).toThrow("Invalid branch name");
  });

  test("rejects caret", () => {
    expect(() => validateBranchName("main^2")).toThrow("Invalid branch name");
  });

  test("rejects names with only special characters", () => {
    expect(() => validateBranchName("!@#")).toThrow("Invalid branch name");
  });
});

// ---------------------------------------------------------------------------
// redactToken — output sanitization
// ---------------------------------------------------------------------------

describe("redactToken", () => {
  test("returns original output when token is undefined", () => {
    expect(redactToken("some output ghp_abc", undefined)).toBe("some output ghp_abc");
  });

  test("returns original output when token is empty", () => {
    expect(redactToken("some output", "")).toBe("some output");
  });

  test("returns original output when output is empty", () => {
    expect(redactToken("", "ghp_abc")).toBe("");
  });

  test("redacts a single token occurrence", () => {
    expect(redactToken("error: ghp_secret123 is invalid", "ghp_secret123"))
      .toBe("error: [REDACTED] is invalid");
  });

  test("redacts multiple token occurrences", () => {
    const output = "token ghp_abc used at ghp_abc endpoint";
    expect(redactToken(output, "ghp_abc"))
      .toBe("token [REDACTED] used at [REDACTED] endpoint");
  });

  test("does not modify output that doesn't contain the token", () => {
    expect(redactToken("clean output here", "ghp_secret")).toBe("clean output here");
  });

  test("handles token in URL", () => {
    const output = "https://ghp_secret@github.com/org/repo.git";
    expect(redactToken(output, "ghp_secret"))
      .toBe("https://[REDACTED]@github.com/org/repo.git");
  });

  test("handles multiline output", () => {
    const output = "line1 ghp_tok\nline2 ghp_tok\nline3";
    expect(redactToken(output, "ghp_tok"))
      .toBe("line1 [REDACTED]\nline2 [REDACTED]\nline3");
  });

  test("handles token with special regex characters", () => {
    // replaceAll is used, not regex, so this should work fine
    const output = "the token is ghp_abc.def";
    expect(redactToken(output, "ghp_abc.def"))
      .toBe("the token is [REDACTED]");
  });

  test("returns output unchanged when both are empty", () => {
    expect(redactToken("", "")).toBe("");
  });

  test("handles very long output with token", () => {
    const longOutput = "x".repeat(10000) + "ghp_secret" + "y".repeat(10000);
    const result = redactToken(longOutput, "ghp_secret");
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("ghp_secret");
  });
});
