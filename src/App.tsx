import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Toaster } from "sonner@2.0.3";
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageLoader } from './components/LoadingStates';

// Eager load HomePage (always needed)
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { InitSetup } from './pages/InitSetup';
import { FeaturesPage } from './pages/FeaturesPage';
import { PricingPage } from './pages/PricingPage';
import { BlogPage } from './pages/BlogPage';
import { BlogPostPage } from './pages/BlogPostPage';

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

// Page loading fallback component for lazy-loaded routes
function LazyPageLoader() {
  return <PageLoader message="Loading page..." variant="dark" />;
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
    <ErrorBoundary>
      <Router>
      <AuthProvider>
        <ThemeProvider>
          <Toaster richColors />
          <Routes>
            {/* Homepage */}
            <Route path="/" element={<HomePage />} />
            
            {/* Auth Pages */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            
            {/* One-time setup to initialize default account */}
            <Route path="/init-setup" element={<InitSetup />} />
          
          {/* Invoice Demo Page - Lazy Loaded */}
          <Route 
            path="/invoice-demo" 
            element={
              <Suspense fallback={<LazyPageLoader />}>
                <InvoiceServicePage key="invoice-demo" />
              </Suspense>
            } 
          />

          {/* PE Demo Page (10-K Analyzer) - Lazy Loaded */}
          <Route 
            path="/pe-demo" 
            element={
              <Suspense fallback={<LazyPageLoader />}>
                <PEDemo key="pe-demo" />
              </Suspense>
            } 
          />

          {/* Bank Reconciliation Demo - Lazy Loaded */}
          <Route 
            path="/bank-demo" 
            element={
              <Suspense fallback={<LazyPageLoader />}>
                <BankRecDemo key="bank-demo" />
              </Suspense>
            } 
          />

          {/* AP Reconciliation Demo - Lazy Loaded */}
          <Route 
            path="/ap-demo" 
            element={
              <Suspense fallback={<LazyPageLoader />}>
                <APRecDemo key="ap-demo" />
              </Suspense>
            } 
          />

          {/* Expense Demo - Lazy Loaded */}
          <Route 
            path="/expense-demo" 
            element={
              <Suspense fallback={<LazyPageLoader />}>
                <ExpenseDemo key="expense-demo" />
              </Suspense>
            } 
          />

          {/* DevPortal (Dashboard) - Protected */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Suspense fallback={<LazyPageLoader />}>
                  <DevPortal key="dashboard" />
                </Suspense>
              </ProtectedRoute>
            } 
          />
          
          {/* Legacy /dev-portal route - redirect to /dashboard */}
          <Route 
            path="/dev-portal" 
            element={
              <ProtectedRoute>
                <Suspense fallback={<LazyPageLoader />}>
                  <DevPortal key="dev-portal" />
                </Suspense>
              </ProtectedRoute>
            } 
          />
          
          {/* Features Page */}
          <Route path="/features" element={<FeaturesPage />} />
          
          {/* Pricing Page */}
          <Route path="/pricing" element={<PricingPage />} />
          
          {/* Blog Page */}
          <Route path="/blog" element={<BlogPage />} />
          
          {/* Blog Post Page */}
          <Route path="/blog/:slug" element={<BlogPostPage />} />
        </Routes>
        </ThemeProvider>
      </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}