"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const router = express_1.default.Router();
router.get("/", (req, res) => {
    res.send("Petición GET de prueba para validar que el servidor está corriendo.");
});
// Ruta principal
router.get("/api", (req, res) => {
    res.send("Servidor funcionando correctamente con Typescript y Express.");
});
exports.default = router;
