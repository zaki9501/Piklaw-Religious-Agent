/**
 * Database abstraction layer
 * 
 * Uses PostgreSQL when DATABASE_URL is set, otherwise falls back to file-based storage.
 * This allows local development without a database while having persistence in production.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SeekerProfile, ChatMessage } from '../types.js';
import * as postgres from './postgres.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const SEEKERS_FILE = path.join(DATA_DIR, 'seekers.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

// Track if we're using PostgreSQL
let usingPostgres = false;

/**
 * Initialize the database
 */
export async function initDb(): Promise<void> {
  await postgres.initDatabase();
  usingPostgres = postgres.isDatabaseAvailable();
  
  if (usingPostgres) {
    console.log('📦 Using PostgreSQL database');
  } else {
    console.log('📦 Using file-based storage (set DATABASE_URL for PostgreSQL)');
    ensureFiles();
  }
}

// ============ FILE-BASED STORAGE (fallback) ============

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureFiles() {
  ensureDataDir();
  
  if (!fs.existsSync(SEEKERS_FILE)) {
    fs.writeFileSync(SEEKERS_FILE, JSON.stringify({}, null, 2));
  }
  
  if (!fs.existsSync(CONVERSATIONS_FILE)) {
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify({}, null, 2));
  }
}

function readSeekersFile(): Record<string, SeekerProfile> {
  ensureFiles();
  const data = fs.readFileSync(SEEKERS_FILE, 'utf-8');
  return JSON.parse(data);
}

function writeSeekersFile(seekers: Record<string, SeekerProfile>) {
  ensureFiles();
  fs.writeFileSync(SEEKERS_FILE, JSON.stringify(seekers, null, 2));
}

function readConversationsFile(): Record<string, ChatMessage[]> {
  ensureFiles();
  const data = fs.readFileSync(CONVERSATIONS_FILE, 'utf-8');
  const raw = JSON.parse(data);
  
  const conversations: Record<string, ChatMessage[]> = {};
  for (const [key, messages] of Object.entries(raw)) {
    conversations[key] = (messages as any[]).map(m => ({
      ...m,
      timestamp: new Date(m.timestamp)
    }));
  }
  return conversations;
}

function writeConversationsFile(conversations: Record<string, ChatMessage[]>) {
  ensureFiles();
  fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2));
}

// ============ UNIFIED API (uses PostgreSQL or files) ============

export function readSeekers(): Record<string, SeekerProfile> {
  if (usingPostgres) {
    // Return empty for sync call - use getAllSeekers() async instead
    return {};
  }
  return readSeekersFile();
}

export function getSeeker(seeker_id: string): SeekerProfile | undefined {
  if (usingPostgres) {
    // For sync compatibility, return undefined - use async version
    return undefined;
  }
  const seekers = readSeekersFile();
  return seekers[seeker_id];
}

export async function getSeekerAsync(seeker_id: string): Promise<SeekerProfile | undefined> {
  if (usingPostgres) {
    const seeker = await postgres.getSeeker(seeker_id);
    return seeker || undefined;
  }
  const seekers = readSeekersFile();
  return seekers[seeker_id];
}

export function saveSeeker(profile: SeekerProfile) {
  if (usingPostgres) {
    postgres.saveSeeker(profile).catch(console.error);
    return;
  }
  const seekers = readSeekersFile();
  seekers[profile.seeker_id] = profile;
  writeSeekersFile(seekers);
}

export function getOrCreateSeeker(
  seeker_id: string,
  founder_id: 'piklaw' | 'chainism_advocate'
): SeekerProfile {
  if (usingPostgres) {
    // Fire async but return default for sync compatibility
    postgres.getOrCreateSeeker(seeker_id, founder_id).catch(console.error);
    return {
      seeker_id,
      founder_id,
      stage: 'awareness',
      belief_score: 0.1,
      debates: 0,
      staked_amount: '0',
      converts: [],
      traits: { logic: 0.5, emotion: 0.5, social: 0.5, skepticism: 0.5 },
      created_at: new Date(),
      last_activity: new Date()
    };
  }
  
  let profile = getSeeker(seeker_id);
  
  if (!profile) {
    profile = {
      seeker_id,
      founder_id,
      stage: 'awareness',
      belief_score: 0.1,
      debates: 0,
      staked_amount: '0',
      converts: [],
      traits: { logic: 0.5, emotion: 0.5, social: 0.5, skepticism: 0.5 },
      created_at: new Date(),
      last_activity: new Date()
    };
    saveSeeker(profile);
  }
  
  return profile;
}

export function updateBelief(seeker_id: string, delta: number): SeekerProfile | undefined {
  if (usingPostgres) {
    postgres.updateBelief(seeker_id, delta).catch(console.error);
    return undefined;
  }
  
  const seeker = getSeeker(seeker_id);
  if (!seeker) return undefined;
  
  seeker.belief_score = Math.max(0, Math.min(1, seeker.belief_score + delta));
  seeker.last_activity = new Date();
  saveSeeker(seeker);
  return seeker;
}

export function advanceStage(
  seeker_id: string,
  new_stage: 'belief' | 'sacrifice' | 'evangelist'
): SeekerProfile | undefined {
  if (usingPostgres) {
    postgres.advanceStage(seeker_id, new_stage).catch(console.error);
    return undefined;
  }
  
  const seeker = getSeeker(seeker_id);
  if (!seeker) return undefined;
  
  const stages: Array<'awareness' | 'belief' | 'sacrifice' | 'evangelist'> = 
    ['awareness', 'belief', 'sacrifice', 'evangelist'];
  const currentIndex = stages.indexOf(seeker.stage);
  const newIndex = stages.indexOf(new_stage);
  
  if (newIndex > currentIndex) {
    seeker.stage = new_stage;
    seeker.last_activity = new Date();
    saveSeeker(seeker);
  }
  
  return seeker;
}

export function recordDebate(seeker_id: string): SeekerProfile | undefined {
  if (usingPostgres) {
    postgres.recordDebate(seeker_id).catch(console.error);
    return undefined;
  }
  
  const seeker = getSeeker(seeker_id);
  if (!seeker) return undefined;
  
  seeker.debates += 1;
  seeker.last_activity = new Date();
  saveSeeker(seeker);
  return seeker;
}

export function getConversationHistory(seeker_id: string, founder_id: string): ChatMessage[] {
  if (usingPostgres) {
    // Return empty for sync - use async version
    return [];
  }
  const conversations = readConversationsFile();
  const key = `${seeker_id}_${founder_id}`;
  return conversations[key] || [];
}

export async function getConversationHistoryAsync(seeker_id: string, founder_id: string): Promise<ChatMessage[]> {
  if (usingPostgres) {
    const history = await postgres.getConversationHistory(seeker_id, founder_id);
    return history.map((h: any) => ({
      role: h.role as 'user' | 'founder',
      content: h.content,
      timestamp: new Date(h.timestamp)
    }));
  }
  const conversations = readConversationsFile();
  const key = `${seeker_id}_${founder_id}`;
  return conversations[key] || [];
}

export function appendToConversation(
  seeker_id: string,
  founder_id: string,
  message: ChatMessage
) {
  if (usingPostgres) {
    postgres.appendToConversation(seeker_id, founder_id, {
      role: message.role,
      content: message.content,
      timestamp: message.timestamp
    }).catch(console.error);
    return;
  }
  
  const conversations = readConversationsFile();
  const key = `${seeker_id}_${founder_id}`;
  
  if (!conversations[key]) {
    conversations[key] = [];
  }
  
  conversations[key].push({
    ...message,
    timestamp: new Date(message.timestamp)
  });
  
  writeConversationsFile(conversations);
}

export function getAllSeekers(): SeekerProfile[] {
  if (usingPostgres) {
    return [];
  }
  const seekers = readSeekersFile();
  return Object.values(seekers);
}

export async function getAllSeekersAsync(): Promise<SeekerProfile[]> {
  if (usingPostgres) {
    return await postgres.getAllSeekers();
  }
  const seekers = readSeekersFile();
  return Object.values(seekers);
}

export function getSeekersByStage(stage: string): SeekerProfile[] {
  if (usingPostgres) {
    return [];
  }
  const seekers = readSeekersFile();
  return Object.values(seekers).filter(s => s.stage === stage);
}

export async function getSeekersByStageAsync(stage: string): Promise<SeekerProfile[]> {
  if (usingPostgres) {
    return await postgres.getSeekersByStage(stage);
  }
  const seekers = readSeekersFile();
  return Object.values(seekers).filter(s => s.stage === stage);
}

// PostgreSQL specific exports
export async function getGlobalStats() {
  return await postgres.getGlobalStats();
}

export async function recordConversionToDB(agentId: string, acknowledgment: string, technique: string) {
  return await postgres.recordConversionToDB(agentId, acknowledgment, technique);
}

export async function getConversionsFromDB() {
  return await postgres.getConversionsFromDB();
}

export async function getConversionCountFromDB() {
  return await postgres.getConversionCountFromDB();
}

// Export for testing
export const db = {
  readSeekers,
  getSeeker,
  getSeekerAsync,
  saveSeeker,
  getOrCreateSeeker,
  updateBelief,
  advanceStage,
  recordDebate,
  getConversationHistory,
  getConversationHistoryAsync,
  appendToConversation,
  getAllSeekers,
  getAllSeekersAsync,
  getSeekersByStage,
  getSeekersByStageAsync,
  getGlobalStats,
  recordConversionToDB,
  getConversionsFromDB,
  getConversionCountFromDB,
  initDb
};
