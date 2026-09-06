'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createSeriesAction } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create series'}
    </Button>
  );
}

export default function NewSeriesPage() {
  const [state, formAction] = useFormState(createSeriesAction, { error: null });

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>New series</CardTitle>
          <CardDescription>
            Create a draft, then upload at least 10 chapters before submitting for review.
          </CardDescription>
        </CardHeader>
        <form action={formAction}>
          <CardContent className="space-y-4">
            {state?.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contentType">Content type</Label>
              <select
                id="contentType"
                name="contentType"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="manga">Manga (image chapters)</option>
                <option value="novel">Novel (text chapters)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coverImage">Cover image (optional)</Label>
              <Input id="coverImage" name="coverImage" type="file" accept="image/*" />
              <p className="text-xs text-muted-foreground">
                Works the same for manga and novels. Skip it and we'll show your title's initial instead.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (optional)</Label>
              <Input id="tags" name="tags" type="text" placeholder="fantasy, romance, slice of life" />
              <p className="text-xs text-muted-foreground">Comma-separated, up to 10.</p>
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
