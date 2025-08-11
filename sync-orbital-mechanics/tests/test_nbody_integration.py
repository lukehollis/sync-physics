"""
Test n-body integration accuracy, energy conservation, and numerical stability.
"""

import unittest
import numpy as np
from datetime import datetime
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.simulations.orbital_mechanics import (
    propagate_orbit,
    kepler_to_cartesian,
    SOLAR_SYSTEM_BODIES,
    CelestialBody,
    G, MU_SUN
)
from tests.test_utils import (
    TestResult,
    format_test_report,
    calculate_orbital_energy,
    AU_KM
)

class TestNBodyIntegration(unittest.TestCase):
    """Test suite for n-body gravitational integration."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_results = []
        
        # Create test bodies for controlled experiments
        self.test_body_circular = CelestialBody(
            name="test_circular",
            mass=1e24,  # kg (Earth-like)
            radius=6.371e6,  # m
            semi_major_axis=AU_KM * 1000,  # 1 AU in meters
            eccentricity=0.0,  # Circular orbit
            inclination=0.0,
            mean_anomaly_epoch=0.0,
            orbital_period=365.25 * 86400,  # seconds
            color="#0000ff"
        )
        
        self.test_body_elliptical = CelestialBody(
            name="test_elliptical",
            mass=1e24,
            radius=6.371e6,
            semi_major_axis=AU_KM * 1000,
            eccentricity=0.3,  # Moderate eccentricity
            inclination=np.radians(5),  # 5 degree inclination
            mean_anomaly_epoch=0.0,
            orbital_period=365.25 * 86400,
            color="#ff0000"
        )
    
    def test_two_body_analytical_comparison(self):
        """Compare numerical integration with analytical two-body solution."""
        print("\n" + "="*60)
        print("Testing Two-Body Problem Accuracy")
        print("="*60)
        
        # Set up initial conditions for circular orbit
        r0, v0 = kepler_to_cartesian(self.test_body_circular, 0)
        
        # Store initial state
        initial_energy = calculate_orbital_energy(r0/1000, v0/1000, MU_SUN)
        
        # Propagate for one complete orbit using small time steps
        dt = 3600  # 1 hour time step
        num_steps = int(self.test_body_circular.orbital_period / dt)
        
        # Create a simple two-body system (Sun + test body)
        bodies = {
            'sun': SOLAR_SYSTEM_BODIES['sun'],
            'test': self.test_body_circular
        }
        
        # Set initial position and velocity
        self.test_body_circular.position = r0
        self.test_body_circular.velocity = v0
        
        # Track position over time
        positions = [r0.copy()]
        energies = [initial_energy]
        
        for i in range(num_steps):
            # Propagate one step
            propagate_orbit(self.test_body_circular, dt, bodies)
            
            # Store position and calculate energy
            positions.append(self.test_body_circular.position.copy())
            energy = calculate_orbital_energy(
                self.test_body_circular.position/1000,
                self.test_body_circular.velocity/1000,
                MU_SUN
            )
            energies.append(energy)
        
        # After one orbit, should return close to initial position
        final_position = self.test_body_circular.position
        position_error = np.linalg.norm(final_position - r0) / 1000  # km
        
        # Check energy conservation
        energy_errors = [abs(e - initial_energy) / abs(initial_energy) for e in energies]
        max_energy_error = max(energy_errors)
        
        # Tolerances
        position_tolerance = 10000  # km (1% of orbital radius)
        energy_tolerance = 0.01  # 1% relative error
        
        position_passed = position_error < position_tolerance
        energy_passed = max_energy_error < energy_tolerance
        
        result = TestResult(
            test_name="Two-Body Circular Orbit",
            passed=position_passed and energy_passed,
            error_value=position_error,
            tolerance=position_tolerance,
            details={
                'position_error_km': position_error,
                'max_energy_error': max_energy_error,
                'num_steps': num_steps,
                'dt_hours': dt/3600,
                'orbit_radius_au': np.linalg.norm(r0) / (AU_KM * 1000)
            }
        )
        
        self.test_results.append(result)
        
        status = "✓" if position_passed else "✗"
        print(f"{status} Position after orbit: {position_error:.1f} km error")
        
        status = "✓" if energy_passed else "✗"
        print(f"{status} Energy conservation: {max_energy_error*100:.3f}% max error")
    
    def test_energy_conservation_elliptical(self):
        """Test energy conservation for elliptical orbits."""
        print("\n" + "="*60)
        print("Testing Energy Conservation (Elliptical)")
        print("="*60)
        
        # Set up elliptical orbit
        r0, v0 = kepler_to_cartesian(self.test_body_elliptical, 0)
        
        # Initial energy
        initial_energy = calculate_orbital_energy(r0/1000, v0/1000, MU_SUN)
        
        # Create system
        bodies = {
            'sun': SOLAR_SYSTEM_BODIES['sun'],
            'test': self.test_body_elliptical
        }
        
        self.test_body_elliptical.position = r0
        self.test_body_elliptical.velocity = v0
        
        # Propagate for half an orbit
        dt = 3600  # 1 hour
        num_steps = int(self.test_body_elliptical.orbital_period / (2 * dt))
        
        energies = []
        distances = []
        
        for i in range(num_steps):
            propagate_orbit(self.test_body_elliptical, dt, bodies)
            
            # Calculate energy
            energy = calculate_orbital_energy(
                self.test_body_elliptical.position/1000,
                self.test_body_elliptical.velocity/1000,
                MU_SUN
            )
            energies.append(energy)
            
            # Track distance from sun
            distance = np.linalg.norm(self.test_body_elliptical.position) / (AU_KM * 1000)
            distances.append(distance)
        
        # Calculate energy conservation metrics
        energy_errors = [abs(e - initial_energy) / abs(initial_energy) for e in energies]
        max_energy_error = max(energy_errors)
        mean_energy_error = np.mean(energy_errors)
        
        # Verify orbital characteristics
        min_distance = min(distances)  # Perihelion
        max_distance = max(distances)  # Aphelion
        
        # Expected perihelion and aphelion
        a = self.test_body_elliptical.semi_major_axis / (AU_KM * 1000)  # AU
        e = self.test_body_elliptical.eccentricity
        expected_perihelion = a * (1 - e)
        expected_aphelion = a * (1 + e)
        
        perihelion_error = abs(min_distance - expected_perihelion)
        aphelion_error = abs(max_distance - expected_aphelion)
        
        # Tolerances
        energy_tolerance = 0.01  # 1%
        distance_tolerance = 0.05  # AU
        
        energy_passed = max_energy_error < energy_tolerance
        distance_passed = perihelion_error < distance_tolerance and aphelion_error < distance_tolerance
        
        result = TestResult(
            test_name="Elliptical Orbit Energy Conservation",
            passed=energy_passed and distance_passed,
            error_value=max_energy_error,
            tolerance=energy_tolerance,
            details={
                'max_energy_error': max_energy_error,
                'mean_energy_error': mean_energy_error,
                'perihelion_error_au': perihelion_error,
                'aphelion_error_au': aphelion_error,
                'eccentricity': e
            }
        )
        
        self.test_results.append(result)
        
        status = "✓" if energy_passed else "✗"
        print(f"{status} Energy: {max_energy_error*100:.3f}% max error, "
              f"{mean_energy_error*100:.3f}% mean error")
        
        status = "✓" if distance_passed else "✗"
        print(f"{status} Perihelion: {min_distance:.3f} AU (expected: {expected_perihelion:.3f})")
        print(f"    Aphelion: {max_distance:.3f} AU (expected: {expected_aphelion:.3f})")
    
    def test_multi_body_stability(self):
        """Test stability of multi-body system (inner solar system)."""
        print("\n" + "="*60)
        print("Testing Multi-Body System Stability")
        print("="*60)
        
        # Create a copy of inner solar system bodies
        test_bodies = {}
        for name in ['sun', 'mercury', 'venus', 'earth', 'mars']:
            body = SOLAR_SYSTEM_BODIES[name]
            test_body = CelestialBody(
                name=body.name,
                mass=body.mass,
                radius=body.radius,
                semi_major_axis=body.semi_major_axis,
                eccentricity=body.eccentricity,
                inclination=body.inclination,
                mean_anomaly_epoch=body.mean_anomaly_epoch,
                orbital_period=body.orbital_period,
                color=body.color
            )
            # Set initial positions
            pos, vel = kepler_to_cartesian(body, 0)
            test_body.position = pos
            test_body.velocity = vel
            test_bodies[name] = test_body
        
        # Calculate initial total energy and angular momentum
        total_energy_initial = 0
        total_angular_momentum_initial = np.zeros(3)
        
        for name, body in test_bodies.items():
            if name != 'sun':
                # Kinetic energy
                v_mag = np.linalg.norm(body.velocity)
                KE = 0.5 * body.mass * v_mag**2
                
                # Potential energy (sun-planet only for simplicity)
                r_mag = np.linalg.norm(body.position)
                PE = -G * test_bodies['sun'].mass * body.mass / r_mag
                
                total_energy_initial += KE + PE
                
                # Angular momentum
                L = body.mass * np.cross(body.position, body.velocity)
                total_angular_momentum_initial += L
        
        # Propagate for 10 Earth days
        dt = 3600  # 1 hour
        num_steps = 240  # 10 days
        
        energy_history = []
        angular_momentum_history = []
        
        for i in range(num_steps):
            # Propagate all bodies
            for name, body in test_bodies.items():
                if name != 'sun':
                    propagate_orbit(body, dt, test_bodies)
            
            # Calculate total energy and angular momentum
            total_energy = 0
            total_angular_momentum = np.zeros(3)
            
            for name, body in test_bodies.items():
                if name != 'sun':
                    v_mag = np.linalg.norm(body.velocity)
                    r_mag = np.linalg.norm(body.position)
                    
                    KE = 0.5 * body.mass * v_mag**2
                    PE = -G * test_bodies['sun'].mass * body.mass / r_mag
                    
                    total_energy += KE + PE
                    L = body.mass * np.cross(body.position, body.velocity)
                    total_angular_momentum += L
            
            energy_history.append(total_energy)
            angular_momentum_history.append(np.linalg.norm(total_angular_momentum))
        
        # Calculate conservation errors
        energy_errors = [abs(e - total_energy_initial) / abs(total_energy_initial) 
                        for e in energy_history]
        max_energy_error = max(energy_errors)
        
        L_mag_initial = np.linalg.norm(total_angular_momentum_initial)
        momentum_errors = [abs(L - L_mag_initial) / L_mag_initial 
                          for L in angular_momentum_history]
        max_momentum_error = max(momentum_errors)
        
        # Tolerances (relaxed for multi-body)
        energy_tolerance = 0.05  # 5%
        momentum_tolerance = 0.05  # 5%
        
        energy_passed = max_energy_error < energy_tolerance
        momentum_passed = max_momentum_error < momentum_tolerance
        
        result = TestResult(
            test_name="Multi-Body System Conservation",
            passed=energy_passed and momentum_passed,
            error_value=max_energy_error,
            tolerance=energy_tolerance,
            details={
                'max_energy_error': max_energy_error,
                'max_momentum_error': max_momentum_error,
                'num_bodies': len(test_bodies),
                'simulation_days': num_steps * dt / 86400
            }
        )
        
        self.test_results.append(result)
        
        status = "✓" if energy_passed else "✗"
        print(f"{status} Energy conservation: {max_energy_error*100:.3f}% max error")
        
        status = "✓" if momentum_passed else "✗"
        print(f"{status} Angular momentum: {max_momentum_error*100:.3f}% max error")
    
    def test_integration_timestep_convergence(self):
        """Test that smaller timesteps produce more accurate results."""
        print("\n" + "="*60)
        print("Testing Integration Timestep Convergence")
        print("="*60)
        
        # Test different timesteps
        timesteps = [7200, 3600, 1800, 900]  # 2h, 1h, 30min, 15min
        
        # Reference orbit
        r0, v0 = kepler_to_cartesian(self.test_body_circular, 0)
        
        errors = []
        
        for dt in timesteps:
            # Reset body
            test_body = CelestialBody(
                name="test",
                mass=self.test_body_circular.mass,
                radius=self.test_body_circular.radius,
                semi_major_axis=self.test_body_circular.semi_major_axis,
                eccentricity=self.test_body_circular.eccentricity,
                inclination=self.test_body_circular.inclination,
                mean_anomaly_epoch=self.test_body_circular.mean_anomaly_epoch,
                orbital_period=self.test_body_circular.orbital_period,
                color="#0000ff"
            )
            test_body.position = r0.copy()
            test_body.velocity = v0.copy()
            
            bodies = {'sun': SOLAR_SYSTEM_BODIES['sun'], 'test': test_body}
            
            # Propagate for 1 day
            num_steps = int(86400 / dt)
            
            for _ in range(num_steps):
                propagate_orbit(test_body, dt, bodies)
            
            # Compare with analytical position after 1 day
            r_analytical, v_analytical = kepler_to_cartesian(self.test_body_circular, 86400)
            
            position_error = np.linalg.norm(test_body.position - r_analytical) / 1000  # km
            errors.append(position_error)
            
            print(f"  dt = {dt/3600:4.1f}h: error = {position_error:8.1f} km")
        
        # Check that errors decrease with smaller timesteps
        convergence = all(errors[i] >= errors[i+1] for i in range(len(errors)-1))
        
        # Check that smallest timestep gives acceptable accuracy
        best_error = errors[-1]
        tolerance = 1000  # km
        
        passed = convergence and best_error < tolerance
        
        result = TestResult(
            test_name="Integration Timestep Convergence",
            passed=passed,
            error_value=best_error,
            tolerance=tolerance,
            details={
                'errors_km': errors,
                'timesteps_hours': [dt/3600 for dt in timesteps],
                'convergent': convergence
            }
        )
        
        self.test_results.append(result)
        
        status = "✓" if convergence else "✗"
        print(f"{status} Convergence: Errors decrease with smaller timesteps")
        
        status = "✓" if best_error < tolerance else "✗"
        print(f"{status} Best accuracy: {best_error:.1f} km with dt={timesteps[-1]/3600:.1f}h")
    
    def tearDown(self):
        """Generate test report after all tests."""
        if self.test_results:
            report = format_test_report(self.test_results)
            print("\n" + report)
            
            # Save report to file
            report_file = f"tests/reports/nbody_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            os.makedirs(os.path.dirname(report_file), exist_ok=True)
            with open(report_file, 'w') as f:
                f.write(report)
            print(f"\nReport saved to: {report_file}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
