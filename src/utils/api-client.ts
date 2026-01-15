import { projectId, publicAnonKey } from './supabase/info';
import { supabase } from './supabase/client';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113`;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// SESSION CACHE - Performance Optimization
// ============================================
let cachedAccessToken: string | null = null;
let tokenCacheTime: number = 0;
const CACHE_DURATION = 3000; // Cache for 3 seconds (reduced from 5s)

async function getAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid
  if (cachedAccessToken && (now - tokenCacheTime) < CACHE_DURATION) {
    return cachedAccessToken;
  }

  // Fetch fresh token
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.warn('⚠️ Error getting session:', error.message);
      // Fall back to anon key on error
      cachedAccessToken = publicAnonKey;
      tokenCacheTime = now;
      return cachedAccessToken;
    }

    // Use access token if available, otherwise use anon key
    cachedAccessToken = session?.access_token || publicAnonKey;
    tokenCacheTime = now;

    // Log for debugging (only in development)
    if (!session?.access_token) {
      console.log('ℹ️ No active session, using anon key for API requests');
    }

    return cachedAccessToken;
  } catch (error) {
    console.error('❌ Failed to get access token:', error);
    // Fall back to anon key
    return publicAnonKey;
  }
}

// Clear cache when user logs out
export function clearSessionCache() {
  cachedAccessToken = null;
  tokenCacheTime = 0;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Reduced console logging for better performance
  // console.log(`🔌 API Request: ${endpoint}`);
  // console.log(`📍 Full URL: ${url}`);

  // Get cached access token (much faster!)
  const accessToken = await getAccessToken();

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (parseError) {
        // If JSON parsing fails, the server might not be returning JSON
        console.error(`❌ Server returned non-JSON response (${response.status})`);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      console.error(`❌ API Error (${endpoint}):`, errorData);

      // If 401 Unauthorized, try refreshing the session and retry once
      if (response.status === 401 && retryCount === 0) {
        console.log('🔄 Got 401, clearing token cache and retrying...');
        clearSessionCache(); // Clear the cached token
        // Retry the request with a fresh token
        return apiRequest<T>(endpoint, options, retryCount + 1);
      }

      // If still 401 after retry, user is not logged in
      if (response.status === 401) {
        console.warn(`⚠️ Unauthorized request to ${endpoint} - user not logged in`);
        // Return empty data for GET requests to allow app to continue working
        if (!options.method || options.method === 'GET') {
          console.log('ℹ️ Returning empty data for GET request');
          return { success: true, data: [] } as any;
        }
        throw new Error('Unauthorized - please log in');
      }

      throw new Error(errorData.error || errorData.message || `Request failed: ${response.statusText}`);
    }

    const result: ApiResponse<T> = await response.json();

    if (!result.success) {
      console.error(`❌ API Request failed (${endpoint}):`, result.error);
      throw new Error(result.error || 'Request failed');
    }

    return result.data as T;
  } catch (error: any) {
    // Provide more helpful error messages
    if (error.message?.includes('Failed to fetch')) {
      console.warn(`⚠️ Cannot connect to backend server at ${API_BASE_URL}`);
      console.warn('   Possible causes:');
      console.warn('   1. Edge Function not deployed or stopped');
      console.warn('   2. Network connectivity issue');
      console.warn('   3. Supabase project not accessible');
      throw new Error('Cannot connect to server - please check if the backend is running');
    } else if (error.message?.includes('Unauthorized')) {
      // Don't log full stack trace for auth errors
      console.log(`🔒 Auth required for ${endpoint}`);
    } else {
      console.error(`❌ API Request exception (${endpoint}):`, error);
    }
    throw error;
  }
}

// ============================================
// COMPANIES API
// ============================================

export interface Company {
  id: string;
  name: string;
  country: string;
  chartOfAccounts?: string;
  status: 'Active' | 'Inactive' | 'Archived';
  tags?: string[];
  docsThisMonth?: number;
  lastActivity?: string;
  email?: string; // Dedicated email address for this company
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const companiesApi = {
  getAll: async (page?: number, pageSize?: number, search?: string, period?: string) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (pageSize) params.append('pageSize', pageSize.toString());
    if (search) params.append('search', search);
    if (period) {
      params.append('includeRecStatus', 'true');
      params.append('period', period);
    }

    const queryString = params.toString();
    const endpoint = `/api/companies${queryString ? `?${queryString}` : ''}`;

    // Use custom fetch to get full response with pagination
    if (page && pageSize) {
      const url = `${API_BASE_URL}${endpoint}`;
      const accessToken = await getAccessToken();

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch companies: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch companies');
      }

      // Return full response with pagination
      return {
        data: result.data,
        pagination: result.pagination
      } as PaginatedResponse<Company>;
    }

    // For non-paginated requests, use the standard apiRequest
    return apiRequest<Company[]>(endpoint);
  },

  getById: (id: string) => apiRequest<Company>(`/api/companies/${id}`),

  create: (data: Partial<Company>) =>
    apiRequest<Company>('/api/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Company>) =>
    apiRequest<Company>(`/api/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest<void>(`/api/companies/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================
// DOCUMENTS API
// ============================================

export interface Document {
  id: string;
  companyId: string;
  name: string;
  type: string;
  status: 'Pending' | 'Processed' | 'Failed';
  fileUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export const documentsApi = {
  getByCompany: (companyId: string) =>
    apiRequest<Document[]>(`/api/companies/${companyId}/documents`),

  create: (companyId: string, data: Partial<Document>) =>
    apiRequest<Document>(`/api/companies/${companyId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (companyId: string, id: string) =>
    apiRequest<void>(`/api/companies/${companyId}/documents/${id}`, {
      method: 'DELETE',
    }),

  uploadFile: async (companyId: string, file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    // Get the current user's access token
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token || publicAnonKey;

    const url = `${API_BASE_URL}/api/companies/${companyId}/upload-file`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'File upload failed');
    }

    const result = await response.json();
    return result.data.fileUrl;
  },
};

// ============================================
// MONTH END API
// ============================================

export interface MonthEndStatus {
  invoicesProcessed: { completed: number; total: number };
  bankTransactions: { completed: number; total: number };
  apReconciliation: boolean;
  uncategorizedCount: number;
  trialBalanceUploaded: boolean;
  adjustingEntriesCount: number;
  status: 'not_started' | 'in_progress' | 'ready_to_close' | 'closed';
  closedDate?: string;
}

export const monthEndApi = {
  getStatus: async (companyId: string, period: string) => {
    // Note: The backend route is /companies/:companyId/month-end-close/:period/status
    return apiRequest<MonthEndStatus>(`/api/companies/${companyId}/month-end-close/${period}/status`);
  }
};

// ============================================
// ACTIVITIES API
// ============================================

export interface Activity {
  id: string;
  companyId: string;
  date: string;
  action: string;
  time: string;
  createdAt: string;
}

export const activitiesApi = {
  getByCompany: (companyId: string) =>
    apiRequest<Activity[]>(`/api/companies/${companyId}/activities`),

  create: (companyId: string, data: Partial<Activity>) =>
    apiRequest<Activity>(`/api/companies/${companyId}/activities`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ============================================
// INVOICES API
// ============================================

export interface Invoice {
  id: string;
  companyId: string;
  documentName: string;
  vendor: string;
  invoiceNumber?: string;
  date: string;
  dueDate?: string;
  net?: string;
  vat: string;
  gross: string;
  currency?: string;
  category: string;
  status: 'Pending' | 'Reviewed';
  fileUrl?: string;
  filePath?: string;
  source?: 'upload' | 'email';
  emailId?: string;
  emailFrom?: string;
  emailSubject?: string;
  emailReceivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const invoicesApi = {
  getByCompany: (companyId: string) =>
    apiRequest<Invoice[]>(`/api/companies/${companyId}/invoices`),

  create: (companyId: string, data: Partial<Invoice>) =>
    apiRequest<Invoice>(`/api/companies/${companyId}/invoices`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (companyId: string, id: string, data: Partial<Invoice>) =>
    apiRequest<Invoice>(`/api/companies/${companyId}/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (companyId: string, id: string) =>
    apiRequest<void>(`/api/companies/${companyId}/invoices/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================
// RECEIPTS API
// ============================================

export interface Receipt {
  id: string;
  companyId: string;
  merchant: string;
  amount: number;
  date: string;
  category: string;
  taxRate?: number | null;
  taxAmount?: number | null;
  paymentMethod?: string;
  imageUrl: string;
  fileName: string;
  status: 'Pending' | 'Reviewed' | 'Approved';
  source?: 'upload' | 'email';
  emailId?: string;
  emailFrom?: string;
  emailSubject?: string;
  emailReceivedAt?: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export const receiptsApi = {
  getByCompany: (companyId: string) =>
    apiRequest<Receipt[]>(`/api/companies/${companyId}/receipts`),

  create: (companyId: string, data: Partial<Receipt>) =>
    apiRequest<Receipt>(`/api/companies/${companyId}/receipts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (companyId: string, id: string, data: Partial<Receipt>) =>
    apiRequest<Receipt>(`/api/companies/${companyId}/receipts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (companyId: string, id: string) =>
    apiRequest<void>(`/api/companies/${companyId}/receipts/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================
// METRICS API
// ============================================

export interface DashboardMetrics {
  activeCompanies: number;
  documentsThisMonth: number;
  hoursSaved: number;
  aiUsageCost: number;
  pendingApprovalCount: number; // Invoices + Receipts pending approval
}

export interface CompanyMetrics {
  documentsProcessed: number;
  bankStatements: number;
  invoicesExtracted: number;
  monthEndClose: string;
}

export const metricsApi = {
  getDashboard: () => apiRequest<DashboardMetrics>('/api/metrics/dashboard'),

  getCompany: (companyId: string) =>
    apiRequest<CompanyMetrics>(`/api/metrics/company/${companyId}`),
};

// ============================================
// SETTINGS API
// ============================================

export interface Settings {
  plan: string;
  price: number;
  companyLimit: number;
  billingCycle: string;
  nextBillingDate: string;
}

export const settingsApi = {
  get: () => apiRequest<Settings>('/api/settings'),

  update: (data: Partial<Settings>) =>
    apiRequest<Settings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ============================================
// EMAILS API
// ============================================

export interface Email {
  id: string;
  companyId: string;
  from: string;
  subject: string;
  body: string;
  attachments: {
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
  }[];
  extractedInvoices: number;
  extractedReceipts: number;
  receivedAt: string;
  status: 'Received' | 'Processed' | 'Failed';
}

export const emailsApi = {
  getByCompany: (companyId: string) =>
    apiRequest<Email[]>(`/api/companies/${companyId}/emails`),

  parseEmail: async (
    companyId: string,
    emailData: {
      from: string;
      subject: string;
      body: string;
      attachments: File[];
    }
  ): Promise<{ email: Email; invoices: Invoice[] }> => {
    const formData = new FormData();
    formData.append('from', emailData.from);
    formData.append('subject', emailData.subject);
    formData.append('body', emailData.body);

    emailData.attachments.forEach((file) => {
      formData.append('attachments', file);
    });

    // Get the current user's access token
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token || publicAnonKey;

    const url = `${API_BASE_URL}/api/companies/${companyId}/emails/parse`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to parse email' }));
      throw new Error(error.error || 'Failed to parse email');
    }

    const result = await response.json();
    return result.data;
  },
};