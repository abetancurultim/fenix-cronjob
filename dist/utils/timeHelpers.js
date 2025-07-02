"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentColombiaTime = exports.shouldRunJobNow = void 0;
const moment_timezone_1 = __importDefault(require("moment-timezone"));
// Función para verificar si el job debe ejecutarse según el día y la hora
const shouldRunJobNow = () => {
    // Obtener la fecha y hora actual en zona horaria de Colombia
    const nowColombia = (0, moment_timezone_1.default)().tz("America/Bogota");
    const dayOfWeek = nowColombia.day(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
    const currentHour = nowColombia.hour();
    // No ejecutar los domingos (día 0)
    if (dayOfWeek === 0) {
        console.log("⏰ Job no ejecutado: Es domingo");
        return false;
    }
    // No ejecutar los sábados después de la 1PM (13:00)
    if (dayOfWeek === 6 && currentHour >= 13) {
        console.log("⏰ Job no ejecutado: Es sábado después de la 1PM");
        return false;
    }
    console.log("⏰ Job puede ejecutarse: Es un horario laboral válido");
    return true;
};
exports.shouldRunJobNow = shouldRunJobNow;
// Función para obtener la hora actual en Colombia (para logs)
const getCurrentColombiaTime = () => {
    return (0, moment_timezone_1.default)().tz("America/Bogota").format("YYYY-MM-DD HH:mm:ss");
};
exports.getCurrentColombiaTime = getCurrentColombiaTime;
