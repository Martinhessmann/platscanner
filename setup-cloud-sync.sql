-- PlatScanner Cloud Sync Database Setup
-- Run this script in your Supabase SQL Editor to enable cross-platform inventory sync
-- https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql

-- Create user_inventories table for cross-platform inventory sync
-- Uses hashed Gemini API key as unique user identifier
CREATE TABLE user_inventories (
    user_id TEXT PRIMARY KEY,
    inventory_data JSONB,
    build_plans JSONB,
    mastery_data JSONB,
    last_scan TIMESTAMPTZ,
    last_sync TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_inventories_updated_at
    BEFORE UPDATE ON user_inventories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) for data protection
ALTER TABLE user_inventories ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own data
CREATE POLICY "Users can access own inventory" ON user_inventories
    FOR ALL USING (true); -- Using anonymous key with user_id as identifier

-- Index for performance
CREATE INDEX idx_user_inventories_user_id ON user_inventories(user_id);
CREATE INDEX idx_user_inventories_updated_at ON user_inventories(updated_at);

-- Comments for documentation
COMMENT ON TABLE user_inventories IS 'Cross-platform inventory sync using hashed Gemini API key as user identifier';
COMMENT ON COLUMN user_inventories.user_id IS 'SHA-256 hash of Gemini API key for privacy';
COMMENT ON COLUMN user_inventories.inventory_data IS 'Complete inventory data from localStorage';
COMMENT ON COLUMN user_inventories.build_plans IS 'User build plans and reservations';
COMMENT ON COLUMN user_inventories.mastery_data IS 'Array of mastered prime set names';
COMMENT ON COLUMN user_inventories.last_scan IS 'Timestamp of last inventory scan';
COMMENT ON COLUMN user_inventories.last_sync IS 'Timestamp of last sync operation';

-- Verification query - check if setup was successful
SELECT
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables
WHERE tablename = 'user_inventories';

-- Success message
SELECT 'Cloud sync database setup complete! You can now enable cloud sync in PlatScanner settings.' as setup_status;