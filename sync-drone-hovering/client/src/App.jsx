import React, { useState } from 'react';
import OrbitEngine from './views/OrbitEngine';
import DroneHovering from './views/DroneHovering';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState('drone');
  
  return (
    <div className="App">
      <DroneHovering /> 
    </div>
  );
}

export default App;