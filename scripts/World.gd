extends Node3D

const WORLD_SIZE: float = 100.0
const TREE_COUNT: int = 30
const ROCK_COUNT: int = 15
const IRON_COUNT: int = 8
const BERRY_COUNT: int = 10

var _noise: FastNoiseLite
var _ground_mesh: MeshInstance3D
var _sun: DirectionalLight3D
var _world_env: WorldEnvironment
var _nav_region: NavigationRegion3D
var _resource_parent: Node3D
var _enemy_parent: Node3D
var _building_parent: Node3D
var _enemy_spawn_timer: float = 0.0
var _enemy_spawn_interval: float = 10.0

func _ready() -> void:
	GameManager.register_world(self)
	_noise = FastNoiseLite.new()
	_noise.seed = randi()
	_noise.frequency = 0.02
	_noise.fractal_octaves = 4

	_ground_mesh = $Ground/GroundMesh
	_sun = $Sun
	_world_env = $WorldEnvironment
	_nav_region = $NavigationRegion
	_resource_parent = $Resources
	_enemy_parent = $Enemies
	_building_parent = $Buildings

	_generate_terrain()
	_generate_resources()
	_bake_navigation()

	GameManager.night_started.connect(_on_night_started)
	GameManager.day_started.connect(_on_day_started)

func _generate_terrain() -> void:
	var surface_tool = SurfaceTool.new()
	surface_tool.begin(Mesh.PRIMITIVE_TRIANGLES)

	var resolution = 64
	var half_size = WORLD_SIZE / 2.0
	var step = WORLD_SIZE / resolution

	for z in range(resolution):
		for x in range(resolution):
			var x0 = (x * step) - half_size
			var z0 = (z * step) - half_size
			var x1 = ((x + 1) * step) - half_size
			var z1 = ((z + 1) * step) - half_size

			var h00 = _get_height(x0, z0)
			var h10 = _get_height(x1, z0)
			var h01 = _get_height(x0, z1)
			var h11 = _get_height(x1, z1)

			var v00 = Vector3(x0, h00, z0)
			var v10 = Vector3(x1, h10, z0)
			var v01 = Vector3(x0, h01, z1)
			var v11 = Vector3(x1, h11, z1)

			surface_tool.add_vertex(v00)
			surface_tool.add_vertex(v10)
			surface_tool.add_vertex(v11)

			surface_tool.add_vertex(v00)
			surface_tool.add_vertex(v11)
			surface_tool.add_vertex(v01)

	surface_tool.generate_normals()

	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.3, 0.5, 0.25)
	mat.roughness = 0.9
	surface_tool.set_material(mat)
	var mesh = surface_tool.commit()
	_ground_mesh.mesh = mesh

	var shape = Shape3D.new()
	var height_map_shape = HeightMapShape3D.new()
	var map_width = resolution + 1
	height_map_shape.map_width = map_width
	height_map_shape.map_depth = map_width
	var heights = PackedFloat32Array()
	heights.resize(map_width * map_width)
	for z in range(map_width):
		for x in range(map_width):
			var wx = (x * step) - half_size
			var wz = (z * step) - half_size
			heights[z * map_width + x] = _get_height(wx, wz)
	height_map_shape.map_data = heights

	var col = $Ground/CollisionShape3D
	if col:
		col.shape = height_map_shape

func _get_height(x: float, z: float) -> float:
	var dist = Vector2(x, z).length()
	if dist > WORLD_SIZE / 2.0:
		return -2.0
	return _noise.get_noise_2d(x, z) * 3.0

func _generate_resources() -> void:
	for i in range(TREE_COUNT):
		var pos = _get_random_position(8.0)
		_spawn_tree(pos)

	for i in range(ROCK_COUNT):
		var pos = _get_random_position(10.0)
		_spawn_rock(pos)

	for i in range(IRON_COUNT):
		var pos = _get_random_position(15.0)
		_spawn_iron(pos)

	for i in range(BERRY_COUNT):
		var pos = _get_random_position(5.0)
		_spawn_berry(pos)

func _get_random_position(min_dist_from_center: float = 0.0) -> Vector3:
	var angle = randf() * TAU
	var dist = randf_range(min_dist_from_center, WORLD_SIZE / 2.0 - 5.0)
	var x = cos(angle) * dist
	var z = sin(angle) * dist
	var y = _get_height(x, z)
	return Vector3(x, y, z)

func _spawn_tree(pos: Vector3) -> void:
	var tree = StaticBody3D.new()
	tree.position = pos
	tree.add_to_group("resource")
	tree.add_to_group("tree")
	tree.set_script(load("res://scripts/ResourceNode.gd"))
	tree.set("resource_type", "wood")
	tree.set("max_health", 30.0)
	tree.set("drops", {"wood": 2, "fiber": 1})
	tree.set("respawn_time", 60.0)

	var trunk = MeshInstance3D.new()
	trunk.name = "MeshInstance3D"
	var trunk_mesh = CylinderMesh.new()
	trunk_mesh.top_radius = 0.3
	trunk_mesh.bottom_radius = 0.5
	trunk_mesh.height = 4.0
	trunk.mesh = trunk_mesh
	var trunk_mat = StandardMaterial3D.new()
	trunk_mat.albedo_color = Color(0.4, 0.25, 0.1)
	trunk_mat.roughness = 0.9
	trunk.material_override = trunk_mat
	trunk.position = Vector3(0, 2, 0)
	tree.add_child(trunk)

	var leaves = MeshInstance3D.new()
	leaves.name = "Leaves"
	var leaves_mesh = SphereMesh.new()
	leaves_mesh.radius = 1.8
	leaves_mesh.height = 3.0
	leaves.mesh = leaves_mesh
	var leaves_mat = StandardMaterial3D.new()
	leaves_mat.albedo_color = Color(0.15, 0.45, 0.1)
	leaves_mat.roughness = 0.8
	leaves.material_override = leaves_mat
	leaves.position = Vector3(0, 4.5, 0)
	tree.add_child(leaves)

	var col = CollisionShape3D.new()
	col.name = "CollisionShape3D"
	var col_shape = CylinderShape3D.new()
	col_shape.radius = 0.5
	col_shape.height = 4.0
	col.shape = col_shape
	col.position = Vector3(0, 2, 0)
	tree.add_child(col)

	_resource_parent.add_child(tree)

func _spawn_rock(pos: Vector3) -> void:
	var rock = StaticBody3D.new()
	rock.position = pos
	rock.add_to_group("resource")
	rock.add_to_group("rock")
	rock.set_script(load("res://scripts/ResourceNode.gd"))
	rock.set("resource_type", "stone")
	rock.set("max_health", 40.0)
	rock.set("drops", {"stone": 2})
	rock.set("respawn_time", 60.0)

	var mesh_inst = MeshInstance3D.new()
	mesh_inst.name = "MeshInstance3D"
	var box_mesh = BoxMesh.new()
	box_mesh.size = Vector3(1.5, 1.2, 1.5)
	mesh_inst.mesh = box_mesh
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.5, 0.5, 0.5)
	mat.roughness = 0.95
	mesh_inst.material_override = mat
	mesh_inst.position = Vector3(0, 0.6, 0)
	rock.add_child(mesh_inst)

	var col = CollisionShape3D.new()
	col.name = "CollisionShape3D"
	var col_shape = BoxShape3D.new()
	col_shape.size = Vector3(1.5, 1.2, 1.5)
	col.shape = col_shape
	col.position = Vector3(0, 0.6, 0)
	rock.add_child(col)

	_resource_parent.add_child(rock)

func _spawn_iron(pos: Vector3) -> void:
	var iron = StaticBody3D.new()
	iron.position = pos
	iron.add_to_group("resource")
	iron.add_to_group("rock")
	iron.set_script(load("res://scripts/ResourceNode.gd"))
	iron.set("resource_type", "iron")
	iron.set("max_health", 50.0)
	iron.set("drops", {"iron_ore": 1, "stone": 1})
	iron.set("respawn_time", 90.0)

	var mesh_inst = MeshInstance3D.new()
	mesh_inst.name = "MeshInstance3D"
	var box_mesh = BoxMesh.new()
	box_mesh.size = Vector3(1.2, 1.0, 1.2)
	mesh_inst.mesh = box_mesh
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.35, 0.3, 0.25)
	mat.roughness = 0.8
	mat.metallic = 0.3
	mesh_inst.material_override = mat
	mesh_inst.position = Vector3(0, 0.5, 0)
	iron.add_child(mesh_inst)

	var col = CollisionShape3D.new()
	col.name = "CollisionShape3D"
	var col_shape = BoxShape3D.new()
	col_shape.size = Vector3(1.2, 1.0, 1.2)
	col.shape = col_shape
	col.position = Vector3(0, 0.5, 0)
	iron.add_child(col)

	_resource_parent.add_child(iron)

func _spawn_berry(pos: Vector3) -> void:
	var berry = StaticBody3D.new()
	berry.position = pos
	berry.add_to_group("resource")
	berry.set_script(load("res://scripts/ResourceNode.gd"))
	berry.set("resource_type", "berry")
	berry.set("max_health", 15.0)
	berry.set("drops", {"berry": 2})
	berry.set("respawn_time", 30.0)

	var mesh_inst = MeshInstance3D.new()
	mesh_inst.name = "MeshInstance3D"
	var sphere_mesh = SphereMesh.new()
	sphere_mesh.radius = 0.5
	sphere_mesh.height = 1.0
	mesh_inst.mesh = sphere_mesh
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.2, 0.1, 0.05)
	mat.roughness = 0.9
	mesh_inst.material_override = mat
	mesh_inst.position = Vector3(0, 0.5, 0)
	berry.add_child(mesh_inst)

	var col = CollisionShape3D.new()
	col.name = "CollisionShape3D"
	var col_shape = SphereShape3D.new()
	col_shape.radius = 0.5
	col.shape = col_shape
	col.position = Vector3(0, 0.5, 0)
	berry.add_child(col)

	_resource_parent.add_child(berry)

func _bake_navigation() -> void:
	if _nav_region:
		_nav_region.bake_navigation_mesh(false)

func _on_night_started() -> void:
	_enemy_spawn_timer = 0.0

func _on_day_started() -> void:
	for enemy in _enemy_parent.get_children():
		enemy.queue_free()

func _process(delta: float) -> void:
	if GameManager.is_night:
		_enemy_spawn_timer += delta
		if _enemy_spawn_timer >= _enemy_spawn_interval:
			_enemy_spawn_timer = 0.0
			_spawn_enemy()

func _spawn_enemy() -> void:
	if not GameManager.player:
		return
	var max_enemies = 3 + GameManager.day_count
	if _enemy_parent.get_child_count() >= max_enemies:
		return

	var player_pos = GameManager.player.global_position
	var angle = randf() * TAU
	var dist = randf_range(20.0, 40.0)
	var spawn_pos = player_pos + Vector3(cos(angle) * dist, 0, sin(angle) * dist)
	spawn_pos.y = _get_height(spawn_pos.x, spawn_pos.z)

	var enemy_scene = load("res://scenes/Enemy.tscn")
	var enemy = enemy_scene.instantiate()
	enemy.global_position = spawn_pos
	enemy.set("max_health", 50.0 + GameManager.day_count * 5.0)
	_enemy_parent.add_child(enemy)

func get_ground_height(x: float, z: float) -> float:
	return _get_height(x, z)
