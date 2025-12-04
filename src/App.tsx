import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Toaster } from "sonner";

// Eager load HomePage (always needed)
import { HomePage } from './pages/HomePage';

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

// Loading component
function PageLoader() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-purple-200">Loading...</p>
      </div>
    </div>
  );
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
      <Toaster richColors />
      <Routes>
        {/* Homepage */}
        <Route path="/" element={<HomePage />} />
        
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

        {/* DevPortal - Lazy Loaded */}
        <Route 
          path="/dev-portal" 
          element={
            <Suspense fallback={<PageLoader />}>
              <DevPortal key="dev-portal" />
            </Suspense>
          } 
        />
      </Routes>
    </Router>
  );
}