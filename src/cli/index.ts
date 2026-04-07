/**
 * DevContext CLI — entry point for the command-line interface.
 *
 * Uses Commander.js to define commands for scenario and knowledge management.
 * Enhanced with chalk (coloured output), ora (spinners), and inquirer (prompts).
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { createScenario, getScenario, listScenarios, updateScenario } from "../scenario/manager.js";
import { resumeScenario, handoffScenario, archiveScenario } from "../scenario/lifecycle.js";
import { getTemplates, applyTemplate } from "../scenario/templates.js";
import { loadSkillsForScenario } from "../skills/loader.js";
import { searchEntities } from "../knowledge/search.js";
import { createEntity, getEntity, listEntities, deleteEntity } from "../knowledge/entities.js";
import { pushScenario, pullScenario, cloneScenarioRepo } from "../sync/git.js";
import { createHandoffPR } from "../sync/handoff.js";
import { getConfig } from "../config.js";
import type { Scenario, ScenarioStatus, KnowledgeEntityType } from "../types.js";

// ---------------------------------------------------------------------------
// Error classification — map common errors to actionable suggestions
// ---------------------------------------------------------------------------

function formatCliError(err: unknown): string {
  const msg = (err as Error).message ?? String(err);

  if (msg.includes("not found")) {
    return `${msg}\n  ${chalk.dim("Hint: Run")} ${chalk.cyan("devcontext list")} ${chalk.dim("to see available scenarios.")}`;
  }
  if (msg.includes("already exists")) {
    return `${msg}\n  ${chalk.dim("Hint: Choose a different name, or delete the existing one first.")}`;
  }
  if (msg.includes("Invalid scenario")) {
    return `${msg}\n  ${chalk.dim("Hint: Check that the name is kebab-case and all required fields are provided.")}`;
  }
  if (msg.includes("GITHUB_TOKEN")) {
    return `${msg}\n  ${chalk.dim("Hint: Set the GITHUB_TOKEN environment variable with a personal access token.")}`;
  }
  if (msg.includes("Invalid entity")) {
    return `${msg}\n  ${chalk.dim("Hint: Ensure title, type (platform|system|repo|tool|concept|person|team), and updated date (YYYY-MM-DD) are valid.")}`;
  }
  if (msg.includes("Authentication failed")) {
    return `${msg}\n  ${chalk.dim("Hint: Verify your GITHUB_TOKEN has the 'repo' scope.")}`;
  }
  if (msg.includes("Network error")) {
    return `${msg}\n  ${chalk.dim("Hint: Check your internet connection and verify the repository URL.")}`;
  }
  return msg;
}

// ---------------------------------------------------------------------------
// CLI setup
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name("devcontext")
  .description("Portable AI-driven working scenarios — Docker for your engineering brain")
  .version("0.1.0")
  .addHelpText("after", `
Examples:
  $ devcontext init                            Initialize workspace
  $ devcontext create my-api --template web-api  Create from template
  $ devcontext recall my-api                   Resume a scenario
  $ devcontext list --status active            List active scenarios
  $ devcontext knowledge search "retry"        Search knowledge wiki
  $ devcontext push my-api                     Push scenario to GitHub
  $ devcontext pull my-api                     Pull scenario from GitHub
`);

// ---------------------------------------------------------------------------
// init — initialize workspace structure
// ---------------------------------------------------------------------------

program
  .command("init")
  .description("Initialize the DevContext workspace directory structure")
  .addHelpText("after", `
Example:
  $ devcontext init
`)
  .action(async () => {
    const { existsSync, mkdirSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const home = getConfig().home;
    const dirs = ["scenarios", "knowledge", "skills"];
    const created: string[] = [];

    for (const dir of dirs) {
      const fullPath = join(home, dir);
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
        created.push(dir);
      }
    }

    const readmePath = join(home, "README.md");
    if (!existsSync(readmePath)) {
      writeFileSync(readmePath, [
        "# DevContext Workspace",
        "",
        "This directory contains your DevContext data.",
        "",
        "## Structure",
        "",
        "- `scenarios/` — Working scenario manifests (YAML)",
        "- `knowledge/` — Knowledge entities (Markdown + YAML frontmatter)",
        "- `skills/`    — Custom skill definitions (Markdown)",
        "",
        "Learn more: https://github.com/aviraldua93/devcontext",
        "",
      ].join("\n"), "utf8");
      created.push("README.md");
    }

    if (created.length > 0) {
      console.log(chalk.green(`✔ Initialized workspace at ${chalk.bold(home)}`));
      console.log(chalk.dim(`  Created: ${created.join(", ")}`));
    } else {
      console.log(chalk.dim(`Workspace already initialized at ${home}`));
    }
  });

// ---------------------------------------------------------------------------
// create — interactive scenario creation
// ---------------------------------------------------------------------------

program
  .command("create")
  .description("Create a new working scenario (interactive with --interactive)")
  .argument("[name]", "Scenario name (kebab-case)")
  .option("-d, --description <desc>", "Scenario description")
  .option("-t, --template <id>", "Use a scenario template")
  .option("--repo <repos...>", "Add repositories (format: url:branch)")
  .option("--skill <skills...>", "Add skills")
  .option("-i, --interactive", "Use interactive prompts")
  .addHelpText("after", `
Examples:
  $ devcontext create my-api -d "REST API project"
  $ devcontext create my-api --template web-api
  $ devcontext create my-api --repo https://github.com/org/repo:main --skill code-review
  $ devcontext create -i                         # interactive mode
`)
  .action(async (name: string | undefined, opts: {
    description?: string;
    template?: string;
    repo?: string[];
    skill?: string[];
    interactive?: boolean;
  }) => {
    const spinner = ora();
    try {
      let scenarioName = name;
      let description = opts.description ?? "New working scenario";
      let templateId = opts.template;

      // Interactive mode — use inquirer prompts
      if (opts.interactive || !scenarioName) {
        const { default: inquirer } = await import("inquirer");
        const answers = await inquirer.prompt([
          ...(!scenarioName ? [{
            type: "input" as const,
            name: "name",
            message: "Scenario name (kebab-case):",
            validate: (v: string) => /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(v) || "Must be kebab-case",
          }] : []),
          ...(!opts.description ? [{
            type: "input" as const,
            name: "description",
            message: "Description:",
            default: "New working scenario",
          }] : []),
          ...(!templateId ? [{
            type: "list" as const,
            name: "template",
            message: "Use a template?",
            choices: [
              { name: "None", value: "" },
              ...getTemplates().map(t => ({ name: `${t.label} — ${t.description}`, value: t.id })),
            ],
          }] : []),
        ]);

        scenarioName = scenarioName ?? answers.name;
        description = opts.description ?? answers.description ?? description;
        templateId = templateId ?? (answers.template || undefined);
      }

      if (!scenarioName) {
        console.error(chalk.red("Error: scenario name is required"));
        process.exit(1);
      }

      spinner.start(chalk.cyan(`Creating scenario ${chalk.bold(scenarioName)}…`));

      let scenario: Scenario;

      if (templateId) {
        scenario = applyTemplate(templateId, { name: scenarioName, description });
      } else {
        scenario = {
          name: scenarioName,
          version: "0.1.0",
          status: "active",
          description,
          repos: (opts.repo ?? []).map(r => {
            const [url, branch] = r.split(":");
            return { url, branch: branch ?? "main" };
          }),
          skills: (opts.skill ?? []).map(s => ({ name: s, source: "root" as const })),
          context: { summary: "", open_prs: [], next_steps: [], blockers: [], notes: "" },
        };
      }

      createScenario(scenario);
      spinner.succeed(chalk.green(`Created scenario: ${chalk.bold(scenarioName)}`));

      if (scenario.skills?.length) {
        console.log(chalk.dim(`  Skills: ${scenario.skills.map(s => s.name).join(", ")}`));
      }
    } catch (err: unknown) {
      spinner.fail(chalk.red(formatCliError(err)));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// recall — resume a scenario
// ---------------------------------------------------------------------------

program
  .command("recall")
  .description("Recall and resume a working scenario — clones/pulls repos, loads skills, restores context")
  .argument("<name>", "Scenario name")
  .option("--skip-repos", "Skip cloning/pulling repositories")
  .addHelpText("after", `
Examples:
  $ devcontext recall my-api              # full recall with repo clone/pull
  $ devcontext recall my-api --skip-repos # recall without touching repos
`)
  .action(async (name: string, opts: { skipRepos?: boolean }) => {
    const spinner = ora();
    try {
      spinner.start(chalk.cyan(`Recalling scenario ${chalk.bold(name)}…`));
      const scenario = getScenario(name);

      // If paused or handed-off, resume to active
      if (scenario.status === "paused" || scenario.status === "handed-off") {
        resumeScenario(name);
        scenario.status = "active";
      }

      spinner.succeed(chalk.green(`Recalled scenario: ${chalk.bold(scenario.name)}`));

      const statusColor = scenario.status === "active" ? chalk.green : chalk.yellow;
      console.log(`  ${chalk.dim("Status:")} ${statusColor(scenario.status)}`);
      if (scenario.context?.summary) {
        console.log(`  ${chalk.dim("Summary:")} ${scenario.context.summary}`);
      }
      if (scenario.context?.next_steps?.length) {
        console.log(chalk.dim("  Next steps:"));
        scenario.context.next_steps.forEach((s, i) =>
          console.log(`    ${chalk.cyan(`${i + 1}.`)} ${s}`)
        );
      }
      if (scenario.context?.blockers?.length) {
        console.log(chalk.dim("  Blockers:"));
        scenario.context.blockers.forEach(b =>
          console.log(`    ${chalk.red("\u26A0")} ${b}`)
        );
      }

      // Clone/pull repositories listed in the scenario
      if (!opts.skipRepos && scenario.repos?.length) {
        console.log(chalk.dim(`  Syncing ${scenario.repos.length} repo(s)…`));
        const { join } = await import("node:path");
        const { existsSync } = await import("node:fs");
        const syncBase = join(getConfig().home, "repos", scenario.name);

        for (const repo of scenario.repos) {
          const repoName = repo.url.split("/").pop()?.replace(/\.git$/, "") ?? "repo";
          const targetDir = join(syncBase, repoName);

          if (existsSync(join(targetDir, ".git"))) {
            const result = await pullScenario(scenario.name, repo.url, repo.branch);
            if (result.ok) {
              console.log(`    ${chalk.green("\u2714")} ${chalk.dim("Pulled")} ${repoName} ${chalk.dim(`(${repo.branch})`)}`);
            } else {
              console.log(`    ${chalk.yellow("\u26A0")} ${chalk.dim("Pull failed for")} ${repoName}: ${chalk.dim(result.stderr)}`);
            }
          } else {
            const result = await cloneScenarioRepo(repo.url, targetDir, repo.branch);
            if (result.ok) {
              console.log(`    ${chalk.green("\u2714")} ${chalk.dim("Cloned")} ${repoName} ${chalk.dim(`(${repo.branch})`)}`);
            } else {
              console.log(`    ${chalk.yellow("\u26A0")} ${chalk.dim("Clone failed for")} ${repoName}: ${chalk.dim(result.stderr)}`);
            }
          }
        }
      }

      // Load skills
      const skills = loadSkillsForScenario(scenario);
      if (skills.length) {
        console.log(chalk.dim(`  Skills loaded: ${skills.map(s => s.name).join(", ")}`));
      }
    } catch (err: unknown) {
      spinner.fail(chalk.red(formatCliError(err)));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// save — save scenario state
// ---------------------------------------------------------------------------

program
  .command("save")
  .description("Save current scenario state")
  .argument("<name>", "Scenario name")
  .option("-s, --summary <text>", "Update summary")
  .option("--next-step <steps...>", "Set next steps")
  .option("--blocker <blockers...>", "Set blockers")
  .option("--note <text>", "Add notes")
  .addHelpText("after", `
Examples:
  $ devcontext save my-api --summary "Retry handler done"
  $ devcontext save my-api --next-step "Write tests" --next-step "Update docs"
  $ devcontext save my-api --blocker "Waiting on dependency release"
`)
  .action(async (name: string, opts: { summary?: string; nextStep?: string[]; blocker?: string[]; note?: string }) => {
    const spinner = ora();
    try {
      spinner.start(chalk.cyan(`Saving scenario ${chalk.bold(name)}…`));

      const updates: Partial<Scenario> = {};
      const context: Scenario["context"] = {};

      if (opts.summary) context.summary = opts.summary;
      if (opts.nextStep) context.next_steps = opts.nextStep;
      if (opts.blocker) context.blockers = opts.blocker;
      if (opts.note) context.notes = opts.note;

      if (Object.keys(context).length > 0) {
        const existing = getScenario(name);
        updates.context = { ...existing.context, ...context };
      }

      updateScenario(name, updates);
      spinner.succeed(chalk.green(`Saved scenario: ${chalk.bold(name)}`));
    } catch (err: unknown) {
      spinner.fail(chalk.red(formatCliError(err)));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// list — table output
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<ScenarioStatus, (s: string) => string> = {
  active: chalk.green,
  paused: chalk.yellow,
  "handed-off": chalk.blue,
  archived: chalk.dim,
};

program
  .command("list")
  .description("List all scenarios")
  .option("--status <status>", "Filter by status")
  .addHelpText("after", `
Examples:
  $ devcontext list
  $ devcontext list --status active
  $ devcontext list --status paused
`)
  .action(async (opts: { status?: string }) => {
    const spinner = ora();
    try {
      spinner.start(chalk.cyan("Loading scenarios…"));
      let scenarios = listScenarios();
      if (opts.status) {
        scenarios = scenarios.filter(s => s.status === opts.status);
      }
      spinner.stop();

      if (scenarios.length === 0) {
        console.log(chalk.dim("No scenarios found."));
        return;
      }

      // Table header
      const nameWidth = Math.max(20, ...scenarios.map(s => s.name.length + 2));
      const statusWidth = 14;
      console.log(
        chalk.bold(
          "NAME".padEnd(nameWidth) +
          "STATUS".padEnd(statusWidth) +
          "DESCRIPTION"
        )
      );
      console.log(chalk.dim("─".repeat(nameWidth + statusWidth + 30)));

      for (const s of scenarios) {
        const colorFn = STATUS_COLORS[s.status] ?? chalk.white;
        console.log(
          chalk.bold(s.name.padEnd(nameWidth)) +
          colorFn(s.status.padEnd(statusWidth)) +
          s.description
        );
      }

      console.log(chalk.dim(`\n${scenarios.length} scenario(s)`));
    } catch (err: unknown) {
      spinner.fail(chalk.red(formatCliError(err)));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// handoff — hand off with optional PR creation
// ---------------------------------------------------------------------------

program
  .command("handoff")
  .description("Hand off a scenario to another engineer")
  .argument("<name>", "Scenario name")
  .option("--to <engineer>", "Target engineer GitHub username")
  .option("--pr", "Create a GitHub PR for the handoff")
  .addHelpText("after", `
Examples:
  $ devcontext handoff my-api --to teammate
  $ devcontext handoff my-api --to teammate --pr
`)
  .action(async (name: string, opts: { to?: string; pr?: boolean }) => {
    const spinner = ora();
    try {
      spinner.start(chalk.cyan(`Handing off scenario ${chalk.bold(name)}…`));
      handoffScenario(name);

      if (opts.pr) {
        spinner.text = chalk.cyan("Creating handoff PR…");
        try {
          const prUrl = await createHandoffPR(name, opts.to);
          spinner.succeed(
            chalk.green(`Handed off scenario: ${chalk.bold(name)}`) +
            (opts.to ? chalk.dim(` → ${opts.to}`) : "") +
            chalk.dim(` PR: ${prUrl}`)
          );
        } catch {
          spinner.warn(
            chalk.yellow(`Scenario handed off but PR creation failed. Push manually.`)
          );
        }
      } else {
        spinner.succeed(
          chalk.green(`Handed off scenario: ${chalk.bold(name)}`) +
          (opts.to ? chalk.dim(` → ${opts.to}`) : "")
        );
      }
    } catch (err: unknown) {
      spinner.fail(chalk.red(formatCliError(err)));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// teardown — archive with confirmation
// ---------------------------------------------------------------------------

program
  .command("teardown")
  .description("Archive and clean up a scenario")
  .argument("<name>", "Scenario name")
  .option("-y, --yes", "Skip confirmation prompt")
  .addHelpText("after", `
Examples:
  $ devcontext teardown my-api
  $ devcontext teardown my-api -y     # skip confirmation
`)
  .action(async (name: string, opts: { yes?: boolean }) => {
    const spinner = ora();
    try {
      // Confirm unless --yes
      if (!opts.yes) {
        const { default: inquirer } = await import("inquirer");
        const { confirm } = await inquirer.prompt([{
          type: "confirm",
          name: "confirm",
          message: chalk.yellow(`Archive and tear down scenario "${name}"? This cannot be undone.`),
          default: false,
        }]);
        if (!confirm) {
          console.log(chalk.dim("Cancelled."));
          return;
        }
      }

      spinner.start(chalk.cyan(`Tearing down scenario ${chalk.bold(name)}…`));
      archiveScenario(name);
      spinner.succeed(chalk.green(`Archived scenario: ${chalk.bold(name)}`));
    } catch (err: unknown) {
      spinner.fail(chalk.red(formatCliError(err)));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// push — push scenario to GitHub
// ---------------------------------------------------------------------------

program
  .command("push")
  .description("Push a scenario to a remote GitHub repository")
  .argument("<name>", "Scenario name")
  .option("--repo <url>", "Repository URL (overrides scenario manifest)")
  .option("-b, --branch <branch>", "Branch name", "main")
  .addHelpText("after", `
Examples:
  $ devcontext push my-api
  $ devcontext push my-api --repo https://github.com/org/repo --branch dev
`)
  .action(async (name: string, opts: { repo?: string; branch: string }) => {
    const spinner = ora();
    try {
      spinner.start(chalk.cyan(`Pushing scenario ${chalk.bold(name)}…`));
      const scenario = getScenario(name);

      const repoUrl = opts.repo ?? scenario.repos?.[0]?.url;
      if (!repoUrl) {
        throw new Error("No repository URL — provide --repo or add a repo to the scenario manifest.");
      }

      const result = await pushScenario(name, repoUrl, opts.branch);
      if (!result.ok) {
        throw new Error(result.stderr);
      }

      spinner.succeed(chalk.green(`Pushed scenario: ${chalk.bold(name)} → ${chalk.dim(repoUrl)}`));
    } catch (err: unknown) {
      spinner.fail(chalk.red(formatCliError(err)));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// pull — pull scenario from GitHub
// ---------------------------------------------------------------------------

program
  .command("pull")
  .description("Pull a scenario from a remote GitHub repository")
  .argument("<name>", "Scenario name")
  .option("--repo <url>", "Repository URL (overrides scenario manifest)")
  .option("-b, --branch <branch>", "Branch name", "main")
  .addHelpText("after", `
Examples:
  $ devcontext pull my-api
  $ devcontext pull my-api --repo https://github.com/org/repo --branch dev
`)
  .action(async (name: string, opts: { repo?: string; branch: string }) => {
    const spinner = ora();
    try {
      spinner.start(chalk.cyan(`Pulling scenario ${chalk.bold(name)}…`));
      const scenario = getScenario(name);

      const repoUrl = opts.repo ?? scenario.repos?.[0]?.url;
      if (!repoUrl) {
        throw new Error("No repository URL — provide --repo or add a repo to the scenario manifest.");
      }

      const result = await pullScenario(name, repoUrl, opts.branch);
      if (!result.ok) {
        throw new Error(result.stderr);
      }

      spinner.succeed(chalk.green(`Pulled scenario: ${chalk.bold(name)} ← ${chalk.dim(repoUrl)}`));
    } catch (err: unknown) {
      spinner.fail(chalk.red(formatCliError(err)));
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// knowledge — search subcommand
// ---------------------------------------------------------------------------

const knowledgeCmd = new Command("knowledge")
  .description("Manage and search knowledge entities")
  .addHelpText("after", `
Examples:
  $ devcontext knowledge search "retry patterns"
  $ devcontext knowledge list
  $ devcontext knowledge get retry-patterns
  $ devcontext knowledge create --title "Retry Patterns" --type concept
  $ devcontext knowledge delete retry-patterns
`);

knowledgeCmd
  .command("search")
  .description("Search knowledge entities using full-text search")
  .argument("<query>", "Search query")
  .option("-l, --limit <n>", "Maximum results", "20")
  .action(async (query: string, opts: { limit: string }) => {
    const spinner = ora();
    try {
      spinner.start(chalk.cyan(`Searching for "${query}"…`));
      const limit = parseInt(opts.limit, 10) || 20;
      const results = searchEntities(query, limit);
      spinner.stop();

      if (results.length === 0) {
        console.log(chalk.dim("No results found."));
        return;
      }

      console.log(chalk.bold(`Found ${results.length} result(s):\n`));
      for (const r of results) {
        console.log(`  ${chalk.bold(chalk.cyan(r.title))} ${chalk.dim(`[${r.type}]`)}`);
        if (r.snippet) {
          console.log(`  ${chalk.dim(r.snippet)}`);
        }
        console.log();
      }
    } catch (err: unknown) {
      spinner.fail(chalk.red(formatCliError(err)));
      process.exit(1);
    }
  });

knowledgeCmd
  .command("list")
  .description("List all knowledge entities")
  .action(async () => {
    try {
      const entities = listEntities();
      if (entities.length === 0) {
        console.log(chalk.dim("No knowledge entities found."));
        return;
      }

      const nameWidth = Math.max(20, ...entities.map(e => e.title.length + 2));
      const typeWidth = 12;
      console.log(
        chalk.bold(
          "TITLE".padEnd(nameWidth) +
          "TYPE".padEnd(typeWidth) +
          "TAGS"
        )
      );
      console.log(chalk.dim("\u2500".repeat(nameWidth + typeWidth + 30)));

      for (const e of entities) {
        console.log(
          chalk.bold(e.title.padEnd(nameWidth)) +
          chalk.cyan(e.type.padEnd(typeWidth)) +
          chalk.dim((e.tags ?? []).join(", "))
        );
      }

      console.log(chalk.dim(`\n${entities.length} entity(s)`));
    } catch (err: unknown) {
      console.error(chalk.red(formatCliError(err)));
      process.exit(1);
    }
  });

knowledgeCmd
  .command("get")
  .description("Get a knowledge entity by slug")
  .argument("<slug>", "Entity slug (e.g. retry-patterns)")
  .action(async (slug: string) => {
    try {
      const entity = getEntity(slug);
      console.log(chalk.bold(chalk.cyan(entity.title)) + chalk.dim(` [${entity.type}]`));
      console.log(chalk.dim(`Updated: ${entity.updated}`));
      if (entity.tags?.length) {
        console.log(chalk.dim(`Tags: ${entity.tags.join(", ")}`));
      }
      if (entity.related?.length) {
        console.log(chalk.dim(`Related: ${entity.related.join(", ")}`));
      }
      console.log();
      console.log(entity.content ?? "");
    } catch (err: unknown) {
      console.error(chalk.red(formatCliError(err)));
      process.exit(1);
    }
  });

knowledgeCmd
  .command("create")
  .description("Create a new knowledge entity")
  .option("--title <title>", "Entity title (required)")
  .option("--type <type>", "Entity type: platform, system, repo, tool, concept, person, team", "concept")
  .option("--tags <tags...>", "Tags for categorization")
  .option("--content <text>", "Markdown content body")
  .action(async (opts: { title?: string; type?: string; tags?: string[]; content?: string }) => {
    const spinner = ora();
    try {
      if (!opts.title) {
        throw new Error("--title is required. Example: devcontext knowledge create --title \"Retry Patterns\" --type concept");
      }

      spinner.start(chalk.cyan(`Creating entity "${opts.title}"…`));
      const result = createEntity({
        title: opts.title,
        type: (opts.type ?? "concept") as KnowledgeEntityType,
        updated: new Date().toISOString().slice(0, 10),
        tags: opts.tags ?? [],
        related: [],
        content: opts.content ?? "",
      });
      spinner.succeed(chalk.green(`Created entity: ${chalk.bold(result.slug)}`));
    } catch (err: unknown) {
      spinner.fail(chalk.red(formatCliError(err)));
      process.exit(1);
    }
  });

knowledgeCmd
  .command("delete")
  .description("Delete a knowledge entity by slug")
  .argument("<slug>", "Entity slug")
  .action(async (slug: string) => {
    const spinner = ora();
    try {
      spinner.start(chalk.cyan(`Deleting entity "${slug}"…`));
      deleteEntity(slug);
      spinner.succeed(chalk.green(`Deleted entity: ${chalk.bold(slug)}`));
    } catch (err: unknown) {
      spinner.fail(chalk.red(formatCliError(err)));
      process.exit(1);
    }
  });

program.addCommand(knowledgeCmd);

// ---------------------------------------------------------------------------
// Export for testing
// ---------------------------------------------------------------------------

export { program };

// ---------------------------------------------------------------------------
// Run CLI when executed directly
// ---------------------------------------------------------------------------

// Run CLI when this file is the entry point.
// Bun sets import.meta.main = true when the file is directly executed.
const isMain =
  (import.meta as { main?: boolean }).main ||
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("cli/index.ts") ||
  process.argv[1]?.endsWith("cli\\index.ts");

if (isMain) {
  program.parse();
}
