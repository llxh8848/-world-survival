extends DirectionalLight3D

var sun: DirectionalLight3D
var env: WorldEnvironment
var sky_mat: ProceduralSkyMaterial

func _ready() -> void:
	sun = self
	env = get_node_or_null("../WorldEnvironment")
	if env and env.environment and env.environment.sky:
		sky_mat = env.environment.sky.sky_material

func _process(_delta: float) -> void:
	var hour = GameManager.current_hour
	var progress = hour / 24.0

	var sun_angle = progress * TAU - PI / 2.0
	sun.rotation.x = sun_angle

	var is_day = hour > 6.0 and hour < 18.0
	var day_factor = clamp(cos((hour - 12.0) / 6.0 * PI / 2.0), 0.0, 1.0)

	sun.light_energy = lerp(0.05, 1.2, day_factor)

	if is_day:
		sun.light_color = Color(1.0, 0.95, 0.8).lerp(Color(1.0, 0.7, 0.4), 1.0 - day_factor)
	else:
		sun.light_color = Color(0.3, 0.3, 0.5)

	if sky_mat:
		var sky_top = Color(0.3, 0.5, 0.9).lerp(Color(0.02, 0.02, 0.08), 1.0 - day_factor)
		var sky_horizon = Color(0.7, 0.8, 1.0).lerp(Color(0.05, 0.05, 0.1), 1.0 - day_factor)
		sky_mat.sky_top_color = sky_top
		sky_mat.sky_horizon_color = sky_horizon
		sky_mat.sun_angle_max = 30.0

	if env and env.environment:
		var fog = env.environment.volumetric_fog_albedo
		if is_day:
			env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
			env.environment.ambient_light_energy = lerp(0.1, 0.5, day_factor)
		else:
			env.environment.ambient_light_energy = lerp(0.5, 0.05, 1.0 - day_factor)
