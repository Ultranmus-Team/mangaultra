'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/session';
import * as follows from '@/lib/follows';

async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

export async function followAuthorAction(authorId, username) {
  const profile = await requireProfile();
  try {
    await follows.followAuthor(profile.id, authorId);
  } catch (err) {
    return { error: err.message };
  }
  if (username) revalidatePath(`/u/${username}`);
  return { success: true };
}

export async function unfollowAuthorAction(authorId, username) {
  const profile = await requireProfile();
  try {
    await follows.unfollowAuthor(profile.id, authorId);
  } catch (err) {
    return { error: err.message };
  }
  if (username) revalidatePath(`/u/${username}`);
  return { success: true };
}
