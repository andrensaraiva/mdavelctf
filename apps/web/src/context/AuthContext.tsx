import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserDoc, DEFAULT_THEME } from '@mdavelctf/shared';

interface AuthState {
  user: User | null;
  userDoc: UserDoc | null;
  loading: boolean;
  token: string | null;
  logout: () => Promise<void>;
  refreshUserDoc: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  userDoc: null,
  loading: true,
  token: null,
  logout: async () => {},
  refreshUserDoc: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserDoc = async (uid: string) => {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      setUserDoc(snap.data() as UserDoc);
    }
    return snap.exists() ? (snap.data() as UserDoc) : null;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        setToken(idToken);
        const uDoc = await fetchUserDoc(fbUser.uid);
        if (!uDoc) {
          // Create user doc on first login
          const newDoc: UserDoc = {
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            role: 'participant',
            disabled: false,
            teamId: null,
            theme: DEFAULT_THEME,
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', fbUser.uid), newDoc);
          setUserDoc(newDoc);
        }
      } else {
        setToken(null);
        setUserDoc(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const refreshUserDoc = async () => {
    if (user) await fetchUserDoc(user.uid);
  };

  return (
    <AuthContext.Provider value={{ user, userDoc, loading, token, logout, refreshUserDoc }}>
      {children}
    </AuthContext.Provider>
  );
}
