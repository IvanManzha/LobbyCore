import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDnaLabEntry } from '@/contexts/DnaLabEntryContext';
import './BottomNav.css';

function BottomNav({ items = [] }) {
  const location = useLocation();
  const dnaLabEntry = useDnaLabEntry();

  const isActive = (item) => {
    const pathname = location.pathname;
    if (pathname === item.path) return true;
    if (item.path === '/' && (pathname === '/' || pathname === '/dashboard')) return true;
    if (item.matchPaths?.length) return item.matchPaths.some((p) => pathname.startsWith(p));
    if (item.path === '/dna-lab' && pathname.startsWith('/dna-lab')) return true;
    return false;
  };

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const useDnaEntry = item.useDnaEntry && dnaLabEntry?.requestDnaLabEntry;
        if (useDnaEntry) {
          return (
            <button
              key={item.id}
              type="button"
              className={`bottom-nav-item ${isActive(item) ? 'active' : ''}`}
              onClick={dnaLabEntry.requestDnaLabEntry}
            >
              <span className="bottom-nav-label">{item.label}</span>
            </button>
          );
        }
        return (
          <Link
            key={item.id}
            to={item.path}
            className={`bottom-nav-item ${isActive(item) ? 'active' : ''}`}
          >
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default BottomNav;
