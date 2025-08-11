#!/usr/bin/env python3
"""
Script to analyze and visualize celestial body position logs.
"""

import json
import os
import sys
import numpy as np
from datetime import datetime
from typing import Dict, List


def load_log_file(filepath: str) -> Dict:
    """Load a single log file."""
    with open(filepath, 'r') as f:
        return json.load(f)


def analyze_log_file(filepath: str):
    """Analyze a single log file and print statistics."""
    data = load_log_file(filepath)
    metadata = data['metadata']
    timesteps = data['data']
    
    print(f"\n{'='*60}")
    print(f"Log File: {os.path.basename(filepath)}")
    print(f"{'='*60}")
    print(f"Total timesteps: {metadata['total_timesteps']}")
    print(f"Start time: {metadata['start_time']:.2f} seconds")
    print(f"End time: {metadata['end_time']:.2f} seconds")
    print(f"Duration: {metadata['end_time'] - metadata['start_time']:.2f} seconds")
    print(f"Epoch: {metadata['epoch']}")
    print(f"File number: {metadata['file_number']}")
    
    if timesteps:
        # Analyze first and last timestep
        first_step = timesteps[0]
        last_step = timesteps[-1]
        
        print(f"\nFirst timestep:")
        print(f"  - Timestep #: {first_step['timestep']}")
        print(f"  - Simulation time: {first_step['timestamp']:.2f} seconds")
        print(f"  - Real time: {first_step['real_time']}")
        print(f"  - Time scale: {first_step['time_scale']}")
        
        print(f"\nLast timestep:")
        print(f"  - Timestep #: {last_step['timestep']}")
        print(f"  - Simulation time: {last_step['timestamp']:.2f} seconds")
        print(f"  - Real time: {last_step['real_time']}")
        print(f"  - Time scale: {last_step['time_scale']}")
        
        # Analyze body positions
        print(f"\nCelestial bodies tracked:")
        for body_name in first_step['bodies'].keys():
            first_pos = first_step['bodies'][body_name]['position_au']
            last_pos = last_step['bodies'][body_name]['position_au']
            
            # Calculate distance traveled
            distance = np.linalg.norm(np.array(last_pos) - np.array(first_pos))
            
            print(f"  {body_name.capitalize()}:")
            print(f"    - First position (AU): [{first_pos[0]:.3f}, {first_pos[1]:.3f}, {first_pos[2]:.3f}]")
            print(f"    - Last position (AU):  [{last_pos[0]:.3f}, {last_pos[1]:.3f}, {last_pos[2]:.3f}]")
            print(f"    - Distance traveled: {distance:.3f} AU")


def analyze_all_logs(log_directory: str = "simulation_logs"):
    """Analyze all log files in the directory."""
    if not os.path.exists(log_directory):
        print(f"Log directory '{log_directory}' does not exist.")
        return
    
    log_files = sorted([f for f in os.listdir(log_directory) if f.endswith('.json')])
    
    if not log_files:
        print(f"No log files found in '{log_directory}'.")
        return
    
    print(f"\nFound {len(log_files)} log file(s) in '{log_directory}'")
    
    total_timesteps = 0
    total_duration = 0
    
    for log_file in log_files:
        filepath = os.path.join(log_directory, log_file)
        analyze_log_file(filepath)
        
        # Accumulate totals
        data = load_log_file(filepath)
        metadata = data['metadata']
        total_timesteps += metadata['total_timesteps']
        total_duration += metadata['end_time'] - metadata['start_time']
    
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"Total log files: {len(log_files)}")
    print(f"Total timesteps logged: {total_timesteps}")
    print(f"Total simulation time: {total_duration:.2f} seconds")
    print(f"Average timesteps per file: {total_timesteps / len(log_files):.1f}")


def extract_trajectory(body_name: str, log_directory: str = "simulation_logs") -> List[List[float]]:
    """Extract the complete trajectory of a specific body from all log files."""
    trajectory = []
    
    log_files = sorted([f for f in os.listdir(log_directory) if f.endswith('.json')])
    
    for log_file in log_files:
        filepath = os.path.join(log_directory, log_file)
        data = load_log_file(filepath)
        
        for timestep in data['data']:
            if body_name.lower() in timestep['bodies']:
                position = timestep['bodies'][body_name.lower()]['position_au']
                trajectory.append(position)
    
    return trajectory


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Analyze celestial body position logs')
    parser.add_argument('--file', type=str, help='Analyze a specific log file')
    parser.add_argument('--body', type=str, help='Extract trajectory for a specific body')
    parser.add_argument('--dir', type=str, default='simulation_logs', help='Log directory (default: simulation_logs)')
    
    args = parser.parse_args()
    
    if args.file:
        analyze_log_file(args.file)
    elif args.body:
        trajectory = extract_trajectory(args.body, args.dir)
        print(f"\nExtracted {len(trajectory)} positions for {args.body}")
        if trajectory:
            print(f"First position: {trajectory[0]}")
            print(f"Last position: {trajectory[-1]}")
    else:
        analyze_all_logs(args.dir)
