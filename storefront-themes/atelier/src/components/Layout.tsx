import React from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWishlist } from '@matjar/theme-shared/hooks/useWishlist';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import { AtelierUIProvider, useAtelierUI } from '../contexts/AtelierUI';
import Header from './chrome/Header';
import SearchCanvas from './chrome/SearchCanvas';
import MiniCart from './chrome/MiniCart';
import AddedModal from './chrome/AddedModal';
import MobileDrawer from './chrome/MobileDrawer';
import Footer from './chrome/Footer';

const Shell: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const { open } = useAtelierUI();
  const { count } = useWishlist();

  const icon = (d: string) => <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
  return (
    <div className="relative flex min-h-screen flex-col bg-[color:var(--color-background)] font-body text-[color:var(--color-foreground)]">
      <Header />
      <main className="flex-1"><Outlet /></main>
      <Footer />
      <MobileBottomNav
        onCartClick={() => open('minicart')}
        items={[
          { id: 'home', label: t('theme.layout.nav.home'), href: '/', icon: icon('M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z'), match: (p) => p === '/' },
          { id: 'shop', label: t('theme.layout.nav.shop'), href: '/products', icon: icon('M6 8h12l1 13H5L6 8zM9 8V6a3 3 0 016 0v2'), match: (p) => p.startsWith('/products') || p.startsWith('/categories') },
          { id: 'wishlist', label: t('theme.layout.wishlist'), href: '/wishlist', icon: icon('M12 21s-8-5-8-11a4 4 0 018-1 4 4 0 018 1c0 6-8 11-8 11z'), badge: count || 0 },
          { id: 'account', label: t('theme.layout.account'), href: '/account', icon: icon('M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0') },
        ]}
      />
      <SearchCanvas />
      <MiniCart />
      <MobileDrawer />
      <AddedModal />
    </div>
  );
};

const Layout: React.FC = () => (
  <AtelierUIProvider>
    <Shell />
  </AtelierUIProvider>
);

export default Layout;
