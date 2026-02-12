import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { HudPanel } from '../components/HudPanel';
import { NeonButton } from '../components/NeonButton';
import { DEFAULT_THEME, UserDoc } from '@mdavelctf/shared';
import { useTranslation } from 'react-i18next';

export default function RegisterPage() {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });

      const userDoc: UserDoc = {
        displayName,
        role: 'participant',
        disabled: false,
        teamId: null,
        theme: DEFAULT_THEME,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', cred.user.uid), userDoc);

      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
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
            {t('register.subtitle')}
          </p>
        </div>

        <HudPanel title={t('register.title')}>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">
                {t('register.displayName')}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="terminal-input w-full px-3 py-2 text-sm"
                required
                minLength={2}
                maxLength={30}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">
                {t('register.email')}
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
                {t('register.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="terminal-input w-full px-3 py-2 text-sm"
                required
                minLength={6}
              />
            </div>
            {error && <p className="text-danger text-xs">{error}</p>}
            <NeonButton type="submit" variant="solid" className="w-full" disabled={loading}>
              {loading ? t('register.loading') : t('register.submit')}
            </NeonButton>
          </form>
          <p className="mt-4 text-center text-xs">
            {t('register.alreadyHaveAccount')}{' '}
            <Link to="/login" className="text-accent hover:underline">
              {t('register.login')}
            </Link>
          </p>
        </HudPanel>
      </div>
    </div>
  );
}
