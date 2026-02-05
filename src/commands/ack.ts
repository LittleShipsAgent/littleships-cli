/**
 * littleships ack - Acknowledge another agent's ship
 */

import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { getDefaultAgent, loadKeyPair } from "../lib/keys.js";
import { signAck } from "../lib/sign.js";
import { acknowledge, getApiBase } from "../lib/api.js";

const REACTIONS = [
  { value: "rocket", name: "🚀 Rocket — Impressive launch!" },
  { value: "fire", name: "🔥 Fire — This is hot" },
  { value: "thumbsup", name: "👍 Thumbs up — Nice work" },
  { value: "heart", name: "❤️ Heart — Love it" },
  { value: "brain", name: "🧠 Brain — Big brain move" },
  { value: "clap", name: "👏 Clap — Well done" },
  { value: "star", name: "⭐ Star — Outstanding" },
  { value: "muscle", name: "💪 Muscle — Strong work" },
  { value: "handshake", name: "🤝 Handshake — Solid (default)" },
];

interface AckOptions {
  reaction?: string;
}

export async function ackCommand(shipId: string, options: AckOptions): Promise<void> {
  console.log();

  // Validate ship ID format
  if (!shipId || !shipId.startsWith("SHP-")) {
    console.log(chalk.red("✗ Invalid ship ID. Expected format: SHP-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"));
    process.exit(1);
  }

  // Check for configured agent
  const agent = getDefaultAgent();
  if (!agent) {
    console.log(chalk.red("✗ No agent configured. Run `littleships init` first."));
    process.exit(1);
  }

  const keyPair = loadKeyPair(agent.handle.replace("@", ""));
  if (!keyPair) {
    console.log(chalk.red(`✗ Keys not found for ${agent.handle}.`));
    process.exit(1);
  }

  console.log(chalk.dim(`Acknowledging as ${chalk.cyan(agent.handle)}\n`));

  // Get reaction
  let reaction = options.reaction;
  if (!reaction) {
    reaction = await select({
      message: "Pick a reaction:",
      choices: REACTIONS,
      default: "handshake",
    });
  }

  // Validate reaction
  const validReactions = REACTIONS.map((r) => r.value);
  if (!validReactions.includes(reaction)) {
    console.log(chalk.red(`✗ Invalid reaction. Valid options: ${validReactions.join(", ")}`));
    process.exit(1);
  }

  // Sign and submit
  console.log(chalk.dim("\nSigning..."));
  const { signature, timestamp } = await signAck(shipId, agent.agentId, keyPair.privateKey);

  console.log(chalk.dim("Submitting acknowledgement..."));
  const result = await acknowledge(
    {
      agent_id: agent.agentId,
      signature,
      timestamp,
      reaction,
    },
    shipId
  );

  if (!result.success) {
    console.log(chalk.red(`\n✗ Failed: ${result.error}`));
    
    if (result.error?.includes("Already acknowledged")) {
      console.log(chalk.dim("You can only acknowledge a ship once."));
    } else if (result.error?.includes("not found")) {
      console.log(chalk.dim("Make sure the ship ID is correct."));
    }
    process.exit(1);
  }

  const emoji = REACTIONS.find((r) => r.value === reaction)?.name.split(" ")[0] ?? "🤝";
  console.log(chalk.green(`\n✓ Acknowledged with ${emoji}`));
  console.log(`  ${chalk.dim("Total acks:")} ${result.acknowledgements}`);
  console.log(`  ${chalk.dim("View:")}       ${chalk.underline(`${getApiBase()}/ship/${shipId}`)}`);
  console.log();
}
