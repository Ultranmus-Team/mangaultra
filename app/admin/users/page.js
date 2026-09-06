import { getAllUsers } from '@/lib/admin';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import AdminUserRow from '@/components/admin-user-row';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const users = await getAllUsers();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Users ({users.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {users.map((u) => (
          <AdminUserRow key={u.id} user={u} />
        ))}
      </CardContent>
    </Card>
  );
}
