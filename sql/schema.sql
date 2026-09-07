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
        CHECK (status IN ('published', 'hidden', 'rejected')),
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

-- An admin can reject an individual chapter (hidden from readers, with a
-- reason shown to the creator) independent of the series' own moderation
-- status; the author can then resubmit it ('pending_review') for another
-- look. Re-running this against a database created before 'rejected' was
-- added to the CHECK above requires dropping and re-adding the constraint.
ALTER TABLE chapters DROP CONSTRAINT IF EXISTS chapters_status_check;
ALTER TABLE chapters ADD CONSTRAINT chapters_status_check
    CHECK (status IN ('published', 'hidden', 'rejected', 'pending_review'));
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Optional creator-supplied tags (e.g. "fantasy", "romance"); an empty
-- array means none were set, not that tagging is unsupported.
ALTER TABLE series ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- Moderation thread for a chapter: the admin's reject/approve notes and the
-- author's resubmission notes all land here as one ordered conversation
-- between the two of them, each entry optionally carrying one image.
CREATE TABLE IF NOT EXISTS chapter_review_messages (
    id SERIAL PRIMARY KEY,
    chapter_id INT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL DEFAULT 'message'
        CHECK (kind IN ('message', 'resubmit', 'reject', 'approve')),
    body TEXT,
    image_url TEXT,
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chapter_review_messages_chapter_id ON chapter_review_messages(chapter_id);

-- Same idea, one level up: a moderation thread for the whole series (the
-- series-level approve/reject/delist and the creator's resubmission notes),
-- independent of any per-chapter thread above.
CREATE TABLE IF NOT EXISTS series_review_messages (
    id SERIAL PRIMARY KEY,
    series_id INT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL DEFAULT 'message'
        CHECK (kind IN ('message', 'resubmit', 'reject', 'approve', 'delist')),
    body TEXT,
    image_url TEXT,
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_series_review_messages_series_id ON series_review_messages(series_id);

-- Same thread pattern one level further up: blocking a user (profiles.
-- is_banned) logs the reason here, and the user can reply/appeal in the
-- same thread — it's their one channel to reach an admin once blocked.
CREATE TABLE IF NOT EXISTS user_block_messages (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL DEFAULT 'message'
        CHECK (kind IN ('message', 'block', 'unblock')),
    body TEXT,
    image_url TEXT,
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_block_messages_user_id ON user_block_messages(user_id);

-- Read/unread tracking for the three thread types above, per viewer — a
-- thread has no single "read" state since the author and an admin (or two
-- different admins) can each have their own last-seen point in the same
-- conversation. A message is unread for a user if it postdates their row
-- here (or no row exists at all, meaning nothing has ever been read).
CREATE TABLE IF NOT EXISTS thread_read_states (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    thread_type VARCHAR(20) NOT NULL CHECK (thread_type IN ('chapter', 'series', 'account')),
    -- TEXT, not INT: chapter/series threads key off a serial id, but
    -- account threads key off the (UUID) profile id.
    thread_id TEXT NOT NULL,
    last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, thread_type, thread_id)
);
CREATE INDEX IF NOT EXISTS idx_thread_read_states_lookup ON thread_read_states(user_id, thread_type, thread_id);

-- Public per-chapter discussion, open to any logged-in reader (unlike the
-- private chapter_review_messages thread above). One level of threading —
-- replies always point at a top-level comment, Instagram-style, so
-- "reply to a reply" flattens under the same parent instead of nesting
-- further; enforced in lib/social.js, not by this FK alone.
CREATE TABLE IF NOT EXISTS chapter_comments (
    id SERIAL PRIMARY KEY,
    chapter_id INT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    parent_id INT REFERENCES chapter_comments(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body TEXT,
    image_url TEXT,
    storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chapter_comments_chapter_id ON chapter_comments(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapter_comments_parent_id ON chapter_comments(parent_id);

-- One reaction per reader per chapter (Facebook-style — a reader picks one
-- of a small emoji set, not a single like), toggled on/off or switched.
-- Counting these (and chapter_comments) per chapter is the raw signal a
-- future trending/popular view would rank on.
CREATE TABLE IF NOT EXISTS chapter_reactions (
    id SERIAL PRIMARY KEY,
    chapter_id INT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL DEFAULT 'like'
        CHECK (reaction_type IN ('like', 'love', 'laugh', 'wow', 'sad')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (chapter_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chapter_reactions_chapter_id ON chapter_reactions(chapter_id);

-- Re-running against a database created before reaction_type existed.
ALTER TABLE chapter_reactions ADD COLUMN IF NOT EXISTS reaction_type VARCHAR(20) NOT NULL DEFAULT 'like';
ALTER TABLE chapter_reactions DROP CONSTRAINT IF EXISTS chapter_reactions_reaction_type_check;
ALTER TABLE chapter_reactions ADD CONSTRAINT chapter_reactions_reaction_type_check
    CHECK (reaction_type IN ('like', 'love', 'laugh', 'wow', 'sad'));

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

-- Following an author notifies the follower whenever that author's next
-- series is approved (see notifyFollowersNewManga in lib/notifications.js) —
-- not when it's merely created, since a draft/pending series isn't visible
-- to anyone but its owner and an admin yet.
CREATE TABLE IF NOT EXISTS author_follows (
    id SERIAL PRIMARY KEY,
    follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (follower_id, author_id),
    CHECK (follower_id != author_id)
);
CREATE INDEX IF NOT EXISTS idx_author_follows_author ON author_follows(author_id);
CREATE INDEX IF NOT EXISTS idx_author_follows_follower ON author_follows(follower_id);

-- Following a series notifies the follower on every new chapter, unless
-- min_chapter is set — then only once a chapter reaches that number, for a
-- reader who wants to wait until a series has caught up before diving in.
CREATE TABLE IF NOT EXISTS series_follows (
    id SERIAL PRIMARY KEY,
    follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    series_id INT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    min_chapter NUMERIC(6,1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (follower_id, series_id)
);
CREATE INDEX IF NOT EXISTS idx_series_follows_series ON series_follows(series_id);
CREATE INDEX IF NOT EXISTS idx_series_follows_follower ON series_follows(follower_id);

-- One row per notification, per recipient. series_id/chapter_id are always
-- populated together whenever a chapter is involved (comment_reply,
-- reaction, new_chapter, a chapter-thread message) so lib/notifications.js
-- can build the whole feed with one LEFT JOIN series + one LEFT JOIN
-- chapters, regardless of type — the type-specific title/link is then built
-- in JS, the same way lib/admin.js's getAllThreads merges heterogeneous rows.
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN (
        'new_manga', 'new_chapter', 'thread_message', 'comment_reply',
        'new_follower', 'reaction', 'admin_notice', 'new_comment'
    )),
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    series_id INT REFERENCES series(id) ON DELETE CASCADE,
    chapter_id INT REFERENCES chapters(id) ON DELETE CASCADE,
    -- Always the THREAD ROOT (top-level) comment's id, even for a
    -- comment_reply notification about a reply further down that thread —
    -- see getCommentThread in lib/social.js, which is keyed off this.
    comment_id INT REFERENCES chapter_comments(id) ON DELETE CASCADE,
    -- thread_type/thread_id mirror thread_read_states above (TEXT thread_id
    -- since account threads key off a UUID, chapter/series off a serial id).
    thread_type VARCHAR(20),
    thread_id TEXT,
    body TEXT,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Never notify someone about their own action. lib/notifications.js's
    -- createNotification already checks this in application code before
    -- every insert, but that only guards call sites that remember to go
    -- through it — this makes a self-notification structurally impossible
    -- to insert at all, regardless of which code path (present or future)
    -- tries to.
    CHECK (actor_id IS NULL OR actor_id != user_id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;

-- Re-running against a database created before 'new_comment' existed (a
-- creator being notified about any new comment on their chapter, not just a
-- reply to their own comment — see addChapterComment in lib/social.js).
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'new_manga', 'new_chapter', 'thread_message', 'comment_reply',
        'new_follower', 'reaction', 'admin_notice', 'new_comment'
    ));

-- Re-running against a database created before the self-notification CHECK
-- existed — makes it structurally impossible to insert actor_id = user_id,
-- on top of the application-level guard in createNotification.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_actor_not_self_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_actor_not_self_check
    CHECK (actor_id IS NULL OR actor_id != user_id);
