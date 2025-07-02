"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkOutOfHoursMessages = exports.checkNoReplyConversations = void 0;
const supabase_1 = require("./supabase");
const timeHelpers_1 = require("./timeHelpers");
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const moment_timezone_1 = __importDefault(require("moment-timezone"));
dotenv_1.default.config();
// ESCENARIO 1: Verificar conversaciones sin respuesta durante horario laboral
const checkNoReplyConversations = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`🔍 [${(0, timeHelpers_1.getCurrentColombiaTime)()}] ESCENARIO 1: Verificando conversaciones sin respuesta en horario laboral...`);
    try {
        // Consultar conversaciones activas que no han sido notificadas y no están cerradas
        const { data: conversations, error: conversationsError } = yield supabase_1.supabase
            .from("chat_history")
            .select("id, client_number, chat_status, notified_no_reply")
            .eq("notified_no_reply", false)
            .neq("chat_status", "closed");
        if (conversationsError) {
            console.error("❌ Error fetching conversations:", conversationsError);
            return;
        }
        if (!conversations || conversations.length === 0) {
            console.log("✅ No hay conversaciones pendientes de notificar (Escenario 1)");
            return;
        }
        console.log(`📋 Encontradas ${conversations.length} conversaciones activas para revisar`);
        for (const conversation of conversations) {
            yield processInHoursConversation(conversation);
        }
    }
    catch (error) {
        console.error("❌ Error general en checkNoReplyConversations:", error);
    }
});
exports.checkNoReplyConversations = checkNoReplyConversations;
// ESCENARIO 2: Verificar mensajes enviados fuera de horario laboral
const checkOutOfHoursMessages = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`🌙 [${(0, timeHelpers_1.getCurrentColombiaTime)()}] ESCENARIO 2: Verificando mensajes fuera de horario laboral...`);
    try {
        // Consultar conversaciones que no han recibido notificación de horarios
        const { data: conversations, error: conversationsError } = yield supabase_1.supabase
            .from("chat_history")
            .select("id, client_number, notified_out_of_hours")
            .eq("notified_out_of_hours", false);
        if (conversationsError) {
            console.error("❌ Error fetching conversations:", conversationsError);
            return;
        }
        if (!conversations || conversations.length === 0) {
            console.log("✅ No hay conversaciones pendientes de notificar (Escenario 2)");
            return;
        }
        console.log(`📋 Encontradas ${conversations.length} conversaciones para revisar horarios`);
        for (const conversation of conversations) {
            yield processOutOfHoursConversation(conversation);
        }
    }
    catch (error) {
        console.error("❌ Error general en checkOutOfHoursMessages:", error);
    }
});
exports.checkOutOfHoursMessages = checkOutOfHoursMessages;
// Procesar conversación para escenario 1 (sin respuesta en horario laboral)
const processInHoursConversation = (conversation) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Buscar el último mensaje del asesor en esta conversación (cualquier sender que no sea client_message)
        const { data: lastAgentMessage, error: messageError } = yield supabase_1.supabase
            .from("messages")
            .select("created_at, sender")
            .eq("conversation_id", conversation.id)
            .neq("sender", "client_message")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
        if (messageError || !lastAgentMessage) {
            console.log(`⚠️ No se encontró último mensaje del asesor para conversación ${conversation.id}`);
            return;
        }
        const lastAgentMessageDate = (0, moment_timezone_1.default)(lastAgentMessage.created_at).tz("America/Bogota");
        // Verificar que el mensaje del asesor fue enviado en horario laboral
        if (!isWithinBusinessHours(lastAgentMessageDate)) {
            console.log(`⏰ Mensaje del asesor fuera de horario laboral para conversación ${conversation.id}`);
            return;
        }
        // Calcular tiempo transcurrido desde el último mensaje del asesor
        const now = (0, moment_timezone_1.default)().tz("America/Bogota");
        const timeDiffHours = now.diff(lastAgentMessageDate, "hours");
        console.log(`📞 Conversación ${conversation.id}: Último mensaje del asesor hace ${timeDiffHours} horas`);
        // Si han pasado más de 3 horas, verificar si el cliente respondió después
        if (timeDiffHours >= 3) {
            const clientReplied = yield hasClientRepliedAfter(conversation.id, lastAgentMessageDate);
            if (!clientReplied) {
                console.log(`📧 Enviando recordatorio a ${conversation.client_number}`);
                yield sendInHoursReminder(conversation.client_number);
                yield markAsNotifiedNoReply(conversation.id);
            }
            else {
                console.log(`✅ Cliente ya respondió después del último mensaje del asesor`);
            }
        }
    }
    catch (error) {
        console.error(`❌ Error procesando conversación ${conversation.id}:`, error);
    }
});
// Procesar conversación para escenario 2 (fuera de horario laboral)
const processOutOfHoursConversation = (conversation) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Buscar el último mensaje del cliente en esta conversación
        const { data: lastClientMessage, error: messageError } = yield supabase_1.supabase
            .from("messages")
            .select("created_at, sender")
            .eq("conversation_id", conversation.id)
            .eq("sender", "client_message")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
        if (messageError || !lastClientMessage) {
            return;
        }
        const lastClientMessageDate = (0, moment_timezone_1.default)(lastClientMessage.created_at).tz("America/Bogota");
        // Verificar que el mensaje del cliente fue enviado fuera de horario laboral
        if (!isWithinBusinessHours(lastClientMessageDate)) {
            console.log(`🌙 Enviando mensaje de horarios a ${conversation.client_number}`);
            yield sendOutOfHoursMessage(conversation.client_number);
            yield markAsNotifiedOutOfHours(conversation.id);
        }
    }
    catch (error) {
        console.error(`❌ Error procesando conversación fuera de horario ${conversation.id}:`, error);
    }
});
// Verificar si el cliente respondió después de una fecha específica
const hasClientRepliedAfter = (conversationId, afterDate) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data: clientMessages, error } = yield supabase_1.supabase
            .from("messages")
            .select("created_at")
            .eq("conversation_id", conversationId)
            .eq("sender", "client_message")
            .gte("created_at", afterDate.toISOString())
            .limit(1);
        if (error) {
            console.error("❌ Error verificando respuesta del cliente:", error);
            return false;
        }
        return clientMessages && clientMessages.length > 0;
    }
    catch (error) {
        console.error("❌ Error en hasClientRepliedAfter:", error);
        return false;
    }
});
// Verificar si una fecha está dentro del horario laboral
const isWithinBusinessHours = (date) => {
    const dayOfWeek = date.day(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
    const hour = date.hour();
    // Domingos no se trabaja
    if (dayOfWeek === 0) {
        return false;
    }
    // Lunes a Viernes: 8AM a 6PM
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        return hour >= 8 && hour < 18;
    }
    // Sábados: 8AM a 1PM
    if (dayOfWeek === 6) {
        return hour >= 8 && hour < 13;
    }
    return false;
};
// Enviar recordatorio para escenario 1 (sin respuesta en horario laboral)
const sendInHoursReminder = (phoneNumber) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.post("https://ultim.online/fenix/send-template", {
            to: phoneNumber,
            templateId: "HXa0168c042624758267465be5f5d1635f", // Template de recordatorio
        });
        console.log(`✅ Recordatorio enviado exitosamente:`, response.data);
    }
    catch (error) {
        if (error.response) {
            console.error(`❌ Error enviando recordatorio:`, error.response.data);
        }
        else if (error.request) {
            console.error(`❌ No response from server:`, error.request);
        }
        else {
            console.error(`❌ Error:`, error.message);
        }
    }
});
// Enviar mensaje de horarios para escenario 2 (fuera de horario laboral)
const sendOutOfHoursMessage = (phoneNumber) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.post("https://ultim.online/fenix/send-template", {
            to: phoneNumber,
            templateId: "HORARIOS_TEMPLATE_ID", // TODO: Reemplazar con el ID real del template de horarios
        });
        console.log(`✅ Mensaje de horarios enviado exitosamente:`, response.data);
    }
    catch (error) {
        if (error.response) {
            console.error(`❌ Error enviando mensaje de horarios:`, error.response.data);
        }
        else if (error.request) {
            console.error(`❌ No response from server:`, error.request);
        }
        else {
            console.error(`❌ Error:`, error.message);
        }
    }
});
// Marcar conversación como notificada para escenario 1
const markAsNotifiedNoReply = (conversationId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { error } = yield supabase_1.supabase
            .from("chat_history")
            .update({ notified_no_reply: true })
            .eq("id", conversationId);
        if (error) {
            console.error(`❌ Error marcando conversación ${conversationId} como notificada (no reply):`, error);
        }
        else {
            console.log(`✅ Conversación ${conversationId} marcada como notificada (no reply)`);
        }
    }
    catch (error) {
        console.error(`❌ Error general marcando conversación ${conversationId}:`, error);
    }
});
// Marcar conversación como notificada para escenario 2
const markAsNotifiedOutOfHours = (conversationId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { error } = yield supabase_1.supabase
            .from("chat_history")
            .update({ notified_out_of_hours: true })
            .eq("id", conversationId);
        if (error) {
            console.error(`❌ Error marcando conversación ${conversationId} como notificada (out of hours):`, error);
        }
        else {
            console.log(`✅ Conversación ${conversationId} marcada como notificada (out of hours)`);
        }
    }
    catch (error) {
        console.error(`❌ Error general marcando conversación ${conversationId} (out of hours):`, error);
    }
});
