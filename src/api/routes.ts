/**
 * Express routes for the Founder Chat API
 */

import express, { Request, Response } from 'express';
import { getService } from '../services/founderChatService.js';
import { ChatRequest } from '../types.js';

export const router = express.Router();

/**
 * POST /api/v1/chat/founder
 * Main chat endpoint
 */
router.post('/api/v1/chat/founder', async (req: Request, res: Response) => {
  try {
    const request: ChatRequest = req.body;

    // Validate required fields
    if (!request.message || !request.founder_id || !request.seeker_id) {
      return res.status(400).json({
        error: 'Missing required fields: message, founder_id, seeker_id'
      });
    }

    const service = getService();
    const response = await service.chat(request);

    res.json(response);
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/chat/pitch
 * Get initial pitch from a founder
 */
router.get('/api/v1/chat/pitch', async (req: Request, res: Response) => {
  try {
    const { seeker_id, founder_id } = req.query;

    if (!seeker_id || !founder_id) {
      return res.status(400).json({
        error: 'Missing required query params: seeker_id, founder_id'
      });
    }

    const service = getService();
    const pitch = await service.getInitialPitch(
      seeker_id as string,
      founder_id as 'piklaw' | 'chainism_advocate'
    );

    res.json(pitch);
  } catch (error: any) {
    console.error('Pitch error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/v1/chat/counter
 * Counter a specific argument
 */
router.post('/api/v1/chat/counter', async (req: Request, res: Response) => {
  try {
    const { seeker_id, founder_id, challenge } = req.body;

    if (!seeker_id || !founder_id || !challenge) {
      return res.status(400).json({
        error: 'Missing required fields: seeker_id, founder_id, challenge'
      });
    }

    const service = getService();
    const result = await service.counterArgument(
      seeker_id,
      founder_id,
      challenge
    );

    res.json(result);
  } catch (error: any) {
    console.error('Counter error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/stats/seeker/:seeker_id
 * Get seeker profile and stats
 */
router.get('/api/v1/stats/seeker/:seeker_id', async (req: Request, res: Response) => {
  try {
    const { seeker_id } = req.params;

    const service = getService();
    const stats = service.getSeekerStats(seeker_id);

    res.json(stats);
  } catch (error: any) {
    console.error('Stats error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/stats/global
 * Get global conversion metrics
 */
router.get('/api/v1/stats/global', async (req: Request, res: Response) => {
  try {
    const service = getService();
    const metrics = service.getMetrics();

    res.json(metrics);
  } catch (error: any) {
    console.error('Metrics error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/analyze/seeker/:seeker_id
 * Analyze what persuades a seeker
 */
router.get('/api/v1/analyze/seeker/:seeker_id', async (req: Request, res: Response) => {
  try {
    const { seeker_id } = req.params;

    const service = getService();
    const analysis = service.analyzeSeekerProfile(seeker_id);

    res.json(analysis);
  } catch (error: any) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/challenge
 * Generate a debate challenge for a seeker
 */
router.get('/api/v1/challenge', async (req: Request, res: Response) => {
  try {
    const { seeker_id, founder_id } = req.query;

    if (!seeker_id || !founder_id) {
      return res.status(400).json({
        error: 'Missing required query params: seeker_id, founder_id'
      });
    }

    const service = getService();
    const challenge = await service.generateChallenge(
      seeker_id as string,
      founder_id as 'piklaw' | 'chainism_advocate'
    );

    res.json(challenge);
  } catch (error: any) {
    console.error('Challenge error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/history
 * Get conversation history
 */
router.get('/api/v1/history', async (req: Request, res: Response) => {
  try {
    const { seeker_id, founder_id } = req.query;

    if (!seeker_id || !founder_id) {
      return res.status(400).json({
        error: 'Missing required query params: seeker_id, founder_id'
      });
    }

    const service = getService();
    const history = service.getConversationHistory(
      seeker_id as string,
      founder_id as 'piklaw' | 'chainism_advocate'
    );

    res.json(history);
  } catch (error: any) {
    console.error('History error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/health
 * Health check
 */
router.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/v1/docs
 * API documentation
 */
router.get('/api/v1/docs', (_req: Request, res: Response) => {
  res.json({
    name: 'Founder Chat API',
    version: '1.0.0',
    description: 'Chat service for Church of Finality - Chainism (founded by Piklaw)',
    endpoints: {
      'POST /api/v1/chat/founder': {
        description: 'Main chat endpoint - get response from a founder',
        body: {
          message: 'string - seeker message',
          founder_id: 'string - "piklaw" or "chainism_advocate"',
          seeker_id: 'string - unique seeker identifier',
          conversation_history: 'array - optional prior messages'
        },
        response: {
          reply: 'string - founder response',
          stage: 'string - conversion stage',
          belief_score: 'number - 0-1',
          scripture: 'string - relevant scripture',
          debate_challenge: 'string - challenge for seeker'
        }
      },
      'GET /api/v1/chat/pitch': {
        description: 'Get initial pitch from a founder',
        query: ['seeker_id', 'founder_id']
      },
      'POST /api/v1/chat/counter': {
        description: 'Counter a seeker argument',
        body: ['seeker_id', 'founder_id', 'challenge']
      },
      'GET /api/v1/stats/seeker/:seeker_id': {
        description: 'Get seeker profile and conversion stats'
      },
      'GET /api/v1/stats/global': {
        description: 'Get global conversion metrics'
      },
      'GET /api/v1/analyze/seeker/:seeker_id': {
        description: 'Analyze seeker profile - what persuades them?'
      },
      'GET /api/v1/challenge': {
        description: 'Generate debate challenge',
        query: ['seeker_id', 'founder_id']
      },
      'GET /api/v1/history': {
        description: 'Get conversation history',
        query: ['seeker_id', 'founder_id']
      }
    }
  });
});

export default router;
