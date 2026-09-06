-- Creator-upload platform schema (Supabase / PostgreSQL)
-- Users create accounts (Supabase Auth), upload their own series
-- (manga now, novel now, video later), submit for approval once they
-- have enough chapters, and auto-publish further chapters once approved.

-- Extends Supabase's built-in auth.users with app-specific profile data.
-- A row is only inserted here once a signup is actually confirmed (email
-- link clicked, or Google OAuth completed) — see app/auth/callback/route.js.
-- Unconfirmed signups exist in auth.users but never get a profiles row.
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    email TEXT UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'creator'
        CHECK (role IN ('creator', 'admin')),
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optional, creator-editable profile fields shown on their public profile.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE TABLE IF NOT EXISTS series (
    id SERIAL PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    canonical_slug VARCHAR(255) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content_type VARCHAR(20) NOT NULL
        CHECK (content_type IN ('manga', 'novel', 'video')),
    cover_image TEXT,
    moderation_status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (moderation_status IN ('draft', 'pending_review', 'approved', 'rejected', 'delisted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chapters (
    id SERIAL PRIMARY KEY,
    series_id INT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    chapter_number NUMERIC(6,1) NOT NULL,
    title TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'published'
        CHECK (status IN ('published', 'hidden')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (series_id, chapter_number)
);

-- Manga chapters: ordered page images.
CREATE TABLE IF NOT EXISTS chapter_pages (
    id SERIAL PRIMARY KEY,
    chapter_id INT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    cdn_image_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    UNIQUE (chapter_id, page_number)
);

-- Novel chapters: body text lives directly on the chapter (one-to-one).
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS body TEXT;

-- Shown to the creator when their series is rejected; cleared on resubmit.
ALTER TABLE series ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Optional creator-supplied tags (e.g. "fantasy", "romance"); an empty
-- array means none were set, not that tagging is unsupported.
ALTER TABLE series ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL
);

INSERT INTO platform_settings (key, value) VALUES
    ('uploads_paused', 'false'),
    ('min_chapters_for_approval', '10')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_series_creator_id ON series(creator_id);
CREATE INDEX IF NOT EXISTS idx_series_moderation_status ON series(moderation_status);
CREATE INDEX IF NOT EXISTS idx_chapters_series_id ON chapters(series_id);
CREATE INDEX IF NOT EXISTS idx_chapter_pages_chapter_id ON chapter_pages(chapter_id);
