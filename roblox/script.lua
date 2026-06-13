--[[
	Extoboost Key System - Roblox Client Script
	Place this in a LocalScript inside StarterPlayerScripts
	Dependencies: Requires HttpService, TweenService, UserInputService
--]]

local HttpService = game:GetService("HttpService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local Players = game:GetService("Players")
local LocalPlayer = Players.LocalPlayer

-- Configuration
local CONFIG = {
	ApiBaseUrl = "http://localhost:4000/api/v1",
	WindowTitle = "Extoboost Key System",
	ThemeColor = Color3.fromRGB(37, 99, 235),
	AccentColor = Color3.fromRGB(34, 197, 94),
	DangerColor = Color3.fromRGB(239, 68, 68),
	BackgroundColor = Color3.fromRGB(10, 10, 26),
	SurfaceColor = Color3.fromRGB(17, 17, 37),
	BorderColor = Color3.fromRGB(36, 36, 69),
	TextColor = Color3.fromRGB(255, 255, 255),
	MutedColor = Color3.fromRGB(156, 163, 175),
}

-- ScreenGui setup
local ScreenGui = Instance.new("ScreenGui")
ScreenGui.Name = "ExtoboostGUI"
ScreenGui.ResetOnSpawn = false
ScreenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

local TweenInfo_Default = TweenInfo.new(0.3, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)

-- Utility Functions
local function CreateInstance(className, properties)
	local obj = Instance.new(className)
	for k, v in pairs(properties or {}) do
		obj[k] = v
	end
	return obj
end

local function CreateCorner(parent, radius)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius or 8)
	c.Parent = parent
	return c
end

local function CreatePadding(parent, padding)
	local p = Instance.new("UIPadding")
	p.PaddingTop = UDim.new(0, padding or 8)
	p.PaddingBottom = UDim.new(0, padding or 8)
	p.PaddingLeft = UDim.new(0, padding or 8)
	p.PaddingRight = UDim.new(0, padding or 8)
	p.Parent = parent
	return p
end

local function CreateStroke(parent, color, thickness)
	local s = Instance.new("UIStroke")
	s.Color = color or CONFIG.BorderColor
	s.Thickness = thickness or 1
	s.Parent = parent
	return s
end

local function CreateListLayout(parent, padding)
	local l = Instance.new("UIListLayout")
	l.Padding = UDim.new(0, padding or 8)
	l.HorizontalAlignment = Enum.HorizontalAlignment.Center
	l.SortOrder = Enum.SortOrder.LayoutOrder
	l.Parent = parent
	return l
end

-- Main Window
local Window = CreateInstance("Frame", {
	Name = "Window",
	Size = UDim2.new(0, 420, 0, 520),
	Position = UDim2.new(0.5, -210, 0.5, -260),
	BackgroundColor3 = CONFIG.BackgroundColor,
	BorderSizePixel = 0,
	Parent = ScreenGui,
})
CreateCorner(Window, 16)
CreateStroke(Window, CONFIG.BorderColor, 1.5)

-- Title Bar
local TitleBar = CreateInstance("Frame", {
	Name = "TitleBar",
	Size = UDim2.new(1, 0, 0, 44),
	BackgroundColor3 = CONFIG.SurfaceColor,
	BorderSizePixel = 0,
	Parent = Window,
})
CreateCorner(TitleBar, 16)
local TitleBarCornerClip = CreateInstance("UICorner", {
	CornerRadius = UDim.new(0, 16),
	Parent = TitleBar,
})
-- Use a separate frame to cover bottom corners
local TitleBarFill = CreateInstance("Frame", {
	Size = UDim2.new(1, 0, 0, 20),
	Position = UDim2.new(0, 0, 1, -20),
	BackgroundColor3 = CONFIG.SurfaceColor,
	BorderSizePixel = 0,
	Parent = Window,
})

local TitleText = CreateInstance("TextLabel", {
	Name = "Title",
	Size = UDim2.new(1, -48, 1, 0),
	Position = UDim2.new(0, 16, 0, 0),
	BackgroundTransparency = 1,
	Text = "Extoboost Key System",
	TextColor3 = CONFIG.TextColor,
	TextSize = 18,
	TextXAlignment = Enum.TextXAlignment.Left,
	Font = Enum.Font.GothamBold,
	Parent = TitleBar,
})

local CloseButton = CreateInstance("ImageButton", {
	Name = "Close",
	Size = UDim2.new(0, 28, 0, 28),
	Position = UDim2.new(1, -38, 0.5, -14),
	BackgroundColor3 = CONFIG.DangerColor,
	BackgroundTransparency = 0.8,
	Parent = TitleBar,
})
CreateCorner(CloseButton, 6)
local CloseIcon = CreateInstance("TextLabel", {
	Text = "X",
	Size = UDim2.new(1, 0, 1, 0),
	BackgroundTransparency = 1,
	TextColor3 = CONFIG.TextColor,
	TextSize = 14,
	Font = Enum.Font.GothamBold,
	Parent = CloseButton,
})

-- Drag functionality
local dragging, dragStart, startPos
TitleBar.InputBegan:Connect(function(input)
	if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
		dragging = true
		dragStart = input.Position
		startPos = Window.Position
		input.Changed:Connect(function()
			if input.UserInputState == Enum.UserInputState.End then
				dragging = false
			end
		end)
	end
end)
UserInputService.InputChanged:Connect(function(input)
	if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
		local delta = input.Position - dragStart
		Window.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + delta.X, startPos.Y.Scale, startPos.Y.Offset + delta.Y)
	end
end)

-- Content Container
local ContentContainer = CreateInstance("ScrollingFrame", {
	Name = "Content",
	Size = UDim2.new(1, -32, 1, -60),
	Position = UDim2.new(0, 16, 0, 52),
	BackgroundTransparency = 1,
	BorderSizePixel = 0,
	ScrollBarThickness = 4,
	ScrollBarImageColor3 = CONFIG.BorderColor,
	CanvasSize = UDim2.new(0, 0, 0, 0),
	AutomaticCanvasSize = Enum.AutomaticSize.Y,
	Parent = Window,
})
local ContentList = CreateListLayout(ContentContainer, 12)

-- Status Indicator
local StatusFrame = CreateInstance("Frame", {
	Size = UDim2.new(1, 0, 0, 60),
	BackgroundColor3 = CONFIG.SurfaceColor,
	BorderSizePixel = 0,
	Parent = ContentContainer,
})
CreateCorner(StatusFrame, 10)
CreateStroke(StatusFrame, CONFIG.BorderColor)

local StatusIcon = CreateInstance("Frame", {
	Size = UDim2.new(0, 12, 0, 12),
	Position = UDim2.new(0, 14, 0.5, -6),
	BackgroundColor3 = CONFIG.DangerColor,
	BorderSizePixel = 0,
	Parent = StatusFrame,
})
CreateCorner(StatusIcon, 6)

local StatusText = CreateInstance("TextLabel", {
	Size = UDim2.new(1, -40, 1, 0),
	Position = UDim2.new(0, 34, 0, 0),
	BackgroundTransparency = 1,
	Text = "Not Verified",
	TextColor3 = CONFIG.MutedColor,
	TextSize = 15,
	TextXAlignment = Enum.TextXAlignment.Left,
	Font = Enum.Font.GothamSemibold,
	Parent = StatusFrame,
})

-- Key Entry Section
local KeyEntryFrame = CreateInstance("Frame", {
	Size = UDim2.new(1, 0, 0, 140),
	BackgroundColor3 = CONFIG.SurfaceColor,
	BorderSizePixel = 0,
	Parent = ContentContainer,
})
CreateCorner(KeyEntryFrame, 10)
CreateStroke(KeyEntryFrame, CONFIG.BorderColor)
CreatePadding(KeyEntryFrame, 14)

local KeyEntryList = CreateListLayout(KeyEntryFrame, 10)

local KeyEntryLabel = CreateInstance("TextLabel", {
	Size = UDim2.new(1, 0, 0, 24),
	BackgroundTransparency = 1,
	Text = "Enter Your Verification Key",
	TextColor3 = CONFIG.TextColor,
	TextSize = 16,
	Font = Enum.Font.GothamSemibold,
	Parent = KeyEntryFrame,
})

local KeyInput = CreateInstance("TextBox", {
	Name = "KeyInput",
	Size = UDim2.new(1, 0, 0, 42),
	BackgroundColor3 = CONFIG.BackgroundColor,
	BorderSizePixel = 0,
	PlaceholderText = "XXXX-XXXX-XXXX-XXXX",
	PlaceholderColor3 = CONFIG.MutedColor,
	Text = "",
	TextColor3 = CONFIG.TextColor,
	TextSize = 18,
	Font = Enum.Font.GothamBold,
	ClearTextOnFocus = false,
	Parent = KeyEntryFrame,
})
CreateCorner(KeyInput, 8)
CreateStroke(KeyInput, CONFIG.BorderColor)

-- Force uppercase input
KeyInput.FocusLost:Connect(function()
	KeyInput.Text = string.upper(KeyInput.Text)
end)
KeyInput:GetPropertyChangedSignal("Text"):Connect(function()
	KeyInput.Text = string.upper(KeyInput.Text)
end)

local VerifyButton = CreateInstance("TextButton", {
	Name = "VerifyButton",
	Size = UDim2.new(1, 0, 0, 42),
	BackgroundColor3 = CONFIG.ThemeColor,
	BorderSizePixel = 0,
	Text = "Verify Key",
	TextColor3 = CONFIG.TextColor,
	TextSize = 16,
	Font = Enum.Font.GothamBold,
	AutoButtonColor = false,
	Parent = KeyEntryFrame,
})
CreateCorner(VerifyButton, 8)

VerifyButton.MouseEnter:Connect(function()
	TweenService:Create(VerifyButton, TweenInfo_Default, { BackgroundColor3 = CONFIG.ThemeColor:Lerp(Color3.fromRGB(255,255,255), 0.15) }):Play()
end)
VerifyButton.MouseLeave:Connect(function()
	TweenService:Create(VerifyButton, TweenInfo_Default, { BackgroundColor3 = CONFIG.ThemeColor }):Play()
end)

-- Get Key Section
local GetKeyFrame = CreateInstance("Frame", {
	Size = UDim2.new(1, 0, 0, 110),
	BackgroundColor3 = CONFIG.SurfaceColor,
	BorderSizePixel = 0,
	Parent = ContentContainer,
})
CreateCorner(GetKeyFrame, 10)
CreateStroke(GetKeyFrame, CONFIG.BorderColor)
CreatePadding(GetKeyFrame, 14)

local GetKeyList = CreateListLayout(GetKeyFrame, 10)

local GetKeyLabel = CreateInstance("TextLabel", {
	Size = UDim2.new(1, 0, 0, 20),
	BackgroundTransparency = 1,
	Text = "Don't have a key?",
	TextColor3 = CONFIG.MutedColor,
	TextSize = 14,
	Font = Enum.Font.Gotham,
	Parent = GetKeyFrame,
})

local GetKeyButton = CreateInstance("TextButton", {
	Name = "GetKeyButton",
	Size = UDim2.new(1, 0, 0, 42),
	BackgroundColor3 = CONFIG.AccentColor,
	BorderSizePixel = 0,
	Text = "Get Key",
	TextColor3 = CONFIG.TextColor,
	TextSize = 16,
	Font = Enum.Font.GothamBold,
	AutoButtonColor = false,
	Parent = GetKeyFrame,
})
CreateCorner(GetKeyButton, 8)

GetKeyButton.MouseEnter:Connect(function()
	TweenService:Create(GetKeyButton, TweenInfo_Default, { BackgroundColor3 = CONFIG.AccentColor:Lerp(Color3.fromRGB(255,255,255), 0.15) }):Play()
end)
GetKeyButton.MouseLeave:Connect(function()
	TweenService:Create(GetKeyButton, TweenInfo_Default, { BackgroundColor3 = CONFIG.AccentColor }):Play()
end)

-- Notification Toast
local NotificationHolder = CreateInstance("Frame", {
	Name = "Notification",
	Size = UDim2.new(1, -32, 0, 0),
	Position = UDim2.new(0, 16, 1, -16),
	AnchorPoint = Vector2.new(0, 1),
	BackgroundTransparency = 1,
	Parent = Window,
})

local function ShowNotification(message, isError)
	local notif = CreateInstance("Frame", {
		Size = UDim2.new(1, 0, 0, 44),
		BackgroundColor3 = isError and CONFIG.DangerColor or CONFIG.AccentColor,
		BorderSizePixel = 0,
		Position = UDim2.new(0, 0, 0, 60),
		BackgroundTransparency = 0.2,
		Parent = NotificationHolder,
	})
	CreateCorner(notif, 8)

	local notifText = CreateInstance("TextLabel", {
		Size = UDim2.new(1, -24, 1, 0),
		Position = UDim2.new(0, 12, 0, 0),
		BackgroundTransparency = 1,
		Text = message,
		TextColor3 = CONFIG.TextColor,
		TextSize = 14,
		Font = Enum.Font.GothamSemibold,
		Parent = notif,
	})

	local tween = TweenService:Create(notif, TweenInfo.new(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Position = UDim2.new(0, 0, 0, 0), BackgroundTransparency = 0 })
	tween:Play()

	task.delay(4, function()
		local hideTween = TweenService:Create(notif, TweenInfo.new(0.3), { Position = UDim2.new(0, 0, 0, 60), BackgroundTransparency = 1 })
		hideTween:Play()
		hideTween.Completed:Connect(function()
			notif:Destroy()
		end)
	end)
end

-- Script Hub Executor Layout (shown on successful verification)
local function ShowExecutorPanel()
	-- Clear content
	for _, child in ipairs(ContentContainer:GetChildren()) do
		if child:IsA("Frame") then
			child.Visible = false
		end
	end

	local ExecutorFrame = CreateInstance("Frame", {
		Size = UDim2.new(1, 0, 0, 320),
		BackgroundColor3 = CONFIG.SurfaceColor,
		BorderSizePixel = 0,
		Parent = ContentContainer,
	})
	CreateCorner(ExecutorFrame, 10)
	CreateStroke(ExecutorFrame, CONFIG.AccentColor)
	CreatePadding(ExecutorFrame, 14)

	local ExecutorList = CreateListLayout(ExecutorFrame, 8)

	local ExecutorTitle = CreateInstance("TextLabel", {
		Size = UDim2.new(1, 0, 0, 28),
		BackgroundTransparency = 1,
		Text = "Script Hub - Unlocked",
		TextColor3 = CONFIG.AccentColor,
		TextSize = 18,
		Font = Enum.Font.GothamBold,
		Parent = ExecutorFrame,
	})

	local ScriptInput = CreateInstance("TextBox", {
		Size = UDim2.new(1, 0, 0, 140),
		BackgroundColor3 = CONFIG.BackgroundColor,
		BorderSizePixel = 0,
		PlaceholderText = "-- Paste your script here...",
		PlaceholderColor3 = CONFIG.MutedColor,
		Text = "",
		TextColor3 = CONFIG.TextColor,
		TextSize = 14,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextYAlignment = Enum.TextYAlignment.Top,
		Font = Enum.Font.Code,
		MultiLine = true,
		ClearTextOnFocus = false,
		Parent = ExecutorFrame,
	})
	CreateCorner(ScriptInput, 8)
	CreateStroke(ScriptInput, CONFIG.BorderColor)

	local ButtonRow = CreateInstance("Frame", {
		Size = UDim2.new(1, 0, 0, 42),
		BackgroundTransparency = 1,
		Parent = ExecutorFrame,
	})

	local ExecuteButton = CreateInstance("TextButton", {
		Size = UDim2.new(0.48, 0, 1, 0),
		Position = UDim2.new(0, 0, 0, 0),
		BackgroundColor3 = CONFIG.AccentColor,
		BorderSizePixel = 0,
		Text = "Execute",
		TextColor3 = CONFIG.TextColor,
		TextSize = 15,
		Font = Enum.Font.GothamBold,
		Parent = ButtonRow,
	})
	CreateCorner(ExecuteButton, 8)

	local ClearButton = CreateInstance("TextButton", {
		Size = UDim2.new(0.48, 0, 1, 0),
		Position = UDim2.new(0.52, 0, 0, 0),
		BackgroundColor3 = CONFIG.DangerColor,
		BackgroundTransparency = 0.4,
		BorderSizePixel = 0,
		Text = "Clear",
		TextColor3 = CONFIG.TextColor,
		TextSize = 15,
		Font = Enum.Font.GothamBold,
		Parent = ButtonRow,
	})
	CreateCorner(ClearButton, 8)

	ExecuteButton.MouseButton1Click:Connect(function()
		if ScriptInput.Text ~= "" then
			local success, err = pcall(function()
				loadstring(ScriptInput.Text)()
			end)
			if success then
				ShowNotification("Script executed successfully", false)
			else
				ShowNotification("Script error: " .. tostring(err), true)
			end
		end
	end)

	ClearButton.MouseButton1Click:Connect(function()
		ScriptInput.Text = ""
	end)

	StatusText.Text = "Verified & Unlocked"
	StatusText.TextColor3 = CONFIG.AccentColor
	StatusIcon.BackgroundColor3 = CONFIG.AccentColor

	Window.Size = UDim2.new(0, 420, 0, 450)
	ContentContainer.CanvasSize = UDim2.new(0, 0, 0, 340)
end

-- Verify button logic
VerifyButton.MouseButton1Click:Connect(function()
	local key = KeyInput.Text
	if #key < 16 then
		ShowNotification("Please enter a valid 16-character key", true)
		return
	end

	VerifyButton.Text = "Verifying..."
	VerifyButton.Active = false

	local url = CONFIG.ApiBaseUrl .. "/verify-key?player_id=" .. LocalPlayer.UserId .. "&key=" .. HttpService:UrlEncode(key)

	local success, result = pcall(function()
		local response = HttpService:GetAsync(url)
		return HttpService:JSONDecode(response)
	end)

	VerifyButton.Text = "Verify Key"
	VerifyButton.Active = true

	if success and result then
		if result.success then
			ShowNotification("Key accepted! System unlocked.", false)
			ShowExecutorPanel()
		else
			ShowNotification("Incorrect or Expired Key!", true)
		end
	else
		ShowNotification("Failed to connect to verification server", true)
	end
end)

-- Get Key button prints the gateway link
GetKeyButton.MouseButton1Click:Connect(function()
	local gatewayUrl = CONFIG.ApiBaseUrl .. "/ads/generate"
	print("=== Extoboost Key System ===")
	print("Visit the web dashboard to generate your key:")
	print(CONFIG.ApiBaseUrl:gsub("/api/v1", ""):gsub("localhost", "127.0.0.1") .. "/ad-gateway")
	print("Complete the ad verification to receive your 16-character code.")
	print("===========================")
	ShowNotification("Gateway link printed to console", false)
end)

-- Close button
CloseButton.MouseButton1Click:Connect(function()
	ScreenGui:Destroy()
end)

-- Show the GUI
ScreenGui.Parent = LocalPlayer:WaitForChild("PlayerGui")

-- Toggle with Right Shift
UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if not gameProcessed and input.KeyCode == Enum.KeyCode.RightShift then
		ScreenGui.Enabled = not ScreenGui.Enabled
	end
end)

print("Extoboost Key System loaded. Press Right Shift to toggle.")
