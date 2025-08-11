#!/usr/bin/env python
"""
Quick verification script to check that the test suite is properly set up.
Run this to verify the tests can execute without running the full suite.
"""

import sys
import os
import importlib.util

def verify_test_setup():
    """Verify that all test modules can be imported and basic functionality works."""
    
    print("="*60)
    print("ORBIT ENGINE TEST VERIFICATION")
    print("="*60)
    print()
    
    # Check Python version
    print(f"Python version: {sys.version}")
    if sys.version_info < (3, 8):
        print("⚠️  Warning: Python 3.8+ recommended")
    print()
    
    # Check required modules
    required_modules = ['numpy', 'unittest', 'datetime', 'json', 'os']
    optional_modules = ['scipy', 'matplotlib', 'pytest', 'psutil']
    
    print("Checking required modules:")
    for module in required_modules:
        try:
            __import__(module)
            print(f"  ✓ {module}")
        except ImportError:
            print(f"  ✗ {module} - REQUIRED")
            return False
    print()
    
    print("Checking optional modules:")
    for module in optional_modules:
        try:
            __import__(module)
            print(f"  ✓ {module}")
        except ImportError:
            print(f"  ⚠ {module} - Optional, some tests may not work")
    print()
    
    # Check test modules can be imported
    test_modules = [
        'tests.test_utils',
        'tests.test_planetary_positions',
        'tests.test_trajectories', 
        'tests.test_nbody_integration',
        'tests.test_performance',
    ]
    
    print("Checking test modules:")
    for module_name in test_modules:
        try:
            # Try to import the module
            parts = module_name.split('.')
            file_path = os.path.join(*parts) + '.py'
            
            if os.path.exists(file_path):
                spec = importlib.util.spec_from_file_location(module_name, file_path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                print(f"  ✓ {module_name}")
            else:
                print(f"  ✗ {module_name} - File not found")
                
        except Exception as e:
            print(f"  ✗ {module_name} - Error: {str(e)[:50]}")
    print()
    
    # Check if orbital mechanics module exists
    print("Checking simulation modules:")
    try:
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from api.simulations import orbital_mechanics
        print(f"  ✓ api.simulations.orbital_mechanics")
        
        # Quick test of basic functionality
        from api.simulations.orbital_mechanics import SOLAR_SYSTEM_BODIES, kepler_to_cartesian
        
        earth = SOLAR_SYSTEM_BODIES.get('earth')
        if earth:
            pos, vel = kepler_to_cartesian(earth, 0)
            print(f"  ✓ Basic calculation test passed")
            print(f"    Earth position: [{pos[0]/1e11:.2f}, {pos[1]/1e11:.2f}, {pos[2]/1e11:.2f}] AU")
        else:
            print(f"  ⚠ Could not find Earth in SOLAR_SYSTEM_BODIES")
            
    except ImportError as e:
        print(f"  ✗ api.simulations.orbital_mechanics - {e}")
        print("  Make sure you're running from the project root directory")
        return False
    except Exception as e:
        print(f"  ✗ Error testing orbital mechanics: {e}")
        return False
    print()
    
    # Check report directory
    print("Checking directories:")
    dirs_to_check = ['tests', 'tests/reports', 'tests/validation_reports']
    for dir_path in dirs_to_check:
        if os.path.exists(dir_path):
            print(f"  ✓ {dir_path}")
        else:
            print(f"  ⚠ {dir_path} - Will be created when tests run")
            os.makedirs(dir_path, exist_ok=True)
    print()
    
    # Run a minimal test
    print("Running minimal test:")
    try:
        from tests.test_utils import calculate_position_error
        import numpy as np
        
        pos1 = np.array([1.0, 0.0, 0.0])
        pos2 = np.array([1.1, 0.0, 0.0])
        error = calculate_position_error(pos1, pos2)
        
        if abs(error - 0.1) < 1e-10:
            print(f"  ✓ Test utility function works correctly")
            print(f"    Position error calculation: {error:.3f}")
        else:
            print(f"  ✗ Test utility function gave unexpected result: {error}")
            return False
            
    except Exception as e:
        print(f"  ✗ Could not run minimal test: {e}")
        return False
    
    print()
    print("="*60)
    print("VERIFICATION COMPLETE")
    print("="*60)
    print()
    print("✅ Test suite is properly configured and ready to run!")
    print()
    print("To run the full test suite:")
    print("  python tests/run_all_tests.py")
    print()
    print("To run individual test modules:")
    print("  python -m unittest tests.test_planetary_positions")
    print("  python -m unittest tests.test_trajectories")
    print("  python -m unittest tests.test_nbody_integration")
    print("  python -m unittest tests.test_performance")
    print()
    
    return True


if __name__ == "__main__":
    success = verify_test_setup()
    sys.exit(0 if success else 1)
