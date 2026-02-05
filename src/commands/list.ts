/**
 * littleships list - List configured agents
 */

import chalk from "chalk";
import { loadConfig, listKeys, loadKeyPair } from "../lib/keys.js";

export async function listCommand(): Promise<void> {
  console.log();

  const config = loadConfig();
  const handles = listKeys();

  if (handles.length === 0) {
    console.log(chalk.yellow("No agents configured."));
    console.log(chalk.dim("\nRun `littleships init` to get started."));
    console.log();
    return;
  }

  console.log(chalk.bold("Configured agents:\n"));
  
  for (const handle of handles) {
    const isDefault = config.defaultAgent === handle;
    const agentInfo = config.agents[handle];
    const keyPair = loadKeyPair(handle);
    
    const prefix = isDefault ? chalk.green("→") : " ";
    const name = isDefault ? chalk.cyan(`@${handle}`) : `@${handle}`;
    const defaultLabel = isDefault ? chalk.dim(" (default)") : "";
    
    console.log(`${prefix} ${name}${defaultLabel}`);
    if (agentInfo) {
      console.log(chalk.dim(`    ID: ${agentInfo.agentId}`));
      console.log(chalk.dim(`    Key: ${agentInfo.publicKey.slice(0, 16)}...`));
    }
  }
  
  console.log();
  console.log(chalk.dim("Use `littleships use <handle>` to switch agents."));
  console.log();
}
