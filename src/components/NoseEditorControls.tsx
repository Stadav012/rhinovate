import { useState } from 'react';
import './NoseEditorControls.css';

interface NoseEditorControlsProps {
  isEditMode: boolean;
  setIsEditMode: (isEditMode: boolean) => void;
  resetNose: () => void;
  adjustNoseBridge: (amount: number) => void;
  adjustNoseTip: (amount: number) => void;
  adjustNostrilWidth: (amount: number) => void;
  selectedVertex: number | null;
  // Props for mesh visibility
  toggleMeshVisibility?: (region?: string) => void;
  anatomicalMeshVisible?: boolean;
}

const NoseEditorControls = ({
  isEditMode,
  setIsEditMode,
  resetNose,
  adjustNoseBridge,
  adjustNoseTip,
  adjustNostrilWidth,
  selectedVertex,
  toggleMeshVisibility,
  anatomicalMeshVisible = true,
}: NoseEditorControlsProps) => {
  const [bridgeValue, setBridgeValue] = useState(0);
  const [tipValue, setTipValue] = useState(0);
  const [nostrilValue, setNostrilValue] = useState(0);
  
  // State for mesh visibility toggles
  const [showAllMeshes, setShowAllMeshes] = useState(anatomicalMeshVisible);

  const handleBridgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setBridgeValue(value);
    adjustNoseBridge(value);
  };

  const handleTipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setTipValue(value);
    adjustNoseTip(value);
  };

  const handleNostrilChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setNostrilValue(value);
    adjustNostrilWidth(value);
  };

  const handleReset = () => {
    setBridgeValue(0);
    setTipValue(0);
    setNostrilValue(0);
    resetNose();
  };
  
  // Handle toggling all meshes
  const handleToggleAllMeshes = () => {
    const newValue = !showAllMeshes;
    setShowAllMeshes(newValue);
    if (toggleMeshVisibility) {
      // Toggle all meshes and update all region states
      toggleMeshVisibility();
      setRegionVisibility(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(key => {
          newState[key as keyof typeof prev] = newValue;
        });
        return newState;
      });
    }
  };

  // Add individual region toggles
  const [regionVisibility, setRegionVisibility] = useState({
    bridge: true,
    tip: true,
    leftNostril: true,
    rightNostril: true,
    leftSidewall: true,
    rightSidewall: true,
    columella: true
  });

  const handleToggleRegion = (region: string) => {
    if (toggleMeshVisibility) {
      // Update local state for the specific region
      const newRegionState = !regionVisibility[region as keyof typeof regionVisibility];
      setRegionVisibility(prev => ({
        ...prev,
        [region]: newRegionState
      }));
      
      // Call the toggle function with the region name
      toggleMeshVisibility(region);
      
      // Update showAllMeshes state based on all regions' visibility
      const allRegionsVisible = Object.values({ 
        ...regionVisibility, 
        [region]: newRegionState 
      }).every(visible => visible);
      setShowAllMeshes(allRegionsVisible);
    }
  };

  return (
    <div className="nose-editor-controls">
      <h2 className="controls-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 17v.5"></path>
          <path d="M10 5v.5"></path>
          <path d="M14 5v.5"></path>
          <path d="M7.3 10h9.4a2 2 0 0 1 1.7 3l-4.8 7H10.4a2 2 0 0 1-1.7-1l-4-6a2 2 0 0 1 0-2l4-6a2 2 0 0 1 1.7-1h7.4a2 2 0 0 1 1.7 1l4 6a2 2 0 0 1 0 2"></path>
        </svg>
        Nose Editor Controls
      </h2>
      
      <div className="controls-section edit-mode-section">
        <button
          className={`edit-mode-toggle ${isEditMode ? 'active' : ''}`}
          onClick={() => setIsEditMode(!isEditMode)}
        >
          {isEditMode ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Exit Edit Mode
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Enter Edit Mode
            </>
          )}
        </button>
        
        {isEditMode && (
          <div className="edit-mode-instructions">
            Click and drag on the nose to modify its shape
          </div>
        )}
      </div>

      {/* Mesh Visibility Section */}
      <div className="controls-section mesh-visibility-section">
        <h3 className="controls-section-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Mesh Visibility
        </h3>
        
        <div className="toggle-container">
          <label className="toggle-label">
            <span>Show All Meshes</span>
            <div className="toggle-switch-wrapper">
              <input
                type="checkbox"
                checked={showAllMeshes}
                onChange={handleToggleAllMeshes}
                className="toggle-switch-checkbox"
              />
              <div className={`toggle-switch ${showAllMeshes ? 'active' : ''}`}>
                <div className="toggle-switch-slider"></div>
              </div>
            </div>
          </label>
        </div>
        
        <div className="toggle-container">
          <label className="toggle-label">
            <span>Bridge</span>
            <div className="toggle-switch-wrapper">
              <input
                type="checkbox"
                checked={regionVisibility.bridge}
                onChange={() => handleToggleRegion('bridge')}
                className="toggle-switch-checkbox"
              />
              <div className={`toggle-switch ${regionVisibility.bridge ? 'active' : ''}`}>
                <div className="toggle-switch-slider"></div>
              </div>
            </div>
          </label>
        </div>
        
        <div className="toggle-container">
          <label className="toggle-label">
            <span>Tip</span>
            <div className="toggle-switch-wrapper">
              <input
                type="checkbox"
                checked={regionVisibility.tip}
                onChange={() => handleToggleRegion('tip')}
                className="toggle-switch-checkbox"
              />
              <div className={`toggle-switch ${regionVisibility.tip ? 'active' : ''}`}>
                <div className="toggle-switch-slider"></div>
              </div>
            </div>
          </label>
        </div>
        
        <div className="toggle-container">
          <label className="toggle-label">
            <span>Left Nostril</span>
            <div className="toggle-switch-wrapper">
              <input
                type="checkbox"
                checked={regionVisibility.leftNostril}
                onChange={() => handleToggleRegion('leftNostril')}
                className="toggle-switch-checkbox"
              />
              <div className={`toggle-switch ${regionVisibility.leftNostril ? 'active' : ''}`}>
                <div className="toggle-switch-slider"></div>
              </div>
            </div>
          </label>
        </div>
        
        <div className="toggle-container">
          <label className="toggle-label">
            <span>Right Nostril</span>
            <div className="toggle-switch-wrapper">
              <input
                type="checkbox"
                checked={regionVisibility.rightNostril}
                onChange={() => handleToggleRegion('rightNostril')}
                className="toggle-switch-checkbox"
              />
              <div className={`toggle-switch ${regionVisibility.rightNostril ? 'active' : ''}`}>
                <div className="toggle-switch-slider"></div>
              </div>
            </div>
          </label>
        </div>
        
        <div className="toggle-container">
          <label className="toggle-label">
            <span>Columella</span>
            <div className="toggle-switch-wrapper">
              <input
                type="checkbox"
                checked={regionVisibility.columella}
                onChange={() => handleToggleRegion('columella')}
                className="toggle-switch-checkbox"
              />
              <div className={`toggle-switch ${regionVisibility.columella ? 'active' : ''}`}>
                <div className="toggle-switch-slider"></div>
              </div>
            </div>
          </label>
        </div>
      </div>

      {selectedVertex !== null && (
        <div className="controls-section">
          <div className="selected-vertex-info">
            <span className="vertex-label">Selected Vertex:</span>
            <span className="vertex-id">{selectedVertex}</span>
          </div>
        </div>
      )}

      <div className="controls-section">
        <h3 className="controls-section-title">Rhinoplasty Adjustments</h3>
        
        <div className="slider-container">
          <div className="slider-label">
            <span className="slider-name">Bridge Height</span>
            <span className="slider-value">{bridgeValue.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={bridgeValue}
            onChange={handleBridgeChange}
            className="slider"
          />
        </div>
        
        <div className="slider-container">
          <div className="slider-label">
            <span className="slider-name">Tip Projection</span>
            <span className="slider-value">{tipValue.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={tipValue}
            onChange={handleTipChange}
            className="slider"
          />
        </div>
        
        <div className="slider-container">
          <div className="slider-label">
            <span className="slider-name">Nostril Width</span>
            <span className="slider-value">{nostrilValue.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={nostrilValue}
            onChange={handleNostrilChange}
            className="slider"
          />
        </div>
      </div>
      
      <div className="button-group">
        <button className="button button-danger" onClick={handleReset}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
          </svg>
          Reset Changes
        </button>
        <button className="button button-success">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Save Model
        </button>
      </div>
    </div>
  );
};

export default NoseEditorControls;