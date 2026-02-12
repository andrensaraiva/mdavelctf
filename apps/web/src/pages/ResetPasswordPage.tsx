import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { Link } from 'react-router-dom';
import { HudPanel } from '../components/HudPanel';
import { NeonButton } from '../components/NeonButton';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    }
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/brand/logo.png"
            alt="MdavelCTF"
            className="w-20 h-20 object-contain mx-auto mb-4 drop-shadow-[0_0_12px_var(--accent)]"
          />
          <h1 className="text-2xl font-bold text-accent glow-text tracking-widest">
            MdavelCTF
          </h1>
        </div>

        <HudPanel title="Reset Password">
          {sent ? (
            <div className="text-center py-4">
              <p className="text-success mb-4">Reset link sent to {email}</p>
              <Link to="/login" className="text-accent hover:underline text-sm">
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-widest mb-1 text-accent/70">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="terminal-input w-full px-3 py-2 text-sm"
                  required
                />
              </div>
              {error && <p className="text-danger text-xs">{error}</p>}
              <NeonButton type="submit" variant="solid" className="w-full">
                Send Reset Link
              </NeonButton>
              <p className="text-center text-xs">
                <Link to="/login" className="text-accent hover:underline">
                  Back to Login
                </Link>
              </p>
            </form>
          )}
        </HudPanel>
      </div>
    </div>
  );
}
