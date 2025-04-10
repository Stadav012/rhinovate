import React, { useState, useEffect } from 'react';
import NoseEditor from './nose/NoseEditor';
import MarkerDensityControl from './ui/MarkerDensityControl';
import './SceneViewer.css';

const SceneViewer = ({ model, isEditMode, camera, scene }) => {
  // Force the marker density control to be visible in edit mode
  const [showControls, setShowControls] = useState(false);
  
  useEffect(() => {
    // Update showControls whenever isEditMode changes
    setShowControls(isEditMode);
    console.log('Edit mode is now:', isEditMode, 'showing controls:', isEditMode);
  }, [isEditMode]);

  return (
    <div id="scene-container">
      {/* Your 3D scene rendering code */}
      
      {/* Add the NoseEditor */}
      <NoseEditor 
        model={model} 
        isEditMode={isEditMode} 
        camera={camera} 
        scene={scene} 
      />
      
      {/* Always show the marker density control when in edit mode */}
      {showControls && <MarkerDensityControl />}
      
      {/* Debug indicator for edit mode */}
      {isEditMode && (
        <div className="edit-mode-indicator">
          Edit Mode Active - Click on the highlighted vertices to drag and modify the nose
        </div>
      )}
    </div>
  );
};

export default SceneViewer;