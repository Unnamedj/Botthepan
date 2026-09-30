# ☁️ Setup Cloudflare - Paso a Paso

## 1. Registrarse en Cloudflare

1. Ve a https://dash.cloudflare.com
2. Haz clic en **"Sign up"**
3. Usa tu email (cualquiera funciona)
4. Crea contraseña
5. Verifica tu email

---

## 2. Agregar un Dominio (Gratis)

**Opción A: Dominio gratis (recomendado para empezar)**

1. En el dashboard, haz clic en **"+ Add a site"**
2. Ingresa un dominio gratis: `tunombre.workers.dev`
3. Selecciona plan **Free**
4. Haz clic en **"Continue"**

**Opción B: Usar tu propio dominio**

1. Haz clic en **"+ Add a site"**
2. Ingresa tu dominio (ej: `ejemplo.com`)
3. Sigue los pasos de verificación DNS
4. (Más complicado, pero funciona igual)

---

## 3. Crear el Cloudflare Worker

1. En el dashboard, ve a **Workers & Pages** (en la barra lateral)
2. Haz clic en **"Create Application"**
3. Selecciona **"Create Worker"**
4. Nombre: `mm2-script-decoder`
5. Haz clic en **"Deploy"**

**Verás una URL como:**
```
https://mm2-script-decoder.tu-dominio.workers.dev
```

---

## 4. Editar el Código del Worker

1. En la página del Worker, haz clic en **"Edit code"**
2. En el editor, selecciona TODO el código (Ctrl+A)
3. Borra todo
4. Copia TODO el contenido de `cloudflare-worker.js` de este proyecto
5. Pégalo en el editor
6. Haz clic en **"Save and Deploy"** (esquina superior derecha)

---

## 5. Configurar KV Storage (Base de Datos)

El Worker necesita un lugar para guardar tus scripts.

### 5.1 Crear el Namespace

1. En el dashboard de Cloudflare, ve a **"Workers"** → **"KV"** (sidebar izquierdo)
2. Haz clic en **"Create a namespace"**
3. Nombre: `SCRIPTS` (exactamente así, MAYÚSCULAS)
4. Haz clic en **"Create"**

### 5.2 Vincular al Worker

1. Regresa a tu Worker: https://dash.cloudflare.com/workers-and-pages/create/worker
2. Haz clic en el nombre de tu Worker (`mm2-script-decoder`)
3. Ve a **"Settings"** (en la parte superior)
4. En la sección **"Bindings"**, haz clic en **"Add Binding"**
5. Configura así:
   - **Variable Name**: `SCRIPTS`
   - **Type**: `KV Namespace`
   - **Namespace**: Selecciona `SCRIPTS` de la lista
6. Haz clic en **"Save and Deploy"**

---

## 6. Agregar la Librería Pako (Para Descompresión)

Tu Worker necesita `pako` para descomprimir los scripts.

1. Abre el editor de tu Worker
2. En la **PRIMERA LÍNEA** (antes de `export default`), agrega:

```javascript
import pako from 'https://cdn.jsdelivr.net/npm/pako@2/dist/pako.es5.min.js';
```

Debería verse así:

```javascript
import pako from 'https://cdn.jsdelivr.net/npm/pako@2/dist/pako.es5.min.js';

export default {
  async fetch(request, env) {
    // ... resto del código
  }
};
```

3. Haz clic en **"Save and Deploy"**

---

## 7. Testear que Funciona

1. Abre en tu navegador:
   ```
   https://mm2-script-decoder.tu-dominio.workers.dev/
   ```

2. Deberías ver una respuesta JSON como:
   ```json
   {
     "status": "online",
     "service": "MM2 Script Decoder",
     "version": "1.0.0"
   }
   ```

Si ves esto, ¡Cloudflare está listo! ✅

---

## 8. Actualizar tu .env

Copia la URL de tu Worker en el archivo `.env`:

```
DISCORD_TOKEN=YOUR_TOKEN
CLOUDFLARE_WORKER_URL=https://mm2-script-decoder.tu-dominio.workers.dev
```

---

## 🔧 Troubleshooting

### ❌ "404 Not Found"
- Espera 2-3 minutos después de Deploy
- Recarga la página
- Verifica que copiaste la URL correcta

### ❌ "Worker error"
- Revisa que pako esté importado en la PRIMERA línea
- Verifica que SCRIPTS KV está vinculado
- Revisa los logs en **"Logs"** tab del Worker

### ❌ "Script no encontrado"
- Verifica que el ID es válido (hexadecimales)
- Comprueba que fue guardado en KV (revisar dashboard de KV)

---

## ✅ ¡Listo!

Tu Cloudflare Worker está funcionando y listo para recibir y servir scripts ofuscados. 🚀
