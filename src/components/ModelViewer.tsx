import { useRef, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Environment } from '@react-three/drei';
import { Group, Mesh, MeshStandardMaterial, BufferGeometry, Box3, Vector3, PerspectiveCamera as ThreePerspectiveCamera } from 'three';
import NoseEditor from './NoseEditor';
import NoseEditorControls from './NoseEditorControls';

interface ModelViewerProps {
  model: Group | null;
}

// This component will be rendered inside the Canvas
const NoseEditorWrapper = ({ model, isEditMode, setNoseEditorFunctions }: { 
  model: Group | null, 
  isEditMode: boolean,
  setNoseEditorFunctions: (functions: any) => void
}) => {
  const { camera, scene } = useThree();
  
  useEffect(() => {
    // Wait for the NoseEditor to initialize and expose its functions
    const checkForNoseEditor = () => {
      // @ts-ignore
      if (window.noseEditor) {
        console.log('ModelViewer: Found noseEditor functions', window.noseEditor);
        // @ts-ignore
        setNoseEditorFunctions(window.noseEditor);
      } else {
        console.log('ModelViewer: Waiting for noseEditor functions...');
        setTimeout(checkForNoseEditor, 100);
      }
    };
    
    checkForNoseEditor();
    
    return () => {
      // Clean up
      // @ts-ignore
      if (window.noseEditor) {
        // @ts-ignore
        window.noseEditor = null;
      }
    };
  }, [setNoseEditorFunctions]);
  
  return (
    <NoseEditor 
      model={model} 
      isEditMode={isEditMode} 
      camera={camera} 
      scene={scene} 
    />
  );
};

// Scene setup component
const SceneSetup = ({ model, isEditMode }: { model: Group | null, isEditMode: boolean }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  
  useEffect(() => {
    if (model && camera instanceof ThreePerspectiveCamera) {
      // Center and scale the model
      const box = new Box3().setFromObject(model);
      const center = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      
      // Position camera based on model size
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const cameraDistance = maxDim / (2 * Math.tan(fov / 2));
      
      // Position camera slightly to the front and above
      camera.position.set(center.x, center.y + maxDim * 0.1, center.z + cameraDistance * 1.2);
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      
      // Center the model
      model.position.set(-center.x, -center.y, -center.z);
    }
  }, [model, camera]);
  
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = true;
      controlsRef.current.enableRotate = !isEditMode;
      
      if (isEditMode) {
        controlsRef.current.enablePan = true;
        controlsRef.current.enableZoom = true;
        controlsRef.current.dampingFactor = 0.1;
      } else {
        controlsRef.current.enablePan = true;
        controlsRef.current.enableZoom = true;
        controlsRef.current.dampingFactor = 0.05;
      }
    }
  }, [isEditMode]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <directionalLight position={[-10, 10, 5]} intensity={0.5} />
      <Grid
        infiniteGrid
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#6f6f6f"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#9d4b4b"
        fadeDistance={30}
        fadeStrength={1.5}
        followCamera={false}
        position={[0, -2, 0]}
      />
      {model && <primitive object={model} />}
      <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.05} />
      <Environment preset="studio" />
    </>
  );
};

// Inside the ModelViewer component

// Fix the ModelViewer component to properly handle mouse events

const ModelViewer = ({ model }: ModelViewerProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [noseEditorFunctions, setNoseEditorFunctions] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Consolidate the mouse event handlers
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isEditMode && noseEditorFunctions && noseEditorFunctions.handleMouseDown) {
      console.log('ModelViewer: Canvas click in edit mode', e.clientX, e.clientY);
      setIsDragging(true);
      // Pass the coordinates directly
      noseEditorFunctions.handleMouseDown(e.clientX, e.clientY);
      
      // Add document-level event listeners for move and up events
      document.addEventListener('mousemove', handleDocumentMouseMove);
      document.addEventListener('mouseup', handleDocumentMouseUp);
    }
  };
  
  // Use document-level event handlers for better tracking outside the canvas
  const handleDocumentMouseMove = (e: MouseEvent) => {
    if (isEditMode && isDragging && noseEditorFunctions && noseEditorFunctions.handleMouseMove) {
      noseEditorFunctions.handleMouseMove(e.clientX, e.clientY);
    }
  };
  
  const handleDocumentMouseUp = () => {
    if (isEditMode && isDragging) {
      setIsDragging(false);
      if (noseEditorFunctions && noseEditorFunctions.handleMouseUp) {
        noseEditorFunctions.handleMouseUp();
      }
      
      // Remove document-level event listeners
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    }
  };
  
  // Clean up event listeners when component unmounts
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, []);
  
  // Toggle edit mode and show a toast notification
  // Inside the ModelViewer component, add state for the edit mode indicator
  const [indicatorState, setIndicatorState] = useState<'initial' | 'corner' | 'hidden'>('hidden');
  
  // Update the toggleEditMode function to handle the indicator animation
  const toggleEditMode = (newMode: boolean) => {
    setIsEditMode(newMode);
    
    // Set the global edit mode state for other components to access
    // @ts-ignore
    window.globalEditMode = newMode;
    
    // Handle edit mode indicator animation
    if (newMode) {
      // Show indicator in the center first
      setIndicatorState('initial');
      
      // Move to corner after 2 seconds
      setTimeout(() => {
        setIndicatorState('corner');
      }, 2000);
    } else {
      // Hide indicator when exiting edit mode
      setIndicatorState('hidden');
    }
    
    // Ensure the marker density is properly set when entering edit mode
    if (newMode && window.noseEditor && window.noseEditor.setMarkerDensity) {
      // Get current density or default to 'low'
      const currentDensity = window.noseEditor._currentDensity || 'low';
      // Re-apply the current density to ensure markers are displayed
      window.noseEditor.setMarkerDensity(currentDensity);
      console.log('ModelViewer: Re-applying marker density:', currentDensity);
    }
    
    // If we have the toast functionality from earlier implementation
    if (window.toast) {
      if (newMode) {
        window.toast.info("Edit mode enabled. Click and drag on the nose to modify it.");
      } else {
        window.toast.info("Edit mode disabled. You can now rotate the model.");
      }
    }
  };
  
  // This edit mode indicator will be rendered in the return statement
  // No need for this separate block as it's causing duplication
  
  return (
    <div className="model-viewer-container">
      <Canvas
        ref={canvasRef}
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 50 }}
        onClick={handleCanvasClick}
        className="model-canvas"
        onCreated={({ gl, camera }) => {
          // Store the canvas reference in the camera's userData
          camera.userData.canvas = gl.domElement;
        }}
      >
        <SceneSetup model={model} isEditMode={isEditMode} />
        <NoseEditorWrapper
          model={model}
          isEditMode={isEditMode}
          setNoseEditorFunctions={setNoseEditorFunctions}
        />
      </Canvas>
      
      {/* Add a prominent edit mode toggle button directly in the ModelViewer */}
      <div className="model-controls-overlay">
        <button 
          className={`edit-mode-main-toggle ${isEditMode ? 'active' : ''}`}
          onClick={() => toggleEditMode(!isEditMode)}
        >
          {isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
        </button>
        
        
        {isEditMode && indicatorState !== 'hidden' && (
          <div className={`edit-mode-indicator ${indicatorState}`}>
            <div className="indicator-dot"></div>
            <span>Edit Mode Active - Click on the highlighted vertices to drag and modify the nose. You can still zoom and pan.</span>
            <div className="close-button" onClick={() => setIndicatorState('hidden')}>✕</div>
          </div>
        )}
      </div>
      
      {model && noseEditorFunctions && (
        <div className="nose-editor-controls-container">
          <NoseEditorControls
            isEditMode={isEditMode}
            setIsEditMode={toggleEditMode}
            resetNose={noseEditorFunctions.resetNose}
            adjustNoseBridge={noseEditorFunctions.adjustNoseBridge}
            adjustNoseTip={noseEditorFunctions.adjustNoseTip}
            adjustNostrilWidth={noseEditorFunctions.adjustNostrilWidth}
            selectedVertex={noseEditorFunctions.selectedVertex}
            toggleMeshVisibility={noseEditorFunctions.toggleAnatomicalMeshVisibility}
            anatomicalMeshVisible={noseEditorFunctions.anatomicalMeshVisible}
          />
        </div>
      )}
    </div>
  );
};

export default ModelViewer;