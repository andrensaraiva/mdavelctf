import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { HudPanel } from '../components/HudPanel';
import { NeonButton } from '../components/NeonButton';
import { useTranslation } from 'react-i18next';

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/brand/logo.png"
            alt="MdavelCTF"
            className="w-64 h-64 object-contain mx-auto mb-4 drop-shadow-[0_0_20px_var(--accent)]"
          />
          <h1 className="text-2xl font-bold text-accent glow-text tracking-widest">
            MdavelCTF
          </h1>
          <p className="text-xs text-hud-text/50 mt-2 uppercase tracking-widest">
            {t('app.subtitle')}
          </p>
        </div>

        <HudPanel title={t('login.title')}>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">
                {t('login.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="terminal-input w-full px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">
                {t('login.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="terminal-input w-full px-3 py-2 text-sm"
                required
              />
            </div>
            {error && <p className="text-danger text-xs">{error}</p>}
            <NeonButton type="submit" variant="solid" className="w-full" disabled={loading}>
              {loading ? t('login.loading') : t('login.submit')}
            </NeonButton>
          </form>
          {/* Dev quick login */}
          {import.meta.env.DEV && (
            <div className="mt-4 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-hud-text/30 text-center mb-2">{t('login.devQuickLogin')}</p>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { label: 'Admin', email: 'admin@mdavelctf.local', pw: 'Admin#12345' },
                  { label: 'Instructor', email: 'instructor@mdavelctf.local', pw: 'Instructor#12345' },
                  { label: 'Alice', email: 'alice@mdavelctf.local', pw: 'Alice#12345' },
                  { label: 'Bob', email: 'bob@mdavelctf.local', pw: 'Bob#12345' },
                  { label: 'Carol', email: 'carol@mdavelctf.local', pw: 'Carol#12345' },
                ].map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => { setEmail(u.email); setPassword(u.pw); }}
                    className="px-2 py-1 text-[10px] border border-accent/20 text-accent/50 hover:text-accent hover:border-accent/40 transition-colors"
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 text-center text-xs space-y-1">
            <p>
              <Link to="/register" className="text-accent hover:underline">
                {t('login.createAccount')}
              </Link>
            </p>
            <p>
              <Link to="/reset-password" className="text-accent/50 hover:text-accent">
                {t('login.resetPassword')}
              </Link>
            </p>
          </div>
        </HudPanel>
      </div>
    </div>
  );
}
