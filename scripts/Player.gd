extends CharacterBody3D

signal stats_changed(stats: Dictionary)
signal interact_detected(target: Node)
signal interact_lost

const WALK_SPEED: float = 5.0
const SPRINT_SPEED: float = 8.0
const JUMP_VELOCITY: float = 4.5
const MOUSE_SENSITIVITY: float = 0.003

var gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")

var camera_pivot: Node3D
var camera: Camera3D
var interaction_ray: RayCast3D
var attack_area: Area3D
var build_preview: MeshInstance3D

var is_sprinting: bool = false
var can_move: bool = true
var mouse_captured: bool = true

var survival_stats: Dictionary = {
	"health": 100.0,
	"max_health": 100.0,
	"hunger": 100.0,
	"max_hunger": 100.0,
	"thirst": 100.0,
	"max_thirst": 100.0,
	"temperature": 37.0,
	"max_temperature": 42.0,
	"min_temperature": 34.0,
}

const HUNGER_RATE: float = 0.3
const THIRST_RATE: float = 0.4
const HUNGER_DAMAGE: float = 0.5
const THIRST_DAMAGE: float = 0.7
const COLD_DAMAGE: float = 1.0
const HEAT_DAMAGE: float = 1.0

var _stat_timer: float = 0.0
var _interaction_target: Node = null
var _attack_cooldown: float = 0.0
var _attack_anim_timer: float = 0.0

func _ready() -> void:
	camera_pivot = $CameraPivot
	camera = $CameraPivot/Camera3D
	interaction_ray = $CameraPivot/Camera3D/InteractionRay
	attack_area = $CameraPivot/Camera3D/AttackArea
	build_preview = $BuildPreview

	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	GameManager.register_player(self)

	interaction_ray.collision_mask = 0b10000

func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_LEFT:
			_attack()
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			_use_item()

	if event is InputEventMouseMotion and mouse_captured:
		rotate_y(-event.relative.x * MOUSE_SENSITIVITY)
		camera_pivot.rotate_x(-event.relative.y * MOUSE_SENSITIVITY)
		camera_pivot.rotation.x = clamp(camera_pivot.rotation.x, -PI/2 + 0.1, PI/2 - 0.1)

	if event.is_action_pressed("inventory"):
		_toggle_inventory()
	if event.is_action_pressed("crafting"):
		_toggle_crafting()
	if event.is_action_pressed("build"):
		_toggle_build_mode()

	for i in range(5):
		if event.is_action_pressed("hotbar_" + str(i + 1)):
			InventoryManager.select_hotbar(i)

func _physics_process(delta: float) -> void:
	if not can_move:
		return

	if not is_on_floor():
		velocity.y -= gravity * delta

	if Input.is_action_just_pressed("jump") and is_on_floor():
		velocity.y = JUMP_VELOCITY

	is_sprinting = Input.is_action_pressed("sprint") and survival_stats["hunger"] > 5.0
	var speed = SPRINT_SPEED if is_sprinting else WALK_SPEED

	var input_dir = Input.get_vector("move_left", "move_right", "move_forward", "move_backward")
	var direction = (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
	if direction:
		velocity.x = direction.x * speed
		velocity.z = direction.z * speed
	else:
		velocity.x = move_toward(velocity.x, 0, speed * delta * 10)
		velocity.z = move_toward(velocity.z, 0, speed * delta * 10)

	move_and_slide()

	_update_stats(delta)
	_update_interaction()
	_update_attack(delta)
	_update_build_preview()

func _update_stats(delta: float) -> void:
	_stat_timer += delta
	if _stat_timer < 1.0:
		return
	_stat_timer = 0.0

	survival_stats["hunger"] = max(0, survival_stats["hunger"] - HUNGER_RATE)
	survival_stats["thirst"] = max(0, survival_stats["thirst"] - THIRST_RATE)

	if survival_stats["hunger"] <= 0:
		survival_stats["health"] = max(0, survival_stats["health"] - HUNGER_DAMAGE)
	if survival_stats["thirst"] <= 0:
		survival_stats["health"] = max(0, survival_stats["health"] - THIRST_DAMAGE)

	var is_night = GameManager.is_night
	if is_night and survival_stats["temperature"] > 34.5:
		survival_stats["temperature"] -= 0.1
	elif not is_night and survival_stats["temperature"] < 38.0:
		survival_stats["temperature"] += 0.05

	if survival_stats["temperature"] < 35.0:
		survival_stats["health"] = max(0, survival_stats["health"] - COLD_DAMAGE)
	elif survival_stats["temperature"] > 40.0:
		survival_stats["health"] = max(0, survival_stats["health"] - HEAT_DAMAGE)

	if survival_stats["hunger"] > 50 and survival_stats["thirst"] > 50 and survival_stats["health"] < survival_stats["max_health"]:
		survival_stats["health"] = min(survival_stats["max_health"], survival_stats["health"] + 1.0)

	stats_changed.emit(survival_stats.duplicate(true))

	if survival_stats["health"] <= 0:
		_on_death()

func _update_interaction() -> void:
	if interaction_ray.is_colliding():
		var collider = interaction_ray.get_collider()
		if collider != _interaction_target:
			_interaction_target = collider
			interact_detected.emit(collider)
	else:
		if _interaction_target != null:
			_interaction_target = null
			interact_lost.emit()

	if Input.is_action_just_pressed("interact") and _interaction_target:
		if _interaction_target.has_method("interact"):
			_interaction_target.interact(self)

func _update_attack(delta: float) -> void:
	_attack_cooldown = max(0, _attack_cooldown - delta)
	_attack_anim_timer = max(0, _attack_anim_timer - delta)
	if _attack_anim_timer > 0:
		camera.rotation.z = lerp(camera.rotation.z, sin(_attack_anim_timer * 20) * 0.05, 0.5)
	else:
		camera.rotation.z = lerp(camera.rotation.z, 0.0, 0.3)

func _attack() -> void:
	if _attack_cooldown > 0:
		return
	_attack_cooldown = 0.5
	_attack_anim_timer = 0.3

	var selected = InventoryManager.get_selected_item()
	var damage = 5
	if selected["id"] != "":
		var info = InventoryManager.get_item_info(selected["id"])
		damage = info.get("damage", 5)

	var bodies = attack_area.get_overlapping_bodies()
	for body in bodies:
		if body.is_in_group("enemy"):
			if body.has_method("take_damage"):
				body.take_damage(damage)
		elif body.is_in_group("resource"):
			var tool_power = 0
			if selected["id"] != "":
				var info = InventoryManager.get_item_info(selected["id"])
				if body.is_in_group("tree"):
					tool_power = info.get("chopping_power", 0)
				elif body.is_in_group("rock"):
					tool_power = info.get("mining_power", 0)
			if body.has_method("harvest"):
				body.harvest(tool_power, self)

func _use_item() -> void:
	var selected = InventoryManager.get_selected_item()
	if selected["id"] == "":
		return
	var info = InventoryManager.get_item_info(selected["id"])

	if info.get("hunger", 0) > 0 or info.get("thirst", 0) > 0:
		if info.get("hunger", 0) > 0:
			survival_stats["hunger"] = min(survival_stats["max_hunger"], survival_stats["hunger"] + info["hunger"])
		if info.get("thirst", 0) > 0:
			survival_stats["thirst"] = min(survival_stats["max_thirst"], survival_stats["thirst"] + info["thirst"])
		InventoryManager.remove_item(selected["id"], 1)
		stats_changed.emit(survival_stats.duplicate(true))

func _update_build_preview() -> void:
	if not build_preview.visible:
		return
	var space_state = get_world_3d().direct_space_state
	var from = camera.global_position
	var to = from - camera.global_transform.basis.z * 5.0
	var query = PhysicsRayQueryParameters3D.create(from, to)
	query.collision_mask = 0b00001
	var result = space_state.intersect_ray(query)
	if result:
		build_preview.global_position = result["position"].snapped(Vector3(1, 0, 1))

var _build_mode: bool = false

func _toggle_build_mode() -> void:
	_build_mode = not _build_mode
	build_preview.visible = _build_mode

func _toggle_inventory() -> void:
	var ui = get_node_or_null("/root/Main/UI/InventoryUI")
	if ui:
		ui.toggle()

func _toggle_crafting() -> void:
	var ui = get_node_or_null("/root/Main/UI/CraftingUI")
	if ui:
		ui.toggle()

func get_interaction_target() -> Node:
	return _interaction_target

func take_damage(amount: float) -> void:
	survival_stats["health"] = max(0, survival_stats["health"] - amount)
	stats_changed.emit(survival_stats.duplicate(true))
	if survival_stats["health"] <= 0:
		_on_death()

func heal(amount: float) -> void:
	survival_stats["health"] = min(survival_stats["max_health"], survival_stats["health"] + amount)
	stats_changed.emit(survival_stats.duplicate(true))

func _on_death() -> void:
	can_move = false
	GameManager.on_player_death()
	print("Player died!")
	await get_tree().create_timer(3.0).timeout
	survival_stats["health"] = survival_stats["max_health"]
	survival_stats["hunger"] = survival_stats["max_hunger"]
	survival_stats["thirst"] = survival_stats["max_thirst"]
	survival_stats["temperature"] = 37.0
	global_position = Vector3(0, 5, 0)
	can_move = true
	GameManager.respawn_player()
