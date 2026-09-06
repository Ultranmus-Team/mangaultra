import { getPlatformSettings } from '@/lib/admin';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import PlatformSettingsForm from '@/components/platform-settings-form';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const settings = await getPlatformSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Platform settings</CardTitle>
      </CardHeader>
      <CardContent>
        <PlatformSettingsForm settings={settings} />
      </CardContent>
    </Card>
  );
}
