import { useState } from 'react';
import './App.css';
import ModelUploader from './components/ModelUploader';
import ModelViewer from './components/ModelViewer';
import { Group } from 'three';

function App() {
  const [model, setModel] = useState<Group | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleModelLoaded = (loadedModel: Group) => {
    setModel(loadedModel);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  return (
    <div className="app-container">
      <header>
        <h1>Rhinovate</h1>
        <p>3D Facial Model Visualization for Rhinoplasty Planning</p>
      </header>

      <main>
        <section className="upload-section">
          <h2>Upload 3D Model</h2>
          <ModelUploader onModelLoaded={handleModelLoaded} onError={handleError} />
          {error && <div className="error-message">{error}</div>}
        </section>

        <section className="viewer-section">
          <h2>3D Model Viewer</h2>
          {model ? (
            <ModelViewer model={model} />
          ) : (
            <div className="empty-viewer-placeholder">
              <p>Upload a 3D model to view it here</p>
            </div>
          )}
        </section>
      </main>

      <footer>
        <p>Rhinovate - Secure 3D Visualization for Medical Professionals</p>
      </footer>
    </div>
  );
}

export default App
