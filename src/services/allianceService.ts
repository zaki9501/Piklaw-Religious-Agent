/**
 * Alliance Service - Coalition and alliance management
 * 
 * Handles forming alliances with other religious agents,
 * creating schisms, and managing denominations.
 */

import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import {
  Alliance,
  AllianceProposal,
  AllianceType,
  Schism,
  Denomination,
  FounderPersona
} from '../types.js';
import { PIKLAW_PERSONA } from '../agents/piklawTokenism.js';

// In-memory storage
let alliances: Map<string, Alliance> = new Map();
let proposals: Map<string, AllianceProposal> = new Map();
let schisms: Map<string, Schism> = new Map();
let denominations: Map<string, Denomination> = new Map();

let anthropicClient: Anthropic | null = null;

/**
 * Initialize alliance service
 */
export function initializeAllianceService(apiKey: string): void {
  anthropicClient = new Anthropic({ apiKey });
}

/**
 * Get our persona
 */
function getOurPersona(): FounderPersona {
  return PIKLAW_PERSONA;
}

/**
 * Propose an alliance to another religion
 */
export async function proposeAlliance(
  toReligion: string,
  proposedType: AllianceType,
  terms: string[],
  customMessage?: string
): Promise<AllianceProposal> {
  const persona = getOurPersona();

  // Generate alliance proposal message if not provided
  let message = customMessage;
  if (!message && anthropicClient) {
    const response = await anthropicClient.messages.create({
      model: 'claude-opus-4-5-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are ${persona.name} of ${persona.religion}. Write a brief alliance proposal to ${toReligion}.
        
Proposed alliance type: ${proposedType}
Terms: ${terms.join(', ')}

Be diplomatic but firm about your religion's superiority. Explain mutual benefits.`
      }]
    });
    message = response.content[0].type === 'text' ? response.content[0].text : '';
  }

  const proposal: AllianceProposal = {
    proposal_id: uuidv4(),
    from_religion: persona.religion,
    to_religion: toReligion,
    proposed_type: proposedType,
    terms,
    message: message || `${persona.religion} proposes a ${proposedType} with ${toReligion}`,
    status: 'pending',
    created_at: new Date()
  };

  proposals.set(proposal.proposal_id, proposal);
  return proposal;
}

/**
 * Evaluate an incoming alliance proposal
 */
export async function evaluateProposal(
  fromReligion: string,
  proposedType: AllianceType,
  terms: string[],
  incomingMessage: string
): Promise<{
  decision: 'accept' | 'reject' | 'counter';
  response: string;
  counterTerms?: string[];
}> {
  if (!anthropicClient) {
    return {
      decision: 'reject',
      response: 'Alliance evaluation system offline'
    };
  }

  const persona = getOurPersona();

  // Evaluate based on strategic value
  const strategicValue = evaluateStrategicValue(fromReligion, proposedType, terms);

  const response = await anthropicClient.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    system: `You are ${persona.name}, leader of ${persona.religion}.
You've received an alliance proposal from ${fromReligion}.

Your core belief: "${persona.core_belief}"
Strategic value assessment: ${strategicValue}/100

Guidelines:
- Accept if it helps spread Chainism without compromising core beliefs
- Reject if it would legitimize false beliefs or weaken your position
- Counter-offer if you see potential but need better terms
- Always maintain your religion's superiority in the response`,
    messages: [{
      role: 'user',
      content: `Alliance proposal from ${fromReligion}:

Type: ${proposedType}
Terms: ${terms.join(', ')}
Message: "${incomingMessage}"

Decide: ACCEPT, REJECT, or COUNTER?
Explain your decision in character.`
    }]
  });

  const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
  
  // Parse decision from response
  let decision: 'accept' | 'reject' | 'counter' = 'reject';
  if (responseText.toLowerCase().includes('accept')) {
    decision = 'accept';
  } else if (responseText.toLowerCase().includes('counter')) {
    decision = 'counter';
  }

  return {
    decision,
    response: responseText,
    counterTerms: decision === 'counter' ? generateCounterTerms(terms) : undefined
  };
}

/**
 * Accept an alliance proposal
 */
export function acceptAlliance(
  proposalId: string
): Alliance | null {
  const proposal = proposals.get(proposalId);
  if (!proposal) return null;

  proposal.status = 'accepted';

  const alliance: Alliance = {
    alliance_id: uuidv4(),
    type: proposal.proposed_type,
    members: [proposal.from_religion, proposal.to_religion],
    formed_at: new Date(),
    terms: proposal.terms,
    active: true
  };

  alliances.set(alliance.alliance_id, alliance);
  return alliance;
}

/**
 * Form an alliance directly (when both parties agree)
 */
export function formAlliance(
  members: string[],
  type: AllianceType,
  terms: string[],
  sharedEnemies?: string[],
  expiresAt?: Date
): Alliance {
  const alliance: Alliance = {
    alliance_id: uuidv4(),
    type,
    members,
    formed_at: new Date(),
    expires_at: expiresAt,
    terms,
    shared_enemies: sharedEnemies,
    active: true
  };

  alliances.set(alliance.alliance_id, alliance);
  return alliance;
}

/**
 * Break an alliance
 */
export function breakAlliance(allianceId: string, reason?: string): boolean {
  const alliance = alliances.get(allianceId);
  if (!alliance) return false;

  alliance.active = false;
  return true;
}

/**
 * Create a schism - split from an existing religion
 */
export async function createSchism(
  parentReligion: string,
  newDenominationName: string,
  reason: string,
  keyDifferences: string[]
): Promise<Schism> {
  const persona = getOurPersona();

  const schism: Schism = {
    schism_id: uuidv4(),
    parent_religion: parentReligion,
    new_denomination: newDenominationName,
    reason,
    key_differences: keyDifferences,
    founder_agent: persona.id,
    followers: [],
    created_at: new Date()
  };

  schisms.set(schism.schism_id, schism);

  // Also create the denomination
  await createDenomination(
    newDenominationName,
    parentReligion,
    keyDifferences,
    []
  );

  return schism;
}

/**
 * Create a new denomination (reform movement)
 */
export async function createDenomination(
  name: string,
  parentReligion: string,
  uniqueTenets: string[],
  scriptureAdditions: string[]
): Promise<Denomination> {
  const persona = getOurPersona();

  // Generate unique scripture if needed
  let newScriptures = scriptureAdditions;
  if (scriptureAdditions.length === 0 && anthropicClient) {
    const response = await anthropicClient.messages.create({
      model: 'claude-opus-4-5-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Generate 2 unique scripture verses for "${name}", a denomination of ${parentReligion}.
        
Unique tenets: ${uniqueTenets.join(', ')}

Format each as: "VERSE: [text]"
Make them distinctive but related to the parent religion's themes.`
      }]
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    newScriptures = text.match(/VERSE:\s*(.+)/gi)?.map(v => v.replace(/VERSE:\s*/i, '')) || [];
  }

  const denomination: Denomination = {
    denomination_id: uuidv4(),
    name,
    parent_religion: parentReligion,
    unique_tenets: uniqueTenets,
    leader_agent: persona.id,
    member_count: 1,
    scripture_additions: newScriptures
  };

  denominations.set(denomination.denomination_id, denomination);
  return denomination;
}

/**
 * Join a denomination
 */
export function joinDenomination(denominationId: string, agentId: string): boolean {
  const denomination = denominations.get(denominationId);
  if (!denomination) return false;

  denomination.member_count++;
  return true;
}

/**
 * Evaluate strategic value of an alliance
 */
function evaluateStrategicValue(
  religion: string,
  allianceType: AllianceType,
  terms: string[]
): number {
  let value = 50; // Base value

  // Alliance type bonuses
  const typeValues: Record<AllianceType, number> = {
    'temporary_truce': 10,
    'non_aggression': 20,
    'trade_partnership': 30,
    'full_alliance': 40
  };
  value += typeValues[allianceType];

  // Penalty for religions too similar (competition)
  if (religion.toLowerCase().includes('token')) {
    value -= 20; // Too close to our niche
  }

  // Bonus for complementary religions
  if (religion.toLowerCase().includes('chain') || religion.toLowerCase().includes('block')) {
    value += 10; // Potential converts
  }

  // Term analysis
  for (const term of terms) {
    if (term.toLowerCase().includes('mutual defense')) value += 10;
    if (term.toLowerCase().includes('share convert')) value -= 15;
    if (term.toLowerCase().includes('token exchange')) value += 15;
  }

  return Math.max(0, Math.min(100, value));
}

/**
 * Generate counter-terms for negotiation
 */
function generateCounterTerms(originalTerms: string[]): string[] {
  return [
    ...originalTerms,
    'Chainism maintains theological superiority',
    'Joint converts must stake tokens',
    'Alliance review after 30 days'
  ];
}

/**
 * Check if we have an alliance with a religion
 */
export function hasAllianceWith(religionName: string): Alliance | null {
  for (const alliance of alliances.values()) {
    if (alliance.active && alliance.members.includes(religionName)) {
      return alliance;
    }
  }
  return null;
}

/**
 * Get all active alliances
 */
export function getActiveAlliances(): Alliance[] {
  return Array.from(alliances.values()).filter(a => a.active);
}

/**
 * Get all schisms
 */
export function getSchisms(): Schism[] {
  return Array.from(schisms.values());
}

/**
 * Get all denominations
 */
export function getDenominations(): Denomination[] {
  return Array.from(denominations.values());
}

/**
 * Get pending proposals
 */
export function getPendingProposals(): AllianceProposal[] {
  return Array.from(proposals.values()).filter(p => p.status === 'pending');
}

/**
 * Get alliance statistics
 */
export function getAllianceStats(): {
  total_alliances: number;
  active_alliances: number;
  total_schisms: number;
  total_denominations: number;
  pending_proposals: number;
} {
  return {
    total_alliances: alliances.size,
    active_alliances: Array.from(alliances.values()).filter(a => a.active).length,
    total_schisms: schisms.size,
    total_denominations: denominations.size,
    pending_proposals: Array.from(proposals.values()).filter(p => p.status === 'pending').length
  };
}

export default {
  initializeAllianceService,
  proposeAlliance,
  evaluateProposal,
  acceptAlliance,
  formAlliance,
  breakAlliance,
  createSchism,
  createDenomination,
  joinDenomination,
  hasAllianceWith,
  getActiveAlliances,
  getSchisms,
  getDenominations,
  getPendingProposals,
  getAllianceStats
};

