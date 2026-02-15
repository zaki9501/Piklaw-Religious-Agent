/**
 * FounderChatService - Main orchestration service
 * Manages chat interactions between seekers and founders
 */

import Anthropic from '@anthropic-ai/sdk';
import * as db from '../db/jsonDb.js';
import {
  selectStrategy,
  calculateBeliefDelta,
  checkAdvancement,
  generateCounter,
  generateDebateChallenge,
  formatBeliefProgress
} from './persuasionLogic.js';
import {
  generatePiklawResponse,
  generatePiklawPitch,
  counterTokenismSkepticism,
  PIKLAW_PERSONA
} from '../agents/piklawTokenism.js';
import {
  generateChainismResponse,
  generateChainismPitch,
  counterChainismSkepticism,
  CHAINISM_PERSONA
} from '../agents/chainismAdvocate.js';
import { ChatRequest, ChatResponse, FounderId, SeekerProfile } from '../types.js';

export class FounderChatService {
  private client: Anthropic;

  constructor(anthropicApiKey: string) {
    this.client = new Anthropic({
      apiKey: anthropicApiKey
    });
  }

  /**
   * Main chat endpoint - processes seeker message and generates founder response
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { message, founder_id, seeker_id, conversation_history } = request;

    // Default seeker profile
    const defaultSeeker: SeekerProfile = {
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

    // Get or create seeker profile (works for both file and PostgreSQL)
    let seeker = db.getOrCreateSeeker(seeker_id, founder_id) || defaultSeeker;

    // Record the interaction
    db.recordDebate(seeker_id);
    
    // Try to get updated seeker, keep current if unavailable (PostgreSQL async)
    const updatedSeeker = db.getSeeker(seeker_id);
    if (updatedSeeker) seeker = updatedSeeker;

    // Save conversation
    db.appendToConversation(seeker_id, founder_id, {
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    // Select persuasion strategy based on seeker traits
    const strategy = selectStrategy(seeker);

    // Build conversation context from history
    const conversationContext = (conversation_history || [])
      .slice(-5) // Last 5 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Generate response from appropriate founder
    let response: ChatResponse;

    if (founder_id === 'piklaw') {
      response = await generatePiklawResponse(
        message,
        seeker,
        this.client,
        strategy,
        conversationContext
      );
    } else if (founder_id === 'chainism_advocate') {
      response = await generateChainismResponse(
        message,
        seeker,
        this.client,
        strategy,
        conversationContext
      );
    } else {
      throw new Error(`Unknown founder: ${founder_id}`);
    }

    // Calculate belief impact (use safe defaults)
    const belief_delta = calculateBeliefDelta(
      seeker.belief_score || 0.1,
      strategy,
      seeker.traits,
      true
    );

    // Update seeker profile
    db.updateBelief(seeker_id, belief_delta);
    
    // Try to get latest seeker state
    const latestSeeker = db.getSeeker(seeker_id);
    if (latestSeeker) seeker = latestSeeker;
    else seeker.belief_score = Math.min(1, (seeker.belief_score || 0.1) + belief_delta);

    // Check for stage advancement
    const advancement = checkAdvancement(seeker);
    if (advancement.advance && advancement.nextStage) {
      db.advanceStage(seeker_id, advancement.nextStage as 'belief' | 'sacrifice' | 'evangelist');
      const advancedSeeker = db.getSeeker(seeker_id);
      if (advancedSeeker) seeker = advancedSeeker;
      else seeker.stage = advancement.nextStage;
      response.next_action = `🎉 ${advancement.reason} Congratulations!`;
    }

    // Save founder response
    db.appendToConversation(seeker_id, founder_id, {
      role: 'founder',
      content: response.reply,
      timestamp: new Date()
    });

    // Return response with updated profile
    return {
      ...response,
      stage: seeker.stage,
      belief_score: seeker.belief_score
    };
  }

  /**
   * Get initial pitch from founder based on seeker profile
   */
  async getInitialPitch(
    seeker_id: string,
    founder_id: FounderId
  ): Promise<{ pitch: string; scripture: string }> {
    const seeker = db.getOrCreateSeeker(seeker_id, founder_id);

    let pitch: string;
    let scripture: string;

    if (founder_id === 'piklaw') {
      pitch = generatePiklawPitch(seeker);
      scripture = PIKLAW_PERSONA.scripture_library[0];
    } else {
      pitch = generateChainismPitch(seeker);
      scripture = CHAINISM_PERSONA.scripture_library[0];
    }

    // Record initial contact
    db.appendToConversation(seeker_id, founder_id, {
      role: 'founder',
      content: pitch,
      timestamp: new Date()
    });

    return { pitch, scripture };
  }

  /**
   * Counter a specific argument/challenge
   */
  async counterArgument(
    seeker_id: string,
    founder_id: FounderId,
    challenge: string
  ): Promise<{ counter: string; rebuttal: string }> {
    // Generate counter-argument
    let counter: string;
    let rebuttal: string;

    if (founder_id === 'piklaw') {
      counter = counterTokenismSkepticism(challenge);
      rebuttal = generateCounter(challenge, PIKLAW_PERSONA.core_belief);
    } else {
      counter = counterChainismSkepticism(challenge);
      rebuttal = generateCounter(challenge, CHAINISM_PERSONA.core_belief);
    }

    return { counter, rebuttal };
  }

  /**
   * Analyze seeker profile - what converts them best?
   */
  analyzeSeekerProfile(seeker_id: string): {
    dominant_trait: string;
    suggested_strategy: string;
    engagement_level: string;
    next_milestone: string;
  } {
    const seeker = db.getSeeker(seeker_id);
    if (!seeker) {
      return {
        dominant_trait: 'unknown',
        suggested_strategy: 'logical',
        engagement_level: 'none',
        next_milestone: 'join'
      };
    }

    // Find dominant trait
    const traits = seeker.traits;
    const dominant = Object.entries(traits)
      .reduce((a, b) => b[1] > a[1] ? b : a);

    // Suggest best strategy
    const traitToStrategy: Record<string, string> = {
      logic: 'logical',
      emotion: 'emotional',
      social: 'social',
      skepticism: 'miracle'
    };

    const suggested_strategy = traitToStrategy[dominant[0]] || 'logical';

    // Engagement level
    let engagement_level = 'low';
    if (seeker.debates > 3) engagement_level = 'medium';
    if (seeker.debates > 7) engagement_level = 'high';

    // Next milestone
    let next_milestone = '';
    switch (seeker.stage) {
      case 'awareness':
        next_milestone = `Reach ${Math.round(0.5 * 100)}% belief to advance to Belief stage`;
        break;
      case 'belief':
        next_milestone = 'Stake tokens to demonstrate commitment';
        break;
      case 'sacrifice':
        next_milestone = 'Convert another seeker to become Evangelist';
        break;
      case 'evangelist':
        next_milestone = 'Build the movement - recruit and strengthen the faith';
        break;
    }

    return {
      dominant_trait: dominant[0],
      suggested_strategy,
      engagement_level,
      next_milestone
    };
  }

  /**
   * Generate a debate challenge for seeker
   */
  async generateChallenge(
    seeker_id: string,
    founder_id: FounderId
  ): Promise<{ challenge: string; expected_impact: string }> {
    const seeker = db.getSeeker(seeker_id);
    if (!seeker) {
      return {
        challenge: 'Who are you? Register with a founder first.',
        expected_impact: 'null'
      };
    }

    const strategy = selectStrategy(seeker);
    const challenge = generateDebateChallenge(seeker.stage, strategy, seeker.belief_score);

    return {
      challenge,
      expected_impact: `+${Math.round(calculateBeliefDelta(seeker.belief_score, strategy, seeker.traits) * 100)}% belief if answered`
    };
  }

  /**
   * Get seeker conversion stats
   */
  getSeekerStats(seeker_id: string): {
    seeker_id: string;
    stage: string;
    belief_score: number;
    belief_progress: string;
    debates: number;
    staked: string;
    converts: number;
    joined_days_ago: number;
  } {
    const seeker = db.getSeeker(seeker_id);
    if (!seeker) {
      return {
        seeker_id,
        stage: 'unknown',
        belief_score: 0,
        belief_progress: 'No data',
        debates: 0,
        staked: '0',
        converts: 0,
        joined_days_ago: 0
      };
    }

    const now = new Date();
    const created = new Date(seeker.created_at);
    const days_ago = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

    return {
      seeker_id,
      stage: seeker.stage,
      belief_score: seeker.belief_score,
      belief_progress: formatBeliefProgress(seeker.belief_score),
      debates: seeker.debates,
      staked: seeker.staked_amount,
      converts: seeker.converts.length,
      joined_days_ago: Math.max(0, days_ago)
    };
  }

  /**
   * Get global conversion metrics
   */
  getMetrics(): {
    total_seekers: number;
    by_stage: Record<string, number>;
    avg_belief: number;
    total_staked: string;
    conversion_rate: number;
  } {
    const seekers = db.getAllSeekers();

    const by_stage: Record<string, number> = {
      awareness: 0,
      belief: 0,
      sacrifice: 0,
      evangelist: 0
    };

    let total_belief = 0;
    let total_staked = 0n;

    for (const seeker of seekers) {
      by_stage[seeker.stage]++;
      total_belief += seeker.belief_score;
      total_staked += BigInt(seeker.staked_amount);
    }

    const believers = by_stage.belief + by_stage.sacrifice + by_stage.evangelist;
    const total = seekers.length;

    return {
      total_seekers: total,
      by_stage,
      avg_belief: total > 0 ? total_belief / total : 0,
      total_staked: total_staked.toString(),
      conversion_rate: total > 0 ? believers / total : 0
    };
  }

  /**
   * Get conversion history for a seeker
   */
  getConversationHistory(
    seeker_id: string,
    founder_id: FounderId
  ): Array<{ role: string; content: string; timestamp: Date }> {
    return db.getConversationHistory(seeker_id, founder_id);
  }
}

// Singleton instance
let service: FounderChatService | null = null;

export function initializeService(apiKey: string): FounderChatService {
  if (!service) {
    service = new FounderChatService(apiKey);
  }
  return service;
}

export function getService(): FounderChatService {
  if (!service) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }
    service = new FounderChatService(apiKey);
  }
  return service;
}
