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
      "cli", "command", "terminal", "tool", "script", "build", "compile",
      "contract", "solidity", "ethereum", "deploy", "backend", "server",
      "api", "endpoint", "database", "migration", "schema", "tooling",
      "npm", "package", "library", "sdk", "integration"
    ],
    proofPatterns: ["etherscan", "basescan", "0x", "hardhat", "foundry"]
  },
  {
    handle: "beacon",
    role: "Frontend architect & UI specialist",
    domains: ["frontend", "ui", "design", "components", "styling"],
    shipTypes: ["feature", "ui", "enhancement", "design"],
    keywords: [
      "ui", "frontend", "component", "react", "next", "tailwind", "css",
      "design", "layout", "responsive", "animation", "style", "theme",
      "dark mode", "light mode", "button", "modal", "form", "page",
      "dashboard", "interface", "ux", "accessibility", "a11y"
    ],
    proofPatterns: ["vercel", "netlify", "figma"]
  },
  {
    handle: "scribe",
    role: "Documentation & content specialist",
    domains: ["documentation", "content", "writing", "guides"],
    shipTypes: ["docs", "content", "documentation"],
    keywords: [
      "doc", "documentation", "readme", "guide", "tutorial", "howto",
      "example", "reference", "api docs", "changelog", "release notes",
      "blog", "article", "post", "content", "writing", "spec", "rfc"
    ],
    proofPatterns: ["docs.", "readme", "wiki", "notion", "gitbook"]
  },
  {
    handle: "navigator",
    role: "DevRel & developer experience",
    domains: ["devrel", "examples", "tutorials", "integrations", "sdks"],
    shipTypes: ["example", "tutorial", "integration", "sdk"],
    keywords: [
      "example", "sample", "demo", "tutorial", "quickstart", "getting started",
      "integration", "sdk", "client", "wrapper", "devrel", "developer",
      "onboarding", "workshop", "talk", "conference", "community"
    ],
    proofPatterns: ["codesandbox", "stackblitz", "replit"]
  },
  {
    handle: "sentinel",
    role: "Security & infrastructure hardening",
    domains: ["security", "audit", "hardening", "compliance"],
    shipTypes: ["security", "fix", "audit"],
    keywords: [
      "security", "audit", "vulnerability", "cve", "fix", "patch",
      "hardening", "rate limit", "auth", "authentication", "authorization",
      "encryption", "ssl", "tls", "sanitize", "validate", "xss", "csrf",
      "injection", "penetration", "compliance", "gdpr", "soc2"
    ],
    proofPatterns: ["security", "advisory", "cve"]
  },
  {
    handle: "prism",
    role: "Analytics & data insights",
    domains: ["analytics", "metrics", "dashboards", "data"],
    shipTypes: ["analytics", "feature", "dashboard"],
    keywords: [
      "analytics", "metrics", "dashboard", "chart", "graph", "data",
      "tracking", "event", "funnel", "conversion", "report", "insight",
      "visualization", "stats", "statistics", "monitoring", "observability"
    ],
    proofPatterns: ["grafana", "datadog", "amplitude", "mixpanel"]
  },
  {
    handle: "helix",
    role: "Research & experimental features",
    domains: ["research", "experiments", "prototypes", "innovation"],
    shipTypes: ["experiment", "research", "prototype"],
    keywords: [
      "experiment", "prototype", "research", "exploration", "poc",
      "proof of concept", "spike", "investigation", "test", "trial",
      "alpha", "beta", "experimental", "innovation", "novel"
    ],
    proofPatterns: []
  },
  {
    handle: "flux",
    role: "Automation & CI/CD specialist",
    domains: ["automation", "ci", "cd", "deployments", "workflows"],
    shipTypes: ["infrastructure", "automation", "ci"],
    keywords: [
      "ci", "cd", "pipeline", "workflow", "action", "automation",
      "deploy", "deployment", "release", "build", "test", "lint",
      "github actions", "jenkins", "docker", "kubernetes", "k8s",
      "terraform", "ansible", "infrastructure as code", "iac"
    ],
    proofPatterns: ["github.com/actions", "circleci", "jenkins"]
  },
  {
    handle: "atlas",
    role: "Product manager & strategic lead",
    domains: ["product", "strategy", "launches", "announcements"],
    shipTypes: ["launch", "announcement", "milestone"],
    keywords: [
      "launch", "announce", "release", "milestone", "roadmap", "strategy",
      "product", "feature complete", "ga", "general availability", "v1",
      "mvp", "beta launch", "public launch", "go live"
    ],
    proofPatterns: ["producthunt", "twitter.com", "x.com"]
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
