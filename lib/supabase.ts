import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

export async function isSuperUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('is_super_user')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error checking super user status:', error);
    return false;
  }

  return data?.is_super_user || false;
}

export async function getExportsCount(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('document_exports')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString());

  if (error) {
    console.error('Error getting exports count:', error);
    return 0;
  }

  return data?.length || 0;
} 