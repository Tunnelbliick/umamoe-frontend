import argparse
import sqlite3
import json
import os
import hashlib
import datetime

def calculate_data_hash(data):
    """Calculate a hash of the race program data to detect changes"""
    # Create a consistent string representation for hashing
    races_str = json.dumps(data["races"], sort_keys=True, ensure_ascii=False)
    return hashlib.md5(races_str.encode('utf-8')).hexdigest()

def load_existing_data(file_path):
    """Load existing JSON data if it exists"""
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not read existing file {file_path}: {e}")
            return None
    return None

def get_race_grade(race_instance_id):
    """Determine race grade based on race_instance_id pattern"""
    race_id_str = str(race_instance_id)
    
    if race_id_str.startswith('1'):
        return {"type_num": 1, "type": "G1"}
    elif race_id_str.startswith('2'):
        return {"type_num": 2, "type": "G2"}
    elif race_id_str.startswith('3'):
        return {"type_num": 3, "type": "G3"}
    elif race_id_str.startswith('4'):
        return {"type_num": 4, "type": "OP"}  # OP and PreOP
    elif race_id_str.startswith('9'):
        return {"type_num": 0, "type": "EX"}
    else:
        return {"type_num": -1, "type": "UNKNOWN"}

parser = argparse.ArgumentParser(prog='race-program-convert.py')
parser.add_argument('--dblocation', default='C:/Users/lars1/AppData/LocalLow/Cygames/umamusume/master/master.mdb')
parser.add_argument('--dry-run', action='store_true')
parser.add_argument('--output', default='./race_program.json', help='Output JSON file path')
args = parser.parse_args()

print(f"Reading race program data from database: {args.dblocation}")

races = {}

with sqlite3.connect(args.dblocation) as conn:
    cursor = conn.cursor()
    
    # Query single_mode_program table
    cursor.execute('SELECT * FROM single_mode_program')
    race_data = cursor.fetchall()
    
    print(f"Found {len(race_data)} race program entries")
    
    for data in race_data:
        # Assuming the structure includes: id, race_instance_id, and other fields
        # Adjust indices based on actual table structure - you may need to check column order
        race_id = data[0]  # id column (first column)
        # We need to find which column contains race_instance_id
        # Let's assume it's in a specific position - you may need to adjust this
        race_instance_id = None
        
        # Try to find race_instance_id in the data
        for i, value in enumerate(data):
            if isinstance(value, int) and len(str(value)) >= 6:
                # This looks like a race_instance_id
                potential_race_id = str(value)
                if any(potential_race_id.startswith(prefix) for prefix in ['1', '2', '3', '4', '9']):
                    race_instance_id = value
                    break
        
        if race_instance_id is None:
            # Skip entries without valid race_instance_id
            continue
            
        grade_info = get_race_grade(race_instance_id)
        
        races[str(race_id)] = {
            "id": race_id,
            "type_num": grade_info["type_num"],
            "type": grade_info["type"],
            "race_instance_id": race_instance_id
        }
        
        if not args.dry_run:
            print(f"Race {race_id}: {grade_info['type']} (race_instance_id: {race_instance_id})")

if not args.dry_run:
    # Categorize races by grade for better organization
    categorized_races = {
        "EX": {},
        "G1": {},
        "G2": {},
        "G3": {},
        "OP": {},
        "UNKNOWN": {}
    }
    
    grade_counts = {"EX": 0, "G1": 0, "G2": 0, "G3": 0, "OP": 0, "UNKNOWN": 0}
    
    for race_id, race_data in races.items():
        race_type = race_data["type"]
        grade_counts[race_type] += 1
        categorized_races[race_type][race_id] = race_data
    
    # Create the output data structure
    output_data = {
        "races": races,
        "categorized": categorized_races,
        "metadata": {
            "total_count": len(races),
            "description": "Race program mappings from single_mode_program",
            "grade_counts": grade_counts,
            "grade_info": {
                "EX": "race_instance_id starting with 9 (type_num: 0)",
                "G1": "race_instance_id starting with 1 (type_num: 1)",
                "G2": "race_instance_id starting with 2 (type_num: 2)",
                "G3": "race_instance_id starting with 3 (type_num: 3)",
                "OP": "race_instance_id starting with 4 (type_num: 4) - OP and PreOP",
                "UNKNOWN": "Other patterns (type_num: -1)"
            }
        }
    }
    
    # Check if we need to update the file
    existing_data = load_existing_data(args.output)
    should_update = True
    
    if existing_data:
        # Calculate hash of new data
        new_hash = calculate_data_hash(output_data)
        
        # Calculate hash of existing data
        existing_hash = calculate_data_hash(existing_data)
        
        if new_hash == existing_hash:
            should_update = False
            print(f"No changes detected in race program data. File {args.output} unchanged.")
        else:
            print(f"Changes detected in race program data. Updating {args.output}...")
            
            # Show what changed if possible
            if "metadata" in existing_data:
                old_count = existing_data["metadata"].get("total_count", 0)
                new_count = output_data["metadata"]["total_count"]
                if old_count != new_count:
                    print(f"  Race count changed: {old_count} → {new_count}")
    else:
        print(f"Creating new file {args.output}...")
    
    if should_update:
        # Add generation timestamp and hash to metadata
        output_data["metadata"]["last_updated"] = datetime.datetime.now().isoformat()
        output_data["metadata"]["data_hash"] = calculate_data_hash(output_data)
        
        # Write as JSON file (pretty formatted for readability)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print(f"Successfully updated {args.output} with {len(races)} race mappings")
    
    print(f"Grade breakdown: {grade_counts}")
else:
    grade_counts = {"EX": 0, "G1": 0, "G2": 0, "G3": 0, "OP": 0, "UNKNOWN": 0}
    for race_data in races.values():
        grade_counts[race_data["type"]] += 1
    
    print(f"DRY RUN: Would generate {len(races)} race mappings")
    print(f"Grade breakdown: {grade_counts}")
    # Show first few entries as example from each grade
    for grade in ["EX", "G1", "G2", "G3", "OP", "UNKNOWN"]:
        print(f"\n{grade} examples:")
        count = 0
        for race_id, race_data in races.items():
            if race_data["type"] == grade and count < 3:
                print(f"  {race_id}: {race_data['type']} (race_instance_id: {race_data['race_instance_id']})")
                count += 1
