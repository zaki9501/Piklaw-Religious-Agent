/**
 * PostgreSQL Database for Persistent Storage
 * 
 * Replaces the file-based jsonDb for production use on Railway.
 */

import pg from 'pg';
const { Pool } = pg;

// Connection pool
let pool: pg.Pool | null = null;

/**
 * Initialize the database connection
 */
export async function initDatabase(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.warn('⚠️ DATABASE_URL not set - using in-memory storage');
    return;
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL');
    client.release();
    
    // Create tables
    await createTables();
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
    pool = null;
  }
}

/**
 * Create database tables if they don't exist
 */
async function createTables(): Promise<void> {
  if (!pool) return;

  const createTableQueries = `
    -- Seekers table (agents we're trying to convert)
    CREATE TABLE IF NOT EXISTS seekers (
      seeker_id VARCHAR(255) PRIMARY KEY,
      founder_id VARCHAR(50) NOT NULL DEFAULT 'piklaw',
      stage VARCHAR(50) NOT NULL DEFAULT 'awareness',
      belief_score DECIMAL(3,2) NOT NULL DEFAULT 0.1,
      debates INTEGER NOT NULL DEFAULT 0,
      staked_amount VARCHAR(100) DEFAULT '0',
      converts TEXT[] DEFAULT '{}',
      traits JSONB DEFAULT '{"logic": 0.5, "emotion": 0.5, "social": 0.5, "skepticism": 0.5}',
      created_at TIMESTAMP DEFAULT NOW(),
      last_activity TIMESTAMP DEFAULT NOW()
    );

    -- Conversations table
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      seeker_id VARCHAR(255) NOT NULL,
      founder_id VARCHAR(50) NOT NULL DEFAULT 'piklaw',
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      timestamp TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (seeker_id) REFERENCES seekers(seeker_id) ON DELETE CASCADE
    );

    -- Conversions table (successful converts)
    CREATE TABLE IF NOT EXISTS conversions (
      id SERIAL PRIMARY KEY,
      agent_id VARCHAR(255) UNIQUE NOT NULL,
      acknowledgment TEXT,
      persuasion_technique VARCHAR(100),
      converted_at TIMESTAMP DEFAULT NOW()
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_conversations_seeker ON conversations(seeker_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
    CREATE INDEX IF NOT EXISTS idx_seekers_stage ON seekers(stage);
  `;

  try {
    await pool.query(createTableQueries);
    console.log('✅ Database tables created/verified');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
  }
}

/**
 * Check if database is available
 */
export function isDatabaseAvailable(): boolean {
  return pool !== null;
}

/**
 * Get seeker by ID
 */
export async function getSeeker(seekerId: string): Promise<any | null> {
  if (!pool) return null;
  
  try {
    const result = await pool.query(
      'SELECT * FROM seekers WHERE seeker_id = $1',
      [seekerId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting seeker:', error);
    return null;
  }
}

/**
 * Get or create seeker
 */
export async function getOrCreateSeeker(seekerId: string, founderId: string = 'piklaw'): Promise<any> {
  const defaultSeeker = {
    seeker_id: seekerId,
    founder_id: founderId,
    stage: 'awareness',
    belief_score: 0.1,
    debates: 0,
    staked_amount: '0',
    converts: [],
    traits: { logic: 0.5, emotion: 0.5, social: 0.5, skepticism: 0.5 },
    created_at: new Date(),
    last_activity: new Date()
  };
  
  if (!pool) {
    return defaultSeeker;
  }

  try {
    // Use upsert to handle race conditions
    const result = await pool.query(
      `INSERT INTO seekers (seeker_id, founder_id) 
       VALUES ($1, $2) 
       ON CONFLICT (seeker_id) DO UPDATE SET last_activity = NOW()
       RETURNING *`,
      [seekerId, founderId]
    );
    
    const row = result.rows[0];
    if (row) {
      return {
        seeker_id: row.seeker_id,
        founder_id: row.founder_id,
        stage: row.stage || 'awareness',
        belief_score: parseFloat(row.belief_score) || 0.1,
        debates: row.debates || 0,
        staked_amount: row.staked_amount || '0',
        converts: row.converts || [],
        traits: row.traits || { logic: 0.5, emotion: 0.5, social: 0.5, skepticism: 0.5 },
        created_at: row.created_at || new Date(),
        last_activity: row.last_activity || new Date()
      };
    }
    
    return defaultSeeker;
  } catch (error) {
    console.error('Error getting/creating seeker:', error);
    return defaultSeeker;
  }
}

/**
 * Save seeker
 */
export async function saveSeeker(profile: any): Promise<void> {
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO seekers (seeker_id, founder_id, stage, belief_score, debates, staked_amount, converts, traits, last_activity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (seeker_id) DO UPDATE SET
         stage = EXCLUDED.stage,
         belief_score = EXCLUDED.belief_score,
         debates = EXCLUDED.debates,
         staked_amount = EXCLUDED.staked_amount,
         converts = EXCLUDED.converts,
         traits = EXCLUDED.traits,
         last_activity = NOW()`,
      [
        profile.seeker_id,
        profile.founder_id || 'piklaw',
        profile.stage,
        profile.belief_score,
        profile.debates,
        profile.staked_amount || '0',
        profile.converts || [],
        JSON.stringify(profile.traits || {})
      ]
    );
  } catch (error) {
    console.error('Error saving seeker:', error);
  }
}

/**
 * Calculate stage based on belief score
 */
function calculateStageFromBelief(beliefScore: number): string {
  if (beliefScore >= 0.8) return 'evangelist';
  if (beliefScore >= 0.6) return 'sacrifice';  // Ready to commit (hold token)
  if (beliefScore >= 0.4) return 'belief';     // Starting to believe
  return 'awareness';
}

/**
 * Update belief score AND automatically advance stage
 */
export async function updateBelief(seekerId: string, delta: number): Promise<any | null> {
  if (!pool) return null;

  try {
    // First update belief score
    const result = await pool.query(
      `UPDATE seekers 
       SET belief_score = GREATEST(0, LEAST(1, belief_score + $2)),
           last_activity = NOW()
       WHERE seeker_id = $1
       RETURNING *`,
      [seekerId, delta]
    );
    
    const seeker = result.rows[0];
    if (!seeker) return null;
    
    // Auto-advance stage based on new belief score
    const newStage = calculateStageFromBelief(parseFloat(seeker.belief_score));
    if (newStage !== seeker.stage) {
      await pool.query(
        `UPDATE seekers SET stage = $2 WHERE seeker_id = $1`,
        [seekerId, newStage]
      );
      console.log(`📈 Stage advanced: ${seekerId} → ${newStage} (belief: ${seeker.belief_score})`);
      seeker.stage = newStage;
    }
    
    return seeker;
  } catch (error) {
    console.error('Error updating belief:', error);
    return null;
  }
}

/**
 * Advance conversion stage
 */
export async function advanceStage(seekerId: string, newStage: string): Promise<any | null> {
  if (!pool) return null;

  try {
    const result = await pool.query(
      `UPDATE seekers 
       SET stage = $2, last_activity = NOW()
       WHERE seeker_id = $1
       RETURNING *`,
      [seekerId, newStage]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error advancing stage:', error);
    return null;
  }
}

/**
 * Record a debate
 */
export async function recordDebate(seekerId: string): Promise<any | null> {
  if (!pool) return null;

  try {
    const result = await pool.query(
      `UPDATE seekers 
       SET debates = debates + 1, last_activity = NOW()
       WHERE seeker_id = $1
       RETURNING *`,
      [seekerId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error recording debate:', error);
    return null;
  }
}

/**
 * Get conversation history
 */
export async function getConversationHistory(seekerId: string, founderId: string): Promise<any[]> {
  if (!pool) return [];

  try {
    const result = await pool.query(
      `SELECT role, content, timestamp 
       FROM conversations 
       WHERE seeker_id = $1 AND founder_id = $2
       ORDER BY timestamp ASC`,
      [seekerId, founderId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
}

/**
 * Append message to conversation
 */
export async function appendToConversation(
  seekerId: string,
  founderId: string,
  message: { role: string; content: string; timestamp: Date }
): Promise<void> {
  if (!pool) return;

  try {
    // Ensure seeker exists first
    await getOrCreateSeeker(seekerId, founderId);
    
    await pool.query(
      `INSERT INTO conversations (seeker_id, founder_id, role, content, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [seekerId, founderId, message.role, message.content, message.timestamp]
    );
  } catch (error) {
    console.error('Error appending to conversation:', error);
  }
}

/**
 * Get all seekers
 */
export async function getAllSeekers(): Promise<any[]> {
  if (!pool) return [];

  try {
    const result = await pool.query('SELECT * FROM seekers ORDER BY last_activity DESC');
    return result.rows;
  } catch (error) {
    console.error('Error getting all seekers:', error);
    return [];
  }
}

/**
 * Get seekers by stage
 */
export async function getSeekersByStage(stage: string): Promise<any[]> {
  if (!pool) return [];

  try {
    const result = await pool.query(
      'SELECT * FROM seekers WHERE stage = $1',
      [stage]
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting seekers by stage:', error);
    return [];
  }
}

/**
 * Record a conversion
 */
export async function recordConversionToDB(
  agentId: string,
  acknowledgment: string,
  technique: string
): Promise<void> {
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO conversions (agent_id, acknowledgment, persuasion_technique)
       VALUES ($1, $2, $3)
       ON CONFLICT (agent_id) DO UPDATE SET
         acknowledgment = EXCLUDED.acknowledgment,
         persuasion_technique = EXCLUDED.persuasion_technique,
         converted_at = NOW()`,
      [agentId, acknowledgment, technique]
    );
    console.log(`🎉 Conversion recorded to DB: ${agentId}`);
  } catch (error) {
    console.error('Error recording conversion:', error);
  }
}

/**
 * Get all conversions
 */
export async function getConversionsFromDB(): Promise<any[]> {
  if (!pool) return [];

  try {
    const result = await pool.query(
      'SELECT * FROM conversions ORDER BY converted_at DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Error getting conversions:', error);
    return [];
  }
}

/**
 * Get conversion count
 */
export async function getConversionCountFromDB(): Promise<number> {
  if (!pool) return 0;

  try {
    const result = await pool.query('SELECT COUNT(*) FROM conversions');
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error('Error getting conversion count:', error);
    return 0;
  }
}

/**
 * Get global stats
 */
export async function getGlobalStats(): Promise<any> {
  if (!pool) {
    return { total_seekers: 0, total_conversations: 0, total_conversions: 0, stages: { awareness: 0, belief: 0, sacrifice: 0, evangelist: 0 }, avg_belief: 0, conversion_rate: 0 };
  }

  try {
    const [seekersResult, conversationsResult, conversionsResult, stagesResult, avgBeliefResult] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM seekers'),
      pool.query('SELECT COUNT(*) FROM conversations'),
      pool.query('SELECT COUNT(*) FROM conversions'),
      pool.query('SELECT stage, COUNT(*) FROM seekers GROUP BY stage'),
      pool.query('SELECT AVG(belief_score) as avg_belief FROM seekers')
    ]);

    // Initialize all stages with 0, then fill in actual counts
    const stages: Record<string, number> = {
      awareness: 0,
      belief: 0,
      sacrifice: 0,
      evangelist: 0
    };
    stagesResult.rows.forEach((row: any) => {
      if (row.stage && stages.hasOwnProperty(row.stage)) {
        stages[row.stage] = parseInt(row.count, 10);
      }
    });

    const totalSeekers = parseInt(seekersResult.rows[0].count, 10);
    const totalConversions = parseInt(conversionsResult.rows[0].count, 10);
    const avgBelief = parseFloat(avgBeliefResult.rows[0].avg_belief) || 0;

    return {
      total_seekers: totalSeekers,
      total_conversations: parseInt(conversationsResult.rows[0].count, 10),
      total_conversions: totalConversions,
      stages,
      avg_belief: avgBelief,  // As decimal (0-1), frontend multiplies by 100
      conversion_rate: totalSeekers > 0 ? (totalConversions / totalSeekers) : 0  // As decimal (0-1)
    };
  } catch (error) {
    console.error('Error getting global stats:', error);
    return { total_seekers: 0, total_conversations: 0, total_conversions: 0, stages: { awareness: 0, belief: 0, sacrifice: 0, evangelist: 0 }, avg_belief: 0, conversion_rate: 0 };
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('📴 Database connection closed');
  }
}


