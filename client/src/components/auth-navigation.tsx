import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export const AuthNavigation = () => {
  return (
    <div className="fixed top-0 right-0 p-4 flex gap-2">
      <Button asChild variant="outline">
        <Link href="/auth">Member Login</Link>
      </Button>
      <Button asChild variant="secondary">
        <Link href="/chair-login">Chair Login</Link>
      </Button>
      <Button asChild variant="default">
        <Link href="/admin-login">Admin Login</Link>
      </Button>
    </div>
  );
};