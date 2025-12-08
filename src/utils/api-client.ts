import { projectId, publicAnonKey } from './supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113`;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  console.log(`🔌 API Request: ${endpoint}`);
  console.log(`📍 Full URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    console.log(`📥 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      console.error(`❌ API Error (${endpoint}):`, error);
      throw new Error(error.error || `Request failed: ${response.statusText}`);
    }

    const result: ApiResponse<T> = await response.json();
    
    if (!result.success) {
      console.error(`❌ API Request failed (${endpoint}):`, result.error);
      throw new Error(result.error || 'Request failed');
    }

    console.log(`✅ API Success (${endpoint})`);
    return result.data as T;
  } catch (error) {
    console.error(`❌ API Request exception (${endpoint}):`, error);
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
  status: 'Active' | 'Inactive' | 'Archived';
  tags?: string[];
  docsThisMonth?: number;
  lastActivity?: string;
  email?: string; // Dedicated email address for this company
  createdAt: string;
  updatedAt: string;
}

export const companiesApi = {
  getAll: () => apiRequest<Company[]>('/api/companies'),
  
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
    
    const url = `${API_BASE_URL}/api/companies/${companyId}/upload-file`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
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
// METRICS API
// ============================================

export interface DashboardMetrics {
  activeCompanies: number;
  documentsThisMonth: number;
  hoursSaved: number;
  aiUsageCost: number;
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
    
    const url = `${API_BASE_URL}/api/companies/${companyId}/emails/parse`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
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