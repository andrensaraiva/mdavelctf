import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import './i18n';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import HomePage from './pages/HomePage';
import EventPage from './pages/EventPage';
import ChallengePage from './pages/ChallengePage';
import LeaguePage from './pages/LeaguePage';
import ScoreboardPage from './pages/ScoreboardPage';
import TeamPage from './pages/TeamPage';
import ProfilePage from './pages/ProfilePage';
import ThemeSettingsPage from './pages/ThemeSettingsPage';
import AdminPage from './pages/AdminPage';
import ClassesPage from './pages/ClassesPage';
import ClassDetailPage from './pages/ClassDetailPage';
import InstructorDashboard from './pages/InstructorDashboard';
import StudentGuidePage from './pages/StudentGuidePage';

function TeamRedirect() {
  const { userDoc } = useAuth();
  if (userDoc?.teamId) return <Navigate to={`/team/${userDoc.teamId}`} replace />;
  return <Navigate to="/profile" replace />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-accent glow-text animate-pulse">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="text-accent glow-text text-xl animate-pulse tracking-widest">
          MdavelCTF
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg">
      {user && <Navbar />}
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected */}
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/event/:eventId" element={<ProtectedRoute><EventPage /></ProtectedRoute>} />
        <Route path="/event/:eventId/challenge/:challengeId" element={<ProtectedRoute><ChallengePage /></ProtectedRoute>} />
        <Route path="/league/:leagueId" element={<ProtectedRoute><LeaguePage /></ProtectedRoute>} />
        <Route path="/scoreboard" element={<ProtectedRoute><ScoreboardPage /></ProtectedRoute>} />
        <Route path="/team" element={<ProtectedRoute><TeamRedirect /></ProtectedRoute>} />
        <Route path="/team/:teamId" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/settings/theme" element={<ProtectedRoute><ThemeSettingsPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="/classes" element={<ProtectedRoute><ClassesPage /></ProtectedRoute>} />
        <Route path="/classes/:classId" element={<ProtectedRoute><ClassDetailPage /></ProtectedRoute>} />
        <Route path="/instructor" element={<ProtectedRoute><InstructorDashboard /></ProtectedRoute>} />
        <Route path="/guide" element={<ProtectedRoute><StudentGuidePage /></ProtectedRoute>} />

        {/* Default */}
        <Route path="*" element={<Navigate to={user ? '/home' : '/login'} />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
