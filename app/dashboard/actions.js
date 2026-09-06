'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/session';
import { query } from '@/lib/db';
import * as creator from '@/lib/creator';

async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

// A blocked account keeps read/manage access to what it already has (it can
// still hide/delete its own chapters, or appeal in its block thread) but
// can't create anything new or post publicly — checked at each of those
// entry points rather than in requireProfile itself.
function assertNotBanned(profile) {
  if (profile.is_banned) {
    throw new Error('Your account has been blocked from posting. See your dashboard for details.');
  }
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
  const profile = await requireProfile();
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
    assertNotBanned(profile);
    const coverImageBuffer =
      coverImageFile && coverImageFile.size > 0 ? Buffer.from(await coverImageFile.arrayBuffer()) : null;
    series = await creator.createSeries(profile.id, { title, contentType, description, tags, coverImageBuffer });
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
  const profile = await requireProfile();
  const chapterNumber = formData.get('chapterNumber');
  const title = formData.get('title');
  const files = formData.getAll('pages').filter((f) => f && f.size > 0);

  if (files.length === 0) {
    return { error: 'At least one page image is required.' };
  }

  try {
    assertNotBanned(profile);
    const pageBuffers = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
    await creator.addMangaChapter(profile.id, seriesId, { chapterNumber, title, pageBuffers });
  } catch (err) {
    return { error: err.message };
  }

  revalidateSeries(await slugForSeries(seriesId));
  return { success: true };
}

export async function addNovelChapterAction(seriesId, prevState, formData) {
  const profile = await requireProfile();
  const chapterNumber = formData.get('chapterNumber');
  const title = formData.get('title');
  const body = formData.get('body');

  if (!body) {
    return { error: 'Chapter body text is required.' };
  }

  try {
    assertNotBanned(profile);
    await creator.addNovelChapter(profile.id, seriesId, { chapterNumber, title, body });
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

export async function deleteChapterAction(seriesId, chapterId) {
  const profile = await requireProfile();
  try {
    await creator.deleteChapter(profile.id, profile.role === 'admin', seriesId, chapterId);
  } catch (err) {
    return { error: err.message };
  }
  revalidateSeries(await slugForSeries(seriesId));
  return { success: true };
}

export async function sendChapterMessageAction(seriesId, chapterId, prevState, formData) {
  const profile = await requireProfile();
  const body = formData.get('body');
  const imageFile = formData.get('image');

  try {
    const imageBuffer = imageFile && imageFile.size > 0 ? Buffer.from(await imageFile.arrayBuffer()) : null;
    await creator.addChapterReviewMessage(profile.id, profile.role === 'admin', seriesId, chapterId, {
      body,
      imageBuffer,
    });
  } catch (err) {
    return { error: err.message };
  }
  revalidateSeries(await slugForSeries(seriesId));
  return { success: true };
}

export async function resubmitChapterAction(seriesId, chapterId, prevState, formData) {
  const profile = await requireProfile();
  const body = formData.get('body');
  const imageFile = formData.get('image');

  try {
    const imageBuffer = imageFile && imageFile.size > 0 ? Buffer.from(await imageFile.arrayBuffer()) : null;
    await creator.resubmitChapter(profile.id, seriesId, chapterId, { body, imageBuffer });
  } catch (err) {
    return { error: err.message };
  }
  revalidateSeries(await slugForSeries(seriesId));
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

export async function submitForApprovalAction(seriesId, prevState, formData) {
  const profile = await requireProfile();
  const body = formData?.get('body');
  const imageFile = formData?.get('image');

  try {
    assertNotBanned(profile);
    const imageBuffer = imageFile && imageFile.size > 0 ? Buffer.from(await imageFile.arrayBuffer()) : null;
    await creator.submitForApproval(profile.id, seriesId, { body, imageBuffer });
  } catch (err) {
    return { error: err.message };
  }
  revalidateSeries(await slugForSeries(seriesId));
  return { success: true };
}

export async function sendSeriesMessageAction(seriesId, prevState, formData) {
  const profile = await requireProfile();
  const body = formData.get('body');
  const imageFile = formData.get('image');

  try {
    const imageBuffer = imageFile && imageFile.size > 0 ? Buffer.from(await imageFile.arrayBuffer()) : null;
    await creator.addSeriesReviewMessage(profile.id, profile.role === 'admin', seriesId, { body, imageBuffer });
  } catch (err) {
    return { error: err.message };
  }
  revalidateSeries(await slugForSeries(seriesId));
  return { success: true };
}

// A blocked user's only channel back to an admin — posting here is exempt
// from assertNotBanned since it's an appeal, not new content.
export async function sendMyBlockMessageAction(prevState, formData) {
  const profile = await requireProfile();
  const body = formData.get('body');
  const imageFile = formData.get('image');

  try {
    const imageBuffer = imageFile && imageFile.size > 0 ? Buffer.from(await imageFile.arrayBuffer()) : null;
    await creator.addUserBlockMessage(profile.id, false, profile.id, { body, imageBuffer });
  } catch (err) {
    return { error: err.message };
  }
  revalidatePath('/dashboard');
  return { success: true };
}
