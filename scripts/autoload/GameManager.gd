extends Node

signal day_started
signal night_started
signal time_of_day_changed(hour: float)
signal game_paused(paused: bool)
signal player_died
signal player_respawned

var player: CharacterBody3D = null
var world: Node3D = null
var is_night: bool = false
var current_hour: float = 8.0
var day_count: int = 1
var game_paused_state: bool = false

const DAY_DURATION: float = 120.0
const NIGHT_START_HOUR: float = 18.0
const NIGHT_END_HOUR: float = 6.0

var _time_accumulator: float = 0.0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS

func _process(delta: float) -> void:
	if game_paused_state:
		return
	_time_accumulator += delta
	var hours_per_second = 24.0 / DAY_DURATION
	current_hour += hours_per_second * delta
	if current_hour >= 24.0:
		current_hour -= 24.0
		day_count += 1
		day_started.emit()

	var was_night = is_night
	is_night = current_hour >= NIGHT_START_HOUR or current_hour < NIGHT_END_HOUR
	if was_night != is_night:
		if is_night:
			night_started.emit()
		else:
			day_started.emit()

	time_of_day_changed.emit(current_hour)

func register_player(p: CharacterBody3D) -> void:
	player = p

func register_world(w: Node3D) -> void:
	world = w

func pause_game() -> void:
	game_paused_state = true
	game_paused.emit(true)
	get_tree().paused = true

func resume_game() -> void:
	game_paused_state = false
	game_paused.emit(false)
	get_tree().paused = false

func on_player_death() -> void:
	player_died.emit()

func respawn_player() -> void:
	if player:
		player.global_position = Vector3(0, 5, 0)
		player_respawned.emit()

func get_day_progress() -> float:
	return current_hour / 24.0

func get_time_string() -> String:
	var h = int(current_hour)
	var m = int((current_hour - h) * 60.0)
	return "%02d:%02d" % [h, m]
