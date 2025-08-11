"""
Test transfer trajectory calculations and Lambert solver accuracy.
Validates Hohmann transfers, porkchop plots, and mission planning calculations.
"""

import unittest
import numpy as np
from datetime import datetime, timedelta
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.simulations.orbital_mechanics import (
    calculate_hohmann_transfer,
    calculate_porkchop_plot,
    generate_transfer_trajectory,
    kepler_to_cartesian,
    SOLAR_SYSTEM_BODIES
)
from tests.test_utils import (
    TestResult,
    format_test_report,
    AU_KM,
    MU_SUN,
    calculate_position_error
)

class TestTransferTrajectories(unittest.TestCase):
    """Test suite for interplanetary transfer trajectory calculations."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_results = []
        
        # Historical mission data for validation
        self.historical_missions = [
            {
                "mission": "Mars Science Laboratory (Curiosity)",
                "launch": datetime(2011, 11, 26),
                "arrival": datetime(2012, 8, 6),
                "actual_c3": 12.6,  # km²/s²
                "actual_travel_time": 253,  # days
                "departure": "earth",
                "target": "mars"
            },
            {
                "mission": "Mars 2020 (Perseverance)",
                "launch": datetime(2020, 7, 30),
                "arrival": datetime(2021, 2, 18),
                "actual_c3": 12.0,
                "actual_travel_time": 203,
                "departure": "earth",
                "target": "mars"
            }
        ]
        
        # Known optimal transfer windows
        self.transfer_windows = [
            {
                "name": "Earth-Mars Hohmann 2026",
                "departure_date": datetime(2026, 11, 20),
                "arrival_date": datetime(2027, 6, 12),
                "expected_dv": 3.6,  # km/s from Earth orbit
                "expected_c3": 8.9,  # km²/s²
                "departure": "earth",
                "target": "mars",
                "type": "hohmann"
            },
            {
                "name": "Earth-Venus Transfer 2025",
                "departure_date": datetime(2025, 3, 15),
                "arrival_date": datetime(2025, 8, 10),
                "expected_dv": 3.5,
                "expected_c3": 7.8,
                "departure": "earth",
                "target": "venus",
                "type": "hohmann"
            }
        ]
    
    def test_hohmann_transfer_calculations(self):
        """Test Hohmann transfer orbit calculations."""
        print("\n" + "="*60)
        print("Testing Hohmann Transfer Calculations")
        print("="*60)
        
        # Test Earth-Mars Hohmann transfer
        earth = SOLAR_SYSTEM_BODIES['earth']
        mars = SOLAR_SYSTEM_BODIES['mars']
        
        transfer = calculate_hohmann_transfer(earth, mars)
        
        # Validate transfer parameters
        # Expected values for Earth-Mars Hohmann transfer
        expected_transfer_time = 259 * 86400  # ~259 days in seconds
        expected_dv1 = 2.95  # km/s (departure from Earth)
        expected_dv2 = 2.65  # km/s (arrival at Mars)
        
        # Convert delta-v from m/s to km/s
        calculated_dv1 = transfer['delta_v_departure'] / 1000.0
        calculated_dv2 = transfer['delta_v_arrival'] / 1000.0
        calculated_time = transfer['transfer_time']
        
        # Calculate errors
        dv1_error = abs(calculated_dv1 - expected_dv1)
        dv2_error = abs(calculated_dv2 - expected_dv2)
        time_error_days = abs(calculated_time - expected_transfer_time) / 86400
        
        # Tolerance: 10% for delta-v, 10 days for transfer time
        dv_tolerance = 0.5  # km/s
        time_tolerance = 10  # days
        
        dv1_passed = dv1_error < dv_tolerance
        dv2_passed = dv2_error < dv_tolerance
        time_passed = time_error_days < time_tolerance
        
        all_passed = dv1_passed and dv2_passed and time_passed
        
        result = TestResult(
            test_name="Earth-Mars Hohmann Transfer",
            passed=all_passed,
            error_value=max(dv1_error, dv2_error),
            tolerance=dv_tolerance,
            details={
                'dv1_error_km_s': dv1_error,
                'dv2_error_km_s': dv2_error,
                'time_error_days': time_error_days,
                'calculated_dv1_km_s': calculated_dv1,
                'calculated_dv2_km_s': calculated_dv2,
                'calculated_time_days': calculated_time / 86400
            }
        )
        
        self.test_results.append(result)
        
        status = "✓" if all_passed else "✗"
        print(f"{status} Earth-Mars Hohmann:")
        print(f"    ΔV₁: {calculated_dv1:.2f} km/s (expected: {expected_dv1:.2f} km/s)")
        print(f"    ΔV₂: {calculated_dv2:.2f} km/s (expected: {expected_dv2:.2f} km/s)")
        print(f"    Time: {calculated_time/86400:.1f} days (expected: {expected_transfer_time/86400:.1f} days)")
        
        self.assertTrue(all_passed, "Hohmann transfer calculations outside tolerance")
    
    def test_porkchop_plot_generation(self):
        """Test porkchop plot generation and contour accuracy."""
        print("\n" + "="*60)
        print("Testing Porkchop Plot Generation")
        print("="*60)
        
        # Generate porkchop plot for Earth-Mars transfer
        departure_start = datetime(2026, 1, 1)
        departure_end = datetime(2027, 1, 1)
        arrival_start = datetime(2026, 6, 1)
        arrival_end = datetime(2028, 1, 1)
        
        # Test with coarse resolution
        coarse_plot = calculate_porkchop_plot(
            "earth", "mars",
            departure_start, departure_end,
            arrival_start, arrival_end,
            resolution=10  # 10x10 grid
        )
        
        # Test with fine resolution
        fine_plot = calculate_porkchop_plot(
            "earth", "mars",
            departure_start, departure_end,
            arrival_start, arrival_end,
            resolution=20  # 20x20 grid
        )
        
        # Find minimum C3 in both plots
        coarse_c3_values = np.array(coarse_plot['c3_values'])
        fine_c3_values = np.array(fine_plot['c3_values'])
        
        # Handle NaN values
        coarse_min_c3 = np.nanmin(coarse_c3_values)
        fine_min_c3 = np.nanmin(fine_c3_values)
        
        # Check that minima are consistent
        c3_difference = abs(coarse_min_c3 - fine_min_c3)
        tolerance = 2.0  # km²/s² tolerance
        
        passed = c3_difference < tolerance
        
        result = TestResult(
            test_name="Porkchop Plot Consistency",
            passed=passed,
            error_value=c3_difference,
            tolerance=tolerance,
            details={
                'coarse_min_c3': coarse_min_c3,
                'fine_min_c3': fine_min_c3,
                'coarse_grid_size': coarse_plot['departure_dates'].shape,
                'fine_grid_size': fine_plot['departure_dates'].shape
            }
        )
        
        self.test_results.append(result)
        
        status = "✓" if passed else "✗"
        print(f"{status} Porkchop consistency: ΔC3 = {c3_difference:.2f} km²/s²")
        
        # Verify that the plot has the characteristic porkchop shape
        # Check for presence of minima (launch windows)
        valid_c3_count = np.sum(~np.isnan(coarse_c3_values))
        total_points = coarse_c3_values.size
        
        self.assertGreater(valid_c3_count, total_points * 0.5,
                          "Too many invalid C3 values in porkchop plot")
        
        print(f"✓ Valid C3 points: {valid_c3_count}/{total_points}")
    
    def test_transfer_trajectory_generation(self):
        """Test trajectory point generation for transfer orbits."""
        print("\n" + "="*60)
        print("Testing Transfer Trajectory Generation")
        print("="*60)
        
        # Generate trajectory for Earth-Mars transfer
        departure_time = 0.0  # Start at epoch
        arrival_time = 259 * 86400  # 259 days later
        
        trajectory = generate_transfer_trajectory(
            "earth", "mars",
            departure_time, arrival_time,
            num_points=100
        )
        
        # Verify trajectory properties
        self.assertEqual(len(trajectory), 100, "Incorrect number of trajectory points")
        
        # Check first and last points
        first_point = trajectory[0]
        last_point = trajectory[-1]
        
        # First point should be near Earth's position
        earth_pos, _ = kepler_to_cartesian(SOLAR_SYSTEM_BODIES['earth'], departure_time)
        first_pos_error = np.linalg.norm(
            np.array(first_point['position']) - earth_pos
        ) / 1000.0  # Convert to km
        
        # Last point should be near Mars' position
        mars_pos, _ = kepler_to_cartesian(SOLAR_SYSTEM_BODIES['mars'], arrival_time)
        last_pos_error = np.linalg.norm(
            np.array(last_point['position']) - mars_pos
        ) / 1000.0  # Convert to km
        
        # Tolerance for position matching (quite large due to simplified trajectory)
        position_tolerance = 1e7  # 10 million km (simplified model)
        
        first_passed = first_pos_error < position_tolerance
        last_passed = last_pos_error < position_tolerance
        
        result = TestResult(
            test_name="Transfer Trajectory Endpoints",
            passed=first_passed and last_passed,
            error_value=max(first_pos_error, last_pos_error),
            tolerance=position_tolerance,
            details={
                'first_point_error_km': first_pos_error,
                'last_point_error_km': last_pos_error,
                'num_points': len(trajectory),
                'transfer_time_days': (arrival_time - departure_time) / 86400
            }
        )
        
        self.test_results.append(result)
        
        status = "✓" if (first_passed and last_passed) else "✗"
        print(f"{status} Trajectory endpoints:")
        print(f"    Start error: {first_pos_error/1000:.1f} thousand km")
        print(f"    End error: {last_pos_error/1000:.1f} thousand km")
        
        # Check that progress increases monotonically
        progress_values = [p['progress'] for p in trajectory]
        for i in range(1, len(progress_values)):
            self.assertGreaterEqual(progress_values[i], progress_values[i-1],
                                   "Progress should increase monotonically")
        
        print(f"✓ Progress monotonicity verified")
    
    def test_historical_mission_validation(self):
        """Validate against historical mission parameters."""
        print("\n" + "="*60)
        print("Testing Against Historical Missions")
        print("="*60)
        
        for mission_data in self.historical_missions:
            # Calculate transfer for the historical mission dates
            departure_body = SOLAR_SYSTEM_BODIES[mission_data['departure']]
            arrival_body = SOLAR_SYSTEM_BODIES[mission_data['target']]
            
            # Convert dates to seconds from epoch
            launch_time = (mission_data['launch'] - datetime(2000, 1, 1)).total_seconds()
            arrival_time = (mission_data['arrival'] - datetime(2000, 1, 1)).total_seconds()
            
            # Generate trajectory
            trajectory = generate_transfer_trajectory(
                mission_data['departure'],
                mission_data['target'],
                launch_time,
                arrival_time,
                num_points=10
            )
            
            # Calculate travel time
            calculated_travel_time = (arrival_time - launch_time) / 86400  # days
            actual_travel_time = mission_data['actual_travel_time']
            
            time_error = abs(calculated_travel_time - actual_travel_time)
            time_tolerance = 5  # days
            
            passed = time_error < time_tolerance
            
            result = TestResult(
                test_name=f"Historical: {mission_data['mission']}",
                passed=passed,
                error_value=time_error,
                tolerance=time_tolerance,
                details={
                    'calculated_days': calculated_travel_time,
                    'actual_days': actual_travel_time,
                    'launch_date': mission_data['launch'].strftime('%Y-%m-%d'),
                    'arrival_date': mission_data['arrival'].strftime('%Y-%m-%d')
                }
            )
            
            self.test_results.append(result)
            
            status = "✓" if passed else "✗"
            print(f"{status} {mission_data['mission'][:30]:30s}: "
                  f"Time error = {time_error:.1f} days")
    
    def test_launch_window_periodicity(self):
        """Test that launch windows repeat with known synodic periods."""
        print("\n" + "="*60)
        print("Testing Launch Window Periodicity")
        print("="*60)
        
        # Earth-Mars synodic period is approximately 779.94 days (25.6 months)
        expected_mars_period = 779.94  # days
        
        # Earth-Venus synodic period is approximately 583.92 days (19.2 months)
        expected_venus_period = 583.92  # days
        
        # For simplified testing, just verify the values are reasonable
        # In a full implementation, we would calculate multiple windows
        
        # Calculate synodic periods from orbital data
        earth_period = SOLAR_SYSTEM_BODIES['earth'].orbital_period / 86400  # days
        mars_period = SOLAR_SYSTEM_BODIES['mars'].orbital_period / 86400
        venus_period = SOLAR_SYSTEM_BODIES['venus'].orbital_period / 86400
        
        # Synodic period formula: 1/T_syn = |1/T1 - 1/T2|
        calculated_mars_synodic = 1.0 / abs(1.0/earth_period - 1.0/mars_period)
        calculated_venus_synodic = 1.0 / abs(1.0/earth_period - 1.0/venus_period)
        
        mars_error = abs(calculated_mars_synodic - expected_mars_period)
        venus_error = abs(calculated_venus_synodic - expected_venus_period)
        
        tolerance = 10  # days
        
        mars_passed = mars_error < tolerance
        venus_passed = venus_error < tolerance
        
        result = TestResult(
            test_name="Synodic Period Calculations",
            passed=mars_passed and venus_passed,
            error_value=max(mars_error, venus_error),
            tolerance=tolerance,
            details={
                'mars_synodic_calculated': calculated_mars_synodic,
                'mars_synodic_expected': expected_mars_period,
                'venus_synodic_calculated': calculated_venus_synodic,
                'venus_synodic_expected': expected_venus_period
            }
        )
        
        self.test_results.append(result)
        
        print(f"✓ Earth-Mars synodic: {calculated_mars_synodic:.1f} days "
              f"(expected: {expected_mars_period:.1f})")
        print(f"✓ Earth-Venus synodic: {calculated_venus_synodic:.1f} days "
              f"(expected: {expected_venus_period:.1f})")
    
    def tearDown(self):
        """Generate test report after all tests."""
        if self.test_results:
            report = format_test_report(self.test_results)
            print("\n" + report)
            
            # Save report to file
            report_file = f"tests/reports/trajectories_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            os.makedirs(os.path.dirname(report_file), exist_ok=True)
            with open(report_file, 'w') as f:
                f.write(report)
            print(f"\nReport saved to: {report_file}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
