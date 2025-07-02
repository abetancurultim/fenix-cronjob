import schedule from "node-schedule";
import {
  checkNoReplyConversations,
  checkOutOfHoursMessages,
} from "./utils/checkNoReplyConversations";
import { shouldRunJobNow, getCurrentColombiaTime } from "./utils/timeHelpers";

// Función que ejecuta el job principal con validación de horario laboral (ESCENARIO 1)
const executeInHoursJobWithValidation = async (
  jobName: string
): Promise<void> => {
  console.log(`\n🕐 [${getCurrentColombiaTime()}] Iniciando ${jobName}...`);

  // Verificar si el job debe ejecutarse según el día y la hora
  if (!shouldRunJobNow()) {
    console.log(`⏸️ ${jobName} cancelado por estar fuera de horario laboral\n`);
    return;
  }

  try {
    // Ejecutar la lógica de verificación de conversaciones sin respuesta
    await checkNoReplyConversations();
    console.log(`✅ ${jobName} completado exitosamente\n`);
  } catch (error) {
    console.error(`❌ Error en ${jobName}:`, error);
  }
};

// Función para ejecutar el job de mensajes fuera de horario (ESCENARIO 2)
const executeOutOfHoursJob = async (jobName: string): Promise<void> => {
  console.log(`\n🌙 [${getCurrentColombiaTime()}] Iniciando ${jobName}...`);

  try {
    // Ejecutar la lógica de verificación de mensajes fuera de horario
    await checkOutOfHoursMessages();
    console.log(`✅ ${jobName} completado exitosamente\n`);
  } catch (error) {
    console.error(`❌ Error en ${jobName}:`, error);
  }
};

// ESCENARIO 1: Jobs de horario laboral - 12:30 PM y 5:30 PM hora Colombia
// Cron expression: "30 12 * * *" = a las 12:30 todos los días
schedule.scheduleJob("30 12 * * *", async () => {
  await executeInHoursJobWithValidation(
    "ESCENARIO 1: Job de medio día (12:30 PM Colombia)"
  );
});

// Job de tarde - 5:30 PM hora Colombia
// Cron expression: "30 17 * * *" = a las 17:30 todos los días
schedule.scheduleJob("30 17 * * *", async () => {
  await executeInHoursJobWithValidation(
    "ESCENARIO 1: Job de tarde (5:30 PM Colombia)"
  );
});

// ESCENARIO 2: Job de mensajes fuera de horario - cada 2 horas SOLO en horario laboral (8AM-6PM)
// Cron expression: "0 8-18/2 * * *" = a las 8:00, 10:00, 12:00, 14:00, 16:00, 18:00
schedule.scheduleJob("0 8-18/2 * * *", async () => {
  await executeOutOfHoursJob(
    "ESCENARIO 2: Job de mensajes fuera de horario (8AM-6PM cada 2 horas)"
  );
});

//! Ejecutar el cronjob cada minuto (para pruebas ESCENARIO 1) - Descomenta la siguiente línea para probar
// schedule.scheduleJob("* * * * *", async () => {
//   await executeInHoursJobWithValidation("Test ESCENARIO 1 (cada minuto)");
// });

//! Ejecutar el cronjob cada 30 segundos (para pruebas ESCENARIO 2) - Descomenta la siguiente línea para probar
// schedule.scheduleJob("*/30 * * * * *", async () => {
//   await executeOutOfHoursJob("Test ESCENARIO 2 (cada 30 segundos)");
// });

console.log("🚀 Sistema de notificaciones iniciado con dos escenarios:");
console.log(
  "📅 ESCENARIO 1: Conversaciones sin respuesta - 12:30 PM y 5:30 PM hora Colombia"
);
console.log(
  "🌙 ESCENARIO 2: Mensajes fuera de horario - cada 2 horas de 8AM a 6PM hora Colombia"
);
console.log("⏰ Horario laboral: Lun-Vie 8AM-6PM, Sáb 8AM-1PM, Dom cerrado");
console.log("❌ Excluye conversaciones con chat_status = 'closed'");
console.log(`🕐 Hora actual en Colombia: ${getCurrentColombiaTime()}\n`);
