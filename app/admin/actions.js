'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/session';
import { query } from '@/lib/db';
import * as admin from '@/lib/admin';
import * as creator from '@/lib/creator';

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (profile.role !== 'admin') redirect('/dashboard');
  return profile;
}

async function slugForSeries(seriesId) {
  const { rows } = await query('SELECT canonical_slug FROM series WHERE id = $1', [seriesId]);
  return rows[0]?.canonical_slug;
}

function revalidateAdminViews(slug) {
  revalidatePath('/admin/manga');
  revalidatePath('/admin/chapters');
  if (slug) revalidatePath(`/series/${slug}`);
}

export async function approveSeriesAction(seriesId) {
  const profile = await requireAdmin();
  const slug = await slugForSeries(seriesId);
  try {
    await admin.approveSeries(profile.id, seriesId);
  } catch (err) {
    return { error: err.message };
  }
  revalidateAdminViews(slug);
  return { success: true };
}

export async function rejectSeriesAction(seriesId, reason) {
  const profile = await requireAdmin();
  const slug = await slugForSeries(seriesId);
  try {
    await admin.rejectSeries(profile.id, seriesId, reason);
  } catch (err) {
    return { error: err.message };
  }
  revalidateAdminViews(slug);
  return { success: true };
}

export async function rejectChapterAction(seriesId, chapterId, reason) {
  const profile = await requireAdmin();
  let result;
  try {
    result = await admin.rejectChapter(profile.id, seriesId, chapterId, reason);
  } catch (err) {
    return { error: err.message };
  }
  const slug = await slugForSeries(seriesId);
  revalidateAdminViews(slug);
  if (slug) revalidatePath(`/series/${slug}/chapter/${result.chapter_number}`);
  return { success: true };
}

export async function approveChapterAction(seriesId, chapterId, note) {
  const profile = await requireAdmin();
  let result;
  try {
    result = await admin.approveChapter(profile.id, seriesId, chapterId, note);
  } catch (err) {
    return { error: err.message };
  }
  const slug = await slugForSeries(seriesId);
  revalidateAdminViews(slug);
  if (slug) revalidatePath(`/series/${slug}/chapter/${result.chapter_number}`);
  return { success: true };
}

export async function delistSeriesAction(seriesId) {
  const profile = await requireAdmin();
  const slug = await slugForSeries(seriesId);
  try {
    await admin.delistSeries(profile.id, seriesId);
  } catch (err) {
    return { error: err.message };
  }
  revalidateAdminViews(slug);
  return { success: true };
}

export async function deleteSeriesAction(seriesId) {
  await requireAdmin();
  try {
    await admin.deleteSeriesCascade(seriesId);
  } catch (err) {
    return { error: err.message };
  }
  revalidatePath('/admin/manga');
  return { success: true };
}

export async function blockUserAction(userId, reason, hidePublished) {
  const profile = await requireAdmin();
  try {
    await admin.blockUser(profile.id, userId, { reason, hidePublished });
  } catch (err) {
    return { error: err.message };
  }
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath('/admin/manga');
  return { success: true };
}

export async function unblockUserAction(userId) {
  const profile = await requireAdmin();
  try {
    await admin.unblockUser(profile.id, userId);
  } catch (err) {
    return { error: err.message };
  }
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}

export async function sendUserBlockMessageAction(userId, prevState, formData) {
  const profile = await requireAdmin();
  const body = formData.get('body');
  const imageFile = formData.get('image');

  try {
    const imageBuffer = imageFile && imageFile.size > 0 ? Buffer.from(await imageFile.arrayBuffer()) : null;
    await creator.addUserBlockMessage(profile.id, true, userId, { body, imageBuffer });
  } catch (err) {
    return { error: err.message };
  }
  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}

export async function updateSettingsAction(prevState, formData) {
  await requireAdmin();
  const uploadsPaused = formData.get('uploadsPaused') === 'on';
  const minChaptersForApproval = Number(formData.get('minChaptersForApproval'));

  try {
    await admin.updatePlatformSettings({ uploadsPaused, minChaptersForApproval });
  } catch (err) {
    return { error: err.message };
  }
  revalidatePath('/admin');
  return { success: true };
}
