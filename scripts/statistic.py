import pandas as pd
import numpy as np
from sqlalchemy import create_engine
import json
import os
import itertools
from datetime import datetime
from typing import Dict, List, Any, Tuple
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import psycopg2
from tqdm import tqdm
import gzip
import time
from pathlib import Path
import sqlite3

try:
    import orjson as _orjson
    def _json_loads(s): return _orjson.loads(s)
except ImportError:
    _orjson = None
    def _json_loads(s): return json.loads(s)

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
        self.game_db_path = game_db_path or 'C:/Users/lars/AppData/LocalLow/Cygames/Umamusume/master/master.mdb'
        
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
        
        self.scenarios = {
            1: 'URA',
            2: 'Aoharu',
            3: 'Climax',
            4: 'Grand Masters',
            5: 'UAF'
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
            t.follower_num,
            COALESCE(ts.scenario_id, 1) as effective_scenario_id
        FROM team_stadium ts
        LEFT JOIN trainer t ON ts.trainer_id = t.account_id
        ORDER BY ts.trainer_id, ts.distance_type, ts.member_id
        """
        print("Loading data from database...")
        # Use chunksize + concat to avoid one giant allocation; also lets SQLAlchemy stream
        chunks = pd.read_sql(query, self.engine, chunksize=200_000)
        df = pd.concat(chunks, ignore_index=True)
        
        # Use effective_scenario_id to resolve potential duplicate column issues from ts.*
        if 'effective_scenario_id' in df.columns:
            df['scenario_id'] = df['effective_scenario_id']
        
        # Parse JSON fields — use orjson when available (up to 10x faster than stdlib json)
        def _parse_col(col: pd.Series) -> pd.Series:
            """Vectorised JSON parse for a column of JSON strings / already-parsed lists."""
            out = [None] * len(col)
            for i, x in enumerate(col):
                if isinstance(x, list):
                    out[i] = x
                elif x:
                    try:
                        out[i] = _json_loads(x)
                    except Exception:
                        out[i] = []
                else:
                    out[i] = []
            return pd.array(out, dtype=object)

        print("  Parsing JSON columns...")
        df['skills'] = _parse_col(df['skills'])
        df['support_cards'] = _parse_col(df['support_cards'])
        
        # Convert distance_type, running_style, and scenario_id to readable names
        df['distance_name'] = df['distance_type'].map(self.distance_types)
        df['running_style_name'] = df['running_style'].map(self.running_styles)
        df['scenario_name'] = df['scenario_id'].map(self.scenarios).fillna('Unknown')
        
        print(f"  Loaded {len(df):,} rows.")
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
        """Get stat distribution with consistent histogram buckets.
        Uses np.histogram for a single O(N) C-level pass instead of 20 boolean-mask passes."""
        if len(series) == 0:
            return {}
        
        config = self.stat_config.get(stat_name, {
            'min': int(series.min()),
            'max': int(series.max()),
            'buckets': 20
        })
        min_val = config['min']
        max_val = config['max']
        num_buckets = config['buckets']
        
        # Single-pass histogram entirely in C/numpy
        edges = np.linspace(min_val, max_val, num_buckets + 1)
        arr = series.to_numpy(dtype=np.float64, na_value=np.nan)
        arr = arr[~np.isnan(arr)]
        counts, _ = np.histogram(arr, bins=edges)
        
        buckets = {
            f"{int(edges[i])}-{int(edges[i + 1])}": int(counts[i])
            for i in range(num_buckets)
        }
        
        return {
            'mean': float(np.mean(arr)),
            'std': float(np.std(arr, ddof=1)) if len(arr) > 1 else 0.0,
            'min': int(np.min(arr)),
            'max': int(np.max(arr)),
            'median': float(np.median(arr)),
            'percentiles': {
                '25': float(np.percentile(arr, 25)),
                '50': float(np.percentile(arr, 50)),
                '75': float(np.percentile(arr, 75)),
                '95': float(np.percentile(arr, 95))
            },
            'count': len(arr),
            'histogram': buckets
        }
    
    def _get_raw_to_type_map(self) -> Dict[str, str]:
        """Build / return a cached raw-card-string → lowercased card-type dict.
        Covers every possible card_id × level (0-9) combination up-front so
        per-deck lookups are guaranteed O(1) dict gets with no branching."""
        if hasattr(self, '_raw_to_type_map_cache'):
            return self._raw_to_type_map_cache
        mapping: Dict[str, str] = {}
        for card_id_str, card_type in self.support_card_types.items():
            ct = card_type.lower()
            for level in range(10):
                mapping[f"{card_id_str}{level}"] = ct
        self._raw_to_type_map_cache = mapping
        return mapping

    def analyze_support_card_combinations(self, support_cards_list: List[List[str]]) -> Dict[str, Any]:
        """Analyze support card type combinations.
        Vectorised via pandas explode + groupby to avoid a Python loop over every card."""
        if not support_cards_list:
            return {}

        raw_to_type = self._get_raw_to_type_map()
        total = len(support_cards_list)

        # Build a Series of lists, explode, map types, re-group by deck index
        s = pd.Series(support_cards_list, dtype=object)
        exp = s.explode()                              # index = original deck index
        exp = exp.dropna().astype(str)
        exp = exp[exp != '']

        type_series = exp.map(raw_to_type)             # unknown raws → NaN
        type_series = type_series.dropna()

        if type_series.empty:
            return {}

        # Per deck: sorted combo string
        def _make_combo(types):
            cnt = Counter(types)
            return '_'.join(f"{v}x{k}" for k, v in sorted(cnt.items(), key=lambda x: (-x[1], x[0])))

        combo_series = type_series.groupby(level=0).agg(list).map(_make_combo)
        combo_counter = Counter(combo_series)

        top_combinations = {}
        for combo_str, count in combo_counter.most_common(50):
            if not combo_str:
                continue
            type_dict = {}
            for part in combo_str.split('_'):
                if 'x' in part:
                    cnt_str, type_name = part.split('x', 1)
                    type_dict[type_name] = int(cnt_str)
            top_combinations[combo_str] = {
                'count': count,
                'percentage': round(count / total * 100, 2),
                'composition': type_dict
            }

        return top_combinations
    
    def analyze_support_card_type_distribution(self, support_cards_list: List[List[str]]) -> Dict[str, Any]:
        """Analyze support card usage distribution by type.
        Vectorised via pandas explode + groupby."""
        if not support_cards_list:
            return {}

        raw_to_type = self._get_raw_to_type_map()

        # Build raw → card_id lookup (strip last char = level)
        if not hasattr(self, '_raw_to_id_cache'):
            self._raw_to_id_cache: Dict[str, int] = {}
            for card_id_str in self.support_card_types:
                cid = int(card_id_str)
                for level in range(10):
                    self._raw_to_id_cache[f"{card_id_str}{level}"] = cid
        raw_to_id = self._raw_to_id_cache

        # Build raw → card_name lookup
        if not hasattr(self, '_raw_to_name_cache'):
            self._raw_to_name_cache: Dict[str, str] = {}
            for card_id_str, name in self.support_card_names.items():
                for level in range(10):
                    self._raw_to_name_cache[f"{card_id_str}{level}"] = name
        raw_to_name = self._raw_to_name_cache

        s = pd.Series(support_cards_list, dtype=object)
        total_decks = len(s)

        exp = s.explode().dropna().astype(str)
        exp = exp[exp != '']
        if exp.empty:
            return {}

        # Map to card_id and card_type
        deck_idx = exp.index                       # original deck indices
        card_ids = exp.map(raw_to_id)              # NaN for unknowns
        card_types = exp.map(raw_to_type)          # NaN for unknowns
        card_names = exp.map(raw_to_name)

        valid = card_types.notna() & card_ids.notna()
        card_ids = card_ids[valid].astype(int)
        card_types = card_types[valid]
        card_names = card_names[valid].fillna('')
        deck_idx_valid = deck_idx[valid]

        if card_types.empty:
            return {}

        total_cards_used = int(valid.sum())
        total_decks_with_cards = int(pd.Series(deck_idx_valid).nunique())

        # Deck-level type presence for deck_count
        deck_type_df = pd.DataFrame({'deck': deck_idx_valid, 'card_type': card_types.values})
        deck_type_counts = deck_type_df.drop_duplicates().groupby('card_type').size()

        # Card-level counts per (type, card_id)
        card_df = pd.DataFrame({
            'card_type': card_types.values,
            'card_id': card_ids.values,
            'card_name': card_names.values
        })
        card_counts = card_df.groupby(['card_type', 'card_id']).agg(
            count=('card_id', 'size'),
            name=('card_name', 'first')
        ).reset_index()
        type_totals = card_df.groupby('card_type').size()

        result = {}
        for ct, group in card_counts.groupby('card_type'):
            total_ct = int(type_totals[ct])
            dk = int(deck_type_counts.get(ct, 0))
            top_cards = {}
            for row in group.nlargest(50, 'count').itertuples(index=False):
                cid_str = str(row.card_id)
                top_cards[cid_str] = {
                    'count': int(row.count),
                    'name': row.name,
                    'id': cid_str
                }
            result[ct] = {
                'total_usage': total_ct,
                'usage_percentage': round(total_ct / total_cards_used * 100, 2) if total_cards_used > 0 else 0,
                'deck_usage': dk,
                'deck_percentage': round(dk / total_decks_with_cards * 100, 2) if total_decks_with_cards > 0 else 0,
                'avg_per_deck': round(total_ct / dk, 2) if dk > 0 else 0,
                'top_cards': top_cards
            }

        return dict(sorted(result.items(), key=lambda x: x[1]['total_usage'], reverse=True))
    
    def process_items_with_levels(self, items, item_type: str) -> Dict[str, Any]:
        """Process items with names and levels. Accepts a flat iterable (list, iterator, or
        generator) of raw item strings. Uses itertools.chain to avoid building a full copy."""
        if items is None:
            return {}
        # Accept both lists and generators; count raw tokens (parse_item only called per unique)
        raw_counts: Counter = Counter(items)
        item_stats: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

        for item_str, count in raw_counts.items():
            if item_str:
                item_id, level = self.parse_item(str(item_str))
                if item_id is not None:
                    item_stats[str(item_id)][str(level)] += count

        result = {}
        for item_key, levels in item_stats.items():
            total = sum(levels.values())
            avg_level = sum(int(lvl) * cnt for lvl, cnt in levels.items()) / total if total > 0 else 0

            if item_type == 'skills':
                result[item_key] = {
                    'total': total,
                    'by_level': dict(levels),
                    'avg_level': avg_level,
                    'name': self.get_skill_name(item_key),
                    'icon': self.get_skill_icon(item_key),
                    'id': item_key
                }
            elif item_type == 'support_cards':
                result[item_key] = {
                    'total': total,
                    'by_level': dict(levels),
                    'avg_level': avg_level,
                    'name': self.get_support_card_name(item_key),
                    'type': self.get_support_card_type(item_key),
                    'id': item_key
                }
            else:
                result[item_key] = {
                    'total': total,
                    'by_level': dict(levels),
                    'avg_level': avg_level,
                    'name': item_key,
                    'id': item_key
                }

        sorted_items = sorted(result.items(), key=lambda x: x[1]['total'], reverse=True)
        return dict(sorted_items[:50])
    
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
            'scenario_distribution': {},
            'uma_distribution': {},
            'stat_averages': {
                'overall': {},
                'by_team_class': {},
                'by_scenario': {}
            },
            'support_cards': {
                'overall': {},
                'by_team_class': {},
                'by_scenario': {}
            },
            'support_card_combinations': {
                'overall': {},
                'by_team_class': {},
                'by_scenario': {}
            },
            'support_card_type_distribution': {
                'overall': {},
                'by_team_class': {},
                'by_scenario': {}
            },
            'skills': {
                'overall': {},
                'by_team_class': {},
                'by_scenario': {}
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
            'total_trained_umas': total_trained_umas,
            'by_scenario': {}
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
        
        # Calculate team class distribution by scenario
        for scenario_id in df['scenario_id'].dropna().unique():
            scenario_df = df[df['scenario_id'] == scenario_id]
            scenario_str = str(int(scenario_id))
            
            # Trainer counts in this scenario
            sc_team_class_dist = scenario_df.groupby('trainer_id')['team_class'].first().value_counts().to_dict()
            sc_total_trainers = scenario_df['trainer_id'].nunique()
            
            # Uma counts in this scenario
            sc_team_class_uma_counts = scenario_df['team_class'].value_counts().to_dict()
            sc_total_umas = len(scenario_df)
            
            global_stats['team_class_distribution']['by_scenario'][scenario_str] = {
                'total_trainers': sc_total_trainers,
                'total_trained_umas': sc_total_umas
            }
            
            for team_class, trainer_count in sc_team_class_dist.items():
                 if pd.notna(team_class):
                    uma_count = sc_team_class_uma_counts.get(team_class, 0)
                    global_stats['team_class_distribution']['by_scenario'][scenario_str][str(int(team_class))] = {
                        'count': int(trainer_count),
                        'percentage': round(trainer_count / sc_total_trainers * 100, 2) if sc_total_trainers > 0 else 0,
                        'trained_umas': int(uma_count),
                        'trained_umas_percentage': round(uma_count / sc_total_umas * 100, 2) if sc_total_umas > 0 else 0
                    }

        # Scenario distribution with percentages
        scenario_counts = df['scenario_id'].value_counts().to_dict()
        global_stats['scenario_distribution'] = {
            'total_entries': total_trained_umas
        }
        for scenario_id, count in scenario_counts.items():
            if pd.notna(scenario_id):
                scenario_name = self.scenarios.get(int(scenario_id), f'Scenario_{scenario_id}')
                global_stats['scenario_distribution'][str(int(scenario_id))] = {
                    'name': scenario_name,
                    'count': int(count),
                    'percentage': round(count / total_trained_umas * 100, 2)
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
        
        # Flatten using itertools.chain — avoids building an intermediate list copy
        all_support_cards = list(map(str, filter(None, itertools.chain.from_iterable(df['support_cards']))))
        all_skills = list(map(str, filter(None, itertools.chain.from_iterable(df['skills']))))
        all_support_cards_by_team = [list(map(str, cards)) for cards in df['support_cards'] if cards]
        
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
                
                # Initialize structure for this team class
                for metric in ['stat_averages', 'support_cards', 'support_card_combinations', 'support_card_type_distribution', 'skills']:
                    if team_class_str not in global_stats[metric]['by_team_class']:
                        global_stats[metric]['by_team_class'][team_class_str] = {
                            'overall': {},
                            'by_scenario': {}
                        }
                
                # Uma distribution special handling
                if 'uma_distribution' not in global_stats:
                    global_stats['uma_distribution'] = {'by_team_class': {}}
                elif 'by_team_class' not in global_stats['uma_distribution']:
                    global_stats['uma_distribution']['by_team_class'] = {}
                
                global_stats['uma_distribution']['by_team_class'][team_class_str] = {
                    'overall': {},
                    'by_scenario': {}
                }
                
                # --- OVERALL STATS FOR TEAM CLASS ---
                
                # Stat averages
                if len(class_df) > 100:
                    for stat in stat_cols:
                        global_stats['stat_averages']['by_team_class'][team_class_str]['overall'][stat] = \
                            self.get_stat_distribution(class_df[stat], stat)
                
                # Support cards, combinations, and skills by team class
                class_support_cards = [str(c) for sublist in class_df['support_cards'] for c in sublist if c]
                class_skills = [str(s) for sublist in class_df['skills'] for s in sublist if s]
                support_cards_by_team = [list(map(str, cards)) for cards in class_df['support_cards'] if cards]
                
                # Uma distribution by team class
                uma_counts_class = class_df['card_id'].value_counts().head(30)
                total_uma_entries_class = len(class_df)
                
                for char_id, count in uma_counts_class.items():
                    char_name = self.get_character_name(str(char_id))
                    char_color = self.get_character_color(str(char_id))
                    global_stats['uma_distribution']['by_team_class'][team_class_str]['overall'][char_name] = {
                        'count': int(count),
                        'percentage': round(count / total_uma_entries_class * 100, 2),
                        'character_id': str(char_id),
                        'character_color': char_color
                    }
                
                # Store by team class with totals
                global_stats['support_cards']['by_team_class'][team_class_str]['overall'] = \
                    self.process_items_with_levels(class_support_cards, 'support_cards')
                global_stats['support_card_combinations']['by_team_class'][team_class_str]['overall'] = \
                    self.analyze_support_card_combinations(support_cards_by_team)
                global_stats['support_card_type_distribution']['by_team_class'][team_class_str]['overall'] = \
                    self.analyze_support_card_type_distribution(support_cards_by_team)
                global_stats['skills']['by_team_class'][team_class_str]['overall'] = \
                    self.process_items_with_levels(class_skills, 'skills')
                
                # Add totals for this team class
                if f'total_support_cards_{team_class_str}' not in global_stats['support_cards']:
                    global_stats['support_cards'][f'total_support_cards_{team_class_str}'] = len(class_support_cards)
                if f'total_combinations_{team_class_str}' not in global_stats['support_card_combinations']:
                    global_stats['support_card_combinations'][f'total_combinations_{team_class_str}'] = len(support_cards_by_team)
                if f'total_skills_{team_class_str}' not in global_stats['skills']:
                    global_stats['skills'][f'total_skills_{team_class_str}'] = len(class_skills)
                
                # Process by scenario within team class
                for scenario_id in class_df['scenario_id'].dropna().unique():
                    if scenario_id >= 1:
                        scenario_class_df = class_df[class_df['scenario_id'] == scenario_id]
                        scenario_str = str(int(scenario_id))
                        
                        # Initialize scenario dicts
                        for metric in ['stat_averages', 'support_cards', 'support_card_combinations', 'support_card_type_distribution', 'skills']:
                             global_stats[metric]['by_team_class'][team_class_str]['by_scenario'][scenario_str] = {}
                        
                        global_stats['uma_distribution']['by_team_class'][team_class_str]['by_scenario'][scenario_str] = {}
                        
                        # Stat averages
                        for stat in stat_cols:
                             global_stats['stat_averages']['by_team_class'][team_class_str]['by_scenario'][scenario_str][stat] = \
                                 self.get_stat_distribution(scenario_class_df[stat], stat)
                        
                        # Support cards, combinations, and skills by team class AND scenario
                        sc_support_cards = [str(c) for sublist in scenario_class_df['support_cards'] for c in sublist if c]
                        sc_skills = [str(s) for sublist in scenario_class_df['skills'] for s in sublist if s]
                        sc_support_cards_by_team = [list(map(str, cards)) for cards in scenario_class_df['support_cards'] if cards]
                        
                        global_stats['support_cards']['by_team_class'][team_class_str]['by_scenario'][scenario_str] = \
                            self.process_items_with_levels(sc_support_cards, 'support_cards')
                        global_stats['support_card_combinations']['by_team_class'][team_class_str]['by_scenario'][scenario_str] = \
                            self.analyze_support_card_combinations(sc_support_cards_by_team)
                        global_stats['support_card_type_distribution']['by_team_class'][team_class_str]['by_scenario'][scenario_str] = \
                            self.analyze_support_card_type_distribution(sc_support_cards_by_team)
                        global_stats['skills']['by_team_class'][team_class_str]['by_scenario'][scenario_str] = \
                            self.process_items_with_levels(sc_skills, 'skills')
                        
                        # Uma distribution by team class AND scenario
                        uma_counts_scenario_class = scenario_class_df['card_id'].value_counts().head(30)
                        total_uma_entries_scenario_class = len(scenario_class_df)
                        
                        for char_id, count in uma_counts_scenario_class.items():
                            char_name = self.get_character_name(str(char_id))
                            char_color = self.get_character_color(str(char_id))
                            global_stats['uma_distribution']['by_team_class'][team_class_str]['by_scenario'][scenario_str][char_name] = {
                                'count': int(count),
                                'percentage': round(count / total_uma_entries_scenario_class * 100, 2),
                                'character_id': str(char_id),
                                'character_color': char_color
                            }
        
        # Process by scenario
        for scenario_id in df['scenario_id'].dropna().unique():
            if scenario_id >= 1:
                scenario_df = df[df['scenario_id'] == scenario_id]
                scenario_str = str(int(scenario_id))
                scenario_name = self.scenarios.get(int(scenario_id), f'Scenario_{scenario_id}')
                
                print(f"  Processing scenario {scenario_name}...")
                
                # Stat averages by scenario (if sufficient data)
                if len(scenario_df) > 100:
                    global_stats['stat_averages']['by_scenario'][scenario_str] = {}
                    for stat in stat_cols:
                        global_stats['stat_averages']['by_scenario'][scenario_str][stat] = \
                            self.get_stat_distribution(scenario_df[stat], stat)
                
                # Support cards, combinations, and skills by scenario
                scenario_support_cards = [str(c) for sublist in scenario_df['support_cards'] for c in sublist if c]
                scenario_skills = [str(s) for sublist in scenario_df['skills'] for s in sublist if s]
                scenario_support_cards_by_team = [list(map(str, cards)) for cards in scenario_df['support_cards'] if cards]
                
                # Store by scenario with totals
                if not global_stats['support_cards']['by_scenario']:
                    global_stats['support_cards']['by_scenario'] = {}
                if not global_stats['support_card_combinations']['by_scenario']:
                    global_stats['support_card_combinations']['by_scenario'] = {}
                if not global_stats['skills']['by_scenario']:
                    global_stats['skills']['by_scenario'] = {}
                
                global_stats['support_cards']['by_scenario'][scenario_str] = \
                    self.process_items_with_levels(scenario_support_cards, 'support_cards')
                global_stats['support_card_combinations']['by_scenario'][scenario_str] = \
                    self.analyze_support_card_combinations(scenario_support_cards_by_team)
                global_stats['support_card_type_distribution']['by_scenario'][scenario_str] = \
                    self.analyze_support_card_type_distribution(scenario_support_cards_by_team)
                global_stats['skills']['by_scenario'][scenario_str] = \
                    self.process_items_with_levels(scenario_skills, 'skills')
                
                # Add totals for this scenario
                global_stats['support_cards'][f'total_support_cards_scenario_{scenario_str}'] = len(scenario_support_cards)
                global_stats['support_card_combinations'][f'total_combinations_scenario_{scenario_str}'] = len(scenario_support_cards_by_team)
                global_stats['skills'][f'total_skills_scenario_{scenario_str}'] = len(scenario_skills)
        
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
                'by_team_class': {},
                'by_scenario': {}
            }
            
            # Process by team class
            for team_class in dist_df['team_class'].dropna().unique():
                if team_class >= 1:  # Only process classes 6+
                    class_df = dist_df[dist_df['team_class'] == team_class]
                    if len(class_df) > 50:
                        team_class_str = str(int(team_class))
                        
                        # --- OVERALL ---
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
                        class_cards = [str(c) for sublist in class_df['support_cards'] for c in sublist if c]
                        class_skills = [str(s) for sublist in class_df['skills'] for s in sublist if s]
                        support_cards_by_team = [list(map(str, cards)) for cards in class_df['support_cards'] if cards]
                        
                        distance_stats['by_team_class'][team_class_str] = {
                            'overall': {
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
                            },
                            'by_scenario': {}
                        }

                        # --- BY SCENARIO ---
                        for scenario_id in class_df['scenario_id'].dropna().unique():
                            if scenario_id >= 1:
                                scenario_class_df = class_df[class_df['scenario_id'] == scenario_id]
                                scenario_str = str(int(scenario_id))
                                
                                # Uma distribution
                                sc_uma_counts = scenario_class_df['card_id'].value_counts().head(20)
                                sc_total_uma = len(scenario_class_df)
                                sc_uma_dist = {}
                                for char_id, count in sc_uma_counts.items():
                                    char_name = self.get_character_name(str(char_id))
                                    char_color = self.get_character_color(str(char_id))
                                    sc_uma_dist[char_name] = {
                                        'count': int(count),
                                        'percentage': round(count / sc_total_uma * 100, 2),
                                        'character_id': str(char_id),
                                        'character_color': char_color
                                    }
                                
                                # Stat averages
                                sc_stat_averages = {}
                                for stat in stat_cols:
                                    sc_stat_averages[stat] = self.get_stat_distribution(scenario_class_df[stat], stat)
                                
                                # Support cards and skills
                                sc_cards = [str(c) for sublist in scenario_class_df['support_cards'] for c in sublist if c]
                                sc_skills = [str(s) for sublist in scenario_class_df['skills'] for s in sublist if s]
                                sc_support_cards_by_team = [list(map(str, cards)) for cards in scenario_class_df['support_cards'] if cards]
                                
                                distance_stats['by_team_class'][team_class_str]['by_scenario'][scenario_str] = {
                                    'total_entries': len(scenario_class_df),
                                    'total_trained_umas': len(scenario_class_df),
                                    'uma_distribution': sc_uma_dist,
                                    'stat_averages': sc_stat_averages,
                                    'support_cards': self.process_items_with_levels(sc_cards, 'support_cards'),
                                    'total_support_cards': len(sc_cards),
                                    'support_card_combinations': self.analyze_support_card_combinations(sc_support_cards_by_team),
                                    'total_combinations': len(sc_support_cards_by_team),
                                    'support_card_type_distribution': self.analyze_support_card_type_distribution(sc_support_cards_by_team),
                                    'skills': self.process_items_with_levels(sc_skills, 'skills'),
                                    'total_skills': len(sc_skills)
                                }
            
            # Process by scenario
            for scenario_id in dist_df['scenario_id'].dropna().unique():
                if scenario_id >= 1:
                    scenario_df = dist_df[dist_df['scenario_id'] == scenario_id]
                    if len(scenario_df) > 50:
                        scenario_str = str(int(scenario_id))
                        scenario_name = self.scenarios.get(int(scenario_id), f'Scenario_{scenario_id}')
                        
                        # Uma distribution with percentages
                        uma_counts = scenario_df['card_id'].value_counts().head(20)
                        total_uma_entries = len(scenario_df)
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
                            stat_averages[stat] = self.get_stat_distribution(scenario_df[stat], stat)
                        
                        # Support cards and skills
                        scenario_cards = [str(c) for sublist in scenario_df['support_cards'] for c in sublist if c]
                        scenario_skills = [str(s) for sublist in scenario_df['skills'] for s in sublist if s]
                        support_cards_by_team = [list(map(str, cards)) for cards in scenario_df['support_cards'] if cards]
                        
                        distance_stats['by_scenario'][scenario_str] = {
                            'name': scenario_name,
                            'total_entries': len(scenario_df),
                            'total_trained_umas': len(scenario_df),
                            'uma_distribution': uma_dist,
                            'stat_averages': stat_averages,
                            'support_cards': self.process_items_with_levels(scenario_cards, 'support_cards'),
                            'total_support_cards': len(scenario_cards),
                            'support_card_combinations': self.analyze_support_card_combinations(support_cards_by_team),
                            'total_combinations': len(support_cards_by_team),
                            'support_card_type_distribution': self.analyze_support_card_type_distribution(support_cards_by_team),
                            'skills': self.process_items_with_levels(scenario_skills, 'skills'),
                            'total_skills': len(scenario_skills)
                        }
            
            # Save to file
            filename = f"{self.base_path}/distance/{distance_name.lower()}.json"
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(distance_stats, f, ensure_ascii=False, indent=2)
            print(f"    Saved to {filename}")
    
    def _write_character_file(self, char_id_str: str, character_stats: dict) -> str:
        """Write one character JSON file (called from thread pool)."""
        filename = f"{self.base_path}/characters/{char_id_str}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(character_stats, f, ensure_ascii=False, indent=2)
        return filename

    def calculate_character_statistics(self, df: pd.DataFrame) -> None:
        """Calculate and save character-specific statistics to separate files.
        Uses df.groupby so we scan the DataFrame exactly once instead of once per character.
        File I/O is parallelised across a thread pool."""
        print("Calculating character-specific statistics...")

        # Group once — O(N) scan instead of O(N × N_characters)
        grouped = df.groupby('card_id', sort=False)
        futures_map = {}

        with ThreadPoolExecutor(max_workers=8) as executor:
          for char_id, char_df in tqdm(grouped, desc="Processing characters", total=grouped.ngroups):
            char_id_str = str(char_id)
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
                    'scenario_distribution': {},
                    'team_class_distribution': {}
                },
                'overall': {},
                'by_scenario': {},
                'by_distance': {}
            }
            
            # --- OVERALL CHARACTER STATS ---
            # Stat averages
            stat_averages = {}
            stat_cols = ['speed', 'power', 'stamina', 'wiz', 'guts', 'rank_score']
            for stat in stat_cols:
                stat_averages[stat] = self.get_stat_distribution(char_df[stat], stat)
            
            # Support cards and skills
            all_char_cards = [str(c) for sublist in char_df['support_cards'] for c in sublist if c]
            all_char_skills = [str(s) for sublist in char_df['skills'] for s in sublist if s]
            all_char_cards_by_team = [list(map(str, cards)) for cards in char_df['support_cards'] if cards]
            
            character_stats['overall'] = {
                'total_entries': len(char_df),
                'total_trained_umas': len(char_df),
                'stat_averages': stat_averages,
                'support_cards': self.process_items_with_levels(all_char_cards, 'support_cards'),
                'total_support_cards': len(all_char_cards),
                'support_card_combinations': self.analyze_support_card_combinations(all_char_cards_by_team),
                'total_combinations': len(all_char_cards_by_team),
                'support_card_type_distribution': self.analyze_support_card_type_distribution(all_char_cards_by_team),
                'skills': self.process_items_with_levels(all_char_skills, 'skills'),
                'total_skills': len(all_char_skills)
            }

            # --- BY SCENARIO (Top Level) ---
            character_stats['by_scenario'] = {}
            for scenario_id in char_df['scenario_id'].dropna().unique():
                if scenario_id >= 1:
                    scenario_char_df = char_df[char_df['scenario_id'] == scenario_id]
                    scenario_str = str(int(scenario_id))
                    
                    # Stat averages
                    sc_stat_averages = {}
                    for stat in stat_cols:
                        sc_stat_averages[stat] = self.get_stat_distribution(scenario_char_df[stat], stat)
                    
                    # Support cards and skills
                    sc_cards = [str(c) for sublist in scenario_char_df['support_cards'] for c in sublist if c]
                    sc_skills = [str(s) for sublist in scenario_char_df['skills'] for s in sublist if s]
                    sc_support_cards_by_team = [list(map(str, cards)) for cards in scenario_char_df['support_cards'] if cards]
                    
                    character_stats['by_scenario'][scenario_str] = {
                        'total_entries': len(scenario_char_df),
                        'total_trained_umas': len(scenario_char_df),
                        'stat_averages': sc_stat_averages,
                        'support_cards': self.process_items_with_levels(sc_cards, 'support_cards') if sc_cards else {},
                        'total_support_cards': len(sc_cards),
                        'support_card_combinations': self.analyze_support_card_combinations(sc_support_cards_by_team) if sc_support_cards_by_team else {},
                        'total_combinations': len(sc_support_cards_by_team),
                        'support_card_type_distribution': self.analyze_support_card_type_distribution(sc_support_cards_by_team) if sc_support_cards_by_team else {},
                        'skills': self.process_items_with_levels(sc_skills, 'skills') if sc_skills else {},
                        'total_skills': len(sc_skills)
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
            
            # Scenario distribution with percentages
            scenario_counts = char_df['scenario_id'].value_counts()
            total_scenario_entries = len(char_df)
            character_stats['global']['scenario_distribution'] = {
                'total_entries': total_scenario_entries
            }
            for scenario_id, count in scenario_counts.items():
                if pd.notna(scenario_id):
                    scenario_name = self.scenarios.get(int(scenario_id), f'Scenario_{scenario_id}')
                    character_stats['global']['scenario_distribution'][str(int(scenario_id))] = {
                        'name': scenario_name,
                        'count': int(count),
                        'percentage': round(count / total_scenario_entries * 100, 2),
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
                                
                                # --- OVERALL ---
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
                                cards = [str(c) for sublist in class_dist_df['support_cards'] for c in sublist if c]
                                skills = [str(s) for sublist in class_dist_df['skills'] for s in sublist if s]
                                support_cards_by_team = [list(map(str, cards)) for cards in class_dist_df['support_cards'] if cards]
                                
                                character_stats['by_distance'][distance_name]['by_team_class'][team_class_str] = {
                                    'overall': {
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
                                    },
                                    'by_scenario': {}
                                }

                                # --- BY SCENARIO ---
                                for scenario_id in class_dist_df['scenario_id'].dropna().unique():
                                    if scenario_id >= 1:
                                        scenario_class_dist_df = class_dist_df[class_dist_df['scenario_id'] == scenario_id]
                                        scenario_str = str(int(scenario_id))
                                        
                                        # Stat averages
                                        sc_stat_averages = {}
                                        for stat in stat_cols:
                                            if len(scenario_class_dist_df) > 20:
                                                sc_stat_averages[stat] = self.get_stat_distribution(scenario_class_dist_df[stat], stat)
                                            else:
                                                sc_stat_averages[stat] = {
                                                    'mean': float(scenario_class_dist_df[stat].mean()),
                                                    'median': float(scenario_class_dist_df[stat].median()),
                                                    'min': int(scenario_class_dist_df[stat].min()),
                                                    'max': int(scenario_class_dist_df[stat].max()),
                                                    'count': len(scenario_class_dist_df)
                                                }
                                        
                                        # Support cards and skills
                                        sc_cards = [str(c) for sublist in scenario_class_dist_df['support_cards'] for c in sublist if c]
                                        sc_skills = [str(s) for sublist in scenario_class_dist_df['skills'] for s in sublist if s]
                                        sc_support_cards_by_team = [list(map(str, cards)) for cards in scenario_class_dist_df['support_cards'] if cards]
                                        
                                        character_stats['by_distance'][distance_name]['by_team_class'][team_class_str]['by_scenario'][scenario_str] = {
                                            'total_entries': len(scenario_class_dist_df),
                                            'total_trained_umas': len(scenario_class_dist_df),
                                            'stat_averages': sc_stat_averages,
                                            'common_support_cards': self.process_items_with_levels(sc_cards, 'support_cards') if sc_cards else {},
                                            'total_support_cards': len(sc_cards),
                                            'support_card_combinations': self.analyze_support_card_combinations(sc_support_cards_by_team) if sc_support_cards_by_team else {},
                                            'total_combinations': len(sc_support_cards_by_team),
                                            'support_card_type_distribution': self.analyze_support_card_type_distribution(sc_support_cards_by_team) if sc_support_cards_by_team else {},
                                            'common_skills': self.process_items_with_levels(sc_skills, 'skills') if sc_skills else {},
                                            'total_skills': len(sc_skills)
                                        }
            
            # Submit file write to thread pool — compute is done, only I/O is async
            fut = executor.submit(self._write_character_file, char_id_str, character_stats)
            futures_map[fut] = char_id_str

          # Collect results / surface any write errors
          for fut in as_completed(futures_map):
            try:
                fut.result()
            except Exception as exc:
                print(f"  Warning: failed to write {futures_map[fut]}: {exc}")

    def compile_statistics(self) -> None:
        """Compile all statistics and save to versioned organized files"""
        print(f"\n{'='*60}")
        print(f"Starting Statistics Compilation")
        print(f"Dataset Version: {self.dataset_version}")
        print(f"Dataset Name: {self.dataset_name}")
        print(f"{'='*60}\n")
        
        # Load data
        df = self.load_data()
        
        # Calculate and save global statistics
        print("Processing global statistics...")
        global_stats = self.calculate_global_statistics(df)
        with open(f'statistics/{self.dataset_version}/global/global.json', 'w', encoding='utf-8') as f:
            json.dump(global_stats, f, ensure_ascii=False, indent=2)
        print(f"  ✓ Saved to statistics/{self.dataset_version}/global/global.json")
        
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
        
        index_path = f'statistics/{self.dataset_version}/index.json'
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(dataset_index, f, ensure_ascii=False, indent=2)
        print(f"\n✓ Created dataset index: {index_path}")
        
        # Update or create master datasets.json index
        self.update_master_index(dataset_index)
        
        print(f"\n{'='*60}")
        print(f"✓ All statistics compiled successfully!")
        print(f"{'='*60}")
        print(f"\nDataset Information:")
        print(f"  Version: {self.dataset_version}")
        print(f"  Location: ./statistics/{self.dataset_version}/")
        print(f"  Total Entries: {len(df):,}")
        print(f"  Total Trainers: {df['trainer_id'].nunique():,}")
        print(f"  Total Characters: {df['card_id'].nunique()}")
        print(f"\nFiles Structure:")
        print(f"  statistics/datasets.json (master index)")
        print(f"  statistics/{self.dataset_version}/index.json")
        print(f"  statistics/{self.dataset_version}/global/global.json")
        print(f"  statistics/{self.dataset_version}/distance/*.json")
        print(f"  statistics/{self.dataset_version}/characters/*.json")
        print(f"\n💡 Frontend will automatically load the newest dataset")

    def update_master_index(self, dataset_index: Dict[str, Any]) -> None:
        """Update the master datasets.json index file with all available datasets"""
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
            if ds.get('id') != self.dataset_version
        ]
        
        # Create new dataset entry matching the frontend schema
        dataset_entry = {
            'id': self.dataset_version,
            'version': self.dataset_version,
            'name': self.dataset_name,
            'date': dataset_index['generated_at'],
            'basePath': f'/assets/statistics/{self.dataset_version}',
            'index': dataset_index
        }
        
        # Add new dataset entry
        master_index['datasets'].append(dataset_entry)
        
        # Update last_updated timestamp
        master_index['last_updated'] = datetime.now().isoformat()
        
        # Sort datasets by date (newest first) for automatic newest-first display
        master_index['datasets'].sort(
            key=lambda x: datetime.fromisoformat(x['date'].replace('Z', '+00:00')),
            reverse=True
        )
        
        # Save updated master index with proper formatting
        with open(master_index_path, 'w', encoding='utf-8') as f:
            json.dump(master_index, f, ensure_ascii=False, indent=2)
        
        print(f"\n✓ Updated master datasets.json index")
        print(f"  Total datasets: {len(master_index['datasets'])}")
        print(f"  Latest dataset: {master_index['datasets'][0]['id']}")
        print(f"  Location: {master_index_path}")


def main():
    """
    Generate statistics for Umamusume Team Stadium data.
    
    This script creates a versioned dataset with the following structure:
    
    statistics/
    ├── datasets.json                    # Master index of all available datasets
    ├── {version}/                       # e.g., 2025-10-31/
    │   ├── index.json                   # Dataset-specific metadata
    │   ├── global/
    │   │   └── global.json              # Global statistics
    │   ├── distance/
    │   │   ├── sprint.json
    │   │   ├── mile.json
    │   │   ├── medium.json
    │   │   ├── long.json
    │   │   └── dirt.json
    │   └── characters/
    │       ├── 100101.json
    │       ├── 100201.json
    │       └── ...
    
    The datasets.json file contains:
    - List of all available datasets sorted by date (newest first)
    - Each dataset entry includes id, version, name, date, basePath, and full index
    - Frontend automatically selects the newest dataset by default
    
    Usage:
    - Run without arguments to generate dataset with today's date
    - Or provide a custom version string in the constructor
    """
    # Configure your database connection
    CONNECTION_STRING = "postgresql://honsemoe:awx3cdl0@127.0.0.1:5432/honsemoe_db"
    
    # Path to the game database (adjust as needed)
    GAME_DB_PATH = "C:/Users/lars/AppData/LocalLow/Cygames/Umamusume/master/master.mdb"
    
    # Initialize and run statistics compilation
    # Version will default to today's date (YYYY-MM-DD) if not specified
    stats_compiler = UmamusumeStatistics(CONNECTION_STRING, game_db_path=GAME_DB_PATH)
    stats_compiler.compile_statistics()


if __name__ == "__main__":
    main()