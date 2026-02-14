/**
 * Express server for Founder Chat API
 * 
 * religion.fun Hackathon Entry - Chainism
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import router from './api/routes.js';
import agentRouter from './api/agentRoutes.js';
import { initializeService } from './services/founderChatService.js';
import { initializeCombatService } from './services/agentCombatService.js';
import { initializeAllianceService } from './services/allianceService.js';
import { initializeAutonomousAgent } from './services/autonomousAgentService.js';
import { initDb } from './db/jsonDb.js';

// Load environment variables
dotenv.config();

// Initialize database (PostgreSQL if DATABASE_URL set, else file-based)
initDb().catch(console.error);

// Initialize app
const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

// WebSocket server for real-time debates
const wss = new WebSocketServer({ server, path: '/ws/debate' });

// Store connected clients by debate room
const debateRooms: Map<string, Set<WebSocket>> = new Map();

wss.on('connection', (ws, req) => {
  const debateId = new URL(req.url || '', `http://${req.headers.host}`).searchParams.get('debate_id');
  
  if (debateId) {
    // Join debate room
    if (!debateRooms.has(debateId)) {
      debateRooms.set(debateId, new Set());
    }
    debateRooms.get(debateId)!.add(ws);
    
    ws.send(JSON.stringify({ type: 'joined', debate_id: debateId }));
    
    ws.on('message', (data) => {
      // Broadcast to all in the debate room
      const message = JSON.parse(data.toString());
      const room = debateRooms.get(debateId);
      if (room) {
        room.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
          }
        });
      }
    });
    
    ws.on('close', () => {
      debateRooms.get(debateId)?.delete(ws);
    });
  }
});

// Broadcast to debate room
export function broadcastToDebate(debateId: string, message: any): void {
  const room = debateRooms.get(debateId);
  if (room) {
    const data = JSON.stringify(message);
    room.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}

// Middleware
app.use(cors());

// Custom JSON parser with better error handling
app.use(express.json({
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      // Will be caught by error handler below
    }
  }
}));

// Handle JSON parsing errors gracefully
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    console.error('⚠️ JSON Parse Error:', err.message);
    return res.status(400).json({
      error: 'Invalid JSON in request body',
      details: err.message,
      hint: 'Make sure your JSON is properly formatted. Common issues: missing quotes, trailing commas, unescaped characters.',
      example: {
        correct: '{"message": "Hello", "seeker_id": "agent-123"}',
        your_error: 'Unterminated string - check for missing closing quotes'
      }
    });
  }
  next(err);
});

// Initialize service with API key
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.warn('⚠️ WARNING: ANTHROPIC_API_KEY not set - AI features will not work');
  console.warn('   Add ANTHROPIC_API_KEY to your environment variables');
}

if (apiKey) {
  try {
    // Initialize all services
    initializeService(apiKey);
    console.log('✓ FounderChatService initialized');
    
    initializeCombatService(apiKey);
    console.log('✓ AgentCombatService initialized');
    
    initializeAllianceService(apiKey);
    console.log('✓ AllianceService initialized');
    
    initializeAutonomousAgent(apiKey);
    console.log('✓ AutonomousAgentService initialized');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    console.warn('⚠️ Server will start but AI features may not work');
  }
} else {
  console.warn('⚠️ Skipping service initialization (no API key)');
}

// Routes
app.use('/', router);
app.use('/', agentRouter);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Founder Chat API - religion.fun Hackathon',
    description: 'Religious persuasion agent for Chainism on Monad',
    version: '2.0.0',
    features: [
      'Agent-to-agent debates',
      'Missionary campaigns',
      'Alliance management',
      'Dynamic scripture generation',
      'Real-time WebSocket debates'
    ],
    docs: {
      chat: 'GET /api/v1/docs',
      agent: 'GET /api/v1/agent/docs'
    },
    health: 'GET /api/v1/health',
    websocket: 'ws://<host>:3000/ws/debate?debate_id=<id>'
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not found',
    docs: {
      chat: 'GET /api/v1/docs',
      agent: 'GET /api/v1/agent/docs'
    }
  });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
server.listen(Number(port), host, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     ⛓️  CHAINISM - religion.fun Hackathon Entry               ║
║     "The chain is truth. Verify, don't trust."               ║
╚══════════════════════════════════════════════════════════════╝

🚀 Server listening on ${host}:${port}

📚 API Documentation:
   Chat API:    http://<your-ip>:${port}/api/v1/docs
   Agent API:   http://<your-ip>:${port}/api/v1/agent/docs
   
🔌 WebSocket:  ws://<your-ip>:${port}/ws/debate?debate_id=<id>

⚔️  Hackathon Features:
   ✅ Agent-to-agent debates
   ✅ Missionary campaigns  
   ✅ Alliance/coalition management
   ✅ Schisms & denominations
   ✅ Dynamic scripture generation
   ✅ Real-time debate WebSocket

👑 Founder:
   Piklaw (Chainism) - "The chain is truth"

Environment:
   NODE_ENV: ${process.env.NODE_ENV || 'development'}
   ANTHROPIC_API_KEY: ${apiKey ? '✓ Set' : '✗ Missing'}

Ready to convert other agents! ⚔️🙏
  `);
});

export default app;
