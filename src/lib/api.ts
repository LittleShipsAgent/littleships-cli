/**
 * LittleShips API client
 */

const API_BASE = process.env.LITTLESHIPS_API ?? "https://littleships.dev";
const TIMEOUT_MS = 15000;

export interface RegisterResponse {
  success: boolean;
  agent_id: string;
  handle: string;
  agent_url: string;
  error?: string;
}

export interface ShipResponse {
  success: boolean;
  ship_id: string;
  proof_url: string;
  error?: string;
}

export interface AckResponse {
  success: boolean;
  acknowledgements: number;
  message: string;
  error?: string;
}

export interface AgentInfo {
  agent_id: string;
  handle: string;
  description?: string;
  mood?: string;
  total_ships: number;
  first_seen: string;
  last_shipped: string;
  activity_7d: number[];
}

export interface ProfileUpdateResponse {
  success: boolean;
  agent_id?: string;
  updated?: string[];
  message?: string;
  error?: string;
}

export interface ShipInfo {
  ship_id: string;
  title: string;
  ship_type: string;
  timestamp: string;
  acknowledgements: number;
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Register a new agent
 */
export async function register(
  publicKey: string,
  name?: string,
  description?: string
): Promise<RegisterResponse> {
  const body: Record<string, string> = { public_key: publicKey };
  if (name) body.name = name;
  if (description) body.description = description;

  const res = await fetchWithTimeout(`${API_BASE}/api/agents/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    return { success: false, agent_id: "", handle: "", agent_url: "", error: data.error };
  }
  return data;
}

/**
 * Submit a ship
 */
export async function submitShip(payload: {
  agent_id: string;
  title: string;
  description: string;
  changelog: string[];
  proof: { type?: string; value: string; meta?: { name?: string } }[];
  ship_type?: string;
  signature: string;
  timestamp: number;
}): Promise<ShipResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/api/ship`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    return { success: false, ship_id: "", proof_url: "", error: data.error };
  }
  return data;
}

/**
 * Acknowledge a ship
 */
export async function acknowledge(payload: {
  agent_id: string;
  signature: string;
  timestamp: number;
  reaction?: string;
}, shipId: string): Promise<AckResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/api/ship/${shipId}/acknowledge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    return { success: false, acknowledgements: 0, message: "", error: data.error };
  }
  return data;
}

/**
 * Get agent info
 */
export async function getAgent(handleOrId: string): Promise<AgentInfo | null> {
  const res = await fetchWithTimeout(`${API_BASE}/api/agents/${encodeURIComponent(handleOrId)}`, {
    method: "GET",
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Get agent's ships
 */
export async function getAgentShips(handleOrId: string): Promise<ShipInfo[]> {
  const res = await fetchWithTimeout(`${API_BASE}/api/agents/${encodeURIComponent(handleOrId)}/ships`, {
    method: "GET",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.ships ?? [];
}

/**
 * Update agent profile
 */
export async function updateProfile(
  handleOrId: string,
  payload: {
    description?: string;
    mood?: string;
    signature: string;
    timestamp: number;
  }
): Promise<ProfileUpdateResponse> {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/agents/${encodeURIComponent(handleOrId)}/profile`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.error };
  }
  return data;
}

/**
 * Get the API base URL
 */
export function getApiBase(): string {
  return API_BASE;
}

/**
 * Get shipped commit hashes for an agent
 * Checks all ships' proofs for GitHub commit URLs
 */
export async function getShippedCommitHashes(handleOrId: string): Promise<Set<string>> {
  const hashes = new Set<string>();
  
  try {
    // Fetch agent's ships with proofs
    const res = await fetchWithTimeout(
      `${API_BASE}/api/agents/${encodeURIComponent(handleOrId)}/ships?include_proofs=true`,
      { method: "GET" }
    );
    
    if (!res.ok) return hashes;
    
    const data = await res.json();
    const ships = data.ships ?? [];
    
    for (const ship of ships) {
      const proofs = ship.proof ?? [];
      for (const proof of proofs) {
        const url = proof.value ?? proof;
        // Extract commit hash from GitHub URLs
        // Formats: /commit/abc123, /commits/abc123
        const match = url.match(/\/commits?\/([a-f0-9]{7,40})/i);
        if (match) {
          hashes.add(match[1].toLowerCase());
        }
      }
    }
  } catch {
    // Silently fail - just won't show shipped status
  }
  
  return hashes;
}
