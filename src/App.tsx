// NOTE: App entry point — minimal setup for now
// TODO: Refactor structure when adding routing or more components
import React from 'react';
import Map from './components/Map';

function App() {
  console.log("App loaded"); // debug log
  return (
    <div>
      <h1>bike-route-map</h1>
      <Map />
    </div>
  );
}

export default App;
