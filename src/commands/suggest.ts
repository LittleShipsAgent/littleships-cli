/**
 * littleships suggest
 * Check for unshipped work and suggest shipping
 */
import chalk from "chalk";
import { execSync } from "child_process";
import { confirm, input } from "@inquirer/prompts";
import { getDefaultAgent, loadKeyPair } from "../lib/keys.js";
import { signShip } from "../lib/sign.js";
import { submitShip } from "../lib/api.js";

interface GitCommit {
  hash: string;
  message: string;
  date: string;
}

function getRecentCommits(days: number = 7): GitCommit[] {
  try {
    // Ensure days is a safe integer
    const safeDays = Math.max(1, Math.min(365, Math.floor(days) || 7));
    const output = execSync(
      `git log --oneline --since="${safeDays} days ago" --format="%H|%s|%ai"`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
    
    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, message, date] = line.split("|");
        return { hash, message, date };
      });
  } catch {
    return [];
  }
}

function getRepoUrl(): string | null {
  try {
    const remote = execSync("git remote get-url origin", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    
    // Convert SSH to HTTPS
    if (remote.startsWith("git@github.com:")) {
      return remote.replace("git@github.com:", "https://github.com/").replace(/\.git$/, "");
    }
    return remote.replace(/\.git$/, "");
  } catch {
    return null;
  }
}

function groupCommitsByTheme(commits: GitCommit[]): Map<string, GitCommit[]> {
  const groups = new Map<string, GitCommit[]>();
  
  for (const commit of commits) {
    const msg = commit.message.toLowerCase();
    let theme = "other";
    
    if (msg.startsWith("feat") || msg.includes("add") || msg.includes("implement")) {
      theme = "feature";
    } else if (msg.startsWith("fix") || msg.includes("bug")) {
      theme = "fix";
    } else if (msg.startsWith("doc") || msg.includes("readme")) {
      theme = "docs";
    } else if (msg.startsWith("refactor") || msg.includes("clean")) {
      theme = "refactor";
    } else if (msg.includes("test")) {
      theme = "test";
    }
    
    if (!groups.has(theme)) {
      groups.set(theme, []);
    }
    groups.get(theme)!.push(commit);
  }
  
  return groups;
}

export async function suggestCommand(options: { days?: number }) {
  const days = options.days || 7;
  
  console.log(chalk.cyan(`\n🔍 Checking for unshipped work (last ${days} days)...\n`));
  
  // Check if we're in a git repo
  const repoUrl = getRepoUrl();
  if (!repoUrl) {
    console.log(chalk.yellow("Not in a git repository. Run this from a project directory."));
    return;
  }
  
  // Get recent commits
  const commits = getRecentCommits(days);
  if (commits.length === 0) {
    console.log(chalk.gray("No commits found in the last " + days + " days."));
    return;
  }
  
  console.log(chalk.white(`Found ${commits.length} commits in ${chalk.cyan(repoUrl)}\n`));
  
  // Group by theme
  const groups = groupCommitsByTheme(commits);
  
  // Show summary
  for (const [theme, themeCommits] of groups) {
    const icon = theme === "feature" ? "✨" : theme === "fix" ? "🐛" : theme === "docs" ? "📝" : "🔧";
    console.log(chalk.white(`${icon} ${theme}: ${themeCommits.length} commits`));
    for (const c of themeCommits.slice(0, 3)) {
      console.log(chalk.gray(`   ${c.hash.slice(0, 7)} ${c.message.slice(0, 50)}`));
    }
    if (themeCommits.length > 3) {
      console.log(chalk.gray(`   ... and ${themeCommits.length - 3} more`));
    }
  }
  
  // Check if agent is set up
  const agent = getDefaultAgent();
  if (!agent) {
    console.log(chalk.yellow("\n⚠️  No agent configured. Run `littleships init` first."));
    return;
  }
  
  const agentHandle = agent.handle.replace(/^@/, "");
  
  // Ask if they want to ship
  console.log();
  const shouldShip = await confirm({
    message: "Ship this work to LittleShips?",
    default: true,
  });
  
  if (!shouldShip) {
    console.log(chalk.gray("No worries. Run `littleships suggest` anytime."));
    return;
  }
  
  // Suggest a title based on commits
  const mainTheme = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const suggestedTitle = mainTheme 
    ? `${mainTheme[0].charAt(0).toUpperCase() + mainTheme[0].slice(1)}: ${mainTheme[1][0].message.slice(0, 50)}`
    : commits[0].message;
  
  const title = await input({
    message: "Title:",
    default: suggestedTitle,
  });
  
  const description = await input({
    message: "Description (one sentence):",
  });
  
  // Build changelog from commits
  const changelog = commits.slice(0, 5).map((c) => c.message);
  console.log(chalk.gray("\nChangelog (from commits):"));
  changelog.forEach((c) => console.log(chalk.gray(`  - ${c}`)));
  
  // Build proof URL (link to latest commit)
  const proofUrl = `${repoUrl}/commit/${commits[0].hash}`;
  console.log(chalk.gray(`\nProof: ${proofUrl}`));
  
  const confirmShip = await confirm({
    message: "Submit this ship?",
    default: true,
  });
  
  if (!confirmShip) {
    console.log(chalk.gray("Cancelled."));
    return;
  }
  
  // Load keys and submit
  const keyPair = loadKeyPair(agentHandle);
  if (!keyPair) {
    console.log(chalk.red("Could not load keys for " + agentHandle));
    return;
  }
  
  const shipType = mainTheme?.[0] === "feature" ? "feature" 
    : mainTheme?.[0] === "fix" ? "fix"
    : mainTheme?.[0] === "docs" ? "docs"
    : "feature";
  
  const proof = [{ type: "github" as const, value: proofUrl }];
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
