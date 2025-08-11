import React from 'react';

// Time control component
export function TimeControls({ isPlaying, timeScale, onPlayPause, onSpeedChange }) {
  const speedOptions = [
    { value: 1, label: '1x' },
    { value: 10, label: '10x' },
    { value: 100, label: '100x' },
    { value: 1000, label: '1,000x' },
    { value: 10000, label: '10,000x' },
    { value: 100000, label: '100,000x' },
    { value: 1000000, label: '1M x' }
  ];
  
  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-white text-lg mb-3">Time Controls</h3>
      
      <div className="flex items-center space-x-4">
        <button
          onClick={onPlayPause}
          className={`px-6 py-2 rounded font-semibold transition-colors ${
            isPlaying 
              ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        
        <div className="flex items-center space-x-2">
          <label className="text-gray-300">Speed:</label>
          <select
            value={timeScale}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600"
          >
            {speedOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="mt-3 text-gray-400 text-sm">
        Current Speed: {timeScale >= 1000000 ? `${timeScale/1000000}M` : timeScale >= 1000 ? `${timeScale/1000}K` : timeScale}x real-time
      </div>
    </div>
  );
}

// Body information panel
export function BodyInfoPanel({ body, onClose }) {
  if (!body) return null;
  
  const formatNumber = (num) => {
    if (typeof num === 'number') {
      if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
      if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
      if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
      return num.toFixed(2);
    }
    return 'N/A';
  };
  
  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white text-lg font-bold">{body.name}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-2 text-gray-300 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-gray-500">Mass:</span>
            <div className="text-white">{formatNumber(body.mass)} kg</div>
          </div>
          <div>
            <span className="text-gray-500">Radius:</span>
            <div className="text-white">{formatNumber(body.radius)} m</div>
          </div>
        </div>
        
        {body.semi_major_axis && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">Orbit Radius:</span>
              <div className="text-white">{formatNumber(body.semi_major_axis / 1.496e11)} AU</div>
            </div>
            <div>
              <span className="text-gray-500">Orbital Period:</span>
              <div className="text-white">{formatNumber(body.orbital_period)} days</div>
            </div>
          </div>
        )}
        
        {body.eccentricity !== undefined && (
          <div>
            <span className="text-gray-500">Eccentricity:</span>
            <div className="text-white">{body.eccentricity.toFixed(3)}</div>
          </div>
        )}
        
        {body.position && (
          <div>
            <span className="text-gray-500">Position (AU):</span>
            <div className="text-white text-xs font-mono">
              [{body.position[0].toFixed(3)}, {body.position[1].toFixed(3)}, {body.position[2].toFixed(3)}]
            </div>
          </div>
        )}
        
        {body.velocity && (
          <div>
            <span className="text-gray-500">Velocity (m/s):</span>
            <div className="text-white text-xs font-mono">
              [{formatNumber(body.velocity[0])}, {formatNumber(body.velocity[1])}, {formatNumber(body.velocity[2])}]
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Mission status panel
export function MissionPanel({ missions }) {
  if (!missions || missions.length === 0) return null;
  
  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-white text-lg mb-3">Active Missions</h3>
      
      <div className="space-y-3">
        {missions.map(mission => (
          <div key={mission.id} className="bg-gray-700 p-3 rounded">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white font-semibold">{mission.id}</span>
              <span className={`px-2 py-1 rounded text-xs ${
                mission.status === 'active' ? 'bg-green-600 text-white' :
                mission.status === 'completed' ? 'bg-blue-600 text-white' :
                'bg-gray-600 text-gray-300'
              }`}>
                {mission.status}
              </span>
            </div>
            
            <div className="text-gray-300 text-sm space-y-1">
              <div>Route: {mission.departure} → {mission.arrival}</div>
              <div>Progress: {((mission.progress || 0) * 100).toFixed(1)}%</div>
              <div>ΔV: {mission.delta_v?.toFixed(2)} km/s</div>
            </div>
            
            {mission.status === 'active' && (
              <div className="mt-2">
                <div className="bg-gray-600 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${(mission.progress || 0) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Simulation info panel
export function SimulationInfo({ timestamp, realTime }) {
  const formatSimTime = (seconds) => {
    const date = new Date(Date.UTC(2024, 0, 1)); // Epoch: Jan 1, 2024
    date.setSeconds(date.getSeconds() + seconds);
    return date.toISOString().replace('T', ' ').slice(0, -5);
  };
  
  return (
    <div className="bg-gray-800 p-3 rounded-lg">
      <div className="text-gray-300 text-sm space-y-1">
        <div>
          <span className="text-gray-500">Simulation Time:</span>
          <div className="text-white font-mono">{formatSimTime(timestamp || 0)}</div>
        </div>
        <div>
          <span className="text-gray-500">Real Time:</span>
          <div className="text-white font-mono">{new Date(realTime || Date.now()).toLocaleTimeString()}</div>
        </div>
      </div>
    </div>
  );
}
