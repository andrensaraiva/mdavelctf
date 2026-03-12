import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { NeonButton } from './NeonButton';
import { useTranslation } from 'react-i18next';

interface NavItem {
  to: string;
  label: string;
  icon?: string;
  group: 'primary' | 'secondary';
}

export function Navbar() {
  const { user, userDoc, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t, i18n } = useTranslation();

  const toggleLang = () => {
    const next = i18n.language === 'pt-BR' ? 'en' : 'pt-BR';
    i18n.changeLanguage(next);
    localStorage.setItem('mdavelctf-lang', next);
  };

  const role = userDoc?.role || 'participant';
  const isInstructor = role === 'instructor' || role === 'admin' || role === 'superadmin';
  const isAdmin = role === 'admin' || role === 'superadmin';

  const navItems = useMemo((): NavItem[] => {
    if (isAdmin) {
      return [
        { to: '/admin', label: t('nav.admin'), icon: '⚡', group: 'primary' },
        { to: '/home', label: t('nav.home'), group: 'primary' },
        { to: '/classes', label: t('nav.classes'), group: 'primary' },
        { to: '/scoreboard', label: t('nav.scores'), group: 'primary' },
        { to: '/instructor', label: t('nav.instructor'), icon: '🎓', group: 'secondary' },
        ...(userDoc?.teamId ? [{ to: `/team/${userDoc.teamId}`, label: t('nav.team'), group: 'secondary' as const }] : []),
        { to: '/profile', label: t('nav.profile'), group: 'secondary' },
        { to: '/guide', label: t('nav.guide'), group: 'secondary' },
      ];
    }
    if (isInstructor) {
      return [
        { to: '/instructor', label: t('nav.instructor'), icon: '🎓', group: 'primary' },
        { to: '/classes', label: t('nav.classes'), group: 'primary' },
        { to: '/home', label: t('nav.home'), group: 'primary' },
        { to: '/scoreboard', label: t('nav.scores'), group: 'primary' },
        ...(userDoc?.teamId ? [{ to: `/team/${userDoc.teamId}`, label: t('nav.team'), group: 'secondary' as const }] : []),
        { to: '/profile', label: t('nav.profile'), group: 'secondary' },
        { to: '/guide', label: t('nav.guide'), group: 'secondary' },
      ];
    }
    // Student
    return [
      { to: '/home', label: t('nav.home'), group: 'primary' },
      { to: '/scoreboard', label: t('nav.scores'), group: 'primary' },
      ...(userDoc?.teamId ? [{ to: `/team/${userDoc.teamId}`, label: t('nav.team'), group: 'primary' as const }] : []),
      { to: '/profile', label: t('nav.profile'), group: 'primary' },
      ...(userDoc?.classIds && userDoc.classIds.length > 0
        ? [{ to: '/classes', label: t('nav.classes'), group: 'secondary' as const }]
        : []),
      { to: '/guide', label: t('nav.guide'), group: 'secondary' },
    ];
  }, [role, userDoc?.teamId, userDoc?.classIds, t]);

  const primaryItems = navItems.filter((n) => n.group === 'primary');
  const secondaryItems = navItems.filter((n) => n.group === 'secondary');

  const navLink = (item: NavItem, onClick?: () => void) => {
    const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onClick}
        className={`px-3 py-2 text-xs uppercase tracking-widest font-medium transition-colors block md:inline-block ${
          active
            ? 'text-accent border-b-2 border-accent'
            : 'text-hud-text/50 hover:text-accent'
        }`}
      >
        {item.icon && <span className="mr-1">{item.icon}</span>}
        {item.label}
      </Link>
    );
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="border-b border-accent/12 bg-panel/90 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link to="/home" className="flex items-center gap-2 group">
          <img
            src="/brand/logo.png"
            alt="MdavelCTF"
            className="w-8 h-8 object-contain drop-shadow-[0_0_4px_var(--accent)] group-hover:drop-shadow-[0_0_8px_var(--accent)] transition-all duration-300"
          />
          <span className="text-accent font-bold tracking-widest text-sm hidden sm:inline">
            MdavelCTF
          </span>
        </Link>

        {user && (
          <>
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {primaryItems.map((item) => navLink(item))}
              {secondaryItems.length > 0 && (
                <span className="w-px h-4 bg-accent/15 mx-1" />
              )}
              {secondaryItems.map((item) => navLink(item))}
              {/* Role badge */}
              {userDoc?.role && userDoc.role !== 'participant' && (
                <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold border ml-1 ${
                  isAdmin ? 'text-warning/80 border-warning/30' : 'text-accent2/80 border-accent2/30'
                }`}>
                  {userDoc.role}
                </span>
              )}
              {/* Language switcher */}
              <button
                onClick={toggleLang}
                className="px-2 py-1 text-[10px] uppercase tracking-widest border border-accent/15 text-hud-text/40 hover:text-accent hover:border-accent/30 transition-colors ml-1"
                title="Switch language"
              >
                {i18n.language === 'pt-BR' ? 'EN' : 'PT'}
              </button>
              <NeonButton
                size="sm"
                onClick={() => { logout(); navigate('/login'); }}
              >
                {t('nav.logout')}
              </NeonButton>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden flex flex-col gap-1.5 p-2 text-accent"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <span className={`block w-5 h-0.5 bg-accent transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-accent transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-accent transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </>
        )}
      </div>

      {/* Mobile dropdown */}
      {user && menuOpen && (
        <div className="md:hidden border-t border-accent/10 bg-panel/95 backdrop-blur-sm px-4 py-3 space-y-1">
          {primaryItems.map((item) => navLink(item, closeMenu))}
          {secondaryItems.length > 0 && (
            <div className="border-t border-accent/8 my-2 pt-2">
              <span className="text-[10px] uppercase tracking-widest text-hud-text/25 px-3 font-semibold">
                {t('nav.more') || 'More'}
              </span>
            </div>
          )}
          {secondaryItems.map((item) => navLink(item, closeMenu))}
          <div className="flex items-center gap-2 py-2 px-3">
            <button
              onClick={() => { toggleLang(); }}
              className="px-2 py-1 text-[10px] uppercase tracking-widest border border-accent/15 text-hud-text/40 hover:text-accent transition-colors"
            >
              {i18n.language === 'pt-BR' ? 'EN' : 'PT'}
            </button>
            {userDoc?.role && userDoc.role !== 'participant' && (
              <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold border ${
                isAdmin ? 'text-warning/80 border-warning/30' : 'text-accent2/80 border-accent2/30'
              }`}>
                {userDoc.role}
              </span>
            )}
          </div>
          <div className="pt-2 border-t border-accent/8">
            <NeonButton
              size="sm"
              onClick={() => { closeMenu(); logout(); navigate('/login'); }}
              className="w-full"
            >
              {t('nav.logout')}
            </NeonButton>
          </div>
        </div>
      )}
    </nav>
  );
}
