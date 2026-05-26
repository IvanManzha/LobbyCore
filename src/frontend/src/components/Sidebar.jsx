import React, { useEffect, useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { APP_NAME, APP_TAGLINE } from '../config/app';
import { useTranslation } from '../contexts/LanguageContext';
import { useDnaLabEntry } from '../contexts/DnaLabEntryContext';
import { useDnaPreload } from '../contexts/DnaPreloadContext';
import './Sidebar.css';

const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';

/** Проверка активного маршрута с учётом matchPaths (вложенные роуты) */
export function isActive(item, pathname) {
  if (!item.path) return false;
  if (pathname === item.path) return true;
  if (item.path === '/' && (pathname === '/' || pathname === '/dashboard')) return true;
  if (item.matchPaths?.length) {
    return item.matchPaths.some((p) => pathname.startsWith(p));
  }
  return false;
}

/** Есть ли активный дочерний пункт в группе */
function hasActiveChild(children, pathname) {
  return children?.some((child) => isActive(child, pathname)) ?? false;
}

const icons = {
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  feed: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  ),
  tournaments: (
    // Кубок — иконка турниров
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  ),
  ladder: (
    // Пьедестал — иконка Ladder
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="4" height="8" />
      <rect x="10" y="7" width="4" height="12" />
      <rect x="17" y="13" width="4" height="6" />
      <path d="M2 21h20" />
    </svg>
  ),
  profile: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  login: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  ),
  create: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  admin: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  dnaLab: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
    </svg>
  ),
  wallet: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
      <path d="M17 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
    </svg>
  ),
};

function Sidebar({
  items = [],
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
  unreadFeed = false,
  isMobile = false,
}) {
  const { t } = useTranslation();
  const dnaLabEntry = useDnaLabEntry();
  const dnaPreload = useDnaPreload();
  const location = useLocation();

  const isDrawer = isMobile;
  const COLLAPSE_ANIM_MS = 220;

  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const toggleGroup = (id) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandedGroupsDerived = useMemo(() => {
    const set = new Set(expandedGroups);
    items.forEach((item) => {
      if (item.children && hasActiveChild(item.children, location.pathname)) {
        set.add(item.id);
      }
    });
    return set;
  }, [items, location.pathname, expandedGroups]);

  // При смене маршрута сбрасываем вручную раскрытые группы,
  // чтобы при переходе из подвкладки подпункты схлопывались с анимацией
  useEffect(() => {
    setExpandedGroups(new Set());
  }, [location.pathname]);
  const expanded = isDrawer ? true : !collapsed;

  // Закрытие drawer при смене маршрута (с задержкой, чтобы успела проиграть анимация сворачивания подпунктов)
  useEffect(() => {
    if (isDrawer && mobileOpen && onMobileClose) {
      const t = setTimeout(onMobileClose, COLLAPSE_ANIM_MS);
      return () => clearTimeout(t);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Body scroll lock при открытом drawer
  useEffect(() => {
    if (!isDrawer || !mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isDrawer, mobileOpen]);

  // Esc для закрытия drawer
  useEffect(() => {
    if (!isDrawer || !mobileOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onMobileClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isDrawer, mobileOpen, onMobileClose]);

  const handleNavClick = () => {
    if (onMobileClose) setTimeout(onMobileClose, COLLAPSE_ANIM_MS);
  };

  return (
    <>
      {isDrawer && mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={onMobileClose}
          onKeyDown={(e) => e.key === 'Escape' && onMobileClose?.()}
          role="button"
          tabIndex={0}
          aria-label={t('sidebar.closeMenu')}
        />
      )}
      <aside
        className={`sidebar ${expanded ? 'sidebar--expanded' : 'sidebar--collapsed'} ${isDrawer ? 'sidebar--drawer' : ''} ${mobileOpen ? 'sidebar--drawer-open' : ''}`}
        style={{ '--sidebar-width-expanded': '260px', '--sidebar-width-collapsed': '68px' }}
      >
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="sidebar-brand-icon-wrap" aria-hidden>
              <img className="sidebar-brand-logo" src="/lobbycore-icon-v4.png" alt="" />
            </span>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">{APP_NAME}</span>
              <span className="sidebar-brand-tagline">{APP_TAGLINE}</span>
            </div>
          </div>
        </div>

        {isDrawer && mobileOpen && (
          <button
            type="button"
            className="sidebar-drawer-close"
            onClick={onMobileClose}
            aria-label={t('sidebar.closeMenu')}
          >
            <span className="sidebar-chevron sidebar-chevron--left" />
          </button>
        )}

        <nav className="sidebar-nav" aria-label={t('sidebar.mainNav')}>
          {items.map((item) => {
            const Icon = icons[item.icon] ?? icons.dashboard;

            if (item.children) {
              const isGroupExpanded = expandedGroupsDerived.has(item.id);
              const groupActive = hasActiveChild(item.children, location.pathname);
              return (
                <div key={item.id} className="sidebar-group">
                  <button
                    type="button"
                    className={`sidebar-group-header ${groupActive ? 'sidebar-group-header--active' : ''}`}
                    onClick={() => {
                      if (!expanded && onToggleCollapse) {
                        setExpandedGroups((prev) => new Set(prev).add(item.id));
                        onToggleCollapse();
                      } else {
                        toggleGroup(item.id);
                      }
                    }}
                    aria-expanded={isGroupExpanded}
                    aria-controls={`sidebar-sub-${item.id}`}
                    title={!expanded ? item.label : undefined}
                    aria-label={!expanded ? item.label : undefined}
                  >
                    <span className="sidebar-item-icon">{Icon}</span>
                    <span className="sidebar-item-label">{item.label}</span>
                    <span className={`sidebar-group-chevron ${isGroupExpanded ? 'sidebar-group-chevron--open' : ''}`} aria-hidden>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                    </span>
                  </button>
                  <div
                    id={`sidebar-sub-${item.id}`}
                    className={`sidebar-subitems ${isGroupExpanded ? 'sidebar-subitems--open' : ''}`}
                    role="region"
                    aria-label={item.label}
                  >
                    <div className="sidebar-subitems-inner">
                    {item.children.map((child) => {
                      const childActive = isActive(child, location.pathname);
                      const ChildIcon = icons[child.icon] ?? icons.dashboard;
                      const isDnaLab = child.path === '/dna-lab';
                      const onDnaLabClick = dnaLabEntry?.requestDnaLabEntry;
                      if (isDnaLab && onDnaLabClick) {
                        return (
                          <button
                            key={child.id}
                            type="button"
                            className={`sidebar-subitem ${childActive ? 'sidebar-subitem--active' : ''}`}
                            data-icon={child.icon}
                            onClick={onDnaLabClick}
                            onMouseEnter={() => dnaPreload?.preload?.()}
                            aria-current={childActive ? 'page' : undefined}
                            title={!expanded ? child.label : undefined}
                            aria-label={!expanded ? child.label : undefined}
                          >
                            <span className="sidebar-item-icon">{ChildIcon}</span>
                            <span className="sidebar-item-label">{child.label}</span>
                          </button>
                        );
                      }
                      return (
                        <Link
                          key={child.id}
                          to={child.path}
                          className={`sidebar-subitem ${childActive ? 'sidebar-subitem--active' : ''}`}
                          data-icon={child.icon}
                          onClick={handleNavClick}
                          aria-current={childActive ? 'page' : undefined}
                          title={!expanded ? child.label : undefined}
                          aria-label={!expanded ? child.label : undefined}
                        >
                          <span className="sidebar-item-icon">{ChildIcon}</span>
                          <span className="sidebar-item-label">{child.label}</span>
                        </Link>
                      );
                    })}
                    </div>
                  </div>
                </div>
              );
            }

            const active = isActive(item, location.pathname);
            const isDnaLabItem = item.path === '/dna-lab';
            const onDnaLabClick = dnaLabEntry?.requestDnaLabEntry;
            if (isDnaLabItem && onDnaLabClick) {
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-item ${active ? 'sidebar-item--active' : ''}`}
                  data-icon={item.icon}
                  onClick={onDnaLabClick}
                  onMouseEnter={() => dnaPreload?.preload?.()}
                  aria-current={active ? 'page' : undefined}
                  title={!expanded ? item.label : undefined}
                  aria-label={!expanded ? item.label : undefined}
                >
                  <span className="sidebar-item-icon">{Icon}</span>
                  <span className="sidebar-item-label">{item.label}</span>
                </button>
              );
            }
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`sidebar-item ${active ? 'sidebar-item--active' : ''}`}
                data-icon={item.icon}
                onClick={handleNavClick}
                title={!expanded ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
                aria-label={!expanded ? item.label : undefined}
              >
                <span className="sidebar-item-icon">{Icon}</span>
                <span className="sidebar-item-label">
                  {item.label}
                  {item.id === 'feed' && unreadFeed && <span className="sidebar-item-badge" aria-label={t('sidebar.hasNew')} />}
                </span>
              </Link>
            );
          })}
        </nav>

        {!isDrawer && onToggleCollapse && (
          <div className="sidebar-bottom">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={onToggleCollapse}
              aria-label={collapsed ? t('sidebar.expandMenu') : t('sidebar.collapseMenu')}
              title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            >
              {expanded ? (
                <span className="sidebar-toggle-icon sidebar-chevron--left" aria-hidden />
              ) : (
                <span className="sidebar-toggle-icon sidebar-chevron--right" aria-hidden />
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

export default Sidebar;
export { SIDEBAR_COLLAPSED_KEY };
