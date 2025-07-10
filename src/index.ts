import schedule from "node-schedule";
import {
  checkNoReplyConversations,
  checkNoReplyConversationsAfternoon,
  checkOutOfHoursMessages,
} from "./utils/checkNoReplyConversations";
import { shouldRunJobNow, getCurrentColombiaTime } from "./utils/timeHelpers";
import moment from "moment-timezone";

// Función para calcular la hora del servidor que corresponde a una hora específica de Colombia
const getServerTimeForColombiaTime = (
  colombiaHour: number,
  colombiaMinute: number = 0
): { hour: number; minute: number } => {
  // Crear un momento en Colombia con la hora deseada
  const colombiaTime = moment()
    .tz("America/Bogota")
    .hour(colombiaHour)
    .minute(colombiaMinute)
    .second(0);

  // Convertir a la zona horaria del servidor (local)
  const serverTime = colombiaTime.local();

  console.log(
    `🕐 Colombia ${colombiaHour}:${colombiaMinute
      .toString()
      .padStart(2, "0")} = Servidor ${serverTime.hour()}:${serverTime
      .minute()
      .toString()
      .padStart(2, "0")}`
  );

  return {
    hour: serverTime.hour(),
    minute: serverTime.minute(),
  };
};

// Calcular las horas del servidor para los jobs
const job1Time = getServerTimeForColombiaTime(12, 30); // 12:30 PM Colombia
const job2Time = getServerTimeForColombiaTime(17, 30); // 5:30 PM Colombia

// Función que ejecuta el job principal con validación de horario laboral (ESCENARIO 1A - 12:30 PM)
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
    // Ejecutar la lógica de verificación de conversaciones sin respuesta (primer barrido)
    await checkNoReplyConversations();
    console.log(`✅ ${jobName} completado exitosamente\n`);
  } catch (error) {
    console.error(`❌ Error en ${jobName}:`, error);
  }
};

// Función que ejecuta el job del segundo barrido con validación de horario laboral (ESCENARIO 1B - 5:30 PM)
const executeAfternoonJobWithValidation = async (
  jobName: string
): Promise<void> => {
  console.log(`\n🕐 [${getCurrentColombiaTime()}] Iniciando ${jobName}...`);

  // Verificar si el job debe ejecutarse según el día y la hora
  if (!shouldRunJobNow()) {
    console.log(`⏸️ ${jobName} cancelado por estar fuera de horario laboral\n`);
    return;
  }

  try {
    // Ejecutar la lógica de verificación de conversaciones sin respuesta (segundo barrido)
    await checkNoReplyConversationsAfternoon();
    console.log(`✅ ${jobName} completado exitosamente\n`);
  } catch (error) {
    console.error(`❌ Error en ${jobName}:`, error);
  }
};

// Función para ejecutar el job de mensajes fuera de horario (ESCENARIO 2)
// NOTA: No validamos horario laboral aquí porque por diseño se ejecuta fuera del horario
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

// ESCENARIO 1A: Job de primer barrido - 12:30 PM hora Colombia
// Cron calculado dinámicamente según la zona horaria del servidor
schedule.scheduleJob(`${job1Time.minute} ${job1Time.hour} * * *`, async () => {
  await executeInHoursJobWithValidation(
    "ESCENARIO 1A: Job de primer barrido (12:30 PM Colombia)"
  );
});

// ESCENARIO 1B: Job de segundo barrido - 5:30 PM hora Colombia
// Cron calculado dinámicamente según la zona horaria del servidor
schedule.scheduleJob(`${job2Time.minute} ${job2Time.hour} * * *`, async () => {
  await executeAfternoonJobWithValidation(
    "ESCENARIO 1B: Job de segundo barrido (5:30 PM Colombia)"
  );
});

// ESCENARIO 2: Job de mensajes fuera de horario
// REGLAS ESPECÍFICAS:
// - Sábados: Solo de 2PM a 6PM (cada 2 horas)
// - Domingos: Solo de 8AM a 6PM (cada 2 horas)
// - Lunes a Viernes: NUNCA se ejecuta
const createOutOfHoursJobs = () => {
  const outOfHoursSchedules = [
    // Sábados: 2PM, 4PM, 6PM (después de 1PM)
    { colombiaHour: 14, description: "2PM Colombia (sábado)", day: 6 },
    { colombiaHour: 16, description: "4PM Colombia (sábado)", day: 6 },
    { colombiaHour: 18, description: "6PM Colombia (sábado)", day: 6 },

    // Domingos: 8AM, 10AM, 12PM, 2PM, 4PM (8AM a 6PM cada 2 horas)
    { colombiaHour: 8, description: "8AM Colombia (domingo)", day: 0 },
    { colombiaHour: 10, description: "10AM Colombia (domingo)", day: 0 },
    { colombiaHour: 12, description: "12PM Colombia (domingo)", day: 0 },
    { colombiaHour: 14, description: "2PM Colombia (domingo)", day: 0 },
    { colombiaHour: 16, description: "4PM Colombia (domingo)", day: 0 },
  ];

  outOfHoursSchedules.forEach((scheduleConfig) => {
    const serverTime = getServerTimeForColombiaTime(
      scheduleConfig.colombiaHour,
      0
    );

    // Programar para el día específico (0=domingo, 6=sábado)
    schedule.scheduleJob(
      `0 ${serverTime.hour} * * ${scheduleConfig.day}`,
      async () => {
        await executeOutOfHoursJob(
          `ESCENARIO 2: Job de mensajes fuera de horario (${scheduleConfig.description} = ${serverTime.hour}:00 Servidor)`
        );
      }
    );

    console.log(
      `🌙 ESCENARIO 2 programado: ${scheduleConfig.description} = ${serverTime.hour}:00 servidor`
    );
  });
};

createOutOfHoursJobs();

// ! Ejecutar el cronjob cada minuto (para pruebas ESCENARIO 1A) - Descomenta la siguiente línea para probar
// schedule.scheduleJob("* * * * *", async () => {
//   await executeInHoursJobWithValidation("Test ESCENARIO 1A (cada minuto)");
// });

// ! Ejecutar el cronjob cada 2 minutos (para pruebas ESCENARIO 1B) - Descomenta la siguiente línea para probar
// schedule.scheduleJob("*/2 * * * *", async () => {
//   await executeAfternoonJobWithValidation("Test ESCENARIO 1B (cada 2 minutos)");
// });

// ! Ejecutar el cronjob cada 30 segundos (para pruebas ESCENARIO 2) - Descomenta la siguiente línea para probar
// schedule.scheduleJob("*/30 * * * * *", async () => {
//   await executeOutOfHoursJob("Test ESCENARIO 2 (cada 30 segundos)");
// });

console.log("🚀 Sistema de notificaciones iniciado con tres escenarios:");
console.log(
  `📅 ESCENARIO 1A: Primer barrido - 12:30 PM Colombia (${
    job1Time.hour
  }:${job1Time.minute.toString().padStart(2, "0")} servidor)`
);
console.log(
  `📅 ESCENARIO 1B: Segundo barrido - 5:30 PM Colombia (${
    job2Time.hour
  }:${job2Time.minute.toString().padStart(2, "0")} servidor)`
);
console.log(
  "🌙 ESCENARIO 2: Mensajes fuera de horario - sábados 1PM-6PM y domingos 8AM-6PM"
);
console.log("⏰ Horario laboral: Lun-Vie 8AM-6PM, Sáb 8AM-1PM, Dom cerrado");
console.log("❌ Excluye conversaciones con chat_status = 'closed'");
console.log(`🕐 Hora actual en Colombia: ${getCurrentColombiaTime()}`);
console.log(
  `🕐 Hora actual del servidor: ${moment().format("YYYY-MM-DD HH:mm:ss")}\n`
);
