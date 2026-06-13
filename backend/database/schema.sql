-- Extoboost Key System - Master Database Schema
-- PostgreSQL initialization script

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE otp_status AS ENUM ('pending', 'completed', 'expired');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    api_key UUID UNIQUE DEFAULT gen_random_uuid(),
    unlocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE one_time_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    status otp_status NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_api_key ON users(api_key);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_one_time_codes_code ON one_time_codes(code);
CREATE INDEX idx_one_time_codes_user_id ON one_time_codes(user_id);
CREATE INDEX idx_one_time_codes_status ON one_time_codes(status);

CREATE OR REPLACE FUNCTION expire_stale_codes()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE one_time_codes
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_expire_codes
    AFTER INSERT ON one_time_codes
    FOR EACH STATEMENT
    EXECUTE FUNCTION expire_stale_codes();
