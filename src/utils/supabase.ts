import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

// Nombres de tablas configurables
export const TABLE_NAMES = {
  CHAT_HISTORY: process.env.TABLE_CHAT_HISTORY || "chat_history",
  MESSAGES: process.env.TABLE_MESSAGES || "messages",
  USERS: process.env.TABLE_USERS || "users",
};

export const supabase = createClient(supabaseUrl, supabaseKey);
