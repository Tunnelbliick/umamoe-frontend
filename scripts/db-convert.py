import argparse
import sqlite3
import json
from json import JSONEncoder
import os

parser = argparse.ArgumentParser(prog='db-convert.py')
parser.add_argument('--dblocation', default='C:/Users/lars1/AppData/LocalLow/Cygames/umamusume/master/master.mdb')
parser.add_argument('--dry-run', action='store_true')
parser.add_argument('--character-json', default='C:/Users/lars1/Documents/git/honsemoe/honsemoe/src/data/character.json', help='Path to character.json file')
args = parser.parse_args()

# Load character names from character.json
character_names = {}
if os.path.exists(args.character_json):
    with open(args.character_json, 'r', encoding='utf-8') as f:
        characters = json.load(f)
        for char in characters:
            character_names[char['id']] = char['name']
    print(f"Loaded {len(character_names)} character names from {args.character_json}")
else:
    print(f"Warning: Character file {args.character_json} not found. Using database names as fallback.")
    
print(f"Character name: {character_names}")

IGNORE_EFFECTS = [0, 16, 17, 112]

class Card():
    id = 0
    type = 0
    group = False
    limit_break = -1
    rarity = 0
    # Speed, Stamina, Power, Guts, Int
    starting_stats = []
    type_stats = 0
    race_bonus = 0
    sb = 0
    # Speed, Stamina, Power, Guts, Int, Skill Points
    stat_bonus = []
    specialty_rate = 0
    unique_specialty = 1
    # Normal cards have an equal 1/4 chance of appearing on any of their off-stat trainings if they don't roll
    # their specialty stat; friend/group cards have a 1/5 chance of appearing on any training; Satake Mei's
    # unique effect gives her a 2/5 chance of appearing on any training.
    offstat_appearance_denominator = 4
    tb = 0
    fs_bonus = 0
    mb = 0
    unique_fs_bonus = 0
    fs_stats = []
    fs_training = 0
    fs_motivation = 0
    fs_specialty = 1
    fs_ramp=[0,0]
    fs_energy = 0
    hint_rate = 0
    wisdom_recovery = 0
    effect_size_up = 0
    energy_up = 0
    energy_discount = 0
    fail_rate_down = 0
    highlander_threshold = 0
    highlander_training = 0
    support_type_stat_bonus = 0 # Bonus stats for each support type in your deck, friend cards get skill points instead
    support_chance_up = 0
    bonus_bond = 0; # +1 bond, +2 bond if in same facility
    special_prio = 0;
    crowd_bonus = 0
    fan_bonus = 0
    char_name = "Unknown"
    char_id = 0

def GetValue(data, lb, rarity):
    base_value = -1
    base_lb = lb
    index = lb + rarity + 5
    while index >= 2:
        base_value = int(data[index])
        if base_value == -1:
            index -= 1
            base_lb -= 1
        else:
            break

    if base_lb == lb:
        return base_value
    
    if base_value == -1:
        return 0

    max_value = -1
    max_lb = lb
    index = lb + rarity + 5
    while index <= 12:
        max_value = int(data[index])
        if max_value == -1:
            index += 1
            max_lb += 1
        else:
            break
    
    if max_value == -1:
        return base_value

    if base_lb == max_lb:
        return base_value
        
    return int(base_value + (max_value - base_value) * ((lb - base_lb) / (max_lb - base_lb)))

def AddEffectToCard(card, effect_type, effect_value):
    if effect_type == 1: 
        card.fs_bonus += effect_value / 100
    elif effect_type == 2:
        card.mb = effect_value
    elif effect_type == 3:
        card.stat_bonus[0] += effect_value
    elif effect_type == 4:
        card.stat_bonus[1] += effect_value
    elif effect_type == 5:
        card.stat_bonus[2] += effect_value
    elif effect_type == 6:
        card.stat_bonus[3] += effect_value
    elif effect_type == 7:
        card.stat_bonus[4] += effect_value
    elif effect_type == 8:
        card.tb += effect_value  / 100
    elif effect_type == 9:
        card.starting_stats[0] += effect_value
    elif effect_type == 10:
        card.starting_stats[1] += effect_value
    elif effect_type == 11:
        card.starting_stats[2] += effect_value
    elif effect_type == 12:
        card.starting_stats[3] += effect_value
    elif effect_type == 13:
        card.starting_stats[4] += effect_value
    elif effect_type == 14:
        card.sb += effect_value
    elif effect_type == 15:
        card.race_bonus += effect_value
    elif effect_type == 18:
        card.hint_rate += effect_value / 100
    elif effect_type == 19:
        card.specialty_rate += effect_value
    elif effect_type == 25:
        card.energy_up += effect_value / 100
    elif effect_type == 26:
        card.effect_size_up += effect_value / 100
    elif effect_type == 27:
        card.fail_rate_down += effect_value / 100
    elif effect_type == 28:
        card.energy_discount += effect_value / 100
    elif effect_type == 30:
        card.stat_bonus[5] += effect_value
    elif effect_type == 31:
        card.wisdom_recovery += effect_value
    elif effect_type == 32:
        card.stat_bonus[0] += effect_value
        card.stat_bonus[5] += effect_value
    # The below unique effects are in a different column so they're hardcoded for now
    elif effect_type == 101:
        card.fs_stats[4] += 3
    elif effect_type == 102:
        card.fs_training += 0.2
    elif effect_type == 103:
        card.highlander_training += 0.15
    elif effect_type == 104:
        #fan training
        card.fan_bonus = 1
    elif effect_type == 110:
        card.crowd_bonus += 0.05
    elif effect_type == 120:
        card.support_type_stat_bonus += 1
    elif effect_type == 119:
        card.support_chance_up += 20 / 100
    elif effect_type == 121:
        card.bonus_bond += 1
    elif effect_type == 122:
        card.special_prio += 1
    elif effect_type not in IGNORE_EFFECTS:

        print(f"WARN: unknown effect type {effect_type} on card id {card.id}")

cards = []

types = {
    0: 6,
    101: 0,
    102: 2,
    103: 3,
    105: 1,
    106: 4
}

with sqlite3.connect(args.dblocation) as conn:
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM support_card_data')
    card_data = cursor.fetchall()

    for data in card_data:
        # 0 id | 1 chara_id | 2 rarity | 3 exchange_item_id | 4 effect_table_id | 5 unique_effect_id | 6 command_type
        # 7 command_id | 8 support_card_type | 9 skill_set_id | other stuff
        cursor.execute('SELECT * FROM support_card_effect_table WHERE id=%s' % data[0])
        effects = cursor.fetchall()

        for i in range(5):
            current_card = Card()
            current_card.id = data[0]
            current_card.type = types[int(data[7])]
            current_card.group = int(data[8]) == 3
            current_card.rarity = int(data[2])
            current_card.limit_break = i
            current_card.starting_stats = [0,0,0,0,0]
            current_card.type_stats = 0
            current_card.stat_bonus = [0,0,0,0,0,0]
            current_card.race_bonus = 0
            current_card.sb = 0
            current_card.specialty_rate = 0
            current_card.unique_specialty = 1
            current_card.offstat_appearance_denominator = 5 if current_card.type == 6 else 4
            current_card.tb = 1
            current_card.fs_bonus = 1
            current_card.mb = 1
            current_card.unique_fs_bonus = 1
            current_card.fs_stats = [0,0,0,0,0,0]
            current_card.fs_training = 0
            current_card.fs_motivation = 0
            current_card.fs_specialty = 1
            current_card.fs_ramp = [0,0]
            current_card.fs_energy = 0
            current_card.wisdom_recovery = 0
            current_card.effect_size_up = 1
            current_card.energy_up = 1
            current_card.energy_discount = 0
            current_card.fail_rate_down = 0
            current_card.hint_rate = 1
            current_card.highlander_threshold = 4
            current_card.highlander_training = 0
            current_card.crowd_bonus = 0
            current_card.char_name = ""
            current_card.fan_bonus = 0

            for effect in effects:
                # 0 id | 1 type | 2 init | 3 limit_lv_5 | ... | 12 limit_lv_50
                effect_type = int(effect[1])
                AddEffectToCard(current_card, effect_type, GetValue(effect, i, int(data[2])))

            cursor.execute('SELECT * FROM support_card_unique_effect WHERE id = %s' % data[0])
            # 0 id | 1 lv | 2 type_0 | 3 value_0　... | 8 type_1 | 9 value_1
            unique = cursor.fetchone()
            if unique is not None:
                for u in range(0,10,6):
                    type_0 = int(unique[2 + u])
                    if type_0 == 1:
                        current_card.unique_fs_bonus += int(unique[3 + u]) / 100
                    elif type_0 == 19:
                        current_card.unique_specialty = 1.2
                    elif type_0 == 103:
                        current_card.highlander_threshold = int(unique[3 + u])
                        current_card.highlander_training = int(unique[4 + u]) / 100
                    elif type_0 == 101:
                        bonus_type_1 = int(unique[4 + u])
                        bonus_type_2 = int(unique[6 + u])
                        bonus_value_1 = int(unique[5 + u])
                        bonus_value_2 = int(unique[7 + u])
                        for (bonus_type, bonus_value) in zip([bonus_type_1, bonus_type_2], [bonus_value_1, bonus_value_2]):
                            if bonus_type == 1:
                                current_card.unique_fs_bonus += bonus_value / 100
                            elif bonus_type == 2:
                                current_card.fs_motivation += bonus_value / 100
                            elif bonus_type == 3:
                                current_card.fs_stats[0] += bonus_value
                            elif bonus_type == 4:
                                current_card.fs_stats[1] += bonus_value
                            elif bonus_type == 5:
                                current_card.fs_stats[2] += bonus_value
                            elif bonus_type == 6:
                                current_card.fs_stats[3] += bonus_value
                            elif bonus_type == 7:
                                current_card.fs_stats[4] += bonus_value
                            elif bonus_type == 8:
                                current_card.fs_training += bonus_value / 100
                            elif bonus_type == 19:
                                current_card.fs_specialty += bonus_value / 100
                            elif bonus_type == 30:
                                current_card.fs_stats[5] += bonus_value
                            elif bonus_type == 31:
                                current_card.wisdom_recovery += bonus_value
                            elif bonus_type == 41:
                                for i in range(0,5):
                                    current_card.fs_stats[i] += bonus_value
                            elif bonus_type > 0:
                                print(f"WARN: unknown bonus type {bonus_type} on card id {current_card.id}")
                    elif type_0 == 106:
                        current_card.fs_ramp = [3,15]
                    elif type_0 == 105:
                        current_card.type_stats = 10
                    elif type_0 == 108:
                        current_card.tb += 0.12
                    elif type_0 == 109:
                        current_card.tb += 0.15
                    elif type_0 == 107:
                        current_card.unique_fs_bonus += 0.07
                    elif type_0 == 111:
                        current_card.tb += 0.15
                    elif type_0 == 113:
                        bonus_type = int(unique[3 + u])
                        bonus_value = int(unique[4 + u])
                        if bonus_type == 2:
                            current_card.fs_motivation += bonus_value / 100
                        elif bonus_type == 28:
                            current_card.fs_energy += bonus_value / 100
                    elif type_0 == 114:
                        current_card.tb += 0.15
                    elif type_0 == 115:
                        current_card.sb += 30
                    elif type_0 == 116:
                        if int(unique[4 + u]) >= 3:
                            current_card.stat_bonus[int(unique[4 + u]) - 3] += 3
                        else:
                            current_card.fs_training += 0.2
                    elif type_0 == 117:
                        current_card.tb += 0.05
                        current_card.fs_training += 0.10
                    elif type_0 == 118:
                        current_card.offstat_appearance_denominator = 2.5
                    else:
                        AddEffectToCard(current_card, type_0, int(unique[3 + u]))
            
            # Get character name from character.json first, fallback to database
            char_id = str(data[1]) + "01"  # Convert to string to match JSON format
            # print(f"Processing card id {current_card.id} for character id {char_id}")
            current_card.char_id = char_id
            if char_id in character_names:
                current_card.char_name = character_names[char_id]
            else:
                # Fallback to database lookup
                cursor.execute('SELECT * FROM text_data WHERE id = 170 AND [index] = %s' % data[1])
                char_name = cursor.fetchone()
                if char_name is not None:
                    current_card.char_name = char_name[3]
                else:
                    current_card.char_name = f"Unknown_{char_id}"
            
            cards.append(current_card)

if not args.dry_run:
    # Create the output data structure
    output_data = {
        "cards": []
    }
    
    for card in cards:
        output_data["cards"].append(card.__dict__)

    # Write as JSON file (minified)
    with open("./cards.json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, separators=(',', ':'))
    
    print(f"Generated cards.json with {len(cards)} cards")
