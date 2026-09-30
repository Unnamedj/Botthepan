# 🔗 Configurar Discord Webhook

Un **Discord Webhook** es una URL especial que permite enviar mensajes a un canal desde aplicaciones externas. En este bot, se usa para recibir notificaciones del progreso del script.

## ¿Qué es un Webhook?

Un webhook es simplemente una URL única que apunta a un canal de Discord. Cuando el script Lua se ejecuta, envía notificaciones a ese webhook, que aparecen como mensajes en el canal.

**Ejemplo:**
```
https://discord.com/api/webhooks/123456789/abcdefghijklmnop
```

---

## 📋 Crear un Webhook en Discord

### Opción 1: Crear Webhook en un Canal (Recomendado)

1. En tu servidor Discord, **haz clic derecho en un canal** (ej: `#notificaciones`)
2. Selecciona **Edit Channel**
3. En la barra lateral, ve a **Integrations** → **Webhooks**
4. Haz clic en **New Webhook**
5. Dale un nombre (ej: `MM2 AutoTrade`)
6. Haz clic en **Copy Webhook URL**
7. **Guarda esta URL** - es lo que ingresa el usuario en el bot

**Ejemplo de URL:**
```
https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz-12345
```

---

## 🧪 Probar el Webhook

### Usar cURL (desde terminal)

```bash
curl -X POST "https://tu-webhook-url" \
  -H "Content-Type: application/json" \
  -d '{
    "embeds": [{
      "title": "Test Webhook",
      "description": "¡Si ves esto, el webhook funciona!",
      "color": 3066993
    }]
  }'
```

### Usar PowerShell (Windows)

```powershell
$url = "https://tu-webhook-url"
$data = @{
    embeds = @(@{
        title = "Test Webhook"
        description = "¡Si ves esto, el webhook funciona!"
        color = 3066993
    })
}

$json = $data | ConvertTo-Json -Depth 10
Invoke-WebRequest -Uri $url -Method Post -ContentType "application/json" -Body $json
```

Si el comando se ejecuta sin errores, revisa tu canal de Discord y deberías ver el mensaje.

---

## 📊 Tipos de Notificaciones

El script envía varias notificaciones:

### ✅ Iniciado
```json
{
  "title": "✅ Iniciado",
  "description": "AutoTrade iniciado para claudee\nObjetivo: 25 trades",
  "color": 3066993  // Verde
}
```

### 📊 Progreso
```json
{
  "title": "📊 Progreso",
  "description": "Trades completados: 5/25",
  "color": 2829617  // Azul
}
```

### ✅ Completado
```json
{
  "title": "✅ Completado",
  "description": "AutoTrade finalizó exitosamente.\n**Total:** 25 trades en 150 segundos",
  "color": 3066993  // Verde
}
```

### ❌ Error
```json
{
  "title": "❌ Error",
  "description": "El script se detuvo con error:\n```error message here```",
  "color": 15158332  // Rojo
}
```

---

## 🔐 Seguridad del Webhook

### ✅ Seguro Compartir:
- ✅ El usuario comparte su webhook **voluntariamente**
- ✅ El webhook es específico para ese usuario
- ✅ El webhook no puede modificar otros canales
- ✅ Se puede eliminar o cambiar en cualquier momento

### ⚠️ No Seguro:
- ❌ No compartas webhooks de otros usuarios
- ❌ No uses webhooks públicos para datos sensibles
- ❌ Si se expone, cualquiera puede enviar mensajes al canal

### 🛡️ Si se Expone un Webhook:

1. Ve a tu servidor Discord
2. Edita el canal
3. Ve a **Webhooks**
4. Busca el webhook expuesto
5. Haz clic en los 3 puntos → **Delete**
6. Crea uno nuevo

---

## 📝 Validación en el Bot

El bot valida automáticamente que el webhook es válido:

```javascript
function isValidWebhook(webhook) {
  try {
    const url = new URL(webhook);
    return url.hostname === 'discord.com' && webhook.includes('/webhooks/');
  } catch {
    return false;
  }
}
```

Si el usuario ingresa un webhook inválido, el bot rechazará la solicitud:
```
❌ El webhook URL no es válido. Debe ser una URL de webhook de Discord.
```

---

## 🎯 Ejemplo de Uso

### 1. Usuario ejecuta `/generate script`

### 2. Bot pide Username y Webhook
Usuario ingresa:
- Username: `claudee`
- Webhook: `https://discord.com/api/webhooks/1234567890/xyz`

### 3. Bot valida y genera script

### 4. Script se ejecuta en Roblox

### 5. Notificaciones aparecen en Discord
```
✅ Iniciado - AutoTrade iniciado para claudee
📊 Progreso - Trades completados: 5/25
📊 Progreso - Trades completados: 10/25
✅ Completado - AutoTrade finalizó. Total: 25 trades
```

---

## 🔧 Personalizar Notificaciones

Si quieres cambiar los colores o mensajes de las notificaciones, edita `mm2-script.lua`:

```lua
-- Cambiar color (0-16777215)
-- Rojo: 15158332
-- Verde: 3066993
-- Azul: 2829617
-- Amarillo: 16776960

sendWebhook(
  "Tu Título",
  "Tu Descripción",
  3066993  -- Cambiar el color aquí
)
```

---

## ❓ FAQs

**P: ¿Puedo usar el mismo webhook para varios usuarios?**
R: No se recomienda. Es mejor que cada usuario tenga su propio webhook.

**P: ¿Qué pasa si comparto el webhook?**
R: Otros podrán enviar mensajes a ese canal. Mejor crear uno nuevo.

**P: ¿El webhook expira?**
R: No, pero si lo cambias en Discord, los mensajes dejarán de funcionar.

**P: ¿Puedo ver quién envió un mensaje desde el webhook?**
R: El webhook aparece con el nombre que le diste (ej: "MM2 AutoTrade").

---

**¡Ahora estás listo para usar webhooks! 🚀**
