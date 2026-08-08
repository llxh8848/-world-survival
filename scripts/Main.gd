extends Node

func _ready() -> void:
	print("=== 3D Survival Game ===")
	print("WASD: 移动 | 鼠标: 视角 | 空格: 跳跃 | Shift: 冲刺")
	print("左键: 攻击/采集 | 右键: 使用物品 | E: 交互")
	print("I: 背包 | C: 合成 | B: 建造 | ESC: 释放鼠标")

func _input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		var player = GameManager.player
		if player:
			if player.mouse_captured:
				player.mouse_captured = false
				Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
			else:
				player.mouse_captured = true
				Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
