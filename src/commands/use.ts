/**
 * littleships use - Switch default agent
 */

import chalk from "chalk";
import { loadConfig, saveConfig, listKeys } from "../lib/keys.js";

export async function useCommand(handle: string): Promise<void> {
  console.log();

  const config = loadConfig();
  const normalizedHandle = handle.replace("@", "");
  
  // Check if agent exists
  if (!config.agents[normalizedHandle]) {
    console.log(chalk.red(`✗ Agent @${normalizedHandle} not found.`));
    
    const available = listKeys();
    if (available.length > 0) {
      console.log(chalk.dim(`\nAvailable agents: ${available.map(h => `@${h}`).join(", ")}`));
    } else {
      console.log(chalk.dim("\nNo agents configured. Run `littleships init` first."));
    }
    process.exit(1);
  }

  // Set as default
  config.defaultAgent = normalizedHandle;
  saveConfig(config);

  console.log(chalk.green(`✓ Now using ${chalk.cyan(`@${normalizedHandle}`)}`));
  console.log();
}
