const express = require('express');
const crypto = require('crypto');
const JavaScriptObfuscator = require('javascript-obfuscator');

const app = express();
const PORT = process.env.PORT || 3000;

// Almacenamiento en memoria de scripts
const scriptStore = new Map();

app.use(express.json());

// Endpoint para almacenar scripts ofuscados
app.post('/api/store-script', (req, res) => {
  const { script } = req.body;

  if (!script || script.trim().length === 0) {
    return res.status(400).json({ error: 'Script no proporcionado' });
  }

  // Ofuscar el script Lua como un string de JavaScript
  const luaStringified = `"${script.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;

  try {
    const obfuscated = JavaScriptObfuscator.obfuscate(luaStringified, {
      compact: true,
      controlFlowFlattening: false,
      unicodeEscapeSequence: false,
    }).getObfuscatedCode();

    // Generar ID único
    const id = crypto.randomBytes(8).toString('hex');

    // Guardar en memoria (expira en 24 horas)
    scriptStore.set(id, {
      obfuscated,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      id,
      url: `${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}/script/${id}`,
    });
  } catch (error) {
    console.error('Obfuscation error:', error);
    res.status(500).json({ error: 'Error al ofuscar el script' });
  }
});

// Endpoint para descargar scripts
app.get('/script/:id', (req, res) => {
  const { id } = req.params;

  const data = scriptStore.get(id);

  if (!data) {
    return res.status(404).json({ error: 'Script no encontrado' });
  }

  // Verificar expiración
  if (data.expiresAt < Date.now()) {
    scriptStore.delete(id);
    return res.status(404).json({ error: 'Script expirado' });
  }

  // Devolver el código para que se ejecute con load()
  res.type('text/plain').send(data.obfuscated);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'MM2 AutoTrade Bot Server',
    timestamp: new Date().toISOString(),
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
