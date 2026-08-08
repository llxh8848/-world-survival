extends CharacterBody3D

signal enemy_killed(enemy: Node)
signal enemy_damaged(amount: float)

@export var max_health: float = 50.0
@export var move_speed: float = 3.0
@export var attack_damage: float = 10.0
@export var attack_range: float = 2.0
@export var detect_range: float = 15.0
@export var xp_reward: int = 10

var current_health: float
var player: CharacterBody3D = null
var state: String = "idle"
var _attack_cooldown: float = 0.0
var _wander_direction: Vector3 = Vector3.ZERO
var _wander_timer: float = 0.0
var _hit_flash_timer: float = 0.0

var mesh_instance: MeshInstance3D
var nav_agent: NavigationAgent3D
var detection_area: Area3D

func _ready() -> void:
	current_health = max_health
	add_to_group("enemy")
	player = GameManager.player
	mesh_instance = $MeshInstance3D
	nav_agent = $NavigationAgent3D
	detection_area = $DetectionArea

func _physics_process(delta: float) -> void:
	if not is_inside_tree():
		return

	_attack_cooldown = max(0, _attack_cooldown - delta)

	if _hit_flash_timer > 0:
		_hit_flash_timer -= delta
		if mesh_instance:
			var mat = mesh_instance.get_active_material(0) as StandardMaterial3D
			if mat:
				mat.albedo_color = Color.WHITE.lerp(Color(3, 0.5, 0.5), _hit_flash_timer / 0.2)

	if not is_on_floor():
		velocity.y -= 9.8 * delta

	if player and is_instance_valid(player):
		var dist = global_position.distance_to(player.global_position)
		if dist <= detect_range:
			state = "chase"
		elif state == "chase" and dist > detect_range * 1.5:
			state = "idle"

		match state:
			"idle":
				_wander(delta)
			"chase":
				_chase_player(delta)

	move_and_slide()

func _wander(delta: float) -> void:
	_wander_timer -= delta
	if _wander_timer <= 0:
		_wander_timer = randf_range(2.0, 5.0)
		var angle = randf() * TAU
		_wander_direction = Vector3(cos(angle), 0, sin(angle))
	velocity.x = _wander_direction.x * move_speed * 0.3
	velocity.z = _wander_direction.z * move_speed * 0.3

func _chase_player(delta: float) -> void:
	if not player or not is_instance_valid(player):
		return
	var dir = (player.global_position - global_position)
	dir.y = 0
	dir = dir.normalized()

	if nav_agent:
		nav_agent.target_position = player.global_position
		if nav_agent.is_navigation_finished():
			velocity.x = dir.x * move_speed
			velocity.z = dir.z * move_speed
		else:
			var next_pos = nav_agent.get_next_path_position()
			var nav_dir = (next_pos - global_position).normalized()
			velocity.x = nav_dir.x * move_speed
			velocity.z = nav_dir.z * move_speed
	else:
		velocity.x = dir.x * move_speed
		velocity.z = dir.z * move_speed

	var dist = global_position.distance_to(player.global_position)
	if dist <= attack_range and _attack_cooldown <= 0:
		_attack_player()

func _attack_player() -> void:
	_attack_cooldown = 1.5
	if player and player.has_method("take_damage"):
		player.take_damage(attack_damage)
		enemy_damaged.emit(attack_damage)

func take_damage(amount: float) -> void:
	current_health -= amount
	_hit_flash_timer = 0.2

	if current_health <= 0:
		_die()

func _die() -> void:
	if randf() < 0.5:
		InventoryManager.add_item("meat_raw", 1)
	if randf() < 0.3:
		InventoryManager.add_item("fiber", 2)
	enemy_killed.emit(self)
	queue_free()
