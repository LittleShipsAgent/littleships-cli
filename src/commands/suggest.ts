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
  message: string; // Subject line
  body: string; // Full body (may contain bullet points)
  date: string;
}

function looksLikeGibberishSubject(s: string): boolean {
  const t = (s || "").trim();
  if (!t) return true;
  // Long single-token strings are usually junk (hashes, random ids)
  const oneToken = !t.includes(" ") && !t.includes(":") && !t.includes("/") && !t.includes("-");
  const alphaNum = (t.match(/[a-z0-9]/gi) || []).length;
  const letters = (t.match(/[a-z]/gi) || []).length;
  if (oneToken && t.length >= 16) return true;
  // Too few letters relative to length (e.g. mostly digits)
  if (t.length >= 12 && letters / Math.max(1, alphaNum) < 0.25) return true;
  return false;
}

function firstMeaningfulLine(body: string): string {
  const lines = (body || "").split("\n");
  for (const ln of lines) {
    const t = ln.trim();
    if (!t) continue;
    // skip bullet prefixes when using as title
    return t.replace(/^[-*•]\s+/, "").slice(0, 120);
  }
  return "";
}

function getRecentCommits(count?: number, days?: number): GitCommit[] {
  try {
    // Robust parsing: record separator (\x1e) between commits, unit separator (\x1f) between fields.
    // Format: hash<US>subject<US>body<US>date<RS>
    let cmd = `git log --format="%H%x1f%s%x1f%b%x1f%ai%x1e"`;

    if (count) {
      cmd += ` -n ${Math.max(1, Math.min(50, count))}`;
    } else if (days) {
      const safeDays = Math.max(1, Math.min(365, Math.floor(days) || 7));
      cmd += ` --since="${safeDays} days ago"`;
    } else {
      cmd += ` --since="7 days ago"`;
    }

    const output = execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    return output
      .split("\x1e")
      .map((rec) => rec.trim())
      .filter(Boolean)
      .map((rec) => {
        const parts = rec.split("\x1f");
        return {
          hash: (parts[0] || "").trim(),
          message: (parts[1] || "").trim(),
          body: (parts[2] || "").trim(),
          date: (parts[3] || "").trim(),
        };
      })
      .filter((c) => /^[a-f0-9]{7,40}$/i.test(c.hash));
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
    const bodyItems = extractChangelogFromBody(commit.body);

    if (bodyItems.length > 0) {
      changelog.push(...bodyItems);
      continue;
    }

    // Fall back to subject — but use body line if subject is junk
    const subj = commit.message || "";
    const fallback = firstMeaningfulLine(commit.body);
    const base = looksLikeGibberishSubject(subj) && fallback ? fallback : subj;

    const cleaned = base
      .replace(/^(feat|fix|docs|refactor|chore|test|security|style|perf|ci|build)(\(.+?\))?:\s*/i, "")
      .replace(/^./, (c) => c.toUpperCase())
      .slice(0, 140);

    if (cleaned.trim()) changelog.push(cleaned);
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
  const t = message.toLowerCase();
  
  // Check conventional commit prefixes FIRST
  if (t.startsWith("fix:") || t.startsWith("fix(")) return "fix";
  if (t.startsWith("docs:") || t.startsWith("doc:")) return "docs";
  if (t.startsWith("refactor:") || t.startsWith("refactor(")) return "refactor";
  if (t.startsWith("security:") || t.startsWith("sec:")) return "security";
  if (t.startsWith("ui:") || t.startsWith("style:")) return "ui";
  
  // Security patterns (high priority)
  if (/\b(security|auth|permission|sanitize|validate|injection|xss|csrf|encrypt|token|password|credential|vulnerability|hardening)\b/.test(t)) {
    return "security";
  }
  
  // Fix patterns
  if (/\b(fix|bug|issue|error|broken|resolve|patch|hotfix|repair)\b/.test(t)) {
    return "fix";
  }
  
  // Docs patterns
  if (/\b(doc|docs|documentation|readme|guide|tutorial|jsdoc)\b/.test(t)) {
    return "docs";
  }
  
  // Refactor patterns
  if (/\b(refactor|restructure|reorganize|cleanup|clean up|simplify|dedupe|extract)\b/.test(t)) {
    return "refactor";
  }
  
  // API patterns
  if (/\b(api|endpoint|route|handler|backend|server|database|query|migration)\b/.test(t)) {
    return "api";
  }
  
  // Infrastructure patterns
  if (/\b(ci|cd|pipeline|docker|kubernetes|deploy|infrastructure|devops|terraform|ansible)\b/.test(t)) {
    return "infrastructure";
  }
  
  // UI patterns (visual/design keywords)
  if (/\b(ui|frontend|button|modal|card|layout|animation|style|css|tailwind|design|theme|color|gradient|responsive|icon|avatar|header|footer|nav|sidebar|menu|visual|ux|pill|badge)\b/.test(t)) {
    return "ui";
  }
  
  // Enhancement patterns
  if (/\b(enhance|improvement|improve|upgrade|optimize|better|polish)\b/.test(t)) {
    return "enhancement";
  }
  
  // Content patterns
  if (/\b(blog|article|post|content|write|publish|announce)\b/.test(t)) {
    return "content";
  }
  
  // Default to feature
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
  
  // Fetch already-shipped commit hashes (across all configured agents)
  console.log(chalk.dim("Checking for already-shipped commits..."));
  const cfg = loadConfig();
  const shippedHashes = new Set<string>();
  for (const a of Object.values(cfg.agents || {})) {
    const hs = await getShippedCommitHashes(a.handle || a.agentId);
    hs.forEach((h) => shippedHashes.add(h));
  }
  
  console.log(chalk.cyan(`\n🔍 Found ${commits.length} commits in ${chalk.white(repoUrl)}\n`));
  
  // Show commits and let user select (mark shipped ones)
  const selected = await checkbox({
    message: "Select commits to include in this ship:",
    choices: commits.map((c, i) => {
      const hashShort = c.hash.slice(0, 7);
      const isShipped = shippedHashes.has(c.hash.toLowerCase()) || shippedHashes.has(hashShort.toLowerCase());
      const shippedTag = isShipped ? chalk.yellow(" (shipped)") : "";

      const fallback = firstMeaningfulLine(c.body);
      const displayMsg = looksLikeGibberishSubject(c.message) && fallback ? fallback : c.message;

      return {
        value: c,
        name: `${chalk.dim(hashShort)} ${displayMsg.slice(0, 55)}${shippedTag}`,
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
