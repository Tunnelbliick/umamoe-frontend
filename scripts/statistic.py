import pandas as pd
import numpy as np
from sqlalchemy import create_engine
import json
import os
from datetime import datetime
from typing import Dict, List, Any, Tuple
from collections import Counter, defaultdict
import psycopg2
from tqdm import tqdm
import gzip
import time
from pathlib import Path
from pathlib import Path
import os
import sqlite3

class UmamusumeStatistics:
    def __init__(self, connection_string: str, dataset_version: str = None, game_db_path: str = None):
        """Initialize with database co        # Global uma distribution with percentages
        uma_counts = df['card_id'].value_counts().head(30)
        total_uma_entries = len(df)
        for char_id, count in uma_counts.items():
            char_name = self.get_character_name(str(char_id))
            char_color = self.get_character_color(str(char_id))
            global_stats['uma_distribution'][char_name] = {
                'count': int(count),
                'percentage': round(count / total_uma_entries * 100, 2),
                'character_id': str(char_id),
                'character_color': char_color
            }tring, optional dataset version, and game database path"""
        self.engine = create_engine(connection_string)
        
        # Store game database path for character color extraction
        self.game_db_path = game_db_path or 'C:/Users/lars1/AppData/LocalLow/Cygames/Umamusume/master/master.mdb'
        
        # Use provided version or generate from current date
        if dataset_version:
            self.dataset_version = dataset_version
        else:
            self.dataset_version = datetime.now().strftime("%Y-%m-%d")
        
        self.dataset_name = f"Statistics {self.dataset_version}"
        self.base_path = f"statistics/{self.dataset_version}"
        
        # Define mappings
        self.distance_types = {
            1: 'Sprint',
            2: 'Mile', 
            3: 'Medium',
            4: 'Long',
            5: 'Dirt'
        }
        
        self.running_styles = {
            1: 'Front Runner',
            2: 'Pace Chaser',
            3: 'Late Surger',
            4: 'End Closer'
        }
        
        # Load name mappings
        self.skill_names, self.skill_icons = self.load_skill_names()
        self.support_card_names, self.support_card_types = self.load_support_card_names()
        self.character_names = self.load_character_names()
        self.character_colors = self.load_character_colors()
        
        # Define consistent stat ranges and bucket configuration
        self.stat_config = {
            'speed': {'min': 0, 'max': 1200, 'buckets': 20},
            'stamina': {'min': 0, 'max': 1200, 'buckets': 20},
            'power': {'min': 0, 'max': 1200, 'buckets': 20},
            'guts': {'min': 0, 'max': 1200, 'buckets': 20},
            'wiz': {'min': 0, 'max': 1200, 'buckets': 20},
            'rank_score': {'min': 0, 'max': 17000, 'buckets': 20}
        }
        
        # Create statistics directory structure
        self.create_directory_structure()
    
    def create_directory_structure(self):
        """Create versioned directory structure for statistics"""
        directories = [
            'statistics',
            f'statistics/{self.dataset_version}',
            f'statistics/{self.dataset_version}/global',
            f'statistics/{self.dataset_version}/distance',
            f'statistics/{self.dataset_version}/characters'
        ]
        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)
    
    def load_skill_names(self) -> Tuple[Dict[str, str], Dict[str, str]]:
        """Load skill names and icons from skills.json"""
        try:
            with open('src/data/skills.json', 'r', encoding='utf-8') as f:
                skills = json.load(f)
            skill_map = {}
            icon_map = {}
            for skill in skills:
                if skill.get('skill_id'):
                    skill_id_str = str(skill['skill_id'])
                    skill_map[skill_id_str] = skill.get('name', f"Skill_{skill['skill_id']}")
                    icon_map[skill_id_str] = skill.get('icon', 'utx_ico_skill_10011.png')  # Default icon
            return skill_map, icon_map
        except FileNotFoundError:
            print("Warning: src/data/skills.json not found, using default names")
            return {}, {}
    
    def load_support_card_names(self) -> Tuple[Dict[str, str], Dict[str, str]]:
        """Load support card names and types from support-cards-db.json"""
        try:
            with open('src/data/support-cards-db.json', 'r', encoding='utf-8') as f:
                cards = json.load(f)
            card_map = {}
            type_map = {}
            for card in cards:
                if card.get('id'):
                    card_id = str(card['id'])
                    card_map[card_id] = card.get('name', f"Card_{card['id']}")
                    # Extract support type from card data - it's already a string like "power", "speed", etc.
                    if card.get('type'):
                        # Capitalize first letter for consistency
                        card_type = str(card['type']).capitalize()
                        type_map[card_id] = card_type
            return card_map, type_map
        except FileNotFoundError:
            print("Warning: src/data/support-cards-db.json not found, using default names")
            return {}, {}
    
    def load_character_names(self) -> Dict[str, str]:
        """Load character names from character.json"""
        try:
            with open('src/data/character.json', 'r', encoding='utf-8') as f:
                characters = json.load(f)
            char_map = {}
            for char in characters:
                if char.get('id'):
                    char_map[str(char['id'])] = char.get('name', f"Character_{char['id']}")
            return char_map
        except FileNotFoundError:
            print("Warning: src/data/character.json not found, using default names")
            return {}
    
    def load_character_colors(self) -> Dict[str, str]:
        """Load character colors from game database using card_data and chara_data tables"""
        try:
            if not os.path.exists(self.game_db_path):
                print(f"Warning: Game database not found at {self.game_db_path}, skipping color extraction")
                return {}
            
            color_map = {}
            
            with sqlite3.connect(self.game_db_path) as conn:
                cursor = conn.cursor()
                
                # Query to get chara_id from card_data and then ui_training_color_1 from chara_data
                # card_data contains 6-digit character IDs, chara_data contains the base chara_id and colors
                query = """
                SELECT DISTINCT 
                    cd.id as card_id,
                    cd.chara_id,
                    chr.ui_training_color_1
                FROM card_data cd
                LEFT JOIN chara_data chr ON cd.chara_id = chr.id
                WHERE chr.ui_training_color_1 IS NOT NULL
                """
                
                cursor.execute(query)
                results = cursor.fetchall()
                
                print(f"Loaded colors for {len(results)} characters from game database")
                
                for card_id, chara_id, ui_color in results:
                    # Store color for the 6-digit card ID
                    color_map[str(card_id)] = ui_color
                
            return color_map
            
        except sqlite3.Error as e:
            print(f"Warning: Could not load character colors from game database: {e}")
            return {}
        except Exception as e:
            print(f"Warning: Unexpected error loading character colors: {e}")
            return {}
    
    def get_character_color(self, char_id: str) -> str:
        """Get character UI training color"""
        char_id_str = str(char_id)
        return self.character_colors.get(char_id_str, None)
    
    def get_skill_name(self, skill_id: str) -> str:
        """Get skill name, handling inherited skills (9xxx -> 1xxx)"""
        skill_id_str = str(skill_id)
        
        # Handle inherited skills
        if skill_id_str.startswith('9') and len(skill_id_str) > 1:
            base_skill_id = '1' + skill_id_str[1:]
            if base_skill_id in self.skill_names:
                return f"{self.skill_names[base_skill_id]} (Inherited)"
        
        # Direct lookup
        if skill_id_str in self.skill_names:
            return self.skill_names[skill_id_str]
        
        return f"Skill_{skill_id}"
    
    def get_skill_icon(self, skill_id: str) -> str:
        """Get skill icon, handling inherited skills (9xxx -> 1xxx)"""
        skill_id_str = str(skill_id)
        
        # Handle inherited skills
        if skill_id_str.startswith('9') and len(skill_id_str) > 1:
            base_skill_id = '1' + skill_id_str[1:]
            if base_skill_id in self.skill_icons:
                return self.skill_icons[base_skill_id]
        
        # Direct lookup
        if skill_id_str in self.skill_icons:
            return self.skill_icons[skill_id_str]
        
        return 'utx_ico_skill_10011.png'  # Default icon
    
    def get_support_card_name(self, card_id: str) -> str:
        """Get support card name"""
        card_id_str = str(card_id)
        return self.support_card_names.get(card_id_str, f"Card_{card_id}")
    
    def get_support_card_type(self, card_id: str) -> str:
        """Get support card type"""
        card_id_str = str(card_id)
        return self.support_card_types.get(card_id_str, 'Unknown')
    
    def get_character_name(self, char_id: str) -> str:
        """Get character name"""
        char_id_str = str(char_id)
        return self.character_names.get(char_id_str, f"Character_{char_id}")
    
    def load_data(self) -> pd.DataFrame:
        """Load data from database with trainer information joined"""
        query = """
        SELECT 
            ts.*,
            t.team_class,
            t.best_team_class,
            t.name as trainer_name,
            t.fans as trainer_fans,
            t.follower_num
        FROM team_stadium ts
        LEFT JOIN trainer t ON ts.trainer_id = t.account_id
        ORDER BY ts.trainer_id, ts.distance_type, ts.member_id
        """
        print("Loading data from database...")
        df = pd.read_sql(query, self.engine)
        
        # Parse JSON fields
        def safe_json_parse(x):
            if isinstance(x, list):
                return x
            elif isinstance(x, str):
                return json.loads(x) if x else []
            else:
                return []
        
        df['skills'] = df['skills'].apply(safe_json_parse)
        df['support_cards'] = df['support_cards'].apply(safe_json_parse)
        
        # Convert distance_type and running_style to readable names
        df['distance_name'] = df['distance_type'].map(self.distance_types)
        df['running_style_name'] = df['running_style'].map(self.running_styles)
        
        return df
    
    def parse_item(self, item_str: str) -> Tuple[int, int]:
        """Parse support card ID and level from string like '300200' -> (30020, 0)"""
        if not item_str or not str(item_str).isdigit():
            return None, None
        item_str = str(item_str)
        if len(item_str) > 1:
            # For support cards, the format is: card_id + level
            # e.g., 300200 = card ID 30020 + level 0
            # Split the last digit as level, rest as card ID
            item_level = int(item_str[-1])
            item_id = int(item_str[:-1])
        else:
            item_id = 0
            item_level = int(item_str)
        return item_id, item_level
    
    def get_stat_distribution(self, series: pd.Series, stat_name: str) -> Dict[str, Any]:
        """Get stat distribution with consistent histogram buckets"""
        if len(series) == 0:
            return {}
        
        # Get config for this stat
        config = self.stat_config.get(stat_name, {
            'min': int(series.min()), 
            'max': int(series.max()), 
            'buckets': 20
        })
        
        # Create consistent buckets
        min_val = config['min']
        max_val = config['max']
        num_buckets = config['buckets']
        
        bucket_size = (max_val - min_val) / num_buckets
        buckets = {}
        
        for i in range(num_buckets):
            bucket_start = min_val + (i * bucket_size)
            bucket_end = min_val + ((i + 1) * bucket_size)
            
            if i == num_buckets - 1:
                # Last bucket includes max value
                count = len(series[(series >= bucket_start) & (series <= bucket_end)])
            else:
                count = len(series[(series >= bucket_start) & (series < bucket_end)])
            
            # Use consistent bucket key format
            bucket_key = f"{int(bucket_start)}-{int(bucket_end)}"
            buckets[bucket_key] = count
        
        return {
            'mean': float(series.mean()),
            'std': float(series.std()),
            'min': int(series.min()),
            'max': int(series.max()),
            'median': float(series.median()),
            'percentiles': {
                '25': float(series.quantile(0.25)),
                '50': float(series.quantile(0.50)),
                '75': float(series.quantile(0.75)),
                '95': float(series.quantile(0.95))
            },
            'count': len(series),
            'histogram': buckets
        }
    
    def analyze_support_card_combinations(self, support_cards_list: List[List[str]]) -> Dict[str, Any]:
        """Analyze support card type combinations"""
        combinations = []
        
        for cards in support_cards_list:
            if not cards:
                continue
            
            type_counts = defaultdict(int)
            for card in cards:
                card_id, _ = self.parse_item(str(card))
                if card_id:
                    card_type = self.get_support_card_type(str(card_id))
                    if card_type != 'Unknown':
                        # Normalize the type name (lowercase)
                        type_counts[card_type.lower()] += 1
            
            if type_counts:
                # Convert to regular dict for storing
                combinations.append(dict(type_counts))
        
        if not combinations:
            return {}
        
        # Count each unique combination
        combo_strings = []
        for combo in combinations:
            # Create a sorted string representation for counting
            sorted_combo = sorted(combo.items(), key=lambda x: (-x[1], x[0]))
            combo_str = '_'.join([f"{count}x{type_name}" for type_name, count in sorted_combo])
            combo_strings.append(combo_str)
        
        combo_counter = Counter(combo_strings)
        total = len(combinations)
        
        # Get top combinations with their actual type counts
        top_combinations = {}
        for combo_str, count in combo_counter.most_common(50):
            # Parse the combo string back to dict
            type_dict = {}
            for part in combo_str.split('_'):
                if 'x' in part:
                    count_str, type_name = part.split('x', 1)
                    type_dict[type_name] = int(count_str)
            
            top_combinations[combo_str] = {
                'count': count,
                'percentage': round(count / total * 100, 2),
                'composition': type_dict
            }
        
        return top_combinations
    
    def analyze_support_card_type_distribution(self, support_cards_list: List[List[str]]) -> Dict[str, Any]:
        """Analyze support card usage distribution by type - FIXED: Proper ID-based aggregation"""
        type_stats = defaultdict(lambda: {'total_count': 0, 'deck_count': 0, 'cards': defaultdict(lambda: {'count': 0, 'name': '', 'id': ''})})
        total_decks_with_cards = 0
        total_cards_used = 0
        
        for cards in support_cards_list:
            if not cards:
                continue
                
            deck_types_used = set()
            deck_has_valid_cards = False
            
            for card in cards:
                card_id, level = self.parse_item(str(card))
                if card_id:
                    card_name = self.get_support_card_name(str(card_id))
                    card_type = self.get_support_card_type(str(card_id))
                    
                    if card_type != 'Unknown':
                        type_normalized = card_type.lower()
                        type_stats[type_normalized]['total_count'] += 1
                        
                        # Use card_id as key for aggregation
                        card_key = str(card_id)
                        type_stats[type_normalized]['cards'][card_key]['count'] += 1
                        type_stats[type_normalized]['cards'][card_key]['name'] = card_name
                        type_stats[type_normalized]['cards'][card_key]['id'] = str(card_id)
                        
                        deck_types_used.add(type_normalized)
                        total_cards_used += 1
                        deck_has_valid_cards = True
            
            # Only count this deck if it has valid support cards
            if deck_has_valid_cards:
                total_decks_with_cards += 1
                
                # Count decks that use each type
                for deck_type in deck_types_used:
                    type_stats[deck_type]['deck_count'] += 1
        
        # Convert to regular dict and calculate percentages
        result = {}
        for card_type, stats in type_stats.items():
            # Sort cards by count and get top 50
            sorted_cards = sorted(stats['cards'].items(), key=lambda x: x[1]['count'], reverse=True)[:50]
            
            # Create top cards dict using card ID as key but including display info
            top_cards = {}
            for card_id, card_info in sorted_cards:
                # Use card_id as the key to maintain uniqueness
                top_cards[card_id] = {
                    'count': card_info['count'],
                    'name': card_info['name'],
                    'id': card_info['id']
                }
            
            result[card_type] = {
                'total_usage': stats['total_count'],
                'usage_percentage': round(stats['total_count'] / total_cards_used * 100, 2) if total_cards_used > 0 else 0,
                'deck_usage': stats['deck_count'],
                'deck_percentage': round(stats['deck_count'] / total_decks_with_cards * 100, 2) if total_decks_with_cards > 0 else 0,
                'avg_per_deck': round(stats['total_count'] / stats['deck_count'], 2) if stats['deck_count'] > 0 else 0,
                'top_cards': top_cards
            }
            
            result[card_type] = {
                'total_usage': stats['total_count'],
                'usage_percentage': round(stats['total_count'] / total_cards_used * 100, 2) if total_cards_used > 0 else 0,
                'deck_usage': stats['deck_count'],
                'deck_percentage': round(stats['deck_count'] / total_decks_with_cards * 100, 2) if total_decks_with_cards > 0 else 0,
                'avg_per_deck': round(stats['total_count'] / stats['deck_count'], 2) if stats['deck_count'] > 0 else 0,
                'top_cards': top_cards
            }
        
        # Sort by total usage
        return dict(sorted(result.items(), key=lambda x: x[1]['total_usage'], reverse=True))
    
    def process_items_with_levels(self, items: List[str], item_type: str) -> Dict[str, Any]:
        """Process items with names and levels - FIXED: Now aggregates by ID with proper counting"""
        item_stats = defaultdict(lambda: defaultdict(int))
        
        for item in items:
            if item:
                item_id, level = self.parse_item(str(item))
                if item_id is not None:
                    # Use item_id as the key to prevent incorrect merging
                    item_key = str(item_id)
                    item_stats[item_key][str(level)] += 1
        
        # Convert to regular dict and sort by total usage
        result = {}
        for item_key, levels in item_stats.items():
            total = sum(levels.values())
            
            # Get proper name based on item type
            if item_type == 'skills':
                item_name = self.get_skill_name(item_key)
                item_data = {
                    'total': total,
                    'by_level': dict(levels),
                    'avg_level': sum(int(lvl) * count for lvl, count in levels.items()) / total if total > 0 else 0,
                    'name': item_name,
                    'icon': self.get_skill_icon(item_key),
                    'id': item_key
                }
            elif item_type == 'support_cards':
                item_name = self.get_support_card_name(item_key)
                item_data = {
                    'total': total,
                    'by_level': dict(levels),
                    'avg_level': sum(int(lvl) * count for lvl, count in levels.items()) / total if total > 0 else 0,
                    'name': item_name,
                    'type': self.get_support_card_type(item_key),
                    'id': item_key
                }
            else:
                item_name = item_key
                item_data = {
                    'total': total,
                    'by_level': dict(levels),
                    'avg_level': sum(int(lvl) * count for lvl, count in levels.items()) / total if total > 0 else 0,
                    'name': item_name,
                    'id': item_key
                }
            
            # Use item_key (ID) as the result key to prevent overwrites
            result[item_key] = item_data
        
        # Sort by total usage and limit
        sorted_items = sorted(result.items(), key=lambda x: x[1]['total'], reverse=True)
        limit = 50  # Top 50 for both skills and support cards
        
        # Return items using ID as key
        return dict(sorted_items[:limit])
        
        # Sort by total usage and limit
        sorted_items = sorted(result.items(), key=lambda x: x[1]['total'], reverse=True)
        limit = 50  # Top 50 for both skills and support cards
        
        # Return items directly without 'items' wrapper
        return dict(sorted_items[:limit])
    
    def calculate_global_statistics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate global statistics"""
        print("Calculating global statistics...")
        
        global_stats = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'total_entries': len(df),
                'total_trainers': df['trainer_id'].nunique(),
                'total_unique_umas': df['card_id'].nunique(),
                'total_trained_umas': len(df)  # Total count for percentage calculations
            },
            'team_class_distribution': {},
            'uma_distribution': {},
            'stat_averages': {
                'overall': {},
                'by_team_class': {}
            },
            'support_cards': {
                'overall': {},
                'by_team_class': {}
            },
            'support_card_combinations': {
                'overall': {},
                'by_team_class': {}
            },
            'support_card_type_distribution': {
                'overall': {},
                'by_team_class': {}
            },
            'skills': {
                'overall': {},
                'by_team_class': {}
            }
        }
        
        # Team class distribution with percentages
        team_class_dist = df.groupby('trainer_id')['team_class'].first().value_counts().to_dict()
        total_trainers = df['trainer_id'].nunique()
        
        # Calculate total trained umas per team class
        team_class_uma_counts = df['team_class'].value_counts().to_dict()
        total_trained_umas = len(df)
        
        global_stats['team_class_distribution'] = {
            'total_trainers': total_trainers,
            'total_trained_umas': total_trained_umas
        }
        for team_class, trainer_count in team_class_dist.items():
            if pd.notna(team_class):
                uma_count = team_class_uma_counts.get(team_class, 0)
                global_stats['team_class_distribution'][str(int(team_class))] = {
                    'count': int(trainer_count),
                    'percentage': round(trainer_count / total_trainers * 100, 2),
                    'trained_umas': int(uma_count),
                    'trained_umas_percentage': round(uma_count / total_trained_umas * 100, 2)
                }
        
        # Global uma distribution with percentages
        uma_counts = df['card_id'].value_counts().head(30)
        total_uma_entries = len(df)
        for char_id, count in uma_counts.items():
            char_name = self.get_character_name(str(char_id))
            char_color = self.get_character_color(str(char_id))
            global_stats['uma_distribution'][char_name] = {
                'count': int(count),
                'percentage': round(count / total_uma_entries * 100, 2),
                'character_id': str(char_id),
                'character_color': char_color
            }
        
        # Overall stat averages
        stat_cols = ['speed', 'power', 'stamina', 'wiz', 'guts', 'rank_score']
        for stat in stat_cols:
            global_stats['stat_averages']['overall'][stat] = self.get_stat_distribution(df[stat], stat)
        
        # Calculate overall global support cards, skills, and combinations
        print("Calculating overall support cards and skills...")
        all_support_cards = []
        all_skills = []
        all_support_cards_by_team = []
        
        for idx, row in df.iterrows():
            all_support_cards.extend([str(c) for c in row['support_cards'] if c])
            all_skills.extend([str(s) for s in row['skills'] if s])
            if row['support_cards']:
                all_support_cards_by_team.append([str(c) for c in row['support_cards']])
        
        # Store overall statistics with totals
        support_cards_data = self.process_items_with_levels(all_support_cards, 'support_cards')
        global_stats['support_cards']['overall'] = support_cards_data
        global_stats['support_cards']['total_support_cards'] = len(all_support_cards)
        
        combinations_data = self.analyze_support_card_combinations(all_support_cards_by_team)
        global_stats['support_card_combinations']['overall'] = combinations_data
        global_stats['support_card_combinations']['total_combinations'] = len(all_support_cards_by_team)
        
        global_stats['support_card_type_distribution']['overall'] = \
            self.analyze_support_card_type_distribution(all_support_cards_by_team)
            
        skills_data = self.process_items_with_levels(all_skills, 'skills')
        global_stats['skills']['overall'] = skills_data
        global_stats['skills']['total_skills'] = len(all_skills)
        
        # Process by team class
        for team_class in df['team_class'].dropna().unique():
            if team_class >= 1:
                class_df = df[df['team_class'] == team_class]
                team_class_str = str(int(team_class))
                
                # Stat averages
                if len(class_df) > 100:
                    global_stats['stat_averages']['by_team_class'][team_class_str] = {}
                    for stat in stat_cols:
                        global_stats['stat_averages']['by_team_class'][team_class_str][stat] = \
                            self.get_stat_distribution(class_df[stat], stat)
                
                # Support cards, combinations, and skills by team class
                class_support_cards = []
                class_skills = []
                support_cards_by_team = []
                
                for idx, row in class_df.iterrows():
                    class_support_cards.extend([str(c) for c in row['support_cards'] if c])
                    class_skills.extend([str(s) for s in row['skills'] if s])
                    if row['support_cards']:
                        support_cards_by_team.append([str(c) for c in row['support_cards']])
                
                # Uma distribution by team class
                if 'uma_distribution' not in global_stats:
                    global_stats['uma_distribution'] = {'by_team_class': {}}
                elif 'by_team_class' not in global_stats['uma_distribution']:
                    global_stats['uma_distribution']['by_team_class'] = {}
                    
                uma_counts_class = class_df['card_id'].value_counts().head(30)
                total_uma_entries_class = len(class_df)
                global_stats['uma_distribution']['by_team_class'][team_class_str] = {}
                
                for char_id, count in uma_counts_class.items():
                    char_name = self.get_character_name(str(char_id))
                    char_color = self.get_character_color(str(char_id))
                    global_stats['uma_distribution']['by_team_class'][team_class_str][char_name] = {
                        'count': int(count),
                        'percentage': round(count / total_uma_entries_class * 100, 2),
                        'character_id': str(char_id),
                        'character_color': char_color
                    }
                
                # Store by team class with totals
                if not global_stats['support_cards']['by_team_class']:
                    global_stats['support_cards']['by_team_class'] = {}
                if not global_stats['support_card_combinations']['by_team_class']:
                    global_stats['support_card_combinations']['by_team_class'] = {}
                if not global_stats['skills']['by_team_class']:
                    global_stats['skills']['by_team_class'] = {}
                    
                global_stats['support_cards']['by_team_class'][team_class_str] = \
                    self.process_items_with_levels(class_support_cards, 'support_cards')
                global_stats['support_card_combinations']['by_team_class'][team_class_str] = \
                    self.analyze_support_card_combinations(support_cards_by_team)
                global_stats['support_card_type_distribution']['by_team_class'][team_class_str] = \
                    self.analyze_support_card_type_distribution(support_cards_by_team)
                global_stats['skills']['by_team_class'][team_class_str] = \
                    self.process_items_with_levels(class_skills, 'skills')
                
                # Add totals for this team class
                if f'total_support_cards_{team_class_str}' not in global_stats['support_cards']:
                    global_stats['support_cards'][f'total_support_cards_{team_class_str}'] = len(class_support_cards)
                if f'total_combinations_{team_class_str}' not in global_stats['support_card_combinations']:
                    global_stats['support_card_combinations'][f'total_combinations_{team_class_str}'] = len(support_cards_by_team)
                if f'total_skills_{team_class_str}' not in global_stats['skills']:
                    global_stats['skills'][f'total_skills_{team_class_str}'] = len(class_skills)
        
        return global_stats
    
    def calculate_distance_statistics(self, df: pd.DataFrame) -> None:
        """Calculate and save distance-specific statistics to separate files"""
        print("Calculating distance-specific statistics...")
        
        for distance_type, distance_name in self.distance_types.items():
            dist_df = df[df['distance_name'] == distance_name]
            
            if len(dist_df) == 0:
                continue
            
            print(f"  Processing {distance_name}...")
            
            distance_stats = {
                'metadata': {
                    'distance': distance_name,
                    'total_entries': len(dist_df),
                    'generated_at': datetime.now().isoformat()
                },
                'by_team_class': {}
            }
            
            # Process by team class
            for team_class in dist_df['team_class'].dropna().unique():
                if team_class >= 1:  # Only process classes 6+
                    class_df = dist_df[dist_df['team_class'] == team_class]
                    if len(class_df) > 50:
                        team_class_str = str(int(team_class))
                        
                        # Uma distribution with percentages
                        uma_counts = class_df['card_id'].value_counts().head(20)
                        total_uma_entries = len(class_df)
                        uma_dist = {}
                        for char_id, count in uma_counts.items():
                            char_name = self.get_character_name(str(char_id))
                            char_color = self.get_character_color(str(char_id))
                            uma_dist[char_name] = {
                                'count': int(count),
                                'percentage': round(count / total_uma_entries * 100, 2),
                                'character_id': str(char_id),
                                'character_color': char_color
                            }
                        
                        # Stat averages
                        stat_averages = {}
                        stat_cols = ['speed', 'power', 'stamina', 'wiz', 'guts', 'rank_score']
                        for stat in stat_cols:
                            stat_averages[stat] = self.get_stat_distribution(class_df[stat], stat)
                        
                        # Support cards and skills
                        class_cards = []
                        class_skills = []
                        support_cards_by_team = []
                        
                        for idx, row in class_df.iterrows():
                            class_cards.extend([str(c) for c in row['support_cards'] if c])
                            class_skills.extend([str(s) for s in row['skills'] if s])
                            if row['support_cards']:
                                support_cards_by_team.append([str(c) for c in row['support_cards']])
                        
                        distance_stats['by_team_class'][team_class_str] = {
                            'total_entries': len(class_df),
                            'total_trained_umas': len(class_df),
                            'uma_distribution': uma_dist,
                            'stat_averages': stat_averages,
                            'support_cards': self.process_items_with_levels(class_cards, 'support_cards'),
                            'total_support_cards': len(class_cards),
                            'support_card_combinations': self.analyze_support_card_combinations(support_cards_by_team),
                            'total_combinations': len(support_cards_by_team),
                            'support_card_type_distribution': self.analyze_support_card_type_distribution(support_cards_by_team),
                            'skills': self.process_items_with_levels(class_skills, 'skills'),
                            'total_skills': len(class_skills)
                        }
            
            # Save to file
            filename = f"{self.base_path}/distance/{distance_name.lower()}.json"
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(distance_stats, f, ensure_ascii=False, indent=2)
            print(f"    Saved to {filename}")
    
    def calculate_character_statistics(self, df: pd.DataFrame) -> None:
        """Calculate and save character-specific statistics to separate files"""
        print("Calculating character-specific statistics...")
        
        unique_characters = df['card_id'].unique()
        
        for char_id in tqdm(unique_characters, desc="Processing characters"):
            char_df = df[df['card_id'] == char_id]
            char_id_str = str(char_id)
            char_name = self.get_character_name(char_id_str)
            char_color = self.get_character_color(char_id_str)
            
            character_stats = {
                'metadata': {
                    'character_id': char_id_str,
                    'character_name': char_name,
                    'character_color': char_color,  # Add character color
                    'total_entries': len(char_df),
                    'total_trained_umas': len(char_df),
                    'generated_at': datetime.now().isoformat()
                },
                'global': {
                    'distance_distribution': {},
                    'running_style_distribution': {},
                    'team_class_distribution': {}
                },
                'by_distance': {}
            }
            
            # Distance distribution with percentages
            distance_counts = char_df['distance_name'].value_counts()
            total_distance_entries = len(char_df)
            character_stats['global']['distance_distribution'] = {
                'total_entries': total_distance_entries
            }
            for distance, count in distance_counts.items():
                character_stats['global']['distance_distribution'][str(distance)] = {
                    'count': int(count),
                    'percentage': round(count / total_distance_entries * 100, 2),
                    'character_id': char_id_str,
                    'character_color': char_color
                }
            
            # Running style distribution with percentages
            style_counts = char_df['running_style_name'].value_counts()
            total_style_entries = len(char_df)  # Use total character entries, not distance entries
            character_stats['global']['running_style_distribution'] = {
                'total_entries': total_style_entries
            }
            for style, count in style_counts.items():
                character_stats['global']['running_style_distribution'][str(style)] = {
                    'count': int(count),
                    'percentage': round(count / total_style_entries * 100, 2),
                    'character_id': char_id_str,
                    'character_color': char_color
                }
            
            # Team class distribution with percentages
            team_class_dist = char_df.groupby('trainer_id')['team_class'].first().value_counts().to_dict()
            total_trainers = char_df['trainer_id'].nunique()  # Use nunique() for clarity
            
            # Calculate total trained umas per team class for this character
            team_class_uma_counts = char_df['team_class'].value_counts().to_dict()
            total_trained_umas_char = len(char_df)
            
            character_stats['global']['team_class_distribution'] = {
                'total_trainers': total_trainers,
                'total_trained_umas': total_trained_umas_char
            }
            for team_class, trainer_count in team_class_dist.items():
                if pd.notna(team_class) and team_class >= 6:
                    uma_count = team_class_uma_counts.get(team_class, 0)
                    character_stats['global']['team_class_distribution'][str(int(team_class))] = {
                        'count': int(trainer_count),
                        'percentage': round(trainer_count / total_trainers * 100, 2),
                        'trained_umas': int(uma_count),
                        'trained_umas_percentage': round(uma_count / total_trained_umas_char * 100, 2),
                        'character_id': char_id_str,
                        'character_color': char_color
                    }
            
            # By distance and team class
            for distance_name in char_df['distance_name'].dropna().unique():
                dist_char_df = char_df[char_df['distance_name'] == distance_name]
                
                if len(dist_char_df) > 10:
                    character_stats['by_distance'][distance_name] = {
                        'by_team_class': {}
                    }
                    
                    for team_class in dist_char_df['team_class'].dropna().unique():
                        if team_class >= 1:
                            class_dist_df = dist_char_df[dist_char_df['team_class'] == team_class]
                            if len(class_dist_df) > 5:
                                team_class_str = str(int(team_class))
                                
                                # Stat averages with histogram data
                                stat_averages = {}
                                stat_cols = ['speed', 'power', 'stamina', 'wiz', 'guts', 'rank_score']
                                for stat in stat_cols:
                                    if len(class_dist_df) > 20:  # Only create histogram for larger datasets
                                        stat_averages[stat] = self.get_stat_distribution(class_dist_df[stat], stat)
                                    else:
                                        # Simplified stats for smaller datasets
                                        stat_averages[stat] = {
                                            'mean': float(class_dist_df[stat].mean()),
                                            'median': float(class_dist_df[stat].median()),
                                            'min': int(class_dist_df[stat].min()),
                                            'max': int(class_dist_df[stat].max()),
                                            'count': len(class_dist_df)
                                        }
                                
                                # Support cards and skills
                                cards = []
                                skills = []
                                support_cards_by_team = []
                                
                                for idx, row in class_dist_df.iterrows():
                                    cards.extend([str(c) for c in row['support_cards'] if c])
                                    skills.extend([str(s) for s in row['skills'] if s])
                                    if row['support_cards']:
                                        support_cards_by_team.append([str(c) for c in row['support_cards']])
                                
                                character_stats['by_distance'][distance_name]['by_team_class'][team_class_str] = {
                                    'total_entries': len(class_dist_df),
                                    'total_trained_umas': len(class_dist_df),
                                    'stat_averages': stat_averages,
                                    'common_support_cards': self.process_items_with_levels(cards, 'support_cards') if cards else {},
                                    'total_support_cards': len(cards),
                                    'support_card_combinations': self.analyze_support_card_combinations(support_cards_by_team) if support_cards_by_team else {},
                                    'total_combinations': len(support_cards_by_team),
                                    'support_card_type_distribution': self.analyze_support_card_type_distribution(support_cards_by_team) if support_cards_by_team else {},
                                    'common_skills': self.process_items_with_levels(skills, 'skills') if skills else {},
                                    'total_skills': len(skills)
                                }
            
            # Save to file
            filename = f"{self.base_path}/characters/{char_id_str}.json"
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(character_stats, f, ensure_ascii=False, indent=2)
    
    def compile_statistics(self) -> None:
        """Compile all statistics and save to versioned organized files"""
        # Load data
        df = self.load_data()
        
        # Calculate and save global statistics
        print("Processing global statistics...")
        global_stats = self.calculate_global_statistics(df)
        with open(f'statistics/{self.dataset_version}/global/global.json', 'w', encoding='utf-8') as f:
            json.dump(global_stats, f, ensure_ascii=False, indent=2)
        print(f"  Saved to statistics/{self.dataset_version}/global/global.json")
        
        # Calculate and save distance statistics (creates separate files)
        self.calculate_distance_statistics(df)
        
        # Calculate and save character statistics (creates separate files)
        self.calculate_character_statistics(df)
        
        # Create dataset-specific index file with metadata
        dataset_index = {
            'generated_at': datetime.now().isoformat(),
            'total_entries': len(df),
            'total_trainers': df['trainer_id'].nunique(),
            'total_characters': df['card_id'].nunique(),
            'distances': list(self.distance_types.values()),
            'character_ids': [str(cid) for cid in sorted(df['card_id'].unique())],
            'version': self.dataset_version,
            'name': self.dataset_name
        }
        
        with open(f'statistics/{self.dataset_version}/index.json', 'w', encoding='utf-8') as f:
            json.dump(dataset_index, f, ensure_ascii=False, indent=2)
        
        # Update or create master datasets index
        self.update_master_index(dataset_index)
        
        print("\nAll statistics compiled successfully!")
        print(f"Files saved in ./statistics/{self.dataset_version}/ directory")
        print(f"Dataset version: {self.dataset_version}")

    def update_master_index(self, dataset_index: Dict[str, Any]) -> None:
        """Update the master index of all available datasets"""
        master_index_path = 'statistics/datasets.json'
        
        # Load existing master index or create new one
        if os.path.exists(master_index_path):
            with open(master_index_path, 'r', encoding='utf-8') as f:
                master_index = json.load(f)
        else:
            master_index = {
                'datasets': [],
                'last_updated': datetime.now().isoformat()
            }
        
        # Remove existing entry for this version if it exists
        master_index['datasets'] = [
            ds for ds in master_index['datasets'] 
            if ds.get('version') != self.dataset_version
        ]
        
        # Add new dataset entry
        dataset_entry = {
            'id': self.dataset_version,
            'version': self.dataset_version,
            'name': self.dataset_name,
            'date': dataset_index['generated_at'],
            'basePath': f'/assets/statistics/{self.dataset_version}',
            'index': dataset_index
        }
        
        master_index['datasets'].append(dataset_entry)
        master_index['last_updated'] = datetime.now().isoformat()
        
        # Sort datasets by date (newest first)
        master_index['datasets'].sort(key=lambda x: x['date'], reverse=True)
        
        # Save updated master index
        with open(master_index_path, 'w', encoding='utf-8') as f:
            json.dump(master_index, f, ensure_ascii=False, indent=2)
        
        print(f"  Updated master datasets index with {len(master_index['datasets'])} datasets")


def main():
    # Configure your database connection
    CONNECTION_STRING = "postgresql://honsemoe:awx3cdl0@127.0.0.1:5432/honsemoe_db"
    
    # Path to the game database (adjust as needed)
    GAME_DB_PATH = "C:/Users/lars1/AppData/LocalLow/Cygames/Umamusume/master/master.mdb"
    
    # Initialize and run statistics compilation
    stats_compiler = UmamusumeStatistics(CONNECTION_STRING, game_db_path=GAME_DB_PATH)
    stats_compiler.compile_statistics()


if __name__ == "__main__":
    main()