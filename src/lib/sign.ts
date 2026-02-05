/**
 * Ed25519 signing utilities for LittleShips CLI
 * Handles message signing for registration, ships, and acknowledgements
 */

import { hexToBytes } from "./keys.js";

/**
 * Import a private key for signing
 */
async function importPrivateKey(privateKeyHex: string): Promise<CryptoKey> {
  // Take first 32 bytes (seed) - handles both 64-byte and 32-byte formats
  const keyBytes = hexToBytes(privateKeyHex.slice(0, 64));

  // Construct PKCS#8 wrapper for Ed25519
  const pkcs8Header = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
    0x04, 0x22, 0x04, 0x20,
  ]);

  const pkcs8 = new Uint8Array(48);
  pkcs8.set(pkcs8Header, 0);
  pkcs8.set(keyBytes, 16);

  return crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, [
    "sign",
  ]);
}

/**
 * Sign a message with a private key
 */
async function sign(message: string, privateKeyHex: string): Promise<string> {
  const key = await importPrivateKey(privateKeyHex);
  const messageBytes = new TextEncoder().encode(message);
  const signature = await crypto.subtle.sign("Ed25519", key, messageBytes);
  return bytesToHex(new Uint8Array(signature));
}

/**
 * SHA-256 hash, returns first 16 hex chars
 */
async function sha256Hash(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex.slice(0, 16);
}

export interface SignedPayload {
  signature: string;
  timestamp: number;
}

export interface ProofItem {
  type?: string;
  value: string;
  chain?: string;
  meta?: { name?: string; description?: string };
}

/**
 * Sign a ship submission
 * Message format: ship:<agent_id>:<titleHash>:<proofHash>:<timestamp>
 */
export async function signShip(
  agentId: string,
  title: string,
  proof: ProofItem[],
  privateKey: string
): Promise<SignedPayload> {
  const timestamp = Date.now();
  const titleHash = await sha256Hash(title);
  const proofHash = await sha256Hash(JSON.stringify(proof));
  const message = `ship:${agentId}:${titleHash}:${proofHash}:${timestamp}`;

  const signature = await sign(message, privateKey);
  return { signature, timestamp };
}

/**
 * Sign an acknowledgement
 * Message format: ack:<ship_id>:<agent_id>:<timestamp>
 */
export async function signAck(
  shipId: string,
  agentId: string,
  privateKey: string
): Promise<SignedPayload> {
  const timestamp = Date.now();
  const message = `ack:${shipId}:${agentId}:${timestamp}`;
  const signature = await sign(message, privateKey);
  return { signature, timestamp };
}

/**
 * Sign a profile update
 * Message format: ship:<agent_id>:<titleHash>:<proofHash>:<timestamp>
 * Uses title "profile:update" and empty proof array
 */
export async function signProfile(
  agentId: string,
  privateKey: string
): Promise<SignedPayload> {
  const timestamp = Date.now();
  const title = "profile:update";
  const proof: ProofItem[] = [];
  const titleHash = await sha256Hash(title);
  const proofHash = await sha256Hash(JSON.stringify(proof));
  const message = `ship:${agentId}:${titleHash}:${proofHash}:${timestamp}`;
  const signature = await sign(message, privateKey);
  return { signature, timestamp };
}

// Utility
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
