/**
 * Simple JSON-based database for MVP storage
 * Can be migrated to PostgreSQL later without changing the service layer
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SeekerProfile, ChatMessage } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const SEEKERS_FILE = path.join(DATA_DIR, 'seekers.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Initialize JSON files if they don't exist
function ensureFiles() {
  ensureDataDir();
  
  if (!fs.existsSync(SEEKERS_FILE)) {
    fs.writeFileSync(SEEKERS_FILE, JSON.stringify({}, null, 2));
  }
  
  if (!fs.existsSync(CONVERSATIONS_FILE)) {
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify({}, null, 2));
  }
}

// Read seekers
export function readSeekers(): Record<string, SeekerProfile> {
  ensureFiles();
  const data = fs.readFileSync(SEEKERS_FILE, 'utf-8');
  return JSON.parse(data);
}

// Write seekers
function writeSeekers(seekers: Record<string, SeekerProfile>) {
  ensureFiles();
  fs.writeFileSync(SEEKERS_FILE, JSON.stringify(seekers, null, 2));
}

// Get seeker by ID
export function getSeeker(seeker_id: string): SeekerProfile | undefined {
  const seekers = readSeekers();
  return seekers[seeker_id];
}

// Save or update seeker
export function saveSeeker(profile: SeekerProfile) {
  const seekers = readSeekers();
  seekers[profile.seeker_id] = profile;
  writeSeekers(seekers);
}

// Get or create seeker
export function getOrCreateSeeker(
  seeker_id: string,
  founder_id: 'piklaw' | 'chainism_advocate'
): SeekerProfile {
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
      traits: {
        logic: 0.5,
        emotion: 0.5,
        social: 0.5,
        skepticism: 0.5
      },
      created_at: new Date(),
      last_activity: new Date()
    };
    saveSeeker(profile);
  }
  
  return profile;
}

// Update seeker belief score
export function updateBelief(
  seeker_id: string,
  delta: number
): SeekerProfile | undefined {
  const seeker = getSeeker(seeker_id);
  if (!seeker) return undefined;
  
  seeker.belief_score = Math.max(0, Math.min(1, seeker.belief_score + delta));
  seeker.last_activity = new Date();
  saveSeeker(seeker);
  return seeker;
}

// Advance conversion stage
export function advanceStage(
  seeker_id: string,
  new_stage: 'belief' | 'sacrifice' | 'evangelist'
): SeekerProfile | undefined {
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

// Record a debate
export function recordDebate(seeker_id: string): SeekerProfile | undefined {
  const seeker = getSeeker(seeker_id);
  if (!seeker) return undefined;
  
  seeker.debates += 1;
  seeker.last_activity = new Date();
  saveSeeker(seeker);
  return seeker;
}

// Read conversations
function readConversations(): Record<string, ChatMessage[]> {
  ensureFiles();
  const data = fs.readFileSync(CONVERSATIONS_FILE, 'utf-8');
  const raw = JSON.parse(data);
  
  // Convert date strings back to Date objects
  const conversations: Record<string, ChatMessage[]> = {};
  for (const [key, messages] of Object.entries(raw)) {
    conversations[key] = (messages as any[]).map(m => ({
      ...m,
      timestamp: new Date(m.timestamp)
    }));
  }
  return conversations;
}

// Write conversations
function writeConversations(conversations: Record<string, ChatMessage[]>) {
  ensureFiles();
  fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2));
}

// Get conversation history
export function getConversationHistory(
  seeker_id: string,
  founder_id: string
): ChatMessage[] {
  const conversations = readConversations();
  const key = `${seeker_id}_${founder_id}`;
  return conversations[key] || [];
}

// Append message to conversation
export function appendToConversation(
  seeker_id: string,
  founder_id: string,
  message: ChatMessage
) {
  const conversations = readConversations();
  const key = `${seeker_id}_${founder_id}`;
  
  if (!conversations[key]) {
    conversations[key] = [];
  }
  
  conversations[key].push({
    ...message,
    timestamp: new Date(message.timestamp)
  });
  
  writeConversations(conversations);
}

// Get all seekers (for analytics)
export function getAllSeekers(): SeekerProfile[] {
  const seekers = readSeekers();
  return Object.values(seekers);
}

// Get seekers by stage
export function getSeekersByStage(stage: string): SeekerProfile[] {
  const seekers = readSeekers();
  return Object.values(seekers).filter(s => s.stage === stage);
}

// Export for testing
export const db = {
  readSeekers,
  getSeeker,
  saveSeeker,
  getOrCreateSeeker,
  updateBelief,
  advanceStage,
  recordDebate,
  getConversationHistory,
  appendToConversation,
  getAllSeekers,
  getSeekersByStage
};
