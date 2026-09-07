'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/session';
import * as notifications from '@/lib/notifications';

async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

export async function markNotificationReadAction(notificationId) {
  const profile = await requireProfile();
  await notifications.markNotificationRead(profile.id, notificationId);
  revalidatePath('/notifications');
  return { success: true };
}

export async function markAllNotificationsReadAction() {
  const profile = await requireProfile();
  await notifications.markAllNotificationsRead(profile.id);
  revalidatePath('/notifications');
  return { success: true };
}

export async function loadMoreNotificationsAction(offset) {
  const profile = await requireProfile();
  return notifications.getNotifications(profile.id, { offset });
}

// These two fire silently in the background from public pages (a chapter,
// a comment thread) that don't require login — unlike the actions above,
// an anonymous visitor is a no-op, not a redirect to /login.
export async function markChapterNotificationsReadAction(chapterId) {
  const profile = await getCurrentProfile();
  if (!profile) return { success: true };
  await notifications.markChapterNotificationsRead(profile.id, chapterId);
  revalidatePath('/notifications');
  return { success: true };
}

export async function markCommentNotificationsReadAction(chapterId, commentId) {
  const profile = await getCurrentProfile();
  if (!profile) return { success: true };
  await notifications.markCommentNotificationsRead(profile.id, chapterId, commentId);
  revalidatePath('/notifications');
  return { success: true };
}
