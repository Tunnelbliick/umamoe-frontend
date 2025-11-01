# Statistics Generation System

This directory contains scripts for generating versioned Team Stadium statistics datasets.

## Overview

The statistics system now supports **multiple datasets** with automatic version management. Each time you run the script, it creates a new versioned dataset and updates a master index that the frontend uses to populate the dataset selector dropdown.

## File Structure

```
statistics/
├── datasets.json                    # Master index of all datasets
├── 2025-10-31/                      # Dataset version 1
│   ├── index.json
│   ├── global/
│   ├── distance/
│   └── characters/
├── 2025-11-07/                      # Dataset version 2
│   ├── index.json
│   ├── global/
│   ├── distance/
│   └── characters/
└── ...
```

## Quick Start

### Basic Usage (Auto-versioning)

```python
python statistic.py
```

This generates a dataset with today's date (e.g., `2025-10-31`) and automatically updates `datasets.json`.

### Custom Version

```python
from statistic import UmamusumeStatistics

stats = UmamusumeStatistics(
    connection_string="postgresql://...",
    dataset_version="2025-10-31-special",  # Custom version
    game_db_path="path/to/master.mdb"
)
stats.compile_statistics()
```

## How It Works

### 1. Dataset Generation

When you run the script:
1. Creates a new folder: `statistics/{version}/`
2. Generates all statistics files (global, distance, characters)
3. Creates `statistics/{version}/index.json` with metadata

### 2. Master Index Update

The script automatically updates `statistics/datasets.json`:

```json
{
  "datasets": [
    {
      "id": "2025-10-31",
      "version": "2025-10-31",
      "name": "Statistics 2025-10-31",
      "date": "2025-10-31T12:00:00",
      "basePath": "/assets/statistics/2025-10-31",
      "index": { /* full dataset metadata */ }
    },
    {
      "id": "2025-10-30",
      "version": "2025-10-30",
      "name": "Statistics 2025-10-30",
      "date": "2025-10-30T12:00:00",
      "basePath": "/assets/statistics/2025-10-30",
      "index": { /* full dataset metadata */ }
    }
  ],
  "last_updated": "2025-10-31T12:00:00"
}
```

### 3. Frontend Integration

The frontend:
- Reads `datasets.json` on startup
- Sorts datasets by date (newest first)
- **Automatically selects the newest dataset**
- Displays dropdown selector for users to switch versions

## Workflow Examples

### Daily Statistics

```bash
# Run every day to create daily snapshots
python statistic.py
```

Creates: `statistics/2025-10-31/`, `statistics/2025-11-01/`, etc.

### Weekly Statistics

```python
from datetime import datetime
from statistic import UmamusumeStatistics

week_num = datetime.now().isocalendar()[1]
year = datetime.now().year
version = f"{year}-W{week_num:02d}"  # e.g., "2025-W44"

stats = UmamusumeStatistics(
    connection_string="postgresql://...",
    dataset_version=version,
    game_db_path="path/to/master.mdb"
)
stats.compile_statistics()
```

Creates: `statistics/2025-W44/`, `statistics/2025-W45/`, etc.

### Special Event Statistics

```python
stats = UmamusumeStatistics(
    connection_string="postgresql://...",
    dataset_version="2025-anniversary",
    game_db_path="path/to/master.mdb"
)
stats.compile_statistics()
```

Creates: `statistics/2025-anniversary/`

## Configuration

### Database Connection

Edit `statistic.py`:

```python
CONNECTION_STRING = "postgresql://user:pass@host:port/database"
GAME_DB_PATH = "C:/path/to/master.mdb"
```

### Dataset Version

**Option 1: Automatic (recommended)**
```python
# Uses today's date automatically
stats = UmamusumeStatistics(CONNECTION_STRING, game_db_path=GAME_DB_PATH)
```

**Option 2: Custom**
```python
# Specify your own version
stats = UmamusumeStatistics(
    CONNECTION_STRING, 
    dataset_version="custom-name",
    game_db_path=GAME_DB_PATH
)
```

## Output Files

Each dataset version includes:

### `index.json`
Dataset metadata and summary information

### `global/global.json`
- Team class distribution
- Overall statistics
- Support card usage
- Skill distribution

### `distance/*.json`
- Per-distance statistics
- Sprint, Mile, Medium, Long, Dirt
- Broken down by team class

### `characters/*.json`
- Per-character statistics
- Distance preferences
- Support card usage
- Skill patterns

## Frontend Integration

After generating new statistics:

1. **Copy to frontend**
   ```bash
   cp -r statistics/* ../src/assets/statistics/
   ```

2. **Build frontend**
   ```bash
   npm run build
   ```

3. **Users will see**
   - New dataset appears in dropdown
   - Newest dataset loads automatically
   - Can switch between versions seamlessly

## Best Practices

### Naming Conventions

- **Daily**: `YYYY-MM-DD` (e.g., `2025-10-31`)
- **Weekly**: `YYYY-Wxx` (e.g., `2025-W44`)
- **Monthly**: `YYYY-MM` (e.g., `2025-10`)
- **Special**: Descriptive name (e.g., `2025-anniversary`)

### Retention Policy

Consider:
- Keep last 30 daily snapshots
- Keep all weekly snapshots for 6 months
- Keep monthly snapshots indefinitely
- Archive old versions to separate storage

### Automation

Set up a cron job for automatic generation:

```bash
# Daily at 2 AM
0 2 * * * cd /path/to/scripts && python statistic.py
```

## Troubleshooting

### Dataset not appearing in frontend

1. Check `datasets.json` was updated
2. Verify `basePath` matches your asset directory
3. Ensure frontend is reading from correct location
4. Clear browser cache

### Duplicate datasets

The script automatically removes existing entries with the same version before adding new ones.

### Performance

- Large datasets take time to generate
- Consider running during off-peak hours
- Monitor database performance

## Migration from Old System

If you have existing statistics:

1. Create version folder: `statistics/2025-09-14/`
2. Move old files into the structure
3. Create `index.json` manually
4. Run script once to generate `datasets.json`

## Support

For issues or questions:
- Check script output for error messages
- Verify database connectivity
- Ensure all required JSON data files exist
- Check file permissions on statistics directory
