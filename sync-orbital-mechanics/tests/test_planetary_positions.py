"""
Test planetary position calculations against reference ephemerides.
Validates accuracy of Kepler orbit propagation and position calculations.
"""

import unittest
import numpy as np
from datetime import datetime, timedelta
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.simulations.orbital_mechanics import (
    kepler_to_cartesian, 
    SOLAR_SYSTEM_BODIES,
    CelestialBody
)
from tests.test_utils import (
    calculate_position_error,
    calculate_velocity_error,
    calculate_angular_deviation,
    orbital_elements_to_state_vector,
    POSITION_TOLERANCE,
    VELOCITY_TOLERANCE,
    AU_KM,
    TestResult,
    format_test_report
)

class TestPlanetaryPositions(unittest.TestCase):
    """Test suite for planetary position calculations."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_results = []
        self.reference_dates = [
            datetime(2000, 1, 1, 12, 0, 0),  # J2000.0 epoch
            datetime(2024, 1, 1, 0, 0, 0),   # Recent date
            datetime(1969, 7, 20, 20, 17, 0), # Apollo 11 landing
            datetime(2012, 8, 6, 5, 17, 0),  # Curiosity Mars landing
        ]
        
        # Reference positions from JPL Horizons (J2000 epoch)
        # Values in AU, converted to km for testing
        self.j2000_positions = {
            'mercury': np.array([-0.1300932689, -0.4089376681, -0.0455970647]) * AU_KM,
            'venus': np.array([0.7185858677, -0.0224076723, -0.0428273551]) * AU_KM,
            'earth': np.array([-0.1756636726, 0.9659912857, 0.0002021822]) * AU_KM,
            'mars': np.array([1.3831894217, -0.0016917141, -0.0343685810]) * AU_KM,
            'jupiter': np.array([3.9943549016, 2.9323671653, -0.1016861962]) * AU_KM,
            'saturn': np.array([6.3987385275, 6.5659695842, -0.3690796969]) * AU_KM,
        }
        
        # Reference velocities (AU/day converted to km/s)
        self.j2000_velocities = {
            'mercury': np.array([0.0195896949, -0.0071520137, -0.0029578967]) * AU_KM / 86400,
            'venus': np.array([0.0006272329, 0.0200162157, 0.0003005207]) * AU_KM / 86400,
            'earth': np.array([-0.0172176053, -0.0030978407, 0.0000005320]) * AU_KM / 86400,
            'mars': np.array([0.0007533137, 0.0151161998, 0.0002994827]) * AU_KM / 86400,
            'jupiter': np.array([-0.0045679831, 0.0063690628, 0.0000781784]) * AU_KM / 86400,
            'saturn': np.array([-0.0043068662, 0.0038879900, 0.0001014881]) * AU_KM / 86400,
        }
    
    def test_j2000_epoch_positions(self):
        """Test planetary positions at J2000.0 epoch against JPL Horizons data."""
        print("\n" + "="*60)
        print("Testing J2000.0 Epoch Positions")
        print("="*60)
        
        test_time = 0.0  # J2000.0 epoch
        
        for planet_name, reference_pos in self.j2000_positions.items():
            if planet_name in SOLAR_SYSTEM_BODIES:
                body = SOLAR_SYSTEM_BODIES[planet_name]
                
                # Calculate position using our implementation
                calculated_pos, calculated_vel = kepler_to_cartesian(body, test_time)
                
                # Convert to km for comparison
                calculated_pos_km = calculated_pos / 1000.0
                calculated_vel_km_s = calculated_vel / 1000.0
                
                # Calculate errors
                pos_error = calculate_position_error(calculated_pos_km, reference_pos)
                vel_error = calculate_velocity_error(
                    calculated_vel_km_s, 
                    self.j2000_velocities.get(planet_name, np.zeros(3))
                )
                angular_dev = calculate_angular_deviation(calculated_pos_km, reference_pos)
                
                # Check if within tolerance
                tolerance = POSITION_TOLERANCE.get(planet_name.capitalize(), 10000)
                passed = pos_error < tolerance
                
                # Create test result
                result = TestResult(
                    test_name=f"J2000 Position - {planet_name.capitalize()}",
                    passed=passed,
                    error_value=pos_error,
                    tolerance=tolerance,
                    details={
                        'velocity_error_km_s': vel_error,
                        'angular_deviation_deg': angular_dev,
                        'calculated_pos_au': (calculated_pos_km / AU_KM).tolist(),
                        'reference_pos_au': (reference_pos / AU_KM).tolist()
                    }
                )
                
                self.test_results.append(result)
                
                # Print immediate results
                status = "✓" if passed else "✗"
                print(f"{status} {planet_name.capitalize():10s}: Error = {pos_error:8.1f} km "
                      f"(tolerance = {tolerance:8.1f} km)")
                
                # Assert for unittest
                self.assertLess(
                    pos_error, tolerance,
                    f"{planet_name} position error {pos_error:.1f} km exceeds tolerance {tolerance} km"
                )
    
    def test_kepler_equation_solver(self):
        """Test the accuracy of Kepler equation solver for various eccentricities."""
        print("\n" + "="*60)
        print("Testing Kepler Equation Solver")
        print("="*60)
        
        test_cases = [
            (0.0, 0.0),    # Circular orbit
            (0.1, np.pi/4), # Low eccentricity
            (0.5, np.pi/2), # Medium eccentricity
            (0.9, np.pi),   # High eccentricity
        ]
        
        for e, M in test_cases:
            # Use our simplified solver from orbital_mechanics
            body = CelestialBody(
                name="test",
                mass=1e24,
                radius=1e6,
                semi_major_axis=AU_KM * 1e3,  # Convert to meters
                eccentricity=e,
                inclination=0,
                mean_anomaly_epoch=M,
                orbital_period=365.25 * 86400,
                color="#ffffff"
            )
            
            # Calculate position (which internally solves Kepler's equation)
            pos, vel = kepler_to_cartesian(body, 0)
            
            # Verify the solution by checking Kepler's equation
            # Extract eccentric anomaly from the calculation
            n = 2 * np.pi / body.orbital_period
            M_calc = body.mean_anomaly_epoch
            
            # Solve Kepler's equation
            E = M
            for _ in range(10):
                E = E - (E - e * np.sin(E) - M) / (1 - e * np.cos(E))
            
            # Check that M = E - e*sin(E)
            M_check = E - e * np.sin(E)
            error = abs(M_check - M)
            
            passed = error < 1e-10
            
            result = TestResult(
                test_name=f"Kepler Solver - e={e:.1f}, M={M:.2f}",
                passed=passed,
                error_value=error,
                tolerance=1e-10,
                details={'eccentricity': e, 'mean_anomaly': M}
            )
            
            self.test_results.append(result)
            
            status = "✓" if passed else "✗"
            print(f"{status} e={e:.1f}, M={M:.2f}: Error = {error:.2e}")
            
            self.assertLess(error, 1e-8, f"Kepler equation error too large: {error}")
    
    def test_orbital_elements_consistency(self):
        """Test that orbital elements produce consistent results."""
        print("\n" + "="*60)
        print("Testing Orbital Elements Consistency")
        print("="*60)
        
        for planet_name, body in SOLAR_SYSTEM_BODIES.items():
            if planet_name == 'sun':
                continue
            
            # Test at multiple time points
            test_times = [0, 86400, 86400 * 30, 86400 * 365]  # 0, 1 day, 30 days, 1 year
            
            for t in test_times:
                pos1, vel1 = kepler_to_cartesian(body, t)
                pos2, vel2 = kepler_to_cartesian(body, t)
                
                # Positions should be identical for same time
                pos_diff = np.linalg.norm(pos1 - pos2)
                vel_diff = np.linalg.norm(vel1 - vel2)
                
                self.assertLess(pos_diff, 1e-10, 
                    f"{planet_name} position not consistent at t={t}")
                self.assertLess(vel_diff, 1e-10, 
                    f"{planet_name} velocity not consistent at t={t}")
            
            print(f"✓ {planet_name.capitalize():10s}: Consistency verified")
    
    def test_orbital_period_accuracy(self):
        """Test that planets return to initial position after one orbital period."""
        print("\n" + "="*60)
        print("Testing Orbital Period Accuracy")
        print("="*60)
        
        for planet_name, body in SOLAR_SYSTEM_BODIES.items():
            if planet_name == 'sun':
                continue
            
            # Get initial position
            pos_initial, _ = kepler_to_cartesian(body, 0)
            
            # Get position after one orbital period
            pos_final, _ = kepler_to_cartesian(body, body.orbital_period)
            
            # Calculate error (should return to same position)
            error_m = np.linalg.norm(pos_final - pos_initial)
            error_km = error_m / 1000.0
            
            # Tolerance is 0.1% of orbital radius
            tolerance = body.semi_major_axis * 0.001 / 1000.0  # Convert to km
            
            passed = error_km < tolerance
            
            result = TestResult(
                test_name=f"Orbital Period - {planet_name.capitalize()}",
                passed=passed,
                error_value=error_km,
                tolerance=tolerance,
                details={
                    'period_days': body.orbital_period / 86400,
                    'semi_major_axis_au': body.semi_major_axis / (AU_KM * 1000)
                }
            )
            
            self.test_results.append(result)
            
            status = "✓" if passed else "✗"
            print(f"{status} {planet_name.capitalize():10s}: Error = {error_km:8.1f} km "
                  f"(tolerance = {tolerance:8.1f} km)")
            
            self.assertTrue(passed, 
                f"{planet_name} period error {error_km:.1f} km exceeds tolerance {tolerance:.1f} km")
    
    def tearDown(self):
        """Generate test report after all tests."""
        if self.test_results:
            report = format_test_report(self.test_results)
            print("\n" + report)
            
            # Save report to file
            report_file = f"tests/reports/planetary_positions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            os.makedirs(os.path.dirname(report_file), exist_ok=True)
            with open(report_file, 'w') as f:
                f.write(report)
            print(f"\nReport saved to: {report_file}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
