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
 * Generate a 2-sentence description suggestion from title + type
 */
function suggestDescription(title: string, shipType: string): string {
  // Clean title: remove prefix (feat:, fix:, etc) and ensure proper capitalization
  const cleanTitle = title
    .replace(/^(feat|fix|docs|refactor|chore|test|security|style|perf|ci|build)(\(.+?\))?:\s*/i, "")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\.$/, "");
  
  // Add contextual second sentence based on ship type
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
  
  return `${cleanTitle}. ${context[shipType] || context.other}`;
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

  // Ask for ship type early so we can suggest a description
  const shipType = options.type ?? await select({
    message: "Ship type:",
    choices: SHIP_TYPES,
    default: "feature",
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
function inferShipType(proof: ProofItem[]): string {
  const types = proof.map((p) => p.type);
  if (types.includes("github")) return "feature";
  if (types.includes("contract")) return "contract";
  return "feature";
}
