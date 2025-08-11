"""
Orbital mechanics calculations for the Orbit Engine simulator.
"""

import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
import math
from datetime import datetime, timedelta

# Physical constants
G = 6.67430e-11  # Gravitational constant (m^3 kg^-1 s^-2)
AU = 1.496e11    # Astronomical unit in meters
MU_SUN = 1.32712440018e20  # Standard gravitational parameter for the Sun (m^3/s^2)

@dataclass
class CelestialBody:
    """Represents a celestial body in the solar system."""
    name: str
    mass: float  # kg
    radius: float  # m
    semi_major_axis: float  # m
    eccentricity: float
    inclination: float  # radians
    mean_anomaly_epoch: float  # radians at epoch
    orbital_period: float  # seconds
    color: str
    position: np.ndarray = None
    velocity: np.ndarray = None
    
    def __post_init__(self):
        if self.position is None:
            self.position = np.zeros(3)
        if self.velocity is None:
            self.velocity = np.zeros(3)

# Solar system data (simplified circular orbits for initial implementation)
SOLAR_SYSTEM_BODIES = {
    'sun': CelestialBody(
        name='Sun',
        mass=1.989e30,
        radius=6.96e8,
        semi_major_axis=0,
        eccentricity=0,
        inclination=0,
        mean_anomaly_epoch=0,
        orbital_period=0,
        color='#FDB813'
    ),
    'mercury': CelestialBody(
        name='Mercury',
        mass=3.301e23,
        radius=2.44e6,
        semi_major_axis=0.387 * AU,
        eccentricity=0.206,
        inclination=np.radians(7.0),
        mean_anomaly_epoch=0,
        orbital_period=87.97 * 86400,  # days to seconds
        color='#8C7853'
    ),
    'venus': CelestialBody(
        name='Venus',
        mass=4.867e24,
        radius=6.05e6,
        semi_major_axis=0.723 * AU,
        eccentricity=0.007,
        inclination=np.radians(3.4),
        mean_anomaly_epoch=0,
        orbital_period=224.7 * 86400,
        color='#FFC649'
    ),
    'earth': CelestialBody(
        name='Earth',
        mass=5.972e24,
        radius=6.37e6,
        semi_major_axis=1.0 * AU,
        eccentricity=0.017,
        inclination=0,
        mean_anomaly_epoch=0,
        orbital_period=365.25 * 86400,
        color='#4B7BEC'
    ),
    'mars': CelestialBody(
        name='Mars',
        mass=6.417e23,
        radius=3.39e6,
        semi_major_axis=1.524 * AU,
        eccentricity=0.093,
        inclination=np.radians(1.85),
        mean_anomaly_epoch=0,
        orbital_period=687.0 * 86400,
        color='#CD5C5C'
    ),
    'jupiter': CelestialBody(
        name='Jupiter',
        mass=1.898e27,
        radius=6.99e7,
        semi_major_axis=5.203 * AU,
        eccentricity=0.048,
        inclination=np.radians(1.3),
        mean_anomaly_epoch=0,
        orbital_period=11.86 * 365.25 * 86400,
        color='#DAA520'
    ),
    'saturn': CelestialBody(
        name='Saturn',
        mass=5.683e26,
        radius=5.82e7,
        semi_major_axis=9.537 * AU,
        eccentricity=0.054,
        inclination=np.radians(2.5),
        mean_anomaly_epoch=0,
        orbital_period=29.46 * 365.25 * 86400,
        color='#F4E99B'
    ),
    'uranus': CelestialBody(
        name='Uranus',
        mass=8.681e25,
        radius=2.54e7,
        semi_major_axis=19.191 * AU,
        eccentricity=0.047,
        inclination=np.radians(0.77),
        mean_anomaly_epoch=0,
        orbital_period=84.01 * 365.25 * 86400,
        color='#4FD0E0'
    ),
    'neptune': CelestialBody(
        name='Neptune',
        mass=1.024e26,
        radius=2.46e7,
        semi_major_axis=30.07 * AU,
        eccentricity=0.009,
        inclination=np.radians(1.77),
        mean_anomaly_epoch=0,
        orbital_period=164.79 * 365.25 * 86400,
        color='#4169E1'
    )
}

def clean_nan_values(data: Any) -> Any:
    """
    Recursively clean NaN values from data structures, replacing them with None.
    Also converts datetime objects to ISO strings for JSON serialization.
    """
    if isinstance(data, dict):
        return {k: clean_nan_values(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_nan_values(item) for item in data]
    elif isinstance(data, np.ndarray):
        return clean_nan_values(data.tolist())
    elif isinstance(data, (float, np.floating)):
        if np.isnan(data) or np.isinf(data):
            return None
        return float(data)
    elif isinstance(data, (int, np.integer)):
        return int(data)
    elif isinstance(data, datetime):
        return data.isoformat()
    else:
        return data

def kepler_to_cartesian(body: CelestialBody, time: float) -> Tuple[np.ndarray, np.ndarray]:
    """
    Convert Keplerian orbital elements to Cartesian position and velocity.
    
    Args:
        body: CelestialBody with orbital parameters
        time: Time since epoch in seconds
        
    Returns:
        position: 3D position vector in meters
        velocity: 3D velocity vector in m/s
    """
    if body.semi_major_axis == 0:  # Sun at origin
        return np.zeros(3), np.zeros(3)
    
    # Calculate mean anomaly
    n = 2 * np.pi / body.orbital_period  # Mean motion
    M = body.mean_anomaly_epoch + n * time
    
    # Solve Kepler's equation for eccentric anomaly (simplified for small eccentricity)
    E = M
    for _ in range(10):  # Newton-Raphson iteration
        E = E - (E - body.eccentricity * np.sin(E) - M) / (1 - body.eccentricity * np.cos(E))
    
    # True anomaly
    true_anomaly = 2 * np.arctan2(
        np.sqrt(1 + body.eccentricity) * np.sin(E/2),
        np.sqrt(1 - body.eccentricity) * np.cos(E/2)
    )
    
    # Distance from focus
    r = body.semi_major_axis * (1 - body.eccentricity * np.cos(E))
    
    # Position in orbital plane
    x_orbital = r * np.cos(true_anomaly)
    y_orbital = r * np.sin(true_anomaly)
    
    # Velocity in orbital plane
    h = np.sqrt(MU_SUN * body.semi_major_axis * (1 - body.eccentricity**2))
    vx_orbital = -MU_SUN / h * np.sin(true_anomaly)
    vy_orbital = MU_SUN / h * (body.eccentricity + np.cos(true_anomaly))
    
    # Rotate to 3D space - orbital plane is x-z (horizontal), y is vertical
    cos_i = np.cos(body.inclination)
    sin_i = np.sin(body.inclination)
    
    # For horizontal orbits in the x-z plane:
    # x stays as is
    # z gets the y_orbital component (horizontal plane)
    # y gets the inclination component (vertical)
    position = np.array([
        x_orbital,
        y_orbital * sin_i,  # vertical component (inclination)
        y_orbital * cos_i   # horizontal component in z-direction
    ])
    
    velocity = np.array([
        vx_orbital,
        vy_orbital * sin_i,  # vertical velocity component
        vy_orbital * cos_i   # horizontal velocity component in z-direction
    ])
    
    return position, velocity

def propagate_orbit(body: CelestialBody, dt: float, bodies: Dict[str, CelestialBody]) -> None:
    """
    Propagate orbit using n-body integration (simplified Euler method).
    
    Args:
        body: Body to propagate
        dt: Time step in seconds
        bodies: Dictionary of all bodies for gravitational interactions
    """
    if body.name == 'Sun':
        return  # Sun stays at origin
    
    # Calculate gravitational acceleration from all other bodies
    acceleration = np.zeros(3)
    
    for other_name, other in bodies.items():
        if other_name != body.name.lower():
            r_vec = other.position - body.position
            r_mag = np.linalg.norm(r_vec)
            if r_mag > 0:
                acceleration += G * other.mass * r_vec / r_mag**3
    
    # Update velocity and position
    body.velocity += acceleration * dt
    body.position += body.velocity * dt

def calculate_hohmann_transfer(departure_body: CelestialBody, 
                              arrival_body: CelestialBody) -> Dict:
    """
    Calculate a Hohmann transfer orbit between two bodies.
    
    Args:
        departure_body: Starting body (e.g., Earth)
        arrival_body: Target body (e.g., Mars)
        
    Returns:
        Dictionary with transfer parameters
    """
    r1 = departure_body.semi_major_axis
    r2 = arrival_body.semi_major_axis
    
    # Semi-major axis of transfer orbit
    a_transfer = (r1 + r2) / 2
    
    # Transfer time (half the orbital period of transfer orbit)
    transfer_time = np.pi * np.sqrt(a_transfer**3 / MU_SUN)
    
    # Delta-v requirements
    v1 = np.sqrt(MU_SUN / r1)  # Circular velocity at departure
    v_transfer_perihelion = np.sqrt(MU_SUN * (2/r1 - 1/a_transfer))
    delta_v_departure = abs(v_transfer_perihelion - v1)
    
    v2 = np.sqrt(MU_SUN / r2)  # Circular velocity at arrival
    v_transfer_aphelion = np.sqrt(MU_SUN * (2/r2 - 1/a_transfer))
    delta_v_arrival = abs(v2 - v_transfer_aphelion)
    
    # Phase angle
    phase_angle = np.pi * (1 - (a_transfer / r2)**(3/2))
    
    # C3 (characteristic energy)
    c3 = (v_transfer_perihelion - v1)**2
    
    result = {
        'transfer_time': transfer_time,
        'delta_v_total': delta_v_departure + delta_v_arrival,
        'delta_v_departure': delta_v_departure,
        'delta_v_arrival': delta_v_arrival,
        'phase_angle': phase_angle,
        'c3': c3,
        'semi_major_axis': a_transfer
    }
    
    # Clean NaN values before returning
    return clean_nan_values(result)

def calculate_porkchop_plot(departure_body: str, arrival_body: str,
                           departure_start: datetime, departure_end: datetime,
                           arrival_start: datetime, arrival_end: datetime,
                           resolution: int = 50) -> Dict:
    """
    Calculate a porkchop plot for launch window analysis.
    
    Args:
        departure_body: Name of departure body
        arrival_body: Name of arrival body
        departure_start: Start of departure window
        departure_end: End of departure window
        arrival_start: Start of arrival window
        arrival_end: End of arrival window
        resolution: Grid resolution
        
    Returns:
        Dictionary with porkchop plot data
    """
    dep_body = SOLAR_SYSTEM_BODIES[departure_body.lower()]
    arr_body = SOLAR_SYSTEM_BODIES[arrival_body.lower()]
    
    # Create time grids
    dep_times = np.linspace(0, (departure_end - departure_start).total_seconds(), resolution)
    arr_times = np.linspace(0, (arrival_end - arrival_start).total_seconds(), resolution)
    
    # Initialize result grids
    c3_grid = np.zeros((resolution, resolution))
    delta_v_grid = np.zeros((resolution, resolution))
    tof_grid = np.zeros((resolution, resolution))
    
    for i, dep_t in enumerate(dep_times):
        # Get departure position
        dep_pos, _ = kepler_to_cartesian(dep_body, dep_t)
        
        for j, arr_t in enumerate(arr_times):
            # Get arrival position
            arr_pos, _ = kepler_to_cartesian(arr_body, arr_t)
            
            # Time of flight
            tof = arr_t - dep_t
            if tof <= 0:
                c3_grid[i, j] = np.nan
                delta_v_grid[i, j] = np.nan
                tof_grid[i, j] = np.nan
                continue
            
            # Simplified Lambert solver (using Hohmann approximation)
            transfer = calculate_hohmann_transfer(dep_body, arr_body)
            
            # Store results
            c3_grid[i, j] = transfer['c3']
            delta_v_grid[i, j] = transfer['delta_v_total']
            tof_grid[i, j] = tof / 86400  # Convert to days
    
    result = {
        'departure_dates': [departure_start + timedelta(seconds=t) for t in dep_times],
        'arrival_dates': [arrival_start + timedelta(seconds=t) for t in arr_times],
        'c3': c3_grid.tolist(),
        'delta_v': delta_v_grid.tolist(),
        'time_of_flight': tof_grid.tolist()
    }
    
    # Clean NaN values before returning
    return clean_nan_values(result)

def generate_transfer_trajectory(departure_body: str, arrival_body: str,
                                departure_time: float, arrival_time: float,
                                num_points: int = 100) -> List[Dict]:
    """
    Generate trajectory points for a transfer orbit.
    
    Args:
        departure_body: Name of departure body
        arrival_body: Name of arrival body
        departure_time: Departure time in seconds from epoch
        arrival_time: Arrival time in seconds from epoch
        num_points: Number of trajectory points
        
    Returns:
        List of trajectory points with position and time
    """
    dep_body = SOLAR_SYSTEM_BODIES[departure_body.lower()]
    arr_body = SOLAR_SYSTEM_BODIES[arrival_body.lower()]
    
    # Get initial and final positions
    dep_pos, dep_vel = kepler_to_cartesian(dep_body, departure_time)
    arr_pos, arr_vel = kepler_to_cartesian(arr_body, arrival_time)
    
    # Calculate transfer orbit (simplified)
    transfer = calculate_hohmann_transfer(dep_body, arr_body)
    
    # Generate trajectory points
    trajectory = []
    time_points = np.linspace(departure_time, arrival_time, num_points)
    
    for t in time_points:
        # Interpolate position (simplified)
        alpha = (t - departure_time) / (arrival_time - departure_time)
        position = (1 - alpha) * dep_pos + alpha * arr_pos
        
        trajectory.append({
            'time': t,
            'position': position.tolist(),
            'progress': alpha
        })
    
    return trajectory
