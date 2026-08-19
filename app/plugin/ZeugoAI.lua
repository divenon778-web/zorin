local HttpService  = game:GetService("HttpService")
local TweenService = game:GetService("TweenService")

local BASE_URL            = "https://zeugoai.vercel.app"
local LINK_URL            = BASE_URL .. "/api/plugin/link"
local POLL_URL            = BASE_URL .. "/api/plugin/poll"
local PROJECTS_URL        = BASE_URL .. "/api/plugin/projects"
local PROJECT_DATA_URL    = BASE_URL .. "/api/plugin/project/latest"
local HEARTBEAT_URL       = BASE_URL .. "/api/plugin/heartbeat"
local GAME_MODEL_URL      = BASE_URL .. "/api/plugin/game-model"
local SET_ROBLOX_USER_URL = BASE_URL .. "/api/plugin/set-roblox-user"

local TOKEN_KEY = "Zeugo_Token"
local USER_KEY  = "Zeugo_User"

local POLL_INTERVAL      = 10
local HEARTBEAT_INTERVAL = 15
local AUTOSCAN_INTERVAL  = 10
local LINK_TTL_SECONDS   = 60 * 30  -- 30 minutes

local ICONS = {
	logo = "rbxassetid://101012686637127",
}

local C = {
	bg        = Color3.fromRGB(10, 10, 10),
	panel     = Color3.fromRGB(17, 17, 17),
	panel2    = Color3.fromRGB(26, 26, 26),
	panel3    = Color3.fromRGB(34, 34, 34),
	panel4    = Color3.fromRGB(42, 42, 42),
	border    = Color3.fromRGB(36, 36, 36),
	borderStr = Color3.fromRGB(50, 50, 50),
	text      = Color3.fromRGB(240, 240, 240),
	subtext   = Color3.fromRGB(144, 144, 144),
	muted     = Color3.fromRGB(84, 84, 84),
	accent    = Color3.fromRGB(255, 255, 255),
	accent2   = Color3.fromRGB(200, 200, 200),
	green     = Color3.fromRGB(80, 165, 110),
	red       = Color3.fromRGB(185, 80, 80),
	redDark   = Color3.fromRGB(40, 18, 18),
	amber     = Color3.fromRGB(251, 191, 36),
	blue      = Color3.fromRGB(80, 140, 220),
	blueDark  = Color3.fromRGB(18, 28, 50),
	white     = Color3.fromRGB(255, 255, 255),
}

local SETTINGS = {
	autoInsert   = true,
	showWarnings = true,
}

local SCAN_TARGETS = {
	workspace,
	game:GetService("Players"),
	game:GetService("Lighting"),
	game:GetService("ReplicatedFirst"),
	game:GetService("ReplicatedStorage"),
	game:GetService("ServerScriptService"),
	game:GetService("ServerStorage"),
	game:GetService("StarterGui"),
	game:GetService("StarterPack"),
	game:GetService("StarterPlayer"),
}

local toolbar   = plugin:CreateToolbar("Zeugo")
local toggleBtn = toolbar:CreateButton("Zeugo", "Open Zeugo", ICONS.logo)

local widgetInfo = DockWidgetPluginGuiInfo.new(
	Enum.InitialDockState.Right, true, true, 620, 700, 460, 560
)
local widget       = plugin:CreateDockWidgetPluginGui("ZeugoWidgetV4", widgetInfo)
widget.Title       = "Zeugo"
widget.Enabled     = false

local function tween(obj, info, props)
	local t = TweenService:Create(obj, info, props); t:Play(); return t
end
local function corner(parent, radius)
	local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(0, radius or 8); c.Parent = parent; return c
end
local function stroke(parent, color, thickness, transparency)
	local s = Instance.new("UIStroke")
	s.Color = color or C.border; s.Thickness = thickness or 1; s.Transparency = transparency or 0; s.Parent = parent; return s
end
local function animatePress(button, hoverColor)
	local originalSize  = button.Size
	local originalColor = button.BackgroundColor3
	local targetHover   = hoverColor or originalColor:Lerp(Color3.new(1,1,1), 0.06)
	button.MouseEnter:Connect(function()
		tween(button, TweenInfo.new(0.12, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { BackgroundColor3 = targetHover })
	end)
	button.MouseLeave:Connect(function()
		tween(button, TweenInfo.new(0.12, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { BackgroundColor3 = originalColor, Size = originalSize })
	end)
	button.MouseButton1Down:Connect(function()
		tween(button, TweenInfo.new(0.08, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Size = UDim2.new(originalSize.X.Scale, originalSize.X.Offset, originalSize.Y.Scale, originalSize.Y.Offset - 1)
		})
	end)
	button.MouseButton1Up:Connect(function()
		tween(button, TweenInfo.new(0.08, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Size = originalSize })
	end)
end
local function makeTextButton(parent, text, bgColor, textColor)
	local btn = Instance.new("TextButton")
	btn.Parent = parent; btn.BackgroundColor3 = bgColor; btn.BorderSizePixel = 0
	btn.Text = text; btn.TextColor3 = textColor; btn.TextSize = 11; btn.TextWrapped = true
	btn.Font = Enum.Font.GothamBold; corner(btn, 8); return btn
end

local root = Instance.new("Frame")
root.Name = "ZeugoRoot"; root.Parent = widget; root.BackgroundColor3 = C.bg
root.BorderSizePixel = 0; root.Size = UDim2.fromScale(1, 1)

local Topbar = Instance.new("Frame")
Topbar.Parent = root; Topbar.BackgroundColor3 = C.panel; Topbar.BorderSizePixel = 0
Topbar.Position = UDim2.new(0.008, 0, 0.007, 0); Topbar.Size = UDim2.new(0.984, 0, 0.075, 0)
corner(Topbar, 10); stroke(Topbar, C.border)

local LogoWrap = Instance.new("Frame")
LogoWrap.Parent = Topbar; LogoWrap.BackgroundColor3 = C.panel2; LogoWrap.BorderSizePixel = 0
LogoWrap.Position = UDim2.new(0.016, 0, 0.18, 0); LogoWrap.Size = UDim2.new(0.05, 0, 0.64, 0)
corner(LogoWrap, 8); stroke(LogoWrap, C.border)

local Logo = Instance.new("ImageLabel")
Logo.Parent = LogoWrap; Logo.BackgroundTransparency = 1
Logo.Position = UDim2.new(0.12, 0, 0.12, 0); Logo.Size = UDim2.new(0.76, 0, 0.76, 0)
Logo.Image = ICONS.logo; Logo.ScaleType = Enum.ScaleType.Fit

local BrandTitle = Instance.new("TextLabel")
BrandTitle.Parent = Topbar; BrandTitle.BackgroundTransparency = 1
BrandTitle.Position = UDim2.new(0.078, 0, 0.18, 0); BrandTitle.Size = UDim2.new(0.13, 0, 0.64, 0)
BrandTitle.Font = Enum.Font.GothamBold; BrandTitle.Text = "Zeugo"; BrandTitle.TextColor3 = C.text
BrandTitle.TextSize = 14; BrandTitle.TextWrapped = true
BrandTitle.TextXAlignment = Enum.TextXAlignment.Left; BrandTitle.TextYAlignment = Enum.TextYAlignment.Center

local ProjectPickerBtn = Instance.new("TextButton")
ProjectPickerBtn.Parent = Topbar; ProjectPickerBtn.BackgroundColor3 = C.panel2
ProjectPickerBtn.BorderSizePixel = 0; ProjectPickerBtn.Position = UDim2.new(0.215, 0, 0.18, 0)
ProjectPickerBtn.Size = UDim2.new(0.30, 0, 0.64, 0); ProjectPickerBtn.Text = "No project selected"
ProjectPickerBtn.TextColor3 = C.text; ProjectPickerBtn.TextSize = 11; ProjectPickerBtn.Font = Enum.Font.GothamBold
ProjectPickerBtn.TextWrapped = false; ProjectPickerBtn.TextXAlignment = Enum.TextXAlignment.Left
corner(ProjectPickerBtn, 8); stroke(ProjectPickerBtn, C.border); animatePress(ProjectPickerBtn, C.panel3)

local ProjectPickerPadding = Instance.new("UIPadding")
ProjectPickerPadding.Parent = ProjectPickerBtn
ProjectPickerPadding.PaddingLeft = UDim.new(0, 10); ProjectPickerPadding.PaddingRight = UDim.new(0, 28)

local PickerChevron = Instance.new("TextLabel")
PickerChevron.Parent = ProjectPickerBtn; PickerChevron.BackgroundTransparency = 1
PickerChevron.Position = UDim2.new(1, -22, 0, 0); PickerChevron.Size = UDim2.new(0, 18, 1, 0)
PickerChevron.Font = Enum.Font.Code; PickerChevron.Text = "▼"; PickerChevron.TextColor3 = C.subtext
PickerChevron.TextSize = 10

local RefreshBtn = makeTextButton(Topbar, "Refresh", C.panel2, C.text)
RefreshBtn.Position = UDim2.new(0.616, 0, 0.18, 0); RefreshBtn.Size = UDim2.new(0.09, 0, 0.64, 0)
stroke(RefreshBtn, C.border)

local DashboardBtn = makeTextButton(Topbar, "Dashboard", C.panel2, C.text)
DashboardBtn.Position = UDim2.new(0.712, 0, 0.18, 0); DashboardBtn.Size = UDim2.new(0.115, 0, 0.64, 0)
stroke(DashboardBtn, C.border)

local DisconnectBtn = makeTextButton(Topbar, "Disconnect", C.redDark, C.text)
DisconnectBtn.Position = UDim2.new(0.834, 0, 0.18, 0); DisconnectBtn.Size = UDim2.new(0.09, 0, 0.64, 0)
stroke(DisconnectBtn, C.red)

animatePress(RefreshBtn, C.panel3); animatePress(DashboardBtn, C.panel3)
animatePress(DisconnectBtn, Color3.fromRGB(58, 22, 22))

local Body = Instance.new("Frame")
Body.Parent = root; Body.BackgroundTransparency = 1
Body.Position = UDim2.new(0.008, 0, 0.092, 0); Body.Size = UDim2.new(0.984, 0, 0.901, 0)

local ProjectDropdown = Instance.new("Frame")
ProjectDropdown.Parent = root; ProjectDropdown.BackgroundColor3 = C.panel; ProjectDropdown.BorderSizePixel = 0
ProjectDropdown.Position = UDim2.new(0.223, 0, 0.084, 0); ProjectDropdown.Size = UDim2.new(0.30, 0, 0, 0)
ProjectDropdown.ClipsDescendants = true; ProjectDropdown.Visible = false; ProjectDropdown.ZIndex = 10
corner(ProjectDropdown, 10); stroke(ProjectDropdown, C.border)

local ProjectDropdownInner = Instance.new("Frame")
ProjectDropdownInner.Parent = ProjectDropdown; ProjectDropdownInner.BackgroundTransparency = 1
ProjectDropdownInner.Size = UDim2.new(1, 0, 1, 0); ProjectDropdownInner.ZIndex = 10

local ProjectDropdownHeader = Instance.new("TextLabel")
ProjectDropdownHeader.Parent = ProjectDropdownInner; ProjectDropdownHeader.BackgroundTransparency = 1
ProjectDropdownHeader.Position = UDim2.new(0, 10, 0, 8); ProjectDropdownHeader.Size = UDim2.new(1, -20, 0, 16)
ProjectDropdownHeader.Font = Enum.Font.Code; ProjectDropdownHeader.Text = "YOUR PROJECTS"
ProjectDropdownHeader.TextColor3 = C.muted; ProjectDropdownHeader.TextSize = 9
ProjectDropdownHeader.TextXAlignment = Enum.TextXAlignment.Left; ProjectDropdownHeader.ZIndex = 11

local ProjectList = Instance.new("ScrollingFrame")
ProjectList.Parent = ProjectDropdownInner; ProjectList.BackgroundTransparency = 1
ProjectList.BorderSizePixel = 0; ProjectList.Position = UDim2.new(0, 8, 0, 28)
ProjectList.Size = UDim2.new(1, -16, 1, -36); ProjectList.CanvasSize = UDim2.new(0, 0, 0, 0)
ProjectList.AutomaticCanvasSize = Enum.AutomaticSize.Y; ProjectList.ScrollBarThickness = 3
ProjectList.ScrollBarImageColor3 = C.panel4; ProjectList.ZIndex = 11

local ProjectListLayout = Instance.new("UIListLayout")
ProjectListLayout.Parent = ProjectList; ProjectListLayout.SortOrder = Enum.SortOrder.LayoutOrder
ProjectListLayout.Padding = UDim.new(0, 4)

local Hero = Instance.new("Frame")
Hero.Parent = Body; Hero.BackgroundColor3 = C.panel; Hero.BorderSizePixel = 0
Hero.Size = UDim2.new(1, 0, 0, 80); Hero.LayoutOrder = 1
corner(Hero, 10); stroke(Hero, C.border)

local StateTitle = Instance.new("TextLabel")
StateTitle.Parent = Hero; StateTitle.BackgroundTransparency = 1
StateTitle.Position = UDim2.new(0.025, 0, 0.16, 0); StateTitle.Size = UDim2.new(0.55, 0, 0, 22)
StateTitle.Font = Enum.Font.GothamBold; StateTitle.Text = "Not connected"
StateTitle.TextColor3 = C.text; StateTitle.TextSize = 16; StateTitle.TextXAlignment = Enum.TextXAlignment.Left

local StateSub = Instance.new("TextLabel")
StateSub.Parent = Hero; StateSub.BackgroundTransparency = 1
StateSub.Position = UDim2.new(0.025, 0, 0.5, 0); StateSub.Size = UDim2.new(0.75, 0, 0, 16)
StateSub.Font = Enum.Font.Gotham
StateSub.Text = "Connect to browse your projects and insert generated output."
StateSub.TextColor3 = C.subtext; StateSub.TextSize = 11; StateSub.TextWrapped = true
StateSub.TextXAlignment = Enum.TextXAlignment.Left; StateSub.TextYAlignment = Enum.TextYAlignment.Top

local StatusPill = Instance.new("TextLabel")
StatusPill.Parent = Hero; StatusPill.BackgroundColor3 = C.panel2; StatusPill.BorderSizePixel = 0
StatusPill.Position = UDim2.new(0.77, 0, 0.24, 0); StatusPill.Size = UDim2.new(0.2, 0, 0.44, 0)
StatusPill.Font = Enum.Font.Code; StatusPill.Text = "Idle"; StatusPill.TextColor3 = C.muted
StatusPill.TextSize = 10
corner(StatusPill, 999); stroke(StatusPill, C.border)

local GameModelBar = Instance.new("Frame")
GameModelBar.Parent = Body; GameModelBar.BackgroundColor3 = C.panel; GameModelBar.BorderSizePixel = 0
GameModelBar.Position = UDim2.new(0, 0, 0, 90); GameModelBar.Size = UDim2.new(1, 0, 0, 30)
corner(GameModelBar, 8); stroke(GameModelBar, C.border)

local GameModelIcon = Instance.new("TextLabel")
GameModelIcon.Parent = GameModelBar; GameModelIcon.BackgroundTransparency = 1
GameModelIcon.Position = UDim2.new(0.015, 0, 0, 0); GameModelIcon.Size = UDim2.new(0, 20, 1, 0)
GameModelIcon.Font = Enum.Font.Code; GameModelIcon.Text = "◈"; GameModelIcon.TextColor3 = C.muted
GameModelIcon.TextSize = 12

local GameModelLabel = Instance.new("TextLabel")
GameModelLabel.Parent = GameModelBar; GameModelLabel.BackgroundTransparency = 1
GameModelLabel.Position = UDim2.new(0.06, 0, 0, 0); GameModelLabel.Size = UDim2.new(0.6, 0, 1, 0)
GameModelLabel.Font = Enum.Font.Gotham; GameModelLabel.Text = "Auto-scanning on connect..."
GameModelLabel.TextColor3 = C.muted; GameModelLabel.TextSize = 10; GameModelLabel.TextWrapped = false
GameModelLabel.TextXAlignment = Enum.TextXAlignment.Left

local Meta = Instance.new("Frame")
Meta.Parent = Body; Meta.BackgroundColor3 = C.panel; Meta.BorderSizePixel = 0
Meta.Position = UDim2.new(0, 0, 0, 130); Meta.Size = UDim2.new(1, 0, 0, 62)
corner(Meta, 10); stroke(Meta, C.border)

local ProjectNameLabel = Instance.new("TextLabel")
ProjectNameLabel.Parent = Meta; ProjectNameLabel.BackgroundTransparency = 1
ProjectNameLabel.Position = UDim2.new(0.025, 0, 0.16, 0); ProjectNameLabel.Size = UDim2.new(0.7, 0, 0, 18)
ProjectNameLabel.Font = Enum.Font.GothamBold; ProjectNameLabel.Text = "No project selected"
ProjectNameLabel.TextColor3 = C.text; ProjectNameLabel.TextSize = 14
ProjectNameLabel.TextXAlignment = Enum.TextXAlignment.Left

local PollTimerLabel = Instance.new("TextLabel")
PollTimerLabel.Parent = Meta; PollTimerLabel.BackgroundTransparency = 1
PollTimerLabel.Position = UDim2.new(0.73, 0, 0.16, 0); PollTimerLabel.Size = UDim2.new(0.24, 0, 0, 14)
PollTimerLabel.Font = Enum.Font.Code; PollTimerLabel.Text = ""; PollTimerLabel.TextColor3 = C.muted
PollTimerLabel.TextSize = 9; PollTimerLabel.TextXAlignment = Enum.TextXAlignment.Right

local ProjectMetaLabel = Instance.new("TextLabel")
ProjectMetaLabel.Parent = Meta; ProjectMetaLabel.BackgroundTransparency = 1
ProjectMetaLabel.Position = UDim2.new(0.025, 0, 0.53, 0); ProjectMetaLabel.Size = UDim2.new(0.9, 0, 0, 14)
ProjectMetaLabel.Font = Enum.Font.Code
ProjectMetaLabel.Text = "Generate from the dashboard, then insert here."
ProjectMetaLabel.TextColor3 = C.subtext; ProjectMetaLabel.TextSize = 10
ProjectMetaLabel.TextXAlignment = Enum.TextXAlignment.Left

local Output = Instance.new("Frame")
Output.Parent = Body; Output.BackgroundColor3 = C.panel; Output.BorderSizePixel = 0
Output.Position = UDim2.new(0, 0, 0, 202); Output.Size = UDim2.new(1, 0, 1, -202)
corner(Output, 10); stroke(Output, C.border)

local OutputHeader = Instance.new("TextLabel")
OutputHeader.Parent = Output; OutputHeader.BackgroundTransparency = 1
OutputHeader.Position = UDim2.new(0.02, 0, 0.02, 0); OutputHeader.Size = UDim2.new(0.6, 0, 0, 14)
OutputHeader.Font = Enum.Font.Code; OutputHeader.Text = "LATEST OUTPUT"
OutputHeader.TextColor3 = C.muted; OutputHeader.TextSize = 9; OutputHeader.TextXAlignment = Enum.TextXAlignment.Left

local OutputScroll = Instance.new("ScrollingFrame")
OutputScroll.Parent = Output; OutputScroll.BackgroundTransparency = 1; OutputScroll.BorderSizePixel = 0
OutputScroll.Position = UDim2.new(0.02, 0, 0.06, 0); OutputScroll.Size = UDim2.new(0.96, 0, 0.92, 0)
OutputScroll.CanvasSize = UDim2.new(0, 0, 0, 0); OutputScroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
OutputScroll.ScrollBarThickness = 3; OutputScroll.ScrollBarImageColor3 = C.panel4

local OutputLayout = Instance.new("UIListLayout")
OutputLayout.Parent = OutputScroll; OutputLayout.SortOrder = Enum.SortOrder.LayoutOrder
OutputLayout.Padding = UDim.new(0, 6)

local LoginOverlay = Instance.new("Frame")
LoginOverlay.Parent = Body; LoginOverlay.BackgroundColor3 = Color3.fromRGB(0,0,0)
LoginOverlay.BackgroundTransparency = 0.3; LoginOverlay.BorderSizePixel = 0
LoginOverlay.Size = UDim2.fromScale(1, 1); LoginOverlay.ZIndex = 20; corner(LoginOverlay, 10)

local LoginCard = Instance.new("Frame")
LoginCard.Parent = LoginOverlay; LoginCard.AnchorPoint = Vector2.new(0.5, 0.5)
LoginCard.Position = UDim2.fromScale(0.5, 0.47); LoginCard.Size = UDim2.new(0.54, 0, 0, 228)
LoginCard.BackgroundColor3 = C.panel; LoginCard.BorderSizePixel = 0; LoginCard.ZIndex = 21
corner(LoginCard, 12); stroke(LoginCard, C.borderStr, 1)

local LoginTitle = Instance.new("TextLabel")
LoginTitle.Parent = LoginCard; LoginTitle.BackgroundTransparency = 1
LoginTitle.Position = UDim2.new(0, 18, 0, 20); LoginTitle.Size = UDim2.new(1, -36, 0, 24)
LoginTitle.Font = Enum.Font.GothamBold; LoginTitle.Text = "Connect your account"
LoginTitle.TextColor3 = C.text; LoginTitle.TextSize = 17
LoginTitle.TextXAlignment = Enum.TextXAlignment.Left; LoginTitle.ZIndex = 22

local LoginSub = Instance.new("TextLabel")
LoginSub.Parent = LoginCard; LoginSub.BackgroundTransparency = 1
LoginSub.Position = UDim2.new(0, 18, 0, 54); LoginSub.Size = UDim2.new(1, -36, 0, 44)
LoginSub.Font = Enum.Font.Gotham
LoginSub.Text = "Open the dashboard sign-in link, authorize your account, then come back here."
LoginSub.TextColor3 = C.subtext; LoginSub.TextSize = 11; LoginSub.TextWrapped = true
LoginSub.TextXAlignment = Enum.TextXAlignment.Left; LoginSub.TextYAlignment = Enum.TextYAlignment.Top
LoginSub.ZIndex = 22

local LoginStatus = Instance.new("TextLabel")
LoginStatus.Parent = LoginCard; LoginStatus.BackgroundTransparency = 1
LoginStatus.Position = UDim2.new(0, 18, 0, 108); LoginStatus.Size = UDim2.new(1, -36, 0, 14)
LoginStatus.Font = Enum.Font.Code; LoginStatus.Text = "Not connected"
LoginStatus.TextColor3 = C.muted; LoginStatus.TextSize = 10
LoginStatus.TextXAlignment = Enum.TextXAlignment.Left; LoginStatus.ZIndex = 22

local LoginConnectBtn = makeTextButton(LoginCard, "Connect", C.accent, Color3.fromRGB(10,10,10))
LoginConnectBtn.Position = UDim2.new(0, 18, 1, -64); LoginConnectBtn.Size = UDim2.new(0.44, 0, 0, 36)
LoginConnectBtn.ZIndex = 22; animatePress(LoginConnectBtn, C.accent2)

local LoginDashboardBtn = makeTextButton(LoginCard, "Open Dashboard", C.panel2, C.text)
LoginDashboardBtn.Position = UDim2.new(0.52, 0, 1, -64); LoginDashboardBtn.Size = UDim2.new(0.4, 0, 0, 36)
LoginDashboardBtn.ZIndex = 22; stroke(LoginDashboardBtn, C.border); animatePress(LoginDashboardBtn, C.panel3)

local savedToken = plugin:GetSetting(TOKEN_KEY) or ""
local savedUser  = plugin:GetSetting(USER_KEY)  or ""

local pollThread          = nil
local autoCheckThread     = nil
local heartbeatThread     = nil
local autoScanThread      = nil
local latestProjectData   = nil
local selectedProject     = nil
local projectButtons      = {}
local dropdownOpen        = false
local pollCountdown       = POLL_INTERVAL
local insertedIds = {}
local isScanningGame      = false

local function getGameIds()
	local placeId    = tostring(game.PlaceId or 0)
	local universeId = tostring(game.GameId  or 0)
	return placeId, universeId
end

local function makeThumbnailUrl(universeId)
	if not universeId or universeId == "0" then return nil end
	return "https://thumbnails.roblox.com/v1/games/icons?universeIds="
		.. universeId
		.. "&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false"
end

local function setStatus(text, color)
	local labelText = text or ""
	StatusPill.Text        = labelText == "" and "Idle" or labelText
	StatusPill.TextColor3  = color or C.muted
	LoginStatus.Text       = labelText == "" and "Not connected" or labelText
	LoginStatus.TextColor3 = color or C.muted
end

local function setProjectPickerText(text)
	ProjectPickerBtn.Text = text or "No project selected"
end

local function setProjectMenuOpen(open)
	dropdownOpen = open
	if open then
		ProjectDropdown.Visible = true
		PickerChevron.Text      = "▲"
		tween(ProjectDropdown, TweenInfo.new(0.18, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Size = UDim2.new(0.30, 0, 0, 210),
		})
	else
		PickerChevron.Text = "▼"
		local t = tween(ProjectDropdown, TweenInfo.new(0.16, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Size = UDim2.new(0.30, 0, 0, 0),
		})
		t.Completed:Once(function()
			if not dropdownOpen then ProjectDropdown.Visible = false end
		end)
	end
end

local function clearProjectList()
	for _, child in ipairs(ProjectList:GetChildren()) do
		if child:IsA("GuiObject") then child:Destroy() end
	end
	ProjectListLayout.Parent = ProjectList
	projectButtons = {}
end

local function clearOutput()
	for _, child in ipairs(OutputScroll:GetChildren()) do
		if child:IsA("GuiObject") then child:Destroy() end
	end
	OutputLayout.Parent = OutputScroll
end

local function addEmptyOutput(text)
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1; label.Size = UDim2.new(1, 0, 0, 18)
	label.Font = Enum.Font.Gotham; label.Text = text; label.TextColor3 = C.muted
	label.TextSize = 11; label.TextWrapped = true
	label.TextXAlignment = Enum.TextXAlignment.Left; label.TextYAlignment = Enum.TextYAlignment.Top
	label.Parent = OutputScroll
end

local function addOutputBlock(
	titleText,
	bodyText,
	titleColor,
	bodyColor,
	bodyFont,
	tagText,
	tagColor,
	bodySize
)
	local card = Instance.new("Frame")
	card.BackgroundColor3 = C.panel2; card.BorderSizePixel = 0
	card.Size = UDim2.new(1, 0, 0, 46); card.AutomaticSize = Enum.AutomaticSize.Y
	card.Parent = OutputScroll; corner(card, 8); stroke(card, C.border)
	local pad = Instance.new("UIPadding")
	pad.Parent = card; pad.PaddingLeft = UDim.new(0,10); pad.PaddingRight = UDim.new(0,10)
	pad.PaddingTop = UDim.new(0,8); pad.PaddingBottom = UDim.new(0,8)
	local title = Instance.new("TextLabel")
	title.BackgroundTransparency = 1; title.Size = UDim2.new(1, tagText and -52 or 0, 0, 14)
	title.Font = Enum.Font.GothamBold; title.Text = titleText; title.TextColor3 = titleColor or C.text
	title.TextSize = 12; title.TextWrapped = true
	title.TextXAlignment = Enum.TextXAlignment.Left; title.TextYAlignment = Enum.TextYAlignment.Top
	title.AutomaticSize = Enum.AutomaticSize.Y; title.Parent = card
	if tagText then
		local tag = Instance.new("TextLabel")
		tag.Parent = card; tag.BackgroundColor3 = tagColor or C.panel3; tag.BorderSizePixel = 0
		tag.Position = UDim2.new(1,-48,0,0); tag.Size = UDim2.new(0,44,0,14)
		tag.Font = Enum.Font.Code; tag.Text = tagText; tag.TextColor3 = tagColor and C.bg or C.muted
		tag.TextSize = 9; corner(tag, 4)
	end
	local body = Instance.new("TextLabel")
	body.BackgroundTransparency = 1; body.Position = UDim2.new(0,0,0,18)
	body.Size = UDim2.new(1,0,0,14); body.AutomaticSize = Enum.AutomaticSize.Y
	body.Font = bodyFont or Enum.Font.Code; body.Text = bodyText; body.TextColor3 = bodyColor or C.subtext
	body.TextSize = bodySize or 10; body.TextWrapped = true
	body.TextXAlignment = Enum.TextXAlignment.Left; body.TextYAlignment = Enum.TextYAlignment.Top
	body.Parent = card
	return card
end

local function showLinkOutput(codeText, urlText, noteText)
	clearOutput()
	local codeCard = addOutputBlock("Link Code", codeText, C.accent, C.accent, Enum.Font.Code, nil, nil, 26)
	local copyBtn = Instance.new("TextButton")
	copyBtn.Size = UDim2.new(1, 0, 0, 24)
	copyBtn.BackgroundColor3 = C.panel3; copyBtn.BorderSizePixel = 0
	copyBtn.Font = Enum.Font.GothamBold; copyBtn.Text = "Copy Code"; copyBtn.TextColor3 = C.text
	copyBtn.TextSize = 11; corner(copyBtn, 6)
	copyBtn.Parent = codeCard
	copyBtn.MouseButton1Click:Connect(function()
		local ok, clip = pcall(function() return game:GetService("Clipboard") end)
		if ok and clip then
			local done, _ = pcall(function() clip:SetText(codeText) end)
			if done then setStatus("Code copied to clipboard.", C.green) else setStatus("Could not copy.", C.red) end
		else
			setStatus("Clipboard unavailable — copy the code manually.", C.amber)
		end
	end)
	addOutputBlock("Sign-in Link", urlText, C.text, C.text, Enum.Font.Code)
	if noteText and noteText ~= "" then
		addOutputBlock("Note", noteText, C.subtext, C.subtext, Enum.Font.Gotham)
	end
	ProjectMetaLabel.Text = "Copy the code into the browser page."
end

local function setProjectSelected(projectId)
	for id, btn in pairs(projectButtons) do
		local accentBar = btn:FindFirstChild("AccentBar")
		if id == projectId then
			btn.BackgroundColor3 = C.panel3
			if accentBar then accentBar.BackgroundColor3 = C.accent end
		else
			btn.BackgroundColor3 = C.panel2
			if accentBar then accentBar.BackgroundColor3 = C.panel2 end
		end
	end
end

local function scanInstance(instance)
	local data = {
		Name      = instance.Name,
		ClassName = instance.ClassName,
		Location  = instance:GetFullName(),
		Children  = {},
	}
	if instance:IsA("LuaSourceContainer") then
		local ok, src = pcall(function() return instance.Source end)
		if ok and src ~= "" then data.Source = src end
	end
	local ok, children = pcall(function() return instance:GetChildren() end)
	if ok then
		for _, child in ipairs(children) do
			table.insert(data.Children, scanInstance(child))
		end
	end
	if #data.Children == 0 then data.Children = nil end
	return data
end

local function doScanAndUpload()
	if isScanningGame then return end
	if not savedToken or savedToken == "" then return end

	isScanningGame = true
	GameModelLabel.Text       = "Scanning game hierarchy..."
	GameModelLabel.TextColor3 = C.subtext

	task.spawn(function()
		local gameData = {}
		for _, service in ipairs(SCAN_TARGETS) do
			local ok, result = pcall(function() return scanInstance(service) end)
			if ok and result then table.insert(gameData, result) end
		end

		local encodeOk, jsonString = pcall(function()
			return HttpService:JSONEncode(gameData)
		end)

		if not encodeOk or not jsonString then
			GameModelLabel.Text       = "Scan failed — game may be too large."
			GameModelLabel.TextColor3 = C.red
			isScanningGame = false
			return
		end

		local byteCount = #jsonString
		GameModelLabel.Text       = "Uploading (" .. math.floor(byteCount / 1024) .. " KB)..."
		GameModelLabel.TextColor3 = C.subtext

		local placeId, universeId = getGameIds()
		local thumbnailApiUrl     = makeThumbnailUrl(universeId)

		local uploadOk, uploadResult = pcall(function()
			return HttpService:RequestAsync({
				Url    = GAME_MODEL_URL,
				Method = "POST",
				Headers = {
					["Authorization"] = "Bearer " .. savedToken,
					["Content-Type"]  = "application/json",
				},
				Body = HttpService:JSONEncode({
					model           = jsonString,
					placeId         = placeId,
					universeId      = universeId,
					thumbnailApiUrl = thumbnailApiUrl,
				}),
			})
		end)

		isScanningGame = false

		if not uploadOk then
			GameModelLabel.Text       = "Upload failed — check HTTP requests are enabled."
			GameModelLabel.TextColor3 = C.red
			return
		end

		if uploadResult.StatusCode == 413 then
			GameModelLabel.Text       = "Game too large (>500 KB). Remove unused services and retry."
			GameModelLabel.TextColor3 = C.amber
			return
		end

		if uploadResult.StatusCode ~= 200 then
			GameModelLabel.Text       = "Upload error (HTTP " .. tostring(uploadResult.StatusCode) .. ")"
			GameModelLabel.TextColor3 = C.red
			return
		end

		local kb = math.floor(byteCount / 1024)
		GameModelLabel.Text       = "✓ Synced — " .. kb .. " KB · place:" .. placeId
		GameModelLabel.TextColor3 = C.green
		GameModelIcon.TextColor3  = C.green
	end)
end

local function deleteGameModel()
	local token = savedToken
	if not token or token == "" then return end
	GameModelLabel.Text       = "Clearing game model..."
	GameModelLabel.TextColor3 = C.muted
	task.spawn(function()
		local ok, result = pcall(function()
			return HttpService:RequestAsync({
				Url    = GAME_MODEL_URL,
				Method = "DELETE",
				Headers = { ["Authorization"] = "Bearer " .. token },
				Body   = "{}",
			})
		end)
		if not (ok and result and result.StatusCode == 200) then
			warn("[Zeugo] game model delete failed")
		end
	end)
end

local function startAutoScan()
	if autoScanThread then task.cancel(autoScanThread) end
	doScanAndUpload()
	autoScanThread = task.spawn(function()
		while true do
			task.wait(AUTOSCAN_INTERVAL)
			if savedToken == "" then break end
			doScanAndUpload()
		end
	end)
end

local function resolveParentTarget(parentName, className, createdInstanceMap)
	local starterPlayer = game:GetService("StarterPlayer")
	local normalized = (parentName or ""):lower()
		:gsub("starterplayer/starterplayerscripts",    "starterplayerscripts")
		:gsub("starterplayer/startercharacterscripts", "startercharacterscripts")

	local builtInParents = {
		["replicatedstorage"]       = game:GetService("ReplicatedStorage"),
		["serverscriptservice"]     = game:GetService("ServerScriptService"),
		["starterplayer"]           = starterPlayer,
		["starterplayerscripts"]    = starterPlayer.StarterPlayerScripts,
		["startercharacterscripts"] = starterPlayer.StarterCharacterScripts,
		["startergui"]              = game:GetService("StarterGui"),
		["starterpack"]             = game:GetService("StarterPack"),
		["workspace"]               = workspace,
		["serverstorage"]           = game:GetService("ServerStorage"),
	}

	if createdInstanceMap and parentName and createdInstanceMap[parentName] then
		return createdInstanceMap[parentName]
	end
	if normalized == "starterplayer" then
		local cls = (className or ""):lower()
		if cls == "localscript" or cls == "script" or cls == "modulescript" then
			return starterPlayer.StarterPlayerScripts
		end
	end
	for key, target in pairs(builtInParents) do
		if normalized == key then return target end
	end
	return game:GetService("ReplicatedStorage")
end

local function syncRobloxUserId()
	if not savedToken or savedToken == "" then return end
	local ok, userId = pcall(function()
		return game:GetService("StudioService"):GetUserId()
	end)
	if not ok or not userId or userId == 0 then
		return
	end
	task.spawn(function()
		pcall(function()
			HttpService:RequestAsync({
				Url    = SET_ROBLOX_USER_URL,
				Method = "POST",
				Headers = {
					["Authorization"] = "Bearer " .. savedToken,
					["Content-Type"]  = "application/json",
				},
				Body = HttpService:JSONEncode({ robloxUserId = tostring(userId) }),
			})
		end)
	end)
end

local function insertInstances(data)
	local createdInstanceMap = {}
	for _, instData in ipairs(data.instances or {}) do
		pcall(function()
			local className    = instData.class or instData.className or "Folder"
			local instanceName = instData.name or className
			local parentTarget = resolveParentTarget(instData.parent, className, createdInstanceMap)
			local existing = parentTarget:FindFirstChild(instanceName)
			if existing and existing.ClassName == className then
				createdInstanceMap[instanceName] = existing; return
			end
			local inst = Instance.new(className); inst.Name = instanceName; inst.Parent = parentTarget
			createdInstanceMap[instanceName] = inst
		end)
	end
	return createdInstanceMap
end

local function processdeletions(data, createdInstanceMap)
	local deletedCount = 0
	local deletions = data.deletions
	if not deletions or typeof(deletions) ~= "table" then return 0 end

	for _, entry in ipairs(deletions) do
		local ok, err = pcall(function()
			if typeof(entry) ~= "table" then return end
			local targetName = tostring(entry.name   or "")
			local parentName = tostring(entry.parent or "")
			if targetName == "" then return end

			local parentTarget = resolveParentTarget(parentName, "", createdInstanceMap)
			local target = parentTarget:FindFirstChild(targetName)
			if target then
				target:Destroy()
				deletedCount = deletedCount + 1
			else
			end
		end)
		if not ok then
			warn("[Zeugo] deletion error:", err)
		end
	end
	return deletedCount
end

local function insertLatestData()
	if not latestProjectData then
		setStatus("Nothing ready to insert.", C.red); return
	end

	local createdInstanceMap = insertInstances(latestProjectData)
	local deleted = processdeletions(latestProjectData, createdInstanceMap)

	local created = 0
	local updated = 0
	for _, scriptData in ipairs(latestProjectData.scripts or {}) do
		local ok, err = pcall(function()
			local className  = scriptData.type or "ModuleScript"
			local scriptName = scriptData.name or "ZeugoScript"
			local code       = scriptData.code or "-- Inserted by Zeugo\n"
			local parent     = resolveParentTarget(scriptData.parent, className, createdInstanceMap)
			local existing   = parent:FindFirstChild(scriptName)
			if existing and existing:IsA("LuaSourceContainer") then
				existing.Source = code; updated = updated + 1
			else
				local inst = Instance.new(className)
				inst.Name = scriptName; inst.Source = code; inst.Parent = parent
				created = created + 1
			end
		end)
		if not ok then warn("[Zeugo] insert error:", err) end
	end

	local parts = {}
	if deleted > 0 then table.insert(parts, "-" .. deleted .. " removed") end
	if created > 0 then table.insert(parts, "+" .. created .. " new") end
	if updated > 0 then table.insert(parts, "~" .. updated .. " updated") end
	local msg = #parts > 0 and table.concat(parts, "  ") or "No changes"
	setStatus(msg, C.green)
end

local function renderLatestData(data)
	clearOutput()
	latestProjectData = data
	if not data then
		StateTitle.Text       = "No ready output"
		StateSub.Text         = "Generate something on the dashboard first."
		ProjectMetaLabel.Text = "This project doesn't have insertable output yet."
		addEmptyOutput("Nothing ready to insert yet. Generate from the dashboard.")
		return
	end
	StateTitle.Text       = "Inserting..."
	StateSub.Text         = "Auto-inserting latest dashboard output..."
	ProjectMetaLabel.Text = "Latest generation synced — auto-inserting."

	if data.title then
		local lbl = Instance.new("TextLabel"); lbl.BackgroundTransparency = 1
		lbl.Size = UDim2.new(1,0,0,20); lbl.Font = Enum.Font.GothamBold; lbl.Text = data.title
		lbl.TextColor3 = C.text; lbl.TextSize = 14; lbl.TextWrapped = true
		lbl.TextXAlignment = Enum.TextXAlignment.Left; lbl.TextYAlignment = Enum.TextYAlignment.Top
		lbl.Parent = OutputScroll
	end
	if data.summary then
		local lbl = Instance.new("TextLabel"); lbl.BackgroundTransparency = 1
		lbl.Size = UDim2.new(1,0,0,18); lbl.Font = Enum.Font.Gotham; lbl.Text = data.summary
		lbl.TextColor3 = C.subtext; lbl.TextSize = 11; lbl.TextWrapped = true
		lbl.TextXAlignment = Enum.TextXAlignment.Left; lbl.TextYAlignment = Enum.TextYAlignment.Top
		lbl.Parent = OutputScroll
	end

	if data.deletions and #data.deletions > 0 then
		for _, delData in ipairs(data.deletions) do
			addOutputBlock(
				delData.name or "Unnamed",
				(delData.parent or "?") .. "  →  removed",
				C.red, C.red, Enum.Font.Code, "DEL", C.redDark
			)
		end
	end

	if data.instances and #data.instances > 0 then
		for _, instData in ipairs(data.instances) do
			addOutputBlock(instData.name or "Unnamed Instance",
				(instData.class or instData.className or "Instance") .. "  →  " .. (instData.parent or "?"),
				C.text, C.subtext, Enum.Font.Code, "OBJ", C.panel3)
		end
	end
	if data.scripts and #data.scripts > 0 then
		for _, scriptData in ipairs(data.scripts) do
			local typeTag = (scriptData.type or "Script"):upper():sub(1, 3)
			addOutputBlock(scriptData.name or "Unnamed Script",
				(scriptData.type or "Script") .. "  →  " .. (scriptData.parent or "?"),
				C.text, C.subtext, Enum.Font.Code, typeTag, C.panel3)
		end
	else
		if not (data.deletions and #data.deletions > 0) then
			addEmptyOutput("No scripts in this output.")
		end
	end
	if data.notes and #data.notes > 0 then
		for _, note in ipairs(data.notes) do
			addOutputBlock("Note", note, C.subtext, C.subtext, Enum.Font.Gotham)
		end
	end
	if data.suggestions and #data.suggestions > 0 then
		for _, sug in ipairs(data.suggestions) do
			addOutputBlock("Suggestion", sug, C.subtext, C.muted, Enum.Font.Gotham)
		end
	end
	if SETTINGS.showWarnings and data.warnings and #data.warnings > 0 then
		for _, warning in ipairs(data.warnings) do
			addOutputBlock("⚠ Warning", warning, C.amber, C.amber, Enum.Font.Gotham)
		end
	end
	insertLatestData()
	StateTitle.Text = "✓ Inserted"
	StateSub.Text   = "Output auto-inserted. Polling every " .. POLL_INTERVAL .. "s for new generations."
end

local function verifyToken(token)
	local ok, result = pcall(function()
		return HttpService:RequestAsync({
			Url = PROJECTS_URL, Method = "GET",
			Headers = { ["Authorization"] = "Bearer " .. token },
		})
	end)
	if not ok or result.StatusCode ~= 200 then return false, nil end
	local success, data = pcall(function() return HttpService:JSONDecode(result.Body) end)
	if not success then return false, nil end
	return true, data.username or data.user or data.name or savedUser
end

local function fetchLatestForProject(projectId, silent)
	if not savedToken or savedToken == "" then return end
	if not silent then
		setStatus("Loading...", C.subtext)
		ProjectMetaLabel.Text = "Checking latest output..."
	end
	local ok, result = pcall(function()
		return HttpService:RequestAsync({
			Url = PROJECT_DATA_URL .. "?projectId=" .. HttpService:UrlEncode(projectId),
			Method = "GET",
			Headers = { ["Authorization"] = "Bearer " .. savedToken },
		})
	end)
	if not ok then
		if not silent then renderLatestData(nil); setStatus("Request failed.", C.red) end; return
	end
	if result.StatusCode == 401 then
		setStatus("Session expired. Reconnect.", C.red)
		plugin:SetSetting(TOKEN_KEY, ""); savedToken = ""; return
	end
	if result.StatusCode ~= 200 then
		if not silent then renderLatestData(nil); setStatus("No ready output.", C.amber) end; return
	end
	local parseOk, data = pcall(function() return HttpService:JSONDecode(result.Body) end)
	if not parseOk then
		if not silent then setStatus("Bad response.", C.red) end; return
	end
	local dataId = tostring(
		data.id or data.generationId or data.updatedAt or data.timestamp
		or (tostring(data.title or "") .. "#" .. tostring(#(data.scripts or {})))
	)
	local alreadyInserted = insertedIds[projectId]
	if silent and alreadyInserted == dataId then
		return
	end
	insertedIds[projectId] = dataId
	renderLatestData(data)
end

local function fetchProjects()
	if savedToken == "" then return end
	setStatus("Loading projects...", C.subtext)
	local ok, result = pcall(function()
		return HttpService:RequestAsync({
			Url = PROJECTS_URL, Method = "GET",
			Headers = { ["Authorization"] = "Bearer " .. savedToken },
		})
	end)
	if not ok then setStatus("Couldn't load projects.", C.red); return end
	if result.StatusCode == 401 then setStatus("Session expired.", C.red); return end
	if result.StatusCode ~= 200 then setStatus("Couldn't load projects.", C.red); return end
	local parseOk, data = pcall(function() return HttpService:JSONDecode(result.Body) end)
	if not parseOk then setStatus("Bad project response.", C.red); return end
	local projects = data.projects or data
	renderProjects(projects)
	if selectedProject then
		for _, projectData in ipairs(projects) do
			if projectData.id == selectedProject.id then
				selectedProject = projectData
				setProjectPickerText(projectData.name)
				ProjectNameLabel.Text = projectData.name
				setProjectSelected(projectData.id)
				fetchLatestForProject(projectData.id)
				break
			end
		end
	elseif projects[1] then
		selectedProject = projects[1]
		setProjectPickerText(selectedProject.name or "Unnamed Project")
		ProjectNameLabel.Text = selectedProject.name or "Unnamed Project"
		setProjectSelected(selectedProject.id)
		fetchLatestForProject(selectedProject.id)
	end
	setStatus("Projects loaded.", C.green)
end

local function startHeartbeat()
	if heartbeatThread then task.cancel(heartbeatThread) end
	heartbeatThread = task.spawn(function()
		while true do
			task.wait(HEARTBEAT_INTERVAL)
			if savedToken == "" then break end
			local placeId, universeId = getGameIds()
			local thumbnailApiUrl     = makeThumbnailUrl(universeId)
			pcall(function()
				HttpService:RequestAsync({
					Url     = HEARTBEAT_URL,
					Method  = "POST",
					Headers = {
						["Authorization"] = "Bearer " .. savedToken,
						["Content-Type"]  = "application/json",
					},
					Body = HttpService:JSONEncode({
						placeId         = placeId,
						universeId      = universeId,
						thumbnailApiUrl = thumbnailApiUrl,
					}),
				})
			end)
		end
	end)
end

local function startAutoPolling()
	if autoCheckThread then task.cancel(autoCheckThread) end
	pollCountdown = POLL_INTERVAL
	autoCheckThread = task.spawn(function()
		while true do
			task.wait(1)
			if savedToken == "" then PollTimerLabel.Text = ""; break end
			pollCountdown = pollCountdown - 1
			if selectedProject then
				PollTimerLabel.Text = "next check " .. tostring(pollCountdown) .. "s"
			end
			if pollCountdown <= 0 then
				pollCountdown = POLL_INTERVAL
				if selectedProject and savedToken ~= "" then
					fetchLatestForProject(selectedProject.id, true)
				end
			end
		end
	end)
end

function showDisconnected()
	setProjectPickerText("No project selected")
	StateTitle.Text       = "Not connected"
	StateSub.Text         = "Connect to browse your projects and insert generated output."
	ProjectNameLabel.Text = "No project selected"
	ProjectMetaLabel.Text = "Generate from the dashboard, then insert here."
	PollTimerLabel.Text   = ""
	selectedProject = nil; latestProjectData = nil
	clearProjectList(); clearOutput()
	addEmptyOutput("Projects and synced output will appear here after you connect.")
	ProjectPickerBtn.Active           = false
	ProjectPickerBtn.AutoButtonColor  = false
	ProjectPickerBtn.TextTransparency = 0.45
	PickerChevron.TextTransparency    = 0.45
	LoginOverlay.Visible              = true
	setProjectMenuOpen(false)
	setStatus("", C.muted)
	if pollThread      then task.cancel(pollThread);      pollThread      = nil end
	if autoCheckThread then task.cancel(autoCheckThread); autoCheckThread = nil end
	if heartbeatThread then task.cancel(heartbeatThread); heartbeatThread = nil end
	if autoScanThread  then task.cancel(autoScanThread);  autoScanThread  = nil end
end

local function showConnected(username)
	StateTitle.Text       = "Connected"
	StateSub.Text         = "Auto-scanning every " .. AUTOSCAN_INTERVAL .. "s · output auto-inserts every " .. POLL_INTERVAL .. "s"
	ProjectMetaLabel.Text = "Choose a project to load its latest output."
	LoginOverlay.Visible  = false
	ProjectPickerBtn.Active           = true
	ProjectPickerBtn.AutoButtonColor  = true
	ProjectPickerBtn.TextTransparency = 0
	PickerChevron.TextTransparency    = 0
	setStatus("@" .. tostring(username or savedUser or "user"), C.green)
	startAutoPolling()
	startHeartbeat()
	startAutoScan()
	syncRobloxUserId()
end

local function makeProjectButton(projectData)
	local btn = Instance.new("TextButton")
	btn.Name = "Project_" .. tostring(projectData.id)
	btn.Size = UDim2.new(1,0,0,34); btn.BackgroundColor3 = C.panel2; btn.BorderSizePixel = 0
	btn.Text = ""; btn.Parent = ProjectList; btn.ZIndex = 11; corner(btn, 8); stroke(btn, C.border)
	local accentBar = Instance.new("Frame")
	accentBar.Name = "AccentBar"; accentBar.Parent = btn
	accentBar.Size = UDim2.new(0,3,1,-8); accentBar.Position = UDim2.new(0,0,0,4)
	accentBar.BackgroundColor3 = C.panel2; accentBar.BorderSizePixel = 0; accentBar.ZIndex = 12
	corner(accentBar, 999)
	local name = Instance.new("TextLabel")
	name.Parent = btn; name.BackgroundTransparency = 1
	name.Position = UDim2.new(0,14,0,0); name.Size = UDim2.new(1,-24,1,0)
	name.Font = Enum.Font.Gotham; name.Text = projectData.name or "Unnamed Project"
	name.TextColor3 = C.text; name.TextSize = 11
	name.TextXAlignment = Enum.TextXAlignment.Left; name.TextYAlignment = Enum.TextYAlignment.Center
	name.ZIndex = 12
	projectButtons[projectData.id] = btn
	btn.MouseButton1Click:Connect(function()
		selectedProject = projectData
		setProjectPickerText(projectData.name or "Unnamed Project")
		ProjectNameLabel.Text = projectData.name or "Unnamed Project"
		ProjectMetaLabel.Text = "Loading latest output..."
		setProjectSelected(projectData.id)
		setProjectMenuOpen(false)
		pollCountdown = POLL_INTERVAL
		fetchLatestForProject(projectData.id)
	end)
	animatePress(btn, C.panel3)
end

function renderProjects(projects)
	clearProjectList()
	if #projects == 0 then
		local noProjects = Instance.new("TextLabel"); noProjects.BackgroundTransparency = 1
		noProjects.Size = UDim2.new(1,0,0,18); noProjects.Font = Enum.Font.Gotham
		noProjects.Text = "No projects yet. Generate one on the dashboard first."
		noProjects.TextColor3 = C.muted; noProjects.TextSize = 11; noProjects.TextWrapped = true
		noProjects.TextXAlignment = Enum.TextXAlignment.Left; noProjects.TextYAlignment = Enum.TextYAlignment.Top
		noProjects.Parent = ProjectList; return
	end
	for _, projectData in ipairs(projects) do makeProjectButton(projectData) end
end

local function openDashboard()
	setStatus("Link ready.", C.green)
end

local function beginSignIn()
	LoginConnectBtn.Text = "Getting link..."; LoginConnectBtn.BackgroundColor3 = C.panel3
	setStatus("", C.muted)
	local ok, result = pcall(function()
		return HttpService:RequestAsync({
			Url = LINK_URL, Method = "POST",
			Headers = { ["Content-Type"] = "application/json" }, Body = "{}",
		})
	end)
	LoginConnectBtn.Text = "Connect"; LoginConnectBtn.BackgroundColor3 = C.accent
	if not ok then setStatus("Request failed. HTTP enabled?", C.red); return end
	if result.StatusCode ~= 200 then
		setStatus("Link failed (" .. tostring(result.StatusCode) .. ")", C.red); return
	end
	local success, data = pcall(function() return HttpService:JSONDecode(result.Body) end)
	if not success then setStatus("Bad server response.", C.red); return end
	local code = data.code; local authUrl = data.authUrl
	print(authUrl)
	if not code or not authUrl then setStatus("Broken sign-in response.", C.red); return end
	showLinkOutput(code, authUrl, "Paste into your browser, approve, then come back here.")
	LoginOverlay.Visible = false
	setStatus("Waiting for authorization...", C.subtext)
	if pollThread then task.cancel(pollThread) end
	pollThread = task.spawn(function()
		local attempts = 0
		local maxAttempts = 180  -- 6 minutes
		while attempts < maxAttempts do
			task.wait(2); attempts = attempts + 1
			local pOk, pResult = pcall(function()
				return HttpService:RequestAsync({
					Url = POLL_URL .. "?code=" .. code, Method = "GET",
					Headers = { ["Content-Type"] = "application/json" },
				})
			end)
			if not pOk then continue end
			if pResult.StatusCode == 410 then
				-- Link expired - show error but keep overlay visible
				setStatus("Link expired. Press Connect to get a new one.", C.red)
				LoginOverlay.Visible = true
				break
			end
			if pResult.StatusCode ~= 200 then continue end
			local decodeOk, pData = pcall(function() return HttpService:JSONDecode(pResult.Body) end)
			if not decodeOk or pData.status == "pending" then continue end
			if pData.status == "authorized" then
				local token = pData.token
				if not token or token == "" then setStatus("Token missing. Try again.", C.red); LoginOverlay.Visible = true; break end
				local vOk, username = verifyToken(token)
				if not vOk then setStatus("Authorization failed.", C.red); LoginOverlay.Visible = true; break end
				local safeUsername = username or "user"
				plugin:SetSetting(TOKEN_KEY, token); plugin:SetSetting(USER_KEY, safeUsername)
				savedToken = token; savedUser = safeUsername
				showConnected(safeUsername); fetchProjects()
				pollThread = nil; break
			end
		end
		if attempts >= maxAttempts then setStatus("Timeout. Press Connect to retry.", C.amber); LoginOverlay.Visible = true end
	end)
end

ProjectPickerBtn.MouseButton1Click:Connect(function()
	if not ProjectPickerBtn.Active then return end
	setProjectMenuOpen(not dropdownOpen)
end)


RefreshBtn.MouseButton1Click:Connect(function()
	if savedToken == "" then setStatus("Connect first.", C.red); return end
	if selectedProject then insertedIds[selectedProject.id] = nil end
	pollCountdown = POLL_INTERVAL
	fetchProjects()
end)

DashboardBtn.MouseButton1Click:Connect(function() openDashboard() end)

DisconnectBtn.MouseButton1Click:Connect(function()
	deleteGameModel()
	plugin:SetSetting(TOKEN_KEY, ""); plugin:SetSetting(USER_KEY, "")
	savedToken = ""; savedUser = ""; insertedIds = {}
	showDisconnected(); setStatus("Disconnected.", C.muted)
end)

LoginConnectBtn.MouseButton1Click:Connect(function() beginSignIn() end)
LoginDashboardBtn.MouseButton1Click:Connect(function() openDashboard() end)

toggleBtn.Click:Connect(function()
	widget.Enabled = not widget.Enabled
	if widget.Enabled then widget:RequestRaise() end
end)

plugin.Unloading:Connect(function()
	deleteGameModel()
end)

ProjectPickerBtn.Active           = false
ProjectPickerBtn.AutoButtonColor  = false
ProjectPickerBtn.TextTransparency = 0.45
PickerChevron.TextTransparency    = 0.45
ProjectDropdown.Visible  = false

if savedToken ~= "" then
	task.spawn(function()
		local ok, username = verifyToken(savedToken)
		if ok then
			savedUser = username or savedUser or "user"
			plugin:SetSetting(USER_KEY, savedUser)
			showConnected(savedUser)
			fetchProjects()
		else
			plugin:SetSetting(TOKEN_KEY, ""); savedToken = ""
			showDisconnected()
			setStatus("Session expired. Sign in again.", C.muted)
		end
	end)
else
	showDisconnected()
end