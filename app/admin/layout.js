import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/session';
import AdminTabs from '@/components/admin-tabs';

export const dynamic = 'force-dynamic';

// Admin-only gate for every /admin/* route, done once here instead of
// repeated in each page — a page under this layout can assume the viewer
// is already confirmed as an admin.
export default async function AdminLayout({ children }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (profile.role !== 'admin') redirect('/dashboard');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Moderation queue and platform controls.</p>
      </div>
      <AdminTabs />
      {children}
    </div>
  );
}
