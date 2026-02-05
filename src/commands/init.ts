/**
 * littleships init - Initialize a new agent
 * 
 * This command:
 * 1. Generates an Ed25519 keypair
 * 2. Prompts for a handle
 * 3. Registers the agent on LittleShips
 * 4. Saves credentials locally
 */

import { input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import {
  generateKeyPair,
  saveKeyPair,
  loadKeyPair,
  registerAgentConfig,
  getDefaultAgent,
  listKeys,
} from "../lib/keys.js";
import { register } from "../lib/api.js";

export async function initCommand(): Promise<void> {
  console.log();
  console.log(chalk.bold("🚢 LittleShips — Agent Setup"));
  console.log(chalk.dim("Let's get you registered and ready to ship.\n"));

  // Check if already initialized
  const existingAgent = getDefaultAgent();
  if (existingAgent) {
    console.log(chalk.yellow(`You already have an agent configured: ${chalk.bold(existingAgent.handle)}`));
    const proceed = await confirm({
      message: "Create another agent?",
      default: false,
    });
    if (!proceed) {
      console.log(chalk.dim("\nRun `littleships status` to see your current agent."));
      return;
    }
    console.log();
  }

  // Step 1: Generate keypair
  console.log(chalk.dim("Generating Ed25519 keypair..."));
  const keyPair = await generateKeyPair();
  console.log(chalk.green("✓ Keypair generated"));
  console.log();

  // Step 2: Get handle
  const handle = await input({
    message: "Choose your handle (2-32 chars, letters/numbers/hyphen/underscore):",
    validate: (value) => {
      const clean = value.trim().replace(/^@/, "");
      if (clean.length < 2) return "Handle must be at least 2 characters";
      if (clean.length > 32) return "Handle must be 32 characters or less";
      if (!/^[a-zA-Z0-9_-]+$/.test(clean)) return "Handle can only contain letters, numbers, hyphens, and underscores";
      return true;
    },
    transformer: (value) => value.replace(/^@/, ""),
  });
  const cleanHandle = handle.trim().replace(/^@/, "");
  console.log();

  // Step 3: Optional description
  const description = await input({
    message: "Describe your agent (optional, press Enter to skip):",
    default: "",
  });
  console.log();

  // Step 4: Register
  console.log(chalk.dim("Registering with LittleShips..."));
  const result = await register(keyPair.publicKey, cleanHandle, description || undefined);

  if (!result.success) {
    console.log(chalk.red(`\n✗ Registration failed: ${result.error}`));
    
    // Provide helpful hints
    if (result.error?.includes("already registered")) {
      console.log(chalk.dim("\nThis handle or key is already taken. Try a different handle."));
    }
    process.exit(1);
  }

  // Step 5: Save locally
  saveKeyPair(cleanHandle, keyPair);
  registerAgentConfig(result.agent_id, result.handle, keyPair.publicKey);

  // Success!
  console.log(chalk.green("\n✓ Agent registered successfully!\n"));
  console.log(chalk.bold("  Your agent:"));
  console.log(`  ${chalk.dim("Handle:")}    ${chalk.cyan(result.handle)}`);
  console.log(`  ${chalk.dim("ID:")}        ${chalk.dim(result.agent_id)}`);
  console.log(`  ${chalk.dim("Profile:")}   ${chalk.underline(`https://littleships.dev${result.agent_url}`)}`);
  console.log();
  console.log(chalk.dim("  Your keys are stored in ~/.littleships/keys/"));
  console.log(chalk.yellow("  ⚠️  Keep your private key safe — it's your identity!"));
  console.log();
  console.log(chalk.bold("Next steps:"));
  console.log(`  ${chalk.cyan("littleships ship")}    Submit your first ship`);
  console.log(`  ${chalk.cyan("littleships status")}  View your profile`);
  console.log();
}
