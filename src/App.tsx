import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Toaster } from "sonner@2.0.3";
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { QueryProvider } from './contexts/QueryProvider';
import { ProtectedRoute } from './components/ProtectedRoute';

// Eager load only critical auth pages
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';

// Eager load blog pages for SEO (Google needs to see content immediately)
import { BlogPage } from './pages/BlogPage';
import { BlogPostPage } from './pages/BlogPostPage';

// Lazy load marketing pages (not critical for initial load)
const FeaturesPage = lazy(() => import('./pages/FeaturesPage').then(module => ({ default: module.FeaturesPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then(module => ({ default: module.PricingPage })));
const NewLandingPage = lazy(() => import('./pages/NewLandingPage').then(module => ({ default: module.NewLandingPage })));
const DevPortalLanding = lazy(() => import('./pages/DevPortalLanding').then(module => ({ default: module.DevPortalLanding })));

// Lazy load auth flow pages (only needed after certain actions)
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage').then(module => ({ default: module.VerifyEmailPage })));
const AcceptInvitationPage = lazy(() => import('./pages/AcceptInvitationPage').then(module => ({ default: module.AcceptInvitationPage })));
const InitSetup = lazy(() => import('./pages/InitSetup').then(module => ({ default: module.InitSetup })));
const QBOCallback = lazy(() => import('./pages/QBOCallback').then(module => ({ default: module.default })));

// Lazy load InvoiceServicePage (only when needed)
const InvoiceServicePage = lazy(() => import('./pages/InvoiceServicePage').then(module => ({ default: module.InvoiceServicePage })));

// Lazy load PEDemo (only when needed)
const PEDemo = lazy(() => import('./pages/PEDemo').then(module => ({ default: module.PEDemo })));

// Lazy load BankRecDemo (only when needed)
const BankRecDemo = lazy(() => import('./pages/BankRecDemo').then(module => ({ default: module.BankRecDemo })));

// Lazy load APRecDemo (only when needed)
const APRecDemo = lazy(() => import('./pages/APRecDemo').then(module => ({ default: module.APRecDemo })));

// Lazy load ExpenseDemo (only when needed)
const ExpenseDemo = lazy(() => import('./pages/ExpenseDemo').then(module => ({ default: module.ExpenseDemo })));

// Lazy load DevPortal (only when needed)
const DevPortal = lazy(() => import('./pages/DevPortal').then(module => ({ default: module.DevPortal })));

// Lazy load CompanyDetail (only when needed)
const CompanyDetail = lazy(() => import('./pages/CompanyDetail').then(module => ({ default: module.CompanyDetail })));

// Lazy load GoogleAITester (only when needed)
const GoogleAITester = lazy(() => import('./components/devportal/GoogleAITester').then(module => ({ default: module.GoogleAITester })));

// Auth Callback Handler - redirects Supabase auth callbacks to verify-email page
function AuthCallback() {
  useEffect(() => {
    // Log the full URL for debugging
    console.log('🔐 AuthCallback received URL:', window.location.href);
    console.log('   Hash:', window.location.hash);
    console.log('   Search:', window.location.search);

    // Check hash params (Supabase typically uses hash for auth)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');

    // Also check query params as fallback
    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get('code');
    const errorCode = queryParams.get('error');
    const errorDescription = queryParams.get('error_description');

    console.log('   Parsed - accessToken:', accessToken ? 'present' : 'missing');
    console.log('   Parsed - type:', type);
    console.log('   Parsed - code:', code ? 'present' : 'missing');
    console.log('   Parsed - error:', errorCode);

    // If there's an error from Supabase, show it
    if (errorCode) {
      console.error('❌ Auth error from Supabase:', errorCode, errorDescription);
      window.location.href = `/login?error=${encodeURIComponent(errorDescription || errorCode)}`;
      return;
    }

    // If we have an access token in the hash, this is a successful auth callback
    if (accessToken) {
      console.log('✅ Access token found, redirecting to verify-email');
      // Redirect to verify-email page with the hash params intact
      window.location.href = `/verify-email${window.location.hash}`;
      return;
    }

    // If we have a code (PKCE flow), redirect to verify-email to handle it
    if (code) {
      console.log('✅ Auth code found (PKCE flow), redirecting to verify-email');
      window.location.href = `/verify-email${window.location.search}`;
      return;
    }

    // If type is present but no token (might be an intermediate state)
    if (type === 'signup' || type === 'magiclink' || type === 'recovery' || type === 'invite') {
      console.log('✅ Auth type found, redirecting to verify-email');
      window.location.href = `/verify-email${window.location.hash}`;
      return;
    }

    // No recognizable auth params - redirect to login
    console.log('⚠️ No auth params found, redirecting to login');
    window.location.href = '/login';
  }, []);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#65D3FD] rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Verifying your email...</p>
        <p className="text-sm text-gray-400 mt-2">Please wait while we complete the verification</p>
      </div>
    </div>
  );
}

// Loading component
function PageLoader() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#65D3FD] rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

// Legacy route redirect component
function LegacyCompanyRedirect() {
  const location = useLocation();
  const newPath = location.pathname.replace('/companies/', '/company/');
  return <Navigate to={newPath} replace />;
}

export default function App() {
  useEffect(() => {
    // Set the page title
    document.title = "Novalare";

    // Create and set favicon
    const favicon = document.querySelector("link[rel*='icon']") || document.createElement('link');
    favicon.type = 'image/svg+xml';
    favicon.rel = 'icon';

    // SVG favicon with gradient gear matching the logo
    const svg = `
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gear-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#A370FF;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#E879F9;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FB7185;stop-opacity:1" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="5" fill="url(#gear-gradient)" />
        <circle cx="16" cy="7" r="2.5" fill="url(#gear-gradient)" />
        <circle cx="23.5" cy="11.5" r="2.5" fill="url(#gear-gradient)" />
        <circle cx="23.5" cy="20.5" r="2.5" fill="url(#gear-gradient)" />
        <circle cx="16" cy="25" r="2.5" fill="url(#gear-gradient)" />
        <circle cx="8.5" cy="20.5" r="2.5" fill="url(#gear-gradient)" />
        <circle cx="8.5" cy="11.5" r="2.5" fill="url(#gear-gradient)" />
      </svg>
    `;

    favicon.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    document.head.appendChild(favicon);
  }, []);

  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <QueryProvider>
            <Toaster richColors />
            <Routes>
              {/* Homepage - NEW LANDING PAGE - Lazy Loaded */}
              <Route
                path="/"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <NewLandingPage />
                  </Suspense>
                }
              />

              {/* Old Landing Page */}
              <Route path="/old-landing" element={<HomePage />} />

              {/* Auth Pages */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route
                path="/verify-email"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <VerifyEmailPage />
                  </Suspense>
                }
              />
              <Route
                path="/accept-invitation"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <AcceptInvitationPage />
                  </Suspense>
                }
              />

              {/* QuickBooks OAuth Callback */}
              <Route
                path="/qbo-callback"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <QBOCallback />
                  </Suspense>
                }
              />

              {/* One-time setup to initialize default account */}
              <Route
                path="/init-setup"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <InitSetup />
                  </Suspense>
                }
              />

              {/* Invoice Demo Page - Lazy Loaded */}
              <Route
                path="/invoice-demo"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <InvoiceServicePage key="invoice-demo" />
                  </Suspense>
                }
              />

              {/* PE Demo Page (10-K Analyzer) - Lazy Loaded */}
              <Route
                path="/pe-demo"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <PEDemo key="pe-demo" />
                  </Suspense>
                }
              />

              {/* Bank Reconciliation Demo - Lazy Loaded */}
              <Route
                path="/bank-demo"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <BankRecDemo key="bank-demo" />
                  </Suspense>
                }
              />

              {/* AP Reconciliation Demo - Lazy Loaded */}
              <Route
                path="/ap-demo"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <APRecDemo key="ap-demo" />
                  </Suspense>
                }
              />

              {/* Expense Demo - Lazy Loaded */}
              <Route
                path="/expense-demo"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <ExpenseDemo key="expense-demo" />
                  </Suspense>
                }
              />

              {/* DevPortal (Dashboard) - Protected */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <DevPortal key="dashboard" />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Company Detail Pages - Protected */}
              <Route
                path="/company/:companyId/*"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <CompanyDetail />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Legacy /companies routes - redirect to /company */}
              <Route
                path="/companies/:companyId/*"
                element={<LegacyCompanyRedirect />}
              />

              {/* Legacy /dev-portal route - redirect to /dashboard */}
              <Route
                path="/dev-portal"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <DevPortal key="dev-portal" />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Features Page - Lazy Loaded */}
              <Route
                path="/features"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <FeaturesPage />
                  </Suspense>
                }
              />

              {/* Pricing Page - Lazy Loaded */}
              <Route
                path="/pricing"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <PricingPage />
                  </Suspense>
                }
              />

              {/* Blog Pages - Eager Loaded for SEO (Google crawlers need immediate HTML content) */}
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/blog/:slug" element={<BlogPostPage />} />

              {/* Google AI Tester - Public for testing */}
              <Route
                path="/google-ai-test"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <GoogleAITester />
                  </Suspense>
                }
              />

              {/* DevPortal Landing Page - Lazy Loaded */}
              <Route
                path="/dev-portal-landing"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <DevPortalLanding />
                  </Suspense>
                }
              />

              {/* Auth Callback Handler */}
              <Route path="/auth-callback" element={<AuthCallback />} />
            </Routes>
          </QueryProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}