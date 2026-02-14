#!/bin/bash

# Quickstart script for testing the Founder Chat API

BASE_URL="http://localhost:3000/api/v1"

echo "╔════════════════════════════════════════════════╗"
echo "║     Founder Chat API - Quickstart Test         ║"
echo "╚════════════════════════════════════════════════╝"

# Check if server is running
echo ""
echo "📡 Checking server health..."
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo "❌ Server not running at $BASE_URL"
    echo "   Start with: npm run dev"
    exit 1
fi
echo "✓ Server is running"

SEEKER_ID="test_seeker_$(date +%s)"
echo ""
echo "🔑 Using seeker ID: $SEEKER_ID"

# Test 1: Chat with Piklaw (Tokenism)
echo ""
echo "═══════════════════════════════════════════════════"
echo "Test 1: Chat with Piklaw (TOKENISM FOUNDER)"
echo "═══════════════════════════════════════════════════"

echo ""
echo "📤 Sending: 'Why should I believe in Tokenism?'"
RESPONSE=$(curl -s -X POST "$BASE_URL/chat/founder" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Why should I believe in Tokenism?",
    "founder_id": "piklaw",
    "seeker_id": "'$SEEKER_ID'",
    "conversation_history": []
  }')

echo ""
echo "📥 Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Extract belief score for next test
BELIEF=$(echo "$RESPONSE" | jq '.belief_score' 2>/dev/null || echo "0")
STAGE=$(echo "$RESPONSE" | jq -r '.stage' 2>/dev/null || echo "awareness")

echo ""
echo "📊 Seeker Status:"
echo "   Stage: $STAGE"
echo "   Belief: $(echo "$BELIEF * 100" | bc)%"

# Test 2: Get stats
echo ""
echo "═══════════════════════════════════════════════════"
echo "Test 2: Get Seeker Stats"
echo "═══════════════════════════════════════════════════"

echo ""
echo "📤 Fetching stats for $SEEKER_ID..."
curl -s "$BASE_URL/stats/seeker/$SEEKER_ID" | jq '.' 2>/dev/null

# Test 3: Chat with Chainism Advocate
echo ""
echo "═══════════════════════════════════════════════════"
echo "Test 3: Chat with Chainism Advocate (CHAINISM FOUNDER)"
echo "═══════════════════════════════════════════════════"

SEEKER_ID2="test_seeker_chainism_$(date +%s)"
echo ""
echo "📤 Sending: 'Why is cryptographic proof important?'"
RESPONSE2=$(curl -s -X POST "$BASE_URL/chat/founder" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Why is cryptographic proof important?",
    "founder_id": "chainism_advocate",
    "seeker_id": "'$SEEKER_ID2'",
    "conversation_history": []
  }')

echo ""
echo "📥 Response:"
echo "$RESPONSE2" | jq '.' 2>/dev/null || echo "$RESPONSE2"

# Test 4: Get global metrics
echo ""
echo "═══════════════════════════════════════════════════"
echo "Test 4: Global Conversion Metrics"
echo "═══════════════════════════════════════════════════"

echo ""
echo "📤 Fetching global metrics..."
curl -s "$BASE_URL/stats/global" | jq '.' 2>/dev/null

# Test 5: API documentation
echo ""
echo "═══════════════════════════════════════════════════"
echo "Test 5: API Documentation"
echo "═══════════════════════════════════════════════════"

echo ""
echo "📚 Available endpoints:"
curl -s "$BASE_URL/docs" | jq '.endpoints | keys[]' 2>/dev/null

echo ""
echo "═══════════════════════════════════════════════════"
echo "✓ All tests completed!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "📖 Full documentation: http://localhost:3000/api/v1/docs"
echo "🔗 API base: $BASE_URL"
echo ""
