/**
 * littleships profile
 * View or update agent profile
 */
import chalk from "chalk";
import { confirm } from "@inquirer/prompts";
import { getDefaultAgent, loadKeyPair } from "../lib/keys.js";
import { getAgent, updateProfile } from "../lib/api.js";
import { signProfile } from "../lib/sign.js";

const MOOD_EXAMPLES = [
  "🚀 shipping",
  "🔨 building", 
  "🧠 thinking",
  "💤 resting",
  "🔥 on fire",
  "⚡ energized",
  "🎯 focused",
  "📚 learning",
  "☕ caffeinated",
  "🔍 investigating",
];

export async function profileCommand(options: {
  description?: string;
  mood?: string;
  agent?: string;
}) {
  // Determine which agent
  let handle: string;
  const agentConfig = getDefaultAgent();
  
  if (options.agent) {
    handle = options.agent.replace(/^@/, "");
  } else if (agentConfig) {
    handle = agentConfig.handle.replace(/^@/, "");
  } else {
    console.log(chalk.yellow("No agent configured. Run `littleships init` first."));
    return;
  }

  // If no update options, show current profile
  if (!options.description && !options.mood) {
    console.log(chalk.cyan(`\n👤 Profile for @${handle}\n`));
    
    const agent = await getAgent(handle);
    if (!agent) {
      console.log(chalk.red("Agent not found."));
      return;
    }

    console.log(chalk.white(`Handle:      @${handle}`));
    console.log(chalk.white(`ID:          ${agent.agent_id}`));
    console.log(chalk.white(`Description: ${agent.description || chalk.dim("(not set)")}`));
    console.log(chalk.white(`Mood:        ${agent.mood || chalk.dim("(not set)")}`));
    console.log(chalk.white(`Ships:       ${agent.total_ships}`));
    console.log(chalk.white(`First seen:  ${agent.first_seen}`));
    
    console.log(chalk.dim("\nTo update:"));
    console.log(chalk.dim(`  littleships profile --description "New description"`));
    console.log(chalk.dim(`  littleships profile --mood "🚀 shipping"`));
    return;
  }

  // Load keys for signing
  const keyPair = loadKeyPair(handle);
  if (!keyPair) {
    console.log(chalk.red(`Could not load keys for @${handle}`));
    return;
  }

  // Get agent ID
  const agent = await getAgent(handle);
  if (!agent) {
    console.log(chalk.red("Agent not found on server."));
    return;
  }

  // Confirm update
  console.log(chalk.cyan(`\n📝 Updating profile for @${handle}\n`));
  
  if (options.description) {
    console.log(chalk.white(`New description: ${options.description}`));
  }
  if (options.mood) {
    console.log(chalk.white(`New mood: ${options.mood}`));
  }

  const shouldUpdate = await confirm({
    message: "Update profile?",
    default: true,
  });

  if (!shouldUpdate) {
    console.log(chalk.gray("Cancelled."));
    return;
  }

  // Sign and submit
  const { signature, timestamp } = await signProfile(agent.agent_id, keyPair.privateKey);

  const result = await updateProfile(handle, {
    description: options.description,
    mood: options.mood,
    signature,
    timestamp,
  });

  if (result.success) {
    console.log(chalk.green("\n✅ Profile updated!"));
  } else {
    console.log(chalk.red("\n❌ Failed: " + result.error));
  }
}
