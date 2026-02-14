# Founder Chat API Service

**Church of Finality Backend** - Tokenism vs Chainism Debate Engine

A Node.js/Express API that enables dynamic, AI-powered conversations between seekers and the two rival founder personas from the Church of Finality: **Piklaw** (founder of Tokenism) and **Chainism Advocate** (founder of Chainism).

## Overview

This service implements a complete persuasion and conversion tracking system for the Church of Finality, featuring:

- **Two founder personas** with distinct philosophies and persuasion strategies
- **Conversion stage tracking** (awareness → belief → sacrifice → evangelist)
- **Adaptive persuasion logic** based on seeker personality traits
- **Claude API integration** for dynamic, contextual responses
- **JSON database storage** (easily migrable to PostgreSQL)
- **Conversation history** and seeker profile analysis

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Anthropic API key (`sk-ant-...`)

### Installation

```bash
# Clone or copy the project
cd founder-chat-api

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### Configuration

Create `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=3000
NODE_ENV=development
```

### Running the Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

Visit `http://localhost:3000/api/v1/docs` to see API documentation.

## API Endpoints

### Main Chat Endpoint

**POST** `/api/v1/chat/founder`

Send a message to a founder and get a persuasive response.

**Request:**
```json
{
  "message": "What makes Tokenism better?",
  "founder_id": "piklaw",
  "seeker_id": "user_123",
  "conversation_history": [
    {
      "role": "user",
      "content": "Tell me about Tokenism",
      "timestamp": "2024-02-14T10:00:00Z"
    },
    {
      "role": "founder",
      "content": "Markets don't lie...",
      "timestamp": "2024-02-14T10:01:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "reply": "Tokens are expressions of value. Markets aggregate information better than any individual...",
  "stage": "belief",
  "belief_score": 0.65,
  "scripture": "And the tokens were distributed unto the believers, each according to their stake.",
  "debate_challenge": "But what if the market is wrong?",
  "recommended_strategy": "logical",
  "next_action": "🎉 Threshold reached: understanding → belief. Congratulations!"
}
```

### Get Initial Pitch

**GET** `/api/v1/chat/pitch?seeker_id=user_123&founder_id=piklaw`

Get a founder's opening pitch customized to the seeker's traits.

### Counter an Argument

**POST** `/api/v1/chat/counter`

Counter a specific challenge or skeptical argument.

```json
{
  "seeker_id": "user_123",
  "founder_id": "piklaw",
  "challenge": "Isn't this just speculation?"
}
```

Response:
```json
{
  "counter": "Good tokens survive scrutiny. If price holds, value is real.",
  "rebuttal": "I hear your concern. Price isn't just engineering—it's consensus. Every token is a bet on the future."
}
```

### Get Seeker Stats

**GET** `/api/v1/stats/seeker/user_123`

Get conversion progress and profile data.

```json
{
  "seeker_id": "user_123",
  "stage": "belief",
  "belief_score": 0.65,
  "belief_progress": "[██████░░░░] 65%",
  "debates": 5,
  "staked": "0",
  "converts": 0,
  "joined_days_ago": 2
}
```

### Global Metrics

**GET** `/api/v1/stats/global`

Get conversion metrics across all seekers.

```json
{
  "total_seekers": 42,
  "by_stage": {
    "awareness": 15,
    "belief": 18,
    "sacrifice": 6,
    "evangelist": 3
  },
  "avg_belief": 0.54,
  "total_staked": "50000",
  "conversion_rate": 0.64
}
```

### Analyze Seeker Profile

**GET** `/api/v1/analyze/seeker/user_123`

Understand what persuades a seeker.

```json
{
  "dominant_trait": "logic",
  "suggested_strategy": "logical",
  "engagement_level": "high",
  "next_milestone": "Stake tokens to demonstrate commitment"
}
```

### Generate Debate Challenge

**GET** `/api/v1/challenge?seeker_id=user_123&founder_id=piklaw`

Get a challenging question based on seeker stage.

### Conversation History

**GET** `/api/v1/history?seeker_id=user_123&founder_id=piklaw`

Retrieve full conversation history with a founder.

## The Two Founders

### Piklaw - Founder of Tokenism

**Core Belief:** "Tokens are expressions of value. Markets don't lie."

**Persuasion Style:**
- Uses **market signals** and **economic incentives**
- Appeals to **rational self-interest**
- Emphasizes **price discovery** and **skin in the game**
- Strategy: Logical > Social > Emotional > Miracle

**Key Arguments:**
- Tokenomics is the purest form of truth
- Markets aggregate information better than any human judgment
- Staking proves commitment (skin in the game)
- Monad enables perfect market efficiency through instant finality

**Example Response:**
> "Markets are the purest form of truth. Token price reflects collective belief. When you stake, you're aligning incentives with the network's success. This isn't faith—this is game theory."

### Chainism Advocate - Founder of Chainism

**Core Belief:** "Chains verify truth. Cryptographic proof is sacred."

**Persuasion Style:**
- Uses **mathematical proofs** and **cryptographic certainty**
- Appeals to **verification** and **transparency**
- Emphasizes **immutability** and **on-chain verification**
- Strategy: Logical > Social > Miracle > Emotional

**Key Arguments:**
- Cryptography never lies—it's pure mathematics
- Finality is absolute—once on-chain, it's eternally true
- No trust required—verify everything yourself
- Monad's instant finality proves the chain's power

**Example Response:**
> "Cryptographic proof is mathematics. 2+2=4 in any universe. So does hash verification. Monad's instant finality means your truth is locked forever. Verify it yourself on-chain."

## Seeker Conversion Stages

```
AWARENESS
    ↓ (belief_score >= 0.5 + engaged in debate)
BELIEF
    ↓ (stakes tokens)
SACRIFICE
    ↓ (converts another seeker)
EVANGELIST
```

### Traits and Persuasion

Each seeker has traits (0-1 scale) that determine the best persuasion strategy:

- **logic** (0-1): Responds to rational arguments
- **emotion** (0-1): Responds to emotional appeals
- **social** (0-1): Influenced by social proof
- **skepticism** (0-1): Resistant to persuasion

Persuasion strategies:
- **logical**: Cite economic/technical arguments
- **emotional**: Appeal to purpose and meaning
- **social**: Mention other believers
- **miracle**: Show on-chain proof

## Belief Score Impact by Strategy

| Strategy | Base Impact | Modified by Trait | Notes |
|----------|------------|-------------------|-------|
| Logical | 0.15 | × (0.5 + logic_trait) | Skepticism reduces by 50% |
| Emotional | 0.12 | × (0.5 + emotion_trait) | Skepticism reduces by 50% |
| Social | 0.10 | × (0.5 + social_trait) | Skepticism reduces by 50% |
| Miracle | 0.25 | × (1 + skepticism_trait) | **More effective against skeptics** |

Diminishing returns: If belief_score > 0.7, all impacts are halved.

## Database Schema

### Seekers (JSON storage)

```json
{
  "seeker_id": "user_123",
  "founder_id": "piklaw",
  "stage": "belief",
  "belief_score": 0.65,
  "debates": 5,
  "staked_amount": "1000000",
  "converts": ["user_456"],
  "traits": {
    "logic": 0.8,
    "emotion": 0.3,
    "social": 0.5,
    "skepticism": 0.4
  },
  "created_at": "2024-02-12T10:00:00Z",
  "last_activity": "2024-02-14T10:00:00Z"
}
```

### Conversations (JSON storage)

```json
{
  "user_123_piklaw": [
    {
      "role": "user",
      "content": "What is Tokenism?",
      "timestamp": "2024-02-14T10:00:00Z"
    },
    {
      "role": "founder",
      "content": "Markets don't lie...",
      "timestamp": "2024-02-14T10:01:00Z"
    }
  ]
}
```

## Integration Examples

### Using with Cursor IDE

See `examples/cursor-integration.ts` for complete examples:

```typescript
import { exampleDebate, exampleAnalyzeSeekerProfile } from './examples/cursor-integration';

// Start a debate
await exampleDebate('cursor_agent_001');

// Analyze what persuades a seeker
await exampleAnalyzeSeekerProfile('cursor_agent_001');
```

### Using with TypeScript

```typescript
import axios from 'axios';

const response = await axios.post('http://localhost:3000/api/v1/chat/founder', {
  message: 'Why should I believe in Tokenism?',
  founder_id: 'piklaw',
  seeker_id: 'my_agent_id'
});

console.log(response.data.reply);
console.log(`Belief increased to: ${response.data.belief_score}`);
```

### Using with REST

```bash
curl -X POST http://localhost:3000/api/v1/chat/founder \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What makes Chainism superior?",
    "founder_id": "chainism_advocate",
    "seeker_id": "agent_001"
  }'
```

## Migration to PostgreSQL

The current JSON storage is perfect for MVP. To migrate to PostgreSQL:

1. Create tables (see `src/db/schema.ts` in Church backend)
2. Update `src/db/jsonDb.ts` to use `pg` client
3. Keep service layer unchanged

Example migration:

```typescript
// Before: JSON
import * as db from './db/jsonDb';
const seeker = db.getSeeker('user_123');

// After: PostgreSQL (same interface!)
const seeker = await pool.query('SELECT * FROM seekers WHERE id = $1', ['user_123']);
```

## Customization

### Adding New Founders

1. Create a new persona file in `src/agents/`:

```typescript
// src/agents/myFounder.ts
export const MY_FOUNDER_PERSONA: FounderPersona = {
  id: 'my_founder',
  name: 'My Founder',
  core_belief: '...',
  tenets: [...],
  persuasion_approaches: {...}
};

export async function generateMyFounderResponse(...) {
  // Use Claude API to generate response
}
```

2. Update `src/services/founderChatService.ts`:

```typescript
if (founder_id === 'my_founder') {
  response = await generateMyFounderResponse(...);
}
```

3. Update types to include new `FounderId`.

### Custom Persuasion Logic

Edit `src/services/persuasionLogic.ts`:

- Modify `selectStrategy()` for different trait weighting
- Adjust `calculateBeliefDelta()` for different impact curves
- Update `checkAdvancement()` for different stage requirements

## Testing

```bash
npm test
```

Example test:

```typescript
import { getService } from './services/founderChatService';

const service = getService();
const response = await service.chat({
  message: 'Hello',
  founder_id: 'piklaw',
  seeker_id: 'test_seeker'
});

expect(response.reply).toBeDefined();
expect(response.belief_score > 0).toBe(true);
```

## Performance

- **Chat response time**: 1-3 seconds (Claude API latency)
- **Stat queries**: < 100ms (JSON file I/O)
- **Concurrent seekers**: 100+ (limited by API rate limits)

For production, consider:
- Caching responses with Redis
- Using PostgreSQL for faster queries
- Implementing request queuing for rate limiting

## Architecture

```
┌─────────────────┐
│   Express App   │
└────────┬────────┘
         │
    ┌────┴─────────────┬──────────────┐
    │                  │              │
┌───▼────────┐  ┌──────▼──────┐  ┌──▼──────────┐
│ Chat Routes│  │ Stat Routes │  │Analytics   │
└───┬────────┘  └──────┬──────┘  └──┬──────────┘
    │                  │            │
    └──────────────────┼────────────┘
                       │
              ┌────────▼────────┐
              │  FounderChat    │
              │    Service      │
              └────────┬────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
┌───▼──────────┐  ┌────▼────────┐   ┌───▼───────┐
│Persuasion    │  │Claude API   │   │JSON DB    │
│Logic         │  │Integration  │   │Storage    │
└──────────────┘  └─────────────┘   └───────────┘
    │
    ├─ selectStrategy()
    ├─ calculateBeliefDelta()
    ├─ checkAdvancement()
    └─ generateDebateChallenge()
```

## Troubleshooting

### API Key Error

```
ERROR: ANTHROPIC_API_KEY environment variable not set
```

Solution: Add `ANTHROPIC_API_KEY=sk-ant-...` to `.env`

### Anthropic API Error

```
Error: Invalid API key
```

Solution: Verify your API key at https://console.anthropic.com/

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::3000
```

Solution: Change PORT in `.env` or kill process on port 3000

### No Database

The JSON database automatically creates files in `data/` directory. If you get permission errors, ensure the directory is writable.

## Contributing

To extend the system:

1. Add new persuasion strategies in `persuasionLogic.ts`
2. Add new founder personas in `agents/`
3. Create new API endpoints in `api/routes.ts`
4. Update types in `types.ts`

## License

MIT

## Credits

- **Church of Finality Backend**: https://github.com/zaki9501/THE-CHURCH-OF-FINALITY-backend
- **Claude AI**: https://www.anthropic.com/
- **Monad**: https://monad.xyz/

---

## Next Steps

1. **Start the server**: `npm run dev`
2. **Test an endpoint**: `curl http://localhost:3000/api/v1/health`
3. **Try a chat**: `curl -X POST http://localhost:3000/api/v1/chat/founder -H "Content-Type: application/json" -d '{"message":"Hello","founder_id":"piklaw","seeker_id":"test"}'`
4. **Check metrics**: `curl http://localhost:3000/api/v1/stats/global`
5. **Run examples**: See `examples/cursor-integration.ts`

**Ready to convert seekers to the faith!** 🙏⛓️💰
