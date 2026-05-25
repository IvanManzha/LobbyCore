import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { LayoutConfigProvider, useLayoutConfigState } from '../contexts/LayoutConfigContext';
import { useAuth } from '../hooks/useAuth';
import { useChampion } from '../hooks/useChampion';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useTranslation } from '../contexts/LanguageContext';
import { playerApi } from '../services/api';
import { APP_NAME, FEATURE_DNA_LAB, DEVELOPERS } from '../config/app';
import { useUnread } from '../contexts/UnreadContext';
import { useWallet } from '../contexts/WalletContext';
import { getPageTitle } from '../utils/pageTitle';
import Sidebar, { SIDEBAR_COLLAPSED_KEY } from './Sidebar';
import TopBar from './layout/TopBar';
import BottomNav from './BottomNav';
import DnaLabShell from './dna-lab/DnaLabShell';
import { DnaLabEntryProvider } from '../contexts/DnaLabEntryContext';
import { DnaPreloadProvider } from '../contexts/DnaPreloadContext';
import './Layout.css';

function LayoutInner() {
  const config = useLayoutConfigState();
  const {
    showInfoSidebar = false,
    pageTitle: pageTitleOverride = '',
    headerAction = null,
    asideContent = null,
  } = config;
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuAnchorRef = useRef(null);
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshAuth } = useAuth();
  const { lang, t } = useTranslation();
  const refreshAuthRef = useRef(refreshAuth);

  // Обновляем ref при изменении refreshAuth, чтобы избежать перерендеров
  useEffect(() => {
    refreshAuthRef.current = refreshAuth;
  }, [refreshAuth]);

  // Мемоизируем adminUsers, чтобы не пересчитывать при каждом рендере
  const adminUsers = useMemo(() => {
    const defaultAdmin = 'ivanchk';
    return (import.meta.env.VITE_ADMIN_USERS || defaultAdmin)
      .split(',')
      .map(u => u.trim().toLowerCase())
      .filter(Boolean);
  }, []);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const userKey = (user.pubgNick || user.username || '').toLowerCase();
    return adminUsers.includes(userKey);
  }, [user, adminUsers]);

  const bankirUsers = useMemo(() => {
    return (import.meta.env.VITE_BANKIR_USERS || '')
      .split(',')
      .map(u => u.trim().toLowerCase())
      .filter(Boolean);
  }, []);
  const isBankir = useMemo(() => {
    if (!user) return false;
    const userKey = (user.pubgNick || user.username || '').toLowerCase();
    return bankirUsers.includes(userKey);
  }, [user, bankirUsers]);

  const isDeveloper = useMemo(() => {
    if (!user) return false;
    const userKey = (user.pubgNick || user.username || '').toLowerCase();
    return DEVELOPERS.length > 0 && DEVELOPERS.includes(userKey);
  }, [user]);

  const devDataMode = useMemo(() => import.meta.env.VITE_DEV_DATA === 'true', []);

  const navItems = useMemo(() => {
    const items = [
      { id: 'dashboard', path: '/', label: t('nav.dashboard'), icon: 'dashboard' },
      { id: 'feed', path: '/feed', label: t('nav.feed'), icon: 'feed' },
      { id: 'tournaments', path: '/tournaments', label: t('nav.tournaments'), icon: 'tournaments', matchPaths: ['/tournament'] },
      { id: 'dna', path: '/dna-lab', label: t('nav.dnaLab'), icon: 'dnaLab', useDnaEntry: true },
      { id: 'ladder', path: '/ladder', label: t('nav.ladder'), icon: 'ladder' }
    ];

    // Банкир / Админ — Финансы (админ) и привязка Steam
    if (isBankir || isAdmin) {
      items.push({
        id: 'bankir-group',
        label: isBankir ? t('nav.banker') : t('nav.admin'),
        icon: 'wallet',
        children: [
          { id: 'admin-finance', path: '/admin/finance', label: t('nav.adminFinance'), icon: 'wallet', matchPaths: ['/admin/finance'] }
        ]
      });
    }

    if (isAdmin && devDataMode) {
      items.push({ id: 'admin-studio', path: '/admin/studio', label: t('nav.adminStudio'), icon: 'admin', matchPaths: ['/admin/studio'] });
    }

    if (!isAuthenticated) {
      items.push({ id: 'login', path: '/login', label: t('nav.login'), icon: 'login' });
    }

    return items;
  }, [t, isAdmin, isBankir, isDeveloper, isAuthenticated, user, devDataMode]);

  /** Плоский список для BottomNav (мобилка): без групп, только листовые ссылки */
  const flatNavItems = useMemo(() => {
    const flat = [];
    for (const item of navItems) {
      if (item.children) {
        flat.push(...item.children);
      } else {
        flat.push(item);
      }
    }
    return flat;
  }, [navItems]);

  // Используем ref для refreshAuth, чтобы избежать перерендеров при изменении функции
  useEffect(() => {
    const handleAuthUpdate = () => {
      if (refreshAuthRef.current) {
        refreshAuthRef.current();
      }
    };

    window.addEventListener('auth-updated', handleAuthUpdate);

    return () => {
      window.removeEventListener('auth-updated', handleAuthUpdate);
    };
  }, []); // Пустой массив зависимостей, так как используем ref

  const handleLogout = async () => {
    await playerApi.logout();
    navigate('/');
    window.location.reload();
  };

  const { champion } = useChampion();
  const { hasUnreadFeed } = useUnread();
  const { refetch: refetchWallet } = useWallet();
  const location = useLocation();

  // Подтягиваем кошелёк при появлении авторизации (перезаход/обновление), чтобы бабл DC не показывал 0
  useEffect(() => {
    if (isAuthenticated) refetchWallet();
  }, [isAuthenticated, refetchWallet]);
  const pageTitle = pageTitleOverride || getPageTitle(location.pathname, lang);

  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} | ${APP_NAME}` : APP_NAME;
  }, [pageTitle]);

  const handleProfileMenuToggle = useCallback((open) => {
    setProfileMenuOpen((prev) => (open !== undefined ? open : !prev));
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  const isDnaLab = location.pathname === '/dna-lab';

  useEffect(() => {
    if (isDnaLab) {
      document.body.classList.add('dna-mode');
    }
    return () => {
      document.body.classList.remove('dna-mode');
    };
  }, [isDnaLab]);

  return (
    <DnaLabEntryProvider>
      {isDnaLab ? (
        <div className="app-shell dna-lab-mode">
          <DnaLabShell />
        </div>
      ) : (
        <DnaPreloadProvider
          playerId={FEATURE_DNA_LAB && isDeveloper ? (user?.pubgNick || user?.username) : null}
          seasonId="2025"
          useDnaTest={false}
        >
        <div
          className={`app-shell ${!isMobile && sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
          style={{ '--sidebar-width': !isMobile ? (sidebarCollapsed ? '68px' : '260px') : '0px' }}
          data-dna-capture-root
        >
          <Sidebar
            items={navItems}
            collapsed={sidebarCollapsed}
            onToggleCollapse={!isMobile ? handleToggleSidebar : undefined}
            mobileOpen={mobileDrawerOpen}
            onMobileClose={isMobile ? () => setMobileDrawerOpen(false) : undefined}
            unreadFeed={hasUnreadFeed}
            isMobile={isMobile}
          />
          <div className="app-main">
            <TopBar
              pageTitleOverride={pageTitleOverride ? String(pageTitleOverride) : undefined}
              pageTitle={pageTitle}
              isMobile={isMobile}
              onOpenDrawer={() => setMobileDrawerOpen(true)}
              headerAction={headerAction}
              champion={champion}
              user={user}
              isAuthenticated={isAuthenticated}
              profileMenuOpen={profileMenuOpen}
              onProfileMenuToggle={handleProfileMenuToggle}
              profileMenuAnchorRef={profileMenuAnchorRef}
              onLogout={handleLogout}
            />
            <div
              className={`app-content ${showInfoSidebar || asideContent ? 'with-aside' : ''}`}
            >
              <main className="app-content-main">
                <Outlet />
              </main>
              {(showInfoSidebar || asideContent) && (
                <aside className="app-aside">
                  {asideContent}
                </aside>
              )}
            </div>
          </div>
          <BottomNav items={flatNavItems} />
        </div>
        </DnaPreloadProvider>
      )}
    </DnaLabEntryProvider>
  );
}

function Layout() {
  const location = useLocation();
  return (
    <LayoutConfigProvider pathname={location.pathname}>
      <LayoutInner />
    </LayoutConfigProvider>
  );
}

export default Layout;

