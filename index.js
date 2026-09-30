// Iniciar el servidor HTTP primero
require('./server.js');

// Esperar 1 segundo para que el servidor se inicie
setTimeout(() => {
  // Luego iniciar el bot Discord
  require('./bot.js');
}, 1000);
