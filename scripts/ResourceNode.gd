extends StaticBody3D

signal harvested(resource_id: String, amount: int)
signal depleted

@export var resource_type: String = "wood"
@export var max_health: float = 30.0
@export var drops: Dictionary = {"wood": 2}
@export var respawn_time: float = 60.0

var current_health: float
var is_depleted: bool = false
var _respawn_timer: float = 0.0
var _original_scale: Vector3
var _hit_flash_timer: float = 0.0

var mesh_instance: MeshInstance3D
var collision_shape: CollisionShape3D

func _ready() -> void:
	current_health = max_health
	_original_scale = scale
	collision_layer = 16
	add_to_group("resource")
	if resource_type == "wood":
		add_to_group("tree")
	elif resource_type == "stone":
		add_to_group("rock")

	mesh_instance = get_node_or_null("MeshInstance3D")
	collision_shape = get_node_or_null("CollisionShape3D")

func _process(delta: float) -> void:
	if is_depleted:
		_respawn_timer -= delta
		if _respawn_timer <= 0:
			_respawn()
		return

	if _hit_flash_timer > 0:
		_hit_flash_timer -= delta
		if mesh_instance:
			var mat = mesh_instance.get_active_material(0) as StandardMaterial3D
			if mat:
				mat.albedo_color = Color.WHITE.lerp(Color(1.5, 1.5, 1.5), _hit_flash_timer / 0.2)

func harvest(tool_power: int, harvester: Node) -> void:
	if is_depleted:
		return

	var damage = 5.0 + tool_power * 5.0
	current_health -= damage
	_hit_flash_timer = 0.2

	if current_health <= 0:
		_deplete()

func interact(_player: Node) -> void:
	if resource_type == "berry" and not is_depleted:
		_deplete()

func _deplete() -> void:
	is_depleted = true
	_respawn_timer = respawn_time
	if mesh_instance:
		mesh_instance.visible = false
	if collision_shape:
		collision_shape.disabled = true

	for item_id in drops:
		var amount = drops[item_id]
		InventoryManager.add_item(item_id, amount)
		harvested.emit(item_id, amount)

	depleted.emit()

func _respawn() -> void:
	is_depleted = false
	current_health = max_health
	if mesh_instance:
		mesh_instance.visible = true
	if collision_shape:
		collision_shape.disabled = false
