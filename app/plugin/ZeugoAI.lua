local HttpService  = game:GetService("HttpService")
local TweenService = game:GetService("TweenService")

local BASE_URL            = "https://wisprblx.site"
local LINK_URL            = BASE_URL .. "/api/plugin/link"
local POLL_URL            = BASE_URL .. "/api/plugin/poll"
local PROJECTS_URL        = BASE_URL .. "/api/plugin/projects"
local PROJECT_DATA_URL    = BASE_URL .. "/api/plugin/project/latest"
local HEARTBEAT_URL       = BASE_URL .. "/api/plugin/heartbeat"
local GAME_MODEL_URL      = BASE_URL .. "/api/plugin/game-model"
local SET_ROBLOX_USER_URL = BASE_URL .. "/api/plugin/set-roblox-user"

local ORCHESTRATE_URL    = BASE_URL .. "/api/plugin/orchestrate"
local GENERATE_URL       = BASE_URL .. "/api/plugin/generate"
local CHECKPOINT_URL     = BASE_URL .. "/api/plugin/checkpoint"
local MEMORY_URL         = BASE_URL .. "/api/plugin/memory"
local SCAN_URL           = BASE_URL .. "/api/plugin/scan"
local UNDO_URL           = BASE_URL .. "/api/plugin/undo"

local TOKEN_KEY        = "Wisp_Token"
local USER_KEY         = "Wisp_User"
local ADVANCED_MODE_KEY = "Wisp_AdvancedMode"
local MEMORY_RULES_KEY  = "Wisp_MemoryRules"

local POLL_INTERVAL      = 10
local HEARTBEAT_INTERVAL = 15
local AUTOSCAN_INTERVAL  = 10
local LINK_TTL_SECONDS   = 60 * 30

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
	yellowDark = Color3.fromRGB(50, 42, 14),
	greenDark  = Color3.fromRGB(18, 42, 24),
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

local toolbar   = plugin:CreateToolbar("Wisp")
local toggleBtn = toolbar:CreateButton("Wisp", "Open Wisp", ICONS.logo)

local widgetInfo = DockWidgetPluginGuiInfo.new(
	Enum.InitialDockState.Right, true, true, 620, 700, 460, 560
)
local widget       = plugin:CreateDockWidgetPluginGui("WispWidgetV5", widgetInfo)
widget.Title       = "Wisp"
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
root.Name = "WispRoot"; root.Parent = widget; root.BackgroundColor3 = C.bg
root.BorderSizePixel = 0; root.Size = UDim2.fromScale(1, 1)

-- ══════════════════════════════════════════════════════════════════════════════
-- TOPBAR
-- ══════════════════════════════════════════════════════════════════════════════

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
BrandTitle.Font = Enum.Font.GothamBold; BrandTitle.Text = "Wisp"; BrandTitle.TextColor3 = C.text
BrandTitle.TextSize = 14; BrandTitle.TextWrapped = true
BrandTitle.TextXAlignment = Enum.TextXAlignment.Left; BrandTitle.TextYAlignment = Enum.TextYAlignment.Center

local ProjectPickerBtn = Instance.new("TextButton")
ProjectPickerBtn.Parent = Topbar; ProjectPickerBtn.BackgroundColor3 = C.panel2
ProjectPickerBtn.BorderSizePixel = 0; ProjectPickerBtn.Position = UDim2.new(0.215, 0, 0.18, 0)
ProjectPickerBtn.Size = UDim2.new(0.25, 0, 0.64, 0); ProjectPickerBtn.Text = "No project selected"
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
RefreshBtn.Position = UDim2.new(0.57, 0, 0.18, 0); RefreshBtn.Size = UDim2.new(0.08, 0, 0.64, 0)
stroke(RefreshBtn, C.border)

local AdvancedToggle = makeTextButton(Topbar, "Advanced", C.panel2, C.muted)
AdvancedToggle.Position = UDim2.new(0.656, 0, 0.18, 0); AdvancedToggle.Size = UDim2.new(0.07, 0, 0.64, 0)
stroke(AdvancedToggle, C.border)

local DashboardBtn = makeTextButton(Topbar, "Dashboard", C.panel2, C.text)
DashboardBtn.Position = UDim2.new(0.732, 0, 0.18, 0); DashboardBtn.Size = UDim2.new(0.095, 0, 0.64, 0)
stroke(DashboardBtn, C.border)

local DisconnectBtn = makeTextButton(Topbar, "Disconnect", C.redDark, C.text)
DisconnectBtn.Position = UDim2.new(0.834, 0, 0.18, 0); DisconnectBtn.Size = UDim2.new(0.09, 0, 0.64, 0)
stroke(DisconnectBtn, C.red)

animatePress(RefreshBtn, C.panel3)
animatePress(AdvancedToggle, C.panel3)
animatePress(DashboardBtn, C.panel3)
animatePress(DisconnectBtn, Color3.fromRGB(58, 22, 22))

-- ══════════════════════════════════════════════════════════════════════════════
-- BODY + LAYOUT
-- ══════════════════════════════════════════════════════════════════════════════

local Body = Instance.new("Frame")
Body.Parent = root; Body.BackgroundTransparency = 1
Body.Position = UDim2.new(0.008, 0, 0.092, 0); Body.Size = UDim2.new(0.984, 0, 0.901, 0)

local BodyLayout = Instance.new("UIListLayout")
BodyLayout.Parent = Body; BodyLayout.SortOrder = Enum.SortOrder.LayoutOrder
BodyLayout.Padding = UDim.new(0, 6)

-- ══════════════════════════════════════════════════════════════════════════════
-- PROJECT DROPDOWN
-- ══════════════════════════════════════════════════════════════════════════════

local ProjectDropdown = Instance.new("Frame")
ProjectDropdown.Parent = root; ProjectDropdown.BackgroundColor3 = C.panel; ProjectDropdown.BorderSizePixel = 0
ProjectDropdown.Position = UDim2.new(0.223, 0, 0.084, 0); ProjectDropdown.Size = UDim2.new(0.25, 0, 0, 0)
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

-- ══════════════════════════════════════════════════════════════════════════════
-- HERO (STATE) PANEL
-- ══════════════════════════════════════════════════════════════════════════════

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
StateSub.Position = UDim2.new(0.025, 0, 0.5, 0); StateSub.Size = UDim2.new(0.55, 0, 0, 16)
StateSub.Font = Enum.Font.Gotham
StateSub.Text = "Connect to browse your projects and insert generated output."
StateSub.TextColor3 = C.subtext; StateSub.TextSize = 11; StateSub.TextWrapped = true
StateSub.TextXAlignment = Enum.TextXAlignment.Left; StateSub.TextYAlignment = Enum.TextYAlignment.Top

-- Enhanced status pill: model + tokens + task count
local StatusPill = Instance.new("Frame")
StatusPill.Parent = Hero; StatusPill.BackgroundColor3 = C.panel2; StatusPill.BorderSizePixel = 0
StatusPill.Position = UDim2.new(0.60, 0, 0.16, 0); StatusPill.Size = UDim2.new(0.37, 0, 0.68, 0)
corner(StatusPill, 8); stroke(StatusPill, C.border)

local StatusPillMain = Instance.new("TextLabel")
StatusPillMain.Parent = StatusPill; StatusPillMain.BackgroundTransparency = 1
StatusPillMain.Position = UDim2.new(0, 10, 0, 2); StatusPillMain.Size = UDim2.new(1, -20, 0, 14)
StatusPillMain.Font = Enum.Font.Code; StatusPillMain.Text = "Idle"; StatusPillMain.TextColor3 = C.muted
StatusPillMain.TextSize = 10; StatusPillMain.TextXAlignment = Enum.TextXAlignment.Left

local StatusPillDetail = Instance.new("TextLabel")
StatusPillDetail.Parent = StatusPill; StatusPillDetail.BackgroundTransparency = 1
StatusPillDetail.Position = UDim2.new(0, 10, 0, 18); StatusPillDetail.Size = UDim2.new(1, -20, 0, 12)
StatusPillDetail.Font = Enum.Font.Code; StatusPillDetail.Text = ""; StatusPillDetail.TextColor3 = C.muted
StatusPillDetail.TextSize = 8; StatusPillDetail.TextXAlignment = Enum.TextXAlignment.Left

local StatusPillTimer = Instance.new("TextLabel")
StatusPillTimer.Parent = StatusPill; StatusPillTimer.BackgroundTransparency = 1
StatusPillTimer.Position = UDim2.new(0, 10, 0, 32); StatusPillTimer.Size = UDim2.new(1, -20, 0, 12)
StatusPillTimer.Font = Enum.Font.Code; StatusPillTimer.Text = ""; StatusPillTimer.TextColor3 = C.muted
StatusPillTimer.TextSize = 8; StatusPillTimer.TextXAlignment = Enum.TextXAlignment.Left

-- ══════════════════════════════════════════════════════════════════════════════
-- GAME MODEL BAR
-- ══════════════════════════════════════════════════════════════════════════════

local GameModelBar = Instance.new("Frame")
GameModelBar.Parent = Body; GameModelBar.BackgroundColor3 = C.panel; GameModelBar.BorderSizePixel = 0
GameModelBar.Size = UDim2.new(1, 0, 0, 30); GameModelBar.LayoutOrder = 2
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

-- ══════════════════════════════════════════════════════════════════════════════
-- META PANEL
-- ══════════════════════════════════════════════════════════════════════════════

local Meta = Instance.new("Frame")
Meta.Parent = Body; Meta.BackgroundColor3 = C.panel; Meta.BorderSizePixel = 0
Meta.Size = UDim2.new(1, 0, 0, 62); Meta.LayoutOrder = 3
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

-- ══════════════════════════════════════════════════════════════════════════════
-- TASK PROGRESS PANEL
-- ══════════════════════════════════════════════════════════════════════════════

local TaskProgressFrame = Instance.new("Frame")
TaskProgressFrame.Parent = Body; TaskProgressFrame.BackgroundColor3 = C.panel; TaskProgressFrame.BorderSizePixel = 0
TaskProgressFrame.Size = UDim2.new(1, 0, 0, 0); TaskProgressFrame.AutomaticSize = Enum.AutomaticSize.Y
TaskProgressFrame.Visible = false; TaskProgressFrame.LayoutOrder = 4
corner(TaskProgressFrame, 10); stroke(TaskProgressFrame, C.border)

local TaskProgressHeader = Instance.new("TextLabel")
TaskProgressHeader.Parent = TaskProgressFrame; TaskProgressHeader.BackgroundTransparency = 1
TaskProgressHeader.Position = UDim2.new(0.02, 0, 0, 8); TaskProgressHeader.Size = UDim2.new(0.96, 0, 0, 14)
TaskProgressHeader.Font = Enum.Font.Code; TaskProgressHeader.Text = "TASK PROGRESS"
TaskProgressHeader.TextColor3 = C.muted; TaskProgressHeader.TextSize = 9
TaskProgressHeader.TextXAlignment = Enum.TextXAlignment.Left

local TaskProgressPhase = Instance.new("TextLabel")
TaskProgressPhase.Parent = TaskProgressFrame; TaskProgressPhase.BackgroundTransparency = 1
TaskProgressPhase.Position = UDim2.new(0.02, 0, 0, 24); TaskProgressPhase.Size = UDim2.new(0.96, 0, 0, 18)
TaskProgressPhase.Font = Enum.Font.GothamBold; TaskProgressPhase.Text = "Planning..."
TaskProgressPhase.TextColor3 = C.text; TaskProgressPhase.TextSize = 12
TaskProgressPhase.TextXAlignment = Enum.TextXAlignment.Left

local TaskList = Instance.new("Frame")
TaskList.Parent = TaskProgressFrame; TaskList.BackgroundTransparency = 1
TaskList.Position = UDim2.new(0, 8, 0, 44); TaskList.Size = UDim2.new(1, -16, 0, 0)
TaskList.AutomaticSize = Enum.AutomaticSize.Y

local TaskListLayout = Instance.new("UIListLayout")
TaskListLayout.Parent = TaskList; TaskListLayout.SortOrder = Enum.SortOrder.LayoutOrder
TaskListLayout.Padding = UDim.new(0, 4)

local TaskProgressElapsed = Instance.new("TextLabel")
TaskProgressElapsed.Parent = TaskProgressFrame; TaskProgressElapsed.BackgroundTransparency = 1
TaskProgressElapsed.Position = UDim2.new(0.02, 0, 0, 0); TaskProgressElapsed.Size = UDim2.new(0.96, 0, 0, 14)
TaskProgressElapsed.Font = Enum.Font.Code; TaskProgressElapsed.Text = ""; TaskProgressElapsed.TextColor3 = C.muted
TaskProgressElapsed.TextSize = 9; TaskProgressElapsed.TextXAlignment = Enum.TextXAlignment.Right
TaskProgressElapsed.AutomaticSize = Enum.AutomaticSize.Y
TaskProgressElapsed.LayoutOrder = 999

-- ══════════════════════════════════════════════════════════════════════════════
-- SKILL SELECTOR (Advanced mode)
-- ══════════════════════════════════════════════════════════════════════════════

local SkillSelectorFrame = Instance.new("Frame")
SkillSelectorFrame.Parent = Body; SkillSelectorFrame.BackgroundColor3 = C.panel; SkillSelectorFrame.BorderSizePixel = 0
SkillSelectorFrame.Size = UDim2.new(1, 0, 0, 36); SkillSelectorFrame.Visible = false; SkillSelectorFrame.LayoutOrder = 5
corner(SkillSelectorFrame, 8); stroke(SkillSelectorFrame, C.border)

local SkillLabel = Instance.new("TextLabel")
SkillLabel.Parent = SkillSelectorFrame; SkillLabel.BackgroundTransparency = 1
SkillLabel.Position = UDim2.new(0.02, 0, 0, 0); SkillLabel.Size = UDim2.new(0, 80, 1, 0)
SkillLabel.Font = Enum.Font.Code; SkillLabel.Text = "SKILL:"; SkillLabel.TextColor3 = C.muted
SkillLabel.TextSize = 9; SkillLabel.TextXAlignment = Enum.TextXAlignment.Left

local SkillDropdown = Instance.new("TextButton")
SkillDropdown.Parent = SkillSelectorFrame; SkillDropdown.BackgroundColor3 = C.panel2
SkillDropdown.BorderSizePixel = 0; SkillDropdown.Position = UDim2.new(0, 82, 0, 4)
SkillDropdown.Size = UDim2.new(0, 200, 0, 28); SkillDropdown.Text = "None (default)"
SkillDropdown.TextColor3 = C.text; SkillDropdown.TextSize = 10; SkillDropdown.Font = Enum.Font.Gotham
SkillDropdown.TextXAlignment = Enum.TextXAlignment.Left
corner(SkillDropdown, 6); stroke(SkillDropdown, C.border)

local SkillDropdownChevron = Instance.new("TextLabel")
SkillDropdownChevron.Parent = SkillDropdown; SkillDropdownChevron.BackgroundTransparency = 1
SkillDropdownChevron.Position = UDim2.new(1, -20, 0, 0); SkillDropdownChevron.Size = UDim2.new(0, 18, 1, 0)
SkillDropdownChevron.Font = Enum.Font.Code; SkillDropdownChevron.Text = "▼"; SkillDropdownChevron.TextColor3 = C.muted
SkillDropdownChevron.TextSize = 9

local SkillDropdownList = Instance.new("Frame")
SkillDropdownList.Parent = SkillSelectorFrame; SkillDropdownList.BackgroundColor3 = C.panel
SkillDropdownList.BorderSizePixel = 0; SkillDropdownList.Position = UDim2.new(0, 82, 0, 34)
SkillDropdownList.Size = UDim2.new(0, 200, 0, 0); SkillDropdownList.ClipsDescendants = true
SkillDropdownList.Visible = false; SkillDropdownList.ZIndex = 12
corner(SkillDropdownList, 6); stroke(SkillDropdownList, C.border)

local SkillDropdownScroll = Instance.new("ScrollingFrame")
SkillDropdownScroll.Parent = SkillDropdownList; SkillDropdownScroll.BackgroundTransparency = 1
SkillDropdownScroll.BorderSizePixel = 0; SkillDropdownScroll.Size = UDim2.new(1, 0, 1, 0)
SkillDropdownScroll.CanvasSize = UDim2.new(0, 0, 0, 0); SkillDropdownScroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
SkillDropdownScroll.ScrollBarThickness = 3; SkillDropdownScroll.ZIndex = 12

local SkillDropdownLayout = Instance.new("UIListLayout")
SkillDropdownLayout.Parent = SkillDropdownScroll; SkillDropdownLayout.SortOrder = Enum.SortOrder.LayoutOrder
SkillDropdownLayout.Padding = UDim.new(0, 2)

local skillDropdownOpen = false
local selectedSkill = nil
local availableSkills = {}

-- ══════════════════════════════════════════════════════════════════════════════
-- PROJECT MEMORY PANEL (Advanced mode)
-- ══════════════════════════════════════════════════════════════════════════════

local MemoryFrame = Instance.new("Frame")
MemoryFrame.Parent = Body; MemoryFrame.BackgroundColor3 = C.panel; MemoryFrame.BorderSizePixel = 0
MemoryFrame.Size = UDim2.new(1, 0, 0, 0); MemoryFrame.AutomaticSize = Enum.AutomaticSize.Y
MemoryFrame.Visible = false; MemoryFrame.LayoutOrder = 6
corner(MemoryFrame, 10); stroke(MemoryFrame, C.border)

local MemoryHeader = Instance.new("TextButton")
MemoryHeader.Parent = MemoryFrame; MemoryHeader.BackgroundTransparency = 1
MemoryHeader.Size = UDim2.new(1, 0, 0, 28)

local MemoryHeaderLabel = Instance.new("TextLabel")
MemoryHeaderLabel.Parent = MemoryHeader; MemoryHeaderLabel.BackgroundTransparency = 1
MemoryHeaderLabel.Position = UDim2.new(0.02, 0, 0, 0); MemoryHeaderLabel.Size = UDim2.new(0.7, 0, 1, 0)
MemoryHeaderLabel.Font = Enum.Font.Code; MemoryHeaderLabel.Text = "PROJECT RULES"
MemoryHeaderLabel.TextColor3 = C.muted; MemoryHeaderLabel.TextSize = 9
MemoryHeaderLabel.TextXAlignment = Enum.TextXAlignment.Left

local MemoryChevron = Instance.new("TextLabel")
MemoryChevron.Parent = MemoryHeader; MemoryChevron.BackgroundTransparency = 1
MemoryChevron.Position = UDim2.new(1, -24, 0, 0); MemoryChevron.Size = UDim2.new(0, 20, 1, 0)
MemoryChevron.Font = Enum.Font.Code; MemoryChevron.Text = "▶"; MemoryChevron.TextColor3 = C.muted
MemoryChevron.TextSize = 10

local MemoryBody = Instance.new("Frame")
MemoryBody.Parent = MemoryFrame; MemoryBody.BackgroundTransparency = 1
MemoryBody.Position = UDim2.new(0, 8, 0, 28); MemoryBody.Size = UDim2.new(1, -16, 0, 0)
MemoryBody.AutomaticSize = Enum.AutomaticSize.Y; MemoryBody.Visible = false

local MemoryBodyLayout = Instance.new("UIListLayout")
MemoryBodyLayout.Parent = MemoryBody; MemoryBodyLayout.SortOrder = Enum.SortOrder.LayoutOrder
MemoryBodyLayout.Padding = UDim.new(0, 4)

local memoryOpen = false
local memoryRules = {}
local memoryRuleFrames = {}

local AddRuleBtn = makeTextButton(MemoryBody, "+ Add Rule", C.panel3, C.text)
AddRuleBtn.Size = UDim2.new(1, 0, 0, 26); AddRuleBtn.LayoutOrder = 9999
AddRuleBtn.TextSize = 10

-- ══════════════════════════════════════════════════════════════════════════════
-- OUTPUT PANEL
-- ══════════════════════════════════════════════════════════════════════════════

local Output = Instance.new("Frame")
Output.Parent = Body; Output.BackgroundColor3 = C.panel; Output.BorderSizePixel = 0
Output.Size = UDim2.new(1, 0, 1, -170); Output.LayoutOrder = 10
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

-- ══════════════════════════════════════════════════════════════════════════════
-- LOGIN OVERLAY
-- ══════════════════════════════════════════════════════════════════════════════

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

-- ══════════════════════════════════════════════════════════════════════════════
-- TOAST NOTIFICATION
-- ══════════════════════════════════════════════════════════════════════════════

local ToastFrame = Instance.new("Frame")
ToastFrame.Parent = root; ToastFrame.AnchorPoint = Vector2.new(0.5, 1)
ToastFrame.Position = UDim2.new(0.5, 0, 0.95, 0); ToastFrame.Size = UDim2.new(0, 0, 0, 0)
ToastFrame.AutomaticSize = Enum.AutomaticSize.X; ToastFrame.BackgroundColor3 = C.panel2
ToastFrame.BorderSizePixel = 0; ToastFrame.ZIndex = 50; ToastFrame.Visible = false
corner(ToastFrame, 8); stroke(ToastFrame, C.borderStr)

local ToastLabel = Instance.new("TextLabel")
ToastLabel.Parent = ToastFrame; ToastLabel.BackgroundTransparency = 1
ToastLabel.Position = UDim2.new(0, 14, 0, 0); ToastLabel.Size = UDim2.new(0, 0, 0, 32)
ToastLabel.AutomaticSize = Enum.AutomaticSize.X
ToastLabel.Font = Enum.Font.GothamBold; ToastLabel.Text = ""; ToastLabel.TextColor3 = C.text
ToastLabel.TextSize = 11

local function showToast(message, color, duration)
	ToastLabel.Text = message
	ToastLabel.TextColor3 = color or C.text
	ToastFrame.Size = UDim2.new(0, 0, 0, 32)
	ToastFrame.Visible = true
	ToastFrame.BackgroundTransparency = 0
	task.delay(duration or 3, function()
		tween(ToastFrame, TweenInfo.new(0.3, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			BackgroundTransparency = 1,
		})
		task.delay(0.3, function()
			ToastFrame.Visible = false
			ToastFrame.BackgroundTransparency = 0
		end)
	end)
end

-- ══════════════════════════════════════════════════════════════════════════════
-- STATE
-- ══════════════════════════════════════════════════════════════════════════════

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
local isAdvancedMode      = plugin:GetSetting(ADVANCED_MODE_KEY) or false
local lastRunId           = nil
local lastRunData         = nil
local currentRunStartTime = nil
local elapsedTimerThread  = nil

-- ══════════════════════════════════════════════════════════════════════════════
-- UTILITY FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

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
	StatusPillMain.Text       = labelText == "" and "Idle" or labelText
	StatusPillMain.TextColor3 = color or C.muted
	LoginStatus.Text          = labelText == "" and "Not connected" or labelText
	LoginStatus.TextColor3    = color or C.muted

	if color == C.green then
		StatusPill.BackgroundColor3 = C.greenDark
	elseif color == C.red then
		StatusPill.BackgroundColor3 = C.redDark
	elseif color == C.amber then
		StatusPill.BackgroundColor3 = C.yellowDark
	else
		StatusPill.BackgroundColor3 = C.panel2
	end
end

local function setStatusDetail(model, tokens, tasks)
	local parts = {}
	if model then table.insert(parts, "Model: " .. model) end
	if tokens then table.insert(parts, tokens .. " tokens") end
	if tasks then table.insert(parts, tasks .. " tasks") end
	StatusPillDetail.Text = table.concat(parts, "  ·  ")
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
			Size = UDim2.new(0.25, 0, 0, 210),
		})
	else
		PickerChevron.Text = "▼"
		local t = tween(ProjectDropdown, TweenInfo.new(0.16, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
			Size = UDim2.new(0.25, 0, 0, 0),
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

-- ══════════════════════════════════════════════════════════════════════════════
-- TASK PROGRESS SYSTEM
-- ══════════════════════════════════════════════════════════════════════════════

local function clearTaskList()
	for _, child in ipairs(TaskList:GetChildren()) do
		if child:IsA("GuiObject") then child:Destroy() end
	end
	TaskListLayout.Parent = TaskList
end

local function showTaskProgress(phaseText)
	TaskProgressPhase.Text = phaseText or "Planning..."
	TaskProgressFrame.Visible = true
	clearTaskList()
end

local function updateTaskProgress(phaseText)
	TaskProgressPhase.Text = phaseText or TaskProgressPhase.Text
end

local function addTaskItem(name, status, taskType, agentName)
	local statusIcons = {
		pending   = "○",
		running   = "◉",
		completed = "●",
		failed    = "✕",
	}
	local statusColors = {
		pending   = C.muted,
		running   = C.blue,
		completed = C.green,
		failed    = C.red,
	}

	local card = Instance.new("Frame")
	card.BackgroundColor3 = C.panel2; card.BorderSizePixel = 0
	card.Size = UDim2.new(1, 0, 0, 22); card.AutomaticSize = Enum.AutomaticSize.Y
	corner(card, 6); stroke(card, C.border)

	local iconLabel = Instance.new("TextLabel")
	iconLabel.Parent = card; iconLabel.BackgroundTransparency = 1
	iconLabel.Position = UDim2.new(0, 8, 0, 0); iconLabel.Size = UDim2.new(0, 16, 0, 22)
	iconLabel.Font = Enum.Font.Code; iconLabel.Text = statusIcons[status] or "○"
	iconLabel.TextColor3 = statusColors[status] or C.muted; iconLabel.TextSize = 11

	local nameLabel = Instance.new("TextLabel")
	nameLabel.Parent = card; nameLabel.BackgroundTransparency = 1
	nameLabel.Position = UDim2.new(0, 28, 0, 0); nameLabel.Size = UDim2.new(1, -36, 0, 22)
	nameLabel.Font = Enum.Font.Gotham; nameLabel.Text = name or "Task"
	nameLabel.TextColor3 = C.text; nameLabel.TextSize = 10
	nameLabel.TextXAlignment = Enum.TextXAlignment.Left; nameLabel.TextYAlignment = Enum.TextYAlignment.Center
	nameLabel.TextWrapped = true

	if isAdvancedMode and (taskType or agentName) then
		local metaParts = {}
		if taskType then table.insert(metaParts, taskType) end
		if agentName then table.insert(metaParts, "→ " .. agentName) end
		local metaLabel = Instance.new("TextLabel")
		metaLabel.Parent = card; metaLabel.BackgroundTransparency = 1
		metaLabel.Position = UDim2.new(0, 28, 0, 18); metaLabel.Size = UDim2.new(1, -36, 0, 14)
		metaLabel.Font = Enum.Font.Code; metaLabel.Text = table.concat(metaParts, "  ")
		metaLabel.TextColor3 = C.muted; metaLabel.TextSize = 8
		metaLabel.TextXAlignment = Enum.TextXAlignment.Left
		card.Size = UDim2.new(1, 0, 0, 36)
	end

	card.Parent = TaskList
	return card
end

local function hideTaskProgress()
	TaskProgressFrame.Visible = false
end

local function startElapsedTimer()
	if elapsedTimerThread then task.cancel(elapsedTimerThread) end
	currentRunStartTime = tick()
	elapsedTimerThread = task.spawn(function()
		while currentRunStartTime do
			local elapsed = math.floor(tick() - currentRunStartTime)
			TaskProgressElapsed.Text = elapsed .. "s elapsed"
			StatusPillTimer.Text = "⏱ " .. elapsed .. "s"
			task.wait(1)
		end
	end)
end

local function stopElapsedTimer()
	if elapsedTimerThread then task.cancel(elapsedTimerThread); elapsedTimerThread = nil end
	currentRunStartTime = nil
end

-- ══════════════════════════════════════════════════════════════════════════════
-- DIFF VIEWER
-- ══════════════════════════════════════════════════════════════════════════════

local function renderDiffSummary(data)
	if not data then return end

	local created = data.created or data.scripts or {}
	local deleted = data.deletions or {}
	local updated = data.updated or {}

	local hasChanges = (#created > 0) or (#deleted > 0) or (#updated > 0)
	if not hasChanges then return end

	local diffCard = Instance.new("Frame")
	diffCard.BackgroundColor3 = C.panel2; diffCard.BorderSizePixel = 0
	diffCard.Size = UDim2.new(1, 0, 0, 0); diffCard.AutomaticSize = Enum.AutomaticSize.Y
	diffCard.Parent = OutputScroll; corner(diffCard, 8); stroke(diffCard, C.border)

	local diffHeader = Instance.new("TextLabel")
	diffHeader.Parent = diffCard; diffHeader.BackgroundTransparency = 1
	diffHeader.Position = UDim2.new(0, 10, 0, 6); diffHeader.Size = UDim2.new(1, -20, 0, 14)
	diffHeader.Font = Enum.Font.Code; diffHeader.Text = "DIFF SUMMARY"
	diffHeader.TextColor3 = C.muted; diffHeader.TextSize = 9
	diffHeader.TextXAlignment = Enum.TextXAlignment.Left

	local diffY = 22

	for _, item in ipairs(created) do
		local name = item.name or "NewScript"
		local classType = item.type or item.class or "Script"
		local parent = item.parent or "?"
		local line = Instance.new("TextLabel")
		line.Parent = diffCard; line.BackgroundTransparency = 1
		line.Position = UDim2.new(0, 10, 0, diffY); line.Size = UDim2.new(1, -20, 0, 14)
		line.Font = Enum.Font.Code; line.Text = "Created: " .. name .. " (" .. classType .. " → " .. parent .. ")"
		line.TextColor3 = C.green; line.TextSize = 10
		line.TextXAlignment = Enum.TextXAlignment.Left
		diffY = diffY + 16
	end

	for _, item in ipairs(updated) do
		local name = item.name or "Script"
		local lines = item.linesChanged or item.lines or "?"
		local line = Instance.new("TextLabel")
		line.Parent = diffCard; line.BackgroundTransparency = 1
		line.Position = UDim2.new(0, 10, 0, diffY); line.Size = UDim2.new(1, -20, 0, 14)
		line.Font = Enum.Font.Code; line.Text = "Updated: " .. name .. " (" .. tostring(lines) .. " lines changed)"
		line.TextColor3 = C.amber; line.TextSize = 10
		line.TextXAlignment = Enum.TextXAlignment.Left
		diffY = diffY + 16
	end

	for _, item in ipairs(deleted) do
		local name = item.name or "Script"
		local parent = item.parent or "?"
		local line = Instance.new("TextLabel")
		line.Parent = diffCard; line.BackgroundTransparency = 1
		line.Position = UDim2.new(0, 10, 0, diffY); line.Size = UDim2.new(1, -20, 0, 14)
		line.Font = Enum.Font.Code; line.Text = "Deleted: " .. name .. " from " .. parent
		line.TextColor3 = C.red; line.TextSize = 10
		line.TextXAlignment = Enum.TextXAlignment.Left
		diffY = diffY + 16
	end

	diffCard.Size = UDim2.new(1, 0, 0, diffY + 8)
end

-- ══════════════════════════════════════════════════════════════════════════════
-- SECURITY + PERFORMANCE SCAN
-- ══════════════════════════════════════════════════════════════════════════════

local function renderScanResults(scanData)
	if not scanData then return end

	local issues = scanData.issues or scanData.warnings or {}
	local critical = scanData.critical or {}
	local score = scanData.score

	local bgColor, borderColor, label, labelColor

	if #critical > 0 then
		bgColor = C.redDark; borderColor = C.red
		label = "Critical security issue: " .. (critical[1] or "unknown")
		labelColor = C.red
	elseif #issues > 0 then
		bgColor = C.yellowDark; borderColor = C.amber
		label = #issues .. " security warning" .. (#issues > 1 and "s" or "")
		labelColor = C.amber
	else
		bgColor = C.greenDark; borderColor = C.green
		label = "No security issues found"
		labelColor = C.green
	end

	local scanCard = Instance.new("Frame")
	scanCard.BackgroundColor3 = bgColor; scanCard.BorderSizePixel = 0
	scanCard.Size = UDim2.new(1, 0, 0, 0); scanCard.AutomaticSize = Enum.AutomaticSize.Y
	scanCard.Parent = OutputScroll; corner(scanCard, 8); stroke(scanCard, borderColor)

	local scanIcon = Instance.new("TextLabel")
	scanIcon.Parent = scanCard; scanIcon.BackgroundTransparency = 1
	scanIcon.Position = UDim2.new(0, 10, 0, 6); scanIcon.Size = UDim2.new(0, 16, 0, 16)
	scanIcon.Font = Enum.Font.Code; scanIcon.Text = (#critical > 0 and "✕" or (#issues > 0 and "⚠" or "✓"))
	scanIcon.TextColor3 = labelColor; scanIcon.TextSize = 12

	local scanLabel = Instance.new("TextLabel")
	scanLabel.Parent = scanCard; scanLabel.BackgroundTransparency = 1
	scanLabel.Position = UDim2.new(0, 30, 0, 6); scanLabel.Size = UDim2.new(1, -40, 0, 16)
	scanLabel.Font = Enum.Font.GothamBold; scanLabel.Text = label
	scanLabel.TextColor3 = labelColor; scanLabel.TextSize = 11
	scanLabel.TextXAlignment = Enum.TextXAlignment.Left

	local detailY = 26

	if score then
		local scoreLabel = Instance.new("TextLabel")
		scoreLabel.Parent = scanCard; scoreLabel.BackgroundTransparency = 1
		scoreLabel.Position = UDim2.new(0, 10, 0, detailY); scoreLabel.Size = UDim2.new(1, -20, 0, 14)
		scoreLabel.Font = Enum.Font.Code; scoreLabel.Text = "Score: " .. tostring(score) .. "/100"
		scoreLabel.TextColor3 = C.subtext; scoreLabel.TextSize = 10
		scoreLabel.TextXAlignment = Enum.TextXAlignment.Left
		detailY = detailY + 16
	end

	local allIssues = {}
	for _, c in ipairs(critical) do table.insert(allIssues, { text = c, color = C.red }) end
	for _, i in ipairs(issues) do table.insert(allIssues, { text = i, color = C.amber }) end

	for _, issue in ipairs(allIssues) do
		local issueLabel = Instance.new("TextLabel")
		issueLabel.Parent = scanCard; issueLabel.BackgroundTransparency = 1
		issueLabel.Position = UDim2.new(0, 10, 0, detailY); issueLabel.Size = UDim2.new(1, -20, 0, 14)
		issueLabel.Font = Enum.Font.Code; issueLabel.Text = "• " .. issue.text
		issueLabel.TextColor3 = issue.color; issueLabel.TextSize = 9
		issueLabel.TextXAlignment = Enum.TextXAlignment.Left; issueLabel.TextWrapped = true
		issueLabel.AutomaticSize = Enum.AutomaticSize.Y
		detailY = detailY + 16
	end

	scanCard.Size = UDim2.new(1, 0, 0, detailY + 6)
end

local function runScanOnOutput(data)
	if not data then return end
	if not savedToken or savedToken == "" then return end

	local codeParts = {}
	for _, scriptData in ipairs(data.scripts or {}) do
		if scriptData.code then
			table.insert(codeParts, scriptData.code)
		end
	end
	if #codeParts == 0 then return end

	task.spawn(function()
		local ok, result = pcall(function()
			return HttpService:RequestAsync({
				Url    = SCAN_URL,
				Method = "POST",
				Headers = {
					["Authorization"] = "Bearer " .. savedToken,
					["Content-Type"]  = "application/json",
				},
				Body = HttpService:JSONEncode({
					code = table.concat(codeParts, "\n---\n"),
				}),
			})
		end)
		if ok and result and result.StatusCode == 200 then
			local parseOk, scanData = pcall(function() return HttpService:JSONDecode(result.Body) end)
			if parseOk and scanData then
				renderScanResults(scanData)
			end
		end
	end)
end

-- ══════════════════════════════════════════════════════════════════════════════
-- UNDO / CHECKPOINT SYSTEM
-- ══════════════════════════════════════════════════════════════════════════════

local function addUndoButton(runId)
	if not runId then return end

	local undoCard = Instance.new("Frame")
	undoCard.BackgroundColor3 = C.panel2; undoCard.BorderSizePixel = 0
	undoCard.Size = UDim2.new(1, 0, 0, 36); undoCard.Parent = OutputScroll
	corner(undoCard, 8); stroke(undoCard, C.border)

	local undoBtn = makeTextButton(undoCard, "Undo Changes", C.redDark, C.text)
	undoBtn.Position = UDim2.new(0, 8, 0, 6); undoBtn.Size = UDim2.new(0, 120, 0, 24)
	undoBtn.TextSize = 10; stroke(undoBtn, C.red)
	animatePress(undoBtn, Color3.fromRGB(58, 22, 22))

	local checkBtn = nil
	if isAdvancedMode then
		checkBtn = makeTextButton(undoCard, "Create Checkpoint", C.panel3, C.text)
		checkBtn.Position = UDim2.new(0, 138, 0, 6); checkBtn.Size = UDim2.new(0, 130, 0, 24)
		checkBtn.TextSize = 10; stroke(checkBtn, C.border)
		animatePress(checkBtn, C.panel4)
	end

	undoBtn.MouseButton1Click:Connect(function()
		undoBtn.Text = "Rolling back..."
		task.spawn(function()
			local ok, result = pcall(function()
				return HttpService:RequestAsync({
					Url    = UNDO_URL,
					Method = "POST",
					Headers = {
						["Authorization"] = "Bearer " .. savedToken,
						["Content-Type"]  = "application/json",
					},
					Body = HttpService:JSONEncode({ runId = runId }),
				})
			end)
			if ok and result and result.StatusCode == 200 then
				showToast("Rolled back successfully", C.green)
				undoBtn.Text = "Rolled back"
				undoBtn.BackgroundColor3 = C.greenDark
				undoBtn.TextColor3 = C.green
			else
				showToast("Rollback failed", C.red)
				undoBtn.Text = "Undo Changes"
			end
		end)
	end)

	if checkBtn then
		checkBtn.MouseButton1Click:Connect(function()
			checkBtn.Text = "Saving..."
			task.spawn(function()
				local ok, result = pcall(function()
					return HttpService:RequestAsync({
						Url    = CHECKPOINT_URL,
						Method = "POST",
						Headers = {
							["Authorization"] = "Bearer " .. savedToken,
							["Content-Type"]  = "application/json",
						},
						Body = HttpService:JSONEncode({ runId = runId }),
					})
				end)
				if ok and result and result.StatusCode == 200 then
					showToast("Checkpoint created", C.green)
					checkBtn.Text = "Checkpoint Saved"
					checkBtn.BackgroundColor3 = C.greenDark
					checkBtn.TextColor3 = C.green
				else
					showToast("Checkpoint failed", C.red)
					checkBtn.Text = "Create Checkpoint"
				end
			end)
		end)
	end
end

-- ══════════════════════════════════════════════════════════════════════════════
-- PROJECT MEMORY SYSTEM
-- ══════════════════════════════════════════════════════════════════════════════

local function loadMemoryRules()
	local raw = plugin:GetSetting(MEMORY_RULES_KEY)
	if raw then
		local ok, rules = pcall(function() return HttpService:JSONDecode(raw) end)
		if ok and rules then memoryRules = rules end
	end
end

local function saveMemoryRules()
	local ok, encoded = pcall(function() return HttpService:JSONEncode(memoryRules) end)
	if ok then
		plugin:SetSetting(MEMORY_RULES_KEY, encoded)
	end
end

local function refreshMemoryDisplay()
	for _, frame in ipairs(memoryRuleFrames) do
		if frame and frame.Parent then frame:Destroy() end
	end
	memoryRuleFrames = {}

	for i, rule in ipairs(memoryRules) do
		local ruleCard = Instance.new("Frame")
		ruleCard.BackgroundColor3 = C.panel2; ruleCard.BorderSizePixel = 0
		ruleCard.Size = UDim2.new(1, 0, 0, 28); ruleCard.AutomaticSize = Enum.AutomaticSize.Y
		ruleCard.LayoutOrder = i
		corner(ruleCard, 6); stroke(ruleCard, C.border)

		local ruleText = Instance.new("TextLabel")
		ruleText.Parent = ruleCard; ruleText.BackgroundTransparency = 1
		ruleText.Position = UDim2.new(0, 8, 0, 4); ruleText.Size = UDim2.new(1, -36, 0, 20)
		ruleText.Font = Enum.Font.Gotham; ruleText.Text = rule
		ruleText.TextColor3 = C.text; ruleText.TextSize = 10; ruleText.TextWrapped = true
		ruleText.TextXAlignment = Enum.TextXAlignment.Left; ruleText.TextYAlignment = Enum.TextYAlignment.Top
		ruleText.AutomaticSize = Enum.AutomaticSize.Y

		local removeBtn = Instance.new("TextButton")
		removeBtn.Parent = ruleCard; removeBtn.BackgroundColor3 = C.redDark
		removeBtn.BorderSizePixel = 0; removeBtn.Position = UDim2.new(1, -28, 0, 4)
		removeBtn.Size = UDim2.new(0, 20, 0, 20); removeBtn.Text = "✕"
		removeBtn.TextColor3 = C.red; removeBtn.TextSize = 10; corner(removeBtn, 4)

		removeBtn.MouseButton1Click:Connect(function()
			table.remove(memoryRules, i)
			saveMemoryRules()
			refreshMemoryDisplay()
		end)

		table.insert(memoryRuleFrames, ruleCard)
	end
end

AddRuleBtn.MouseButton1Click:Connect(function()
	local inputCard = Instance.new("Frame")
	inputCard.BackgroundColor3 = C.panel3; inputCard.BorderSizePixel = 0
	inputCard.Size = UDim2.new(1, 0, 0, 60); inputCard.LayoutOrder = 0
	corner(inputCard, 6); stroke(inputCard, C.border)

	local input = Instance.new("TextBox")
	input.Parent = inputCard; input.BackgroundColor3 = C.panel2; input.BorderSizePixel = 0
	input.Position = UDim2.new(0, 8, 0, 6); input.Size = UDim2.new(1, -16, 0, 22)
	input.Font = Enum.Font.Gotham; input.PlaceholderText = "Enter rule..."
	input.PlaceholderColor3 = C.muted; input.Text = ""; input.TextColor3 = C.text
	input.TextSize = 10; input.ClearTextOnFocus = true
	corner(input, 4); stroke(input, C.border)
	input:CaptureFocus()

	local btnRow = Instance.new("Frame")
	btnRow.Parent = inputCard; btnRow.BackgroundTransparency = 1
	btnRow.Position = UDim2.new(0, 8, 0, 34); btnRow.Size = UDim2.new(1, -16, 0, 22)

	local saveRuleBtn = makeTextButton(btnRow, "Save", C.green, C.bg)
	saveRuleBtn.Size = UDim2.new(0, 60, 0, 22); saveRuleBtn.TextSize = 10

	local cancelRuleBtn = makeTextButton(btnRow, "Cancel", C.panel2, C.text)
	cancelRuleBtn.Position = UDim2.new(0, 68, 0, 0); cancelRuleBtn.Size = UDim2.new(0, 60, 0, 22)
	cancelRuleBtn.TextSize = 10; stroke(cancelRuleBtn, C.border)

	local function doSave()
		local text = input.Text
		if text and text ~= "" then
			table.insert(memoryRules, text)
			saveMemoryRules()
			refreshMemoryDisplay()
		end
		inputCard:Destroy()
	end

	saveRuleBtn.MouseButton1Click:Connect(doSave)
	cancelRuleBtn.MouseButton1Click:Connect(function() inputCard:Destroy() end)
	input.FocusLost:Connect(function(enterPressed) if enterPressed then doSave() end end)

	inputCard.Parent = MemoryBody
	AddRuleBtn.LayoutOrder = 9999
end)

-- ══════════════════════════════════════════════════════════════════════════════
-- SKILL SELECTOR SYSTEM
-- ══════════════════════════════════════════════════════════════════════════════

local function closeSkillDropdown()
	skillDropdownOpen = false
	SkillDropdownList.Visible = false
	SkillDropdownChevron.Text = "▼"
end

local function openSkillDropdown()
	skillDropdownOpen = true
	SkillDropdownList.Visible = true
	SkillDropdownChevron.Text = "▲"

	for _, child in ipairs(SkillDropdownScroll:GetChildren()) do
		if child:IsA("GuiObject") then child:Destroy() end
	end

	local noneBtn = Instance.new("TextButton")
	noneBtn.Parent = SkillDropdownScroll; noneBtn.BackgroundColor3 = C.panel2
	noneBtn.BorderSizePixel = 0; noneBtn.Size = UDim2.new(1, 0, 0, 26)
	noneBtn.Text = "None (default)"; noneBtn.TextColor3 = C.text; noneBtn.TextSize = 10
	noneBtn.Font = Enum.Font.Gotham; noneBtn.ZIndex = 13
	noneBtn.MouseButton1Click:Connect(function()
		selectedSkill = nil
		SkillDropdown.Text = "None (default)"
		closeSkillDropdown()
	end)

	local order = 1
	for _, skill in ipairs(availableSkills) do
		order = order + 1
		local btn = Instance.new("TextButton")
		btn.Parent = SkillDropdownScroll; btn.BackgroundColor3 = C.panel2
		btn.BorderSizePixel = 0; btn.Size = UDim2.new(1, 0, 0, 26)
		btn.Text = (skill.category and (skill.category .. ": ") or "") .. (skill.name or "Skill")
		btn.TextColor3 = C.text; btn.TextSize = 10; btn.Font = Enum.Font.Gotham
		btn.LayoutOrder = order; btn.ZIndex = 13

		btn.MouseButton1Click:Connect(function()
			selectedSkill = skill
			SkillDropdown.Text = btn.Text
			closeSkillDropdown()
		end)
	end

	SkillDropdownLayout.Parent = SkillDropdownScroll
end

SkillDropdown.MouseButton1Click:Connect(function()
	if skillDropdownOpen then closeSkillDropdown() else openSkillDropdown() end
end)

-- ══════════════════════════════════════════════════════════════════════════════
-- ADVANCED MODE TOGGLE
-- ══════════════════════════════════════════════════════════════════════════════

local function applyAdvancedMode()
	isAdvancedMode = plugin:GetSetting(ADVANCED_MODE_KEY) or false

	if isAdvancedMode then
		AdvancedToggle.Text = "Advanced"
		AdvancedToggle.TextColor3 = C.blue
		SkillSelectorFrame.Visible = true
		MemoryFrame.Visible = true
	else
		AdvancedToggle.Text = "Default"
		AdvancedToggle.TextColor3 = C.muted
		SkillSelectorFrame.Visible = false
		MemoryFrame.Visible = false
		closeSkillDropdown()
	end
end

AdvancedToggle.MouseButton1Click:Connect(function()
	isAdvancedMode = not isAdvancedMode
	plugin:SetSetting(ADVANCED_MODE_KEY, isAdvancedMode)
	applyAdvancedMode()
end)

-- ══════════════════════════════════════════════════════════════════════════════
-- MEMORY PANEL TOGGLE
-- ══════════════════════════════════════════════════════════════════════════════

MemoryHeader.MouseButton1Click:Connect(function()
	memoryOpen = not memoryOpen
	MemoryBody.Visible = memoryOpen
	MemoryChevron.Text = memoryOpen and "▼" or "▶"
end)

-- ══════════════════════════════════════════════════════════════════════════════
-- GAME MODEL SCANNING
-- ══════════════════════════════════════════════════════════════════════════════

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
			warn("[Wisp] game model delete failed")
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

-- ══════════════════════════════════════════════════════════════════════════════
-- INSTANCE INSERTION (existing logic)
-- ══════════════════════════════════════════════════════════════════════════════

local function resolveParentTarget(parentName, className, createdInstanceMap)
	local starterPlayer = game:GetService("StarterPlayer")
	-- direct map hit for instances created in this batch (e.g. parent == "KillBrick")
	if createdInstanceMap and parentName and createdInstanceMap[parentName] then
		return createdInstanceMap[parentName]
	end
	local raw = (parentName or ""):gsub("^%s+", ""):gsub("%s+$", "")
	if raw == "" then
		return game:GetService("ReplicatedStorage")
	end
	-- normalize: strip game. prefix, convert slashes to dots
	raw = raw:gsub("^game%.", ""):gsub("/", ".")
	local parts = {}
	for part in raw:gmatch("[^%.]+") do
		part = part:gsub("^%s+", ""):gsub("%s+$", "")
		if part ~= "" then table.insert(parts, part) end
	end
	if #parts == 0 then return game:GetService("ReplicatedStorage") end

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
		["lighting"]                = game:GetService("Lighting"),
		["replicatedfirst"]         = game:GetService("ReplicatedFirst"),
		["players"]                 = game:GetService("Players"),
	}

	-- handle dot-path like Workspace.resetblock8 or Workspace.Folder.Part
	local firstLower = parts[1]:lower()
	local root = builtInParents[firstLower]

	-- special: StarterPlayer -> StarterPlayerScripts default for scripts
	if firstLower == "starterplayer" then
		local cls = (className or ""):lower()
		if #parts == 1 and (cls == "localscript" or cls == "modulescript" or cls == "script") then
			return starterPlayer.StarterPlayerScripts
		end
		if #parts >= 2 then
			local secondLower = parts[2]:lower()
			if secondLower == "starterplayerscripts" then
				root = starterPlayer.StarterPlayerScripts
				table.remove(parts, 1)
				firstLower = parts[1]:lower()
			elseif secondLower == "startercharacterscripts" then
				root = starterPlayer.StarterCharacterScripts
				table.remove(parts, 1)
				firstLower = parts[1]:lower()
			end
		end
	end

	if not root then
		-- try case-insensitive created map with first segment
		if createdInstanceMap then
			for k, v in pairs(createdInstanceMap) do
				if k:lower() == firstLower then
					root = v
					table.remove(parts, 1)
					break
				end
			end
		end
		if not root then
			-- unknown root, attempt workspace search
			local maybe = workspace:FindFirstChild(parts[1], true)
			if maybe and maybe.Parent then
				-- if found deep, return its parent if AI meant to place inside it?
				-- we return the found instance itself if parts == 1, else its parent chain handled below
				-- for now fallback to workspace
			end
			return game:GetService("ReplicatedStorage")
		end
	else
		table.remove(parts, 1)
	end

	-- traverse remaining segments
	local current = root
	for _, seg in ipairs(parts) do
		local child = current:FindFirstChild(seg)
		if child then
			current = child
		else
			-- case-insensitive fallback
			local found
			for _, c in ipairs(current:GetChildren()) do
				if c.Name:lower() == seg:lower() then found = c; break end
			end
			if found then
				current = found
			else
				warn("[Wisp] resolveParentTarget: segment '"..seg.."' not found under "..current:GetFullName().." (full parent='"..(parentName or "").."'), using "..current:GetFullName())
				break
			end
		end
	end
	return current
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
			end
		end)
		if not ok then
			warn("[Wisp] deletion error:", err)
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
			local scriptName = scriptData.name or "WispScript"
			local code       = scriptData.code or "-- Inserted by Wisp\n"
			local parent     = resolveParentTarget(scriptData.parent, className, createdInstanceMap)
			-- safety: LocalScript must not go to server containers -- handles AI misplacement (e.g. StarterCharacterScripts script landing in ServerScriptService)
			local lowerType = (className or ""):lower()
			local parentFull = ""
			pcall(function() parentFull = parent:GetFullName():lower() end)
			if lowerType == "localscript" and (parentFull:find("serverscriptservice") or parentFull:find("serverstorage")) then
				local codeLower = (code or ""):lower()
				local isChar = codeLower:find("humanoid") or codeLower:find("characteradded") or codeLower:find("startercharacterscripts") or (codeLower:find("character") and codeLower:find("humanoid"))
				local isGui = codeLower:find("screengui") or codeLower:find("startergui") or (codeLower:find("frame") and codeLower:find("uilistlayout"))
				if isChar then
					parent = game:GetService("StarterPlayer").StarterCharacterScripts
					warn("[Wisp] auto-corrected LocalScript '"..scriptName.."' from "..(scriptData.parent or "?").." ("..parentFull..") -> StarterCharacterScripts (character/humanoid code)")
				elseif isGui then
					parent = game:GetService("StarterGui")
					warn("[Wisp] auto-corrected LocalScript '"..scriptName.."' from "..(scriptData.parent or "?").." -> StarterGui (UI code)")
				else
					parent = game:GetService("StarterPlayer").StarterPlayerScripts
					warn("[Wisp] auto-corrected LocalScript '"..scriptName.."' from "..(scriptData.parent or "?").." ("..parentFull..") -> StarterPlayerScripts")
				end
			elseif lowerType == "script" and (parentFull:find("starterplayerscripts") or parentFull:find("startercharacterscripts") or parentFull:find("startergui")) then
				parent = game:GetService("ServerScriptService")
				warn("[Wisp] auto-corrected Script '"..scriptName.."' from "..(scriptData.parent or "?").." ("..parentFull..") -> ServerScriptService (server script cannot run in client container)")
			end
			local existing   = parent:FindFirstChild(scriptName)
			if existing and existing:IsA("LuaSourceContainer") then
				existing.Source = code; updated = updated + 1
			else
				local inst = Instance.new(className)
				inst.Name = scriptName; inst.Source = code; inst.Parent = parent
				created = created + 1
			end
		end)
		if not ok then warn("[Wisp] insert error:", err) end
	end

	local parts = {}
	if deleted > 0 then table.insert(parts, "-" .. deleted .. " removed") end
	if created > 0 then table.insert(parts, "+" .. created .. " new") end
	if updated > 0 then table.insert(parts, "~" .. updated .. " updated") end
	local msg = #parts > 0 and table.concat(parts, "  ") or "No changes"
	setStatus(msg, C.green)
end

-- ══════════════════════════════════════════════════════════════════════════════
-- RENDER LATEST DATA (enhanced with diff, scan, undo)
-- ══════════════════════════════════════════════════════════════════════════════

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

	renderDiffSummary(data)

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

	if data.runId then
		lastRunId = data.runId
		addUndoButton(data.runId)
	end

	runScanOnOutput(data)
	insertLatestData()
	StateTitle.Text = "✓ Inserted"
	StateSub.Text   = "Output auto-inserted. Polling every " .. POLL_INTERVAL .. "s for new generations."
end

-- ══════════════════════════════════════════════════════════════════════════════
-- ORCHESTRATION SYSTEM
-- ══════════════════════════════════════════════════════════════════════════════

local function sendOrchestrateRequest(prompt)
	if not savedToken or savedToken == "" then return end
	if not selectedProject then setStatus("Select a project first.", C.amber); return end

	showTaskProgress("Planning...")
	startElapsedTimer()

	setStatus("Orchestrating...", C.blue)
	StatusPillDetail.Text = ""
	StatusPillTimer.Text = ""

	local body = {
		prompt    = prompt,
		projectId = selectedProject.id,
	}

	if isAdvancedMode and memoryRules and #memoryRules > 0 then
		body.rules = memoryRules
	end

	if isAdvancedMode and selectedSkill then
		body.skill = selectedSkill.id or selectedSkill.name
	end

	task.spawn(function()
		local ok, result = pcall(function()
			return HttpService:RequestAsync({
				Url    = ORCHESTRATE_URL,
				Method = "POST",
				Headers = {
					["Authorization"] = "Bearer " .. savedToken,
					["Content-Type"]  = "application/json",
				},
				Body = HttpService:JSONEncode(body),
			})
		end)

		stopElapsedTimer()

		if not ok then
			hideTaskProgress()
			setStatus("Orchestration failed.", C.red)
			return
		end

		if result.StatusCode == 401 then
			hideTaskProgress()
			setStatus("Session expired. Reconnect.", C.red)
			plugin:SetSetting(TOKEN_KEY, ""); savedToken = ""
			return
		end

		if result.StatusCode ~= 200 then
			hideTaskProgress()
			setStatus("Orchestration error (" .. tostring(result.StatusCode) .. ")", C.red)
			return
		end

		local parseOk, data = pcall(function() return HttpService:JSONDecode(result.Body) end)
		if not parseOk or not data then
			hideTaskProgress()
			setStatus("Bad orchestration response.", C.red)
			return
		end

		local tasks = data.tasks or data.steps or {}
		if #tasks > 0 then
			updateTaskProgress("Building " .. #tasks .. " tasks...")
			for i, taskItem in ipairs(tasks) do
				local taskName = taskItem.name or taskItem.title or ("Task " .. i)
				local taskStatus = taskItem.status or "completed"
				local taskType = taskItem.type or taskItem.kind
				local agentName = taskItem.agent or taskItem.agentName
				addTaskItem(taskName, taskStatus, taskType, agentName)
			end
		end

		updateTaskProgress("Reviewing...")
		task.wait(0.5)
		updateTaskProgress("Done!")
		task.wait(1)

		if data.model then
			setStatusDetail(data.model, data.tokensUsed, #tasks)
		end

		latestProjectData = data.result or data
		lastRunData = data
		renderLatestData(latestProjectData)

		fetchLatestForProject(selectedProject.id, true)
	end)
end

-- ══════════════════════════════════════════════════════════════════════════════
-- PROJECT DATA FETCHING
-- ══════════════════════════════════════════════════════════════════════════════

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

local function fetchSkills()
	if not savedToken or savedToken == "" then return end
	task.spawn(function()
		local ok, result = pcall(function()
			return HttpService:RequestAsync({
				Url    = BASE_URL .. "/api/plugin/skills",
				Method = "GET",
				Headers = { ["Authorization"] = "Bearer " .. savedToken },
			})
		end)
		if ok and result and result.StatusCode == 200 then
			local parseOk, data = pcall(function() return HttpService:JSONDecode(result.Body) end)
			if parseOk and data then
				availableSkills = data.skills or data or {}
			end
		end
	end)
end

local function fetchMemoryRules()
	if not savedToken or savedToken == "" then return end
	task.spawn(function()
		local ok, result = pcall(function()
			return HttpService:RequestAsync({
				Url    = MEMORY_URL,
				Method = "GET",
				Headers = { ["Authorization"] = "Bearer " .. savedToken },
			})
		end)
		if ok and result and result.StatusCode == 200 then
			local parseOk, data = pcall(function() return HttpService:JSONDecode(result.Body) end)
			if parseOk and data then
				memoryRules = data.rules or data or {}
				saveMemoryRules()
				refreshMemoryDisplay()
			end
		end
	end)
end

-- ══════════════════════════════════════════════════════════════════════════════
-- HEARTBEAT + POLLING
-- ══════════════════════════════════════════════════════════════════════════════

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

-- ══════════════════════════════════════════════════════════════════════════════
-- CONNECT / DISCONNECT
-- ══════════════════════════════════════════════════════════════════════════════

function showDisconnected()
	setProjectPickerText("No project selected")
	StateTitle.Text       = "Not connected"
	StateSub.Text         = "Connect to browse your projects and insert generated output."
	ProjectNameLabel.Text = "No project selected"
	ProjectMetaLabel.Text = "Generate from the dashboard, then insert here."
	PollTimerLabel.Text   = ""
	StatusPillDetail.Text = ""
	StatusPillTimer.Text  = ""
	selectedProject = nil; latestProjectData = nil; lastRunId = nil; lastRunData = nil
	clearProjectList(); clearOutput(); hideTaskProgress()
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
	fetchSkills()
	fetchMemoryRules()
end

-- ══════════════════════════════════════════════════════════════════════════════
-- PROJECT BUTTONS
-- ══════════════════════════════════════════════════════════════════════════════

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

-- ══════════════════════════════════════════════════════════════════════════════
-- SIGN IN
-- ══════════════════════════════════════════════════════════════════════════════

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
		local maxAttempts = 180
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

-- ══════════════════════════════════════════════════════════════════════════════
-- BUTTON CONNECTIONS
-- ══════════════════════════════════════════════════════════════════════════════

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

-- ══════════════════════════════════════════════════════════════════════════════
-- INIT
-- ══════════════════════════════════════════════════════════════════════════════

ProjectPickerBtn.Active           = false
ProjectPickerBtn.AutoButtonColor  = false
ProjectPickerBtn.TextTransparency = 0.45
PickerChevron.TextTransparency    = 0.45
ProjectDropdown.Visible  = false

loadMemoryRules()
refreshMemoryDisplay()
applyAdvancedMode()

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

