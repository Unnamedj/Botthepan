const axios = require('axios');

require('./server.js');

setTimeout(() => {
  require('./bot.js');
}, 1000);

// Autoping cada 10 minutos para mantener Render despierto
const SELF_URL = process.env.RENDER_EXTERNAL_URL;
if (SELF_URL) {
  setInterval(async () => {
    try {
      await axios.get(`${SELF_URL}/health`);
      console.log('🔄 Autoping OK');
    } catch {
      console.warn('⚠️ Autoping falló');
    }
  }, 5 * 60 * 1000);
}
