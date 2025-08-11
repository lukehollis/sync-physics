import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

// Porkchop plot component
function PorkchopPlot({ data, onSelectPoint }) {
  const [selectedPoint, setSelectedPoint] = useState(null);
  
  if (!data || !data.c3) return null;
  
  const handleCellClick = (i, j) => {
    const depDate = data.departure_dates[i];
    const arrDate = data.arrival_dates[j];
    const c3 = data.c3[i][j];
    const deltaV = data.delta_v[i][j];
    const tof = data.time_of_flight[i][j];
    
    // Don't select invalid transfers
    if (c3 == null || deltaV == null || tof == null) {
      return;
    }
    
    setSelectedPoint({ i, j });
    onSelectPoint({
      departure_date: depDate,
      arrival_date: arrDate,
      c3,
      delta_v: deltaV,
      time_of_flight: tof
    });
  };
  
  // Find min and max values for color scaling
  const flatC3 = data.c3.flat().filter(v => v != null && !isNaN(v));
  const minC3 = flatC3.length > 0 ? Math.min(...flatC3) : 0;
  const maxC3 = flatC3.length > 0 ? Math.max(...flatC3) : 100;
  
  const getColor = (value) => {
    if (value == null || isNaN(value)) return '#333333';
    const normalized = (value - minC3) / (maxC3 - minC3);
    // Blue (low) to Red (high) gradient
    const r = Math.floor(normalized * 255);
    const b = Math.floor((1 - normalized) * 255);
    return `rgb(${r}, 0, ${b})`;
  };
  
  return (
    <div className="porkchop-container">
      <h3 className="text-white text-lg mb-2">Porkchop Plot - C₃ Energy (km²/s²)</h3>
      <div className="relative">
        <div 
          className="grid gap-0 border border-gray-600"
          style={{
            gridTemplateColumns: `repeat(${data.c3[0].length}, 1fr)`,
            width: '100%',
            aspectRatio: '1'
          }}
        >
          {data.c3.map((row, i) => 
            row.map((value, j) => (
              <div
                key={`${i}-${j}`}
                className="cursor-pointer hover:opacity-80 border border-gray-800"
                style={{
                  backgroundColor: getColor(value),
                  border: selectedPoint?.i === i && selectedPoint?.j === j ? '2px solid white' : undefined
                }}
                onClick={() => handleCellClick(i, j)}
                title={value != null ? `C₃: ${value.toFixed(2)} km²/s²` : 'Invalid transfer'}
              />
            ))
          )}
        </div>
        
        {/* Axis labels */}
        <div className="text-white text-xs mt-2">
          <div>Departure: {format(new Date(data.departure_dates[0]), 'MMM dd, yyyy')} - {format(new Date(data.departure_dates[data.departure_dates.length - 1]), 'MMM dd, yyyy')}</div>
          <div>Arrival: {format(new Date(data.arrival_dates[0]), 'MMM dd, yyyy')} - {format(new Date(data.arrival_dates[data.arrival_dates.length - 1]), 'MMM dd, yyyy')}</div>
        </div>
        
        {/* Color scale legend */}
        <div className="mt-4 flex items-center justify-between text-white text-xs">
          <span>Low Energy: {minC3.toFixed(1)}</span>
          <div className="flex-1 mx-4 h-4 bg-gradient-to-r from-blue-600 to-red-600"></div>
          <span>High Energy: {maxC3.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

// Transfer result display
function TransferResult({ result, onLaunch }) {
  if (!result) return null;
  
  return (
    <div className="bg-gray-800 p-4 rounded-lg mt-4">
      <h3 className="text-white text-lg mb-3">Transfer Details</h3>
      <div className="space-y-2 text-gray-300">
        <div className="flex justify-between">
          <span>Departure:</span>
          <span>{result.departure_date ? format(new Date(result.departure_date), 'MMM dd, yyyy HH:mm') : 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span>Arrival:</span>
          <span>{result.arrival_date ? format(new Date(result.arrival_date), 'MMM dd, yyyy HH:mm') : 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span>Flight Time:</span>
          <span>{result.time_of_flight?.toFixed(1)} days</span>
        </div>
        <div className="flex justify-between">
          <span>Total ΔV:</span>
          <span>{result.delta_v?.toFixed(2)} km/s</span>
        </div>
        <div className="flex justify-between">
          <span>C₃ Energy:</span>
          <span>{result.c3?.toFixed(2)} km²/s²</span>
        </div>
      </div>
      
      <button
        onClick={() => onLaunch(result)}
        className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors"
      >
        Launch Mission
      </button>
    </div>
  );
}

// Main trajectory planner component
export default function TrajectoryPlanner({ isOpen, onClose, onLaunchMission }) {
  const [departure, setDeparture] = useState('earth');
  const [arrival, setArrival] = useState('mars');
  const [departureStart, setDepartureStart] = useState('');
  const [departureEnd, setDepartureEnd] = useState('');
  const [arrivalStart, setArrivalStart] = useState('');
  const [arrivalEnd, setArrivalEnd] = useState('');
  const [porkchopData, setPorkchopData] = useState(null);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  
  // Set default dates
  useEffect(() => {
    const today = new Date();
    const sixMonths = new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000);
    const oneYear = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
    const twoYears = new Date(today.getTime() + 730 * 24 * 60 * 60 * 1000);
    
    setDepartureStart(today.toISOString().split('T')[0]);
    setDepartureEnd(sixMonths.toISOString().split('T')[0]);
    setArrivalStart(oneYear.toISOString().split('T')[0]);
    setArrivalEnd(twoYears.toISOString().split('T')[0]);
  }, []);
  
  const planets = [
    'mercury', 'venus', 'earth', 'mars',
    'jupiter', 'saturn', 'uranus', 'neptune'
  ];
  
  const calculatePorkchop = async () => {
    setIsCalculating(true);
    try {
      const response = await fetch('http://localhost:8000/api/trajectory/porkchop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departure,
          arrival,
          departure_start: departureStart + 'T00:00:00',
          departure_end: departureEnd + 'T00:00:00',
          arrival_start: arrivalStart + 'T00:00:00',
          arrival_end: arrivalEnd + 'T00:00:00'
        })
      });
      
      const data = await response.json();
      setPorkchopData(data);
    } catch (error) {
      console.error('Error calculating porkchop plot:', error);
    } finally {
      setIsCalculating(false);
    }
  };
  
  const calculateTransfer = async (point) => {
    try {
      const response = await fetch('http://localhost:8000/api/trajectory/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departure,
          arrival,
          departure_date: point.departure_date,
          arrival_date: point.arrival_date
        })
      });
      
      const data = await response.json();
      setSelectedTransfer({
        ...data,
        ...point
      });
    } catch (error) {
      console.error('Error calculating transfer:', error);
    }
  };
  
  const handleLaunchMission = async (transfer) => {
    try {
      const response = await fetch('http://localhost:8000/api/mission/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transfer_data: transfer
        })
      });
      
      const mission = await response.json();
      onLaunchMission(mission);
      onClose();
    } catch (error) {
      console.error('Error launching mission:', error);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed top-48 left-0 w-40vw p-4 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-6xl h-90vh overflow-y-scroll">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white text-2xl font-bold">Trajectory Planner</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input controls */}
          <div className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2">Departure Body</label>
              <select
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
                className="w-full bg-gray-800 text-white p-2 rounded border border-gray-600"
              >
                {planets.map(planet => (
                  <option key={planet} value={planet}>
                    {planet.charAt(0).toUpperCase() + planet.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-gray-300 mb-2">Arrival Body</label>
              <select
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
                className="w-full bg-gray-800 text-white p-2 rounded border border-gray-600"
              >
                {planets.filter(p => p !== departure).map(planet => (
                  <option key={planet} value={planet}>
                    {planet.charAt(0).toUpperCase() + planet.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Departure Start</label>
                <input
                  type="date"
                  value={departureStart}
                  onChange={(e) => setDepartureStart(e.target.value)}
                  className="w-full bg-gray-800 text-white p-2 rounded border border-gray-600"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Departure End</label>
                <input
                  type="date"
                  value={departureEnd}
                  onChange={(e) => setDepartureEnd(e.target.value)}
                  className="w-full bg-gray-800 text-white p-2 rounded border border-gray-600"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Arrival Start</label>
                <input
                  type="date"
                  value={arrivalStart}
                  onChange={(e) => setArrivalStart(e.target.value)}
                  className="w-full bg-gray-800 text-white p-2 rounded border border-gray-600"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Arrival End</label>
                <input
                  type="date"
                  value={arrivalEnd}
                  onChange={(e) => setArrivalEnd(e.target.value)}
                  className="w-full bg-gray-800 text-white p-2 rounded border border-gray-600"
                />
              </div>
            </div>
            
            <button
              onClick={calculatePorkchop}
              disabled={isCalculating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
            >
              {isCalculating ? 'Calculating...' : 'Calculate Transfer Windows'}
            </button>
            
            {/* Transfer result */}
            <TransferResult
              result={selectedTransfer}
              onLaunch={handleLaunchMission}
            />
          </div>
          
          {/* Porkchop plot */}
          <div>
            <PorkchopPlot
              data={porkchopData}
              onSelectPoint={calculateTransfer}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
