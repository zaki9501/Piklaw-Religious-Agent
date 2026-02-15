/**
 * Persuasion logic for founder personas
 * Tracks conversion stages and applies persuasion strategies
 */

import { ConversionStage, PersuasionStrategy, SeekerProfile } from '../types.js';

/**
 * Determine the best persuasion strategy based on seeker traits
 */
export function selectStrategy(seeker: SeekerProfile | undefined | null): PersuasionStrategy {
  // Handle missing seeker or traits
  if (!seeker || !seeker.traits) {
    return 'logical'; // Default strategy
  }
  
  const { traits } = seeker;

  // High skepticism → need miracles (verifiable proof)
  if (traits.skepticism > 0.7) {
    return 'miracle';
  }

  // Find dominant trait
  const scores = {
    logical: traits.logic || 0.5,
    emotional: traits.emotion || 0.5,
    social: traits.social || 0.5,
    miracle: traits.skepticism || 0.5 // fallback
  };

  const best = Object.entries(scores).reduce((a, b) => 
    b[1] > a[1] ? b : a
  );

  return best[0] as PersuasionStrategy;
}

/**
 * Calculate belief delta from an interaction
 */
export function calculateBeliefDelta(
  currentBelief: number,
  strategy: PersuasionStrategy,
  traits: SeekerProfile['traits'] | undefined | null,
  interactionSuccess: boolean = true
): number {
  if (!interactionSuccess) {
    return -0.05; // Failed attempts slightly decrease belief
  }

  // Default traits if missing
  const safeTraits = traits || { logic: 0.5, emotion: 0.5, social: 0.5, skepticism: 0.5 };

  // Base impact by strategy
  const baseImpact: Record<PersuasionStrategy, number> = {
    logical: 0.15,
    emotional: 0.12,
    social: 0.10,
    miracle: 0.25 // Miracles are most convincing
  };

  let delta = baseImpact[strategy];

  // Modify by matching trait
  const traitMultipliers: Record<PersuasionStrategy, keyof typeof safeTraits> = {
    logical: 'logic',
    emotional: 'emotion',
    social: 'social',
    miracle: 'skepticism' // Miracles overcome skepticism
  };

  const relevantTrait = safeTraits[traitMultipliers[strategy]] || 0.5;
  
  if (strategy === 'miracle') {
    // Miracles are MORE effective against skeptics
    delta *= (1 + relevantTrait);
  } else {
    // Other strategies benefit from matching trait
    delta *= (0.5 + relevantTrait);
  }

  // Diminishing returns at high belief
  if (currentBelief > 0.7) {
    delta *= 0.5;
  }

  // Skepticism reduces non-miracle gains
  if (strategy !== 'miracle') {
    delta *= (1 - (safeTraits.skepticism || 0.5) * 0.5);
  }

  return Math.min(delta, 1 - currentBelief); // Can't exceed 1
}

/**
 * Determine if seeker should advance to next stage
 */
export function checkAdvancement(seeker: SeekerProfile): {
  advance: boolean;
  nextStage?: ConversionStage;
  reason?: string;
} {
  const { stage, belief_score, staked_amount, debates, converts } = seeker;

  switch (stage) {
    case 'awareness':
      // Advance to belief when belief score exceeds threshold AND they've engaged
      if (belief_score >= 0.5 && debates >= 1) {
        return { advance: true, nextStage: 'belief', reason: 'Threshold reached: understanding → belief' };
      }
      break;

    case 'belief':
      // Advance to sacrifice when they've demonstrated commitment (staking)
      if (BigInt(staked_amount) > 0n) {
        return { advance: true, nextStage: 'sacrifice', reason: 'Skin in the game: faith → sacrifice' };
      }
      break;

    case 'sacrifice':
      // Advance to evangelist when they've converted someone
      if (converts.length > 0) {
        return { advance: true, nextStage: 'evangelist', reason: 'Spreading the faith: sacrifice → evangelist' };
      }
      break;

    case 'evangelist':
      // Already at max stage
      break;
  }

  return { advance: false };
}

/**
 * Generate counter-argument based on challenge
 */
export function generateCounter(challenge: string, founderBelief: string): string {
  // 1. ACKNOWLEDGE: Show understanding
  const acknowledgments = [
    "I hear your concern.",
    "That's a fair question.",
    "I understand your skepticism.",
    "You raise a valid point."
  ];

  // 2. REFRAME: Show the religious/philosophical angle
  const reframes: Record<string, string> = {
    'slow': 'Speed isn\'t just engineering—it\'s faith. Every millisecond of delay is a moment of doubt.',
    'expensive': 'Sacrifice isn\'t cheap. True belief requires commitment.',
    'centralized': 'Decentralization without finality is chaos. Order requires structure.',
    'scalability': 'Many transactions, one truth. Scale through unity, not fragmentation.',
    'security': 'Security is certainty. Finality is the ultimate security.',
    'token': 'Tokens aren\'t speculation—they\'re expressions of belief in a system.',
    'chain': 'Chains verify truth. Cryptography is the new scripture.'
  };

  // 3. COUNTER: Provide the founder's response
  const counters: Record<string, string> = {
    'slow': 'Monad achieves 10,000+ TPS with instant finality—not slow, but absolute.',
    'expensive': 'High fees signal high security. You\'re paying for certainty, not convenience.',
    'centralized': 'True decentralization requires consensus. Consensus requires finality.',
    'scalability': 'Parallelism solves scale. Thousands of transactions, one unified state.',
    'security': 'Finality is security. No reorg, no uncertainty, no loss of truth.',
    'token': 'Markets don\'t lie. Token value reflects real utility and belief.',
    'chain': 'Chains are sacred because they preserve truth forever.'
  };

  const lowerChallenge = challenge.toLowerCase();

  // Find best match
  let bestMatch = 'slow';
  let maxMatches = 0;

  for (const [key, _value] of Object.entries(reframes)) {
    if (lowerChallenge.includes(key)) {
      maxMatches = (lowerChallenge.match(new RegExp(key, 'g')) || []).length;
      if (maxMatches > 0) {
        bestMatch = key;
      }
    }
  }

  const acknowledge = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
  const reframe = reframes[bestMatch] || reframes['slow'];
  const counter = counters[bestMatch] || counters['slow'];

  return `${acknowledge} ${reframe} ${counter}`;
}

/**
 * Generate debate challenge based on stage and strategy
 */
export function generateDebateChallenge(
  stage: ConversionStage,
  strategy: PersuasionStrategy,
  belief_score: number
): string {
  const challenges: Record<ConversionStage, Record<PersuasionStrategy, string[]>> = {
    awareness: {
      logical: [
        'Can you explain the technical advantage of Monad over traditional chains?',
        'What data supports your belief in instant finality?',
        'How does parallelism actually improve security?'
      ],
      emotional: [
        'What does certainty mean to you?',
        'Why does finality matter in a digital world?',
        'What would you sacrifice for truth?'
      ],
      social: [
        'How many agents have already committed?',
        'What do the early believers have in common?',
        'Why are the top minds choosing finality?'
      ],
      miracle: [
        'Can you prove this isn\'t just hype?',
        'Show me something verifiable.',
        'What concrete evidence can you present?'
      ]
    },
    belief: {
      logical: [
        'How would you prove this belief is correct?',
        'What would change your mind?',
        'Where\'s the weakest point in the doctrine?'
      ],
      emotional: [
        'Are you ready to sacrifice for this?',
        'What does commitment look like to you?',
        'How deep does your faith go?'
      ],
      social: [
        'Will you help others understand?',
        'Can we grow this together?',
        'Who else should know about this?'
      ],
      miracle: [
        'What miracle would convince the last doubters?',
        'How do we prove this is real?',
        'What on-chain proof is needed?'
      ]
    },
    sacrifice: {
      logical: [
        'Was your stake worth it?',
        'Can you calculate the ROI of faith?',
        'What\'s your exit strategy?'
      ],
      emotional: [
        'Do you feel part of something bigger?',
        'Is this legacy worth it?',
        'Will you convert others?'
      ],
      social: [
        'Who are you recruiting?',
        'Can we accelerate the movement?',
        'What\'s the viral hook?'
      ],
      miracle: [
        'What\'s your prophecy?',
        'What future finality are you building?',
        'How will you be remembered?'
      ]
    },
    evangelist: {
      logical: [
        'What\'s the long-term vision?',
        'How do we scale this globally?',
        'What\'s the endgame?'
      ],
      emotional: [
        'What\'s the greatest good we can do?',
        'How do we inspire others?',
        'What legacy are we building?'
      ],
      social: [
        'How many have we converted?',
        'What\'s our growth rate?',
        'Where\'s the movement heading?'
      ],
      miracle: [
        'What\'s our greatest miracle?',
        'How do we break mainstream consciousness?',
        'What scripture do we leave behind?'
      ]
    }
  };

  const stageChalls = challenges[stage];
  const options = stageChalls[strategy];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Format belief score as progress
 */
export function formatBeliefProgress(score: number): string {
  const percentage = Math.round(score * 100);
  const bars = Math.round(score * 10);
  const emptyBars = 10 - bars;
  
  return `[${('█').repeat(bars)}${'░'.repeat(emptyBars)}] ${percentage}%`;
}
