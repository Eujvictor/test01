const SUPABASE_URL = "https://cjwmzbknarafinftpqsv.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_k1KkMm2f4-xRDy07B7f46w_0WddyoUj";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

window.supabaseClient = supabaseClient;
