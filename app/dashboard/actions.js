'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabaseServer';
import { getCurrentProfile } from '@/lib/session';
import { query } from '@/lib/db';
import * as creator from '@/lib/creator';

async function requireUserId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user.id;
}

async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

async function slugForSeries(seriesId) {
  const { rows } = await query('SELECT canonical_slug FROM series WHERE id = $1', [seriesId]);
  return rows[0]?.canonical_slug;
}

function revalidateSeries(slug) {
  if (!slug) return;
  revalidatePath(`/series/${slug}`);
}

export async function createSeriesAction(prevState, formData) {
  const userId = await requireUserId();
  const title = formData.get('title');
  const contentType = formData.get('contentType');
  const description = formData.get('description');
  const tags = formData.get('tags');
  const coverImageFile = formData.get('coverImage');

  if (!title || !contentType) {
    return { error: 'Title and content type are required.' };
  }

  let series;
  try {
    const coverImageBuffer =
      coverImageFile && coverImageFile.size > 0 ? Buffer.from(await coverImageFile.arrayBuffer()) : null;
    series = await creator.createSeries(userId, { title, contentType, description, tags, coverImageBuffer });
  } catch (err) {
    return { error: err.message };
  }

  redirect(`/series/${series.canonical_slug}`);
}

// Note: these are called as `boundAction.bind(null, seriesId)` and driven by
// useFormState, which invokes the result as (prevState, formData) — so the
// bound function actually receives (seriesId, prevState, formData). The
// prevState parameter below is required for the arguments to line up;
// dropping it silently shifts formData into prevState's slot.
export async function addMangaChapterAction(seriesId, prevState, formData) {
  const userId = await requireUserId();
  const chapterNumber = formData.get('chapterNumber');
  const title = formData.get('title');
  const files = formData.getAll('pages').filter((f) => f && f.size > 0);

  if (files.length === 0) {
    return { error: 'At least one page image is required.' };
  }

  try {
    const pageBuffers = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
    await creator.addMangaChapter(userId, seriesId, { chapterNumber, title, pageBuffers });
  } catch (err) {
    return { error: err.message };
  }

  revalidateSeries(await slugForSeries(seriesId));
  return { success: true };
}

export async function addNovelChapterAction(seriesId, prevState, formData) {
  const userId = await requireUserId();
  const chapterNumber = formData.get('chapterNumber');
  const title = formData.get('title');
  const body = formData.get('body');

  if (!body) {
    return { error: 'Chapter body text is required.' };
  }

  try {
    await creator.addNovelChapter(userId, seriesId, { chapterNumber, title, body });
  } catch (err) {
    return { error: err.message };
  }

  revalidateSeries(await slugForSeries(seriesId));
  return { success: true };
}

export async function updateMangaChapterAction(seriesId, chapterId, prevState, formData) {
  const profile = await requireProfile();
  const chapterNumber = formData.get('chapterNumber');
  const title = formData.get('title');

  let manifest;
  try {
    manifest = JSON.parse(formData.get('manifest') || '[]');
  } catch {
    return { error: 'Invalid page order data.' };
  }
  if (!Array.isArray(manifest) || manifest.length === 0) {
    return { error: 'At least one page image is required.' };
  }

  const newFiles = formData.getAll('newFiles').filter((f) => f && f.size > 0);

  try {
    const newFileBuffers = await Promise.all(newFiles.map(async (f) => Buffer.from(await f.arrayBuffer())));
    await creator.updateMangaChapter(profile.id, profile.role === 'admin', seriesId, chapterId, {
      chapterNumber,
      title,
      manifest,
      newFileBuffers,
    });
  } catch (err) {
    return { error: err.message };
  }

  const slug = await slugForSeries(seriesId);
  revalidateSeries(slug);
  if (slug) revalidatePath(`/series/${slug}/chapter/${chapterNumber}`);
  return { success: true };
}

export async function updateNovelChapterAction(seriesId, chapterId, prevState, formData) {
  const profile = await requireProfile();
  const chapterNumber = formData.get('chapterNumber');
  const title = formData.get('title');
  const body = formData.get('body');

  if (!body) {
    return { error: 'Chapter body text is required.' };
  }

  try {
    await creator.updateNovelChapter(profile.id, profile.role === 'admin', seriesId, chapterId, {
      chapterNumber,
      title,
      body,
    });
  } catch (err) {
    return { error: err.message };
  }

  const slug = await slugForSeries(seriesId);
  revalidateSeries(slug);
  if (slug) revalidatePath(`/series/${slug}/chapter/${chapterNumber}`);
  return { success: true };
}

export async function setChapterVisibilityAction(seriesId, chapterId, hidden) {
  const profile = await requireProfile();
  let result;
  try {
    result = await creator.setChapterVisibility(profile.id, profile.role === 'admin', seriesId, chapterId, hidden);
  } catch (err) {
    return { error: err.message };
  }
  const slug = await slugForSeries(seriesId);
  revalidateSeries(slug);
  if (slug) revalidatePath(`/series/${slug}/chapter/${result.chapter_number}`);
  return { success: true };
}

export async function submitForApprovalAction(seriesId) {
  const userId = await requireUserId();
  try {
    await creator.submitForApproval(userId, seriesId);
  } catch (err) {
    return { error: err.message };
  }
  revalidateSeries(await slugForSeries(seriesId));
  return { success: true };
}
