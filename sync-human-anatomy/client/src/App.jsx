import React, { useState } from 'react';
import OrbitEngine from './views/OrbitEngine';
import HumanAnatomy from './views/HumanAnatomy';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState('anatomy');

  return (
    <div className="App">
      <HumanAnatomy /> 
    </div>
  );
}

export default App;