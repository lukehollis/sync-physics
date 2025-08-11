"""
Test utilities and helper functions for Orbit Engine verification.
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
import json
import os
from dataclasses import dataclass
import math

# Tolerance values for different types of comparisons (in km)
POSITION_TOLERANCE = {
    'Mercury': 500,      # km
    'Venus': 1000,      # km
    'Earth': 100,       # km
    'Mars': 1000,       # km
    'Jupiter': 10000,   # km
    'Saturn': 10000,    # km
    'Uranus': 50000,    # km
    'Neptune': 50000,   # km
}

# Velocity tolerance (km/s)
VELOCITY_TOLERANCE = 0.1

# Delta-V tolerance (percentage)
DELTA_V_TOLERANCE = 0.05  # 5%

# Physical constants
AU_KM = 149597870.7  # 1 AU in kilometers
MU_SUN = 1.32712440018e11  # km^3/s^2

@dataclass
class TestResult:
    """Container for test results with detailed error information."""
    test_name: str
    passed: bool
    error_value: float
    tolerance: float
    details: Dict = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

def calculate_position_error(calculated: np.ndarray, reference: np.ndarray) -> float:
    """
    Calculate position error between calculated and reference positions.
    
    Args:
        calculated: Calculated position vector (km or m)
        reference: Reference position vector (km or m)
        
    Returns:
        Position error magnitude (same units as input)
    """
    return np.linalg.norm(calculated - reference)

def calculate_velocity_error(calculated: np.ndarray, reference: np.ndarray) -> float:
    """
    Calculate velocity error between calculated and reference velocities.
    
    Args:
        calculated: Calculated velocity vector
        reference: Reference velocity vector
        
    Returns:
        Velocity error magnitude
    """
    return np.linalg.norm(calculated - reference)

def calculate_angular_deviation(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """
    Calculate angular deviation between two vectors in degrees.
    
    Args:
        vec1: First vector
        vec2: Second vector
        
    Returns:
        Angular deviation in degrees
    """
    vec1_normalized = vec1 / np.linalg.norm(vec1)
    vec2_normalized = vec2 / np.linalg.norm(vec2)
    
    cos_angle = np.clip(np.dot(vec1_normalized, vec2_normalized), -1.0, 1.0)
    return np.degrees(np.arccos(cos_angle))

def kepler_equation_solver(M: float, e: float, tolerance: float = 1e-12, max_iter: int = 100) -> float:
    """
    Solve Kepler's equation M = E - e*sin(E) for eccentric anomaly E.
    
    Args:
        M: Mean anomaly (radians)
        e: Eccentricity
        tolerance: Convergence tolerance
        max_iter: Maximum iterations
        
    Returns:
        Eccentric anomaly E (radians)
    """
    # Initial guess
    if e < 0.8:
        E = M
    else:
        E = np.pi
    
    # Newton-Raphson iteration
    for _ in range(max_iter):
        f = E - e * np.sin(E) - M
        f_prime = 1 - e * np.cos(E)
        
        delta_E = -f / f_prime
        E += delta_E
        
        if abs(delta_E) < tolerance:
            break
    
    return E

def orbital_elements_to_state_vector(
    a: float, e: float, i: float, omega: float, Omega: float, M: float, mu: float = MU_SUN
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Convert classical orbital elements to Cartesian state vectors.
    
    Args:
        a: Semi-major axis (km)
        e: Eccentricity
        i: Inclination (radians)
        omega: Argument of periapsis (radians)
        Omega: Longitude of ascending node (radians)
        M: Mean anomaly (radians)
        mu: Gravitational parameter (km^3/s^2)
        
    Returns:
        position: Position vector (km)
        velocity: Velocity vector (km/s)
    """
    # Solve for eccentric anomaly
    E = kepler_equation_solver(M, e)
    
    # True anomaly
    nu = 2 * np.arctan2(
        np.sqrt(1 + e) * np.sin(E/2),
        np.sqrt(1 - e) * np.cos(E/2)
    )
    
    # Distance from focus
    r = a * (1 - e * np.cos(E))
    
    # Position in orbital plane
    r_orbital = np.array([
        r * np.cos(nu),
        r * np.sin(nu),
        0
    ])
    
    # Velocity in orbital plane
    h = np.sqrt(mu * a * (1 - e**2))
    v_orbital = np.array([
        -mu / h * np.sin(nu),
        mu / h * (e + np.cos(nu)),
        0
    ])
    
    # Rotation matrices
    cos_omega = np.cos(omega)
    sin_omega = np.sin(omega)
    cos_Omega = np.cos(Omega)
    sin_Omega = np.sin(Omega)
    cos_i = np.cos(i)
    sin_i = np.sin(i)
    
    # Combined rotation matrix (3-1-3 Euler angles)
    R = np.array([
        [cos_Omega * cos_omega - sin_Omega * sin_omega * cos_i,
         -cos_Omega * sin_omega - sin_Omega * cos_omega * cos_i,
         sin_Omega * sin_i],
        [sin_Omega * cos_omega + cos_Omega * sin_omega * cos_i,
         -sin_Omega * sin_omega + cos_Omega * cos_omega * cos_i,
         -cos_Omega * sin_i],
        [sin_omega * sin_i,
         cos_omega * sin_i,
         cos_i]
    ])
    
    # Transform to inertial frame
    position = R @ r_orbital
    velocity = R @ v_orbital
    
    return position, velocity

def calculate_orbital_energy(r: np.ndarray, v: np.ndarray, mu: float = MU_SUN) -> float:
    """
    Calculate specific orbital energy.
    
    Args:
        r: Position vector (km)
        v: Velocity vector (km/s)
        mu: Gravitational parameter (km^3/s^2)
        
    Returns:
        Specific orbital energy (km^2/s^2)
    """
    r_mag = np.linalg.norm(r)
    v_mag = np.linalg.norm(v)
    
    return v_mag**2 / 2 - mu / r_mag

def calculate_jacobi_constant(r: np.ndarray, v: np.ndarray, omega: float, mu1: float, mu2: float) -> float:
    """
    Calculate Jacobi constant for circular restricted three-body problem.
    
    Args:
        r: Position vector in rotating frame
        v: Velocity vector in rotating frame
        omega: Angular velocity of rotating frame
        mu1: Mass parameter of primary body
        mu2: Mass parameter of secondary body
        
    Returns:
        Jacobi constant
    """
    x, y, z = r
    vx, vy, vz = v
    
    # Distances to primaries (assuming primaries at (-mu2, 0, 0) and (mu1, 0, 0))
    r1 = np.sqrt((x + mu2)**2 + y**2 + z**2)
    r2 = np.sqrt((x - mu1)**2 + y**2 + z**2)
    
    # Effective potential
    U = -(mu1/r1 + mu2/r2) - 0.5 * omega**2 * (x**2 + y**2)
    
    # Kinetic energy in rotating frame
    T = 0.5 * (vx**2 + vy**2 + vz**2)
    
    return -2 * U - 2 * T

def load_reference_ephemeris(planet: str, date: datetime) -> Optional[Dict]:
    """
    Load reference ephemeris data for a planet at a given date.
    This would normally connect to JPL Horizons or use SPICE kernels.
    For testing, we'll use pre-downloaded reference data.
    
    Args:
        planet: Planet name
        date: Date for ephemeris
        
    Returns:
        Dictionary with position and velocity data, or None if unavailable
    """
    # In a real implementation, this would query JPL Horizons
    # For now, return mock data for testing
    reference_file = f"tests/reference_data/{planet.lower()}_{date.strftime('%Y%m%d')}.json"
    
    if os.path.exists(reference_file):
        with open(reference_file, 'r') as f:
            return json.load(f)
    
    # Return None if reference data not available
    return None

def format_test_report(results: List[TestResult]) -> str:
    """
    Format test results into a readable report.
    
    Args:
        results: List of TestResult objects
        
    Returns:
        Formatted report string
    """
    report = []
    report.append("=" * 60)
    report.append("ORBIT ENGINE VERIFICATION REPORT")
    report.append(f"Timestamp: {datetime.now().isoformat()}")
    report.append("=" * 60)
    report.append("")
    
    # Summary statistics
    total_tests = len(results)
    passed_tests = sum(1 for r in results if r.passed)
    failed_tests = total_tests - passed_tests
    
    report.append(f"Total Tests: {total_tests}")
    report.append(f"Passed: {passed_tests}")
    report.append(f"Failed: {failed_tests}")
    report.append(f"Success Rate: {100 * passed_tests / total_tests:.1f}%")
    report.append("")
    report.append("-" * 60)
    report.append("DETAILED RESULTS")
    report.append("-" * 60)
    
    for result in results:
        status = "✓ PASS" if result.passed else "✗ FAIL"
        report.append(f"\n{status}: {result.test_name}")
        report.append(f"  Error: {result.error_value:.6f}")
        report.append(f"  Tolerance: {result.tolerance:.6f}")
        
        if result.details:
            for key, value in result.details.items():
                report.append(f"  {key}: {value}")
    
    report.append("")
    report.append("=" * 60)
    
    return "\n".join(report)
