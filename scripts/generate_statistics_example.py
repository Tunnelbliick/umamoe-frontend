"""
Example script showing how to generate statistics with custom versions.

This demonstrates:
1. Generating statistics with automatic date-based versioning
2. Generating statistics with custom version names
3. How the datasets.json master index is automatically updated
"""

from statistic import UmamusumeStatistics

# Database configuration
CONNECTION_STRING = "postgresql://honsemoe:awx3cdl0@127.0.0.1:5432/honsemoe_db"
GAME_DB_PATH = "C:/Users/lars1/AppData/LocalLow/Cygames/Umamusume/master/master.mdb"


def generate_with_auto_version():
    """Generate statistics with automatic date-based version (YYYY-MM-DD)"""
    print("\n" + "="*70)
    print("Generating statistics with automatic versioning...")
    print("="*70)
    
    stats = UmamusumeStatistics(CONNECTION_STRING, game_db_path=GAME_DB_PATH)
    stats.compile_statistics()
    
    # This will create:
    # - statistics/2025-10-31/ (today's date)
    # - statistics/datasets.json (updated with new entry)


def generate_with_custom_version():
    """Generate statistics with a custom version name"""
    print("\n" + "="*70)
    print("Generating statistics with custom version...")
    print("="*70)
    
    custom_version = "2025-10-31-special"
    stats = UmamusumeStatistics(
        CONNECTION_STRING, 
        dataset_version=custom_version,
        game_db_path=GAME_DB_PATH
    )
    stats.compile_statistics()
    
    # This will create:
    # - statistics/2025-10-31-special/
    # - statistics/datasets.json (updated with new entry)


def generate_weekly_snapshot():
    """Example: Generate a weekly snapshot with custom naming"""
    from datetime import datetime
    
    # Create a version name like "2025-W44" for week 44
    week_num = datetime.now().isocalendar()[1]
    year = datetime.now().year
    version = f"{year}-W{week_num:02d}"
    
    print("\n" + "="*70)
    print(f"Generating weekly snapshot: {version}")
    print("="*70)
    
    stats = UmamusumeStatistics(
        CONNECTION_STRING,
        dataset_version=version,
        game_db_path=GAME_DB_PATH
    )
    stats.compile_statistics()


if __name__ == "__main__":
    # Example 1: Generate with automatic date-based version
    generate_with_auto_version()
    
    # Example 2: Generate with custom version (uncomment to use)
    # generate_with_custom_version()
    
    # Example 3: Generate weekly snapshot (uncomment to use)
    # generate_weekly_snapshot()
    
    print("\n" + "="*70)
    print("All datasets are tracked in statistics/datasets.json")
    print("The frontend will automatically display the newest dataset first")
    print("Users can switch between datasets using the dropdown selector")
    print("="*70)
