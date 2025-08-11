# Celestial Body Position Logging

The Orbit Engine simulation now includes automatic position logging for all celestial bodies. This feature tracks the position and velocity of each planet and the sun at every timestep.

## How It Works

1. **Automatic Logging**: During simulation, the engine automatically logs positions at each timestep
2. **Batch Saving**: Data is saved to disk every 10,000 timesteps to optimize performance
3. **JSON Format**: Logs are saved as JSON files for easy parsing and analysis
4. **Incremental Files**: Each batch is saved to a new numbered file (e.g., `celestial_positions_0000.json`, `celestial_positions_0001.json`, etc.)

## Log File Structure

Each log file contains:

```json
{
  "metadata": {
    "total_timesteps": 10000,
    "start_time": 0.0,
    "end_time": 500.0,
    "epoch": "2024-01-01T00:00:00",
    "file_number": 0
  },
  "data": [
    {
      "timestep": 0,
      "timestamp": 0.0,
      "real_time": "2024-12-16T10:30:00.123456",
      "time_scale": 1000.0,
      "bodies": {
        "mercury": {
          "position_m": [x, y, z],      // Position in meters
          "position_au": [x, y, z],      // Position in AU
          "velocity_ms": [vx, vy, vz]    // Velocity in m/s
        },
        // ... other bodies
      }
    },
    // ... more timesteps
  ]
}
```

## Storage Location

Log files are saved to the `simulation_logs/` directory in the project root. This directory is:
- Created automatically when the simulation starts
- Excluded from git (added to .gitignore)
- Contains sequentially numbered JSON files

## Analyzing Logs

Use the provided analysis script to examine log files:

```bash
# Analyze all log files
python analyze_logs.py

# Analyze a specific log file
python analyze_logs.py --file simulation_logs/celestial_positions_0000.json

# Extract trajectory for a specific body
python analyze_logs.py --body earth
```

## Performance Considerations

- **Memory Usage**: The engine buffers 10,000 timesteps in memory before saving
- **Disk Space**: Each log file is typically 5-15 MB depending on compression
- **I/O Impact**: File writes occur asynchronously to minimize simulation impact
- **Time Scale**: Higher time scales generate data faster (more simulation time per real second)

## Example Usage

At default settings (20 FPS, 1000x time scale):
- Real time: 20 timesteps per second
- Simulation time: ~50 seconds per real second
- Log file generation: ~1 file every 8.3 minutes of real time

## Configuration

Current settings (hardcoded in `api/simulations/engine.py`):
- Batch size: 10,000 timesteps
- Log directory: `simulation_logs/`
- File format: JSON with pretty printing

To modify these settings, edit the `SimulationEngine` class in `api/simulations/engine.py`.
