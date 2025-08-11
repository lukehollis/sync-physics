#!/usr/bin/env python3
"""
Test script to verify CFD simulation stability improvements
"""

import sys
import numpy as np
from api.simulations.cfd import CFDSimulation, SimulationConfig

def test_cfd_stability():
    """Test the CFD simulation with various configurations"""
    
    print("Testing CFD Simulation Stability Improvements")
    print("=" * 50)
    
    # Test configurations
    test_configs = [
        {
            "name": "baseline",
            "description": "Baseline configuration with adaptive timestep",
            "config": SimulationConfig(
                name="test_baseline",
                grid_size_x=100,
                grid_size_y=40,
                inlet_velocity=1.0,
                viscosity=0.01,
                time_steps=100,
                use_adaptive_dt=True,
                cfl_number=0.5
            )
        },
        {
            "name": "high_resolution",
            "description": "Higher resolution grid",
            "config": SimulationConfig(
                name="test_high_res",
                grid_size_x=200,
                grid_size_y=80,
                inlet_velocity=1.0,
                viscosity=0.01,
                time_steps=100,
                use_adaptive_dt=True,
                cfl_number=0.5
            )
        },
        {
            "name": "high_velocity",
            "description": "Higher inlet velocity",
            "config": SimulationConfig(
                name="test_high_vel",
                grid_size_x=100,
                grid_size_y=40,
                inlet_velocity=5.0,
                viscosity=0.01,
                time_steps=100,
                use_adaptive_dt=True,
                cfl_number=0.3  # More conservative CFL for higher velocity
            )
        },
        {
            "name": "low_viscosity",
            "description": "Lower viscosity (higher Reynolds number)",
            "config": SimulationConfig(
                name="test_low_visc",
                grid_size_x=100,
                grid_size_y=40,
                inlet_velocity=1.0,
                viscosity=0.001,
                time_steps=100,
                use_adaptive_dt=True,
                cfl_number=0.3
            )
        }
    ]
    
    results = []
    
    for test_case in test_configs:
        print(f"\nTesting: {test_case['name']}")
        print(f"Description: {test_case['description']}")
        print("-" * 40)
        
        sim = CFDSimulation(test_case['config'])
        
        # Run simulation steps
        stable = True
        max_vel_history = []
        dt_history = []
        divergence_history = []
        
        for step in range(test_case['config'].time_steps):
            try:
                sim.step()
                
                # Check for NaN or Inf
                if np.any(np.isnan(sim.u)) or np.any(np.isinf(sim.u)):
                    print(f"  ERROR: NaN or Inf detected in u at step {step}")
                    stable = False
                    break
                if np.any(np.isnan(sim.v)) or np.any(np.isinf(sim.v)):
                    print(f"  ERROR: NaN or Inf detected in v at step {step}")
                    stable = False
                    break
                if np.any(np.isnan(sim.p)) or np.any(np.isinf(sim.p)):
                    print(f"  ERROR: NaN or Inf detected in pressure at step {step}")
                    stable = False
                    break
                
                # Track metrics
                max_vel = np.max(np.sqrt(sim.u**2 + sim.v**2))
                divergence = np.mean(np.abs(
                    np.gradient(sim.u, sim.dx, axis=1) + 
                    np.gradient(sim.v, sim.dy, axis=0)
                ))
                
                max_vel_history.append(max_vel)
                dt_history.append(sim.dt)
                divergence_history.append(divergence)
                
                # Print progress every 20 steps
                if (step + 1) % 20 == 0:
                    print(f"  Step {step+1}/{test_case['config'].time_steps}: "
                          f"max_vel={max_vel:.3f}, dt={sim.dt:.6f}, "
                          f"divergence={divergence:.6f}")
                
            except Exception as e:
                print(f"  ERROR at step {step}: {str(e)}")
                stable = False
                break
        
        if stable:
            print(f"  ✓ Simulation completed successfully!")
            print(f"  Final max velocity: {max_vel_history[-1]:.3f}")
            print(f"  Average divergence: {np.mean(divergence_history):.6f}")
            print(f"  Average time step: {np.mean(dt_history):.6f}")
            if test_case['config'].use_adaptive_dt:
                print(f"  Time step range: [{np.min(dt_history):.6f}, {np.max(dt_history):.6f}]")
        else:
            print(f"  ✗ Simulation became unstable")
        
        results.append({
            "name": test_case['name'],
            "stable": stable,
            "final_max_vel": max_vel_history[-1] if max_vel_history else None,
            "avg_divergence": np.mean(divergence_history) if divergence_history else None
        })
    
    # Summary
    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    
    all_stable = all(r['stable'] for r in results)
    
    for result in results:
        status = "✓ STABLE" if result['stable'] else "✗ UNSTABLE"
        print(f"{result['name']:20s}: {status}")
        if result['stable'] and result['final_max_vel'] is not None:
            print(f"  - Final max velocity: {result['final_max_vel']:.3f}")
            print(f"  - Avg divergence: {result['avg_divergence']:.6f}")
    
    if all_stable:
        print("\n✓ All tests passed! The simulation is now stable.")
    else:
        print("\n✗ Some tests failed. Further investigation needed.")
    
    return all_stable

if __name__ == "__main__":
    success = test_cfd_stability()
    sys.exit(0 if success else 1)
