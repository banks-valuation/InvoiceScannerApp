import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Add debugging information
console.log('Supabase configuration:', {
  url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'MISSING',
  key: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING'
});

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please connect to Supabase.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
