import React, { useState, useEffect } from 'react';

const MarkerDensityControl: React.FC = () => {
  const [density, setDensity] = useState<'low' | 'medium' | 'high'>('low');
  const [visible, setVisible] = useState(false);

  // Check for edit mode changes and update visibility
  useEffect(() => {
    const checkEditMode = () => {
      // @ts-ignore
      const isEditActive = window.globalEditMode === true;
      setVisible(isEditActive);
      
      // @ts-ignore
      if (window.noseEditor && window.noseEditor._currentDensity) {
        // @ts-ignore
        setDensity(window.noseEditor._currentDensity);
      }
    };
    
    // Initial check
    checkEditMode();
    
    // Set up interval to check for changes
    const intervalId = setInterval(checkEditMode, 100);
    
    return () => clearInterval(intervalId);
  }, []);

  // Update the marker density when the slider changes
  const handleDensityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    const newDensity = value === 1 ? 'low' : value === 2 ? 'medium' : 'high';
    setDensity(newDensity);
    
    // Call the global function if it exists
    // @ts-ignore
    if (window.noseEditor && window.noseEditor.setMarkerDensity) {
      console.log('MarkerDensityControl: Setting density to', newDensity);
      // @ts-ignore
      window.noseEditor.setMarkerDensity(newDensity);
    } else {
      console.warn('MarkerDensityControl: window.noseEditor.setMarkerDensity is not available');
    }
  };

  // Don't render anything if not visible
  if (!visible) return null;

  return (
    <div className="info-section">
      <h3 className="info-title">Marker Density</h3>
      <div className="slider-container">
        <input 
          type="range" 
          min="1" 
          max="3" 
          value={density === 'low' ? 1 : density === 'medium' ? 2 : 3} 
          onChange={handleDensityChange} 
          className="slider"
        />
        <div className="density-value">{density}</div>
      </div>
      <div className="density-labels">
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
      </div>
    </div>
  );
};

export default MarkerDensityControl;