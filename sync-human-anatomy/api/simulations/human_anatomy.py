"""Human Anatomy Simulation Module.

This module manages physiological simulations and streams data to the frontend
via WebSocket connections.
"""

import asyncio
import json
import logging
import time
from typing import Dict, List, Optional, Any
from datetime import datetime
import numpy as np
from scipy import signal
from enum import Enum

logger = logging.getLogger(__name__)


class SimulationType(Enum):
    HEARTBEAT = "heartbeat"
    NERVE_IMPULSE = "nerve_impulse"
    RESPIRATORY = "respiratory"
    BLOOD_FLOW = "blood_flow"
    DIGESTION = "digestion"


class AnatomicalSystem(Enum):
    SKELETAL = "skeletal"
    MUSCULAR = "muscular"
    NERVOUS = "nervous"
    CIRCULATORY = "circulatory"
    RESPIRATORY = "respiratory"
    DIGESTIVE = "digestive"
    ENDOCRINE = "endocrine"
    IMMUNE = "immune"


class HumanAnatomySimulation:
    """Manages human anatomy simulations and physiological processes."""
    
    def __init__(self):
        self.is_running = False
        self.active_simulations: Dict[str, bool] = {}
        self.simulation_data: Dict[str, Any] = {}
        self.time_scale = 1.0
        self.start_time = None
        
        # Heart simulation parameters
        self.heart_rate = 70  # BPM
        self.heart_phase = 0
        
        # Nerve simulation parameters
        self.nerve_propagation_speed = 120  # m/s (approximate for myelinated fibers)
        self.nerve_segments = 50
        
        # Respiratory parameters
        self.respiratory_rate = 16  # breaths per minute
        self.respiratory_phase = 0
        
        # Blood flow parameters
        self.blood_pressure_systolic = 120
        self.blood_pressure_diastolic = 80
        
        logger.info("Human Anatomy Simulation initialized")
    
    async def initialize(self):
        """Initialize the simulation environment."""
        self.start_time = time.time()
        self.is_running = True
        logger.info("Simulation environment initialized")
    
    def get_simulation_time(self) -> float:
        """Get current simulation time in seconds."""
        if self.start_time is None:
            return 0
        return (time.time() - self.start_time) * self.time_scale
    
    async def start_simulation(self, simulation_type: SimulationType) -> Dict:
        """Start a specific physiological simulation."""
        self.active_simulations[simulation_type.value] = True
        logger.info(f"Started {simulation_type.value} simulation")
        return {
            "status": "started",
            "simulation": simulation_type.value,
            "timestamp": datetime.now().isoformat()
        }
    
    async def stop_simulation(self, simulation_type: SimulationType) -> Dict:
        """Stop a specific physiological simulation."""
        self.active_simulations[simulation_type.value] = False
        logger.info(f"Stopped {simulation_type.value} simulation")
        return {
            "status": "stopped",
            "simulation": simulation_type.value,
            "timestamp": datetime.now().isoformat()
        }
    
    def simulate_heartbeat(self, t: float) -> Dict:
        """Simulate cardiac electrical conduction system.
        
        Returns data representing the heart's electrical activity through:
        - SA node (sinoatrial) - natural pacemaker
        - AV node (atrioventricular) - delay center
        - Bundle of His
        - Purkinje fibers
        """
        # Calculate cardiac cycle position (0-1)
        cycle_duration = 60.0 / self.heart_rate  # seconds per beat
        cycle_position = (t % cycle_duration) / cycle_duration
        
        # Electrical conduction timing (as fraction of cycle)
        sa_node_time = 0.0
        av_node_time = 0.15
        bundle_his_time = 0.20
        purkinje_time = 0.25
        ventricle_contract_time = 0.30
        
        # Determine active component
        active_parts = []
        ecg_value = 0
        
        if cycle_position < av_node_time:
            active_parts.append("sa_node")
            # P wave
            ecg_value = 0.2 * np.sin(np.pi * (cycle_position / av_node_time))
        elif cycle_position < bundle_his_time:
            active_parts.append("av_node")
            # PR interval (flat)
            ecg_value = 0
        elif cycle_position < purkinje_time:
            active_parts.append("bundle_his")
            # Beginning of QRS complex
            ecg_value = -0.1
        elif cycle_position < ventricle_contract_time:
            active_parts.append("purkinje_fibers")
            # QRS complex peak
            ecg_value = 1.0 * np.sin(np.pi * ((cycle_position - purkinje_time) / (ventricle_contract_time - purkinje_time)))
        elif cycle_position < 0.45:
            active_parts.append("ventricles")
            # ST segment
            ecg_value = 0.1
        elif cycle_position < 0.60:
            # T wave
            ecg_value = 0.3 * np.sin(np.pi * ((cycle_position - 0.45) / 0.15))
        
        # Calculate heart metrics
        current_bpm = self.heart_rate + 5 * np.sin(0.1 * t)  # Add some variability
        
        return {
            "type": "heartbeat",
            "timestamp": t,
            "active_parts": active_parts,
            "ecg_value": ecg_value,
            "heart_rate": current_bpm,
            "cycle_position": cycle_position,
            "blood_pressure": {
                "systolic": self.blood_pressure_systolic + 5 * np.sin(0.2 * t),
                "diastolic": self.blood_pressure_diastolic + 3 * np.sin(0.2 * t)
            }
        }
    
    def simulate_nerve_impulse(self, t: float, nerve_path_id: str = "median_nerve") -> Dict:
        """Simulate action potential propagation along a nerve.
        
        Uses simplified Hodgkin-Huxley model for voltage changes.
        """
        # Calculate position along nerve based on propagation speed
        distance_traveled = self.nerve_propagation_speed * (t % 2.0)  # Reset every 2 seconds
        
        # Create voltage data for nerve segments
        segments_data = []
        for i in range(self.nerve_segments):
            segment_position = i * 2.0  # 2 meters of nerve length spread across segments
            
            # Calculate voltage based on action potential wave
            if abs(segment_position - distance_traveled) < 5:
                # Depolarization phase
                phase = 1 - abs(segment_position - distance_traveled) / 5
                voltage = -70 + 100 * phase  # From -70mV to +30mV
            elif abs(segment_position - distance_traveled) < 10:
                # Repolarization phase
                phase = (abs(segment_position - distance_traveled) - 5) / 5
                voltage = 30 - 110 * phase  # From +30mV to -80mV
            elif abs(segment_position - distance_traveled) < 15:
                # Hyperpolarization phase
                phase = (abs(segment_position - distance_traveled) - 10) / 5
                voltage = -80 + 10 * phase  # From -80mV to -70mV
            else:
                # Resting potential
                voltage = -70
            
            segments_data.append({
                "segment_id": f"{nerve_path_id}_seg_{i}",
                "position": segment_position,
                "voltage": voltage,
                "is_active": abs(segment_position - distance_traveled) < 5
            })
        
        return {
            "type": "nerve_impulse",
            "timestamp": t,
            "nerve_path": nerve_path_id,
            "propagation_position": distance_traveled,
            "segments": segments_data,
            "conduction_velocity": self.nerve_propagation_speed
        }
    
    def simulate_respiratory(self, t: float) -> Dict:
        """Simulate respiratory cycle (inhalation and exhalation)."""
        # Calculate breath cycle position
        cycle_duration = 60.0 / self.respiratory_rate
        cycle_position = (t % cycle_duration) / cycle_duration
        
        # Lung volume changes (sinusoidal pattern)
        # Tidal volume ~500ml, functional residual capacity ~2400ml
        lung_volume = 2400 + 250 * np.sin(2 * np.pi * cycle_position)
        
        # Diaphragm position (contracts during inhalation)
        diaphragm_position = -2 * np.sin(2 * np.pi * cycle_position)
        
        # Determine breathing phase
        if cycle_position < 0.4:
            phase = "inhalation"
            active_muscles = ["diaphragm", "external_intercostals"]
        elif cycle_position < 0.5:
            phase = "pause"
            active_muscles = []
        else:
            phase = "exhalation"
            active_muscles = ["internal_intercostals", "abdominal_muscles"]
        
        # O2 and CO2 levels (simplified)
        o2_saturation = 97 + 2 * np.sin(2 * np.pi * cycle_position)
        co2_level = 40 - 5 * np.sin(2 * np.pi * cycle_position)
        
        return {
            "type": "respiratory",
            "timestamp": t,
            "phase": phase,
            "cycle_position": cycle_position,
            "lung_volume": lung_volume,
            "diaphragm_position": diaphragm_position,
            "respiratory_rate": self.respiratory_rate,
            "active_muscles": active_muscles,
            "o2_saturation": o2_saturation,
            "co2_level": co2_level
        }
    
    def simulate_blood_flow(self, t: float) -> Dict:
        """Simulate blood flow through major vessels."""
        # Synchronize with heartbeat
        cycle_duration = 60.0 / self.heart_rate
        cycle_position = (t % cycle_duration) / cycle_duration
        
        # Calculate flow velocities in different vessels
        vessels = {
            "aorta": {
                "velocity": 120 * (0.5 + 0.5 * np.sin(2 * np.pi * cycle_position)),
                "pressure": self.blood_pressure_systolic * (0.7 + 0.3 * np.sin(2 * np.pi * cycle_position)),
                "diameter": 2.5  # cm
            },
            "pulmonary_artery": {
                "velocity": 60 * (0.5 + 0.5 * np.sin(2 * np.pi * cycle_position - np.pi/4)),
                "pressure": 25 * (0.7 + 0.3 * np.sin(2 * np.pi * cycle_position)),
                "diameter": 2.5
            },
            "carotid_artery": {
                "velocity": 80 * (0.5 + 0.5 * np.sin(2 * np.pi * cycle_position - np.pi/8)),
                "pressure": self.blood_pressure_systolic * (0.6 + 0.4 * np.sin(2 * np.pi * cycle_position)),
                "diameter": 0.7
            },
            "femoral_artery": {
                "velocity": 60 * (0.5 + 0.5 * np.sin(2 * np.pi * cycle_position - np.pi/6)),
                "pressure": self.blood_pressure_systolic * (0.5 + 0.5 * np.sin(2 * np.pi * cycle_position)),
                "diameter": 0.8
            }
        }
        
        return {
            "type": "blood_flow",
            "timestamp": t,
            "cycle_position": cycle_position,
            "vessels": vessels,
            "heart_output": 5.0 + 0.5 * np.sin(2 * np.pi * cycle_position),  # L/min
            "total_blood_volume": 5.0  # Liters
        }
    
    def simulate_digestion(self, t: float) -> Dict:
        """Simulate digestive system peristalsis and enzyme activity."""
        # Peristaltic waves (slower cycles)
        peristalsis_cycle = (t % 20) / 20  # 20 second cycles
        
        # Different segments of digestive tract
        segments = {
            "esophagus": {
                "wave_position": (peristalsis_cycle * 25) % 25,  # 25cm length
                "contraction_strength": 0.8
            },
            "stomach": {
                "wave_position": ((peristalsis_cycle + 0.2) * 30) % 30,
                "contraction_strength": 0.9,
                "ph_level": 2.0 + 0.5 * np.sin(0.1 * t),
                "enzyme_activity": {
                    "pepsin": 0.8 + 0.2 * np.sin(0.2 * t),
                    "gastric_lipase": 0.6 + 0.2 * np.sin(0.15 * t)
                }
            },
            "small_intestine": {
                "wave_position": ((peristalsis_cycle + 0.4) * 600) % 600,  # 6m length
                "contraction_strength": 0.6,
                "enzyme_activity": {
                    "amylase": 0.7 + 0.2 * np.sin(0.25 * t),
                    "lipase": 0.8 + 0.15 * np.sin(0.2 * t),
                    "protease": 0.75 + 0.2 * np.sin(0.3 * t)
                }
            },
            "large_intestine": {
                "wave_position": ((peristalsis_cycle + 0.6) * 150) % 150,  # 1.5m length
                "contraction_strength": 0.4,
                "water_absorption_rate": 0.6 + 0.2 * np.sin(0.05 * t)
            }
        }
        
        return {
            "type": "digestion",
            "timestamp": t,
            "peristalsis_cycle": peristalsis_cycle,
            "segments": segments,
            "motility_index": 0.7 + 0.3 * np.sin(0.1 * t)
        }
    
    async def get_simulation_state(self) -> Dict:
        """Get current state of all active simulations."""
        t = self.get_simulation_time()
        state = {
            "timestamp": t,
            "active_simulations": list(self.active_simulations.keys()),
            "data": {}
        }
        
        # Collect data from active simulations
        if self.active_simulations.get(SimulationType.HEARTBEAT.value):
            state["data"]["heartbeat"] = self.simulate_heartbeat(t)
        
        if self.active_simulations.get(SimulationType.NERVE_IMPULSE.value):
            state["data"]["nerve_impulse"] = self.simulate_nerve_impulse(t)
        
        if self.active_simulations.get(SimulationType.RESPIRATORY.value):
            state["data"]["respiratory"] = self.simulate_respiratory(t)
        
        if self.active_simulations.get(SimulationType.BLOOD_FLOW.value):
            state["data"]["blood_flow"] = self.simulate_blood_flow(t)
        
        if self.active_simulations.get(SimulationType.DIGESTION.value):
            state["data"]["digestion"] = self.simulate_digestion(t)
        
        return state
    
    def set_heart_rate(self, bpm: int):
        """Set the heart rate in beats per minute."""
        self.heart_rate = max(40, min(200, bpm))  # Clamp to reasonable range
        logger.info(f"Heart rate set to {self.heart_rate} BPM")
    
    def set_respiratory_rate(self, breaths_per_minute: int):
        """Set the respiratory rate."""
        self.respiratory_rate = max(8, min(30, breaths_per_minute))
        logger.info(f"Respiratory rate set to {self.respiratory_rate} breaths/min")
    
    def get_organ_info(self, organ_id: str) -> Dict:
        """Get detailed information about a specific organ."""
        organ_database = {
            "heart": {
                "name": "Heart",
                "system": "Circulatory",
                "function": "Pumps blood throughout the body, delivering oxygen and nutrients to tissues",
                "weight": "250-350 grams",
                "size": "About the size of a fist",
                "facts": [
                    "Beats about 100,000 times per day",
                    "Pumps about 5 liters of blood per minute",
                    "Has four chambers: two atria and two ventricles"
                ]
            },
            "lungs": {
                "name": "Lungs",
                "system": "Respiratory",
                "function": "Exchange oxygen and carbon dioxide between the air and blood",
                "weight": "1.3 kg (both lungs)",
                "size": "Fill most of the chest cavity",
                "facts": [
                    "Contain about 300 million alveoli",
                    "Process about 11,000 liters of air daily",
                    "The right lung has 3 lobes, the left has 2"
                ]
            },
            "brain": {
                "name": "Brain",
                "system": "Nervous",
                "function": "Controls all body functions, processes information, and enables consciousness",
                "weight": "1.3-1.4 kg",
                "size": "About 15 cm long",
                "facts": [
                    "Contains about 86 billion neurons",
                    "Uses 20% of the body's oxygen",
                    "Generates about 20 watts of power"
                ]
            },
            "liver": {
                "name": "Liver",
                "system": "Digestive",
                "function": "Filters blood, produces bile, stores nutrients, and detoxifies chemicals",
                "weight": "1.5 kg",
                "size": "Largest internal organ",
                "facts": [
                    "Performs over 500 functions",
                    "Can regenerate lost tissue",
                    "Filters 1.4 liters of blood per minute"
                ]
            },
            "kidneys": {
                "name": "Kidneys",
                "system": "Excretory",
                "function": "Filter waste from blood, regulate blood pressure, and produce urine",
                "weight": "125-170 grams each",
                "size": "About 12 cm long",
                "facts": [
                    "Filter about 180 liters of blood daily",
                    "Produce 1-2 liters of urine per day",
                    "Contain about 1 million nephrons each"
                ]
            },
            "stomach": {
                "name": "Stomach",
                "system": "Digestive",
                "function": "Breaks down food using acid and enzymes",
                "weight": "150 grams (empty)",
                "size": "Can expand to hold 1-1.5 liters",
                "facts": [
                    "Produces 2-3 liters of gastric juice daily",
                    "Has a pH of 1.5-3.5",
                    "Replaces its lining every 3-5 days"
                ]
            },
            "femur": {
                "name": "Femur",
                "system": "Skeletal",
                "function": "Supports body weight and enables walking and standing",
                "weight": "250-300 grams",
                "size": "Longest bone, about 26% of height",
                "facts": [
                    "Strongest bone in the body",
                    "Can support 30 times body weight",
                    "Contains red bone marrow that produces blood cells"
                ]
            }
        }
        
        return organ_database.get(organ_id, {
            "name": "Unknown Organ",
            "system": "Unknown",
            "function": "Information not available",
            "error": f"No information found for organ: {organ_id}"
        })
