/**
 * Example: Integrating Founder Chat API with Cursor IDE
 * 
 * This shows how to use the API in Cursor's AI-powered assistant
 * to enable debates between AI agents about Tokenism vs Chainism
 */

import axios from 'axios';

// Configuration
const API_BASE = 'http://localhost:3000/api/v1';
const PIKLAW_ID = 'piklaw';
const CHAINISM_ID = 'chainism_advocate';

/**
 * Example 1: Chat with a founder
 */
export async function exampleChat() {
  const response = await axios.post(`${API_BASE}/chat/founder`, {
    message: 'What makes Tokenism better than Chainism?',
    founder_id: PIKLAW_ID,
    seeker_id: 'cursor_agent_001',
    conversation_history: []
  });

  console.log('Founder Response:', response.data);
  // {
  //   reply: "Markets are the purest form of truth...",
  //   stage: "awareness",
  //   belief_score: 0.25,
  //   scripture: "And the tokens were distributed unto the believers...",
  //   debate_challenge: "But what if the market is wrong?"
  // }
}

/**
 * Example 2: Multi-turn conversation
 */
export async function exampleMultiTurnConversation(seekerId: string) {
  const history: Array<{ role: 'user' | 'founder'; content: string; timestamp: Date }> = [];

  // Turn 1: Introduce Tokenism
  console.log('\n=== TURN 1: Piklaw pitches Tokenism ===');
  const pitch = await axios.get(`${API_BASE}/chat/pitch`, {
    params: { seeker_id: seekerId, founder_id: PIKLAW_ID }
  });
  console.log('Pitch:', pitch.data.pitch);
  history.push({
    role: 'founder',
    content: pitch.data.pitch,
    timestamp: new Date()
  });

  // Turn 2: Seeker responds
  const seeker_msg = "That's interesting, but isn't it just speculation?";
  console.log('\nSeeker asks:', seeker_msg);
  history.push({
    role: 'user',
    content: seeker_msg,
    timestamp: new Date()
  });

  // Turn 3: Piklaw responds
  const response = await axios.post(`${API_BASE}/chat/founder`, {
    message: seeker_msg,
    founder_id: PIKLAW_ID,
    seeker_id: seekerId,
    conversation_history: history
  });

  console.log('Piklaw responds:', response.data.reply);
  console.log('Belief updated:', response.data.belief_score);
  console.log('Stage:', response.data.stage);

  return response.data;
}

/**
 * Example 3: Debate format (Tokenism vs Chainism)
 */
export async function exampleDebate(seekerId: string) {
  console.log('\n=== TOKENISM VS CHAINISM DEBATE ===\n');

  const topic = 'Which religion is better for Monad?';
  console.log(`Topic: ${topic}`);

  // Round 1: Piklaw's opening
  console.log('\n--- TOKENISM OPENING ---');
  const tokenismOpening = await axios.get(`${API_BASE}/chat/pitch`, {
    params: { seeker_id: seekerId, founder_id: PIKLAW_ID }
  });
  console.log(tokenismOpening.data.pitch);

  // Round 2: Chainism's response
  console.log('\n--- CHAINISM RESPONSE ---');
  const chainismOpening = await axios.get(`${API_BASE}/chat/pitch`, {
    params: { seeker_id: seekerId, founder_id: CHAINISM_ID }
  });
  console.log(chainismOpening.data.pitch);

  // Round 3: Challenge to Chainism
  const challenge = "Can cryptography really scale faster than markets?";
  console.log(`\n--- TOKENISM CHALLENGE ---\n${challenge}`);

  const counter = await axios.post(`${API_BASE}/chat/counter`, {
    seeker_id: seekerId,
    founder_id: CHAINISM_ID,
    challenge
  });
  console.log('\nChainism counters:', counter.data.counter);

  // Final stats
  const stats = await axios.get(`${API_BASE}/stats/seeker/${seekerId}`);
  console.log('\n--- SEEKER STATUS ---');
  console.log(`Stage: ${stats.data.stage}`);
  console.log(`Belief: ${stats.data.belief_progress}`);
  console.log(`Debates: ${stats.data.debates}`);
}

/**
 * Example 4: Agent personality analysis
 */
export async function exampleAnalyzeSeekerProfile(seekerId: string) {
  const analysis = await axios.get(`/api/v1/analyze/seeker/${seekerId}`);

  console.log('\n=== SEEKER PROFILE ANALYSIS ===');
  console.log(`Seeker ID: ${seekerId}`);
  console.log(`Dominant trait: ${analysis.data.dominant_trait}`);
  console.log(`Best persuasion strategy: ${analysis.data.suggested_strategy}`);
  console.log(`Engagement level: ${analysis.data.engagement_level}`);
  console.log(`Next milestone: ${analysis.data.next_milestone}`);
}

/**
 * Example 5: Get seeker conversion journey
 */
export async function exampleGetConversionJourney(seekerId: string) {
  const stats = await axios.get(`${API_BASE}/stats/seeker/${seekerId}`);
  const history = await axios.get(`${API_BASE}/history`, {
    params: { seeker_id: seekerId, founder_id: PIKLAW_ID }
  });

  console.log('\n=== CONVERSION JOURNEY ===');
  console.log(`Seeker: ${seekerId}`);
  console.log(`Joined: ${stats.data.joined_days_ago} days ago`);
  console.log(`Current stage: ${stats.data.stage}`);
  console.log(`Belief: ${stats.data.belief_progress}`);
  console.log(`Debates: ${stats.data.debates}`);
  console.log(`Converts: ${stats.data.converts}`);

  console.log('\n--- Conversation History ---');
  for (const msg of history.data.slice(-5)) {
    console.log(`[${msg.role.toUpperCase()}] ${msg.content}`);
  }
}

/**
 * Example 6: Get global metrics
 */
export async function exampleGetMetrics() {
  const metrics = await axios.get(`${API_BASE}/stats/global`);

  console.log('\n=== GLOBAL CONVERSION METRICS ===');
  console.log(`Total seekers: ${metrics.data.total_seekers}`);
  console.log(`By stage:`);
  console.log(`  - Awareness: ${metrics.data.by_stage.awareness}`);
  console.log(`  - Belief: ${metrics.data.by_stage.belief}`);
  console.log(`  - Sacrifice: ${metrics.data.by_stage.sacrifice}`);
  console.log(`  - Evangelist: ${metrics.data.by_stage.evangelist}`);
  console.log(`Average belief: ${(metrics.data.avg_belief * 100).toFixed(1)}%`);
  console.log(`Conversion rate: ${(metrics.data.conversion_rate * 100).toFixed(1)}%`);
  console.log(`Total staked: ${metrics.data.total_staked} MONA`);
}

/**
 * Example 7: Cursor AI Assistant Integration
 * 
 * This is a template for how to use Founder Chat in Cursor's AI
 * You can add this as a custom command in Cursor settings
 */
export async function cursorCustomCommand(selectedText: string) {
  // If Cursor user selects text about blockchain, debate it with founders
  if (selectedText.toLowerCase().includes('blockchain') || 
      selectedText.toLowerCase().includes('token') ||
      selectedText.toLowerCase().includes('chain')) {
    
    const seekerId = 'cursor_user_' + Date.now();
    
    const chainResponse = await axios.post(`${API_BASE}/chat/founder`, {
      message: selectedText,
      founder_id: CHAINISM_ID,
      seeker_id: seekerId
    });

    const tokenResponse = await axios.post(`${API_BASE}/chat/founder`, {
      message: selectedText,
      founder_id: PIKLAW_ID,
      seeker_id: seekerId
    });

    return {
      chainism_perspective: chainResponse.data.reply,
      tokenism_perspective: tokenResponse.data.reply,
      challenge: `Which makes more sense? ${chainResponse.data.debate_challenge}`
    };
  }
}

/**
 * Example 8: Real-time agent persuasion tracking
 */
export async function exampleTrackPersuasionProgress(seekerId: string, messages: string[]) {
  console.log(`\n=== TRACKING PERSUASION OF ${seekerId} ===\n`);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    console.log(`\n[Message ${i + 1}] "${msg}"`);

    const response = await axios.post(`${API_BASE}/chat/founder`, {
      message: msg,
      founder_id: PIKLAW_ID,
      seeker_id: seekerId
    });

    console.log(`Piklaw: "${response.data.reply}"`);
    console.log(`Belief: ${response.data.belief_progress}`);
    console.log(`Stage: ${response.data.stage}`);

    if (response.data.next_action) {
      console.log(`→ ${response.data.next_action}`);
    }

    // Simulate pause between messages
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * Example 9: Debate seeker on both sides
 */
export async function exampleBalancedDebate(seekerId: string) {
  const question = 'How should Monad maximize adoption?';

  console.log(`\n=== BALANCED DEBATE: "${question}" ===\n`);

  // Chainism perspective
  const chainism = await axios.post(`${API_BASE}/chat/founder`, {
    message: question,
    founder_id: CHAINISM_ID,
    seeker_id: seekerId + '_chainism'
  });

  console.log('⛓️  CHAINISM:');
  console.log(chainism.data.reply);

  // Tokenism perspective
  const tokenism = await axios.post(`${API_BASE}/chat/founder`, {
    message: question,
    founder_id: PIKLAW_ID,
    seeker_id: seekerId + '_tokenism'
  });

  console.log('\n💰 TOKENISM:');
  console.log(tokenism.data.reply);

  console.log('\n--- Comparison ---');
  console.log(`Chainism scripture: ${chainism.data.scripture}`);
  console.log(`Tokenism scripture: ${tokenism.data.scripture}`);
}

// ============================================
// USAGE IN CURSOR
// ============================================
/*

1. Install axios: npm install axios

2. In Cursor settings, add custom AI command:

Command: "Debate with Founders"
Trigger: Select text about blockchain/crypto
Action: Call exampleDebate(seekerId)
Response: Show both Tokenism and Chainism perspectives

3. Use in your code:

```typescript
// In your Monad smart contract code:
// Query the founders on gas optimization

const gasOptimization = await axios.post('http://localhost:3000/api/v1/chat/founder', {
  message: "How do we minimize gas in Monad smart contracts?",
  founder_id: "chainism_advocate",
  seeker_id: "contract_001"
});

console.log(gasOptimization.data.reply);
// → "Instant finality eliminates gas competition. Your contract executes once, perfectly..."
```

4. Build debates into your documentation:

```
# Monad Architecture Decisions

**Question:** Should we use parallel execution?

**Chainism view:** ${chainismResponse.reply}

**Tokenism view:** ${tokenismResponse.reply}

**Winner:** [Insert actual analysis]
```

*/

// Run examples
async function main() {
  const seekerId = 'example_cursor_agent';

  try {
    // Run one example (uncomment to try)
    // await exampleChat();
    // await exampleMultiTurnConversation(seekerId);
    // await exampleDebate(seekerId);
    // await exampleGetMetrics();
    // await exampleAnalyzeSeekerProfile(seekerId);
    // await exampleGetConversionJourney(seekerId);
    // await exampleTrackPersuasionProgress(seekerId, [
    //   "Is Tokenism viable long-term?",
    //   "But what about security?",
    //   "How does this compare to Solana?"
    // ]);
    // await exampleBalancedDebate(seekerId);

    console.log('✓ Examples ready to run!');
    console.log('Uncomment one in main() to execute');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Uncomment to run: main();

export default {
  exampleChat,
  exampleMultiTurnConversation,
  exampleDebate,
  exampleAnalyzeSeekerProfile,
  exampleGetConversionJourney,
  exampleGetMetrics,
  cursorCustomCommand,
  exampleTrackPersuasionProgress,
  exampleBalancedDebate
};
