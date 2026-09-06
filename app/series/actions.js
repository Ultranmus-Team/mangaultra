'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/session';
import { query } from '@/lib/db';
import * as social from '@/lib/social';

// Chapter comments and reactions are open to any logged-in reader — unlike
// dashboard/admin actions this never redirects to /login, it just returns
// an error the UI shows inline (the reader is mid-page, not on a form).
async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('You must be logged in.');
  return profile;
}

async function chapterContext(chapterId) {
  const { rows } = await query(
    `SELECT c.chapter_number, s.id AS series_id, s.canonical_slug
     FROM chapters c JOIN series s ON s.id = c.series_id
     WHERE c.id = $1`,
    [chapterId]
  );
  return rows[0] || null;
}

export async function addChapterCommentAction(chapterId, parentId, prevState, formData) {
  let profile;
  try {
    profile = await requireProfile();
  } catch (err) {
    return { error: err.message };
  }

  if (profile.is_banned) {
    return { error: 'Your account has been blocked from posting. See your dashboard for details.' };
  }

  const ctx = await chapterContext(chapterId);
  if (!ctx) return { error: 'Chapter not found' };

  const body = formData.get('body');
  const imageFile = formData.get('image');

  try {
    const imageBuffer = imageFile && imageFile.size > 0 ? Buffer.from(await imageFile.arrayBuffer()) : null;
    await social.addChapterComment(profile.id, ctx.series_id, chapterId, { body, imageBuffer, parentId });
  } catch (err) {
    return { error: err.message };
  }

  revalidatePath(`/series/${ctx.canonical_slug}/chapter/${ctx.chapter_number}`);
  return { success: true };
}

export async function deleteChapterCommentAction(chapterId, commentId) {
  let profile;
  try {
    profile = await requireProfile();
  } catch (err) {
    return { error: err.message };
  }

  try {
    await social.deleteChapterComment(profile.id, profile.role === 'admin', chapterId, commentId);
  } catch (err) {
    return { error: err.message };
  }

  const ctx = await chapterContext(chapterId);
  if (ctx) revalidatePath(`/series/${ctx.canonical_slug}/chapter/${ctx.chapter_number}`);
  return { success: true };
}

export async function setChapterReactionAction(chapterId, reactionType) {
  let profile;
  try {
    profile = await requireProfile();
  } catch (err) {
    return { error: err.message };
  }

  let result;
  try {
    result = await social.setChapterReaction(profile.id, chapterId, reactionType);
  } catch (err) {
    return { error: err.message };
  }

  const ctx = await chapterContext(chapterId);
  if (ctx) revalidatePath(`/series/${ctx.canonical_slug}/chapter/${ctx.chapter_number}`);
  return { success: true, ...result };
}

// Read-only pagination fetches — no login required, so no requireProfile.
export async function getChapterCommentsAction(chapterId, offset) {
  return social.getChapterComments(chapterId, { offset });
}

export async function getChapterCommentRepliesAction(chapterId, parentId, offset) {
  return social.getChapterCommentReplies(chapterId, parentId, { offset });
}
