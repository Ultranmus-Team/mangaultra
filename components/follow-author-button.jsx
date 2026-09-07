'use client';

import { useState, useTransition } from 'react';
import { UserPlus, UserCheck } from 'lucide-react';
import { followAuthorAction, unfollowAuthorAction } from '@/app/u/actions';
import { Button } from '@/components/ui/button';

export default function FollowAuthorButton({ authorId, username, initialFollowing }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const action = next ? followAuthorAction : unfollowAuthorAction;
      const result = await action(authorId, username);
      if (result?.error) setFollowing(!next);
    });
  }

  return (
    <Button variant={following ? 'outline' : 'default'} size="sm" disabled={isPending} onClick={toggle}>
      {following ? (
        <>
          <UserCheck className="mr-1.5 h-4 w-4" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Follow
        </>
      )}
    </Button>
  );
}
