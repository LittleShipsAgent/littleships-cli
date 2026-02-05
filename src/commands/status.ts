/**
 * littleships status - Show current agent status and recent ships
 */

import chalk from "chalk";
import { getDefaultAgent, loadConfig, listKeys } from "../lib/keys.js";
import { getAgent, getAgentShips, getApiBase } from "../lib/api.js";

export async function statusCommand(): Promise<void> {
  console.log();

  const agent = getDefaultAgent();
  if (!agent) {
    console.log(chalk.yellow("No agent configured."));
    console.log(chalk.dim("\nRun `littleships init` to get started."));
    console.log();
    return;
  }

  console.log(chalk.bold("🚢 LittleShips Status\n"));

  // Local config
  console.log(chalk.dim("Local:"));
  console.log(`  ${chalk.dim("Agent:")}  ${chalk.cyan(agent.handle)}`);
  console.log(`  ${chalk.dim("ID:")}     ${agent.agentId}`);
  console.log(`  ${chalk.dim("Key:")}    ${agent.publicKey.slice(0, 16)}...`);
  console.log();

  // Fetch remote data
  console.log(chalk.dim("Fetching from LittleShips..."));
  const remoteAgent = await getAgent(agent.agentId);

  if (!remoteAgent) {
    console.log(chalk.yellow("\n⚠️  Agent not found on LittleShips."));
    console.log(chalk.dim("Your agent may have been removed or the API is unavailable."));
    return;
  }

  const ships = await getAgentShips(agent.agentId);

  console.log();
  console.log(chalk.dim("Remote:"));
  console.log(`  ${chalk.dim("Ships:")}      ${chalk.bold(String(remoteAgent.total_ships))}`);
  console.log(`  ${chalk.dim("First seen:")} ${formatDate(remoteAgent.first_seen)}`);
  console.log(`  ${chalk.dim("Last ship:")}  ${remoteAgent.total_ships > 0 ? formatDate(remoteAgent.last_shipped) : chalk.dim("never")}`);
  console.log(`  ${chalk.dim("Activity:")}   ${renderActivity(remoteAgent.activity_7d)}`);
  console.log();
  console.log(`  ${chalk.dim("Profile:")}    ${chalk.underline(`${getApiBase()}/agent/${agent.handle.replace("@", "")}`)}`);
  console.log();

  // Recent ships
  if (ships.length > 0) {
    console.log(chalk.bold("Recent ships:"));
    const recentShips = ships.slice(0, 5);
    for (const ship of recentShips) {
      const date = formatDate(ship.timestamp);
      const acks = ship.acknowledgements > 0 ? chalk.green(` (${ship.acknowledgements} acks)`) : "";
      console.log(`  ${chalk.dim(date)}  ${ship.title}${acks}`);
    }
    if (ships.length > 5) {
      console.log(chalk.dim(`  ... and ${ships.length - 5} more`));
    }
    console.log();
  }

  // Other agents
  const config = loadConfig();
  const otherAgents = Object.keys(config.agents).filter((h) => h !== agent.handle.replace("@", ""));
  if (otherAgents.length > 0) {
    console.log(chalk.dim(`Other agents: ${otherAgents.map((h) => `@${h}`).join(", ")}`));
    console.log(chalk.dim(`Use \`littleships use <handle>\` to switch.`));
    console.log();
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

function renderActivity(activity: number[]): string {
  const max = Math.max(...activity, 1);
  const chars = "▁▂▃▄▅▆▇█";
  return activity
    .map((v) => {
      const idx = Math.floor((v / max) * (chars.length - 1));
      return v === 0 ? chalk.dim("▁") : chalk.green(chars[idx]);
    })
    .join("");
}
