import { projectId, publicAnonKey } from './supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113`;

/**
 * Check if the backend server is running
 */
export async function checkBackendHealth(): Promise<{
  isOnline: boolean;
  error?: string;
}> {
  try {
    console.log('🏥 Checking backend health...');
    console.log(`📍 URL: ${API_BASE_URL}/health`);
    
    const response = await fetch(`${API_BASE_URL}/health`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend is online:', data);
      return { isOnline: true };
    } else {
      console.error(`❌ Backend returned error: ${response.status}`);
      return { 
        isOnline: false, 
        error: `Server returned ${response.status} ${response.statusText}` 
      };
    }
  } catch (error: any) {
    console.error('❌ Backend health check failed:', error);
    return { 
      isOnline: false, 
      error: error.message || 'Failed to connect to server' 
    };
  }
}
