import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicProfile } from '@/lib/profile';
import { getCurrentProfile } from '@/lib/session';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import CoverPlaceholder from '@/components/cover-placeholder';
import SeriesCover from '@/components/series-cover';

export const dynamic = 'force-dynamic';

export default async function PublicProfilePage({ params }) {
  const data = await getPublicProfile(params.username);
  if (!data) notFound();

  const { profile, series } = data;
  const viewer = await getCurrentProfile();
  const isOwnProfile = viewer?.id === profile.id;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center gap-4">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={profile.username}
            className="h-20 w-20 rounded-full border object-cover"
          />
        ) : (
          <CoverPlaceholder title={profile.username} className="h-20 w-20 rounded-full border" />
        )}
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{profile.username}</h1>
          {profile.bio && <p className="max-w-xl text-sm text-muted-foreground">{profile.bio}</p>}
        </div>
        {isOwnProfile && (
          <Link href="/profile">
            <Button variant="outline" size="sm">Edit profile</Button>
          </Link>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Published ({series.length})</h2>
        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing published yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {series.map((s) => (
              <Link key={s.id} href={`/series/${s.canonical_slug}`}>
                <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                  <SeriesCover
                    src={s.cover_image}
                    title={s.title}
                    className="aspect-[2/3] w-full"
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 45vw"
                  />
                  <CardHeader className="space-y-1.5 p-3">
                    <Badge variant="outline" className="w-fit capitalize">{s.content_type}</Badge>
                    <CardTitle className="line-clamp-2 text-sm leading-snug">{s.title}</CardTitle>
                    <CardDescription className="text-xs">{s.chapter_count} chapters</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
