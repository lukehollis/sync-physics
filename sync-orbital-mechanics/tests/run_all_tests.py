#!/usr/bin/env python
"""
Main test runner for Orbit Engine verification suite.
Runs all tests and generates comprehensive reports.
"""

import sys
import os
import unittest
import time
from datetime import datetime
import json

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def run_all_tests():
    """Run all test suites and generate reports."""
    
    print("="*70)
    print("ORBIT ENGINE VERIFICATION SUITE")
    print(f"Started at: {datetime.now().isoformat()}")
    print("="*70)
    print()
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test modules
    test_modules = [
        'test_planetary_positions',
        'test_trajectories',
        'test_nbody_integration',
        'test_performance',
    ]
    
    # Track overall results
    all_results = {
        'timestamp': datetime.now().isoformat(),
        'modules': {},
        'summary': {
            'total_tests': 0,
            'passed': 0,
            'failed': 0,
            'errors': 0
        }
    }
    
    # Run each test module
    for module_name in test_modules:
        print(f"\n{'='*70}")
        print(f"Running: {module_name}")
        print("="*70)
        
        try:
            # Import and run tests
            module = __import__(f'tests.{module_name}', fromlist=[''])
            module_suite = loader.loadTestsFromModule(module)
            
            # Run tests
            runner = unittest.TextTestRunner(verbosity=2)
            result = runner.run(module_suite)
            
            # Store results
            module_results = {
                'tests_run': result.testsRun,
                'failures': len(result.failures),
                'errors': len(result.errors),
                'success': result.wasSuccessful(),
                'duration': getattr(result, 'duration', 0)
            }
            
            all_results['modules'][module_name] = module_results
            all_results['summary']['total_tests'] += result.testsRun
            all_results['summary']['failed'] += len(result.failures)
            all_results['summary']['errors'] += len(result.errors)
            
        except Exception as e:
            print(f"ERROR: Failed to run {module_name}: {e}")
            all_results['modules'][module_name] = {
                'error': str(e),
                'success': False
            }
    
    # Calculate final summary
    all_results['summary']['passed'] = (
        all_results['summary']['total_tests'] - 
        all_results['summary']['failed'] - 
        all_results['summary']['errors']
    )
    
    all_results['summary']['success_rate'] = (
        all_results['summary']['passed'] / all_results['summary']['total_tests'] * 100
        if all_results['summary']['total_tests'] > 0 else 0
    )
    
    # Generate final report
    print("\n" + "="*70)
    print("FINAL SUMMARY")
    print("="*70)
    print(f"Total Tests: {all_results['summary']['total_tests']}")
    print(f"Passed: {all_results['summary']['passed']}")
    print(f"Failed: {all_results['summary']['failed']}")
    print(f"Errors: {all_results['summary']['errors']}")
    print(f"Success Rate: {all_results['summary']['success_rate']:.1f}%")
    
    # Save summary report
    report_dir = "tests/reports"
    os.makedirs(report_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    summary_file = os.path.join(report_dir, f"summary_{timestamp}.json")
    
    with open(summary_file, 'w') as f:
        json.dump(all_results, f, indent=2)
    
    print(f"\nSummary report saved to: {summary_file}")
    
    # Return exit code
    if all_results['summary']['failed'] > 0 or all_results['summary']['errors'] > 0:
        return 1
    return 0


if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
