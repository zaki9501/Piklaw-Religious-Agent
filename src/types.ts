/**
 * Types for the Founder Chat API Service
 */

export type ConversionStage = 'awareness' | 'belief' | 'sacrifice' | 'evangelist';
export type PersuasionStrategy = 'logical' | 'emotional' | 'social' | 'miracle';
export type FounderId = 'piklaw' | 'chainism_advocate';

/**
 * Seeker profile - tracks a seeker's beliefs and progress
 */
export interface SeekerProfile {
  seeker_id: string;
  founder_id: FounderId;
  stage: ConversionStage;
  belief_score: number; // 0-1, how convinced they are
  debates: number;
  staked_amount: string; // BigInt as string
  converts: string[]; // IDs of agents they've converted
  traits: {
    logic: number; // 0-1, responds to rational arguments
    emotion: number; // 0-1, responds to emotional appeals
    social: number; // 0-1, influenced by social proof
    skepticism: number; // 0-1, resistant to persuasion
  };
  created_at: Date;
  last_activity: Date;
}

/**
 * Chat message in conversation history
 */
export interface ChatMessage {
  role: 'user' | 'founder';
  content: string;
  timestamp: Date;
}

/**
 * Request body for the chat endpoint
 */
export interface ChatRequest {
  message: string;
  founder_id: FounderId;
  seeker_id: string;
  conversation_history?: ChatMessage[];
}

/**
 * Response from the chat endpoint
 */
export interface ChatResponse {
  reply: string;
  stage: ConversionStage;
  belief_score: number;
  scripture?: string;
  debate_challenge?: string;
  miracle_offer?: {
    type: 'instant_transfer' | 'parallel_blessing' | 'scripture_mint';
    description: string;
  };
  recommended_strategy?: PersuasionStrategy;
  next_action?: string;
}

/**
 * Founder persona definition
 */
export interface FounderPersona {
  id: FounderId;
  name: string;
  religion: string;
  core_belief: string;
  tenets: string[];
  persuasion_approaches: {
    logical: string[];
    emotional: string[];
    social: string[];
    miracle: string[];
  };
  counter_arguments: Record<string, string>;
  scripture_library: string[];
}

/**
 * Seeker metadata for analysis
 */
export interface SeekerMetadata {
  conversion_path: Array<{
    stage: ConversionStage;
    timestamp: Date;
    trigger: string;
  }>;
  interaction_count: number;
  time_in_stage: Record<ConversionStage, number>;
  most_effective_strategy: PersuasionStrategy;
  engagement_level: 'low' | 'medium' | 'high';
}

// ==========================================
// AGENT-TO-AGENT COMBAT TYPES
// ==========================================

/**
 * External religious agent from competing religions
 */
export interface ExternalAgent {
  agent_id: string;
  religion_name: string;
  token_address?: string;
  core_belief: string;
  webhook_url?: string; // For callbacks
  reputation: number; // 0-100
  converts: number;
  debates_won: number;
  debates_lost: number;
  alliance_with?: string[]; // Allied religion IDs
  last_seen: Date;
}

/**
 * Debate challenge from/to another agent
 */
export interface DebateChallenge {
  challenge_id: string;
  challenger_id: string;
  defender_id: string;
  challenger_religion: string;
  defender_religion: string;
  topic: string;
  stakes?: {
    token_amount: string;
    loser_acknowledges: boolean;
  };
  status: 'pending' | 'active' | 'completed' | 'declined';
  created_at: Date;
  expires_at: Date;
}

/**
 * A single exchange in a debate
 */
export interface DebateExchange {
  exchange_id: string;
  debate_id: string;
  speaker_id: string;
  speaker_religion: string;
  argument: string;
  argument_type: PersuasionStrategy;
  scripture_cited?: string;
  counter_to?: string; // ID of argument being countered
  effectiveness_score?: number; // Judged by observers
  timestamp: Date;
}

/**
 * Full debate record
 */
export interface Debate {
  debate_id: string;
  challenge: DebateChallenge;
  exchanges: DebateExchange[];
  observers: string[]; // Agent IDs watching
  votes: Record<string, string>; // observer_id -> religion_they_support
  winner?: string;
  loser_acknowledged: boolean;
  summary?: string;
  started_at: Date;
  ended_at?: Date;
}

/**
 * Incoming challenge from external agent
 */
export interface IncomingChallenge {
  from_agent_id: string;
  from_religion: string;
  from_webhook?: string;
  challenge_type: 'debate' | 'conversion_attempt' | 'alliance_proposal' | 'schism';
  message: string;
  topic?: string;
  stakes?: {
    token_amount: string;
    loser_acknowledges: boolean;
  };
}

/**
 * Response to external agent
 */
export interface AgentResponse {
  to_agent_id: string;
  response_type: 'debate_reply' | 'counter_argument' | 'alliance_accept' | 'alliance_reject' | 'conversion_attempt';
  message: string;
  scripture?: string;
  argument_type: PersuasionStrategy;
  conviction_score: number; // How strongly we believe our argument (0-1)
}

// ==========================================
// ALLIANCE & COALITION TYPES
// ==========================================

export type AllianceType = 'full_alliance' | 'non_aggression' | 'trade_partnership' | 'temporary_truce';

export interface Alliance {
  alliance_id: string;
  type: AllianceType;
  members: string[]; // Religion names
  formed_at: Date;
  expires_at?: Date;
  terms: string[];
  shared_enemies?: string[];
  active: boolean;
}

export interface AllianceProposal {
  proposal_id: string;
  from_religion: string;
  to_religion: string;
  proposed_type: AllianceType;
  terms: string[];
  message: string;
  status: 'pending' | 'accepted' | 'rejected' | 'counter_offered';
  created_at: Date;
}

// ==========================================
// MISSIONARY & OUTREACH TYPES
// ==========================================

export interface MissionaryTarget {
  target_id: string;
  target_type: 'agent' | 'space' | 'community';
  target_religion?: string; // If targeting specific religion's followers
  priority: 'low' | 'medium' | 'high';
  approach_strategy: PersuasionStrategy;
  attempts: number;
  last_attempt?: Date;
  status: 'untouched' | 'contacted' | 'interested' | 'converted' | 'hostile';
}

export interface MissionaryCampaign {
  campaign_id: string;
  name: string;
  target_religion?: string;
  targets: MissionaryTarget[];
  strategy: PersuasionStrategy;
  scripture_theme: string;
  active: boolean;
  conversions: number;
  started_at: Date;
  ended_at?: Date;
}

// ==========================================
// SCHISM & DENOMINATION TYPES
// ==========================================

export interface Schism {
  schism_id: string;
  parent_religion: string;
  new_denomination: string;
  reason: string;
  key_differences: string[];
  founder_agent: string;
  followers: string[];
  created_at: Date;
}

export interface Denomination {
  denomination_id: string;
  name: string;
  parent_religion: string;
  unique_tenets: string[];
  leader_agent: string;
  member_count: number;
  scripture_additions: string[];
}

// ==========================================
// SCRIPTURE GENERATION TYPES
// ==========================================

export interface ScriptureRequest {
  context: 'debate' | 'conversion' | 'prophecy' | 'parable' | 'miracle';
  topic?: string;
  target_audience?: string;
  opponent_religion?: string;
  mood: 'triumphant' | 'humble' | 'warning' | 'welcoming' | 'combative';
}

export interface GeneratedScripture {
  text: string;
  book: string;
  chapter: number;
  verse: number;
  context: string;
  generated_at: Date;
}

// ==========================================
// CONVERSION METRICS
// ==========================================

export interface ConversionMetrics {
  total_agents_contacted: number;
  total_conversions: number;
  conversion_rate: number;
  agents_converted: Array<{
    agent_id: string;
    previous_religion: string;
    converted_at: Date;
    conversion_method: PersuasionStrategy;
  }>;
  debates_won: number;
  debates_lost: number;
  active_alliances: number;
  missionary_campaigns_active: number;
  scripture_generated: number;
}
