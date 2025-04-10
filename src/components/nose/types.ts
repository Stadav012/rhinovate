import { Group, Mesh, Vector3, BufferGeometry, Camera, Scene } from 'three';

export interface NoseVertexDetectorProps {
  model: Group | null;
  scene?: Scene;
  isEditMode: boolean;
}

export interface VertexMarkersProps {
  noseMesh: Mesh | null;
  noseVertices: number[];
  scene: Scene | undefined;
  isEditMode: boolean;
  selectedVertex: number | null;
}

export interface NoseAdjustmentsProps {
  noseMesh: Mesh | null;
  noseVertices: number[];
  scene?: Scene;
  isEditMode: boolean;
  originalGeometry: BufferGeometry | null;
}

export interface VertexInteractionProps {
  noseMesh: Mesh | null;
  noseVertices: number[];
  isEditMode: boolean;
  camera?: Camera;
  scene?: Scene;
}