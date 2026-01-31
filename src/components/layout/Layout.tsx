import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { OfflineIndicator } from '@/components/ui';

export function Layout() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <OfflineIndicator />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
