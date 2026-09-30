const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const scriptStore = new Map();

app.use(express.json());

app.post('/api/store-script', (req, res) => {
  const { script } = req.body;

  if (!script || script.trim().length === 0) {
    return res.status(400).json({ error: 'Script no proporcionado' });
  }

  const id = crypto.randomBytes(8).toString('hex');

  scriptStore.set(id, {
    script,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    id,
    url: `${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}/script/${id}`,
  });
});

app.get('/script/:id', (req, res) => {
  const { id } = req.params;
  const data = scriptStore.get(id);

  if (!data) {
    return res.status(404).send('-- Script not found');
  }

  if (data.expiresAt < Date.now()) {
    scriptStore.delete(id);
    return res.status(404).send('-- Script expired');
  }

  res.type('text/plain').send(data.script);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'MM2 AutoTrade Bot Server',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

module.exports = app;
