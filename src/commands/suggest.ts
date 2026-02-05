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
  const msgLower = commits[0].message.toLowerCase();
  
  // Generate contextual second sentence based on keywords
  const generateContext = (msg: string): string => {
    const m = msg.toLowerCase();
    
    // UI/Visual patterns
    if (/\b(ui|visual|design|style|theme|color|gradient|rainbow)\b/.test(m)) {
      if (/\b(team|profile|agent)\b/.test(m)) return "Visual enhancement for the team/profile experience.";
      if (/\b(button|btn|pill|badge|chip)\b/.test(m)) return "Improves visual components and interaction feedback.";
      if (/\b(layout|page|view|display)\b/.test(m)) return "Enhances page layout and visual presentation.";
      if (/\b(animation|animate|transition|motion)\b/.test(m)) return "Adds motion and visual polish to the interface.";
      return "Visual improvements to the user interface.";
    }
    
    // Component patterns
    if (/\b(component|button|modal|form|card|header|nav|sidebar)\b/.test(m)) {
      return "Improves component design and usability.";
    }
    
    // Layout/structure
    if (/\b(layout|grid|flex|responsive|mobile|spacing)\b/.test(m)) {
      return "Enhances layout structure and responsiveness.";
    }
    
    // Animation
    if (/\b(animation|animate|transition|hover|effect)\b/.test(m)) {
      return "Adds interactive animations and visual feedback.";
    }
    
    // API/Backend
    if (/\b(api|endpoint|route|server|backend|database)\b/.test(m)) {
      return "Backend improvements for better functionality.";
    }
    
    // Security
    if (/\b(security|auth|permission|sanitize|validate|injection)\b/.test(m)) {
      return "Strengthens security and input handling.";
    }
    
    // Docs
    if (/\b(doc|readme|guide|tutorial|comment)\b/.test(m)) {
      return "Improves documentation and clarity.";
    }
    
    // Fix
    if (/\b(fix|bug|issue|error|broken|resolve)\b/.test(m)) {
      return "Resolves an issue affecting user experience.";
    }
    
    // Refactor
    if (/\b(refactor|clean|restructure|organize|simplify)\b/.test(m)) {
      return "Code quality improvement with no behavior change.";
    }
    
    // Performance
    if (/\b(perf|performance|speed|fast|optimize|cache)\b/.test(m)) {
      return "Performance optimization for better responsiveness.";
    }
    
    // Default based on ship type
    const shipType = inferShipType(msg);
    return {
      feature: "New functionality added to the project.",
      fix: "Resolves an issue affecting functionality.",
      docs: "Improves project documentation.",
      refactor: "Code quality improvement.",
      security: "Strengthens security posture.",
      test: "Improves test coverage.",
    }[shipType] || "Incremental improvement to the project.";
  };
  
  if (commits.length === 1) {
    const context = generateContext(commits[0].message);
    return `${firstCommit.replace(/\.$/, "")}. ${context}`;
  }
  
  // Multiple commits: summarize scope + use context from first
  const context = generateContext(commits[0].message);
  return `${firstCommit.replace(/\.$/, "")}. ${context} Includes ${commits.length} related changes.`;
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
