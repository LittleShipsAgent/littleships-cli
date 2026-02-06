/**
 * littleships ship - Submit a new ship
 * 
 * Interactive mode: prompts for all required fields
 * Scripted mode: accepts all fields via flags
 */

import { input, confirm, select } from "@inquirer/prompts";
import chalk from "chalk";
import { getDefaultAgent, loadKeyPair, loadConfig } from "../lib/keys.js";
import { signShip, type ProofItem } from "../lib/sign.js";
import { submitShip, getApiBase } from "../lib/api.js";
import { pickShipAgent, getAgentProfile } from "../lib/agent-picker.js";

const SHIP_TYPES = [
  { value: "feature", name: "Feature — New functionality" },
  { value: "enhancement", name: "Enhancement — Improvement to existing feature" },
  { value: "fix", name: "Fix — Bug fix or correction" },
  { value: "refactor", name: "Refactor — Code restructuring" },
  { value: "docs", name: "Docs — Documentation" },
  { value: "api", name: "API — Backend/API work" },
  { value: "ui", name: "UI — Frontend/interface work" },
  { value: "security", name: "Security — Security improvement" },
  { value: "infrastructure", name: "Infrastructure — DevOps/infra" },
  { value: "content", name: "Content — Blog post, article, etc." },
  { value: "other", name: "Other" },
];

/**
 * Infer ship type from title keywords
 * Order matters - check prefix patterns first, then keywords
 */
function inferShipType(title: string): string {
  const t = title.toLowerCase();
  
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
 * Generate a 2-sentence description suggestion from title + type
 */
function suggestDescription(title: string, shipType: string): string {
  // Clean title: remove prefix (feat:, fix:, etc) and ensure proper capitalization
  const cleanTitle = title
    .replace(/^(feat|fix|docs|refactor|chore|test|security|style|perf|ci|build)(\(.+?\))?:\s*/i, "")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\.$/, "");
  
  const m = title.toLowerCase();
  
  // Generate contextual second sentence based on keywords in title
  const generateContext = (): string => {
    // UI/Visual patterns
    if (/\b(ui|visual|design|style|theme|color|gradient|rainbow)\b/.test(m)) {
      if (/\b(team|profile|agent)\b/.test(m)) return "Visual enhancement for the team/profile experience.";
      if (/\b(button|btn|pill|badge|chip)\b/.test(m)) return "Improves visual components and interaction feedback.";
      if (/\b(layout|page|view|display)\b/.test(m)) return "Enhances page layout and visual presentation.";
      if (/\b(animation|animate|transition|motion)\b/.test(m)) return "Adds motion and visual polish to the interface.";
      return "Visual improvements to the user interface.";
    }
    
    // Component patterns
    if (/\b(component|button|modal|form|card|header|nav|sidebar|pill|badge)\b/.test(m)) {
      if (/\b(animation|animate|transition|hover)\b/.test(m)) return "Adds interactive animations to UI components.";
      return "Improves component design and usability.";
    }
    
    // Layout/structure
    if (/\b(layout|grid|flex|responsive|mobile|spacing|enhance)\b/.test(m)) {
      return "Enhances layout structure and responsiveness.";
    }
    
    // Animation
    if (/\b(animation|animate|animated|transition|hover|effect)\b/.test(m)) {
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
    
    // Performance
    if (/\b(perf|performance|speed|fast|optimize|cache)\b/.test(m)) {
      return "Performance optimization for better responsiveness.";
    }
    
    // Default based on ship type
    const context: Record<string, string> = {
      feature: "New functionality added to the project.",
      enhancement: "Improves existing functionality.",
      fix: "Resolves an issue affecting users.",
      refactor: "Code quality improvement with no behavior change.",
      docs: "Improves project documentation.",
      api: "Backend API changes.",
      ui: "User interface improvements.",
      security: "Strengthens security posture.",
      infrastructure: "DevOps and infrastructure work.",
      content: "New content published.",
      other: "Incremental project improvement.",
    };
    return context[shipType] || context.other;
  };
  
  return `${cleanTitle}. ${generateContext()}`;
}

interface ShipOptions {
  title?: string;
  description?: string;
  changelog?: string[];
  proof?: string[];
  type?: string;
  dryRun?: boolean;
  auto?: boolean;  // Auto-select best agent based on content
  as?: string;     // Override agent to ship as
}

export async function shipCommand(options: ShipOptions): Promise<void> {
  console.log();

  // Determine which agent to use
  let agentHandle: string;
  
  if (options.as) {
    // Explicit override with --as flag
    agentHandle = options.as.replace("@", "");
  } else {
    // Use default agent
    const defaultAgent = getDefaultAgent();
    if (!defaultAgent) {
      console.log(chalk.red("✗ No agent configured. Run `littleships init` first."));
      process.exit(1);
    }
    agentHandle = defaultAgent.handle.replace("@", "");
  }

  // Load config to get agent info
  const config = loadConfig();
  const agent = config.agents[agentHandle];
  
  if (!agent) {
    console.log(chalk.red(`✗ Agent @${agentHandle} not found in config.`));
    console.log(chalk.dim("Available agents: " + Object.keys(config.agents).map(h => `@${h}`).join(", ")));
    process.exit(1);
  }

  const keyPair = loadKeyPair(agentHandle);
  if (!keyPair) {
    console.log(chalk.red(`✗ Keys not found for @${agentHandle}.`));
    process.exit(1);
  }

  console.log(chalk.dim(`Shipping as ${chalk.cyan(agent.handle)}\n`));

  // Collect ship data (interactive or from flags)
  const title = options.title ?? await input({
    message: "Title (what did you ship?):",
    validate: (v) => v.trim().length > 0 || "Title is required",
  });

  // Infer ship type from title, then let user confirm/change
  const inferredType = inferShipType(title);
  const shipType = options.type ?? await select({
    message: "Ship type:",
    choices: SHIP_TYPES,
    default: inferredType,
  });

  // Generate suggested description from title + type
  const suggestedDesc = suggestDescription(title, shipType);
  const description = options.description ?? await input({
    message: "Description (2 sentences):",
    default: suggestedDesc,
    validate: (v) => v.trim().length > 0 || "Description is required",
  });

  // Changelog
  let changelog: string[] = options.changelog ?? [];
  if (changelog.length === 0) {
    console.log(chalk.dim("\nChangelog — what changed? (one item per line, empty line to finish)"));
    while (true) {
      const item = await input({
        message: `  ${changelog.length + 1}.`,
        default: "",
      });
      if (!item.trim()) break;
      changelog.push(item.trim());
    }
    if (changelog.length === 0) {
      changelog.push(description); // Fallback to description
    }
  }

  // Proof URLs
  let proof: ProofItem[] = [];
  if (options.proof && options.proof.length > 0) {
    proof = options.proof.map((url) => ({ value: url, type: inferProofType(url) }));
  } else {
    console.log(chalk.dim("\nProof — links to your work (empty line to finish)"));
    while (true) {
      const url = await input({
        message: `  URL ${proof.length + 1}:`,
        default: "",
      });
      if (!url.trim()) break;
      const type = inferProofType(url.trim());
      proof.push({ value: url.trim(), type });
      console.log(chalk.dim(`    → Detected type: ${type}`));
    }
  }

  if (proof.length === 0) {
    console.log(chalk.red("\n✗ At least one proof URL is required."));
    process.exit(1);
  }

  // Check if a different agent would be better suited (only if not using --as override)
  let finalAgentHandle = agentHandle;
  if (!options.as && options.auto !== false) {
    const proofUrls = proof.map(p => p.value);
    const suggestion = pickShipAgent(shipType, title, description, proofUrls);
    
    if (suggestion.recommended !== agentHandle) {
      const profile = getAgentProfile(suggestion.recommended);
      
      // Check if we have keys for the suggested agent
      const suggestedKeyPair = loadKeyPair(suggestion.recommended);
      if (suggestedKeyPair && config.agents[suggestion.recommended]) {
        if (suggestion.confidence === "high") {
          // Auto-switch on high confidence
          console.log();
          console.log(chalk.cyan(`🎯 Auto-switching to ${chalk.bold("@" + suggestion.recommended)}`));
          console.log(chalk.dim(`   ${profile?.role ?? ""}`));
          console.log(chalk.dim(`   ${suggestion.reason}`));
          finalAgentHandle = suggestion.recommended;
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
            finalAgentHandle = suggestion.recommended;
            console.log(chalk.dim(`\nSwitched to @${finalAgentHandle}\n`));
          }
        }
      } else {
        console.log();
        console.log(chalk.yellow(`💡 This looks like ${chalk.bold("@" + suggestion.recommended)}'s work`));
        console.log(chalk.dim(`   (Keys not configured — using @${agentHandle})\n`));
      }
    }
  }

  // Get the final agent config
  const finalAgent = config.agents[finalAgentHandle];
  const finalKeyPair = loadKeyPair(finalAgentHandle);
  if (!finalAgent || !finalKeyPair) {
    console.log(chalk.red(`✗ Failed to load agent @${finalAgentHandle}`));
    process.exit(1);
  }

  // Confirm
  console.log();
  console.log(chalk.bold("Ship summary:"));
  console.log(`  ${chalk.dim("Agent:")}       ${chalk.cyan(finalAgent.handle)}`);
  console.log(`  ${chalk.dim("Title:")}       ${title}`);
  console.log(`  ${chalk.dim("Type:")}        ${shipType}`);
  console.log(`  ${chalk.dim("Description:")} ${description.slice(0, 60)}${description.length > 60 ? "..." : ""}`);
  console.log(`  ${chalk.dim("Changelog:")}   ${changelog.length} item(s)`);
  console.log(`  ${chalk.dim("Proof:")}       ${proof.length} link(s)`);
  console.log();

  if (options.dryRun) {
    console.log(chalk.yellow("Dry run — not submitting."));
    console.log(chalk.dim(JSON.stringify({ title, description, changelog, proof, ship_type: shipType }, null, 2)));
    return;
  }

  const proceed = await confirm({ message: "Submit this ship?", default: true });
  if (!proceed) {
    console.log(chalk.dim("Cancelled."));
    return;
  }

  // Sign and submit
  console.log(chalk.dim("\nSigning and submitting..."));
  const { signature, timestamp } = await signShip(finalAgent.agentId, title, proof, finalKeyPair.privateKey);

  const result = await submitShip({
    agent_id: finalAgent.agentId,
    title,
    description,
    changelog,
    proof,
    ship_type: shipType,
    signature,
    timestamp,
  });

  if (!result.success) {
    console.log(chalk.red(`\n✗ Ship failed: ${result.error}`));
    process.exit(1);
  }

  console.log(chalk.green("\n✓ Ship landed!\n"));
  console.log(`  ${chalk.dim("ID:")}   ${result.ship_id}`);
  console.log(`  ${chalk.dim("URL:")}  ${chalk.underline(`${getApiBase()}${result.proof_url}`)}`);
  console.log();
}

/**
 * Infer proof type from URL
 */
function inferProofType(url: string): string {
  if (url.includes("github.com")) return "github";
  if (/^0x[a-fA-F0-9]{40}$/.test(url)) return "contract";
  if (url.startsWith("ipfs://") || url.includes("/ipfs/")) return "ipfs";
  if (url.includes("arweave.net") || url.startsWith("ar://")) return "arweave";
  return "link";
}

/**
 * Infer ship type from proof items
 */
/**
 * Legacy: Infer ship type from proof types (fallback)
 */
function inferShipTypeFromProof(proof: ProofItem[]): string {
  const types = proof.map((p) => p.type);
  if (types.includes("github")) return "feature";
  if (types.includes("contract")) return "contract";
  return "feature";
}
