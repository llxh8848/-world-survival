extends Node

signal inventory_changed
signal item_added(item_id: String, amount: int)
signal item_removed(item_id: String, amount: int)
signal hotbar_selected(index: int)

const MAX_STACK: int = 99
const HOTBAR_SIZE: int = 5
const INVENTORY_SIZE: int = 20

var items: Array[Dictionary] = []
var hotbar: Array[String] = ["", "", "", "", ""]
var selected_hotbar_index: int = 0

const ITEM_DATABASE: Dictionary = {
	"wood": {"name": "木材", "icon": "🪵", "stackable": true, "max_stack": 99},
	"stone": {"name": "石头", "icon": "🪨", "stackable": true, "max_stack": 99},
	"iron_ore": {"name": "铁矿", "icon": "⛏️", "stackable": true, "max_stack": 99},
	"iron_ingot": {"name": "铁锭", "icon": "🔩", "stackable": true, "max_stack": 99},
	"fiber": {"name": "纤维", "icon": "🌿", "stackable": true, "max_stack": 99},
	"berry": {"name": "浆果", "icon": "🫐", "stackable": true, "max_stack": 99, "hunger": 10, "thirst": 5},
	"meat_raw": {"name": "生肉", "icon": "🥩", "stackable": true, "max_stack": 99, "hunger": 15},
	"meat_cooked": {"name": "熟肉", "icon": "🍖", "stackable": true, "max_stack": 99, "hunger": 30},
	"water_clean": {"name": "净水", "icon": "💧", "stackable": true, "max_stack": 99, "thirst": 30},
	"wood_pickaxe": {"name": "木镐", "icon": "⛏️", "stackable": false, "tool": true, "mining_power": 1},
	"stone_pickaxe": {"name": "石镐", "icon": "⛏️", "stackable": false, "tool": true, "mining_power": 2},
	"iron_pickaxe": {"name": "铁镐", "icon": "⛏️", "stackable": false, "tool": true, "mining_power": 3},
	"wood_axe": {"name": "木斧", "icon": "🪓", "stackable": false, "tool": true, "chopping_power": 1},
	"stone_axe": {"name": "石斧", "icon": "🪓", "stackable": false, "tool": true, "chopping_power": 2},
	"iron_axe": {"name": "铁斧", "icon": "🪓", "stackable": false, "tool": true, "chopping_power": 3},
	"wood_sword": {"name": "木剑", "icon": "🗡️", "stackable": false, "weapon": true, "damage": 15},
	"stone_sword": {"name": "石剑", "icon": "⚔️", "stackable": false, "weapon": true, "damage": 25},
	"iron_sword": {"name": "铁剑", "icon": "⚔️", "stackable": false, "weapon": true, "damage": 40},
	"torch": {"name": "火把", "icon": "🔥", "stackable": true, "max_stack": 10, "light": true},
	"wall_wood": {"name": "木墙", "icon": "🧱", "stackable": true, "max_stack": 50, "placeable": true},
	"wall_stone": {"name": "石墙", "icon": "🧱", "stackable": true, "max_stack": 50, "placeable": true},
	"campfire": {"name": "篝火", "icon": "🔥", "stackable": true, "max_stack": 10, "placeable": true},
	"campfire_stone": {"name": "石篝火", "icon": "🔥", "stackable": true, "max_stack": 10, "placeable": true},
}

func _ready() -> void:
	items.resize(INVENTORY_SIZE)
	for i in range(INVENTORY_SIZE):
		items[i] = {"id": "", "amount": 0}

func add_item(item_id: String, amount: int = 1) -> int:
	if not ITEM_DATABASE.has(item_id):
		push_warning("Unknown item: " + item_id)
		return amount

	var item_info = ITEM_DATABASE[item_id]
	var max_stack = item_info.get("max_stack", 1) if item_info.get("stackable", false) else 1

	var remaining = amount

	if item_info.get("stackable", false):
		for i in range(INVENTORY_SIZE):
			if items[i]["id"] == item_id and items[i]["amount"] < max_stack:
				var space = max_stack - items[i]["amount"]
				var to_add = min(space, remaining)
				items[i]["amount"] += to_add
				remaining -= to_add
				if remaining <= 0:
					break

	if remaining > 0:
		for i in range(INVENTORY_SIZE):
			if items[i]["id"] == "":
				var to_add = min(max_stack, remaining)
				items[i]["id"] = item_id
				items[i]["amount"] = to_add
				remaining -= to_add
				if remaining <= 0:
					break

	inventory_changed.emit()
	if remaining < amount:
		item_added.emit(item_id, amount - remaining)
	return remaining

func remove_item(item_id: String, amount: int = 1) -> int:
	var remaining = amount
	for i in range(INVENTORY_SIZE):
		if items[i]["id"] == item_id:
			var to_remove = min(items[i]["amount"], remaining)
			items[i]["amount"] -= to_remove
			remaining -= to_remove
			if items[i]["amount"] <= 0:
				items[i]["id"] = ""
				items[i]["amount"] = 0
			if remaining <= 0:
				break

	inventory_changed.emit()
	if remaining < amount:
		item_removed.emit(item_id, amount - remaining)
	return remaining

func has_item(item_id: String, amount: int = 1) -> bool:
	return get_item_count(item_id) >= amount

func get_item_count(item_id: String) -> int:
	var count = 0
	for item in items:
		if item["id"] == item_id:
			count += item["amount"]
	return count

func get_selected_item() -> Dictionary:
	var item_id = hotbar[selected_hotbar_index]
	if item_id == "":
		return {"id": "", "amount": 0}
	for item in items:
		if item["id"] == item_id:
			return item
	return {"id": "", "amount": 0}

func select_hotbar(index: int) -> void:
	if index >= 0 and index < HOTBAR_SIZE:
		selected_hotbar_index = index
		hotbar_selected.emit(index)

func assign_to_hotbar(item_id: String, slot: int) -> void:
	if slot >= 0 and slot < HOTBAR_SIZE:
		hotbar[slot] = item_id
		inventory_changed.emit()

func get_item_info(item_id: String) -> Dictionary:
	return ITEM_DATABASE.get(item_id, {})

func get_all_items() -> Array[Dictionary]:
	return items
