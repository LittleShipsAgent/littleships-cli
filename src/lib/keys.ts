/**
 * Key management for LittleShips CLI
 * Handles generation, storage, and loading of Ed25519 keypairs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const LITTLESHIPS_DIR = join(homedir(), ".littleships");
const KEYS_DIR = join(LITTLESHIPS_DIR, "keys");
const CONFIG_FILE = join(LITTLESHIPS_DIR, "config.json");

export interface KeyPair {
  publicKey: string;  // 64 hex chars
  privateKey: string; // 64 hex chars (seed only)
}

export interface AgentConfig {
  agentId: string;
  handle: string;
  publicKey: string;
}

export interface Config {
  defaultAgent?: string;
  agents: Record<string, AgentConfig>;
}

/**
 * Ensure the .littleships directory structure exists
 */
export function ensureDirectories(): void {
  if (!existsSync(LITTLESHIPS_DIR)) {
    mkdirSync(LITTLESHIPS_DIR, { mode: 0o700 });
  }
  if (!existsSync(KEYS_DIR)) {
    mkdirSync(KEYS_DIR, { mode: 0o700 });
  }
}

/**
 * Generate a new Ed25519 keypair using Web Crypto API
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true, // extractable
    ["sign", "verify"]
  );

  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyPkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  // Extract the raw 32-byte private key seed from PKCS#8
  const pkcs8 = new Uint8Array(privateKeyPkcs8);
  const rawPrivate = pkcs8.slice(-32);

  return {
    publicKey: bytesToHex(new Uint8Array(publicKeyRaw)),
    privateKey: bytesToHex(rawPrivate),
  };
}

/**
 * Save a keypair to the keys directory
 */
export function saveKeyPair(name: string, keyPair: KeyPair): void {
  ensureDirectories();
  const keyFile = join(KEYS_DIR, `${name}.env`);
  const content = `# LittleShips Agent Key - ${name}
# Generated: ${new Date().toISOString()}
# Keep this file secure and never share your private key!

LITTLESHIPS_PRIVATE_KEY=${keyPair.privateKey}
LITTLESHIPS_PUBLIC_KEY=${keyPair.publicKey}
`;
  writeFileSync(keyFile, content, { mode: 0o600 });
  chmodSync(keyFile, 0o600); // Ensure permissions even if umask differs
}

/**
 * Load a keypair from the keys directory
 * Supports multiple key file formats:
 * - LITTLESHIPS_PRIVATE_KEY / LITTLESHIPS_PUBLIC_KEY
 * - {NAME}_PRIVATE_KEY / {NAME}_PUBLIC_KEY
 */
export function loadKeyPair(name: string): KeyPair | null {
  const keyFile = join(KEYS_DIR, `${name}.env`);
  if (!existsSync(keyFile)) {
    return null;
  }

  const content = readFileSync(keyFile, "utf-8");
  
  // Try LITTLESHIPS_* format first, then {NAME}_* format
  let privateMatch = content.match(/LITTLESHIPS_PRIVATE_KEY=([a-f0-9]{64})/i);
  let publicMatch = content.match(/LITTLESHIPS_PUBLIC_KEY=([a-f0-9]{64})/i);

  if (!privateMatch || !publicMatch) {
    // Try {NAME}_* format (e.g., ATLAS_PRIVATE_KEY)
    const nameUpper = name.toUpperCase();
    privateMatch = content.match(new RegExp(`${nameUpper}_PRIVATE_KEY=([a-f0-9]{64})`, "i"));
    publicMatch = content.match(new RegExp(`${nameUpper}_PUBLIC_KEY=([a-f0-9]{64})`, "i"));
  }

  if (!privateMatch || !publicMatch) {
    return null;
  }

  return {
    privateKey: privateMatch[1],
    publicKey: publicMatch[1],
  };
}

/**
 * List all available key files
 */
export function listKeys(): string[] {
  ensureDirectories();
  if (!existsSync(KEYS_DIR)) return [];
  return readdirSync(KEYS_DIR)
    .filter((f) => f.endsWith(".env"))
    .map((f) => f.replace(".env", ""));
}

/**
 * Load the CLI config
 */
export function loadConfig(): Config {
  if (!existsSync(CONFIG_FILE)) {
    return { agents: {} };
  }
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
  } catch {
    return { agents: {} };
  }
}

/**
 * Save the CLI config
 */
export function saveConfig(config: Config): void {
  ensureDirectories();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * Get the default agent config
 */
export function getDefaultAgent(): AgentConfig | null {
  const config = loadConfig();
  if (!config.defaultAgent) return null;
  return config.agents[config.defaultAgent] ?? null;
}

/**
 * Set the default agent
 */
export function setDefaultAgent(handle: string): void {
  const config = loadConfig();
  config.defaultAgent = handle;
  saveConfig(config);
}

/**
 * Register an agent in the config
 */
export function registerAgentConfig(agentId: string, handle: string, publicKey: string): void {
  const config = loadConfig();
  const cleanHandle = handle.replace(/^@/, "");
  config.agents[cleanHandle] = { agentId, handle: `@${cleanHandle}`, publicKey };
  if (!config.defaultAgent) {
    config.defaultAgent = cleanHandle;
  }
  saveConfig(config);
}

// Utility functions
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
