"""
Performance benchmarking tests for Orbit Engine simulation.
Tests computational performance and real-time requirements.
"""

import unittest
import time
import numpy as np
from datetime import datetime, timedelta
import sys
import os
import json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.simulations.orbital_mechanics import (
    kepler_to_cartesian,
    calculate_hohmann_transfer,
    calculate_porkchop_plot,
    generate_transfer_trajectory,
    propagate_orbit,
    SOLAR_SYSTEM_BODIES
)
from api.simulations.engine import SimulationEngine
from tests.test_utils import TestResult, format_test_report

class TestPerformance(unittest.TestCase):
    """Test suite for performance benchmarks."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_results = []
        
        # Performance requirements (in seconds)
        self.performance_requirements = {
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
            "position_update": {
                "max_time": 0.001,  # 1ms per update
                "num_bodies": 9,
            },
            "batch_operations": {
                "max_time": 10.0,  # seconds
                "num_operations": 1000,
            }
        }
    
    def test_ephemeris_generation_performance(self):
        """Test performance of generating ephemerides for multiple bodies."""
        print("\n" + "="*60)
        print("Testing Ephemeris Generation Performance")
        print("="*60)
        
        req = self.performance_requirements["ephemeris_generation"]
        
        # Generate ephemerides for all planets over 10 years
        start_time = time.time()
        
        num_bodies = 0
        num_calculations = 0
        
        # Calculate positions for each planet
        for planet_name, body in SOLAR_SYSTEM_BODIES.items():
            if planet_name == 'sun':
                continue
            
            num_bodies += 1
            
            # Generate positions every hour for 10 years
            time_points = np.arange(0, req["date_range"] * 365.25 * 86400, req["resolution"])
            
            for t in time_points:
                pos, vel = kepler_to_cartesian(body, t)
                num_calculations += 1
        
        elapsed_time = time.time() - start_time
        
        # Calculate metrics
        calculations_per_second = num_calculations / elapsed_time
        time_per_calculation = elapsed_time / num_calculations * 1000  # ms
        
        passed = elapsed_time < req["max_time"]
        
        result = TestResult(
            test_name="Ephemeris Generation",
            passed=passed,
            error_value=elapsed_time,
            tolerance=req["max_time"],
            details={
                'num_bodies': num_bodies,
                'num_calculations': num_calculations,
                'calculations_per_second': calculations_per_second,
                'time_per_calculation_ms': time_per_calculation,
                'total_time_seconds': elapsed_time
            }
        )
        
        self.test_results.append(result)
        
        status = "✓" if passed else "✗"
        print(f"{status} Generated {num_calculations} positions in {elapsed_time:.3f}s")
        print(f"    Rate: {calculations_per_second:.0f} calculations/s")
        print(f"    Per calculation: {time_per_calculation:.3f} ms")
        
        self.assertTrue(passed, 
            f"Ephemeris generation took {elapsed_time:.2f}s, exceeds {req['max_time']}s limit")
    
    def test_trajectory_calculation_performance(self):
        """Test performance of trajectory calculations."""
        print("\n" + "="*60)
        print("Testing Trajectory Calculation Performance")
        print("="*60)
        
        req = self.performance_requirements["trajectory_calculation"]
        
        # Calculate Earth-Mars transfer trajectory
        start_time = time.time()
        
        trajectory = generate_transfer_trajectory(
            "earth", "mars",
            0.0,  # departure time
            259 * 86400,  # arrival time (259 days)
            num_points=req["integration_steps"]
        )
        
        elapsed_time = time.time() - start_time
        
        passed = elapsed_time < req["max_time"]
        
        result = TestResult(
            test_name="Trajectory Calculation",
            passed=passed,
            error_value=elapsed_time,
            tolerance=req["max_time"],
            details={
                'num_points': len(trajectory),
                'time_seconds': elapsed_time,
                'points_per_second': len(trajectory) / elapsed_time
            }
        )
        
        self.test_results.append(result)
        
        status = "✓" if passed else "✗"
        print(f"{status} Generated {len(trajectory)} trajectory points in {elapsed_time:.3f}s")
        print(f"    Rate: {len(trajectory)/elapsed_time:.0f} points/s")
        
        self.assertTrue(passed,
            f"Trajectory calculation took {elapsed_time:.2f}s, exceeds {req['max_time']}s limit")
    
    def test_porkchop_plot_performance(self):
        """Test performance of porkchop plot generation."""
        print("\n" + "="*60)
        print("Testing Porkchop Plot Generation Performance")
        print("="*60)
        
        req = self.performance_requirements["porkchop_generation"]
        
        # Generate porkchop plot
        departure_start = datetime(2026, 1, 1)
        departure_end = datetime(2027, 1, 1)
        arrival_start = datetime(2026, 6, 1)
        arrival_end = datetime(2028, 1, 1)
        
        start_time = time.time()
        
        plot = calculate_porkchop_plot(
            "earth", "mars",
            departure_start, departure_end,
            arrival_start, arrival_end,
            resolution=100  # 100x100 grid
        )
        
        elapsed_time = time.time() - start_time
        
        # Calculate metrics
        grid_points = 100 * 100
        points_per_second = grid_points / elapsed_time
        
        passed = elapsed_time < req["max_time"]
        
        result = TestResult(
            test_name="Porkchop Plot Generation",
            passed=passed,
            error_value=elapsed_time,
            tolerance=req["max_time"],
            details={
                'grid_size': req["grid_size"],
                'total_points': grid_points,
                'time_seconds': elapsed_time,
                'points_per_second': points_per_second
            }
        )
        
        self.test_results.append(result)
        
        status = "✓" if passed else "✗"
        print(f"{status} Generated {grid_points} grid points in {elapsed_time:.3f}s")
        print(f"    Rate: {points_per_second:.0f} points/s")
        
        self.assertTrue(passed,
            f"Porkchop generation took {elapsed_time:.2f}s, exceeds {req['max_time']}s limit")
    
    def test_position_update_performance(self):
        """Test performance of single position updates."""
        print("\n" + "="*60)
        print("Testing Position Update Performance")
        print("="*60)
        
        req = self.performance_requirements["position_update"]
        
        # Test updating all planetary positions
        bodies = dict(SOLAR_SYSTEM_BODIES)  # Create a copy
        
        # Initialize positions
        for name, body in bodies.items():
            pos, vel = kepler_to_cartesian(body, 0)
            body.position = pos
            body.velocity = vel
        
        # Measure time for 1000 update cycles
        num_updates = 1000
        dt = 3600  # 1 hour timestep
        
        start_time = time.time()
        
        for _ in range(num_updates):
            for name, body in bodies.items():
                if name != 'sun':
                    propagate_orbit(body, dt, bodies)
        
        elapsed_time = time.time() - start_time
        
        # Calculate per-update time
        time_per_update = (elapsed_time / num_updates) * 1000  # ms
        updates_per_second = num_updates / elapsed_time
        
        passed = time_per_update < (req["max_time"] * 1000)  # Convert to ms
        
        result = TestResult(
            test_name="Position Update Performance",
            passed=passed,
            error_value=time_per_update,
            tolerance=req["max_time"] * 1000,
            details={
                'num_bodies': req["num_bodies"],
                'num_updates': num_updates,
                'time_per_update_ms': time_per_update,
                'updates_per_second': updates_per_second,
                'total_time_seconds': elapsed_time
            }
        )
        
        self.test_results.append(result)
        
        status = "✓" if passed else "✗"
        print(f"{status} {num_updates} updates in {elapsed_time:.3f}s")
        print(f"    Per update: {time_per_update:.3f} ms")
        print(f"    Rate: {updates_per_second:.0f} updates/s")
    
    def test_batch_operations(self):
        """Test performance of batch operations."""
        print("\n" + "="*60)
        print("Testing Batch Operations Performance")
        print("="*60)
        
        req = self.performance_requirements["batch_operations"]
        
        operations_completed = 0
        start_time = time.time()
        
        # Perform various operations
        for i in range(100):
            # Ephemeris calculation
            for planet_name, body in SOLAR_SYSTEM_BODIES.items():
                if planet_name != 'sun':
                    pos, vel = kepler_to_cartesian(body, i * 86400)
                    operations_completed += 1
            
            # Hohmann transfer calculation
            if i % 10 == 0:
                transfer = calculate_hohmann_transfer(
                    SOLAR_SYSTEM_BODIES['earth'],
                    SOLAR_SYSTEM_BODIES['mars']
                )
                operations_completed += 1
            
            # Short trajectory generation
            if i % 5 == 0:
                trajectory = generate_transfer_trajectory(
                    "earth", "venus",
                    0, 146 * 86400,  # ~146 days
                    num_points=50
                )
                operations_completed += 1
        
        elapsed_time = time.time() - start_time
        
        operations_per_second = operations_completed / elapsed_time
        
        passed = elapsed_time < req["max_time"]
        
        result = TestResult(
            test_name="Batch Operations",
            passed=passed,
            error_value=elapsed_time,
            tolerance=req["max_time"],
            details={
                'operations_completed': operations_completed,
                'time_seconds': elapsed_time,
                'operations_per_second': operations_per_second
            }
        )
        
        self.test_results.append(result)
        
        status = "✓" if passed else "✗"
        print(f"{status} Completed {operations_completed} operations in {elapsed_time:.3f}s")
        print(f"    Rate: {operations_per_second:.0f} operations/s")
    
    def test_memory_usage(self):
        """Test memory usage during simulation."""
        print("\n" + "="*60)
        print("Testing Memory Usage")
        print("="*60)
        
        import psutil
        import gc
        
        # Get initial memory usage
        gc.collect()
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Create large dataset
        large_trajectories = []
        
        # Generate 100 trajectories with 1000 points each
        for i in range(100):
            trajectory = generate_transfer_trajectory(
                "earth", "mars",
                i * 86400,  # Different start times
                (i + 200) * 86400,
                num_points=1000
            )
            large_trajectories.append(trajectory)
        
        # Measure memory after allocation
        current_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = current_memory - initial_memory
        
        # Clean up
        del large_trajectories
        gc.collect()
        
        # Check memory was released
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_leaked = final_memory - initial_memory
        
        # Tolerances
        max_memory_increase = 512  # MB
        max_memory_leak = 50  # MB
        
        passed = memory_increase < max_memory_increase and memory_leaked < max_memory_leak
        
        result = TestResult(
            test_name="Memory Usage",
            passed=passed,
            error_value=memory_increase,
            tolerance=max_memory_increase,
            details={
                'initial_memory_mb': initial_memory,
                'peak_memory_mb': current_memory,
                'memory_increase_mb': memory_increase,
                'final_memory_mb': final_memory,
                'memory_leaked_mb': memory_leaked
            }
        )
        
        self.test_results.append(result)
        
        status = "✓" if memory_increase < max_memory_increase else "✗"
        print(f"{status} Memory increase: {memory_increase:.1f} MB (max: {max_memory_increase} MB)")
        
        status = "✓" if memory_leaked < max_memory_leak else "✗"
        print(f"{status} Memory leaked: {memory_leaked:.1f} MB (max: {max_memory_leak} MB)")
    
    def test_concurrent_operations(self):
        """Test performance under concurrent load."""
        print("\n" + "="*60)
        print("Testing Concurrent Operations")
        print("="*60)
        
        import threading
        import queue
        
        results_queue = queue.Queue()
        
        def worker_thread(thread_id, num_operations):
            """Worker thread that performs calculations."""
            thread_start = time.time()
            
            for i in range(num_operations):
                # Mix of different operations
                if i % 3 == 0:
                    pos, vel = kepler_to_cartesian(SOLAR_SYSTEM_BODIES['earth'], i * 3600)
                elif i % 3 == 1:
                    pos, vel = kepler_to_cartesian(SOLAR_SYSTEM_BODIES['mars'], i * 3600)
                else:
                    transfer = calculate_hohmann_transfer(
                        SOLAR_SYSTEM_BODIES['earth'],
                        SOLAR_SYSTEM_BODIES['venus']
                    )
            
            thread_time = time.time() - thread_start
            results_queue.put((thread_id, thread_time))
        
        # Run with multiple threads
        num_threads = 4
        operations_per_thread = 100
        
        threads = []
        start_time = time.time()
        
        for i in range(num_threads):
            t = threading.Thread(target=worker_thread, args=(i, operations_per_thread))
            threads.append(t)
            t.start()
        
        # Wait for all threads
        for t in threads:
            t.join()
        
        total_time = time.time() - start_time
        
        # Collect results
        thread_times = []
        while not results_queue.empty():
            thread_id, thread_time = results_queue.get()
            thread_times.append(thread_time)
        
        # Calculate metrics
        avg_thread_time = np.mean(thread_times)
        max_thread_time = max(thread_times)
        total_operations = num_threads * operations_per_thread
        throughput = total_operations / total_time
        
        # Performance should not degrade too much with concurrency
        # Max thread time should be < 2x the average (indicating good parallelism)
        parallelism_factor = max_thread_time / avg_thread_time
        
        passed = parallelism_factor < 2.0 and total_time < 5.0
        
        result = TestResult(
            test_name="Concurrent Operations",
            passed=passed,
            error_value=parallelism_factor,
            tolerance=2.0,
            details={
                'num_threads': num_threads,
                'operations_per_thread': operations_per_thread,
                'total_operations': total_operations,
                'total_time_seconds': total_time,
                'throughput_ops_per_second': throughput,
                'parallelism_factor': parallelism_factor
            }
        )
        
        self.test_results.append(result)
        
        status = "✓" if passed else "✗"
        print(f"{status} {total_operations} operations with {num_threads} threads in {total_time:.3f}s")
        print(f"    Throughput: {throughput:.0f} ops/s")
        print(f"    Parallelism factor: {parallelism_factor:.2f} (lower is better)")
    
    def tearDown(self):
        """Generate test report after all tests."""
        if self.test_results:
            report = format_test_report(self.test_results)
            print("\n" + report)
            
            # Save report to file
            report_file = f"tests/reports/performance_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            os.makedirs(os.path.dirname(report_file), exist_ok=True)
            with open(report_file, 'w') as f:
                f.write(report)
            print(f"\nReport saved to: {report_file}")
            
            # Save JSON report for automated processing
            json_report = {
                'timestamp': datetime.now().isoformat(),
                'total_tests': len(self.test_results),
                'passed_tests': sum(1 for r in self.test_results if r.passed),
                'results': [
                    {
                        'test_name': r.test_name,
                        'passed': r.passed,
                        'error_value': r.error_value,
                        'tolerance': r.tolerance,
                        'details': r.details
                    }
                    for r in self.test_results
                ]
            }
            
            json_file = f"tests/reports/performance_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(json_file, 'w') as f:
                json.dump(json_report, f, indent=2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
