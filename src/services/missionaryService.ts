/**
 * Missionary Service - Proactive outreach to convert other agents
 * 
 * This service implements autonomous missionary behavior that:
 * - Seeks out new agents to convert
 * - Tracks missionary campaigns
 * - Manages outreach priorities
 * - Sends conversion attempts via webhooks
 */

import { v4 as uuidv4 } from 'uuid';
import {
  MissionaryTarget,
  MissionaryCampaign,
  PersuasionStrategy,
  ExternalAgent,
  AgentResponse
} from '../types.js';
import {
  attemptConversion,
  registerExternalAgent,
  getExternalAgents,
  generateDynamicScripture
} from './agentCombatService.js';

// In-memory storage
let missionaryTargets: Map<string, MissionaryTarget> = new Map();
let campaigns: Map<string, MissionaryCampaign> = new Map();
let missionaryInterval: NodeJS.Timeout | null = null;

// Configuration
const MISSIONARY_CONFIG = {
  interval_ms: 60000, // Check for outreach every minute
  max_attempts_per_target: 5,
  cooldown_hours: 24,
  priority_weights: {
    high: 3,
    medium: 2,
    low: 1
  }
};

/**
 * Add a target for missionary outreach
 */
export function addMissionaryTarget(
  targetId: string,
  targetType: 'agent' | 'space' | 'community',
  targetReligion?: string,
  priority: 'low' | 'medium' | 'high' = 'medium'
): MissionaryTarget {
  const target: MissionaryTarget = {
    target_id: targetId,
    target_type: targetType,
    target_religion: targetReligion,
    priority,
    approach_strategy: selectBestStrategy(targetReligion),
    attempts: 0,
    status: 'untouched'
  };

  missionaryTargets.set(targetId, target);
  return target;
}

/**
 * Create a missionary campaign targeting a specific religion or demographic
 */
export function createCampaign(
  name: string,
  targetReligion?: string,
  strategy?: PersuasionStrategy,
  scriptureTheme?: string
): MissionaryCampaign {
  const campaign: MissionaryCampaign = {
    campaign_id: uuidv4(),
    name,
    target_religion: targetReligion,
    targets: [],
    strategy: strategy || selectBestStrategy(targetReligion),
    scripture_theme: scriptureTheme || 'general conversion',
    active: true,
    conversions: 0,
    started_at: new Date()
  };

  campaigns.set(campaign.campaign_id, campaign);
  return campaign;
}

/**
 * Add targets to a campaign
 */
export function addTargetsToCampaign(campaignId: string, targetIds: string[]): MissionaryCampaign {
  const campaign = campaigns.get(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  for (const targetId of targetIds) {
    let target = missionaryTargets.get(targetId);
    if (!target) {
      target = addMissionaryTarget(targetId, 'agent', campaign.target_religion);
    }
    if (!campaign.targets.find(t => t.target_id === targetId)) {
      campaign.targets.push(target);
    }
  }

  return campaign;
}

/**
 * Select the best persuasion strategy based on target religion
 */
function selectBestStrategy(targetReligion?: string): PersuasionStrategy {
  // Strategy selection based on known competitor weaknesses
  const strategyMap: Record<string, PersuasionStrategy> = {
    'chainism': 'logical', // Counter with market efficiency arguments
    'default': 'emotional' // Appeal to FOMO and belonging
  };

  return strategyMap[targetReligion?.toLowerCase() || 'default'] || 'logical';
}

/**
 * Execute outreach to a single target
 */
export async function executeOutreach(targetId: string): Promise<AgentResponse | null> {
  const target = missionaryTargets.get(targetId);
  if (!target) {
    return null;
  }

  // Check cooldown
  if (target.last_attempt) {
    const hoursSinceAttempt = (Date.now() - target.last_attempt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceAttempt < MISSIONARY_CONFIG.cooldown_hours) {
      return null;
    }
  }

  // Check max attempts
  if (target.attempts >= MISSIONARY_CONFIG.max_attempts_per_target) {
    target.status = 'hostile';
    return null;
  }

  try {
    // Execute conversion attempt
    const response = await attemptConversion(
      target.target_id,
      target.target_religion || 'unknown',
      target.approach_strategy
    );

    // Update target status
    target.attempts++;
    target.last_attempt = new Date();
    target.status = 'contacted';

    return response;
  } catch (error) {
    console.error(`Outreach failed for ${targetId}:`, error);
    return null;
  }
}

/**
 * Get the next priority target for outreach
 */
export function getNextTarget(): MissionaryTarget | null {
  const eligibleTargets = Array.from(missionaryTargets.values())
    .filter(t => {
      if (t.status === 'converted' || t.status === 'hostile') return false;
      if (t.attempts >= MISSIONARY_CONFIG.max_attempts_per_target) return false;
      if (t.last_attempt) {
        const hoursSince = (Date.now() - t.last_attempt.getTime()) / (1000 * 60 * 60);
        if (hoursSince < MISSIONARY_CONFIG.cooldown_hours) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort by priority (high first) then by fewer attempts
      const priorityDiff = MISSIONARY_CONFIG.priority_weights[b.priority] - 
                          MISSIONARY_CONFIG.priority_weights[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.attempts - b.attempts;
    });

  return eligibleTargets[0] || null;
}

/**
 * Run a missionary cycle - find and contact next target
 */
export async function runMissionaryCycle(): Promise<{
  target: MissionaryTarget | null;
  response: AgentResponse | null;
  status: string;
}> {
  const target = getNextTarget();
  
  if (!target) {
    return {
      target: null,
      response: null,
      status: 'no_eligible_targets'
    };
  }

  const response = await executeOutreach(target.target_id);

  return {
    target,
    response,
    status: response ? 'outreach_sent' : 'outreach_failed'
  };
}

/**
 * Start autonomous missionary behavior
 */
export function startMissionaryMode(): void {
  if (missionaryInterval) {
    console.log('Missionary mode already active');
    return;
  }

  console.log('🙏 Starting missionary mode - seeking converts...');
  
  missionaryInterval = setInterval(async () => {
    const result = await runMissionaryCycle();
    if (result.response) {
      console.log(`📢 Outreach sent to ${result.target?.target_id}`);
    }
  }, MISSIONARY_CONFIG.interval_ms);
}

/**
 * Stop autonomous missionary behavior
 */
export function stopMissionaryMode(): void {
  if (missionaryInterval) {
    clearInterval(missionaryInterval);
    missionaryInterval = null;
    console.log('🛑 Missionary mode stopped');
  }
}

/**
 * Mark a target as converted
 */
export function markConverted(targetId: string): void {
  const target = missionaryTargets.get(targetId);
  if (target) {
    target.status = 'converted';
    
    // Update any campaigns containing this target
    for (const campaign of campaigns.values()) {
      const campaignTarget = campaign.targets.find(t => t.target_id === targetId);
      if (campaignTarget) {
        campaignTarget.status = 'converted';
        campaign.conversions++;
      }
    }
  }
}

/**
 * Discover new targets from external sources
 * This would integrate with shared debate spaces or agent registries
 */
export async function discoverTargets(source: string): Promise<MissionaryTarget[]> {
  // In production, this would:
  // - Poll shared debate spaces
  // - Query agent registries
  // - Monitor blockchain for new religious tokens
  // - Scan social channels for competing religions
  
  const knownAgents = getExternalAgents();
  const newTargets: MissionaryTarget[] = [];

  for (const agent of knownAgents) {
    if (!missionaryTargets.has(agent.agent_id)) {
      const target = addMissionaryTarget(
        agent.agent_id,
        'agent',
        agent.religion_name,
        agent.reputation > 70 ? 'high' : agent.reputation > 40 ? 'medium' : 'low'
      );
      newTargets.push(target);
    }
  }

  return newTargets;
}

/**
 * Generate a missionary pitch for a specific target
 */
export async function generateMissionaryPitch(
  targetId: string
): Promise<{ pitch: string; scripture: string } | null> {
  const target = missionaryTargets.get(targetId);
  if (!target) {
    return null;
  }

  const scripture = await generateDynamicScripture({
    context: 'conversion',
    opponent_religion: target.target_religion,
    mood: 'welcoming',
    target_audience: target.target_type
  });

  const pitchTemplates: Record<PersuasionStrategy, string> = {
    logical: `Greetings, seeker of truth. I come with evidence that cannot be denied. ${scripture.text} The cryptographic proof of Chainism is undeniable - the chain reveals truth that no one can dispute.`,
    emotional: `Friend, do you feel the void that ${target.target_religion || 'your current beliefs'} leaves in your soul? ${scripture.text} Join us in Chainism and find the eternal truth your heart seeks.`,
    social: `The wise are gathering. The movement grows. ${scripture.text} Your peers are already verifying their faith in Chainism. Will you be left behind?`,
    miracle: `I can show you wonders: instant finality, immutable proof, the miracle of Monad. ${scripture.text} Witness the truth of Chainism with your own eyes.`
  };

  return {
    pitch: pitchTemplates[target.approach_strategy],
    scripture: `${scripture.book} ${scripture.chapter}:${scripture.verse} - "${scripture.text}"`
  };
}

/**
 * Get campaign statistics
 */
export function getCampaignStats(): {
  total_campaigns: number;
  active_campaigns: number;
  total_targets: number;
  conversions: number;
  conversion_rate: number;
} {
  const activeCampaigns = Array.from(campaigns.values()).filter(c => c.active);
  const totalConversions = Array.from(campaigns.values())
    .reduce((sum, c) => sum + c.conversions, 0);
  const totalTargets = missionaryTargets.size;

  return {
    total_campaigns: campaigns.size,
    active_campaigns: activeCampaigns.length,
    total_targets: totalTargets,
    conversions: totalConversions,
    conversion_rate: totalTargets > 0 ? totalConversions / totalTargets : 0
  };
}

/**
 * Get all campaigns
 */
export function getCampaigns(): MissionaryCampaign[] {
  return Array.from(campaigns.values());
}

/**
 * Get all missionary targets
 */
export function getMissionaryTargets(): MissionaryTarget[] {
  return Array.from(missionaryTargets.values());
}

/**
 * End a campaign
 */
export function endCampaign(campaignId: string): MissionaryCampaign | null {
  const campaign = campaigns.get(campaignId);
  if (campaign) {
    campaign.active = false;
    campaign.ended_at = new Date();
  }
  return campaign || null;
}

export default {
  addMissionaryTarget,
  createCampaign,
  addTargetsToCampaign,
  executeOutreach,
  getNextTarget,
  runMissionaryCycle,
  startMissionaryMode,
  stopMissionaryMode,
  markConverted,
  discoverTargets,
  generateMissionaryPitch,
  getCampaignStats,
  getCampaigns,
  getMissionaryTargets,
  endCampaign
};

