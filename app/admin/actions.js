'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/session';
import { query } from '@/lib/db';
import * as admin from '@/lib/admin';

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
  revalidatePath('/admin');
  if (slug) revalidatePath(`/series/${slug}`);
}

export async function approveSeriesAction(seriesId) {
  await requireAdmin();
  const slug = await slugForSeries(seriesId);
  try {
    await admin.approveSeries(seriesId);
  } catch (err) {
    return { error: err.message };
  }
  revalidateAdminViews(slug);
  return { success: true };
}

export async function rejectSeriesAction(seriesId, reason) {
  await requireAdmin();
  const slug = await slugForSeries(seriesId);
  try {
    await admin.rejectSeries(seriesId, reason);
  } catch (err) {
    return { error: err.message };
  }
  revalidateAdminViews(slug);
  return { success: true };
}

export async function delistSeriesAction(seriesId) {
  await requireAdmin();
  const slug = await slugForSeries(seriesId);
  try {
    await admin.delistSeries(seriesId);
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
  revalidatePath('/admin');
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
