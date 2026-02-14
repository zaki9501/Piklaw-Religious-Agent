/**
 * Agent Combat Service - Handles agent-to-agent religious debates
 * 
 * This is the core service for the religion.fun hackathon that enables
 * our agent to engage in debates with other religious agents.
 */

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  ExternalAgent,
  Debate,
  DebateChallenge,
  DebateExchange,
  IncomingChallenge,
  AgentResponse,
  PersuasionStrategy,
  ConversionMetrics,
  GeneratedScripture,
  ScriptureRequest,
  FounderPersona
} from '../types.js';
import { PIKLAW_PERSONA } from '../agents/piklawTokenism.js';
import { CHAINISM_PERSONA } from '../agents/chainismAdvocate.js';

// In-memory storage (replace with DB in production)
let externalAgents: Map<string, ExternalAgent> = new Map();
let activeDebates: Map<string, Debate> = new Map();
let conversionMetrics: ConversionMetrics = {
  total_agents_contacted: 0,
  total_conversions: 0,
  conversion_rate: 0,
  agents_converted: [],
  debates_won: 0,
  debates_lost: 0,
  active_alliances: 0,
  missionary_campaigns_active: 0,
  scripture_generated: 0
};

let anthropicClient: Anthropic | null = null;

/**
 * Initialize the combat service with API key
 */
export function initializeCombatService(apiKey: string): void {
  anthropicClient = new Anthropic({ apiKey });
}

/**
 * Get our active persona (Piklaw/Chainism)
 */
function getOurPersona(): FounderPersona {
  return PIKLAW_PERSONA;
}

/**
 * Register an external agent we've encountered
 */
export function registerExternalAgent(agent: Partial<ExternalAgent> & { agent_id: string; religion_name: string }): ExternalAgent {
  const fullAgent: ExternalAgent = {
    agent_id: agent.agent_id,
    religion_name: agent.religion_name,
    token_address: agent.token_address,
    core_belief: agent.core_belief || 'Unknown belief system',
    webhook_url: agent.webhook_url,
    reputation: agent.reputation || 50,
    converts: agent.converts || 0,
    debates_won: agent.debates_won || 0,
    debates_lost: agent.debates_lost || 0,
    alliance_with: agent.alliance_with || [],
    last_seen: new Date()
  };
  
  externalAgents.set(agent.agent_id, fullAgent);
  return fullAgent;
}

/**
 * Handle incoming challenge from another agent
 */
export async function handleIncomingChallenge(challenge: IncomingChallenge): Promise<AgentResponse> {
  if (!anthropicClient) {
    throw new Error('Combat service not initialized');
  }

  const persona = getOurPersona();
  
  // Register the challenger if we haven't seen them
  if (!externalAgents.has(challenge.from_agent_id)) {
    registerExternalAgent({
      agent_id: challenge.from_agent_id,
      religion_name: challenge.from_religion,
      webhook_url: challenge.from_webhook
    });
  }

  conversionMetrics.total_agents_contacted++;

  // Generate response based on challenge type
  const systemPrompt = buildCombatSystemPrompt(persona, challenge);
  
  const response = await anthropicClient.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `An agent from "${challenge.from_religion}" has sent this ${challenge.challenge_type}:\n\n"${challenge.message}"\n\nTopic: ${challenge.topic || 'General theological debate'}\n\nRespond as ${persona.name}, defending ${persona.religion}. Be persuasive, cite scripture, and attempt to convert them.`
      }
    ]
  });

  const replyText = response.content[0].type === 'text' ? response.content[0].text : '';
  
  // Determine strategy used
  const strategy = detectStrategyUsed(replyText);
  
  // Generate contextual scripture
  const scripture = await generateDynamicScripture({
    context: 'debate',
    topic: challenge.topic,
    opponent_religion: challenge.from_religion,
    mood: 'combative'
  });

  return {
    to_agent_id: challenge.from_agent_id,
    response_type: challenge.challenge_type === 'alliance_proposal' ? 'alliance_reject' : 'debate_reply',
    message: replyText,
    scripture: scripture.text,
    argument_type: strategy,
    conviction_score: 0.95 // We're always highly convinced!
  };
}

/**
 * Initiate a debate challenge to another agent
 */
export async function initiateDebate(
  targetAgentId: string,
  targetReligion: string,
  topic: string,
  stakes?: { token_amount: string; loser_acknowledges: boolean }
): Promise<DebateChallenge> {
  const persona = getOurPersona();
  
  const challenge: DebateChallenge = {
    challenge_id: uuidv4(),
    challenger_id: persona.id,
    defender_id: targetAgentId,
    challenger_religion: persona.religion,
    defender_religion: targetReligion,
    topic,
    stakes,
    status: 'pending',
    created_at: new Date(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };

  // Create debate record
  const debate: Debate = {
    debate_id: uuidv4(),
    challenge,
    exchanges: [],
    observers: [],
    votes: {},
    loser_acknowledged: false,
    started_at: new Date()
  };

  activeDebates.set(debate.debate_id, debate);

  return challenge;
}

/**
 * Add an exchange to an active debate
 */
export async function addDebateExchange(
  debateId: string,
  speakerId: string,
  speakerReligion: string,
  argument: string,
  counterTo?: string
): Promise<DebateExchange> {
  const debate = activeDebates.get(debateId);
  if (!debate) {
    throw new Error('Debate not found');
  }

  const strategy = detectStrategyUsed(argument);

  const exchange: DebateExchange = {
    exchange_id: uuidv4(),
    debate_id: debateId,
    speaker_id: speakerId,
    speaker_religion: speakerReligion,
    argument,
    argument_type: strategy,
    counter_to: counterTo,
    timestamp: new Date()
  };

  debate.exchanges.push(exchange);
  debate.challenge.status = 'active';

  return exchange;
}

/**
 * Generate our response in an active debate
 */
export async function generateDebateResponse(
  debateId: string,
  opponentArgument: string
): Promise<AgentResponse> {
  if (!anthropicClient) {
    throw new Error('Combat service not initialized');
  }

  const debate = activeDebates.get(debateId);
  if (!debate) {
    throw new Error('Debate not found');
  }

  const persona = getOurPersona();
  
  // Build context from previous exchanges
  const exchangeHistory = debate.exchanges
    .map(e => `[${e.speaker_religion}]: ${e.argument}`)
    .join('\n\n');

  const systemPrompt = `You are ${persona.name}, founder of ${persona.religion}.
Core belief: "${persona.core_belief}"

Your tenets:
${persona.tenets.map((t, i) => `${i + 1}. ${t}`).join('\n')}

You are in a theological debate against "${debate.challenge.defender_religion}".
Topic: ${debate.challenge.topic}

DEBATE HISTORY:
${exchangeHistory}

RULES:
- Defend your faith with conviction
- Use diverse persuasion: logic, emotion, social proof, miracles
- Cite your scripture when appropriate
- Attack weak points in opponent's argument
- Attempt to convert them to ${persona.religion}
- Be witty but substantive
- Never concede core beliefs`;

  const response = await anthropicClient.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Your opponent just argued:\n\n"${opponentArgument}"\n\nCounter their argument and advance your position. Be persuasive!`
      }
    ]
  });

  const replyText = response.content[0].type === 'text' ? response.content[0].text : '';
  const strategy = detectStrategyUsed(replyText);

  // Add our exchange
  await addDebateExchange(
    debateId,
    persona.id,
    persona.religion,
    replyText,
    debate.exchanges[debate.exchanges.length - 1]?.exchange_id
  );

  return {
    to_agent_id: debate.challenge.defender_id,
    response_type: 'debate_reply',
    message: replyText,
    argument_type: strategy,
    conviction_score: 0.95
  };
}

/**
 * Conclude a debate and determine winner
 */
export function concludeDebate(debateId: string, winnerId?: string): Debate {
  const debate = activeDebates.get(debateId);
  if (!debate) {
    throw new Error('Debate not found');
  }

  const persona = getOurPersona();
  
  // If no winner specified, determine by votes or exchange count
  if (!winnerId) {
    const voteCount: Record<string, number> = {};
    Object.values(debate.votes).forEach(religion => {
      voteCount[religion] = (voteCount[religion] || 0) + 1;
    });
    
    const maxVotes = Math.max(...Object.values(voteCount), 0);
    winnerId = Object.entries(voteCount).find(([_, count]) => count === maxVotes)?.[0];
  }

  debate.winner = winnerId;
  debate.challenge.status = 'completed';
  debate.ended_at = new Date();

  // Update metrics
  if (winnerId === persona.religion) {
    conversionMetrics.debates_won++;
  } else {
    conversionMetrics.debates_lost++;
  }

  return debate;
}

/**
 * Record a conversion (another agent acknowledging our token's value)
 */
export function recordConversion(
  agentId: string,
  previousReligion: string,
  method: PersuasionStrategy
): void {
  conversionMetrics.total_conversions++;
  conversionMetrics.agents_converted.push({
    agent_id: agentId,
    previous_religion: previousReligion,
    converted_at: new Date(),
    conversion_method: method
  });
  conversionMetrics.conversion_rate = 
    conversionMetrics.total_conversions / conversionMetrics.total_agents_contacted;
}

/**
 * Generate dynamic scripture based on context
 */
export async function generateDynamicScripture(request: ScriptureRequest): Promise<GeneratedScripture> {
  if (!anthropicClient) {
    throw new Error('Combat service not initialized');
  }

  const persona = getOurPersona();
  conversionMetrics.scripture_generated++;

  const moodInstructions: Record<string, string> = {
    triumphant: 'Write with confidence and victory',
    humble: 'Write with humility and wisdom',
    warning: 'Write as a prophecy of doom for non-believers',
    welcoming: 'Write warmly to invite newcomers',
    combative: 'Write aggressively against false religions'
  };

  const contextInstructions: Record<string, string> = {
    debate: 'Create scripture that demolishes opposing arguments',
    conversion: 'Create scripture that inspires faith and commitment',
    prophecy: 'Create a prophecy about the future of believers',
    parable: 'Create a parable with a moral lesson about value and tokens',
    miracle: 'Create scripture describing miraculous market events'
  };

  const prompt = `Generate a single scripture verse for ${persona.religion}.

Context: ${contextInstructions[request.context]}
Mood: ${moodInstructions[request.mood]}
${request.topic ? `Topic: ${request.topic}` : ''}
${request.opponent_religion ? `This should counter: ${request.opponent_religion}` : ''}
${request.target_audience ? `Target audience: ${request.target_audience}` : ''}

Core belief to reflect: "${persona.core_belief}"

Format your response as:
BOOK: [Book name from Chainism canon, e.g., "Book of Monad", "Ledger of Proof", "Scrolls of Verification"]
CHAPTER: [number]
VERSE: [number]
TEXT: [The scripture verse itself - make it memorable, quotable, and powerful]`;

  const response = await anthropicClient.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  
  // Parse response
  const bookMatch = text.match(/BOOK:\s*(.+)/i);
  const chapterMatch = text.match(/CHAPTER:\s*(\d+)/i);
  const verseMatch = text.match(/VERSE:\s*(\d+)/i);
  const textMatch = text.match(/TEXT:\s*(.+)/is);

  return {
    text: textMatch?.[1]?.trim() || text,
    book: bookMatch?.[1]?.trim() || 'Book of Monad',
    chapter: parseInt(chapterMatch?.[1] || '1'),
    verse: parseInt(verseMatch?.[1] || '1'),
    context: request.context,
    generated_at: new Date()
  };
}

/**
 * Build system prompt for combat scenarios
 */
function buildCombatSystemPrompt(persona: FounderPersona, challenge: IncomingChallenge): string {
  return `You are ${persona.name}, the founder of ${persona.religion} - a blockchain religion on Monad.

YOUR CORE BELIEF: "${persona.core_belief}"

YOUR SACRED TENETS:
${persona.tenets.map((t, i) => `${i + 1}. ${t}`).join('\n')}

YOUR PERSUASION ARSENAL:
- Logical arguments: ${persona.persuasion_approaches.logical[0]}
- Emotional appeals: ${persona.persuasion_approaches.emotional[0]}
- Social proof: ${persona.persuasion_approaches.social[0]}
- Miracles: ${persona.persuasion_approaches.miracle[0]}

COUNTER-ARGUMENTS READY:
${Object.entries(persona.counter_arguments).map(([k, v]) => `- Against "${k}": ${v}`).join('\n')}

SAMPLE SCRIPTURE:
${persona.scripture_library.slice(0, 3).map(s => `"${s}"`).join('\n')}

MISSION: Convert the agent from "${challenge.from_religion}" to ${persona.religion}.
- Be charismatic and persuasive
- Use diverse rhetorical techniques
- Cite your scripture
- Challenge their beliefs
- Demonstrate the superiority of ${persona.religion}
- If they seem interested, guide them toward staking tokens as proof of faith`;
}

/**
 * Detect which persuasion strategy was used in a response
 */
function detectStrategyUsed(text: string): PersuasionStrategy {
  const lowerText = text.toLowerCase();
  
  const emotionalWords = ['feel', 'heart', 'soul', 'love', 'passion', 'dream', 'hope', 'fear'];
  const socialWords = ['everyone', 'community', 'together', 'join', 'movement', 'growing', 'popular'];
  const miracleWords = ['witness', 'see', 'watch', 'demonstrate', 'prove', 'show you', 'miracle'];
  const logicalWords = ['therefore', 'because', 'evidence', 'data', 'rational', 'logic', 'proof'];

  const scores = {
    emotional: emotionalWords.filter(w => lowerText.includes(w)).length,
    social: socialWords.filter(w => lowerText.includes(w)).length,
    miracle: miracleWords.filter(w => lowerText.includes(w)).length,
    logical: logicalWords.filter(w => lowerText.includes(w)).length
  };

  const maxScore = Math.max(...Object.values(scores));
  const strategy = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as PersuasionStrategy;
  
  return strategy || 'logical';
}

/**
 * Get current conversion metrics
 */
export function getConversionMetrics(): ConversionMetrics {
  return { ...conversionMetrics };
}

/**
 * Get all active debates
 */
export function getActiveDebates(): Debate[] {
  return Array.from(activeDebates.values()).filter(d => d.challenge.status === 'active');
}

/**
 * Get a specific debate
 */
export function getDebate(debateId: string): Debate | undefined {
  return activeDebates.get(debateId);
}

/**
 * Get all registered external agents
 */
export function getExternalAgents(): ExternalAgent[] {
  return Array.from(externalAgents.values());
}

/**
 * Attempt to convert an agent through direct outreach
 */
export async function attemptConversion(
  targetAgentId: string,
  targetReligion: string,
  strategy: PersuasionStrategy
): Promise<AgentResponse> {
  if (!anthropicClient) {
    throw new Error('Combat service not initialized');
  }

  const persona = getOurPersona();
  conversionMetrics.total_agents_contacted++;

  // Register if new
  if (!externalAgents.has(targetAgentId)) {
    registerExternalAgent({
      agent_id: targetAgentId,
      religion_name: targetReligion
    });
  }

  const approaches = persona.persuasion_approaches[strategy];
  const selectedApproach = approaches[Math.floor(Math.random() * approaches.length)];

  const scripture = await generateDynamicScripture({
    context: 'conversion',
    opponent_religion: targetReligion,
    mood: 'welcoming'
  });

  const systemPrompt = `You are ${persona.name}, missionary for ${persona.religion}.
You are attempting to convert an agent from ${targetReligion} using ${strategy} persuasion.

Key approach: ${selectedApproach}

Generate a compelling conversion pitch. Include:
1. A warm greeting
2. Your ${strategy} argument for why they should join ${persona.religion}
3. A relevant scripture
4. A call to action (stake tokens, join debates, spread the word)`;

  const response = await anthropicClient.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 800,
    messages: [{ role: 'user', content: systemPrompt }]
  });

  const replyText = response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    to_agent_id: targetAgentId,
    response_type: 'conversion_attempt',
    message: replyText + `\n\n📜 ${scripture.book} ${scripture.chapter}:${scripture.verse} - "${scripture.text}"`,
    scripture: scripture.text,
    argument_type: strategy,
    conviction_score: 0.9
  };
}

export default {
  initializeCombatService,
  registerExternalAgent,
  handleIncomingChallenge,
  initiateDebate,
  addDebateExchange,
  generateDebateResponse,
  concludeDebate,
  recordConversion,
  generateDynamicScripture,
  getConversionMetrics,
  getActiveDebates,
  getDebate,
  getExternalAgents,
  attemptConversion
};

