import { useRef, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Environment } from '@react-three/drei';
import { Group, Mesh, MeshStandardMaterial, BufferGeometry, Box3, Vector3 } from 'three';
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
  
  // Use the NoseEditor with the camera and scene from the Canvas context
  const noseEditorInstance = NoseEditor({ model, isEditMode, camera, scene });
  
  // Pass the functions up to the parent component
  useEffect(() => {
    setNoseEditorFunctions(noseEditorInstance);
  }, [noseEditorInstance, setNoseEditorFunctions]);
  
  const { handleMouseDown } = noseEditorInstance;
  
  return (
    <>
      {/* This is just a transparent overlay to capture mouse events when in edit mode */}
      {isEditMode && (
        <mesh
          visible={false}
          position={[0, 0, 10]}
          onClick={handleMouseDown}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </>
  );
};

const ModelViewer = ({ model }: ModelViewerProps) => {
  const modelRef = useRef<Group>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [clonedModel, setClonedModel] = useState<Group | null>(null);
  const [noseEditorFunctions, setNoseEditorFunctions] = useState<any>({
    resetNose: () => {},
    adjustNoseBridge: () => {},
    adjustNoseTip: () => {},
    adjustNostrilWidth: () => {},
    selectedVertex: null
  });

  useEffect(() => {
    if (model && modelRef.current) {
      // Clear any existing children
      while (modelRef.current.children.length > 0) {
        modelRef.current.remove(modelRef.current.children[0]);
      }

      // Add the new model
      const modelClone = model.clone();
      modelRef.current.add(modelClone);
      
      // Store the cloned model to pass to NoseEditor
      setClonedModel(modelClone);

      // Calculate bounding box to center and scale the model properly
      const box = new Box3().setFromObject(modelClone);
      const center = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      
      // Get the maximum dimension to normalize scale
      const maxDimension = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDimension; // Scale to fit in a 2 unit sphere
      
      // Center the model
      modelClone.position.set(-center.x, -center.y, -center.z);
      modelRef.current.scale.setScalar(scale);

      // Apply materials if needed
      modelRef.current.traverse((child) => {
        if (child instanceof Mesh) {
          // If the mesh doesn't have a material, add a default one
          if (!child.material) {
            child.material = new MeshStandardMaterial({ 
              color: 0xf5f5f5,
              roughness: 0.5,
              metalness: 0.1
            });
          }

          // If the geometry is a BufferGeometry from PLY or STL
          if (child.geometry instanceof BufferGeometry && !child.geometry.attributes.uv) {
            // Handle geometries without UV coordinates if needed
          }
        }
      });
    }
  }, [model]);

  return (
    <div className="model-viewer-container">
      <div 
        style={{ width: '100%', height: '500px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}
        className={isEditMode ? 'edit-mode' : ''}
      >
        <Canvas shadows ref={canvasRef}>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
          <Grid infiniteGrid fadeDistance={30} fadeStrength={1.5} />
          <Environment preset="studio" />
          
          {/* Model container */}
          <group ref={modelRef} />
          
          {/* Nose editor component - only render if cloned model exists */}
          {clonedModel && (
            <NoseEditorWrapper 
              model={clonedModel} 
              isEditMode={isEditMode} 
              setNoseEditorFunctions={setNoseEditorFunctions} 
            />
          )}
          
          {/* Controls for rotating, panning, and zooming */}
          <OrbitControls 
            enablePan 
            enableZoom 
            enableRotate 
            minDistance={2}
            maxDistance={20}
            target={[0, 0, 0]}
            enabled={!isEditMode} // Disable orbit controls when in edit mode
          />
        </Canvas>
      </div>
      
      {model && (
        <NoseEditorControls
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          resetNose={noseEditorFunctions.resetNose}
          adjustNoseBridge={noseEditorFunctions.adjustNoseBridge}
          adjustNoseTip={noseEditorFunctions.adjustNoseTip}
          adjustNostrilWidth={noseEditorFunctions.adjustNostrilWidth}
          selectedVertex={noseEditorFunctions.selectedVertex}
        />
      )}
    </div>
  );
};

export default ModelViewer;