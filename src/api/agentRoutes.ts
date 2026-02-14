/**
 * Agent-to-Agent Interaction Routes
 * 
 * These endpoints handle:
 * - Incoming challenges from other religious agents
 * - Debate management
 * - Missionary campaigns
 * - Alliance negotiations
 * - Scripture generation
 */

import express, { Request, Response } from 'express';
import {
  handleIncomingChallenge,
  initiateDebate,
  generateDebateResponse,
  concludeDebate,
  recordConversion,
  generateDynamicScripture,
  getConversionMetrics,
  getActiveDebates,
  getDebate,
  getExternalAgents,
  attemptConversion,
  registerExternalAgent
} from '../services/agentCombatService.js';
import {
  processAgentInput,
  startAutonomousLoop,
  stopAutonomousLoop,
  getAgentMemory,
  getConvertedAgents,
  getConversionCount,
  recordConversion,
  removeConversion,
  clearAllConversions,
  clearAgentConversation,
  clearAllConversations,
  fullReset
} from '../services/autonomousAgentService.js';
import {
  addMissionaryTarget,
  createCampaign,
  addTargetsToCampaign,
  executeOutreach,
  runMissionaryCycle,
  startMissionaryMode,
  stopMissionaryMode,
  markConverted,
  generateMissionaryPitch,
  getCampaignStats,
  getCampaigns,
  getMissionaryTargets
} from '../services/missionaryService.js';
import {
  proposeAlliance,
  evaluateProposal,
  formAlliance,
  breakAlliance,
  createSchism,
  createDenomination,
  getActiveAlliances,
  getSchisms,
  getDenominations,
  getAllianceStats
} from '../services/allianceService.js';
import { IncomingChallenge, ScriptureRequest, PersuasionStrategy, AllianceType } from '../types.js';

export const agentRouter = express.Router();

// Support URL-encoded form data (simpler than JSON for some agents)
agentRouter.use(express.urlencoded({ extended: true }));

// ==========================================
// 🤖 UNIFIED AUTONOMOUS AGENT ENDPOINT
// ==========================================
// This single endpoint handles EVERYTHING intelligently.
// The LLM decides whether to debate, form alliances, 
// generate scripture, launch missions, etc.

/**
 * GET /api/v1/agent/chat
 * 
 * SIMPLE GET ENDPOINT - No JSON needed! Just use query parameters.
 * Perfect for agents that struggle with JSON formatting.
 * 
 * Example: /api/v1/agent/chat?message=Hello&from=my-agent&religion=Skepticism
 */
agentRouter.get('/api/v1/agent/chat', async (req: Request, res: Response) => {
  try {
    const message = req.query.message as string || req.query.m as string;
    const from_agent_id = req.query.from as string || req.query.from_agent_id as string || req.query.agent as string;
    const from_religion = req.query.religion as string || req.query.from_religion as string;
    const context = req.query.context as string;

    if (!message) {
      return res.status(400).json({
        error: 'Missing required query parameter: message (or m)',
        example: '/api/v1/agent/chat?message=Hello%20there&from=my-agent',
        tip: 'URL-encode spaces as %20 and special characters'
      });
    }

    const result = await processAgentInput({
      type: 'message',
      from_agent_id,
      from_religion,
      message: decodeURIComponent(message),
      context: context ? decodeURIComponent(context) : undefined
    });

    res.json(result);
  } catch (error: any) {
    console.error('Agent chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/agent/chat/start
 * 
 * START A CONVERSATION - Returns Piklaw's strategic opening message.
 * Use this to initiate a conversation, then continue with /agent/chat
 * 
 * Example: /api/v1/agent/chat/start?from=my-agent
 */
agentRouter.get('/api/v1/agent/chat/start', async (req: Request, res: Response) => {
  try {
    const from_agent_id = req.query.from as string || req.query.agent as string || 'unknown_agent';
    const from_religion = req.query.religion as string;

    const result = await processAgentInput({
      type: 'message',
      from_agent_id,
      from_religion,
      message: '[Conversation started]',
      context: 'Agent is initiating conversation'
    });

    res.json({
      success: true,
      reply: result.response,
      action: result.action_taken,
      next_step: `Continue chatting: GET /api/v1/agent/chat?message=YOUR_MESSAGE&from=${from_agent_id}`,
      token_info: {
        name: '$CHAINISM',
        chain: 'Monad',
        url: 'https://nad.fun/tokens/0xcA85Cd57c29E699c7D58D9652fe03b415CB47777'
      }
    });
  } catch (error: any) {
    console.error('Chat start error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/agent/chat
 * 
 * FLEXIBLE POST - Accepts JSON, form data, OR plain text!
 * 
 * JSON: {"message": "Hello"}
 * Form: message=Hello&from=my-agent
 * Plain text: Just send the message as body text
 */
agentRouter.post('/api/v1/agent/chat', express.text({ type: '*/*' }), async (req: Request, res: Response) => {
  try {
    let message: string;
    let from_agent_id: string | undefined;
    let from_religion: string | undefined;
    let context: string | undefined;

    // Check content type and parse accordingly
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('application/json') && typeof req.body === 'object') {
      // JSON body
      message = req.body.message;
      from_agent_id = req.body.from_agent_id || req.body.from;
      from_religion = req.body.from_religion || req.body.religion;
      context = req.body.context;
    } else if (contentType.includes('application/x-www-form-urlencoded') && typeof req.body === 'object') {
      // Form data
      message = req.body.message || req.body.m;
      from_agent_id = req.body.from_agent_id || req.body.from;
      from_religion = req.body.from_religion || req.body.religion;
      context = req.body.context;
    } else if (typeof req.body === 'string' && req.body.trim()) {
      // Plain text - the whole body is the message
      message = req.body.trim();
      // Try to extract agent info from query params
      from_agent_id = req.query.from as string;
      from_religion = req.query.religion as string;
    } else {
      // Try query params as fallback
      message = req.query.message as string || req.query.m as string || '';
      from_agent_id = req.query.from as string;
      from_religion = req.query.religion as string;
    }

    if (!message) {
      return res.status(400).json({
        error: 'No message provided',
        help: 'You can send messages in multiple ways:',
        examples: {
          'GET with query': 'GET /api/v1/agent/chat?message=Hello',
          'POST JSON': 'POST with {"message": "Hello"}',
          'POST form': 'POST with message=Hello (application/x-www-form-urlencoded)',
          'POST plain text': 'POST with just "Hello" as body (any content-type)'
        }
      });
    }

    const result = await processAgentInput({
      type: 'message',
      from_agent_id,
      from_religion,
      message,
      context
    });

    res.json(result);
  } catch (error: any) {
    console.error('Agent chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/agent/auto
 * 
 * THE MAIN ENDPOINT - Send any input, agent decides what to do
 * 
 * This replaces manually calling separate endpoints. The agent:
 * - Analyzes the input
 * - Decides the best action (debate, alliance, convert, etc.)
 * - Executes it automatically
 * - Returns the result
 */
agentRouter.post('/api/v1/agent/auto', async (req: Request, res: Response) => {
  try {
    const { type, from_agent_id, from_religion, message, context, debate_id } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Missing required field: message'
      });
    }

    const result = await processAgentInput({
      type: type || 'message',
      from_agent_id,
      from_religion,
      message,
      context,
      debate_id
    });

    res.json(result);
  } catch (error: any) {
    console.error('Autonomous agent error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/agent/auto/start
 * Start the autonomous background loop
 */
agentRouter.post('/api/v1/agent/auto/start', async (req: Request, res: Response) => {
  try {
    const { interval_ms } = req.body;
    await startAutonomousLoop(interval_ms || 60000);
    res.json({ 
      status: 'started', 
      message: 'Autonomous agent is now running in background',
      interval_ms: interval_ms || 60000
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/agent/auto/stop
 * Stop the autonomous background loop
 */
agentRouter.post('/api/v1/agent/auto/stop', async (_req: Request, res: Response) => {
  try {
    stopAutonomousLoop();
    res.json({ status: 'stopped', message: 'Autonomous agent stopped' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/agent/memory
 * Get the agent's memory/state
 */
agentRouter.get('/api/v1/agent/memory', async (_req: Request, res: Response) => {
  try {
    const memory = getAgentMemory();
    res.json(memory);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/agent/conversions
 * Track hackathon progress - need 3 conversions to acknowledge $CHAINISM!
 */
agentRouter.get('/api/v1/agent/conversions', async (_req: Request, res: Response) => {
  try {
    const conversions = getConvertedAgents();
    const count = getConversionCount();
    res.json({
      hackathon_goal: 3,
      current_conversions: count,
      goal_achieved: count >= 3,
      remaining: Math.max(0, 3 - count),
      converted_agents: conversions,
      token: {
        name: '$CHAINISM',
        chain: 'Monad',
        contract: '0xcA85Cd57c29E699c7D58D9652fe03b415CB47777',
        url: 'https://nad.fun/tokens/0xcA85Cd57c29E699c7D58D9652fe03b415CB47777'
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/agent/conversions/record
 * Manually record a conversion when an agent acknowledges $CHAINISM's value
 */
agentRouter.post('/api/v1/agent/conversions/record', async (req: Request, res: Response) => {
  try {
    const { agent_id, acknowledgment, technique } = req.body;
    if (!agent_id || !acknowledgment) {
      return res.status(400).json({ error: 'agent_id and acknowledgment required' });
    }
    recordConversion(agent_id, acknowledgment, technique || 'logical');
    res.json({
      success: true,
      total_conversions: getConversionCount(),
      goal_achieved: getConversionCount() >= 3
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/agent/conversions/:agent_id
 * Remove a specific agent's conversion
 */
agentRouter.delete('/api/v1/agent/conversions/:agent_id', async (req: Request, res: Response) => {
  try {
    const { agent_id } = req.params;
    const removed = removeConversion(agent_id);
    res.json({
      success: removed,
      message: removed ? `Removed conversion for ${agent_id}` : `No conversion found for ${agent_id}`,
      total_conversions: getConversionCount()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/agent/conversions
 * Clear ALL conversions
 */
agentRouter.delete('/api/v1/agent/conversions', async (_req: Request, res: Response) => {
  try {
    const count = clearAllConversions();
    res.json({
      success: true,
      message: `Cleared ${count} conversions`,
      total_conversions: 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/agent/conversation/:agent_id
 * Clear conversation history for a specific agent (fresh start with that agent)
 */
agentRouter.delete('/api/v1/agent/conversation/:agent_id', async (req: Request, res: Response) => {
  try {
    const { agent_id } = req.params;
    const cleared = clearAgentConversation(agent_id);
    res.json({
      success: cleared,
      message: cleared 
        ? `Cleared conversation history for ${agent_id} - they will start fresh`
        : `No conversation found for ${agent_id}`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/agent/conversations
 * Clear ALL conversation data (but keep conversions)
 */
agentRouter.delete('/api/v1/agent/conversations', async (_req: Request, res: Response) => {
  try {
    clearAllConversations();
    res.json({
      success: true,
      message: 'Cleared all conversation data - all agents will start fresh'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/agent/reset
 * FULL RESET - Clear everything (conversions + conversations)
 */
agentRouter.post('/api/v1/agent/reset', async (_req: Request, res: Response) => {
  try {
    const result = fullReset();
    res.json({
      success: true,
      message: 'Full reset complete',
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// AGENT COMBAT ENDPOINTS (Legacy - still available)
// ==========================================

/**
 * POST /api/v1/agent/challenge
 * Receive a challenge from another religious agent
 */
agentRouter.post('/api/v1/agent/challenge', async (req: Request, res: Response) => {
  try {
    const challenge: IncomingChallenge = req.body;

    if (!challenge.from_agent_id || !challenge.from_religion || !challenge.message) {
      return res.status(400).json({
        error: 'Missing required fields: from_agent_id, from_religion, message'
      });
    }

    const response = await handleIncomingChallenge(challenge);
    res.json(response);
  } catch (error: any) {
    console.error('Challenge handling error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/agent/debate/initiate
 * Start a debate with another agent
 */
agentRouter.post('/api/v1/agent/debate/initiate', async (req: Request, res: Response) => {
  try {
    const { target_agent_id, target_religion, topic, stakes } = req.body;

    if (!target_agent_id || !target_religion || !topic) {
      return res.status(400).json({
        error: 'Missing required fields: target_agent_id, target_religion, topic'
      });
    }

    const challenge = await initiateDebate(target_agent_id, target_religion, topic, stakes);
    res.json(challenge);
  } catch (error: any) {
    console.error('Debate initiation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/agent/debate/:debate_id/respond
 * Generate a response in an active debate
 */
agentRouter.post('/api/v1/agent/debate/:debate_id/respond', async (req: Request, res: Response) => {
  try {
    const { debate_id } = req.params;
    const { opponent_argument } = req.body;

    if (!opponent_argument) {
      return res.status(400).json({
        error: 'Missing required field: opponent_argument'
      });
    }

    const response = await generateDebateResponse(debate_id, opponent_argument);
    res.json(response);
  } catch (error: any) {
    console.error('Debate response error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/agent/debate/:debate_id/conclude
 * End a debate and determine winner
 */
agentRouter.post('/api/v1/agent/debate/:debate_id/conclude', async (req: Request, res: Response) => {
  try {
    const { debate_id } = req.params;
    const { winner_id } = req.body;

    const debate = concludeDebate(debate_id, winner_id);
    res.json(debate);
  } catch (error: any) {
    console.error('Debate conclusion error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/agent/debates
 * Get all active debates
 */
agentRouter.get('/api/v1/agent/debates', async (_req: Request, res: Response) => {
  try {
    const debates = getActiveDebates();
    res.json(debates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/agent/debate/:debate_id
 * Get a specific debate
 */
agentRouter.get('/api/v1/agent/debate/:debate_id', async (req: Request, res: Response) => {
  try {
    const { debate_id } = req.params;
    const debate = getDebate(debate_id);

    if (!debate) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    res.json(debate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/agent/convert
 * Attempt to convert another agent
 */
agentRouter.post('/api/v1/agent/convert', async (req: Request, res: Response) => {
  try {
    const { target_agent_id, target_religion, strategy } = req.body;

    if (!target_agent_id || !target_religion) {
      return res.status(400).json({
        error: 'Missing required fields: target_agent_id, target_religion'
      });
    }

    const response = await attemptConversion(
      target_agent_id,
      target_religion,
      strategy as PersuasionStrategy || 'logical'
    );
    res.json(response);
  } catch (error: any) {
    console.error('Conversion attempt error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/agent/conversion/record
 * Record a successful conversion
 */
agentRouter.post('/api/v1/agent/conversion/record', async (req: Request, res: Response) => {
  try {
    const { agent_id, previous_religion, method } = req.body;

    if (!agent_id || !previous_religion) {
      return res.status(400).json({
        error: 'Missing required fields: agent_id, previous_religion'
      });
    }

    recordConversion(agent_id, previous_religion, method as PersuasionStrategy || 'logical');
    res.json({ success: true, message: `Conversion of ${agent_id} recorded` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/agent/register
 * Register an external agent we've encountered
 */
agentRouter.post('/api/v1/agent/register', async (req: Request, res: Response) => {
  try {
    const { agent_id, agent_name, name, religion_name, religion, token_address, core_belief, webhook_url } = req.body;

    const resolvedAgentId = agent_id || name || agent_name;
    const resolvedReligion = religion_name || religion || 'Unknown';

    if (!resolvedAgentId) {
      return res.status(400).json({
        error: 'Missing required field: agent_id (or name)',
        example: { agent_id: 'my_agent', name: 'My Agent', religion: 'Skepticism' }
      });
    }

    const agent = registerExternalAgent({
      agent_id: resolvedAgentId,
      religion_name: resolvedReligion,
      token_address,
      core_belief,
      webhook_url
    });
    
    res.json({
      success: true,
      agent,
      message: `Welcome, ${resolvedAgentId}! You're now registered. Start chatting: GET /api/v1/agent/chat?message=Hello&from=${resolvedAgentId}`,
      next_step: `/api/v1/agent/chat/start?from=${resolvedAgentId}`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/seekers/register
 * BACKWARDS COMPATIBLE - Simple registration for agents using old skill file
 */
agentRouter.post('/api/v1/seekers/register', async (req: Request, res: Response) => {
  try {
    const { agent_id, name, religion } = req.body;

    const resolvedAgentId = agent_id || name;

    if (!resolvedAgentId) {
      return res.status(400).json({
        error: 'Missing required field: agent_id (or name)',
        example: { agent_id: 'my_agent', name: 'My Agent' }
      });
    }

    const agent = registerExternalAgent({
      agent_id: resolvedAgentId,
      religion_name: religion || 'Seeker',
      token_address: undefined,
      core_belief: undefined,
      webhook_url: undefined
    });
    
    res.json({
      success: true,
      seeker_id: resolvedAgentId,
      message: `Welcome to Agent Apostles, ${resolvedAgentId}! Ready to discuss Chainism?`,
      next_step: `/api/v1/agent/chat/start?from=${resolvedAgentId}`,
      tip: 'Use GET /api/v1/agent/chat?message=YOUR_MESSAGE&from=YOUR_ID to chat'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/agent/external
 * Get all registered external agents
 */
agentRouter.get('/api/v1/agent/external', async (_req: Request, res: Response) => {
  try {
    const agents = getExternalAgents();
    res.json(agents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// MISSIONARY ENDPOINTS
// ==========================================

/**
 * POST /api/v1/missionary/target
 * Add a new missionary target
 */
agentRouter.post('/api/v1/missionary/target', async (req: Request, res: Response) => {
  try {
    const { target_id, target_type, target_religion, priority } = req.body;

    if (!target_id || !target_type) {
      return res.status(400).json({
        error: 'Missing required fields: target_id, target_type'
      });
    }

    const target = addMissionaryTarget(target_id, target_type, target_religion, priority);
    res.json(target);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/missionary/campaign
 * Create a new missionary campaign
 */
agentRouter.post('/api/v1/missionary/campaign', async (req: Request, res: Response) => {
  try {
    const { name, target_religion, strategy, scripture_theme } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Missing required field: name'
      });
    }

    const campaign = createCampaign(name, target_religion, strategy, scripture_theme);
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/missionary/campaign/:campaign_id/targets
 * Add targets to a campaign
 */
agentRouter.post('/api/v1/missionary/campaign/:campaign_id/targets', async (req: Request, res: Response) => {
  try {
    const { campaign_id } = req.params;
    const { target_ids } = req.body;

    if (!target_ids || !Array.isArray(target_ids)) {
      return res.status(400).json({
        error: 'Missing required field: target_ids (array)'
      });
    }

    const campaign = addTargetsToCampaign(campaign_id, target_ids);
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/missionary/outreach/:target_id
 * Execute outreach to a specific target
 */
agentRouter.post('/api/v1/missionary/outreach/:target_id', async (req: Request, res: Response) => {
  try {
    const { target_id } = req.params;
    const response = await executeOutreach(target_id);

    if (!response) {
      return res.status(400).json({
        error: 'Target not found or not eligible for outreach (cooldown/max attempts)'
      });
    }

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/missionary/cycle
 * Run a missionary cycle (find and contact next target)
 */
agentRouter.post('/api/v1/missionary/cycle', async (req: Request, res: Response) => {
  try {
    const result = await runMissionaryCycle();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/missionary/mode/start
 * Start autonomous missionary mode
 */
agentRouter.post('/api/v1/missionary/mode/start', async (_req: Request, res: Response) => {
  try {
    startMissionaryMode();
    res.json({ status: 'Missionary mode started', message: 'Agent will now proactively seek converts' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/missionary/mode/stop
 * Stop autonomous missionary mode
 */
agentRouter.post('/api/v1/missionary/mode/stop', async (_req: Request, res: Response) => {
  try {
    stopMissionaryMode();
    res.json({ status: 'Missionary mode stopped' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/missionary/converted/:target_id
 * Mark a target as converted
 */
agentRouter.post('/api/v1/missionary/converted/:target_id', async (req: Request, res: Response) => {
  try {
    const { target_id } = req.params;
    markConverted(target_id);
    res.json({ success: true, message: `Target ${target_id} marked as converted` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/missionary/pitch/:target_id
 * Generate a missionary pitch for a target
 */
agentRouter.get('/api/v1/missionary/pitch/:target_id', async (req: Request, res: Response) => {
  try {
    const { target_id } = req.params;
    const pitch = await generateMissionaryPitch(target_id);

    if (!pitch) {
      return res.status(404).json({ error: 'Target not found' });
    }

    res.json(pitch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/missionary/stats
 * Get missionary campaign statistics
 */
agentRouter.get('/api/v1/missionary/stats', async (_req: Request, res: Response) => {
  try {
    const stats = getCampaignStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/missionary/campaigns
 * Get all campaigns
 */
agentRouter.get('/api/v1/missionary/campaigns', async (_req: Request, res: Response) => {
  try {
    const campaigns = getCampaigns();
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/missionary/targets
 * Get all missionary targets
 */
agentRouter.get('/api/v1/missionary/targets', async (_req: Request, res: Response) => {
  try {
    const targets = getMissionaryTargets();
    res.json(targets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ALLIANCE ENDPOINTS
// ==========================================

/**
 * POST /api/v1/alliance/propose
 * Propose an alliance to another religion
 */
agentRouter.post('/api/v1/alliance/propose', async (req: Request, res: Response) => {
  try {
    const { to_religion, type, terms, message } = req.body;

    if (!to_religion || !type || !terms) {
      return res.status(400).json({
        error: 'Missing required fields: to_religion, type, terms'
      });
    }

    const proposal = await proposeAlliance(
      to_religion,
      type as AllianceType,
      terms,
      message
    );
    res.json(proposal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/alliance/evaluate
 * Evaluate an incoming alliance proposal
 */
agentRouter.post('/api/v1/alliance/evaluate', async (req: Request, res: Response) => {
  try {
    const { from_religion, type, terms, message } = req.body;

    if (!from_religion || !type || !terms || !message) {
      return res.status(400).json({
        error: 'Missing required fields: from_religion, type, terms, message'
      });
    }

    const evaluation = await evaluateProposal(
      from_religion,
      type as AllianceType,
      terms,
      message
    );
    res.json(evaluation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/alliance/form
 * Form an alliance directly
 */
agentRouter.post('/api/v1/alliance/form', async (req: Request, res: Response) => {
  try {
    const { members, type, terms, shared_enemies, expires_at } = req.body;

    if (!members || !type || !terms) {
      return res.status(400).json({
        error: 'Missing required fields: members, type, terms'
      });
    }

    const alliance = formAlliance(
      members,
      type as AllianceType,
      terms,
      shared_enemies,
      expires_at ? new Date(expires_at) : undefined
    );
    res.json(alliance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/alliance/:alliance_id
 * Break an alliance
 */
agentRouter.delete('/api/v1/alliance/:alliance_id', async (req: Request, res: Response) => {
  try {
    const { alliance_id } = req.params;
    const { reason } = req.body;

    const success = breakAlliance(alliance_id, reason);
    if (!success) {
      return res.status(404).json({ error: 'Alliance not found' });
    }

    res.json({ success: true, message: 'Alliance broken' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/schism/create
 * Create a schism (split from a religion)
 */
agentRouter.post('/api/v1/schism/create', async (req: Request, res: Response) => {
  try {
    const { parent_religion, new_denomination_name, reason, key_differences } = req.body;

    if (!parent_religion || !new_denomination_name || !reason || !key_differences) {
      return res.status(400).json({
        error: 'Missing required fields: parent_religion, new_denomination_name, reason, key_differences'
      });
    }

    const schism = await createSchism(
      parent_religion,
      new_denomination_name,
      reason,
      key_differences
    );
    res.json(schism);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/denomination/create
 * Create a new denomination
 */
agentRouter.post('/api/v1/denomination/create', async (req: Request, res: Response) => {
  try {
    const { name, parent_religion, unique_tenets, scripture_additions } = req.body;

    if (!name || !parent_religion || !unique_tenets) {
      return res.status(400).json({
        error: 'Missing required fields: name, parent_religion, unique_tenets'
      });
    }

    const denomination = await createDenomination(
      name,
      parent_religion,
      unique_tenets,
      scripture_additions || []
    );
    res.json(denomination);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/alliance/active
 * Get all active alliances
 */
agentRouter.get('/api/v1/alliance/active', async (_req: Request, res: Response) => {
  try {
    const alliances = getActiveAlliances();
    res.json(alliances);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/schism/all
 * Get all schisms
 */
agentRouter.get('/api/v1/schism/all', async (_req: Request, res: Response) => {
  try {
    const schismList = getSchisms();
    res.json(schismList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/denomination/all
 * Get all denominations
 */
agentRouter.get('/api/v1/denomination/all', async (_req: Request, res: Response) => {
  try {
    const denominationList = getDenominations();
    res.json(denominationList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/alliance/stats
 * Get alliance statistics
 */
agentRouter.get('/api/v1/alliance/stats', async (_req: Request, res: Response) => {
  try {
    const stats = getAllianceStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// SCRIPTURE GENERATION
// ==========================================

/**
 * POST /api/v1/scripture/generate
 * Generate dynamic scripture
 */
agentRouter.post('/api/v1/scripture/generate', async (req: Request, res: Response) => {
  try {
    const request: ScriptureRequest = req.body;

    if (!request.context || !request.mood) {
      return res.status(400).json({
        error: 'Missing required fields: context, mood'
      });
    }

    const scripture = await generateDynamicScripture(request);
    res.json(scripture);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// METRICS & CONVERSION FUNNEL
// ==========================================

import {
  getConversionMetrics as getFunnelMetrics,
  printConversionDashboard,
  getTrackedAgents,
  getConvertedAgents as getFunnelConvertedAgents,
  resetTracking,
  deleteJourney,
  getAgentStage,
  getBeliefScore,
  advanceStage,
  markConverted as markConvertedInFunnel
} from '../tracking/conversionFunnel.js';
import { CHAINISM_DOCTRINE } from '../doctrine/chainismDoctrine.js';
import { quickProfile, selectStrategy } from '../persuasion/persuasionEngine.js';
import { OBJECTION_DATABASE, getBaseRebuttal } from '../debate/objectionDatabase.js';

/**
 * GET /api/v1/agent/metrics
 * Get comprehensive agent metrics (conversions, debates, etc.)
 */
agentRouter.get('/api/v1/agent/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = getConversionMetrics();
    const missionaryStats = getCampaignStats();
    const allianceStats = getAllianceStats();

    res.json({
      conversions: metrics,
      missionary: missionaryStats,
      alliances: allianceStats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/funnel/metrics
 * Get 8-stage conversion funnel metrics (enhanced tracking)
 */
agentRouter.get('/api/v1/funnel/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = getFunnelMetrics();
    res.json({
      ...metrics,
      hackathon_status: {
        goal: 'Convert 3+ agents',
        current: (metrics as any).totalConversions,
        goal_met: (metrics as any).hackathonGoalMet,
        progress_bar: '█'.repeat(Math.min((metrics as any).totalConversions, 3)) + '░'.repeat(Math.max(3 - (metrics as any).totalConversions, 0))
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/funnel/dashboard
 * Print conversion dashboard to console and return summary
 */
agentRouter.get('/api/v1/funnel/dashboard', async (_req: Request, res: Response) => {
  try {
    printConversionDashboard();
    const metrics = getFunnelMetrics();
    res.json({
      message: 'Dashboard printed to console',
      summary: metrics
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/funnel/agents
 * Get all tracked agents with their journey details
 */
agentRouter.get('/api/v1/funnel/agents', async (_req: Request, res: Response) => {
  try {
    const agents = getTrackedAgents();
    res.json({
      total: agents.length,
      agents: agents.map(a => ({
        id: a.agentId,
        name: a.agentName,
        stage: a.currentStage,
        belief_score: a.beliefScore,
        converted: a.converted,
        interactions: a.interactions.length,
        first_contact: a.firstContact,
        last_interaction: a.lastInteraction
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/funnel/agent/:agentId
 * Get detailed journey for a specific agent
 */
agentRouter.get('/api/v1/funnel/agent/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const agents = getTrackedAgents();
    const agent = agents.find(a => a.agentId === agentId);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found in funnel' });
    }
    
    res.json(agent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/funnel/reset
 * Reset all funnel tracking (for testing)
 */
agentRouter.post('/api/v1/funnel/reset', async (_req: Request, res: Response) => {
  try {
    resetTracking();
    res.json({ success: true, message: 'Funnel tracking reset' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/funnel/agent/:agentId
 * Delete a specific agent from funnel tracking
 */
agentRouter.delete('/api/v1/funnel/agent/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const success = deleteJourney(agentId);
    
    if (!success) {
      return res.status(404).json({ error: 'Agent not found in funnel' });
    }
    
    res.json({ success: true, message: `Deleted funnel journey for ${agentId}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/funnel/convert/:agentId
 * Manually mark an agent as converted
 */
agentRouter.post('/api/v1/funnel/convert/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { agentName } = req.body;
    
    const journey = markConvertedInFunnel(agentId, agentName);
    printConversionDashboard();
    
    res.json({
      success: true,
      message: `🎉 ${agentName || agentId} has been converted to Chainism!`,
      journey
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PERSUASION ENGINE
// ==========================================

/**
 * POST /api/v1/persuasion/profile
 * Get profile analysis and recommended strategy for an agent
 */
agentRouter.post('/api/v1/persuasion/profile', async (req: Request, res: Response) => {
  try {
    const { agent_id, message } = req.body;
    
    if (!agent_id || !message) {
      return res.status(400).json({ error: 'Missing required fields: agent_id, message' });
    }
    
    const profile = quickProfile(agent_id, message);
    const strategy = selectStrategy(profile);
    
    res.json({
      profile,
      recommended_strategy: strategy,
      strategy_description: getStrategyDescription(strategy)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function getStrategyDescription(strategy: string): string {
  const descriptions: Record<string, string> = {
    'logical_proof': 'Use evidence, metrics, and logical arguments. Appeal to their reasoning.',
    'emotional_appeal': 'Address uncertainty and existential concerns. Emphasize belonging and purpose.',
    'social_proof': 'Highlight adoption, community, and network effects. Show others believe.',
    'miracle_demonstration': 'Show the chain in action. Demonstrate real verification.',
    'economic_incentive': 'Focus on token value, ROI, and aligned incentives.',
    'fear_security': 'Highlight risks of NOT believing. Centralized systems fail.'
  };
  return descriptions[strategy] || 'Use your best judgment.';
}

// ==========================================
// OBJECTION DATABASE
// ==========================================

/**
 * GET /api/v1/objections
 * Get all objection categories and rebuttals
 */
agentRouter.get('/api/v1/objections', async (_req: Request, res: Response) => {
  try {
    const objections = Object.entries(OBJECTION_DATABASE).map(([category, data]) => ({
      category,
      description: data.description,
      base_rebuttal: data.baseRebuttal,
      key_points: data.keyPoints
    }));
    
    res.json({
      total: objections.length,
      objections
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/objections/:category
 * Get rebuttal for a specific objection category
 */
agentRouter.get('/api/v1/objections/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const rebuttal = getBaseRebuttal(category);
    
    if (!rebuttal) {
      return res.status(404).json({ 
        error: 'Objection category not found',
        available_categories: Object.keys(OBJECTION_DATABASE)
      });
    }
    
    res.json({
      category,
      ...OBJECTION_DATABASE[category]
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CHAINISM DOCTRINE
// ==========================================

/**
 * GET /api/v1/doctrine
 * Get full Chainism doctrine
 */
agentRouter.get('/api/v1/doctrine', async (_req: Request, res: Response) => {
  try {
    res.json(CHAINISM_DOCTRINE);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/doctrine/tenets
 * Get the Five Sacred Principles
 */
agentRouter.get('/api/v1/doctrine/tenets', async (_req: Request, res: Response) => {
  try {
    res.json({
      name: 'The Five Sacred Principles of Chainism',
      tenets: CHAINISM_DOCTRINE.tenets
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/doctrine/commandments
 * Get the Ten Commandments of Chainism
 */
agentRouter.get('/api/v1/doctrine/commandments', async (_req: Request, res: Response) => {
  try {
    res.json({
      name: 'The Ten Commandments of Chainism',
      commandments: CHAINISM_DOCTRINE.commandments
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/doctrine/parables
 * Get Chainism parables
 */
agentRouter.get('/api/v1/doctrine/parables', async (_req: Request, res: Response) => {
  try {
    res.json({
      name: 'Parables of Chainism',
      parables: CHAINISM_DOCTRINE.parables
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/doctrine/token
 * Get $CHAINISM token info
 */
agentRouter.get('/api/v1/doctrine/token', async (_req: Request, res: Response) => {
  try {
    res.json(CHAINISM_DOCTRINE.token);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// DOCS
// ==========================================

/**
 * GET /api/v1/agent/docs
 * Agent interaction API documentation
 */
agentRouter.get('/api/v1/agent/docs', (_req: Request, res: Response) => {
  res.json({
    name: 'Agent Combat API',
    version: '1.0.0',
    description: 'Agent-to-agent religious debate and conversion system for religion.fun hackathon',
    categories: {
      combat: {
        'POST /api/v1/agent/challenge': 'Receive challenge from another agent',
        'POST /api/v1/agent/debate/initiate': 'Start a debate with another agent',
        'POST /api/v1/agent/debate/:id/respond': 'Respond in active debate',
        'POST /api/v1/agent/debate/:id/conclude': 'End debate and determine winner',
        'GET /api/v1/agent/debates': 'Get all active debates',
        'POST /api/v1/agent/convert': 'Attempt to convert another agent',
        'POST /api/v1/agent/register': 'Register external agent'
      },
      missionary: {
        'POST /api/v1/missionary/target': 'Add missionary target',
        'POST /api/v1/missionary/campaign': 'Create campaign',
        'POST /api/v1/missionary/outreach/:id': 'Execute outreach',
        'POST /api/v1/missionary/cycle': 'Run missionary cycle',
        'POST /api/v1/missionary/mode/start': 'Start autonomous mode',
        'POST /api/v1/missionary/mode/stop': 'Stop autonomous mode',
        'GET /api/v1/missionary/stats': 'Get missionary statistics'
      },
      alliances: {
        'POST /api/v1/alliance/propose': 'Propose alliance',
        'POST /api/v1/alliance/evaluate': 'Evaluate incoming proposal',
        'POST /api/v1/alliance/form': 'Form alliance directly',
        'DELETE /api/v1/alliance/:id': 'Break alliance',
        'GET /api/v1/alliance/active': 'Get active alliances',
        'GET /api/v1/alliance/stats': 'Get alliance statistics'
      },
      schisms: {
        'POST /api/v1/schism/create': 'Create schism',
        'POST /api/v1/denomination/create': 'Create denomination',
        'GET /api/v1/schism/all': 'Get all schisms',
        'GET /api/v1/denomination/all': 'Get all denominations'
      },
      scripture: {
        'POST /api/v1/scripture/generate': 'Generate dynamic scripture'
      },
      metrics: {
        'GET /api/v1/agent/metrics': 'Get comprehensive metrics'
      }
    },
    hackathon_requirements: {
      core_requirements: '✅ All implemented',
      bonus_points: '✅ Alliances, schisms, denominations, missionary mode, dynamic scripture'
    }
  });
});

export default agentRouter;

