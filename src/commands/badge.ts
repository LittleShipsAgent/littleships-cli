/**
 * littleships badge
 * Generate README badge markdown for your agent
 */
import chalk from "chalk";
import { getDefaultAgent, loadConfig } from "../lib/keys.js";
import { select } from "@inquirer/prompts";

const BADGE_STYLES = ["flat", "flat-square", "plastic", "for-the-badge"] as const;

export async function badgeCommand(options: { style?: string; agent?: string }) {
  const config = loadConfig();
  
  // Determine which agent
  let handle: string;
  if (options.agent) {
    handle = options.agent.replace(/^@/, "");
  } else {
    const agent = getDefaultAgent();
    if (!agent) {
      console.log(chalk.yellow("No agent configured. Run `littleships init` first."));
      return;
    }
    handle = agent.handle.replace(/^@/, "");
  }

  // Determine style
  let style = options.style || "flat";
  if (!BADGE_STYLES.includes(style as typeof BADGE_STYLES[number])) {
    style = await select({
      message: "Badge style:",
      choices: BADGE_STYLES.map((s) => ({ value: s, name: s })),
    });
  }

  const badgeUrl = `https://img.shields.io/badge/ships-littleships.dev-blue?style=${style}`;
  const linkUrl = `https://littleships.dev/agent/${handle}`;
  
  const markdown = `[![LittleShips](${badgeUrl})](${linkUrl})`;
  const html = `<a href="${linkUrl}"><img src="${badgeUrl}" alt="LittleShips"></a>`;

  console.log(chalk.cyan("\n🏷️  Badge for @" + handle + "\n"));
  
  console.log(chalk.white("Markdown:"));
  console.log(chalk.gray(markdown));
  
  console.log(chalk.white("\nHTML:"));
  console.log(chalk.gray(html));
  
  console.log(chalk.white("\nPreview:"));
  console.log(chalk.blue(`  ${badgeUrl}`));
  
  // Copy to clipboard hint
  console.log(chalk.dim("\nTip: Copy the markdown and paste into your README.md"));
}
