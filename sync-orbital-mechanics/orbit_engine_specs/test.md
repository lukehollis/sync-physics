# Orbit Engine Testing & Verification Strategy

## Overview
This document outlines the comprehensive testing strategy for verifying the accuracy of the Orbit Engine's orbital mechanics calculations, including planetary positions and interplanetary transfer trajectories.

## 1. Planetary Position Verification

### 1.1 Reference Data Sources
- **Primary Reference**: NASA JPL Horizons System (https://ssd.jpl.nasa.gov/horizons/)
  - Provides high-precision ephemerides for all solar system bodies
  - Industry standard for space mission planning
  - Accuracy: sub-kilometer for inner planets, few kilometers for outer planets

- **Secondary Reference**: SPICE Kernels from NAIF
  - Direct integration with SPICEyPy for cross-validation
  - Provides both historical and predictive ephemerides

### 1.2 Test Cases for Planetary Positions

#### Test Set A: Known Historical Positions
```python
# Example test cases with known positions (J2000 epoch)
test_dates = [
    "2000-01-01 12:00:00",  # J2000.0 epoch
    "2024-01-01 00:00:00",  # Recent date
    "1969-07-20 20:17:00",  # Apollo 11 landing
    "2012-08-06 05:17:00",  # Curiosity Mars landing
]

# For each date, verify positions against JPL Horizons
# Tolerance: < 1000 km for inner planets, < 10000 km for outer planets
```

#### Test Set B: Orbital Elements Validation
- **Semi-major axis**: Compare with IAU nominal values
- **Eccentricity**: Verify against published orbital parameters
- **Inclination**: Check against ecliptic plane reference
- **Mean anomaly propagation**: Test Kepler equation solver accuracy

### 1.3 Validation Metrics
```python
def validate_position(calculated_pos, reference_pos, body_name):
    """
    Returns:
    - Position error (km)
    - Velocity error (km/s)
    - Angular deviation (degrees)
    """
    tolerance = {
        'Mercury': 500,    # km
        'Venus': 1000,
        'Earth': 100,
        'Mars': 1000,
        'Jupiter': 10000,
        'Saturn': 10000,
        'Uranus': 50000,
        'Neptune': 50000,
    }
```

## 2. Transfer Trajectory Verification

### 2.1 Lambert Problem Solutions
The core of trajectory calculation relies on solving Lambert's problem. Test against:

#### Reference Implementations
- **Poliastro**: Python library with validated Lambert solvers
- **GMAT (General Mission Analysis Tool)**: NASA's open-source tool
- **STK (Systems Tool Kit)**: Industry standard (for comparison)

#### Test Cases
```python
transfer_test_cases = [
    {
        "name": "Hohmann Transfer to Mars",
        "departure": "2026-11-20",  # Known optimal window
        "arrival": "2027-06-12",
        "expected_dv": 3.6,  # km/s from Earth orbit
        "expected_c3": 8.9,  # km²/s²
    },
    {
        "name": "Venus Transfer",
        "departure": "2025-03-15",
        "arrival": "2025-08-10",
        "expected_dv": 3.5,
        "expected_c3": 7.8,
    },
    {
        "name": "Jupiter Gravity Assist",
        "departure": "2027-09-01",
        "arrival": "2029-12-15",
        "expected_dv": 6.3,
        "expected_c3": 80.0,
    }
]
```

### 2.2 Porkchop Plot Validation

#### Grid Resolution Test
```python
def test_porkchop_resolution():
    """
    Verify that the porkchop plot correctly identifies:
    1. Global minima (optimal launch windows)
    2. Local minima (secondary windows)
    3. Contour accuracy at different C3 levels
    """
    departure_range = ["2026-01-01", "2027-01-01"]
    arrival_range = ["2026-06-01", "2028-01-01"]
    
    # Generate with 5-day resolution
    coarse_plot = generate_porkchop(departure_range, arrival_range, step_days=5)
    
    # Generate with 1-day resolution around minima
    fine_plot = generate_porkchop(departure_range, arrival_range, step_days=1)
    
    # Verify minima consistency
    assert abs(coarse_min_c3 - fine_min_c3) < 0.5  # km²/s²
```

#### Known Mission Validation
Compare against actual missions:
```python
historical_missions = [
    {
        "mission": "Mars Science Laboratory (Curiosity)",
        "launch": "2011-11-26",
        "arrival": "2012-08-06",
        "actual_c3": 12.6,
        "actual_travel_time": 253,  # days
    },
    {
        "mission": "Mars 2020 (Perseverance)",
        "launch": "2020-07-30",
        "arrival": "2021-02-18",
        "actual_c3": 12.0,
        "actual_travel_time": 203,
    },
    {
        "mission": "Juno",
        "launch": "2011-08-05",
        "arrival": "2016-07-04",
        "actual_c3": 81.0,  # High energy for direct Jupiter transfer
        "actual_travel_time": 1795,
    }
]
```

## 3. N-Body Integration Accuracy

### 3.1 Propagator Validation
Test the numerical integrator against analytical solutions:

```python
def test_two_body_accuracy():
    """
    For pure two-body problems, compare numerical integration
    with analytical Kepler orbit solutions
    """
    # Initialize circular orbit
    r0 = [7000, 0, 0]  # km
    v0 = [0, 7.5, 0]   # km/s
    
    # Propagate one orbit numerically
    numerical_state = propagate_nbody(r0, v0, period)
    
    # Compare with analytical position after one orbit
    error = norm(numerical_state.r - r0)
    assert error < 1.0  # Less than 1 km after full orbit
```

### 3.2 Energy Conservation Test
```python
def test_energy_conservation():
    """
    In the CR3BP/N-body problem, verify Jacobi constant conservation
    """
    initial_jacobi = calculate_jacobi_constant(r0, v0)
    
    for t in simulation_times:
        state = propagate(r0, v0, t)
        current_jacobi = calculate_jacobi_constant(state.r, state.v)
        
        # Jacobi constant should be conserved to machine precision
        assert abs(current_jacobi - initial_jacobi) < 1e-10
```

## 4. Real-Time Performance Testing

### 4.1 Backend Performance Benchmarks
```python
performance_requirements = {
    "ephemeris_generation": {
        "max_time": 2.0,  # seconds
        "date_range": 10,  # years
        "bodies": 9,      # all planets
        "resolution": 3600,  # 1-hour steps
    },
    "trajectory_calculation": {
        "max_time": 0.5,  # seconds per trajectory
        "integration_steps": 10000,
    },
    "porkchop_generation": {
        "max_time": 5.0,  # seconds
        "grid_size": (100, 100),  # 100x100 grid
    },
    "websocket_latency": {
        "max_latency": 50,  # milliseconds
        "update_rate": 30,  # Hz
    }
}
```

### 4.2 Frontend Rendering Performance
```javascript
// Test Three.js rendering performance
const performanceTests = {
    frameRate: {
        target: 60,  // fps
        minimum: 30,  // fps
        testDuration: 60,  // seconds
    },
    objectCount: {
        planets: 9,
        trajectoryPoints: 10000,
        particleEffects: 1000,
    },
    memoryUsage: {
        maxHeap: 512,  // MB
        maxGPU: 256,   // MB
    }
};
```

## 5. Integration Testing

### 5.1 End-to-End Trajectory Test
```python
def test_full_mission_simulation():
    """
    Test complete mission from launch to arrival
    """
    # 1. Calculate optimal trajectory
    trajectory = calculate_transfer("Earth", "Mars", "2026-11-20")
    
    # 2. Verify launch parameters
    assert abs(trajectory.c3 - 8.9) < 0.5
    
    # 3. Propagate spacecraft along trajectory
    for t in range(0, trajectory.duration, 86400):  # Daily steps
        spacecraft_pos = propagate_spacecraft(trajectory, t)
        
        # 4. Verify spacecraft remains on computed trajectory
        expected_pos = trajectory.get_position(t)
        error = norm(spacecraft_pos - expected_pos)
        assert error < 1000  # km tolerance
    
    # 5. Verify arrival conditions
    final_state = propagate_spacecraft(trajectory, trajectory.duration)
    mars_pos = get_planet_position("Mars", trajectory.arrival_date)
    
    arrival_error = norm(final_state.position - mars_pos)
    assert arrival_error < 10000  # km
```

### 5.2 WebSocket Communication Test
```javascript
describe('WebSocket Data Integrity', () => {
    it('should maintain position accuracy through serialization', async () => {
        const testPosition = {
            x: 149597870.7,  // Earth's distance in km
            y: 0.0,
            z: 0.0
        };
        
        // Send through WebSocket
        ws.send(JSON.stringify(testPosition));
        
        // Receive and parse
        const received = await ws.receive();
        const parsed = JSON.parse(received);
        
        // Verify precision maintained (6 significant figures minimum)
        expect(parsed.x).toBeCloseTo(testPosition.x, 1);
    });
});
```

## 6. Automated Test Suite

### 6.1 Continuous Integration Pipeline
```yaml
# .github/workflows/orbital_tests.yml
name: Orbital Mechanics Tests

on: [push, pull_request]

jobs:
  test-physics:
    runs-on: ubuntu-latest
    steps:
      - name: Test Ephemerides
        run: python -m pytest tests/test_ephemerides.py
      
      - name: Test Lambert Solver
        run: python -m pytest tests/test_lambert.py
      
      - name: Test N-Body Integration
        run: python -m pytest tests/test_nbody.py
      
      - name: Compare with JPL Horizons
        run: python scripts/validate_horizons.py
      
      - name: Performance Benchmarks
        run: python -m pytest tests/test_performance.py --benchmark
```

### 6.2 Daily Validation Script
```python
#!/usr/bin/env python
"""
Daily validation against JPL Horizons
Runs automatically to catch any drift in calculations
"""

def daily_validation():
    report = {
        "date": datetime.now(),
        "tests_run": 0,
        "failures": [],
        "warnings": []
    }
    
    # Test current planetary positions
    for planet in PLANETS:
        jpl_pos = fetch_horizons_position(planet, datetime.now())
        our_pos = calculate_position(planet, datetime.now())
        
        error = calculate_error(jpl_pos, our_pos)
        if error > TOLERANCE[planet]:
            report["failures"].append({
                "planet": planet,
                "error_km": error,
                "tolerance_km": TOLERANCE[planet]
            })
    
    # Test upcoming launch windows
    for target in ["Mars", "Venus"]:
        windows = find_launch_windows("Earth", target, 
                                     datetime.now(), 
                                     datetime.now() + timedelta(days=365))
        
        # Verify at least one window found
        if len(windows) == 0:
            report["warnings"].append(f"No windows found to {target}")
    
    # Send report
    send_validation_report(report)
```

## 7. Error Analysis and Reporting

### 7.1 Error Categories
1. **Numerical Errors**: Integration accuracy, floating-point precision
2. **Model Errors**: Simplified physics, missing perturbations
3. **Data Errors**: Outdated ephemerides, incorrect constants

### 7.2 Acceptance Criteria
```python
ACCEPTANCE_CRITERIA = {
    "position_accuracy": {
        "Earth-Mars": 10000,  # km
        "Earth-Venus": 5000,   # km
        "Earth-Jupiter": 50000,  # km
    },
    "velocity_accuracy": {
        "all_transfers": 0.1,  # km/s
    },
    "delta_v_accuracy": {
        "relative_error": 0.05,  # 5%
    },
    "travel_time_accuracy": {
        "error_days": 1,  # day
    }
}
```

## 8. Manual Verification Checklist

- [ ] Visual inspection of planetary orbits matches known shapes
- [ ] Retrograde motion of Mars visible from Earth perspective
- [ ] Transfer trajectories follow expected Hohmann/bi-elliptic patterns
- [ ] Gravity assist trajectories show correct deflection
- [ ] Launch windows align with known Mars/Venus windows (26/19 month cycles)
- [ ] Spacecraft arrives within target planet's sphere of influence
- [ ] Animation smooth at 60 FPS with all features enabled
- [ ] Porkchop plots show characteristic "pork chop" contour patterns
- [ ] Mission timer advances at correct rate relative to simulation speed

## Conclusion

This testing strategy ensures that Orbit Engine provides accurate, reliable orbital mechanics calculations suitable for educational purposes and preliminary mission planning. Regular validation against JPL Horizons and historical mission data maintains confidence in the system's accuracy.
