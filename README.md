# 📧 Fenix Cronjob - Sistema de Notificaciones WhatsApp

## 🎯 Descripción

Sistema de cron jobs automatizado con **dos escenarios** para gestionar notificaciones de WhatsApp:

1. **ESCENARIO 1**: Recordatorios a clientes que no responden durante horario laboral
2. **ESCENARIO 2**: Mensajes informativos a clientes que escriben fuera de horario laboral

Ayuda a mantener activas las ventanas de contexto de WhatsApp a través de Twilio y mejora la experiencia del cliente.

## 🚀 Características Principales

- ⏰ **ESCENARIO 1**: Ejecución a las 12:30 PM y 5:30 PM hora Colombia
- 🌙 **ESCENARIO 2**: Ejecución cada 2 horas de 8AM a 6PM hora Colombia
- 🕐 **Detección inteligente**: Identifica diferentes tipos de situaciones
- 📅 **Horario laboral**: Lun-Vie 8AM-6PM, Sáb 8AM-1PM, Dom cerrado
- 🔄 **Control de duplicados**: Evita notificaciones repetidas usando flags específicos
- ❌ **Filtro de estado**: Excluye conversaciones cerradas (`chat_status != "closed"`)
- 📊 **Logs detallados**: Seguimiento completo con emojis para fácil identificación
- 🌍 **Zona horaria**: Manejo automático de hora de Colombia independiente del servidor

## 📋 Requisitos Previos

### Base de Datos (Supabase)

```sql
-- Agregar columnas de control en chat_history
ALTER TABLE chat_history ADD COLUMN notified_no_reply boolean DEFAULT false;
ALTER TABLE chat_history ADD COLUMN notified_out_of_hours boolean DEFAULT false;
```

### Variables de Entorno

```env
# Configuración de Supabase
SUPABASE_URL=tu_supabase_url
SUPABASE_KEY=tu_supabase_key

# Nombres de tablas (opcional - por defecto usa nombres de producción)
# Para producción:
TABLE_CHAT_HISTORY=chat_history
TABLE_MESSAGES=messages
TABLE_USERS=users

# Para testing:
# TABLE_CHAT_HISTORY=chat_history_test
# TABLE_MESSAGES=messages_test
# TABLE_USERS=users_test
```

### Estructura de Tablas Esperada

#### Tabla `chat_history`

```sql
- id (string) - ID único de la conversación
- client_number (string) - Número de teléfono del cliente
- chat_status (string) - Estado de la conversación ('closed', 'active', etc.)
- notified_no_reply (boolean) - Control notificación ESCENARIO 1
- notified_out_of_hours (boolean) - Control notificación ESCENARIO 2
```

#### Tabla `messages`

```sql
- id (string) - ID único del mensaje
- conversation_id (string) - Referencia a chat_history
- sender (string) - 'client_message' para clientes, cualquier otro valor para asesores
- created_at (timestamp) - Fecha y hora del mensaje
```

## 🛠️ Instalación

### 1. Clonar e instalar dependencias

```bash
git clone <repository-url>
cd fenix-cronjob
npm install
```

### 2. Configurar variables de entorno

```bash
# Crear archivo .env basado en el ejemplo
cp .env.example .env

# Editar .env con tus credenciales
# Para producción, las variables de tabla son opcionales (usa defaults)
# Para testing, descomenta y ajusta los nombres de tabla
```

### 3. Verificar configuración

```bash
npm run dev
```

## 🏃‍♂️ Ejecución

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm start
```

### Usando PM2 (Recomendado para producción)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar con configuración
pm2 start ecosystem.config.cjs

# Ver logs
pm2 logs fenix-cronjob

# Reiniciar
pm2 restart fenix-cronjob

# Detener
pm2 stop fenix-cronjob
```

## 🧪 Testing y Desarrollo

### Configuración de Testing

Para usar tablas de testing, configura tu `.env`:

```env
# Configuración para testing
TABLE_CHAT_HISTORY=chat_history_test
TABLE_MESSAGES=messages_test
TABLE_USERS=users_test
```

### Pruebas ESCENARIO 1 (cada minuto)

En `src/index.ts`, descomenta:

```typescript
schedule.scheduleJob("* * * * *", async () => {
  await executeInHoursJobWithValidation("Test ESCENARIO 1 (cada minuto)");
});
```

### Pruebas ESCENARIO 2 (cada 30 segundos)

En `src/index.ts`, descomenta:

```typescript
schedule.scheduleJob("*/30 * * * * *", async () => {
  await executeOutOfHoursJob("Test ESCENARIO 2 (cada 30 segundos)");
});
```

### Cambio entre Producción y Testing

```bash
# Para producción (usar defaults)
# Comentar o eliminar variables TABLE_* del .env

# Para testing
# Descomentar y ajustar variables TABLE_* en .env

# Reiniciar aplicación después de cambios
npm run dev
```

## 📁 Estructura del Proyecto

```
fenix-cronjob/
├── src/
│   ├── index.ts                              # Punto de entrada y programación de jobs
│   └── utils/
│       ├── checkConversations.ts             # Job original (deprecated)
│       ├── checkNoReplyConversations.ts      # Lógica principal - AMBOS ESCENARIOS
│       ├── checkUserName.ts                  # Búsqueda de nombres de usuario
│       ├── supabase.ts                       # Configuración de Supabase
│       └── timeHelpers.ts                    # Funciones de validación de horario
├── ecosystem.config.cjs                      # Configuración PM2
├── package.json                             # Dependencias y scripts
├── tsconfig.json                            # Configuración TypeScript
└── README.md                                # Esta documentación
```

## 🔄 Flujo de Funcionamiento

### ESCENARIO 1: Conversaciones sin respuesta en horario laboral

#### Ejecución Programada

- **12:30 PM Colombia**: Primer job diario
- **5:30 PM Colombia**: Segundo job diario

#### Lógica de Procesamiento

```typescript
1. Buscar conversaciones con:
   - chat_status != "closed"
   - notified_no_reply = false
2. Para cada conversación:
   - Buscar último mensaje del asesor (sender != 'client_message')
   - Verificar que fue enviado en horario laboral
   - Si han pasado 3+ horas sin respuesta del cliente → Enviar recordatorio
   - Marcar notified_no_reply = true
```

### ESCENARIO 2: Mensajes fuera de horario laboral

#### Ejecución Programada

- **8:00 AM, 10:00 AM, 12:00 PM, 2:00 PM, 4:00 PM, 6:00 PM** (cada 2 horas de 8AM-6PM)

#### Lógica de Procesamiento

```typescript
1. Buscar conversaciones con:
   - notified_out_of_hours = false
2. Para cada conversación:
   - Buscar último mensaje del cliente (sender = 'client_message')
   - Si fue enviado fuera de horario laboral → Enviar mensaje informativo
   - Marcar notified_out_of_hours = true
```

### Horarios Laborales Definidos

- **Lunes a Viernes:** 8:00 AM - 6:00 PM
- **Sábados:** 8:00 AM - 1:00 PM
- **Domingos:** Cerrado

## 🔄 Reseteo de Notificaciones

En tu backend principal, cuando ocurran estos eventos:

### ESCENARIO 1 - Cliente responde:

```sql
UPDATE chat_history
SET notified_no_reply = false
WHERE id = 'conversation_id';
```

### ESCENARIO 2 - Nueva conversación o reseteo manual:

```sql
UPDATE chat_history
SET notified_out_of_hours = false
WHERE id = 'conversation_id';
```

## 📊 Logs del Sistema

### Tipos de Logs

```
🕐 [timestamp] Iniciando ESCENARIO 1...
🌙 [timestamp] Iniciando ESCENARIO 2...
⏸️ Job cancelado por estar fuera de horario laboral
🔍 ESCENARIO 1: Verificando conversaciones sin respuesta...
🌙 ESCENARIO 2: Verificando mensajes fuera de horario...
📋 Encontradas X conversaciones para revisar
📞 Conversación X: Último mensaje del asesor hace X horas
🌙 Enviando mensaje de horarios a...
📧 Enviando recordatorio a...
✅ Template enviado exitosamente
⚠️ No se encontró último mensaje del asesor/cliente
❌ Error en proceso
```

### Monitoreo

```bash
# Ver logs en tiempo real
npm run dev

# Con PM2
pm2 logs fenix-cronjob --lines 100
```

## 🔧 Configuración Avanzada

### Modificar Horarios de Ejecución

En `src/index.ts`:

```typescript
// ESCENARIO 1 - Cambiar horarios (formato cron)
schedule.scheduleJob("30 12 * * *", ...); // 12:30 PM
schedule.scheduleJob("30 17 * * *", ...); // 5:30 PM

// ESCENARIO 2 - Cambiar frecuencia en horario laboral
schedule.scheduleJob("0 8-18/2 * * *", ...); // Cada 2 horas de 8AM-6PM
```

### Ajustar Tiempo de Espera (ESCENARIO 1)

En `src/utils/checkNoReplyConversations.ts`:

```typescript
// Cambiar de 3 horas a X horas
if (timeDiffHours >= 3) { // Modificar este número
```

### Personalizar Horarios Laborales

En `src/utils/checkNoReplyConversations.ts`:

```typescript
const isWithinBusinessHours = (date: moment.Moment): boolean => {
  // Modificar lógica de días y horarios laborales aquí
};
```

## 🚨 Troubleshooting

### Problemas Comunes

#### 1. Error de conexión a Supabase

```bash
# Verificar variables de entorno
echo $SUPABASE_URL
echo $SUPABASE_KEY
```

#### 2. Jobs no se ejecutan

```bash
# Verificar logs de horario
npm run dev
# ESCENARIO 1: Buscar "Job cancelado por estar fuera de horario laboral"
# ESCENARIO 2: Verificar que esté en rango 8AM-6PM
```

#### 3. No se encuentran mensajes

```bash
# Verificar estructura de tabla messages
# ESCENARIO 1: sender != 'client_message' para mensajes del asesor
# ESCENARIO 2: sender = 'client_message' para mensajes del cliente
```

#### 4. Templates no se envían

```bash
# ESCENARIO 1: templateId existente
# ESCENARIO 2: Reemplazar "HORARIOS_TEMPLATE_ID" con ID real
```

### Debug Mode

Para debugging detallado, modifica los logs en:

- `src/utils/checkNoReplyConversations.ts`
- `src/utils/timeHelpers.ts`

## 📦 Dependencias Principales

```json
{
  "node-schedule": "^2.1.1", // Programación de cron jobs
  "moment-timezone": "^0.6.0", // Manejo de zonas horarias
  "@supabase/supabase-js": "^2.43.5", // Cliente Supabase
  "axios": "^1.7.7", // Requests HTTP para templates
  "dotenv": "^16.4.5" // Variables de entorno
}
```

## 🔒 Seguridad

- ✅ Variables de entorno para credenciales sensibles
- ✅ Validación de datos antes de envío
- ✅ Manejo de errores robusto
- ✅ Logs sin información sensible
- ✅ Filtros de estado de conversación

## 📈 Rendimiento

- ⚡ Consultas optimizadas a base de datos
- 🔄 Procesamiento secuencial para evitar sobrecarga
- 📊 Control de duplicados eficiente con flags específicos
- ⏱️ Timeouts configurables
- 🎯 Ejecución solo en horarios necesarios

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request
