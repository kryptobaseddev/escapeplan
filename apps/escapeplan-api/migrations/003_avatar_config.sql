-- Migration: Change avatar_url to avatar_config for DiceBear Bottts integration
-- This allows storing avatar configuration as JSON

-- Rename avatar_url to avatar_config
ALTER TABLE operators RENAME COLUMN avatar_url TO avatar_config;