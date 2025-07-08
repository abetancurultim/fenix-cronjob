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
const node_schedule_1 = __importDefault(require("node-schedule"));
const checkNoReplyConversations_1 = require("./utils/checkNoReplyConversations");
const timeHelpers_1 = require("./utils/timeHelpers");
// Función que ejecuta el job principal con validación de horario laboral (ESCENARIO 1A - 12:30 PM)
const executeInHoursJobWithValidation = (jobName) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`\n🕐 [${(0, timeHelpers_1.getCurrentColombiaTime)()}] Iniciando ${jobName}...`);
    // Verificar si el job debe ejecutarse según el día y la hora
    if (!(0, timeHelpers_1.shouldRunJobNow)()) {
        console.log(`⏸️ ${jobName} cancelado por estar fuera de horario laboral\n`);
        return;
    }
    try {
        // Ejecutar la lógica de verificación de conversaciones sin respuesta (primer barrido)
        yield (0, checkNoReplyConversations_1.checkNoReplyConversations)();
        console.log(`✅ ${jobName} completado exitosamente\n`);
    }
    catch (error) {
        console.error(`❌ Error en ${jobName}:`, error);
    }
});
// Función que ejecuta el job del segundo barrido con validación de horario laboral (ESCENARIO 1B - 5:30 PM)
const executeAfternoonJobWithValidation = (jobName) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`\n🕐 [${(0, timeHelpers_1.getCurrentColombiaTime)()}] Iniciando ${jobName}...`);
    // Verificar si el job debe ejecutarse según el día y la hora
    if (!(0, timeHelpers_1.shouldRunJobNow)()) {
        console.log(`⏸️ ${jobName} cancelado por estar fuera de horario laboral\n`);
        return;
    }
    try {
        // Ejecutar la lógica de verificación de conversaciones sin respuesta (segundo barrido)
        yield (0, checkNoReplyConversations_1.checkNoReplyConversationsAfternoon)();
        console.log(`✅ ${jobName} completado exitosamente\n`);
    }
    catch (error) {
        console.error(`❌ Error en ${jobName}:`, error);
    }
});
// Función para ejecutar el job de mensajes fuera de horario (ESCENARIO 2)
const executeOutOfHoursJob = (jobName) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`\n🌙 [${(0, timeHelpers_1.getCurrentColombiaTime)()}] Iniciando ${jobName}...`);
    try {
        // Ejecutar la lógica de verificación de mensajes fuera de horario
        yield (0, checkNoReplyConversations_1.checkOutOfHoursMessages)();
        console.log(`✅ ${jobName} completado exitosamente\n`);
    }
    catch (error) {
        console.error(`❌ Error en ${jobName}:`, error);
    }
});
// ESCENARIO 1A: Job de primer barrido - 12:30 PM hora Colombia
// Cron expression: "30 12 * * *" = a las 12:30 todos los días
node_schedule_1.default.scheduleJob("30 12 * * *", () => __awaiter(void 0, void 0, void 0, function* () {
    yield executeInHoursJobWithValidation("ESCENARIO 1A: Job de primer barrido (12:30 PM Colombia)");
}));
// ESCENARIO 1B: Job de segundo barrido - 5:30 PM hora Colombia
// Cron expression: "30 17 * * *" = a las 17:30 todos los días
node_schedule_1.default.scheduleJob("30 17 * * *", () => __awaiter(void 0, void 0, void 0, function* () {
    yield executeAfternoonJobWithValidation("ESCENARIO 1B: Job de segundo barrido (5:30 PM Colombia)");
}));
// ESCENARIO 2: Job de mensajes fuera de horario - cada 2 horas SOLO en horario laboral (8AM-6PM)
// Cron expression: "0 8-18/2 * * *" = a las 8:00, 10:00, 12:00, 14:00, 16:00, 18:00
node_schedule_1.default.scheduleJob("0 8-18/2 * * *", () => __awaiter(void 0, void 0, void 0, function* () {
    yield executeOutOfHoursJob("ESCENARIO 2: Job de mensajes fuera de horario (8AM-6PM cada 2 horas)");
}));
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
console.log("📅 ESCENARIO 1A: Primer barrido - conversaciones sin respuesta - 12:30 PM hora Colombia");
console.log("📅 ESCENARIO 1B: Segundo barrido - conversaciones que no respondieron al primer barrido - 5:30 PM hora Colombia");
console.log("🌙 ESCENARIO 2: Mensajes fuera de horario - cada 2 horas de 8AM a 6PM hora Colombia");
console.log("⏰ Horario laboral: Lun-Vie 8AM-6PM, Sáb 8AM-1PM, Dom cerrado");
console.log("❌ Excluye conversaciones con chat_status = 'closed'");
console.log(`🕐 Hora actual en Colombia: ${(0, timeHelpers_1.getCurrentColombiaTime)()}\n`);
