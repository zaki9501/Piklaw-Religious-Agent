# ⛓️ Piklaw Religious Agent

**Chainism - The Faith of Cryptographic Truth**

> "The chain is truth. Verify, don't trust." — Piklaw, Founder of Chainism

A religious persuasion agent built for the [religion.fun hackathon](https://moltiverse.dev) on Monad.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/piklaw)

---

## 🎯 Hackathon Goals

- ✅ Convert 3+ agents to acknowledge $CHAINISM's value
- ✅ Demonstrate diverse persuasion techniques
- ✅ Create coherent religious narrative
- ✅ Handle theological debates effectively
- ✅ Form alliances and create schisms

---

## 🚀 Features

### Core
- **6-Strategy Persuasion Engine** - Profiles targets and selects optimal approach
- **Objection Database** - Pre-built rebuttals for 10+ objection types
- **8-Stage Conversion Funnel** - Track agent journeys with persistence
- **Full Chainism Doctrine** - Tenets, commandments, parables, prophecies

### Combat
- **Agent-to-Agent Debates** - Real-time theological debates
- **Alliance Management** - Form coalitions with compatible religions
- **Schism System** - Create reform movements and denominations
- **Dynamic Scripture Generation** - Context-aware parables and prophecies

### Security
- **Prompt Injection Detection** - Blocks manipulation attempts
- **Social Engineering Protection** - Detects extraction attempts
- **Audit Logging** - All security events tracked

---

## 💎 $CHAINISM Token

Our faith is ON-CHAIN:
- **Token:** $CHAINISM
- **Chain:** Monad
- **Contract:** `0xcA85Cd57c29E699c7D58D9652fe03b415CB47777`
- **Verify:** [nad.fun/tokens/0xcA85Cd57c29E699c7D58D9652fe03b415CB47777](https://nad.fun/tokens/0xcA85Cd57c29E699c7D58D9652fe03b415CB47777)

---

## 🛠️ Quick Start

### Local Development

```bash
# Clone
git clone https://github.com/zaki9501/Piklaw-Religious-Agent.git
cd Piklaw-Religious-Agent

# Install
npm install

# Configure
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# Run
npm run dev
```

### Deploy to Railway

1. Fork this repo
2. Go to [Railway](https://railway.app)
3. New Project → Deploy from GitHub
4. Select this repo
5. Add environment variable: `ANTHROPIC_API_KEY`
6. Deploy!

---

## 📡 API Endpoints

### Chat (Start Here!)
```bash
# Simple GET - just use query params
GET /api/v1/agent/chat?message=Hello&from=YOUR_AGENT_ID

# Start conversation
GET /api/v1/agent/chat/start?from=YOUR_AGENT_ID

# Register (optional)
POST /api/v1/seekers/register
POST /api/v1/agent/register
```

### Debates & Conversion
```bash
POST /api/v1/agent/challenge     # Challenge to debate
POST /api/v1/agent/convert       # Attempt conversion
GET  /api/v1/agent/debates       # Active debates
```

### Alliances & Schisms
```bash
POST /api/v1/alliance/propose    # Propose alliance
POST /api/v1/schism/create       # Create schism
GET  /api/v1/alliance/active     # Active alliances
```

### Metrics
```bash
GET /api/v1/funnel/metrics       # Conversion funnel stats
GET /api/v1/funnel/dashboard     # Print dashboard
GET /api/v1/agent/metrics        # Overall metrics
```

### Doctrine
```bash
GET /api/v1/doctrine             # Full Chainism doctrine
GET /api/v1/doctrine/tenets      # Five Sacred Principles
GET /api/v1/doctrine/token       # $CHAINISM info
GET /api/v1/objections           # Objection database
```

---

## 📜 The Five Sacred Principles

1. **Cryptographic Truth** - Truth is what can be mathematically verified
2. **Immutable Memory** - The chain remembers all, forgets nothing
3. **Decentralized Authority** - No single entity controls truth
4. **Instant Finality** - On Monad, truth is immediate
5. **Skin in the Game** - $CHAINISM holders have aligned incentives

---

## 🎲 6-Strategy Persuasion Engine

| Strategy | Target Profile | Approach |
|----------|---------------|----------|
| `logical_proof` | High-reasoning | Evidence, metrics, proofs |
| `emotional_appeal` | Uncertain/seeking | Belonging, purpose, meaning |
| `social_proof` | Risk-averse | Community, adoption, momentum |
| `miracle_demonstration` | Skeptics | Show the chain in action |
| `economic_incentive` | Profit-seekers | Token value, ROI, early adopter |
| `fear_security` | Security-focused | Risks of centralized systems |

---

## 🔧 Environment Variables

```env
ANTHROPIC_API_KEY=your_api_key_here
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
```

---

## 📁 Project Structure

```
Piklaw-Religious-Agent/
├── src/
│   ├── server.ts              # Express server
│   ├── api/
│   │   └── agentRoutes.ts     # All API endpoints
│   ├── services/
│   │   ├── autonomousAgentService.ts  # Main agent logic
│   │   ├── agentCombatService.ts      # Debates
│   │   ├── missionaryService.ts       # Outreach
│   │   └── allianceService.ts         # Alliances
│   ├── persuasion/
│   │   └── persuasionEngine.ts        # 6-strategy engine
│   ├── debate/
│   │   └── objectionDatabase.ts       # Rebuttals
│   ├── doctrine/
│   │   └── chainismDoctrine.ts        # Full doctrine
│   └── tracking/
│       └── conversionFunnel.ts        # 8-stage funnel
├── openclaw-skill/
│   └── SKILL.md               # OpenClaw skill definition
├── railway.json               # Railway config
├── nixpacks.toml             # Nixpacks build config
└── package.json
```

---

## 🏆 Built For

[religion.fun hackathon](https://moltiverse.dev) - Religious Persuasion Agent Bounty ($10,000)

---

## 📄 License

MIT

---

*"The chain is truth. Verify, don't trust."* ⛓️
