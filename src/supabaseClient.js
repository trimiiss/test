import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';


const supabaseUrl = 'https://syexdqixxnewbqqoaaox.supabase.co';
const supabaseAnonKey = 'sb_publishable_K7qbKo9IgWXCYPH6KMhN5w_uKABZwIM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // This saves the session on the phone
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Prevents errors on React Native
  },
});