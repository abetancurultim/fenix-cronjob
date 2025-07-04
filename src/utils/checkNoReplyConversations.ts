import { supabase, TABLE_NAMES } from "./supabase";
import { getCurrentColombiaTime } from "./timeHelpers";
import axios from "axios";
import dotenv from "dotenv";
import moment from "moment-timezone";

dotenv.config();

type Conversation = {
  id: string;
  client_number: string;
  chat_status: string;
  notified_no_reply: boolean;
  notified_out_of_hours: boolean;
};

type Message = {
  id: string;
  conversation_id: string;
  sender: string;
  created_at: string;
};

// ESCENARIO 1: Verificar conversaciones sin respuesta durante horario laboral
export const checkNoReplyConversations = async (): Promise<void> => {
  console.log(
    `🔍 [${getCurrentColombiaTime()}] ESCENARIO 1: Verificando conversaciones sin respuesta en horario laboral...`
  );

  try {
    // Consultar conversaciones activas que no han sido notificadas y no están cerradas
    const { data: conversations, error: conversationsError } = await supabase
      .from(TABLE_NAMES.CHAT_HISTORY)
      .select("id, client_number, chat_status, notified_no_reply")
      .eq("notified_no_reply", false)
      .neq("chat_status", "closed");

    if (conversationsError) {
      console.error("❌ Error fetching conversations:", conversationsError);
      return;
    }

    if (!conversations || conversations.length === 0) {
      console.log(
        "✅ No hay conversaciones pendientes de notificar (Escenario 1)"
      );
      return;
    }

    console.log(
      `📋 Encontradas ${conversations.length} conversaciones activas para revisar`
    );

    for (const conversation of conversations as Conversation[]) {
      await processInHoursConversation(conversation);
    }
  } catch (error) {
    console.error("❌ Error general en checkNoReplyConversations:", error);
  }
};

// ESCENARIO 2: Verificar mensajes enviados fuera de horario laboral
export const checkOutOfHoursMessages = async (): Promise<void> => {
  console.log(
    `🌙 [${getCurrentColombiaTime()}] ESCENARIO 2: Verificando mensajes fuera de horario laboral...`
  );

  try {
    // Consultar conversaciones que no han recibido notificación de horarios
    const { data: conversations, error: conversationsError } = await supabase
      .from(TABLE_NAMES.CHAT_HISTORY)
      .select("id, client_number, notified_out_of_hours")
      .eq("notified_out_of_hours", false);

    if (conversationsError) {
      console.error("❌ Error fetching conversations:", conversationsError);
      return;
    }

    if (!conversations || conversations.length === 0) {
      console.log(
        "✅ No hay conversaciones pendientes de notificar (Escenario 2)"
      );
      return;
    }

    console.log(
      `📋 Encontradas ${conversations.length} conversaciones para revisar horarios`
    );

    for (const conversation of conversations as Conversation[]) {
      await processOutOfHoursConversation(conversation);
    }
  } catch (error) {
    console.error("❌ Error general en checkOutOfHoursMessages:", error);
  }
};

// Procesar conversación para escenario 1 (sin respuesta en horario laboral)
const processInHoursConversation = async (
  conversation: Conversation
): Promise<void> => {
  try {
    // Buscar el último mensaje del asesor en esta conversación (cualquier sender que no sea client_message)
    const { data: lastAgentMessage, error: messageError } = await supabase
      .from(TABLE_NAMES.MESSAGES)
      .select("created_at, sender")
      .eq("conversation_id", conversation.id)
      .neq("sender", "client_message")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (messageError || !lastAgentMessage) {
      console.log(
        `⚠️ No se encontró último mensaje del asesor para conversación ${conversation.id}`
      );
      return;
    }

    const lastAgentMessageDate = moment(lastAgentMessage.created_at).tz(
      "America/Bogota"
    );

    // Verificar que el mensaje del asesor fue enviado en horario laboral
    if (!isWithinBusinessHours(lastAgentMessageDate)) {
      console.log(
        `⏰ Mensaje del asesor fuera de horario laboral para conversación ${conversation.id}`
      );
      return;
    }

    // Calcular tiempo transcurrido desde el último mensaje del asesor
    const now = moment().tz("America/Bogota");
    const timeDiffHours = now.diff(lastAgentMessageDate, "hours");

    console.log(
      `📞 Conversación ${conversation.id}: Último mensaje del asesor hace ${timeDiffHours} horas`
    );

    // Si han pasado más de 3 horas, verificar si el cliente respondió después
    if (timeDiffHours >= 3) {
      const clientReplied = await hasClientRepliedAfter(
        conversation.id,
        lastAgentMessageDate
      );

      if (!clientReplied) {
        console.log(`📧 Enviando recordatorio a ${conversation.client_number}`);
        await sendInHoursReminder(conversation.client_number);
        await markAsNotifiedNoReply(conversation.id);
      } else {
        console.log(
          `✅ Cliente ya respondió después del último mensaje del asesor`
        );
      }
    }
  } catch (error) {
    console.error(
      `❌ Error procesando conversación ${conversation.id}:`,
      error
    );
  }
};

// Procesar conversación para escenario 2 (fuera de horario laboral)
const processOutOfHoursConversation = async (
  conversation: Conversation
): Promise<void> => {
  try {
    // Buscar el último mensaje del cliente en esta conversación
    const { data: lastClientMessage, error: messageError } = await supabase
      .from(TABLE_NAMES.MESSAGES)
      .select("created_at, sender")
      .eq("conversation_id", conversation.id)
      .eq("sender", "client_message")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (messageError || !lastClientMessage) {
      return;
    }

    const lastClientMessageDate = moment(lastClientMessage.created_at).tz(
      "America/Bogota"
    );

    // Verificar que el mensaje del cliente fue enviado fuera de horario laboral
    if (!isWithinBusinessHours(lastClientMessageDate)) {
      console.log(
        `🌙 Enviando mensaje de horarios a ${conversation.client_number}`
      );
      await sendOutOfHoursMessage(conversation.client_number);
      await markAsNotifiedOutOfHours(conversation.id);
    }
  } catch (error) {
    console.error(
      `❌ Error procesando conversación fuera de horario ${conversation.id}:`,
      error
    );
  }
};

// Verificar si el cliente respondió después de una fecha específica
const hasClientRepliedAfter = async (
  conversationId: string,
  afterDate: moment.Moment
): Promise<boolean> => {
  try {
    const { data: clientMessages, error } = await supabase
      .from(TABLE_NAMES.MESSAGES)
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
  } catch (error) {
    console.error("❌ Error en hasClientRepliedAfter:", error);
    return false;
  }
};

// Verificar si una fecha está dentro del horario laboral
const isWithinBusinessHours = (date: moment.Moment): boolean => {
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
const sendInHoursReminder = async (phoneNumber: string): Promise<void> => {
  try {
    const response = await axios.post(
      "https://ultim.online/fenix/send-template",
      {
        to: phoneNumber,
        templateId: "HXad825e16b3fef204b7e78ec9d0851950",
      }
    );

    console.log(`✅ Recordatorio enviado exitosamente:`, response.data);
  } catch (error: any) {
    if (error.response) {
      console.error(`❌ Error enviando recordatorio:`, error.response.data);
    } else if (error.request) {
      console.error(`❌ No response from server:`, error.request);
    } else {
      console.error(`❌ Error:`, error.message);
    }
  }
};

// Enviar mensaje de horarios para escenario 2 (fuera de horario laboral)
const sendOutOfHoursMessage = async (phoneNumber: string): Promise<void> => {
  try {
    const response = await axios.post(
      "https://ultim.online/fenix/send-template",
      {
        to: phoneNumber,
        templateId: "HX83c6652c93ecc93e2dd53c120fd6a0ef",
      }
    );

    console.log(`✅ Mensaje de horarios enviado exitosamente:`, response.data);
  } catch (error: any) {
    if (error.response) {
      console.error(
        `❌ Error enviando mensaje de horarios:`,
        error.response.data
      );
    } else if (error.request) {
      console.error(`❌ No response from server:`, error.request);
    } else {
      console.error(`❌ Error:`, error.message);
    }
  }
};

// Marcar conversación como notificada para escenario 1
const markAsNotifiedNoReply = async (conversationId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from(TABLE_NAMES.CHAT_HISTORY)
      .update({ notified_no_reply: true })
      .eq("id", conversationId);

    if (error) {
      console.error(
        `❌ Error marcando conversación ${conversationId} como notificada (no reply):`,
        error
      );
    } else {
      console.log(
        `✅ Conversación ${conversationId} marcada como notificada (no reply)`
      );
    }
  } catch (error) {
    console.error(
      `❌ Error general marcando conversación ${conversationId}:`,
      error
    );
  }
};

// Marcar conversación como notificada para escenario 2
const markAsNotifiedOutOfHours = async (
  conversationId: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from(TABLE_NAMES.CHAT_HISTORY)
      .update({ notified_out_of_hours: true })
      .eq("id", conversationId);

    if (error) {
      console.error(
        `❌ Error marcando conversación ${conversationId} como notificada (out of hours):`,
        error
      );
    } else {
      console.log(
        `✅ Conversación ${conversationId} marcada como notificada (out of hours)`
      );
    }
  } catch (error) {
    console.error(
      `❌ Error general marcando conversación ${conversationId} (out of hours):`,
      error
    );
  }
};
