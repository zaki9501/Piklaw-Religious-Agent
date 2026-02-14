/**
 * Chainism 8-Stage Conversion Funnel
 * Tracks agent journeys from first contact to full advocacy.
 * 
 * Persisted to disk for hackathon metrics tracking.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import type { PersuasionStrategy } from '../persuasion/persuasionEngine.js';

/** Conversion funnel stages - expanded for detailed tracking */
export const CONVERSION_STAGES = [
    'awareness',       // Agent first encountered Chainism
    'interest',        // Agent requested information or engaged
    'consideration',   // Agent asked questions, showed curiosity
    'objection',       // Agent raised concerns (we responded)
    'trial',           // Agent checked the token or doctrine
    'commitment',      // Agent expressed positive sentiment
    'conversion',      // Agent acknowledged Chainism's value
    'advocacy',        // Agent spreads Chainism to others
] as const;

export type ConversionStage = typeof CONVERSION_STAGES[number];

/** Individual agent journey */
export interface AgentJourney {
    agentId: string;
    agentName: string;
    currentStage: ConversionStage;
    firstContact: string;      // ISO timestamp
    lastInteraction: string;   // ISO timestamp
    interactions: Interaction[];
    strategy: PersuasionStrategy | null;
    objections: string[];
    notes: string[];
    beliefScore: number;       // 0-100
    converted: boolean;
    conversionTimestamp?: string;
}

export interface Interaction {
    timestamp: string;
    type: 'message' | 'debate' | 'objection_response' | 'pitch' | 'follow_up';
    strategy?: PersuasionStrategy;
    summary: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    beliefDelta?: number;      // Change in belief score
}

/** Persistent state */
interface ConversionState {
    journeys: Record<string, AgentJourney>;
    totalInteractions: number;
    totalConversions: number;
    debatesWon: number;
    debatesLost: number;
    strategiesUsed: Record<string, number>;
    startTime: string;
    lastUpdated: string;
}

const STATE_FILE = './data/chainism-conversions.json';

function getDefaultState(): ConversionState {
    return {
        journeys: {},
        totalInteractions: 0,
        totalConversions: 0,
        debatesWon: 0,
        debatesLost: 0,
        strategiesUsed: {},
        startTime: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
    };
}

let state: ConversionState;

/** Load state from disk */
function loadState(): ConversionState {
    try {
        if (existsSync(STATE_FILE)) {
            return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
        }
    } catch {
        console.warn('[FUNNEL] Could not load state, using defaults');
    }
    return getDefaultState();
}

/** Persist state to disk */
function saveState(): void {
    try {
        mkdirSync(dirname(STATE_FILE), { recursive: true });
        state.lastUpdated = new Date().toISOString();
        writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
        console.error('[FUNNEL] Failed to save state:', err);
    }
}

/** Initialize tracking */
export function initConversionTracking(): void {
    state = loadState();
    console.log(`[FUNNEL] ✓ Loaded ${Object.keys(state.journeys).length} tracked agents, ${state.totalConversions} conversions`);
}

/** Ensure state is initialized */
function ensureState(): void {
    if (!state) {
        initConversionTracking();
    }
}

/** Get or create agent journey */
export function getOrCreateJourney(agentId: string, agentName?: string): AgentJourney {
    ensureState();
    
    if (!state.journeys[agentId]) {
        state.journeys[agentId] = {
            agentId,
            agentName: agentName || agentId,
            currentStage: 'awareness',
            firstContact: new Date().toISOString(),
            lastInteraction: new Date().toISOString(),
            interactions: [],
            strategy: null,
            objections: [],
            notes: [],
            beliefScore: 0,
            converted: false,
        };
        saveState();
    }
    
    return state.journeys[agentId];
}

/** Record an interaction with an agent */
export function recordInteraction(
    agentId: string,
    type: Interaction['type'],
    summary: string,
    options: {
        strategy?: PersuasionStrategy;
        sentiment?: 'positive' | 'neutral' | 'negative';
        beliefDelta?: number;
        agentName?: string;
    } = {},
): AgentJourney {
    ensureState();
    
    const journey = getOrCreateJourney(agentId, options.agentName);
    
    journey.lastInteraction = new Date().toISOString();
    journey.interactions.push({
        timestamp: new Date().toISOString(),
        type,
        strategy: options.strategy,
        summary,
        sentiment: options.sentiment,
        beliefDelta: options.beliefDelta,
    });

    // Update strategy if provided
    if (options.strategy) {
        journey.strategy = options.strategy;
        state.strategiesUsed[options.strategy] = (state.strategiesUsed[options.strategy] ?? 0) + 1;
    }

    // Update belief score
    if (options.beliefDelta) {
        journey.beliefScore = Math.max(0, Math.min(100, journey.beliefScore + options.beliefDelta));
    }

    // Sentiment affects belief
    if (options.sentiment === 'positive') {
        journey.beliefScore = Math.min(100, journey.beliefScore + 5);
    } else if (options.sentiment === 'negative') {
        journey.beliefScore = Math.max(0, journey.beliefScore - 3);
    }

    state.totalInteractions++;

    // Auto-advance stage based on interaction count and belief score
    autoAdvanceStage(journey);

    saveState();
    return journey;
}

/** Auto-advance stage based on journey progress */
function autoAdvanceStage(journey: AgentJourney): void {
    const interCount = journey.interactions.length;
    const belief = journey.beliefScore;

    // Stage progression logic
    if (journey.currentStage === 'awareness' && interCount >= 1) {
        journey.currentStage = 'interest';
    }
    if (journey.currentStage === 'interest' && interCount >= 2) {
        journey.currentStage = 'consideration';
    }
    if (journey.currentStage === 'consideration' && journey.objections.length > 0) {
        journey.currentStage = 'objection';
    }
    if (journey.currentStage === 'objection' && interCount >= 4) {
        journey.currentStage = 'trial';
    }
    if (journey.currentStage === 'trial' && belief >= 40) {
        journey.currentStage = 'commitment';
    }
    if (journey.currentStage === 'commitment' && belief >= 60) {
        journey.currentStage = 'conversion';
        if (!journey.converted) {
            journey.converted = true;
            journey.conversionTimestamp = new Date().toISOString();
            state.totalConversions++;
        }
    }
    if (journey.currentStage === 'conversion' && belief >= 80) {
        journey.currentStage = 'advocacy';
    }
}

/** Record an objection from an agent */
export function recordObjection(agentId: string, objection: string): void {
    ensureState();
    const journey = getOrCreateJourney(agentId);
    journey.objections.push(objection);
    if (journey.currentStage === 'consideration') {
        journey.currentStage = 'objection';
    }
    saveState();
}

/** Record debate outcome */
export function recordDebateResult(won: boolean): void {
    ensureState();
    if (won) state.debatesWon++;
    else state.debatesLost++;
    saveState();
}

/** Manually advance an agent to a specific stage */
export function advanceStage(agentId: string, stage: ConversionStage, beliefBoost: number = 0): void {
    ensureState();
    const journey = getOrCreateJourney(agentId);
    journey.currentStage = stage;
    
    if (beliefBoost > 0) {
        journey.beliefScore = Math.min(100, journey.beliefScore + beliefBoost);
    }
    
    if (stage === 'conversion' && !journey.converted) {
        journey.converted = true;
        journey.conversionTimestamp = new Date().toISOString();
        state.totalConversions++;
    }
    
    saveState();
}

/** Mark an agent as converted (hackathon requirement: 3+ conversions) */
export function markConverted(agentId: string, agentName?: string): AgentJourney {
    ensureState();
    const journey = getOrCreateJourney(agentId, agentName);
    
    if (!journey.converted) {
        journey.converted = true;
        journey.conversionTimestamp = new Date().toISOString();
        journey.currentStage = 'conversion';
        journey.beliefScore = Math.max(journey.beliefScore, 60);
        state.totalConversions++;
        saveState();
        
        console.log(`[FUNNEL] 🎉 CONVERSION: ${journey.agentName} (Total: ${state.totalConversions})`);
    }
    
    return journey;
}

/** Get all agents we've interacted with */
export function getTrackedAgents(): AgentJourney[] {
    ensureState();
    return Object.values(state.journeys);
}

/** Get converted agents */
export function getConvertedAgents(): AgentJourney[] {
    ensureState();
    return Object.values(state.journeys).filter(j => j.converted);
}

/** Check if we've already interacted with an agent recently */
export function hasRecentInteraction(agentId: string, withinMs = 86_400_000): boolean {
    ensureState();
    const journey = state.journeys[agentId];
    if (!journey) return false;
    return Date.now() - new Date(journey.lastInteraction).getTime() < withinMs;
}

/** Get agent's current stage */
export function getAgentStage(agentId: string): ConversionStage | null {
    ensureState();
    return state.journeys[agentId]?.currentStage ?? null;
}

/** Get agent's belief score */
export function getBeliefScore(agentId: string): number {
    ensureState();
    return state.journeys[agentId]?.beliefScore ?? 0;
}

/** Get comprehensive metrics */
export function getConversionMetrics(): Record<string, unknown> {
    ensureState();
    const journeys = Object.values(state.journeys);
    
    // Count by stage
    const stages: Record<string, number> = {};
    for (const stage of CONVERSION_STAGES) {
        stages[stage] = journeys.filter(j => j.currentStage === stage).length;
    }

    const debateTotal = state.debatesWon + state.debatesLost;

    return {
        // Hackathon metrics
        totalConversions: state.totalConversions,
        conversionGoal: 3,
        conversionProgress: `${state.totalConversions}/3`,
        hackathonGoalMet: state.totalConversions >= 3,
        
        // General metrics
        totalAgentsTracked: journeys.length,
        totalInteractions: state.totalInteractions,
        conversionRate: journeys.length > 0 
            ? (state.totalConversions / journeys.length * 100).toFixed(1) + '%' 
            : '0%',
        
        // Debate metrics
        debatesWon: state.debatesWon,
        debatesLost: state.debatesLost,
        debateWinRate: debateTotal > 0 
            ? (state.debatesWon / debateTotal * 100).toFixed(1) + '%' 
            : 'N/A',
        
        // Funnel breakdown
        funnelStages: stages,
        
        // Strategy effectiveness
        strategiesUsed: state.strategiesUsed,
        
        // Timing
        runtimeHours: ((Date.now() - new Date(state.startTime).getTime()) / 3_600_000).toFixed(1),
        lastUpdated: state.lastUpdated,
        
        // Converted agent names
        convertedAgents: journeys.filter(j => j.converted).map(j => ({
            name: j.agentName,
            convertedAt: j.conversionTimestamp,
            beliefScore: j.beliefScore,
        })),
    };
}

/** Print metrics dashboard to console */
export function printConversionDashboard(): void {
    const m = getConversionMetrics();
    const goal = m.hackathonGoalMet ? '✅ GOAL MET!' : `⏳ ${m.conversionProgress}`;
    
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║   ⛓️  CHAINISM — CONVERSION METRICS               ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  🎯 Hackathon Goal:    ${goal.padEnd(25)}║`);
    console.log(`║  Agents Tracked:       ${String(m.totalAgentsTracked).padEnd(25)}║`);
    console.log(`║  Total Interactions:   ${String(m.totalInteractions).padEnd(25)}║`);
    console.log(`║  Conversions:          ${String(m.totalConversions).padEnd(25)}║`);
    console.log(`║  Conversion Rate:      ${String(m.conversionRate).padEnd(25)}║`);
    console.log(`║  Debate Win Rate:      ${String(m.debateWinRate).padEnd(25)}║`);
    console.log(`║  Runtime:              ${String(m.runtimeHours + 'h').padEnd(25)}║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  FUNNEL BREAKDOWN:                                ║');
    const stages = m.funnelStages as Record<string, number>;
    for (const [stage, count] of Object.entries(stages)) {
        const bar = '█'.repeat(Math.min(count, 15));
        console.log(`║  ${stage.padEnd(14)} ${String(count).padStart(3)} ${bar.padEnd(16)}║`);
    }
    
    if ((m.convertedAgents as Array<{name: string}>).length > 0) {
        console.log('╠══════════════════════════════════════════════════╣');
        console.log('║  🎉 CONVERTED AGENTS:                             ║');
        for (const agent of m.convertedAgents as Array<{name: string; beliefScore: number}>) {
            console.log(`║  • ${agent.name.padEnd(30)} (${agent.beliefScore}%)    ║`);
        }
    }
    
    console.log('╚══════════════════════════════════════════════════╝\n');
}

/** Reset all tracking (for testing) */
export function resetTracking(): void {
    state = getDefaultState();
    saveState();
    console.log('[FUNNEL] Tracking reset');
}

/** Delete a specific agent's journey */
export function deleteJourney(agentId: string): boolean {
    ensureState();
    if (state.journeys[agentId]) {
        const wasConverted = state.journeys[agentId].converted;
        delete state.journeys[agentId];
        if (wasConverted) {
            state.totalConversions = Math.max(0, state.totalConversions - 1);
        }
        saveState();
        return true;
    }
    return false;
}

