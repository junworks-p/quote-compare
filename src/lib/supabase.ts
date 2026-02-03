import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Quote = {
  id: string;
  name: string;
  company: string;
  total_amount: number;
  created_at: string;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
  category: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  amount: number;
};

export type ComparisonGroup = {
  id: string;
  name: string;
  created_at: string;
};
