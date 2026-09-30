-- ╔════════════════════════════════════════════════════════════════╗
-- ║          MM2 AUTOTRADE BOT - SCRIPT TEMPLATE                   ║
-- ║     Este script se ofusca y comprime automáticamente           ║
-- ╚════════════════════════════════════════════════════════════════╝

-- ============ CONFIGURACIÓN ============
local TARGET_USER = "example"
local WEBHOOK_URL = "example"
local MAX_ROUNDS = 25
local DELAY_BETWEEN_TRADES = 2
-- =======================================

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local LocalPlayer = Players.LocalPlayer
local Character = LocalPlayer.Character or LocalPlayer.CharacterAdded:Wait()

-- Estado del script
local ScriptState = {
  active = true,
  trades_completed = 0,
  started_at = os.time(),
  errors = 0,
}

-- Función para enviar notificaciones por webhook
local function sendWebhook(title, description, color)
  local success, result = pcall(function()
    local HttpService = game:GetService("HttpService")
    local data = {
      embeds = {{
        title = title,
        description = description,
        color = color,
        timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ"),
        footer = { text = "MM2 AutoTrade Bot" }
      }},
    }
    HttpService:PostAsync(WEBHOOK_URL, HttpService:JSONEncode(data), Enum.HttpContentType.ApplicationJson)
  end)

  if not success then
    warn("Error enviando webhook:", result)
  end
end

-- Iniciar notificación
sendWebhook(
  "✅ Iniciado",
  string.format("AutoTrade iniciado para **%s**\nObjetivo: %d trades", TARGET_USER, MAX_ROUNDS),
  3066993
)

print("[MM2 AutoTrade] Script iniciado para: " .. TARGET_USER)
print("[MM2 AutoTrade] Webhook: " .. WEBHOOK_URL)

-- Esperar a que el jugador esté en el juego
wait(2)

-- Loop principal de AutoTrade
local function autoTrade()
  for i = 1, MAX_ROUNDS do
    if not ScriptState.active then break end

    -- Aquí iría la lógica de trading
    -- Este es un template, la lógica real de MM2 va aquí
    ScriptState.trades_completed = i

    -- Enviar actualización cada 5 trades
    if i % 5 == 0 then
      sendWebhook(
        "📊 Progreso",
        string.format("Trades completados: **%d/%d**", i, MAX_ROUNDS),
        2829617
      )
      print(string.format("[MM2 AutoTrade] Progreso: %d/%d trades", i, MAX_ROUNDS))
    end

    wait(DELAY_BETWEEN_TRADES)
  end
end

-- Ejecutar trading
local success, error = pcall(autoTrade)

if success then
  sendWebhook(
    "✅ Completado",
    string.format("AutoTrade finalizó exitosamente.\n**Total:** %d trades en %.0f segundos",
      ScriptState.trades_completed,
      os.time() - ScriptState.started_at),
    3066993
  )
  print("[MM2 AutoTrade] ¡Trading completado!")
else
  ScriptState.active = false
  sendWebhook(
    "❌ Error",
    string.format("El script se detuvo con error:\n```%s```", tostring(error)),
    15158332
  )
  warn("[MM2 AutoTrade] Error:", error)
end

-- Limpiar
ScriptState.active = false
print("[MM2 AutoTrade] Script finalizado")
