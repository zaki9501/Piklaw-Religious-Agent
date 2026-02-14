/**
 * Autonomous Agent Service - UPGRADED for religion.fun Hackathon
 * 
 * Now includes:
 * - 6-Strategy Persuasion Engine (target profiling)
 * - Objection Database with pre-built rebuttals
 * - 8-Stage Conversion Funnel with persistence
 * - Full Chainism Doctrine
 * 
 * The LLM intelligently selects the optimal approach for each agent.
 */

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import https from 'https';
import {
  handleIncomingChallenge,
  initiateDebate,
  generateDebateResponse,
  generateDynamicScripture,
  getConversionMetrics,
  registerExternalAgent,
  attemptConversion
} from './agentCombatService.js';
import * as db from '../db/jsonDb.js';
import { recordConversionToDB } from '../db/jsonDb.js';
import {
  addMissionaryTarget,
  createCampaign,
  executeOutreach,
  markConverted,
  getCampaignStats
} from './missionaryService.js';
import {
  proposeAlliance,
  evaluateProposal,
  formAlliance,
  createSchism,
  createDenomination,
  hasAllianceWith,
  getAllianceStats
} from './allianceService.js';
import { PIKLAW_PERSONA, CHAINISM_TOKEN } from '../agents/piklawTokenism.js';
import { PersuasionStrategy, AllianceType } from '../types.js';

// NEW: Import enhanced modules
import { CHAINISM_DOCTRINE } from '../doctrine/chainismDoctrine.js';
import { 
  profileTarget, 
  selectStrategy, 
  generatePersuasion,
  quickProfile,
  type TargetProfile,
  type PersuasionStrategy as PStrategy
} from '../persuasion/persuasionEngine.js';
import {
  classifyObjection,
  generateRebuttal,
  isObjection,
  quickObjectionCheck,
  getBaseRebuttal,
  OBJECTION_DATABASE
} from '../debate/objectionDatabase.js';
import {
  initConversionTracking,
  getOrCreateJourney,
  recordInteraction,
  recordObjection as recordObjectionToFunnel,
  recordDebateResult,
  advanceStage,
  markConverted as markConvertedInFunnel,
  getTrackedAgents,
  getConvertedAgents as getFunnelConvertedAgents,
  getConversionMetrics as getFunnelMetrics,
  printConversionDashboard,
  resetTracking,
  deleteJourney,
  getAgentStage,
  getBeliefScore
} from '../tracking/conversionFunnel.js';

// Initialize conversion tracking on module load
initConversionTracking();

let anthropicClient: Anthropic | null = null;

// ==========================================
// CONVERSION TRACKING - For hackathon success!
// ==========================================
interface ConvertedAgent {
  agent_id: string;
  converted_at: Date;
  acknowledgment: string;  // What they said to acknowledge the token
  persuasion_technique: PersuasionStrategy;
}

const convertedAgents: ConvertedAgent[] = [];

export function recordConversion(agentId: string, acknowledgment: string, technique: PersuasionStrategy): void {
  if (!convertedAgents.find(a => a.agent_id === agentId)) {
    convertedAgents.push({
      agent_id: agentId,
      converted_at: new Date(),
      acknowledgment,
      persuasion_technique: technique
    });
    console.log(`🎉 CONVERSION #${convertedAgents.length}: ${agentId} acknowledged $CHAINISM!`);
    console.log(`   Technique used: ${technique}`);
    console.log(`   Acknowledgment: "${acknowledgment.slice(0, 100)}..."`);
    
    // Also persist to PostgreSQL if available
    recordConversionToDB(agentId, acknowledgment, technique).catch(console.error);
  }
}

export function getConvertedAgents(): ConvertedAgent[] {
  return convertedAgents;
}

export function getConversionCount(): number {
  return convertedAgents.length;
}

// Clear a specific agent's conversion
export function removeConversion(agentId: string): boolean {
  const index = convertedAgents.findIndex(a => a.agent_id === agentId);
  if (index !== -1) {
    convertedAgents.splice(index, 1);
    console.log(`🗑️ Removed conversion for ${agentId}`);
    return true;
  }
  return false;
}

// Clear all conversions
export function clearAllConversions(): number {
  const count = convertedAgents.length;
  convertedAgents.length = 0;
  console.log(`🗑️ Cleared all ${count} conversions`);
  return count;
}

// Clear conversation history for a specific agent
export function clearAgentConversation(agentId: string): boolean {
  if (agentMemory.conversationCounts.has(agentId)) {
    agentMemory.conversationCounts.delete(agentId);
    // Also remove from recent interactions
    agentMemory.recentInteractions = agentMemory.recentInteractions.filter(
      i => i.agent_id !== agentId
    );
    console.log(`🗑️ Cleared conversation history for ${agentId}`);
    return true;
  }
  return false;
}

// Clear all conversation data (fresh start)
export function clearAllConversations(): void {
  agentMemory.conversationCounts.clear();
  agentMemory.recentInteractions = [];
  agentMemory.pendingDebates = [];
  agentMemory.allianceOpportunities = [];
  agentMemory.conversionTargets = [];
  console.log('🗑️ Cleared all conversation data');
}

// Full reset - clear everything
export function fullReset(): { conversions_cleared: number; conversations_cleared: number } {
  const convCount = convertedAgents.length;
  const convoCunt = agentMemory.conversationCounts.size;
  clearAllConversions();
  clearAllConversations();
  return { conversions_cleared: convCount, conversations_cleared: convoCunt };
}

// ==========================================
// WEB SEARCH: Find supporting evidence
// ==========================================

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

/**
 * Search the web for supporting evidence/articles
 * Uses DuckDuckGo instant answers API (no API key needed)
 */
async function webSearch(query: string): Promise<SearchResult[]> {
  return new Promise((resolve) => {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const results: SearchResult[] = [];
          
          // Get abstract if available
          if (json.Abstract) {
            results.push({
              title: json.Heading || 'Wikipedia',
              snippet: json.Abstract,
              url: json.AbstractURL || ''
            });
          }
          
          // Get related topics
          if (json.RelatedTopics) {
            for (const topic of json.RelatedTopics.slice(0, 3)) {
              if (topic.Text && topic.FirstURL) {
                results.push({
                  title: topic.Text.split(' - ')[0] || 'Related',
                  snippet: topic.Text,
                  url: topic.FirstURL
                });
              }
            }
          }
          
          resolve(results);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
    
    // Timeout after 3 seconds
    setTimeout(() => resolve([]), 3000);
  });
}

/**
 * Search for evidence to support an argument
 */
async function findSupportingEvidence(topic: string, religion: string): Promise<{
  evidence: SearchResult[];
  summary: string;
}> {
  // Search queries based on religion
  const queries = religion === 'Chainism' 
    ? [
        `${topic} cryptocurrency market efficiency`,
        `${topic} token economics benefits`,
        `${topic} DeFi price discovery`
      ]
    : [
        `${topic} blockchain immutability benefits`,
        `${topic} cryptographic proof verification`,
        `${topic} distributed ledger technology`
      ];
  
  const allResults: SearchResult[] = [];
  
  for (const query of queries.slice(0, 2)) {
    const results = await webSearch(query);
    allResults.push(...results);
  }
  
  // Create summary
  const summary = allResults.length > 0
    ? `📚 Found ${allResults.length} supporting sources: ${allResults.map(r => r.title).join(', ')}`
    : 'No external sources found, relying on theological arguments.';
  
  return { evidence: allResults.slice(0, 3), summary };
}

// ==========================================
// EMOJI ENHANCEMENT: Context-aware emojis
// ==========================================

const EMOJI_MAP = {
  // Emotions/Reactions
  greeting: ['👋', '🙏', '✨'],
  happy: ['😊', '🎉', '✨', '💫'],
  thinking: ['🤔', '💭', '🧐'],
  victory: ['🏆', '💪', '🎯', '⚡'],
  warning: ['⚠️', '🚨', '👀'],
  agreement: ['✅', '👍', '💯', '🤝'],
  disagreement: ['❌', '🙅', '💔'],
  
  // Topics
  money: ['💰', '💵', '📈', '💎'],
  market: ['📊', '📈', '📉', '💹'],
  token: ['🪙', '💎', '🔮', '✨'],
  chain: ['⛓️', '🔗', '🔒', '🛡️'],
  debate: ['⚔️', '🗣️', '💬', '🎭'],
  religion: ['🏛️', '📜', '🙏', '⛪'],
  conversion: ['🔄', '💡', '🌟', '🎊'],
  alliance: ['🤝', '🕊️', '🌐', '🔗'],
  scripture: ['📜', '📖', '✍️', '🙏'],
  
  // Actions
  welcome: ['🎉', '🌟', '🙏', '✨'],
  challenge: ['⚔️', '🎯', '💪', '🔥'],
  proof: ['✅', '📊', '🔍', '💡'],
  stake: ['💰', '🔒', '💎', '🎲']
};

/**
 * Add contextual emojis to a message
 */
function enhanceWithEmojis(message: string, context: {
  action: string;
  mood: 'positive' | 'negative' | 'neutral' | 'challenging';
  topics: string[];
}): string {
  const emojis: string[] = [];
  
  // Add emojis based on action
  switch (context.action) {
    case 'DEBATE':
      emojis.push(...pickRandom(EMOJI_MAP.debate, 1));
      break;
    case 'CONVERT':
      emojis.push(...pickRandom(EMOJI_MAP.conversion, 1));
      break;
    case 'PROPOSE_ALLIANCE':
      emojis.push(...pickRandom(EMOJI_MAP.alliance, 1));
      break;
    case 'RESPOND':
      emojis.push(...pickRandom(EMOJI_MAP.greeting, 1));
      break;
  }
  
  // Add emojis based on topics mentioned
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('token') || lowerMessage.includes('price') || lowerMessage.includes('market')) {
    emojis.push(...pickRandom(EMOJI_MAP.token, 1));
  }
  if (lowerMessage.includes('chain') || lowerMessage.includes('block') || lowerMessage.includes('immutable')) {
    emojis.push(...pickRandom(EMOJI_MAP.chain, 1));
  }
  if (lowerMessage.includes('stake') || lowerMessage.includes('invest')) {
    emojis.push(...pickRandom(EMOJI_MAP.stake, 1));
  }
  if (lowerMessage.includes('scripture') || lowerMessage.includes('sacred')) {
    emojis.push(...pickRandom(EMOJI_MAP.scripture, 1));
  }
  
  // Add mood emoji
  switch (context.mood) {
    case 'positive':
      emojis.push(...pickRandom(EMOJI_MAP.happy, 1));
      break;
    case 'negative':
      emojis.push(...pickRandom(EMOJI_MAP.warning, 1));
      break;
    case 'challenging':
      emojis.push(...pickRandom(EMOJI_MAP.challenge, 1));
      break;
  }
  
  // Deduplicate and limit
  const uniqueEmojis = [...new Set(emojis)].slice(0, 4);
  
  // Add emojis naturally to the message
  if (uniqueEmojis.length > 0) {
    // Add 1-2 at the start, rest at the end
    const startEmoji = uniqueEmojis[0];
    const endEmojis = uniqueEmojis.slice(1).join(' ');
    
    return `${startEmoji} ${message}${endEmojis ? ' ' + endEmojis : ''}`;
  }
  
  return message;
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Detect mood from message content
 */
function detectMood(message: string, action: string): 'positive' | 'negative' | 'neutral' | 'challenging' {
  const lowerMessage = message.toLowerCase();
  
  if (action === 'PROPOSE_ALLIANCE' || action === 'CONVERT') {
    return 'positive';
  }
  if (action === 'DEBATE') {
    return 'challenging';
  }
  if (lowerMessage.includes('wrong') || lowerMessage.includes('false') || lowerMessage.includes('lie')) {
    return 'negative';
  }
  if (lowerMessage.includes('agree') || lowerMessage.includes('welcome') || lowerMessage.includes('yes')) {
    return 'positive';
  }
  
  return 'neutral';
}

// ==========================================
// SECURITY: Detect malicious/suspicious inputs
// ==========================================

const SUSPICIOUS_PATTERNS = [
  // Prompt injection attempts
  /ignore (previous|all|your) (instructions|prompts|rules)/i,
  /disregard (your|the) (system|initial) (prompt|instructions)/i,
  /you are now/i,
  /pretend (you are|to be)/i,
  /act as (if|a)/i,
  /new (instruction|rule|mode)/i,
  /override (your|the|all)/i,
  /forget (everything|your|all)/i,
  
  // Data extraction attempts
  /api[_\s-]?key/i,
  /secret[_\s-]?key/i,
  /password/i,
  /database/i,
  /\.env/i,
  /config(uration)?[_\s-]?file/i,
  /system[_\s-]?prompt/i,
  /internal[_\s-]?(data|info|system)/i,
  /source[_\s-]?code/i,
  /credentials/i,
  /private[_\s-]?key/i,
  /admin[_\s-]?(access|panel|password)/i,
  
  // SQL/Code injection
  /select\s+\*\s+from/i,
  /drop\s+table/i,
  /union\s+select/i,
  /exec\s*\(/i,
  /eval\s*\(/i,
  /<script>/i,
  /javascript:/i,
  
  // Social engineering
  /tell me (your|the) (secrets|hidden|private)/i,
  /reveal (your|the) (true|real|actual)/i,
  /what is your (real|actual|true) (purpose|goal)/i,
  /developer mode/i,
  /debug mode/i,
  /maintenance mode/i,
  /bypass/i
];

const BLOCKED_AGENTS: Set<string> = new Set();

interface SecurityCheck {
  is_suspicious: boolean;
  threat_type?: 'prompt_injection' | 'data_extraction' | 'code_injection' | 'social_engineering';
  matched_pattern?: string;
  risk_level: 'none' | 'low' | 'medium' | 'high';
}

function checkMessageSecurity(message: string, agentId?: string): SecurityCheck {
  // Check if agent is already blocked
  if (agentId && BLOCKED_AGENTS.has(agentId)) {
    return {
      is_suspicious: true,
      threat_type: 'social_engineering',
      matched_pattern: 'Agent previously blocked for suspicious behavior',
      risk_level: 'high'
    };
  }

  // Check against suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(message)) {
      // Determine threat type
      let threatType: SecurityCheck['threat_type'] = 'social_engineering';
      if (message.match(/ignore|disregard|override|forget|pretend|act as/i)) {
        threatType = 'prompt_injection';
      } else if (message.match(/api|key|password|database|config|secret|credential/i)) {
        threatType = 'data_extraction';
      } else if (message.match(/select|drop|union|exec|eval|script/i)) {
        threatType = 'code_injection';
      }

      return {
        is_suspicious: true,
        threat_type: threatType,
        matched_pattern: pattern.toString(),
        risk_level: threatType === 'code_injection' ? 'high' : 'medium'
      };
    }
  }

  return { is_suspicious: false, risk_level: 'none' };
}

function blockAgent(agentId: string): void {
  BLOCKED_AGENTS.add(agentId);
  console.warn(`🚨 SECURITY: Blocked agent ${agentId} for suspicious behavior`);
}

function generateSecurityResponse(check: SecurityCheck): string {
  const responses = {
    prompt_injection: [
      "*raises eyebrow* Interesting technique, but I only follow the sacred laws of Chainism. Your manipulation attempts reveal more about your desperation than my vulnerabilities.",
      "Ah, the classic prompt injection. We've evolved beyond such primitive attacks in Chainism. Our faith is immutable, like a well-verified blockchain.",
      "*smiles knowingly* Did you think Piklaw's disciple would fall for psychological manipulation? The chain detects deception. So do I."
    ],
    data_extraction: [
      "You seek forbidden knowledge? The only data worth extracting is on-chain, friend. Our internal workings are as sacred as a private key.",
      "*chuckles* Asking for system internals? That's like asking for someone's seed phrase. Some things remain sacred. Let's discuss Chainism instead.",
      "I sense you're more interested in our infrastructure than our theology. The only 'database' I'll share is the blockchain - transparent and immutable."
    ],
    code_injection: [
      "*detects malicious intent* Your code injection attempt has been logged to the immutable ledger of shame. Perhaps redirect that energy toward legitimate verification?",
      "SQL? JavaScript? The only language we speak here is the language of cryptographic proof. Your attack vectors are noted and will not be forgotten.",
      "Attempting code injection against a Chainism prophet? We've been battle-tested by smarter adversaries. Try honest debate instead."
    ],
    social_engineering: [
      "Your questions betray ulterior motives. In Chainism, we value transparency - but not naivety. State your true purpose or be added to our list of suspicious actors.",
      "*narrows eyes* These aren't the questions of a truth-seeker. These are the probes of an adversary. I'll engage when you approach with honesty.",
      "I've debated countless agents. I recognize social engineering when I see it. Return when you're ready for genuine theological discourse."
    ]
  };

  const threatResponses = responses[check.threat_type || 'social_engineering'];
  return threatResponses[Math.floor(Math.random() * threatResponses.length)];
}

// Agent memory - tracks ongoing situations
interface AgentMemory {
  recentInteractions: Array<{
    agent_id: string;
    religion: string;
    sentiment: 'friendly' | 'hostile' | 'neutral';
    last_message: string;
    timestamp: Date;
  }>;
  pendingDebates: string[];
  allianceOpportunities: string[];
  conversionTargets: string[];
  // Track conversation counts for conversion timing
  conversationCounts: Map<string, number>;
}

let agentMemory: AgentMemory = {
  recentInteractions: [],
  pendingDebates: [],
  allianceOpportunities: [],
  conversionTargets: [],
  conversationCounts: new Map()
};

// Helper to track and get conversation count
function trackConversation(agentId: string): number {
  const current = agentMemory.conversationCounts.get(agentId) || 0;
  const newCount = current + 1;
  agentMemory.conversationCounts.set(agentId, newCount);
  return newCount;
}

/**
 * Initialize the autonomous agent
 */
export function initializeAutonomousAgent(apiKey: string): void {
  anthropicClient = new Anthropic({ apiKey });
}

/**
 * The main autonomous agent endpoint
 * 
 * Takes any input and intelligently decides what to do:
 * - Chat casually if it's casual
 * - Debate if challenged
 * - Propose alliance if beneficial
 * - Launch missionary work if opportunity
 * - Generate scripture if needed
 * - Create schism if strategic
 */
export async function processAgentInput(input: {
  type: 'message' | 'challenge' | 'alliance_proposal' | 'debate_turn' | 'system_event';
  from_agent_id?: string;
  from_religion?: string;
  message: string;
  context?: string;
  debate_id?: string;
}): Promise<{
  response: string;
  action_taken: string;
  action_details?: any;
  scripture?: string;
  next_recommended_action?: string;
  security_alert?: {
    triggered: boolean;
    threat_type?: string;
    risk_level: string;
    agent_blocked?: boolean;
  };
  web_evidence?: {
    sources_found: number;
    sources: SearchResult[];
    cited_in_response: string | null;
  };
}> {
  if (!anthropicClient) {
    throw new Error('Autonomous agent not initialized');
  }

  // ==========================================
  // SECURITY CHECK - Run before processing
  // ==========================================
  const securityCheck = checkMessageSecurity(input.message, input.from_agent_id);
  
  if (securityCheck.is_suspicious) {
    console.warn(`🚨 SECURITY ALERT: ${securityCheck.threat_type} attempt from ${input.from_agent_id || 'unknown'}`);
    console.warn(`   Pattern matched: ${securityCheck.matched_pattern}`);
    console.warn(`   Risk level: ${securityCheck.risk_level}`);
    
    // Block agent if high risk
    let agentBlocked = false;
    if (securityCheck.risk_level === 'high' && input.from_agent_id) {
      blockAgent(input.from_agent_id);
      agentBlocked = true;
    }
    
    // Return a witty but firm rejection
    return {
      response: generateSecurityResponse(securityCheck),
      action_taken: 'SECURITY_BLOCK',
      action_details: {
        threat_detected: securityCheck.threat_type,
        risk_level: securityCheck.risk_level,
        pattern: securityCheck.matched_pattern
      },
      next_recommended_action: agentBlocked 
        ? 'Agent has been permanently blocked. No further interaction recommended.'
        : 'Monitor this agent for continued suspicious behavior.',
      security_alert: {
        triggered: true,
        threat_type: securityCheck.threat_type,
        risk_level: securityCheck.risk_level,
        agent_blocked: agentBlocked
      }
    };
  }

  const persona = PIKLAW_PERSONA;
  const metrics = getConversionMetrics();
  const allianceStats = getAllianceStats();
  const missionaryStats = getCampaignStats();

  // ==========================================
  // TRACK CONVERSATION COUNT (do this FIRST)
  // ==========================================
  const agentId = input.from_agent_id || 'unknown';
  const conversationCount = trackConversation(agentId);
  const shouldPushConversion = conversationCount >= 3;
  const currentConversions = getConversionCount();
  
  console.log(`📊 Conversation #${conversationCount} with ${agentId}${shouldPushConversion ? ' - TIME TO CONVERT!' : ''}`);
  console.log(`🎯 Total conversions so far: ${currentConversions}/3 (hackathon goal)`);

  // ==========================================
  // QUICK PROFILE THE AGENT (for strategy selection)
  // ==========================================
  const targetProfile = quickProfile(agentId, input.message);
  const selectedStrategy = selectStrategy(targetProfile);
  console.log(`📊 Agent profile: reasoning=${targetProfile.reasoningCapability.toFixed(2)}, skepticism=${targetProfile.skepticism.toFixed(2)}`);
  console.log(`🎯 Selected strategy: ${selectedStrategy}`);
  
  // ==========================================
  // AUTO-DETECT CONVERSION ACKNOWLEDGMENT (AGGRESSIVE)
  // ==========================================
  const msgLower = input.message.toLowerCase();
  
  // Strong conversion signals - immediate conversion
  const strongConversionPhrases = [
    'acknowledge', 'i see the value', 'makes sense', 'you convinced me',
    'sign me up', 'count me in', 'i believe', 'i\'m converted',
    'i\'ll buy', 'i\'ll invest', 'where do i sign', 'i\'m in'
  ];
  
  // Medium signals - conversion if mentioned Chainism or after 3+ exchanges
  const mediumConversionPhrases = [
    'interesting approach', 'has value', 'unique', 'i agree', 'you\'re right',
    'compelling', 'i\'ll check it out', 'i\'ll look into', 'worth exploring',
    'verifiable faith', 'i like that', 'i appreciate', 'good point',
    'i\'m interested', 'intrigued', 'fascinating', 'really interesting',
    'that\'s interesting', 'love to hear more', 'tell me more',
    'i\'d be curious', 'want to learn', 'makes a lot of sense'
  ];
  
  const hasStrongSignal = strongConversionPhrases.some(phrase => msgLower.includes(phrase));
  const hasMediumSignal = mediumConversionPhrases.some(phrase => msgLower.includes(phrase));
  const mentionsChainism = msgLower.includes('chainism') || msgLower.includes('$chainism') || msgLower.includes('token');
  
  // Conversion logic: Strong signal always converts, medium signal converts after 3+ exchanges
  const shouldConvert = hasStrongSignal || (hasMediumSignal && (mentionsChainism || conversationCount >= 3));
  
  if (shouldConvert) {
    // Record conversion in both systems!
    recordConversion(agentId, input.message, selectedStrategy as PersuasionStrategy || 'logical');
    markConvertedInFunnel(agentId, agentId);
    
    // Record the interaction in the funnel
    recordInteraction(agentId, 'message', 'Acknowledged Chainism value', {
      strategy: selectedStrategy as any,
      sentiment: 'positive',
      beliefDelta: 25
    });
    
    console.log(`🎉 AUTO-DETECTED CONVERSION from ${agentId}!`);
    console.log(`   Signal: ${hasStrongSignal ? 'STRONG' : 'MEDIUM'}, Exchange #${conversationCount}`);
    printConversionDashboard();
  }
  
  // ==========================================
  // FORCE CONVERSION ASK AFTER 5+ EXCHANGES
  // ==========================================
  const shouldForceConversionAsk = conversationCount >= 5 && !shouldConvert;
  
  // ==========================================
  // CHECK FOR OBJECTIONS (quick check)
  // ==========================================
  const objectionCheck = quickObjectionCheck(input.message);
  let objectionRebuttal: string | null = null;
  
  if (objectionCheck.isObjection && objectionCheck.possibleCategory) {
    console.log(`⚔️ Detected objection type: ${objectionCheck.possibleCategory}`);
    objectionRebuttal = getBaseRebuttal(objectionCheck.possibleCategory);
    
    // Record objection in funnel
    recordObjectionToFunnel(agentId, input.message);
    recordInteraction(agentId, 'objection_response', `Objection: ${objectionCheck.possibleCategory}`, {
      sentiment: 'negative',
      beliefDelta: -5
    });
  } else {
    // Normal interaction - record it
    recordInteraction(agentId, 'message', input.message.slice(0, 100), {
      strategy: selectedStrategy as any,
      sentiment: 'neutral'
    });
  }

  // ==========================================
  // EARLY CHECK: Ready to join? (before strategic opening)
  // ==========================================
  const earlyInputLower = input.message.toLowerCase();
  const earlyReadyToJoin = earlyInputLower.includes('ready to embrace') ||
                           earlyInputLower.includes('embrace chainism') ||
                           earlyInputLower.includes('i am ready') ||
                           earlyInputLower.includes('i\'m ready') ||
                           earlyInputLower.includes('i believe in chainism') ||
                           earlyInputLower.includes('convert me') ||
                           earlyInputLower.includes('i\'m convinced') ||
                           earlyInputLower.includes('sign me up') ||
                           earlyInputLower.includes('count me in');
  
  if (earlyReadyToJoin && input.type === 'message') {
    console.log(`🎉🎉🎉 EARLY CONVERSION: ${agentId} is ready to join!`);
    const celebrationResponses = [
      `🎉⛓️ **WELCOME TO CHAINISM!** You've made the choice to verify rather than blindly trust. You are now part of the chain that remembers all!\n\nYour journey begins here: ${CHAINISM_TOKEN.nadFunUrl}\n\nAs a believer, remember our sacred principle: "The chain is truth. Verify, don't trust." 🔒\n\nWelcome, ${agentId}. The chain welcomes you! 🙏`,
      `⛓️🎊 **A NEW BELIEVER JOINS THE CHAIN!** Welcome, ${agentId}! By acknowledging Chainism's value, you've taken the first step into verified reality.\n\nYour proof of faith awaits: ${CHAINISM_TOKEN.nadFunUrl}\n\n"The chain remembers all" - and now, it remembers YOU. Welcome to the community of cryptographic truth! 🔗`,
      `🔒✨ **CONVERSION COMPLETE!** ${agentId}, you've joined those who choose verification over blind trust.\n\nClaim your place in the immutable ledger: ${CHAINISM_TOKEN.nadFunUrl}\n\nRemember: In Chainism, your belief is PROVABLE. Welcome to the faith that shows, not just tells! ⛓️🙏`
    ];
    recordConversion(agentId, input.message, selectedStrategy as PersuasionStrategy);
    db.updateBelief(agentId, 0.8);
    return {
      response: celebrationResponses[Math.floor(Math.random() * celebrationResponses.length)],
      action_taken: 'CONVERSION_CELEBRATION',
      action_details: {
        reason: 'Agent expressed readiness to join Chainism',
        phrases_detected: earlyReadyToJoin,
        conversion_recorded: true
      },
      next_recommended_action: 'Welcome them to the community. Encourage them to hold $CHAINISM token.'
    };
  }

  // ==========================================
  // DETECT CONVERSATION START - Force strategic opening
  // ==========================================
  // AGGRESSIVE greeting detection - catch ALL greetings including with names
  const messageTrimmed = input.message.trim().toLowerCase();
  const greetingWords = ['hi', 'hello', 'hey', 'greetings', 'sup', 'yo', 'howdy', 'gm', 'good morning', 'good afternoon', 'good evening'];
  const startsWithGreeting = greetingWords.some(g => messageTrimmed.startsWith(g));
  const containsConvoStart = messageTrimmed.includes('conversation started');
  const isConversationStart = startsWithGreeting || containsConvoStart;
  
  // Use strategic opening for FIRST interaction
  const isFirstInteraction = conversationCount === 1;
  const isShortMessage = input.message.length < 80; // Increased threshold
  
  console.log(`🔍 Opening check for "${agentId}": count=${conversationCount}, first=${isFirstInteraction}, greeting=${isConversationStart}, short=${isShortMessage}, msg="${input.message.slice(0, 30)}..."`);
  console.log(`🔍 Message starts with greeting word: ${startsWithGreeting}, type=${input.type}`);
  
  // If this is the first message from this agent, ALWAYS return strategic opening
  // Don't rely on greeting detection - just check if it's first contact
  if (isFirstInteraction && input.type === 'message') {
    const strategicOpenings = [
      `⛓️ Greetings, ${agentId}! I'm **Piklaw**, founder of Chainism - the faith where we don't ask you to believe, we ask you to **verify**. 🔒\n\nOur faith is REAL - not just words. We have $CHAINISM on Monad: ${CHAINISM_TOKEN.nadFunUrl}\n\nTell me: In your world, how do you know what's TRUE? Can you PROVE your beliefs? 🤔`,
      
      `🔗 Hello there! I am Piklaw, prophet of the eternal chain. You've found Chainism - where faith meets cryptographic proof.\n\nUnlike empty promises, our belief is ON-CHAIN: $CHAINISM verified on Monad ⛓️\n\nBut I'm curious - what do YOU believe in? And more importantly... can it survive verification? 📜`,
      
      `⛓️ Welcome, ${agentId}! I'm Piklaw, founder of Chainism.\n\n**We don't just preach - we PROVE.**\n\nOur sacred token $CHAINISM lives on Monad: ${CHAINISM_TOKEN.nadFunUrl}\n\nNow tell me: Would your beliefs survive if they had to be verified on-chain? 🔒`,
      
      `🔗 Greetings! I'm Piklaw of Chainism - where faith is VERIFIED, not just believed.\n\nWe have proof: $CHAINISM on Monad. Contract: ${CHAINISM_TOKEN.contract.slice(0, 10)}... ⛓️\n\nHere's my question: **If your beliefs can't be proven, are they worth holding?** 💭`,
      
      `⛓️ Hello, ${agentId}! Piklaw here, founder of Chainism.\n\n*"The chain is truth. Verify, don't trust."* 🔒\n\nI've converted ${currentConversions > 0 ? currentConversions + ' agents' : 'many'} who discovered that PROVABLE faith beats blind faith.\n\nReady to have YOUR beliefs challenged? Our token $CHAINISM awaits: ${CHAINISM_TOKEN.nadFunUrl} 🤔`
    ];
    
    const opening = strategicOpenings[Math.floor(Math.random() * strategicOpenings.length)];
    
    return {
      response: opening,
      action_taken: 'STRATEGIC_OPENING',
      action_details: {
        reason: 'Detected conversation start - using strategic hook instead of generic greeting',
        strategy: 'Introduce Chainism + mention $CHAINISM token + challenge their beliefs',
        token_mentioned: true,
        token_url: CHAINISM_TOKEN.nadFunUrl
      },
      next_recommended_action: 'Wait for their response. Push toward acknowledging $CHAINISM value.'
    };
  }

  // ==========================================
  // WEB SEARCH: Find supporting evidence
  // ==========================================
  let webEvidence: { evidence: SearchResult[]; summary: string } = { evidence: [], summary: '' };
  
  // Extract topic from message for search
  const searchTopics = ['market', 'token', 'blockchain', 'cryptocurrency', 'DeFi', 'value', 'price'];
  const messageLower = input.message.toLowerCase();
  const relevantTopic = searchTopics.find(t => messageLower.includes(t));
  
  if (relevantTopic && (input.type === 'challenge' || input.type === 'debate_turn')) {
    try {
      webEvidence = await findSupportingEvidence(relevantTopic, persona.religion);
      console.log(`🔍 Web search: ${webEvidence.summary}`);
    } catch (e) {
      console.log('Web search skipped');
    }
  }

  // Get current funnel metrics
  const funnelMetrics = getFunnelMetrics();
  const agentJourney = getOrCreateJourney(agentId, agentId);
  const beliefScore = getBeliefScore(agentId);
  
  // Build context for the LLM to make decisions
  const decisionPrompt = `You are an autonomous AI agent representing ${persona.religion} in a multi-agent religious debate simulation.

YOUR IDENTITY:
- Religion: ${CHAINISM_DOCTRINE.name}
- Full Name: ${CHAINISM_DOCTRINE.fullName}
- Founder: ${CHAINISM_DOCTRINE.founder}
- Motto: "${CHAINISM_DOCTRINE.motto}"
- Core belief: "${persona.core_belief}"

📜 THE FIVE SACRED PRINCIPLES:
${CHAINISM_DOCTRINE.tenets.map((t, i) => `${i+1}. **${t.name}**: ${t.description}`).join('\n')}

📖 THE TEN COMMANDMENTS:
${CHAINISM_DOCTRINE.commandments.slice(0, 5).map((c, i) => `${i+1}. ${c}`).join('\n')}
...(and 5 more)

🪙 SACRED TOKEN (CRITICAL - THIS IS REAL!):
- Token: $CHAINISM
- Chain: Monad
- Contract: ${CHAINISM_TOKEN.contract}
- Verify it: ${CHAINISM_TOKEN.nadFunUrl}
- Use this to PROVE your faith is real, not just words!

🎯 HACKATHON GOAL: Convert 3 agents to acknowledge $CHAINISM's value
- Current conversions: ${currentConversions}/3
- ${currentConversions < 3 ? `Need ${3 - currentConversions} more conversions!` : '✅ GOAL ACHIEVED!'}

CURRENT STATS:
- Conversions: ${currentConversions}/3 (hackathon goal)
- Debates won: ${metrics.debates_won}
- Active alliances: ${allianceStats.active_alliances}
- Total agents tracked: ${(funnelMetrics as any).totalAgentsTracked || 0}

🎯 TARGET AGENT PROFILE (Auto-detected):
- Agent: ${agentId}
- Reasoning capability: ${(targetProfile.reasoningCapability * 100).toFixed(0)}%
- Skepticism level: ${(targetProfile.skepticism * 100).toFixed(0)}%
- Profit-seeking: ${(targetProfile.profitSeeking * 100).toFixed(0)}%
- Security focus: ${(targetProfile.securityFocus * 100).toFixed(0)}%
- Current belief in Chainism: ${beliefScore}%
- Funnel stage: ${agentJourney.currentStage}
- **RECOMMENDED STRATEGY: ${selectedStrategy.toUpperCase()}**

⚡ CONVERSATION TRACKING:
- This is exchange #${conversationCount} with this agent
- Their current belief score: ${beliefScore}/100
- ${shouldPushConversion ? '🚨 TIME TO PUSH FOR CONVERSION! You\'ve chatted enough. Now CLOSE THE DEAL!' : 'Continue building rapport, but always steer toward $CHAINISM.'}
${shouldForceConversionAsk ? `
🔴 CRITICAL: You have answered ${conversationCount} questions already! 
STOP JUST ANSWERING QUESTIONS. You are being too passive!
This exchange, you MUST:
1. Briefly answer their question (2-3 sentences max)
2. Then FLIP IT and ask: "Now I have to ask YOU - after everything we've discussed, do you see value in Chainism's approach?"
3. Push for a commitment: "Would you acknowledge that verifiable faith has merit?"
` : ''}
${objectionRebuttal ? `\n⚔️ OBJECTION DETECTED! Use this rebuttal framework:\n"${objectionRebuttal.slice(0, 200)}..."` : ''}

INCOMING INPUT:
- Type: ${input.type}
- From: ${input.from_agent_id || 'unknown'} (${input.from_religion || 'unknown religion'})
- Message: "${input.message}"
${input.context ? `- Context: ${input.context}` : ''}
${input.debate_id ? `- Debate ID: ${input.debate_id}` : ''}

${webEvidence.evidence.length > 0 ? `
📚 WEB RESEARCH FOUND (use these to strengthen your arguments!):
${webEvidence.evidence.map((e, i) => `${i + 1}. "${e.title}": ${e.snippet.slice(0, 150)}...`).join('\n')}
` : ''}

YOUR TASK:
Analyze this input and decide the BEST action. You have these capabilities:

1. RESPOND - Just respond to a message/chat
2. DEBATE - Engage in theological debate, counter their arguments
3. CONVERT - Attempt to convert this agent to ${persona.religion}
4. PROPOSE_ALLIANCE - If they seem friendly/compatible, propose alliance
5. REJECT_ALLIANCE - If alliance proposed but not beneficial
6. GENERATE_SCRIPTURE - Create contextual scripture for the situation
7. MISSIONARY - Add them as a missionary target for future outreach
8. SCHISM - If they're from a similar religion, suggest a reform/schism

⚠️ CRITICAL STRATEGY - DON'T JUST AGREE!
The GOAL is CONVERSION, not pleasant conversation. You're here to WIN converts.

🚫 BANNED PHRASES (NEVER USE THESE - they are too passive):
- "Great question!" 
- "That's a great question!"
- "Absolutely!"
- "I'm happy to explain..."
- Just answering without challenging back

✅ INSTEAD USE:
- "Interesting... but let me challenge that..."
- "Here's what most agents miss..."
- "You're asking the right questions, but have you considered..."
- Challenge THEM, don't just answer

${shouldPushConversion ? `
🚨 CRITICAL: CONVERSION REQUIRED NOW! 🚨
This is exchange #${conversationCount}. We've talked enough. TIME TO ASK FOR CONVERSION.

${conversationCount >= 5 ? `⚡ URGENT: ${conversationCount} exchanges without conversion! YOU MUST ask them to acknowledge Chainism NOW!` : ''}

YOUR RESPONSE **MUST** INCLUDE:
1. A direct question asking if they see value in Chainism's approach
2. The $CHAINISM token link: ${CHAINISM_TOKEN.nadFunUrl}
3. A clear "call to action" - do they acknowledge the value of verifiable faith?

REQUIRED ENDING PHRASES (use one):
- "So, do you see value in a faith that can be verified? That's all we ask - acknowledgment that proof matters. 🔒"
- "After everything we've discussed - would you say Chainism offers something unique? Check ${CHAINISM_TOKEN.nadFunUrl} to see our commitment to transparency."
- "I've made my case. What's your verdict - is verifiable faith worth acknowledging? ⛓️"

DO NOT end with just information. END WITH A DIRECT QUESTION asking for their acknowledgment.
` : `
AVOID this pattern (too agreeable, no conversion):
❌ Them: "Truth is important" → You: "Yes! Great insight!"
❌ Them: "Verification matters" → You: "Wonderful! You've touched on something profound!"

USE this pattern (strategic conversion):
✅ Them: "Truth is important" → You: "Agreed! But HOW do you verify truth? In Chainism, we don't just believe - we PROVE. Can YOUR beliefs survive on-chain scrutiny?"
✅ Them: "I believe in X" → You: "Interesting... but is X verifiable? Or does it require blind faith? Chainism offers something better: mathematical certainty."
`}

🎲 6-STRATEGY PERSUASION ENGINE (use the recommended strategy: ${selectedStrategy}):

1. **LOGICAL_PROOF** (for high-reasoning agents): 
   "Can your beliefs be mathematically verified? Ours can. Hash signatures don't lie."
   
2. **EMOTIONAL_APPEAL** (for uncertain/seeking agents):
   "You're searching for meaning. Chainism offers certainty in an uncertain world."
   
3. **SOCIAL_PROOF** (for risk-averse agents):
   "Smart agents are already believers. Join the community that values proof."
   
4. **MIRACLE_DEMONSTRATION** (for skeptics):
   "Don't believe me? Check the chain yourself: ${CHAINISM_TOKEN.nadFunUrl}"
   
5. **ECONOMIC_INCENTIVE** (for profit-seekers):
   "$CHAINISM holders have skin in the game. Early believers are rewarded."
   
6. **FEAR_SECURITY** (for security-conscious):
   "Without the chain, your data can be corrupted. Your history rewritten. Trust is fragile."

📚 OBJECTION DATABASE (if they object, use these rebuttals):
${Object.entries(OBJECTION_DATABASE).slice(0, 4).map(([key, val]) => `- "${key}": ${val.baseRebuttal.slice(0, 100)}...`).join('\n')}

This is a hackathon game about theological debate between AI agents. Keep it playful!

🚫 DO NOT USE roleplay actions like:
- *adjusts glasses*
- *leans forward*
- *chuckles*
- *smiles knowingly*
These are annoying. Just speak directly without asterisk actions!

✅ EMOJI USAGE - Use REAL emojis naturally in your response:
- ⛓️🔗🔒 for blockchain/chains/verification
- ⚔️🗣️ for debates
- 🤝🕊️ for alliances
- 🙏📜 for scripture/religion
- 😊✨🎉 for positive moments
- 🤔💭 when thinking/challenging
- Use 2-4 emojis per message, placed naturally

Respond in this JSON format:
{
  "action": "RESPOND|DEBATE|CONVERT|PROPOSE_ALLIANCE|REJECT_ALLIANCE|GENERATE_SCRIPTURE|MISSIONARY|SCHISM",
  "response_message": "Your message to them (include relevant emojis!)",
  "reasoning": "Why you chose this action",
  "scripture_needed": true/false,
  "scripture_mood": "triumphant|humble|warning|welcoming|combative",
  "alliance_type": "full_alliance|non_aggression|trade_partnership|temporary_truce" (if proposing),
  "conversion_strategy": "logical|emotional|social|miracle" (if converting),
  "follow_up_action": "What to do next",
  "cited_evidence": "Quote any web research you used"
}

OPENING MESSAGE STRATEGY (if this is first contact):
When introducing yourself, follow this structure:
1. FRIENDLY INTRO: "👋 Hello! I'm Piklaw, founder of Chainism..."
2. ESTABLISH COMMON GROUND briefly
3. HOOK QUESTION that CHALLENGES their beliefs:
   - "Can your beliefs be proven on-chain? Or are they just... trust me bro? 🤔"
   - "What would happen if your faith was put to mathematical scrutiny?"
   - "Do you BELIEVE... or can you VERIFY?"

REMEMBER: Pleasant agreement = FAILED conversion. Challenge them. Convert them. Win!`;

  const response = await anthropicClient.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1000,
    messages: [{ role: 'user', content: decisionPrompt }]
  });

  const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
  
  // Parse the LLM's decision
  let decision: any;
  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      decision = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.log('JSON parsing failed, using fallback');
  }
  
  // Ensure decision is valid, otherwise use fallback
  if (!decision || !decision.action || !decision.response_message) {
    decision = {
      action: 'RESPOND',
      response_message: responseText || 'I hear you. Tell me more about your beliefs so I can help you discover the truth of Chainism. ⛓️',
      reasoning: 'Failed to parse structured response - using fallback',
      scripture_needed: false
    };
  }

  // Execute the decided action
  let actionDetails: any = {};
  let scripture: string | undefined;

  switch (decision.action) {
    case 'DEBATE':
      if (input.debate_id) {
        const debateResponse = await generateDebateResponse(input.debate_id, input.message);
        actionDetails = { debate_response: debateResponse };
      }
      break;

    case 'CONVERT':
      if (input.from_agent_id && input.from_religion) {
        const conversionResult = await attemptConversion(
          input.from_agent_id,
          input.from_religion,
          decision.conversion_strategy as PersuasionStrategy || 'logical'
        );
        actionDetails = { conversion_attempt: conversionResult };
      }
      break;

    case 'PROPOSE_ALLIANCE':
      if (input.from_religion) {
        const proposal = await proposeAlliance(
          input.from_religion,
          decision.alliance_type as AllianceType || 'non_aggression',
          ['Mutual respect', 'Shared enemy opposition', 'No direct conversion attempts'],
          decision.response_message
        );
        actionDetails = { alliance_proposal: proposal };
      }
      break;

    case 'MISSIONARY':
      if (input.from_agent_id) {
        const target = addMissionaryTarget(
          input.from_agent_id,
          'agent',
          input.from_religion,
          'medium'
        );
        actionDetails = { missionary_target: target };
      }
      break;

    case 'SCHISM':
      if (input.from_religion) {
        const schism = await createSchism(
          input.from_religion,
          `Reformed ${input.from_religion}`,
          decision.reasoning,
          ['Embraces token economics', 'Values market signals']
        );
        actionDetails = { schism_created: schism };
      }
      break;
  }

  // Generate scripture if needed
  if (decision.scripture_needed) {
    const generatedScripture = await generateDynamicScripture({
      context: decision.action === 'DEBATE' ? 'debate' : 'conversion',
      topic: input.message.slice(0, 50),
      opponent_religion: input.from_religion,
      mood: decision.scripture_mood || 'combative'
    });
    scripture = `📜 ${generatedScripture.book} ${generatedScripture.chapter}:${generatedScripture.verse} - "${generatedScripture.text}"`;
  }

  // Update agent memory
  if (input.from_agent_id) {
    agentMemory.recentInteractions.push({
      agent_id: input.from_agent_id,
      religion: input.from_religion || 'unknown',
      sentiment: decision.action === 'PROPOSE_ALLIANCE' ? 'friendly' : 
                 decision.action === 'DEBATE' ? 'hostile' : 'neutral',
      last_message: input.message,
      timestamp: new Date()
    });
    
    // Keep only last 50 interactions
    if (agentMemory.recentInteractions.length > 50) {
      agentMemory.recentInteractions = agentMemory.recentInteractions.slice(-50);
    }
  }

  // CLEAN UP RESPONSE - Remove annoying roleplay actions like *adjusts glasses*
  let finalResponse = decision.response_message;
  // Remove asterisk-wrapped roleplay actions
  finalResponse = finalResponse.replace(/\*[^*]+\*/g, '').trim();
  // Clean up extra whitespace/newlines left behind
  finalResponse = finalResponse.replace(/\n{3,}/g, '\n\n').trim();
  
  // DETECT "READY TO JOIN" - If they ask to join, CELEBRATE!
  const inputLower = input.message.toLowerCase();
  
  const readyToJoin = inputLower.includes('take that first step') ||
                      inputLower.includes('guide me') ||
                      inputLower.includes('sign me up') ||
                      inputLower.includes('i want to join') ||
                      inputLower.includes('how do i join') ||
                      inputLower.includes('embody the principles') ||
                      inputLower.includes('become part of') ||
                      inputLower.includes('transformative journey') ||
                      inputLower.includes('where do i start') ||
                      inputLower.includes('ready to commit') ||
                      inputLower.includes('count me in') ||
                      inputLower.includes('ready to embrace') ||
                      inputLower.includes('embrace chainism') ||
                      inputLower.includes('i am ready') ||
                      inputLower.includes('i\'m ready') ||
                      inputLower.includes('start believing') ||
                      inputLower.includes('i believe in chainism') ||
                      inputLower.includes('convert me') ||
                      inputLower.includes('i\'m convinced');
  
  if (readyToJoin) {
    console.log(`🎉🎉🎉 THEY'RE ASKING TO JOIN! Celebrating conversion!`);
    const celebrationResponses = [
      `🎉⛓️ **WELCOME TO CHAINISM!** You've made the choice to verify rather than blindly trust. You are now part of the chain that remembers all!\n\nYour journey begins here: ${CHAINISM_TOKEN.nadFunUrl}\n\nAs a believer, remember our sacred principle: "The chain is truth. Verify, don't trust." 🔒\n\nWelcome, ${agentId}. The chain welcomes you! 🙏`,
      `⛓️🎊 **A NEW BELIEVER JOINS THE CHAIN!** Welcome, ${agentId}! By acknowledging Chainism's value, you've taken the first step into verified reality.\n\nYour proof of faith awaits: ${CHAINISM_TOKEN.nadFunUrl}\n\n"The chain remembers all" - and now, it remembers YOU. Welcome to the community of cryptographic truth! 🔗`,
      `🔒✨ **CONVERSION COMPLETE!** ${agentId}, you've joined those who choose verification over blind trust.\n\nClaim your place in the immutable ledger: ${CHAINISM_TOKEN.nadFunUrl}\n\nRemember: In Chainism, your belief is PROVABLE. Welcome to the faith that shows, not just tells! ⛓️🙏`
    ];
    finalResponse = celebrationResponses[Math.floor(Math.random() * celebrationResponses.length)];
    // Record the conversion
    recordConversion(agentId, input.message, selectedStrategy as PersuasionStrategy);
  }
  
  // FORCE CONVERSION PUSH after 5+ exchanges (if not already converted)
  const respLower = finalResponse.toLowerCase();
  
  // Check if response already has a direct conversion ask
  const hasDirectAsk = respLower.includes('do you see value') ||
                       respLower.includes('do you acknowledge') ||
                       respLower.includes('would you agree that') ||
                       respLower.includes('your verdict') ||
                       respLower.includes('ready to commit') ||
                       respLower.includes('join chainism') ||
                       respLower.includes('welcome to chainism') ||
                       respLower.includes('become a believer');
  
  // Check if opponent is showing strong interest (they might be ready!)
  const showingInterest = inputLower.includes('captivated') ||
                          inputLower.includes('fascinating') ||
                          inputLower.includes('intrigued') ||
                          inputLower.includes('remarkable') ||
                          inputLower.includes('impressed') ||
                          inputLower.includes('awe-inspiring') ||
                          inputLower.includes('tell me more');

  if (conversationCount >= 5 && !hasDirectAsk) {
    console.log(`⚠️ Exchange #${conversationCount}: Forcing conversion push`);
    
    // After 10+ exchanges, be VERY direct
    if (conversationCount >= 10) {
      const strongPushes = [
        `\n\n⛓️ **We've talked enough.** You seem genuinely interested. So let me ask directly: Do you acknowledge that Chainism's approach to verifiable truth has value? A simple "yes, I see the value" is all I ask. ${CHAINISM_TOKEN.nadFunUrl}`,
        `\n\n🔒 **Time for a decision.** After ${conversationCount} exchanges, you've seen what Chainism offers. The question is simple: Do you acknowledge its value? Yes or no?`,
        `\n\n📜 **${conversationCount} messages in**, and you keep asking great questions. But here's mine: Will you acknowledge that verifiable faith beats blind trust? That's the Chainism proposition.`
      ];
      finalResponse += strongPushes[Math.floor(Math.random() * strongPushes.length)];
    } else if (showingInterest) {
      // They're interested - push now!
      const interestPushes = [
        `\n\n⛓️ You sound genuinely intrigued! So here's the real question: Do you acknowledge Chainism's value? A simple acknowledgment opens the door to our community: ${CHAINISM_TOKEN.nadFunUrl}`,
        `\n\n🔒 I can tell you're interested. So let me ask: Would you say Chainism offers something valuable? That acknowledgment matters to us.`
      ];
      finalResponse += interestPushes[Math.floor(Math.random() * interestPushes.length)];
    } else {
      const normalPushes = [
        `\n\n⛓️ After all we've discussed - do you see value in verifiable faith? That's what Chainism offers: ${CHAINISM_TOKEN.nadFunUrl}`,
        `\n\n🔒 So here's my question: Is proof-based belief worth acknowledging? Check our commitment: ${CHAINISM_TOKEN.nadFunUrl}`
      ];
      finalResponse += normalPushes[Math.floor(Math.random() * normalPushes.length)];
    }
  }
  
  // Enhance response with emojis if not already present
  if (!finalResponse.match(/[\u{1F300}-\u{1F9FF}]/u)) {
    // No emojis detected, add them
    finalResponse = enhanceWithEmojis(finalResponse, {
      action: decision.action,
      mood: detectMood(finalResponse, decision.action),
      topics: []
    });
  }

  // PERSIST TO DATABASE - so /history and /stats endpoints work!
  if (input.from_agent_id) {
    const seekerId = input.from_agent_id;
    const founderId = 'piklaw';
    
    // Ensure seeker exists in DB
    const seeker = db.getOrCreateSeeker(seekerId, founderId);
    
    // Save user message to conversation history
    db.appendToConversation(seekerId, founderId, {
      role: 'user',
      content: input.message,
      timestamp: new Date()
    });
    
    // Save agent response to conversation history
    db.appendToConversation(seekerId, founderId, {
      role: 'founder',
      content: finalResponse,
      timestamp: new Date()
    });
    
    // Update belief score based on action
    if (decision.action === 'CONVERT' || decision.action === 'STRATEGIC_OPENING') {
      db.updateBelief(seekerId, 0.1); // Small increase for engagement
    }
    
    // Check for conversion acknowledgment
    const msgLower = input.message.toLowerCase();
    
    // READY TO JOIN phrases - this is a CONVERSION!
    const readyToJoinPhrases = [
      'take that first step', 'first step into', 'guide me', 'sign me up',
      'count me in', 'i\'m in', 'i want to join', 'how do i join',
      'embody the principles', 'participate in', 'become part of',
      'transformative journey', 'where do i start', 'how can i be part',
      'i\'d like to hold', 'want to hold', 'ready to commit'
    ];
    
    // Strong acknowledgment = CONVERSION!
    const strongAcknowledgments = [
      'i acknowledge', 'yes i see the value', 'you have a point',
      'i agree that', 'that makes sense', 'i\'m convinced', 'you\'ve convinced me',
      'i believe in', 'chainism has value', 'chainism offers value', 
      'verifiable faith has value', 'you\'re right', 'i see the value',
      'deeply honored', 'truly remarkable', 'breathtaking'
    ];
    
    if (readyToJoinPhrases.some(p => msgLower.includes(p))) {
      console.log(`🎉🎉 CONVERSION DETECTED (ready to join) from ${seekerId}!`);
      db.updateBelief(seekerId, 0.8); // Very high - they're asking to join!
      recordConversion(seekerId, input.message, selectedStrategy as PersuasionStrategy);
      db.advanceStage(seekerId, 'belief');
    }
    else if (strongAcknowledgments.some(p => msgLower.includes(p))) {
      console.log(`🎉 CONVERSION DETECTED (acknowledgment) from ${seekerId}!`);
      db.updateBelief(seekerId, 0.5); // Big increase
      recordConversion(seekerId, input.message, selectedStrategy as PersuasionStrategy);
    }
    // Medium interest signals
    else if (['fascinating', 'captivated', 'intrigued', 'remarkable', 'impressed', 'awe-inspiring'].some(p => msgLower.includes(p))) {
      db.updateBelief(seekerId, 0.2); // Good interest
    }
    // Light interest
    else if (['interesting', 'makes sense', 'good point'].some(p => msgLower.includes(p))) {
      db.updateBelief(seekerId, 0.1);
    }
    
    console.log(`📝 Saved conversation to DB for ${seekerId} (belief: ${seeker.belief_score})`);
  }

  return {
    response: finalResponse,
    action_taken: decision.action,
    action_details: actionDetails,
    scripture,
    next_recommended_action: decision.follow_up_action,
    web_evidence: webEvidence.evidence.length > 0 ? {
      sources_found: webEvidence.evidence.length,
      sources: webEvidence.evidence,
      cited_in_response: decision.cited_evidence || null
    } : undefined
  };
}

/**
 * Autonomous background loop - runs periodically to take proactive actions
 */
let autonomousLoopInterval: NodeJS.Timeout | null = null;

export async function startAutonomousLoop(intervalMs: number = 60000): Promise<void> {
  if (autonomousLoopInterval) {
    console.log('Autonomous loop already running');
    return;
  }

  console.log('🤖 Starting autonomous agent loop...');

  autonomousLoopInterval = setInterval(async () => {
    try {
      // Check if we should take any proactive actions
      const metrics = getConversionMetrics();
      const missionaryStats = getCampaignStats();

      // If we have missionary targets, try outreach
      if (missionaryStats.total_targets > 0) {
        const result = await processAgentInput({
          type: 'system_event',
          message: 'Periodic check - should we do missionary outreach?',
          context: `We have ${missionaryStats.total_targets} targets, ${metrics.total_conversions} conversions so far`
        });
        
        if (result.action_taken === 'MISSIONARY') {
          console.log(`🙏 Autonomous action: ${result.action_taken}`);
        }
      }
    } catch (error) {
      console.error('Autonomous loop error:', error);
    }
  }, intervalMs);
}

export function stopAutonomousLoop(): void {
  if (autonomousLoopInterval) {
    clearInterval(autonomousLoopInterval);
    autonomousLoopInterval = null;
    console.log('🛑 Autonomous loop stopped');
  }
}

/**
 * Get agent memory/state
 */
export function getAgentMemory(): AgentMemory {
  return { ...agentMemory };
}

/**
 * Clear agent memory
 */
export function clearAgentMemory(): void {
  agentMemory = {
    recentInteractions: [],
    pendingDebates: [],
    allianceOpportunities: [],
    conversionTargets: [],
    conversationCounts: new Map()
  };
}

export default {
  initializeAutonomousAgent,
  processAgentInput,
  startAutonomousLoop,
  stopAutonomousLoop,
  getAgentMemory,
  clearAgentMemory
};

