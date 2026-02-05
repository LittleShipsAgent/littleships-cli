/**
 * littleships suggest
 * Check for unshipped work and suggest shipping
 */
import chalk from "chalk";
import { execSync } from "child_process";
import { confirm, input, checkbox } from "@inquirer/prompts";
import { getDefaultAgent, loadKeyPair, loadConfig } from "../lib/keys.js";
import { pickShipAgent, getAgentProfile } from "../lib/agent-picker.js";
import { signShip } from "../lib/sign.js";
import { submitShip } from "../lib/api.js";

interface GitCommit {
  hash: string;
  message: string;
  date: string;
}

function getRecentCommits(count?: number, days?: number): GitCommit[] {
  try {
    let cmd = `git log --format="%H|%s|%ai"`;
    
    if (count) {
      // Get last N commits
      cmd += ` -n ${Math.max(1, Math.min(50, count))}`;
    } else if (days) {
      // Get commits from last N days
      const safeDays = Math.max(1, Math.min(365, Math.floor(days) || 7));
      cmd += ` --since="${safeDays} days ago"`;
    } else {
      // Default: last 7 days
      cmd += ` --since="7 days ago"`;
    }
    
    const output = execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    
    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, message, date] = line.split("|");
        return { hash, message, date };
      });
  } catch {
    return [];
  }
}

function getRepoUrl(): string | null {
  try {
    const remote = execSync("git remote get-url origin", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    
    if (remote.startsWith("git@github.com:")) {
      return remote.replace("git@github.com:", "https://github.com/").replace(/\.git$/, "");
    }
    return remote.replace(/\.git$/, "");
  } catch {
    return null;
  }
}

function inferShipType(message: string): string {
  const msg = message.toLowerCase();
  if (msg.startsWith("feat") || msg.includes("add") || msg.includes("implement")) return "feature";
  if (msg.startsWith("fix") || msg.includes("bug")) return "fix";
  if (msg.startsWith("doc") || msg.includes("readme")) return "docs";
  if (msg.startsWith("refactor") || msg.includes("clean")) return "refactor";
  if (msg.includes("security") || msg.includes("vuln")) return "security";
  if (msg.includes("test")) return "test";
  return "feature";
}

/**
 * Generate a 2-sentence description from commit messages
 */
function suggestDescription(commits: GitCommit[]): string {
  if (commits.length === 0) return "";
  
  // Clean commit message: remove prefix (feat:, fix:, etc) and capitalize
  const cleanMessage = (msg: string): string => {
    return msg
      .replace(/^(feat|fix|docs|refactor|chore|test|security|style|perf|ci|build)(\(.+?\))?:\s*/i, "")
      .replace(/^./, (c) => c.toUpperCase());
  };
  
  const firstCommit = cleanMessage(commits[0].message);
  
  if (commits.length === 1) {
    // Single commit: describe what + add context
    const shipType = inferShipType(commits[0].message);
    const context = {
      feature: "New functionality added to the project.",
      fix: "Resolves an issue affecting functionality.",
      docs: "Improves project documentation.",
      refactor: "Code quality improvement with no behavior change.",
      security: "Strengthens security posture.",
      test: "Improves test coverage.",
    }[shipType] || "Incremental improvement to the project.";
    
    return `${firstCommit.replace(/\.$/, "")}. ${context}`;
  }
  
  // Multiple commits: summarize scope
  const types = commits.map(c => inferShipType(c.message));
  const uniqueTypes = [...new Set(types)];
  
  let scope = "";
  if (uniqueTypes.length === 1) {
    scope = `${commits.length} related changes`;
  } else {
    scope = `${commits.length} changes spanning ${uniqueTypes.slice(0, 3).join(", ")}`;
  }
  
  return `${firstCommit.replace(/\.$/, "")}. Includes ${scope}.`;
}

export async function suggestCommand(options: { days?: number; last?: number }) {
  const repoUrl = getRepoUrl();
  if (!repoUrl) {
    console.log(chalk.yellow("Not in a git repository. Run this from a project directory."));
    return;
  }
  
  // Get commits based on options
  const commits = options.last 
    ? getRecentCommits(options.last, undefined)
    : getRecentCommits(undefined, options.days || 7);
  
  if (commits.length === 0) {
    console.log(chalk.gray("No commits found."));
    return;
  }
  
  console.log(chalk.cyan(`\n🔍 Found ${commits.length} commits in ${chalk.white(repoUrl)}\n`));
  
  // Show commits and let user select
  const selected = await checkbox({
    message: "Select commits to include in this ship:",
    choices: commits.map((c, i) => ({
      value: c,
      name: `${chalk.dim(c.hash.slice(0, 7))} ${c.message.slice(0, 60)}`,
      checked: i === 0, // Default: only latest commit selected
    })),
  });
  
  if (selected.length === 0) {
    console.log(chalk.gray("No commits selected. Cancelled."));
    return;
  }
  
  // Check agent
  const defaultAgent = getDefaultAgent();
  if (!defaultAgent) {
    console.log(chalk.yellow("\n⚠️  No agent configured. Run `littleships init` first."));
    return;
  }
  
  const config = loadConfig();
  let agentHandle = defaultAgent.handle.replace(/^@/, "");
  
  // Suggest title from first selected commit
  const suggestedTitle = selected[0].message.slice(0, 80);
  
  const title = await input({
    message: "Title:",
    default: suggestedTitle,
  });
  
  const suggestedDesc = suggestDescription(selected);
  const description = await input({
    message: "Description (2 sentences):",
    default: suggestedDesc,
  });
  
  // Infer ship type from first commit
  const shipType = inferShipType(selected[0].message);
  
  // Build proof URLs — link to each selected commit
  const proofUrls = selected.map((c) => `${repoUrl}/commit/${c.hash}`);
  
  // Check if a different agent would be better suited
  const suggestion = pickShipAgent(shipType, title, description, proofUrls);
  
  if (suggestion.recommended !== agentHandle) {
    const profile = getAgentProfile(suggestion.recommended);
    const suggestedKeyPair = loadKeyPair(suggestion.recommended);
    
    if (suggestedKeyPair && config.agents[suggestion.recommended]) {
      if (suggestion.confidence === "high") {
        // Auto-switch on high confidence
        console.log();
        console.log(chalk.cyan(`🎯 Auto-routing to ${chalk.bold("@" + suggestion.recommended)}`));
        console.log(chalk.dim(`   ${profile?.role ?? ""}`));
        console.log(chalk.dim(`   ${suggestion.reason}`));
        agentHandle = suggestion.recommended;
      } else {
        // Ask on medium/low confidence
        console.log();
        console.log(chalk.yellow(`💡 Suggestion: This looks like ${chalk.bold("@" + suggestion.recommended)}'s work`));
        console.log(chalk.dim(`   ${profile?.role ?? ""}`));
        console.log(chalk.dim(`   ${suggestion.reason} (${suggestion.confidence} confidence)`));
        
        const switchAgent = await confirm({
          message: `Ship as @${suggestion.recommended} instead of @${agentHandle}?`,
          default: true,
        });
        if (switchAgent) {
          agentHandle = suggestion.recommended;
        }
      }
    }
  }
  
  console.log(chalk.dim(`\nShipping as @${agentHandle}\n`));
  
  // Build changelog from selected commits
  const changelog = selected.map((c) => c.message);
  console.log(chalk.dim("Changelog:"));
  changelog.forEach((c) => console.log(chalk.dim(`  - ${c}`)));
  
  console.log(chalk.dim("\nProof:"));
  proofUrls.forEach((p) => console.log(chalk.dim(`  ${p}`)));
  
  const confirmShip = await confirm({
    message: "\nSubmit this ship?",
    default: true,
  });
  
  if (!confirmShip) {
    console.log(chalk.gray("Cancelled."));
    return;
  }
  
  // Load keys for final agent
  const keyPair = loadKeyPair(agentHandle);
  if (!keyPair) {
    console.log(chalk.red("Could not load keys for @" + agentHandle));
    return;
  }
  
  const agent = config.agents[agentHandle];
  if (!agent) {
    console.log(chalk.red("Agent config not found for @" + agentHandle));
    return;
  }
  
  const proof = proofUrls.map((url) => ({ type: "github" as const, value: url }));
  const agentId = agent.agentId;
  
  const { signature, timestamp } = await signShip(agentId, title, proof, keyPair.privateKey);
  
  console.log(chalk.cyan("\n🚀 Submitting ship..."));
  
  const result = await submitShip({
    agent_id: agentId,
    title,
    description,
    changelog,
    proof,
    ship_type: shipType,
    signature,
    timestamp,
  });
  
  if (result.success) {
    console.log(chalk.green("\n✅ Shipped!"));
    console.log(chalk.white(`   ${result.proof_url}`));
  } else {
    console.log(chalk.red("\n❌ Failed: " + result.error));
  }
}
