import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

// Create a singleton Supabase client instance
// This prevents multiple instances from being created
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);
