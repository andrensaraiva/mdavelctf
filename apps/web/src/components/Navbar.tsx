import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { NeonButton } from './NeonButton';
import { useTranslation } from 'react-i18next';

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

  const navLink = (to: string, label: string, onClick?: () => void) => {
    const active = location.pathname === to || location.pathname.startsWith(to + '/');
    return (
      <Link
        to={to}
        onClick={onClick}
        className={`px-3 py-2 text-xs uppercase tracking-widest font-medium transition-colors block md:inline-block ${
          active
            ? 'text-accent glow-text border-b-2 border-accent'
            : 'text-hud-text/60 hover:text-accent'
        }`}
      >
        {label}
      </Link>
    );
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="border-b border-accent/20 bg-panel/90 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link to="/home" className="flex items-center gap-2 group">
          <img
            src="/brand/logo.png"
            alt="MdavelCTF"
            className="w-8 h-8 object-contain drop-shadow-[0_0_6px_var(--accent)] group-hover:drop-shadow-[0_0_12px_var(--accent)] transition-all duration-300"
          />
          <span className="text-accent font-bold tracking-widest text-sm glow-text hidden sm:inline">
            MdavelCTF
          </span>
        </Link>

        {user && (
          <>
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {navLink('/home', t('nav.home'))}
              {navLink('/scoreboard', t('nav.scores'))}
              {navLink('/classes', t('nav.classes'))}
              {userDoc?.teamId && navLink(`/team/${userDoc.teamId}`, t('nav.team'))}
              {navLink('/profile', t('nav.profile'))}
              {navLink('/guide', '📖 Guia')}
              {(userDoc?.role === 'instructor' || userDoc?.role === 'admin') && navLink('/instructor', t('nav.instructor'))}
              {userDoc?.role === 'admin' && navLink('/admin', t('nav.admin'))}
              {/* Role badge */}
              {userDoc?.role && userDoc.role !== 'participant' && (
                <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold border ml-1 ${
                  userDoc.role === 'admin' ? 'text-warning border-warning/40' : 'text-accent2 border-accent2/40'
                }`}>
                  {userDoc.role}
                </span>
              )}
              {/* Language switcher */}
              <button
                onClick={toggleLang}
                className="px-2 py-1 text-[10px] uppercase tracking-widest border border-accent/20 text-hud-text/50 hover:text-accent hover:border-accent/40 transition-colors ml-1"
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
        <div className="md:hidden border-t border-accent/15 bg-panel/95 backdrop-blur-sm px-4 py-3 space-y-1">
          {navLink('/home', t('nav.home'), closeMenu)}
          {navLink('/scoreboard', t('nav.scores'), closeMenu)}
          {navLink('/classes', t('nav.classes'), closeMenu)}
          {userDoc?.teamId && navLink(`/team/${userDoc.teamId}`, t('nav.team'), closeMenu)}
          {navLink('/profile', t('nav.profile'), closeMenu)}
          {navLink('/guide', '📖 Guia', closeMenu)}
          {(userDoc?.role === 'instructor' || userDoc?.role === 'admin') && navLink('/instructor', t('nav.instructor'), closeMenu)}
          {userDoc?.role === 'admin' && navLink('/admin', t('nav.admin'), closeMenu)}
          <div className="flex items-center gap-2 py-2">
            <button
              onClick={() => { toggleLang(); }}
              className="px-2 py-1 text-[10px] uppercase tracking-widest border border-accent/20 text-hud-text/50 hover:text-accent transition-colors"
            >
              {i18n.language === 'pt-BR' ? 'EN' : 'PT'}
            </button>
            {userDoc?.role && userDoc.role !== 'participant' && (
              <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold border ${
                userDoc.role === 'admin' ? 'text-warning border-warning/40' : 'text-accent2 border-accent2/40'
              }`}>
                {userDoc.role}
              </span>
            )}
          </div>
          <div className="pt-2 border-t border-accent/10">
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
