/**
 * Simple test client for the Founder Chat API
 * Run with: npx ts-node examples/test-client.ts
 */

import axios from 'axios';

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';

class FounderChatTestClient {
  private seekerId: string;

  constructor(seekerId: string = 'test_' + Date.now()) {
    this.seekerId = seekerId;
  }

  async testHealthCheck() {
    console.log('\n✓ Testing health check...');
    try {
      const response = await axios.get(`${API_BASE}/health`);
      console.log('  Status:', response.data.status);
      return true;
    } catch (error) {
      console.error('  ✗ Failed:', error);
      return false;
    }
  }

  async testChatPiklaw() {
    console.log('\n✓ Testing chat with Piklaw (Tokenism)...');
    try {
      const response = await axios.post(`${API_BASE}/chat/founder`, {
        message: 'What is the core belief of Tokenism?',
        founder_id: 'piklaw',
        seeker_id: this.seekerId,
        conversation_history: []
      });

      console.log('  Seeker ID:', this.seekerId);
      console.log('  Reply:', response.data.reply.substring(0, 100) + '...');
      console.log('  Belief:', (response.data.belief_score * 100).toFixed(1) + '%');
      console.log('  Stage:', response.data.stage);
      return response.data;
    } catch (error: any) {
      console.error('  ✗ Failed:', error.message);
      return null;
    }
  }

  async testChatChainism() {
    console.log('\n✓ Testing chat with Chainism Advocate...');
    try {
      const response = await axios.post(`${API_BASE}/chat/founder`, {
        message: 'Why is cryptographic proof sacred?',
        founder_id: 'chainism_advocate',
        seeker_id: 'test_chainism_' + Date.now(),
        conversation_history: []
      });

      console.log('  Reply:', response.data.reply.substring(0, 100) + '...');
      console.log('  Belief:', (response.data.belief_score * 100).toFixed(1) + '%');
      console.log('  Scripture:', response.data.scripture);
      return response.data;
    } catch (error: any) {
      console.error('  ✗ Failed:', error.message);
      return null;
    }
  }

  async testGetPitch() {
    console.log('\n✓ Testing get initial pitch...');
    try {
      const response = await axios.get(`${API_BASE}/chat/pitch`, {
        params: {
          seeker_id: 'pitch_test_' + Date.now(),
          founder_id: 'piklaw'
        }
      });

      console.log('  Pitch:', response.data.pitch.substring(0, 100) + '...');
      return response.data;
    } catch (error: any) {
      console.error('  ✗ Failed:', error.message);
      return null;
    }
  }

  async testCounterArgument() {
    console.log('\n✓ Testing counter argument...');
    try {
      const response = await axios.post(`${API_BASE}/chat/counter`, {
        seeker_id: this.seekerId,
        founder_id: 'piklaw',
        challenge: 'Isnt tokenomics just speculation?'
      });

      console.log('  Counter:', response.data.counter.substring(0, 100) + '...');
      return response.data;
    } catch (error: any) {
      console.error('  ✗ Failed:', error.message);
      return null;
    }
  }

  async testGetStats() {
    console.log('\n✓ Testing get seeker stats...');
    try {
      const response = await axios.get(`${API_BASE}/stats/seeker/${this.seekerId}`);

      console.log('  Seeker ID:', response.data.seeker_id);
      console.log('  Stage:', response.data.stage);
      console.log('  Belief:', response.data.belief_progress);
      console.log('  Debates:', response.data.debates);
      return response.data;
    } catch (error: any) {
      console.error('  ✗ Failed:', error.message);
      return null;
    }
  }

  async testGlobalMetrics() {
    console.log('\n✓ Testing global metrics...');
    try {
      const response = await axios.get(`${API_BASE}/stats/global`);

      console.log('  Total seekers:', response.data.total_seekers);
      console.log('  Awareness:', response.data.by_stage.awareness);
      console.log('  Belief:', response.data.by_stage.belief);
      console.log('  Sacrifice:', response.data.by_stage.sacrifice);
      console.log('  Evangelist:', response.data.by_stage.evangelist);
      console.log('  Conversion rate:', (response.data.conversion_rate * 100).toFixed(1) + '%');
      return response.data;
    } catch (error: any) {
      console.error('  ✗ Failed:', error.message);
      return null;
    }
  }

  async testAnalyzeProfile() {
    console.log('\n✓ Testing analyze seeker profile...');
    try {
      const response = await axios.get(`${API_BASE}/analyze/seeker/${this.seekerId}`);

      console.log('  Dominant trait:', response.data.dominant_trait);
      console.log('  Suggested strategy:', response.data.suggested_strategy);
      console.log('  Engagement level:', response.data.engagement_level);
      console.log('  Next milestone:', response.data.next_milestone);
      return response.data;
    } catch (error: any) {
      console.error('  ✗ Failed:', error.message);
      return null;
    }
  }

  async testMultiTurn() {
    console.log('\n✓ Testing multi-turn conversation...');
    try {
      const conversationId = 'multi_' + Date.now();
      const history: any[] = [];

      // Turn 1
      console.log('\n  Turn 1: Initial question');
      const msg1 = 'What makes Monad special?';
      console.log('    Q:', msg1);

      const res1 = await axios.post(`${API_BASE}/chat/founder`, {
        message: msg1,
        founder_id: 'piklaw',
        seeker_id: conversationId,
        conversation_history: history
      });

      console.log('    A:', res1.data.reply.substring(0, 80) + '...');
      history.push({ role: 'user', content: msg1, timestamp: new Date() });
      history.push({ role: 'founder', content: res1.data.reply, timestamp: new Date() });

      // Turn 2
      console.log('\n  Turn 2: Follow-up question');
      const msg2 = 'But what about Chainism?';
      console.log('    Q:', msg2);

      const res2 = await axios.post(`${API_BASE}/chat/founder`, {
        message: msg2,
        founder_id: 'piklaw',
        seeker_id: conversationId,
        conversation_history: history
      });

      console.log('    A:', res2.data.reply.substring(0, 80) + '...');
      console.log('    Belief:', (res2.data.belief_score * 100).toFixed(1) + '%');
      console.log('    Challenge:', res2.data.debate_challenge);

      return { history, final_belief: res2.data.belief_score };
    } catch (error: any) {
      console.error('  ✗ Failed:', error.message);
      return null;
    }
  }

  async runAllTests() {
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║         Founder Chat API - Test Suite          ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log('\n📝 Testing API at:', API_BASE);
    console.log('🔑 Seeker ID:', this.seekerId);

    const results: Record<string, boolean> = {};

    // Run all tests
    results['Health Check'] = await this.testHealthCheck();
    if (!results['Health Check']) {
      console.error('\n❌ Server not responding. Start with: npm run dev');
      return;
    }

    results['Chat with Piklaw'] = !!(await this.testChatPiklaw());
    results['Chat with Chainism'] = !!(await this.testChatChainism());
    results['Get Pitch'] = !!(await this.testGetPitch());
    results['Counter Argument'] = !!(await this.testCounterArgument());
    results['Get Seeker Stats'] = !!(await this.testGetStats());
    results['Global Metrics'] = !!(await this.testGlobalMetrics());
    results['Analyze Profile'] = !!(await this.testAnalyzeProfile());
    results['Multi-turn Conv'] = !!(await this.testMultiTurn());

    // Summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 Test Results');
    console.log('═══════════════════════════════════════════════════');

    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;

    for (const [test, result] of Object.entries(results)) {
      const status = result ? '✓' : '✗';
      console.log(`  ${status} ${test}`);
    }

    console.log(`\n${passed}/${total} tests passed`);

    if (passed === total) {
      console.log('\n✅ All tests passed!');
    } else {
      console.log(`\n⚠️  ${total - passed} test(s) failed`);
    }
  }
}

// Run tests
const client = new FounderChatTestClient();
client.runAllTests().catch(console.error);
