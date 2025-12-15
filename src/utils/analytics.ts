import { projectId, publicAnonKey } from './supabase/info';

export interface TrackDemoEventParams {
  demoType: 'invoice' | 'pe' | 'bank-rec' | 'ap-rec' | 'expense';
  fileName: string;
  fileSize: number;
  fileType: string;
  success: boolean;
  errorMessage?: string;
  processingTime?: number;
  metadata?: Record<string, any>;
}

export async function trackDemoEvent(params: TrackDemoEventParams): Promise<void> {
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/analytics/track`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn('Analytics tracking failed with status:', response.status, errorText);
    }
  } catch (error) {
    // Silent failure - don't break the user experience if analytics fails
    console.warn('Analytics tracking failed:', error);
  }
}