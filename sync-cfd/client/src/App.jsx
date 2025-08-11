import React, { useState } from 'react';
import OrbitEngine from './views/OrbitEngine';
import CFD from './views/CFD';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState('orbit');

  return (
    <div className="App">
      <CFD />
    </div>
  );
}

export default App;