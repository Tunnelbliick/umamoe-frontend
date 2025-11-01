# Statistics System Migration Guide

## Overview

The statistics system has been migrated from a single-dataset structure to a multi-dataset versioning system. This enables:
- Multiple statistics snapshots (historical comparison)
- Dataset selector dropdown in the UI
- Automatic selection of the newest dataset
- Backwards compatibility during transition

## Migration Completed ✅

### What Changed

**Old Structure:**
```
src/assets/statistics/
├── index.json              # Single dataset metadata
├── global/
│   └── global.json
├── distance/
│   └── *.json
└── characters/
    └── *.json
```

**New Structure:**
```
src/assets/statistics/
├── datasets.json           # Master index of all datasets
├── 2025-09-14/            # Versioned dataset folder
│   ├── index.json         # Dataset-specific metadata
│   ├── global/
│   ├── distance/
│   └── characters/
└── 2025-10-31/            # Future datasets...
    ├── index.json
    ├── global/
    ├── distance/
    └── characters/
```

### Files Modified

1. **StatisticsService** (`src/app/services/statistics.service.ts`)
   - Now loads from `assets/statistics/datasets.json`
   - Auto-selects newest dataset
   - Supports dynamic dataset switching

2. **StatisticsComponent** (`src/app/pages/statistics/statistics.component.ts`)
   - Added dataset selector dropdown
   - Manages available and selected datasets
   - Clears cache on dataset change

3. **Python Script** (`scripts/statistic.py`)
   - Generates new `datasets.json` format
   - Auto-versions by date
   - Maintains sorted dataset list

4. **Data Files**
   - Created `src/assets/statistics/datasets.json` (master index)
   - Copied `index.json` to `src/assets/statistics/2025-09-14/index.json`
   - All existing data preserved in versioned folder

## Cleanup Steps (Optional)

Once you've confirmed the new system is working correctly:

### 1. Remove Old Root Index File

The old `src/assets/statistics/index.json` file is no longer used:

```powershell
Remove-Item "src\assets\statistics\index.json"
```

### 2. Verify Frontend Works

1. Start development server: `npm start`
2. Navigate to `/statistics` page
3. Verify dataset dropdown shows "Statistics 2025-09-14"
4. Verify all statistics charts load correctly
5. Test dataset selection (once you have multiple datasets)

### 3. Generate New Datasets

To create a new statistics dataset:

```bash
cd scripts
python statistic.py
```

The script will:
- Auto-version by current date (e.g., `2025-10-31`)
- Create versioned folder structure
- Update `datasets.json` master index
- Sort datasets newest-first

## Testing Checklist

- [ ] Statistics page loads without errors
- [ ] Dataset dropdown is visible in hero section
- [ ] Current dataset shows "Statistics 2025-09-14"
- [ ] Global statistics display correctly
- [ ] Distance statistics work for all distances
- [ ] Character statistics load on selection
- [ ] No console errors in browser DevTools
- [ ] Network requests go to correct paths (`/assets/statistics/2025-09-14/...`)

## Rollback (if needed)

If you need to temporarily revert to the old structure:

1. Copy the versioned index back to root:
   ```powershell
   Copy-Item "src\assets\statistics\2025-09-14\index.json" "src\assets\statistics\index.json"
   ```

2. Revert the service to load from old path:
   ```typescript
   // In statistics.service.ts, change:
   this.http.get<any>('assets/statistics/datasets.json')
   // Back to:
   this.http.get<any>('assets/statistics/index.json')
   ```

## Future Enhancements

### Automatic Dataset Generation

Set up a cron job to generate statistics weekly:

```bash
# Weekly on Sunday at 3 AM
0 3 * * 0 cd /path/to/umamoe-frontend/scripts && python statistic.py
```

### Dataset Retention Policy

Keep the last 30 days of datasets, archive older ones:

```python
# Add to statistic.py
def cleanup_old_datasets(keep_days=30):
    cutoff = datetime.now() - timedelta(days=keep_days)
    # Archive datasets older than cutoff
```

### Dataset Comparison UI

Future enhancement: Side-by-side comparison of two datasets to show meta shifts over time.

## Support

If you encounter any issues:

1. Check browser console for errors
2. Verify `datasets.json` format matches schema
3. Ensure versioned folders have all required files
4. Review `STATISTICS_README.md` for detailed documentation

## Schema Reference

### datasets.json Format

```json
{
  "datasets": [
    {
      "id": "2025-09-14",
      "version": "2025-09-14",
      "name": "Statistics 2025-09-14",
      "date": "2025-09-14T04:49:59.381447",
      "basePath": "/assets/statistics/2025-09-14",
      "index": {
        "generated_at": "2025-09-14T04:49:59.381447",
        "total_entries": 4206136,
        "total_trainers": 304989,
        "total_characters": 37,
        "distances": ["Sprint", "Mile", "Medium", "Long", "Dirt"],
        "character_ids": ["100101", "100201", ...],
        "version": "2025-09-14",
        "name": "Statistics 2025-09-14"
      }
    }
  ],
  "last_updated": "2025-09-14T04:50:00.067431"
}
```

### Frontend Integration

The frontend automatically:
- Loads all available datasets on page init
- Sorts by date (newest first)
- Selects the newest dataset by default
- Provides dropdown for manual selection
- Clears cache on dataset change
- Reloads all statistics when switching

## Timeline Integration

This migration complements the recent timeline tweaking system update:

- **Timeline Tweaking**: Banner-indexed acceleration factors for release predictions
- **Statistics Versioning**: Historical snapshots to track meta changes over time

Both systems work independently but provide comprehensive tools for analyzing the game's evolution.
