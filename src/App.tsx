import React, { useState, useEffect } from 'react';
import './App.css';
import ModelUploader from './components/ModelUploader';
import ModelViewer from './components/ModelViewer';
import { Group } from 'three';
import SceneViewer from './components/SceneViewer';
import NoseEditor from './components/nose/NoseEditor';
import MarkerDensityControl from './components/ui/MarkerDensityControl';
import EditModeSync from './components/EditModeSync';
import DebugPanel from './components/DebugPanel';

function App() {
  const [model, setModel] = useState<Group | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Expose the setIsEditMode function globally
  useEffect(() => {
    // @ts-ignore
    window.setGlobalEditMode = (mode: boolean) => {
      setIsEditMode(mode);
    };
    
    // Check for global edit mode changes
    const checkEditMode = () => {
      // @ts-ignore
      if (window.globalEditMode !== undefined && window.globalEditMode !== isEditMode) {
        setIsEditMode(window.globalEditMode);
      }
    };
    
    const intervalId = setInterval(checkEditMode, 100);
    
    return () => {
      clearInterval(intervalId);
      // @ts-ignore
      delete window.setGlobalEditMode;
    };
  }, [isEditMode]);

  const handleModelLoaded = (loadedModel: Group) => {
    setModel(loadedModel);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };
  
  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1 className="app-title">Rhinovate</h1>
          <p className="app-subtitle">Advanced Rhinoplasty Visualization Tool</p>
        </div>
      </header>
  
      <main className="main-content">
        <div className="model-section">
          {model ? (
            <ModelViewer model={model} />
          ) : (
            <ModelUploader onModelLoaded={handleModelLoaded} onError={handleError} />
          )}
          
          {error && (
            <div className="error-message">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {error}
            </div>
          )}
        </div>
        
        {model && (
          <div className="info-panel">
            <div className="info-section">
              <h3 className="info-title">Model Information</h3>
              <div className="info-content">
                <div className="info-item">
                  <span className="info-label">Vertices:</span>
                  <span className="info-value">{model ? countVertices(model) : 0}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Meshes:</span>
                  <span className="info-value">{model ? countMeshes(model) : 0}</span>
                </div>
              </div>
            </div>
            
            {/* Add the marker density control - it will only show when edit mode is active */}
            <MarkerDensityControl />
            
            <div className="actions-section">
              <button 
                className="button button-secondary"
                onClick={() => setModel(null)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Upload New Model
              </button>
            </div>
          </div>
        )}
      </main>
  
      <footer>
        <p>Rhinovate &copy; {new Date().getFullYear()} - Advanced Rhinoplasty Visualization Tool</p>
      </footer>
      
      {/* Add the DebugPanel component */}
      <DebugPanel />
    </div>
  );
}

// Helper function to count vertices in the model
function countVertices(model: Group): number {
  let count = 0;
  model.traverse((child: any) => {
    if (child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
      count += child.geometry.attributes.position.count;
    }
  });
  return count;
}

// Helper function to count meshes in the model
function countMeshes(model: Group): number {
  let count = 0;
  model.traverse((child: any) => {
    if (child.isMesh) {
      count++;
    }
  });
  return count;
}

export default App;
