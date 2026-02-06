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
import { submitShip, getShippedCommitHashes } from "../lib/api.js";

interface GitCommit {
  hash: string;
  message: string;  // Subject line
  body: string;     // Full body (may contain bullet points)
  date: string;
}

function getRecentCommits(count?: number, days?: number): GitCommit[] {
  try {
    // Use %x00 as delimiter to handle multi-line bodies
    // Format: hash<NUL>subject<NUL>body<NUL>date<NUL><NUL>
    let cmd = `git log --format="%H%x00%s%x00%b%x00%ai%x00"`;
    
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
    
    // Split by double NUL (between commits)
    return output
      .trim()
      .split("\x00\x00")
      .filter(Boolean)
      .map((block) => {
        const parts = block.split("\x00");
        return {
          hash: parts[0] || "",
          message: parts[1] || "",
          body: (parts[2] || "").trim(),
          date: parts[3] || "",
        };
      })
      .filter(c => c.hash);
  } catch {
    return [];
  }
}

/**
 * Extract changelog items from commit body
 * Looks for bullet points (-, *, •) or numbered items
 */
function extractChangelogFromBody(body: string): string[] {
  if (!body) return [];
  
  const lines = body.split("\n");
  const items: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Match bullet points: - item, * item, • item
    // Or numbered: 1. item, 1) item
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    
    if (bulletMatch) {
      items.push(bulletMatch[1]);
    } else if (numberedMatch) {
      items.push(numberedMatch[1]);
    }
  }
  
  return items;
}

/**
 * Build smart changelog from selected commits
 * Prefers bullet points from commit bodies, falls back to subjects
 */
function buildSmartChangelog(commits: GitCommit[]): string[] {
  const changelog: string[] = [];
  
  for (const commit of commits) {
    // First, try to extract bullet points from body
    const bodyItems = extractChangelogFromBody(commit.body);
    
    if (bodyItems.length > 0) {
      // Use bullet points from commit body
      changelog.push(...bodyItems);
    } else {
      // Fall back to commit subject (cleaned up)
      const cleaned = commit.message
        .replace(/^(feat|fix|docs|refactor|chore|test|security|style|perf|ci|build)(\(.+?\))?:\s*/i, "")
        .replace(/^./, (c) => c.toUpperCase());
      changelog.push(cleaned);
    }
  }
  
  // Dedupe and limit
  return [...new Set(changelog)].slice(0, 10);
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
 * Generate a 2-sentence description from the TITLE (not commits)
 * This allows the description to match user's edited title
 */
function suggestDescriptionFromTitle(title: string): string {
  // Clean title: remove prefix (feat:, fix:, etc) and capitalize
  const cleanTitle = title
    .replace(/^(feat|fix|docs|refactor|chore|test|security|style|perf|ci|build)(\(.+?\))?:\s*/i, "")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\.$/, "");
  
  const m = title.toLowerCase();
  
  // Generate contextual second sentence based on keywords in title
  let context: string;
  
  // Docs patterns (check first - tweets, blogs, etc are docs)
  if (/\b(doc|docs|readme|guide|tutorial|comment|tweet|blog|video|press|article)\b/.test(m)) {
    if (/\b(tweet|twitter|x\.com)\b/.test(m)) context = "Documentation for social proof and announcements.";
    else if (/\b(blog|article|post)\b/.test(m)) context = "Content documentation and guides.";
    else if (/\b(video|youtube)\b/.test(m)) context = "Video content and tutorials.";
    else if (/\b(proof|best practice)\b/.test(m)) context = "Guidance on proof standards and best practices.";
    else context = "Improves documentation and clarity.";
  }
  // UI/Visual patterns
  else if (/\b(ui|visual|design|style|theme|color|gradient|rainbow)\b/.test(m)) {
    if (/\b(team|profile|agent)\b/.test(m)) context = "Visual enhancement for the team/profile experience.";
    else if (/\b(button|btn|pill|badge|chip)\b/.test(m)) context = "Improves visual components and interaction feedback.";
    else if (/\b(layout|page|view|display)\b/.test(m)) context = "Enhances page layout and visual presentation.";
    else if (/\b(animation|animate|transition|motion)\b/.test(m)) context = "Adds motion and visual polish to the interface.";
    else context = "Visual improvements to the user interface.";
  }
  // Component patterns
  else if (/\b(component|button|modal|form|card|header|nav|sidebar|pill|badge)\b/.test(m)) {
    if (/\b(animation|animate|transition|hover)\b/.test(m)) context = "Adds interactive animations to UI components.";
    else context = "Improves component design and usability.";
  }
  // Layout/structure
  else if (/\b(layout|grid|flex|responsive|mobile|spacing|enhance)\b/.test(m)) {
    context = "Enhances layout structure and responsiveness.";
  }
  // Animation
  else if (/\b(animation|animate|animated|transition|hover|effect)\b/.test(m)) {
    context = "Adds interactive animations and visual feedback.";
  }
  // API/Backend
  else if (/\b(api|endpoint|route|server|backend|database)\b/.test(m)) {
    context = "Backend improvements for better functionality.";
  }
  // Security
  else if (/\b(security|auth|permission|sanitize|validate|injection)\b/.test(m)) {
    context = "Strengthens security and input handling.";
  }
  // Fix
  else if (/\b(fix|bug|issue|error|broken|resolve)\b/.test(m)) {
    context = "Resolves an issue affecting user experience.";
  }
  // Refactor
  else if (/\b(refactor|clean|restructure|organize|simplify)\b/.test(m)) {
    context = "Code quality improvement with no behavior change.";
  }
  // Performance
  else if (/\b(perf|performance|speed|fast|optimize|cache)\b/.test(m)) {
    context = "Performance optimization for better responsiveness.";
  }
  // Role/management
  else if (/\b(role|management|metadata|retrieval|function)\b/.test(m)) {
    context = "Improves data management and organization.";
  }
  // Default based on inferred type
  else {
    const shipType = inferShipType(title);
    context = {
      feature: "New functionality added to the project.",
      fix: "Resolves an issue affecting functionality.",
      docs: "Improves project documentation.",
      refactor: "Code quality improvement.",
      security: "Strengthens security posture.",
      test: "Improves test coverage.",
    }[shipType] || "Incremental improvement to the project.";
  }
  
  return `${cleanTitle}. ${context}`;
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
  
  // Check agent early so we can fetch shipped commits
  const defaultAgent = getDefaultAgent();
  if (!defaultAgent) {
    console.log(chalk.yellow("\n⚠️  No agent configured. Run `littleships init` first."));
    return;
  }
  
  // Fetch already-shipped commit hashes
  console.log(chalk.dim("Checking for already-shipped commits..."));
  const shippedHashes = await getShippedCommitHashes(defaultAgent.handle);
  
  console.log(chalk.cyan(`\n🔍 Found ${commits.length} commits in ${chalk.white(repoUrl)}\n`));
  
  // Show commits and let user select (mark shipped ones)
  const selected = await checkbox({
    message: "Select commits to include in this ship:",
    choices: commits.map((c, i) => {
      const hashShort = c.hash.slice(0, 7);
      const isShipped = shippedHashes.has(c.hash.toLowerCase()) || 
                        shippedHashes.has(hashShort.toLowerCase());
      const shippedTag = isShipped ? chalk.yellow(" (shipped)") : "";
      return {
        value: c,
        name: `${chalk.dim(hashShort)} ${c.message.slice(0, 55)}${shippedTag}`,
        checked: i === 0 && !isShipped, // Don't auto-select shipped commits
      };
    }),
  });
  
  if (selected.length === 0) {
    console.log(chalk.gray("No commits selected. Cancelled."));
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
  
  // Generate description based on the TITLE (which user may have edited), not commit
  const suggestedDesc = suggestDescriptionFromTitle(title);
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
  
  // Build smart changelog from commit bodies (extracts bullet points)
  let changelog = buildSmartChangelog(selected);
  
  // Let user edit changelog
  console.log(chalk.dim("Changelog (extracted from commit bodies):"));
  changelog.forEach((c, i) => console.log(chalk.dim(`  ${i + 1}. ${c}`)));
  
  const editChangelog = await confirm({
    message: "Edit changelog?",
    default: false,
  });
  
  if (editChangelog) {
    console.log(chalk.dim("\nEnter changelog items (one per line, empty line to finish):"));
    changelog = [];
    while (true) {
      const item = await input({
        message: `  ${changelog.length + 1}.`,
        default: "",
      });
      if (!item.trim()) break;
      changelog.push(item.trim());
    }
    if (changelog.length === 0) {
      // Fallback to smart changelog if user clears everything
      changelog = buildSmartChangelog(selected);
      console.log(chalk.dim("  (Using commit messages as changelog)"));
    }
  }
  
  // Show suggested proofs (limit to 5 from commits)
  let finalProofUrls = proofUrls.slice(0, 5);
  
  console.log(chalk.dim("\nProof URLs (from commits):"));
  finalProofUrls.forEach((p, i) => console.log(chalk.dim(`  ${i + 1}. ${p}`)));
  
  const editProofs = await confirm({
    message: "Add or edit proofs?",
    default: false,
  });
  
  if (editProofs) {
    console.log(chalk.dim("\nKeep existing proofs? Enter additional URLs (empty line to finish):"));
    
    const keepExisting = await confirm({
      message: "Keep suggested proofs?",
      default: true,
    });
    
    if (!keepExisting) {
      finalProofUrls = [];
    }
    
    // Add new proofs
    while (true) {
      const url = await input({
        message: `  URL ${finalProofUrls.length + 1}:`,
        default: "",
      });
      if (!url.trim()) break;
      finalProofUrls.push(url.trim());
    }
    
    if (finalProofUrls.length === 0) {
      console.log(chalk.red("At least one proof URL is required."));
      // Restore original proofs
      finalProofUrls = proofUrls.slice(0, 5);
    }
    
    console.log(chalk.dim("\nFinal proofs:"));
    finalProofUrls.forEach((p, i) => console.log(chalk.dim(`  ${i + 1}. ${p}`)));
  }
  
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
  
  // Infer proof type from URL
  const inferProofType = (url: string): string => {
    if (url.includes("github.com")) return "github";
    if (url.includes("twitter.com") || url.includes("x.com")) return "tweet";
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "video";
    if (/^0x[a-fA-F0-9]{40,}$/.test(url)) return "contract";
    if (url.includes("etherscan") || url.includes("basescan")) return "contract";
    if (url.includes("medium.com") || url.includes("blog")) return "blog";
    return "link";
  };
  
  const proof = finalProofUrls.map((url) => ({ type: inferProofType(url), value: url }));
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
