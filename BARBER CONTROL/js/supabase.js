// Cliente Supabase do Barber Control (somente chave publishable).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { APP_CONFIG } from "../config/app.config.js";

export const supabase = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabasePublishableKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: APP_CONFIG.authStorageKey
    }
});
