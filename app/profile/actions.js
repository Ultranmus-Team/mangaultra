'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabaseServer';
import * as profileLib from '@/lib/profile';

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
}

export async function updateProfileAction(prevState, formData) {
  const user = await requireUser();
  const bio = formData.get('bio');
  const avatarFile = formData.get('avatar');

  try {
    const avatarBuffer =
      avatarFile && avatarFile.size > 0 ? Buffer.from(await avatarFile.arrayBuffer()) : null;
    await profileLib.updateProfile(user.id, { bio, avatarBuffer });
  } catch (err) {
    return { error: err.message };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

export async function changePasswordAction(prevState, formData) {
  await requireUser();
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');

  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
