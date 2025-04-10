import { Group } from 'three';
import * as THREE from 'three';
import NoseEditor from './nose/NoseEditor';

interface NoseEditorWrapperProps {
  model: Group | null;
  isEditMode: boolean;
  camera?: THREE.Camera;
  scene?: THREE.Scene;
}

const NoseEditorWrapper = ({ model, isEditMode, camera, scene }: NoseEditorWrapperProps) => {
  return (
    <NoseEditor 
      model={model} 
      isEditMode={isEditMode} 
      camera={camera} 
      scene={scene} 
    />
  );
};

export default NoseEditorWrapper;