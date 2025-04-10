import { Mesh, Vector3 } from 'three';
import * as THREE from 'three';

interface NoseAdjustmentsProps {
  noseMesh: Mesh | null;
  noseVertices: number[];
  scene?: THREE.Scene;
  isEditMode: boolean;
  originalGeometry: THREE.BufferGeometry | null;
}

export const useNoseAdjustments = ({
  noseMesh,
  noseVertices,
  scene,
  isEditMode,
  originalGeometry
}: NoseAdjustmentsProps) => {
  
  // Reset nose to original shape
  const resetNose = () => {
    if (!noseMesh || !originalGeometry) {
      console.warn('Cannot reset: missing nose mesh or original geometry');
      return;
    }
    
    console.log('Resetting nose to original shape');
    
    // Dispose of the current geometry to prevent memory leaks
    noseMesh.geometry.dispose();
    
    // Create a deep clone of the original geometry
    const resetGeometry = originalGeometry.clone();
    
    // Ensure all attributes are properly cloned
    if (originalGeometry.attributes.position && resetGeometry.attributes.position) {
      const origPositions = originalGeometry.attributes.position;
      const newPositions = resetGeometry.attributes.position;
      
      // Verify positions are correctly copied
      for (let i = 0; i < origPositions.count; i++) {
        const x = origPositions.getX(i);
        const y = origPositions.getY(i);
        const z = origPositions.getZ(i);
        newPositions.setXYZ(i, x, y, z);
      }
      
      newPositions.needsUpdate = true;
    }
    
    // Assign the reset geometry to the mesh
    noseMesh.geometry = resetGeometry;
    
    // Ensure normals are recomputed
    noseMesh.geometry.computeVertexNormals();
    
    console.log('Nose reset complete');
  };
  
  // Adjust nose bridge
  const adjustNoseBridge = (amount: number) => {
    if (!noseMesh) {
      console.warn('NoseAdjustments: Cannot adjust bridge - no nose mesh reference');
      return;
    }
    
    if (noseMesh.geometry instanceof THREE.BufferGeometry) {
      const positions = noseMesh.geometry.attributes.position;
      const box = new THREE.Box3().setFromObject(noseMesh);
      const center = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      
      // Significantly increase amplification for more visible effect
      const amplifiedAmount = amount * 0.3 * size.y;
      let verticesAffected = 0;
      
      // Adjust vertices in the bridge area
      for (const vertexIndex of noseVertices) {
        const x = positions.getX(vertexIndex);
        const y = positions.getY(vertexIndex);
        
        // Enhanced bridge area detection
        const xDistanceFromCenter = Math.abs(x - center.x);
        const xDistanceNormalized = xDistanceFromCenter / (size.x/2);
        
        // Normalized Y position (0 at bottom, 1 at top)
        const normalizedY = (y - (center.y - size.y/2)) / size.y;
        
        // Bridge vertices are near the center on X axis and in the upper part of the nose
        if (xDistanceNormalized < 0.5 && normalizedY > 0.5) {
          // Apply a falloff effect based on distance from the bridge center
          const falloff = 1 - xDistanceNormalized;
          const adjustedAmount = amplifiedAmount * falloff;
          
          // Raise or lower the bridge
          positions.setY(vertexIndex, y + adjustedAmount);
          verticesAffected++;
        }
      }
      
      console.log(`NoseAdjustments: Bridge adjustment affected ${verticesAffected} vertices with amount ${amplifiedAmount}`);
      
      positions.needsUpdate = true;
      noseMesh.geometry.computeVertexNormals();
    }
  };
  
  // Adjust nose tip
  const adjustNoseTip = (amount: number) => {
    if (!noseMesh) {
      console.warn('NoseAdjustments: Cannot adjust tip - no nose mesh reference');
      return;
    }
    
    if (noseMesh.geometry instanceof THREE.BufferGeometry) {
      const positions = noseMesh.geometry.attributes.position;
      const box = new THREE.Box3().setFromObject(noseMesh);
      const center = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      
      // Significantly increase amplification for more visible effect
      const amplifiedAmount = amount * 0.5 * size.z;
      let verticesAffected = 0;
      
      // Find the front-most Z value to help identify the tip
      let maxZ = -Infinity;
      for (const vertexIndex of noseVertices) {
        const z = positions.getZ(vertexIndex);
        if (z > maxZ) maxZ = z;
      }
      
      // Adjust vertices in the tip area
      for (const vertexIndex of noseVertices) {
        const x = positions.getX(vertexIndex);
        const y = positions.getY(vertexIndex);
        const z = positions.getZ(vertexIndex);
        
        // Enhanced tip area detection with more inclusive criteria
        const xDistanceFromCenter = Math.abs(x - center.x);
        const xDistanceNormalized = xDistanceFromCenter / (size.x/2);
        
        // Normalized Y position (0 at bottom, 1 at top)
        const normalizedY = (y - (center.y - size.y/2)) / size.y;
        
        // How close this vertex is to the front-most point
        const zDistanceFromFront = maxZ - z;
        const zDistanceNormalized = zDistanceFromFront / (size.z/2);
        
        // More inclusive criteria for tip vertices
        const isCentralVertex = xDistanceNormalized < 0.5;
        const isInYRange = normalizedY > 0.2 && normalizedY < 0.9;
        const isNearFront = zDistanceNormalized < 0.5;
        const isFrontMostVertex = zDistanceNormalized < 0.1; // Special case for very front vertices
        
        // Apply adjustment if vertex meets the criteria
        if ((isCentralVertex && isInYRange && isNearFront) || isFrontMostVertex) {
          // Apply a falloff effect based on distance from the tip center
          let falloff;
          if (isFrontMostVertex) {
            // Front-most vertices get maximum effect
            falloff = 1.0;
          } else {
            const xFalloff = 1 - xDistanceNormalized;
            const zFalloff = 1 - zDistanceNormalized;
            falloff = xFalloff * zFalloff;
          }
          
          const adjustedAmount = amplifiedAmount * falloff;
          
          // Project or retract the tip
          positions.setZ(vertexIndex, z + adjustedAmount);
          verticesAffected++;
        }
      }
      
      console.log(`NoseAdjustments: Tip adjustment affected ${verticesAffected} vertices with amount ${amplifiedAmount}`);
      
      positions.needsUpdate = true;
      noseMesh.geometry.computeVertexNormals();
    }
  };
  
  // Adjust nostril width
  const adjustNostrilWidth = (amount: number) => {
    if (!noseMesh) {
      console.warn('NoseAdjustments: Cannot adjust nostrils - no nose mesh reference');
      return;
    }
    
    if (noseMesh.geometry instanceof THREE.BufferGeometry) {
      const positions = noseMesh.geometry.attributes.position;
      const box = new THREE.Box3().setFromObject(noseMesh);
      const center = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      
      // Significantly increase amplification for more visible effect
      const amplifiedAmount = amount * 0.3 * size.x;
      let verticesAffected = 0;
      
      // Adjust vertices in the nostril area
      for (const vertexIndex of noseVertices) {
        const x = positions.getX(vertexIndex);
        const y = positions.getY(vertexIndex);
        const z = positions.getZ(vertexIndex);
        
        // Enhanced nostril area detection
        const xDistanceFromCenter = Math.abs(x - center.x);
        const xDistanceNormalized = xDistanceFromCenter / (size.x/2);
        
        // Normalized Y position (0 at bottom, 1 at top)
        const normalizedY = (y - (center.y - size.y/2)) / size.y;
        
        // Normalized Z position (0 at back, 1 at front)
        const normalizedZ = (z - (center.z - size.z/2)) / size.z;
        
        // Nostril vertices are on the sides and lower-middle part of the nose
        if (xDistanceNormalized > 0.2 && // Not at the very center
            normalizedY > 0.2 && normalizedY < 0.6 && // Lower-middle part
            normalizedZ > 0.5) { // Front half
          
          // Apply a falloff effect based on distance from the nostril center
          const falloff = xDistanceNormalized * (1 - Math.abs(normalizedY - 0.4));
          const adjustedAmount = amplifiedAmount * falloff;
          
          // Widen or narrow the nostrils
          const direction = x > center.x ? 1 : -1;
          positions.setX(vertexIndex, x + (direction * adjustedAmount));
          verticesAffected++;
        }
      }
      
      console.log(`NoseAdjustments: Nostril adjustment affected ${verticesAffected} vertices with amount ${amplifiedAmount}`);
      
      positions.needsUpdate = true;
      noseMesh.geometry.computeVertexNormals();
    }
  };

  return {
    resetNose,
    adjustNoseBridge,
    adjustNoseTip,
    adjustNostrilWidth
  };
};