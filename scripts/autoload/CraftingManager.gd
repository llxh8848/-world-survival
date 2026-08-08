extends Node

signal craft_success(recipe_id: String)
signal craft_failed(recipe_id: String, reason: String)

const RECIPES: Dictionary = {
	"wood_pickaxe": {
		"name": "木镐",
		"ingredients": {"wood": 3, "fiber": 2},
		"output": "wood_pickaxe",
		"output_count": 1,
	},
	"stone_pickaxe": {
		"name": "石镐",
		"ingredients": {"wood": 2, "stone": 3},
		"output": "stone_pickaxe",
		"output_count": 1,
	},
	"iron_pickaxe": {
		"name": "铁镐",
		"ingredients": {"wood": 2, "iron_ingot": 3},
		"output": "iron_pickaxe",
		"output_count": 1,
	},
	"wood_axe": {
		"name": "木斧",
		"ingredients": {"wood": 3, "fiber": 2},
		"output": "wood_axe",
		"output_count": 1,
	},
	"stone_axe": {
		"name": "石斧",
		"ingredients": {"wood": 2, "stone": 3},
		"output": "stone_axe",
		"output_count": 1,
	},
	"iron_axe": {
		"name": "铁斧",
		"ingredients": {"wood": 2, "iron_ingot": 3},
		"output": "iron_axe",
		"output_count": 1,
	},
	"wood_sword": {
		"name": "木剑",
		"ingredients": {"wood": 4, "fiber": 2},
		"output": "wood_sword",
		"output_count": 1,
	},
	"stone_sword": {
		"name": "石剑",
		"ingredients": {"wood": 2, "stone": 4, "fiber": 1},
		"output": "stone_sword",
		"output_count": 1,
	},
	"iron_sword": {
		"name": "铁剑",
		"ingredients": {"wood": 2, "iron_ingot": 4},
		"output": "iron_sword",
		"output_count": 1,
	},
	"torch": {
		"name": "火把",
		"ingredients": {"wood": 1, "fiber": 1},
		"output": "torch",
		"output_count": 1,
	},
	"wall_wood": {
		"name": "木墙",
		"ingredients": {"wood": 4},
		"output": "wall_wood",
		"output_count": 2,
	},
	"wall_stone": {
		"name": "石墙",
		"ingredients": {"stone": 4},
		"output": "wall_stone",
		"output_count": 2,
	},
	"campfire": {
		"name": "篝火",
		"ingredients": {"wood": 5, "stone": 3},
		"output": "campfire",
		"output_count": 1,
	},
	"iron_ingot": {
		"name": "铁锭",
		"ingredients": {"iron_ore": 2, "wood": 1},
		"output": "iron_ingot",
		"output_count": 1,
		"requires_campfire": true,
	},
	"meat_cooked": {
		"name": "熟肉",
		"ingredients": {"meat_raw": 1, "wood": 1},
		"output": "meat_cooked",
		"output_count": 1,
		"requires_campfire": true,
	},
}

func get_recipe(recipe_id: String) -> Dictionary:
	return RECIPES.get(recipe_id, {})

func get_all_recipes() -> Dictionary:
	return RECIPES

func can_craft(recipe_id: String, near_campfire: bool = false) -> bool:
	if not RECIPES.has(recipe_id):
		return false
	var recipe = RECIPES[recipe_id]
	if recipe.get("requires_campfire", false) and not near_campfire:
		return false
	for item_id in recipe["ingredients"]:
		var needed = recipe["ingredients"][item_id]
		if not InventoryManager.has_item(item_id, needed):
			return false
	return true

func craft(recipe_id: String, near_campfire: bool = false) -> bool:
	if not can_craft(recipe_id, near_campfire):
		craft_failed.emit(recipe_id, "材料不足或条件不满足")
		return false

	var recipe = RECIPES[recipe_id]
	for item_id in recipe["ingredients"]:
		InventoryManager.remove_item(item_id, recipe["ingredients"][item_id])

	InventoryManager.add_item(recipe["output"], recipe["output_count"])
	craft_success.emit(recipe_id)
	return true

func get_recipes_by_category(category: String) -> Array[String]:
	var result: Array[String] = []
	for recipe_id in RECIPES:
		var recipe = RECIPES[recipe_id]
		var output_info = InventoryManager.get_item_info(recipe["output"])
		match category:
			"tool":
				if output_info.get("tool", false):
					result.append(recipe_id)
			"weapon":
				if output_info.get("weapon", false):
					result.append(recipe_id)
			"building":
				if output_info.get("placeable", false):
					result.append(recipe_id)
			"consumable":
				if output_info.get("hunger", 0) > 0 or output_info.get("thirst", 0) > 0:
					result.append(recipe_id)
			"material":
				if not output_info.get("tool", false) and not output_info.get("weapon", false) and not output_info.get("placeable", false) and output_info.get("hunger", 0) == 0 and output_info.get("thirst", 0) == 0:
					result.append(recipe_id)
	return result
