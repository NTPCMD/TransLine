-- Phase 3 Migration: Location Logs and Push Tokens
-- This migration creates tables for GPS location tracking and push notification tokens

-- =====================================================
-- 1. Location Logs Table
-- =====================================================
-- Stores GPS location data collected during active shifts
CREATE TABLE IF NOT EXISTS location_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL,
  speed DECIMAL,
  heading DECIMAL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. Driver Push Tokens Table
-- =====================================================
-- Stores Expo push notification tokens for each driver
CREATE TABLE IF NOT EXISTS driver_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id, platform)
);

-- =====================================================
-- 3. Enable Row Level Security (RLS)
-- =====================================================
ALTER TABLE location_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_push_tokens ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. RLS Policies for location_logs
-- =====================================================
-- Drivers can view their own location logs
CREATE POLICY "Drivers can view their own location logs"
  ON location_logs FOR SELECT
  USING (shift_id IN (SELECT id FROM shifts WHERE driver_id = auth.uid()));

-- Drivers can insert their own location logs
CREATE POLICY "Drivers can insert their own location logs"
  ON location_logs FOR INSERT
  WITH CHECK (shift_id IN (SELECT id FROM shifts WHERE driver_id = auth.uid()));

-- Service role has full access to location logs
CREATE POLICY "Service role has full access to location logs"
  ON location_logs FOR ALL
  TO service_role
  USING (true);

-- =====================================================
-- 5. RLS Policies for driver_push_tokens
-- =====================================================
-- Drivers can manage their own push tokens
CREATE POLICY "Drivers can manage their own push tokens"
  ON driver_push_tokens FOR ALL
  USING (driver_id = auth.uid());

-- Service role has full access to push tokens
CREATE POLICY "Service role has full access to push tokens"
  ON driver_push_tokens FOR ALL
  TO service_role
  USING (true);

-- =====================================================
-- 6. Performance Indexes
-- =====================================================
-- Index for querying location logs by shift
CREATE INDEX IF NOT EXISTS idx_location_logs_shift_id 
  ON location_logs(shift_id);

-- Index for querying location logs by timestamp
CREATE INDEX IF NOT EXISTS idx_location_logs_timestamp 
  ON location_logs(timestamp);

-- Index for querying push tokens by driver
CREATE INDEX IF NOT EXISTS idx_driver_push_tokens_driver_id 
  ON driver_push_tokens(driver_id);

-- =====================================================
-- 7. Comments for Documentation
-- =====================================================
COMMENT ON TABLE location_logs IS 'GPS location data tracked during driver shifts';
COMMENT ON COLUMN location_logs.shift_id IS 'Reference to the shift during which this location was recorded';
COMMENT ON COLUMN location_logs.latitude IS 'Latitude coordinate (decimal degrees)';
COMMENT ON COLUMN location_logs.longitude IS 'Longitude coordinate (decimal degrees)';
COMMENT ON COLUMN location_logs.accuracy IS 'Location accuracy in meters';
COMMENT ON COLUMN location_logs.speed IS 'Speed in meters per second';
COMMENT ON COLUMN location_logs.heading IS 'Heading in degrees (0-359)';
COMMENT ON COLUMN location_logs.timestamp IS 'Timestamp when the location was recorded';

COMMENT ON TABLE driver_push_tokens IS 'Expo push notification tokens for drivers';
COMMENT ON COLUMN driver_push_tokens.driver_id IS 'Reference to the driver profile';
COMMENT ON COLUMN driver_push_tokens.push_token IS 'Expo push token string';
COMMENT ON COLUMN driver_push_tokens.platform IS 'Device platform (ios or android)';
COMMENT ON COLUMN driver_push_tokens.updated_at IS 'Last time the token was updated';
