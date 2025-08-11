# Orbit Engine Verification Suite

This directory contains comprehensive tests to verify the accuracy and performance of the Orbit Engine's orbital mechanics calculations.

## Test Categories

### 1. Planetary Position Tests (`test_planetary_positions.py`)
- Validates planetary positions against JPL Horizons ephemerides
- Tests Kepler equation solver accuracy
- Verifies orbital period calculations
- Checks position consistency across time steps

### 2. Trajectory Tests (`test_trajectories.py`)
- Validates Hohmann transfer calculations
- Tests porkchop plot generation
- Verifies transfer trajectory generation
- Compares against historical mission data (Curiosity, Perseverance)
- Tests launch window periodicity

### 3. N-Body Integration Tests (`test_nbody_integration.py`)
- Compares numerical integration with analytical solutions
- Tests energy conservation in orbital mechanics
- Verifies angular momentum conservation
- Tests multi-body system stability
- Validates integration timestep convergence

### 4. Performance Tests (`test_performance.py`)
- Benchmarks ephemeris generation speed
- Tests trajectory calculation performance
- Measures porkchop plot generation time
- Validates real-time update requirements
- Tests memory usage and concurrency

### 5. Daily Validation (`daily_validation.py`)
- Automated validation against JPL Horizons
- Checks for calculation drift over time
- Monitors launch window predictions
- System stability verification

## Running Tests

### Install Dependencies
```bash
pip install -r tests/requirements.txt
```

### Run All Tests
```bash
python tests/run_all_tests.py
```

### Run Individual Test Suites
```bash
# Planetary positions
python -m pytest tests/test_planetary_positions.py -v

# Trajectories
python -m pytest tests/test_trajectories.py -v

# N-body integration
python -m pytest tests/test_nbody_integration.py -v

# Performance benchmarks
python -m pytest tests/test_performance.py -v --benchmark-only
```

### Run Daily Validation
```bash
# Single validation run
python tests/daily_validation.py

# Continuous monitoring (24-hour interval)
python tests/daily_validation.py --continuous

# Custom interval (e.g., every 6 hours)
python tests/daily_validation.py --continuous --interval 6
```

## Continuous Integration

Tests are automatically run via GitHub Actions:

- **On Push/PR**: Physics and performance tests
- **Daily**: JPL Horizons validation (00:00 UTC)
- **Manual Trigger**: Available via GitHub Actions UI

## Test Reports

Test results are saved in `tests/reports/` with timestamps:

- `planetary_positions_YYYYMMDD_HHMMSS.txt` - Position test results
- `trajectories_YYYYMMDD_HHMMSS.txt` - Trajectory test results
- `nbody_YYYYMMDD_HHMMSS.txt` - N-body integration results
- `performance_YYYYMMDD_HHMMSS.json` - Performance metrics
- `validation_YYYYMMDD_HHMMSS.json` - Daily validation results
- `summary_YYYYMMDD_HHMMSS.json` - Overall test summary

## Accuracy Tolerances

### Position Accuracy
- Mercury: 500 km
- Venus: 1,000 km
- Earth: 100 km
- Mars: 1,000 km
- Jupiter: 10,000 km
- Saturn: 10,000 km
- Uranus: 50,000 km
- Neptune: 50,000 km

### Velocity Accuracy
- All planets: 0.1 km/s

### Delta-V Accuracy
- Relative error: 5%

### Performance Requirements
- Ephemeris generation: < 2 seconds for 10 years of data
- Trajectory calculation: < 0.5 seconds per trajectory
- Porkchop plot: < 5 seconds for 100x100 grid
- Position update: < 1 ms per update

## Reference Data Sources

### Primary References
- **JPL Horizons**: https://ssd.jpl.nasa.gov/horizons/
- **SPICE Kernels**: https://naif.jpl.nasa.gov/naif/
- **IAU Standards**: https://www.iau.org/

### Historical Mission Data
- Mars Science Laboratory (Curiosity) - 2011-2012
- Mars 2020 (Perseverance) - 2020-2021
- Juno (Jupiter) - 2011-2016

## Troubleshooting

### Common Issues

1. **Import errors**: Ensure you're running from the project root or have added the parent directory to Python path
2. **Missing reference data**: The daily validation requires internet connection to fetch JPL data (when fully implemented)
3. **Performance test failures**: These are often system-dependent; check the JSON reports for detailed metrics
4. **Memory issues**: Reduce test dataset sizes or run tests individually

### Debug Mode

Run tests with verbose output:
```bash
python -m pytest tests/ -vv --tb=long
```

Generate detailed logs:
```bash
python tests/run_all_tests.py 2>&1 | tee test_output.log
```

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Add appropriate tolerance values to `test_utils.py`
3. Document expected values and sources
4. Include both positive and negative test cases
5. Add performance benchmarks for new calculations
6. Update this README with new test descriptions

## License

See main project LICENSE file.
