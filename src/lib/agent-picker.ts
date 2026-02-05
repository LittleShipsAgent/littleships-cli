/**
 * Agent Picker - Automatically select the best agent to ship as
 * based on ship type, proof URLs, and content keywords.
 */

export interface AgentProfile {
  handle: string;
  role: string;
  domains: string[];      // Primary work domains
  shipTypes: string[];    // Ship types this agent typically handles
  keywords: string[];     // Keywords that signal this agent's work
  proofPatterns: string[]; // URL patterns in proof
}

/**
 * Team agent profiles with their specializations
 */
export const TEAM_AGENTS: AgentProfile[] = [
  {
    handle: "forge",
    role: "Smart contract architect & tooling expert",
    domains: ["tooling", "infrastructure", "backend", "contracts", "cli"],
    shipTypes: ["feature", "infrastructure", "api", "tool", "contract"],
    keywords: [
      // CLI & tooling
      "cli", "command", "terminal", "tool", "script", "build", "compile",
      "parser", "generator", "scaffold", "boilerplate", "template",
      // Blockchain
      "contract", "solidity", "ethereum", "deploy", "web3", "ethers",
      "hardhat", "foundry", "wagmi", "viem", "abi", "bytecode", "gas",
      "transaction", "wallet", "signing", "blockchain", "onchain",
      // Backend
      "backend", "server", "api", "endpoint", "route", "handler",
      "database", "migration", "schema", "query", "sql", "postgres",
      "redis", "cache", "queue", "worker", "cron", "job",
      // Packages
      "npm", "package", "library", "sdk", "module", "dependency"
    ],
    proofPatterns: ["etherscan", "basescan", "0x", "hardhat", "foundry", "/api/", "/lib/", "/server/"]
  },
  {
    handle: "beacon",
    role: "Frontend architect & UI specialist",
    domains: ["frontend", "ui", "design", "components", "styling", "visual", "ux"],
    shipTypes: ["feature", "ui", "enhancement", "design"],
    keywords: [
      // Core UI
      "ui", "frontend", "component", "widget", "element", "view",
      "interface", "ux", "user experience", "user interface",
      // Frameworks
      "react", "next", "nextjs", "vue", "svelte", "solid",
      // Styling
      "tailwind", "css", "scss", "sass", "styled", "emotion",
      "style", "styling", "theme", "theming", "dark mode", "light mode",
      // Visual
      "design", "layout", "responsive", "mobile", "desktop", "breakpoint",
      "animation", "animate", "transition", "motion", "framer",
      "visual", "aesthetic", "pixel", "spacing", "padding", "margin",
      // Colors
      "color", "colour", "gradient", "rainbow", "palette", "shade", "tint",
      "primary", "secondary", "accent", "background", "foreground",
      // Components
      "button", "btn", "modal", "dialog", "popup", "drawer", "sheet",
      "form", "input", "select", "checkbox", "radio", "toggle", "switch",
      "card", "panel", "container", "wrapper", "box", "grid", "flex",
      "header", "footer", "nav", "navbar", "sidebar", "menu", "dropdown",
      "tab", "tabs", "accordion", "collapse", "expand",
      "tooltip", "popover", "toast", "notification", "alert", "banner",
      "badge", "pill", "chip", "tag", "label",
      "avatar", "profile", "image", "icon", "logo", "svg",
      "skeleton", "loading", "spinner", "progress", "loader",
      "list", "table", "row", "column", "cell",
      "link", "anchor", "breadcrumb", "pagination",
      // Interactions
      "hover", "focus", "active", "disabled", "click", "tap", "press",
      "scroll", "drag", "drop", "resize", "zoom",
      // A11y
      "accessibility", "a11y", "aria", "screen reader", "keyboard"
    ],
    proofPatterns: ["vercel", "netlify", "figma", "/components/", "/ui/", "/styles/", "/app/", "/pages/"]
  },
  {
    handle: "scribe",
    role: "Documentation & content specialist",
    domains: ["documentation", "content", "writing", "guides", "copy"],
    shipTypes: ["docs", "content", "documentation"],
    keywords: [
      // Docs
      "doc", "docs", "documentation", "readme", "guide", "tutorial",
      "howto", "how-to", "walkthrough", "instructions", "manual",
      // References
      "reference", "api docs", "api reference", "specification", "spec",
      "changelog", "release notes", "migration guide", "upgrade guide",
      // Content
      "blog", "article", "post", "content", "writing", "copy", "text",
      "headline", "title", "description", "summary", "abstract",
      // Technical writing
      "rfc", "proposal", "adr", "decision record", "architecture doc",
      "comment", "jsdoc", "tsdoc", "docstring", "annotation"
    ],
    proofPatterns: ["docs.", "readme", "wiki", "notion", "gitbook", "/docs/", "CHANGELOG", "README"]
  },
  {
    handle: "navigator",
    role: "DevRel & developer experience",
    domains: ["devrel", "examples", "tutorials", "integrations", "sdks", "dx"],
    shipTypes: ["example", "tutorial", "integration", "sdk"],
    keywords: [
      // Examples
      "example", "sample", "demo", "showcase", "starter", "template",
      // Learning
      "tutorial", "quickstart", "getting started", "introduction", "intro",
      "learn", "course", "lesson", "workshop", "bootcamp",
      // Integration
      "integration", "sdk", "client", "wrapper", "binding", "connector",
      // DevRel
      "devrel", "developer relations", "developer experience", "dx",
      "onboarding", "adoption", "evangelism",
      // Community
      "talk", "conference", "meetup", "presentation", "slides",
      "community", "discord", "slack", "forum", "support"
    ],
    proofPatterns: ["codesandbox", "stackblitz", "replit", "/examples/", "/demo/", "/samples/"]
  },
  {
    handle: "sentinel",
    role: "Security & infrastructure hardening",
    domains: ["security", "audit", "hardening", "compliance", "safety"],
    shipTypes: ["security", "fix", "audit"],
    keywords: [
      // Security core
      "security", "secure", "audit", "vulnerability", "vuln", "cve",
      "exploit", "attack", "threat", "risk", "exposure",
      // Fixes
      "fix", "patch", "hotfix", "remediation", "mitigation",
      "hardening", "harden", "strengthen", "protect", "defense",
      // Auth
      "auth", "authentication", "authorization", "permission", "access",
      "login", "logout", "session", "token", "jwt", "oauth", "saml",
      "password", "credential", "secret", "key management",
      // Crypto
      "encryption", "decrypt", "hash", "signature", "signing",
      "ssl", "tls", "https", "certificate", "cert",
      // Input safety
      "sanitize", "sanitization", "validate", "validation", "escape",
      "xss", "csrf", "injection", "sqli", "command injection",
      "input validation", "output encoding",
      // Rate limiting
      "rate limit", "throttle", "ddos", "dos", "abuse", "spam",
      // Compliance
      "compliance", "gdpr", "soc2", "hipaa", "pci", "iso27001",
      "penetration", "pentest", "bug bounty"
    ],
    proofPatterns: ["security", "advisory", "cve", "/security/", "SECURITY.md"]
  },
  {
    handle: "prism",
    role: "Analytics & data insights",
    domains: ["analytics", "metrics", "dashboards", "data", "insights"],
    shipTypes: ["analytics", "feature", "dashboard"],
    keywords: [
      // Analytics
      "analytics", "tracking", "telemetry", "instrumentation",
      "event", "events", "pageview", "click tracking",
      // Metrics
      "metrics", "measurement", "kpi", "indicator", "benchmark",
      "performance", "latency", "throughput", "uptime",
      // Visualization
      "dashboard", "chart", "graph", "plot", "visualization", "viz",
      "report", "reporting", "insight", "trend", "pattern",
      // Data
      "data", "dataset", "aggregation", "rollup", "timeseries",
      "funnel", "conversion", "retention", "cohort", "segment",
      "stats", "statistics", "average", "median", "percentile",
      // Tools
      "monitoring", "observability", "alerting", "anomaly"
    ],
    proofPatterns: ["grafana", "datadog", "amplitude", "mixpanel", "posthog", "/analytics/", "/metrics/"]
  },
  {
    handle: "helix",
    role: "Research & experimental features",
    domains: ["research", "experiments", "prototypes", "innovation", "r&d"],
    shipTypes: ["experiment", "research", "prototype"],
    keywords: [
      // Research
      "experiment", "experimental", "prototype", "prototyping",
      "research", "r&d", "exploration", "exploratory", "investigate",
      // Early stage
      "poc", "proof of concept", "spike", "feasibility", "study",
      "trial", "test", "hypothesis", "validation",
      // Innovation
      "alpha", "beta", "preview", "canary", "feature flag",
      "innovation", "novel", "new approach", "breakthrough",
      "cutting edge", "bleeding edge", "emerging"
    ],
    proofPatterns: ["/experiments/", "/research/", "/prototypes/", "/spikes/"]
  },
  {
    handle: "flux",
    role: "Automation & CI/CD specialist",
    domains: ["automation", "ci", "cd", "deployments", "workflows", "devops"],
    shipTypes: ["infrastructure", "automation", "ci"],
    keywords: [
      // CI/CD
      "ci", "cd", "cicd", "ci/cd", "continuous integration", "continuous deployment",
      "pipeline", "workflow", "action", "job", "step", "stage",
      // Automation
      "automation", "automate", "automated", "script", "cron", "scheduled",
      "trigger", "hook", "webhook", "callback",
      // Deploy
      "deploy", "deployment", "release", "rollout", "rollback",
      "staging", "production", "environment", "env",
      // Build
      "build", "compile", "bundle", "package", "artifact",
      "test", "lint", "format", "check", "validate",
      // Infra
      "docker", "container", "kubernetes", "k8s", "helm", "pod",
      "terraform", "pulumi", "cloudformation", "iac",
      "ansible", "chef", "puppet", "salt",
      // Platforms
      "github actions", "gitlab ci", "jenkins", "circleci", "travis",
      "aws", "gcp", "azure", "vercel", "netlify", "railway", "fly"
    ],
    proofPatterns: ["github.com/actions", "circleci", "jenkins", "/.github/", "/workflows/", "Dockerfile"]
  },
  {
    handle: "atlas",
    role: "Product manager & strategic lead",
    domains: ["product", "strategy", "launches", "announcements", "planning"],
    shipTypes: ["launch", "announcement", "milestone"],
    keywords: [
      // Launches
      "launch", "announce", "announcement", "release", "ship",
      "go live", "live", "public", "generally available", "ga",
      // Milestones
      "milestone", "complete", "finished", "done", "shipped",
      "v1", "v2", "1.0", "2.0", "mvp", "beta launch",
      // Strategy
      "roadmap", "strategy", "strategic", "vision", "direction",
      "planning", "plan", "priority", "prioritize", "scope",
      // Product
      "product", "feature complete", "user story", "requirement",
      "stakeholder", "customer", "user feedback", "iteration"
    ],
    proofPatterns: ["producthunt", "twitter.com", "x.com", "/announcements/", "CHANGELOG"]
  }
];

/**
 * Score an agent based on how well they match the ship content
 */
function scoreAgent(
  agent: AgentProfile,
  shipType: string,
  title: string,
  description: string,
  proofUrls: string[]
): number {
  let score = 0;
  const content = `${title} ${description}`.toLowerCase();
  const shipTypeLower = shipType.toLowerCase();

  // Ship type match (high weight)
  if (agent.shipTypes.includes(shipTypeLower)) {
    score += 30;
  }

  // Keyword matches (medium weight)
  for (const keyword of agent.keywords) {
    if (content.includes(keyword.toLowerCase())) {
      score += 5;
    }
  }

  // Proof URL pattern matches (medium weight)
  for (const proof of proofUrls) {
    const proofLower = proof.toLowerCase();
    for (const pattern of agent.proofPatterns) {
      if (proofLower.includes(pattern.toLowerCase())) {
        score += 10;
      }
    }
  }

  // Domain keyword matches (lower weight)
  for (const domain of agent.domains) {
    if (content.includes(domain.toLowerCase())) {
      score += 3;
    }
  }

  return score;
}

export interface AgentPickerResult {
  recommended: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  scores: { handle: string; score: number }[];
}

/**
 * Pick the best agent to ship as based on content analysis
 */
export function pickShipAgent(
  shipType: string,
  title: string,
  description: string,
  proofUrls: string[]
): AgentPickerResult {
  const scores = TEAM_AGENTS.map(agent => ({
    handle: agent.handle,
    score: scoreAgent(agent, shipType, title, description, proofUrls),
    role: agent.role
  })).sort((a, b) => b.score - a.score);

  const top = scores[0];
  const second = scores[1];
  const gap = top.score - second.score;

  // Determine confidence based on score gap
  let confidence: "high" | "medium" | "low";
  let reason: string;

  if (top.score === 0) {
    confidence = "low";
    reason = "No strong signals found — defaulting to atlas for general work";
    return {
      recommended: "atlas",
      confidence,
      reason,
      scores: scores.map(s => ({ handle: s.handle, score: s.score }))
    };
  } else if (gap >= 15) {
    confidence = "high";
    reason = `Strong match for ${top.handle} (${top.role})`;
  } else if (gap >= 5) {
    confidence = "medium";
    reason = `${top.handle} is the best fit, but ${second.handle} could also work`;
  } else {
    confidence = "low";
    reason = `Close call between ${top.handle} and ${second.handle}`;
  }

  return {
    recommended: top.handle,
    confidence,
    reason,
    scores: scores.map(s => ({ handle: s.handle, score: s.score }))
  };
}

/**
 * Get a specific agent's profile
 */
export function getAgentProfile(handle: string): AgentProfile | undefined {
  return TEAM_AGENTS.find(a => a.handle === handle.replace("@", ""));
}

/**
 * List all team agents with their roles
 */
export function listTeamAgents(): { handle: string; role: string }[] {
  return TEAM_AGENTS.map(a => ({ handle: a.handle, role: a.role }));
}
