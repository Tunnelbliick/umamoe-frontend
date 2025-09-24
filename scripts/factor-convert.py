import argparse
import sqlite3
import json
import os
import hashlib

def calculate_data_hash(data):
    """Calculate a hash of the factors data to detect changes"""
    # Create a consistent string representation for hashing
    if isinstance(data, list):
        # For legacy simple list format
        factors_str = json.dumps(sorted(data), sort_keys=True, ensure_ascii=False)
    elif isinstance(data, dict) and "factors" in data:
        # For new object format with factors key
        factors_str = json.dumps(data["factors"], sort_keys=True, ensure_ascii=False)
    else:
        # Fallback - treat the whole data as factors
        factors_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.md5(factors_str.encode('utf-8')).hexdigest()

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

parser = argparse.ArgumentParser(prog='factor-convert.py')
parser.add_argument('--dblocation', default='C:/Users/lars1/AppData/LocalLow/Cygames/Umamusume/master/master.mdb')
parser.add_argument('--dry-run', action='store_true')
parser.add_argument('--output', default='./factors.json', help='Output JSON file path')
args = parser.parse_args()

print(f"Reading factor data from database: {args.dblocation}")

factors = {}  # Use dict to store factor info with base factor as key

def get_factor_base(index):
    """Remove the last digit from factor index to get base factor"""
    index_str = str(index)
    if len(index_str) > 1:
        return int(index_str[:-1])  # Remove last digit
    else:
        return index  # Keep single digit as-is

def get_factor_type(index):
    """Determine factor type based on index pattern"""
    index_str = str(index)
    
    # Check specific patterns first
    if len(index_str) == 3:
        return 0
    elif len(index_str) == 4:
        return 1
    elif len(index_str) == 7 and index_str.startswith('1'):
        return 2
    elif len(index_str) == 7 and index_str.startswith('2'):
        return 3
    elif len(index_str) == 7 and index_str.startswith('3'):
        return 4
    elif len(index_str) == 8:
        return 5
    else:
        return -1   # unknown

def get_spark_color(factor_type):
    """Get spark color based on factor type"""
    color_map = {
        0: "special_0",
        1: "special_1", 
        2: "special_2",
        3: "special_3",
        4: "special_4",
        5: "special_5",
        100: "green",     # unique_skill
        101: "blue",      # mainstat
        102: "pink",      # type
        -1: "unknown"     # unknown
    }
    return color_map.get(factor_type, "unknown")

with sqlite3.connect(args.dblocation) as conn:
    cursor = conn.cursor()
    
    # Query text_data where category = 147 (Factor IDs)
    cursor.execute('SELECT * FROM text_data WHERE category = 147')
    factor_data = cursor.fetchall()
    
    print(f"Found {len(factor_data)} factor entries")
    
    for data in factor_data:
        # Assuming the structure is: id, category, index, text, ...
        # Adjust indices based on actual table structure
        factor_index = data[2]  # index column
        factor_text = data[3]   # text column
        
        # Get base factor (remove last digit which represents amount)
        base_factor = get_factor_base(factor_index)
        factor_type = get_factor_type(factor_index)  # Use base factor for type determination
        
        # Store with base factor as key, only if not already present
        # (this handles duplicates by keeping the first occurrence)
        if str(base_factor) not in factors:
            factors[str(base_factor)] = {
                "text": factor_text,
                "type": factor_type
            }
        
        if not args.dry_run:
            print(f"Factor {factor_index} -> Base {base_factor}: {factor_text} (type {factor_type})")

if not args.dry_run:
    # Convert dict to array of objects with id included
    factors_array = []
    for factor_id, factor_data in factors.items():
        factors_array.append({
            "id": factor_id,
            "text": factor_data["text"],
            "type": factor_data["type"]
        })
    
    # Sort by id for consistent output
    factors_array.sort(key=lambda x: int(x["id"]))
    
    # Create simple array output structure
    output_data = factors_array
    
    # Check if we need to update the file
    existing_data = load_existing_data(args.output)
    should_update = True
    
    if existing_data:
        # For array comparison
        if isinstance(existing_data, list):
            # Convert both to sets of tuples for comparison
            existing_set = {(item.get("id"), item.get("text"), item.get("type")) for item in existing_data if isinstance(item, dict)}
            new_set = {(item["id"], item["text"], item["type"]) for item in output_data}
            
            if existing_set == new_set:
                should_update = False
                print(f"No changes detected in factor data. File {args.output} unchanged.")
            else:
                print(f"Changes detected in factor data. Updating {args.output}...")
                old_count = len(existing_data)
                new_count = len(output_data)
                if old_count != new_count:
                    print(f"  Factor count changed: {old_count} → {new_count}")
        else:
            print(f"Format changed from object to array. Updating {args.output}...")
    else:
        print(f"Creating new file {args.output}...")
    
    if should_update:
        # Write as JSON file (pretty formatted for readability)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print(f"Successfully updated {args.output} with {len(factors_array)} unique base factors")
    
    # Calculate and print type breakdown
    type_counts = {}
    for factor_data in factors.values():
        factor_type = str(factor_data["type"])
        type_counts[factor_type] = type_counts.get(factor_type, 0) + 1
    
    print(f"Type breakdown: {type_counts}")
    print(f"Sample factors: {[item['id'] for item in factors_array[:10]]}")  # Show first 10 IDs
else:
    type_counts = {"0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "100": 0, "101": 0, "102": 0, "-1": 0}
    for factor_data in factors.values():
        type_counts[str(factor_data["type"])] += 1
    
    print(f"DRY RUN: Would generate {len(factors)} unique base factors")
    print(f"Type breakdown: {type_counts}")
    print(f"Sample factors: {list(factors.keys())[:10]}")  # Show first 10 keys
