import { CSSProperties } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { globalStyles } from './styles/global'
import { Colors } from './lib/colors'
import { Sidebar } from './components/Sidebar'
import { PoliceSidebar } from './components/police/PoliceSidebar'
import { ThemeToggle } from './components/ThemeToggle'
import { LoginPage } from './pages/LoginPage'
import { LandingPage } from './pages/LandingPage'
import { HomePage } from './pages/HomePage'
import { DevicesPage } from './pages/DevicesPage'
import { AddDevicePage } from './pages/AddDevicePage'
import { AlertsPage } from './pages/AlertsPage'
import { ProfilePage } from './pages/ProfilePage'
import { ChatListPage } from './pages/ChatListPage'
import { ChatRoomPage } from './pages/ChatRoomPage'
import { AboutPage } from './pages/AboutPage'
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage'
import { ReportBugPage } from './pages/ReportBugPage'
import { DeviceHistoryPage } from './pages/DeviceHistoryPage'
import { OwnershipTransferPage } from './pages/OwnershipTransferPage'
import { AntiTheftPage } from './pages/AntiTheftPage'
import { PoliceDashboardPage } from './pages/police/PoliceDashboardPage'
import { PoliceChatsPage } from './pages/police/PoliceChatsPage'
import { PoliceDevicesPage } from './pages/police/PoliceDevicesPage'
import { PoliceReportsPage } from './pages/police/PoliceReportsPage'
import { PoliceSearchPage } from './pages/police/PoliceSearchPage'
import { PoliceAnalyticsPage } from './pages/police/PoliceAnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { LiveMapPage } from './pages/LiveMapPage'

function Spinner() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', backgroundColor: Colors.background,
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '24px',
      }}>
        {/* Shield Icon */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '24px',
          background: `linear-gradient(135deg, ${Colors.primary}22, ${Colors.primary}11)`,
          border: `2px solid ${Colors.primary}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 40px ${Colors.primary}20`,
          animation: 'pulse 1.8s ease-in-out infinite',
          margin: '0 auto',
        }}>
          <span className="material-icons" style={{ fontSize: '40px', color: Colors.primary }}>shield</span>
        </div>

        {/* LOQIT Logo */}
        <img
          src="/logo.png"
          alt="LOQIT"
          style={{
            height: '28px', width: 'auto', objectFit: 'contain',
            filter: 'var(--logo-filter)',
            margin: '0 auto',
          }}
        />

        {/* Authenticating Text */}
        <div style={{
          color: Colors.primary, fontSize: '12px', fontWeight: 700,
          letterSpacing: '3px', textTransform: 'uppercase', opacity: 0.6,
          textAlign: 'center',
        }}>
          Authenticating
        </div>
      </div>
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PoliceRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (profile && profile.role !== 'police' && profile.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppLayout({ children, isPolice, fullHeight }: { children: React.ReactNode; isPolice?: boolean; fullHeight?: boolean }) {
  const layoutStyle: CSSProperties = { display: 'flex', minHeight: '100vh', height: '100vh', overflow: 'hidden' }
  const mainStyle: CSSProperties = { flex: 1, overflow: fullHeight ? 'hidden' : 'auto', backgroundColor: Colors.background, position: 'relative', display: 'flex', flexDirection: 'column' }
  return (
    <div style={layoutStyle}>
      {isPolice ? <PoliceSidebar /> : <Sidebar />}
      <main style={mainStyle}>
        <ThemeToggle style={{ position: 'fixed', top: 24, right: 32, zIndex: 1000 }} />
        {children}
      </main>
    </div>
  )
}

function AppRoutes() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (location.pathname === '/auth/callback') {
    return <AuthCallbackPage />
  }

  if (location.pathname === '/auth/reset-password') {
    return <ResetPasswordPage />
  }

  if (loading) return <Spinner />

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/" element={user ? <Navigate to={profile?.role === 'police' || profile?.role === 'admin' ? '/police' : '/dashboard'} replace /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to={profile?.role === 'police' || profile?.role === 'admin' ? '/police' : '/dashboard'} replace /> : <LoginPage />} />

      {/* Civilian routes */}
      <Route path="/dashboard" element={<PrivateRoute><AppLayout><HomePage /></AppLayout></PrivateRoute>} />
      <Route path="/devices" element={<PrivateRoute><AppLayout><DevicesPage /></AppLayout></PrivateRoute>} />
      <Route path="/add-device" element={<PrivateRoute><AppLayout><AddDevicePage /></AppLayout></PrivateRoute>} />
      <Route path="/alerts" element={<PrivateRoute><AppLayout><AlertsPage /></AppLayout></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><AppLayout><ProfilePage /></AppLayout></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><AppLayout><SettingsPage /></AppLayout></PrivateRoute>} />
      <Route path="/chat" element={<PrivateRoute><AppLayout><ChatListPage /></AppLayout></PrivateRoute>} />
      <Route path="/chat/:roomId" element={<PrivateRoute><AppLayout><ChatRoomPage /></AppLayout></PrivateRoute>} />
      <Route path="/about" element={<PrivateRoute><AppLayout><AboutPage /></AppLayout></PrivateRoute>} />
      <Route path="/privacy-policy" element={<PrivateRoute><AppLayout><PrivacyPolicyPage /></AppLayout></PrivateRoute>} />
      <Route path="/report-bug" element={<PrivateRoute><AppLayout><ReportBugPage /></AppLayout></PrivateRoute>} />
      <Route path="/devices/:deviceId/history" element={<PrivateRoute><AppLayout><DeviceHistoryPage /></AppLayout></PrivateRoute>} />
      <Route path="/transfer-ownership" element={<PrivateRoute><AppLayout><OwnershipTransferPage /></AppLayout></PrivateRoute>} />
      <Route path="/anti-theft" element={<PrivateRoute><AppLayout><AntiTheftPage /></AppLayout></PrivateRoute>} />
      <Route path="/map" element={<PrivateRoute><AppLayout fullHeight><LiveMapPage /></AppLayout></PrivateRoute>} />

      {/* Police routes */}
      <Route path="/police" element={<PoliceRoute><AppLayout isPolice><PoliceDashboardPage /></AppLayout></PoliceRoute>} />
      <Route path="/police/chats" element={<PoliceRoute><AppLayout isPolice><PoliceChatsPage /></AppLayout></PoliceRoute>} />
      <Route path="/police/devices" element={<PoliceRoute><AppLayout isPolice><PoliceDevicesPage /></AppLayout></PoliceRoute>} />
      <Route path="/police/reports" element={<PoliceRoute><AppLayout isPolice><PoliceReportsPage /></AppLayout></PoliceRoute>} />
      <Route path="/police/search" element={<PoliceRoute><AppLayout isPolice><PoliceSearchPage /></AppLayout></PoliceRoute>} />
      <Route path="/police/analytics" element={<PoliceRoute><AppLayout isPolice><PoliceAnalyticsPage /></AppLayout></PoliceRoute>} />
      <Route path="/police/settings" element={<PoliceRoute><AppLayout isPolice><SettingsPage /></AppLayout></PoliceRoute>} />

      {/* Legacy redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <>
      <style>{globalStyles}</style>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </>
  )
}
