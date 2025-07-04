"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = exports.TABLE_NAMES = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
// Nombres de tablas configurables
exports.TABLE_NAMES = {
    CHAT_HISTORY: process.env.TABLE_CHAT_HISTORY || "chat_history",
    MESSAGES: process.env.TABLE_MESSAGES || "messages",
    USERS: process.env.TABLE_USERS || "users",
};
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
