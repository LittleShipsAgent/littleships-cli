/**
 * littleships changelog
 * Generate changelog from git commits (preview without shipping)
 */
import chalk from "chalk";
import { execSync } from "child_process";

interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  date: string;
  author: string;
}

/**
 * Sanitize a string for use in shell commands
 * Only allow alphanumeric, spaces, hyphens, and common date chars
 */
function sanitizeForShell(input: string): string {
  return input.replace(/[^a-zA-Z0-9\s\-:\/]/g, "");
}

function getCommits(since: string, until?: string): GitCommit[] {
  try {
    const args = ["log", "--format=%H|%h|%s|%ai|%an"];
    if (since) args.push(`--since=${sanitizeForShell(since)}`);
    if (until) args.push(`--until=${sanitizeForShell(until)}`);
    
    const output = execSync(`git ${args.join(" ")}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, shortHash, message, date, author] = line.split("|");
        return { hash, shortHash, message, date, author };
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

    if (remote.startsWith("git@github.com:")) {
      return remote.replace("git@github.com:", "https://github.com/").replace(/\.git$/, "");
    }
    return remote.replace(/\.git$/, "");
  } catch {
    return null;
  }
}

function categorizeCommit(message: string): string {
  const msg = message.toLowerCase();
  if (msg.startsWith("feat") || msg.includes("add") || msg.includes("implement")) return "✨ Features";
  if (msg.startsWith("fix") || msg.includes("bug")) return "🐛 Fixes";
  if (msg.startsWith("doc") || msg.includes("readme")) return "📝 Docs";
  if (msg.startsWith("refactor") || msg.includes("clean")) return "♻️ Refactor";
  if (msg.startsWith("test")) return "🧪 Tests";
  if (msg.startsWith("chore") || msg.includes("deps")) return "🔧 Chores";
  if (msg.includes("security") || msg.includes("vuln")) return "🔒 Security";
  return "📦 Other";
}

export async function changelogCommand(options: {
  days?: number;
  since?: string;
  format?: string;
  grouped?: boolean;
}) {
  const days = options.days || 7;
  const since = options.since || `${days} days ago`;
  const format = options.format || "markdown";
  const grouped = options.grouped !== false;

  console.log(chalk.cyan(`\n📋 Changelog (since ${since})\n`));

  const repoUrl = getRepoUrl();
  if (!repoUrl) {
    console.log(chalk.yellow("Not in a git repository."));
    return;
  }

  const commits = getCommits(since);
  if (commits.length === 0) {
    console.log(chalk.gray("No commits found."));
    return;
  }

  console.log(chalk.dim(`${commits.length} commits in ${repoUrl}\n`));

  if (grouped) {
    // Group by category
    const groups = new Map<string, GitCommit[]>();
    for (const commit of commits) {
      const category = categorizeCommit(commit.message);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(commit);
    }

    // Output grouped
    for (const [category, categoryCommits] of groups) {
      if (format === "markdown") {
        console.log(chalk.white(`### ${category}\n`));
        for (const c of categoryCommits) {
          console.log(`- ${c.message} ([\`${c.shortHash}\`](${repoUrl}/commit/${c.hash}))`);
        }
        console.log();
      } else {
        console.log(chalk.white(`${category}`));
        for (const c of categoryCommits) {
          console.log(chalk.gray(`  - ${c.message}`));
        }
        console.log();
      }
    }
  } else {
    // Flat list
    if (format === "markdown") {
      for (const c of commits) {
        console.log(`- ${c.message} ([\`${c.shortHash}\`](${repoUrl}/commit/${c.hash}))`);
      }
    } else {
      for (const c of commits) {
        console.log(chalk.gray(`- ${c.message}`));
      }
    }
  }

  // Ship hint
  console.log(chalk.dim("---"));
  console.log(chalk.dim("Ready to ship? Run: littleships ship"));
}
