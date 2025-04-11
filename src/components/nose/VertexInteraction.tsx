import { useRef, useState, useEffect, useCallback } from 'react';
import { Mesh, Vector3, Vector2, Raycaster } from 'three';
import * as THREE from 'three';

interface VertexInteractionProps {
  noseMesh: Mesh | null;
  noseVertices: number[];
  isEditMode: boolean;
  camera?: THREE.Camera;
  scene?: THREE.Scene;
}

interface NoseEditorInterface {
  selectedVertex: number | null;
  setSelectedVertex: (index: number | null) => void;
  handleMouseDown: (event: MouseEvent) => void;
  handleMouseUp: () => void;
}

export const useVertexInteraction = (props: VertexInteractionProps): NoseEditorInterface => {
  const { noseMesh, noseVertices, isEditMode, camera, scene } = props;
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Function to highlight the selected vertex
  const highlightSelectedVertex = useCallback((vertexIndex: number) => {
    if (!scene || !noseMesh) return;
    
    // Remove any existing highlight markers
    const existingMarker = scene.getObjectByName(`vertexMarker-${vertexIndex}`);
    if (existingMarker) {
      existingMarker.visible = true;
      return;
    }
    
    // Create a small sphere to mark the selected vertex
    const geometry = new THREE.SphereGeometry(0.02, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker = new THREE.Mesh(geometry, material);
    
    // Set the marker position to the vertex position
    const position = noseMesh.geometry.attributes.position;
    const vertexPosition = new THREE.Vector3(
      position.getX(vertexIndex),
      position.getY(vertexIndex),
      position.getZ(vertexIndex)
    );
    
    marker.position.copy(vertexPosition);
    marker.position.applyMatrix4(noseMesh.matrixWorld);
    marker.name = `vertexMarker-${vertexIndex}`;
    marker.userData.vertexIndex = vertexIndex;
    
    scene.add(marker);
  }, [scene, noseMesh]);

  // Handle mouse up event
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setSelectedVertex(null);
  }, []);

  // Handle mouse move event
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !selectedVertex || !noseMesh || !camera) return;
    
    console.log('VertexInteraction: handleMouseMove - dragging vertex', selectedVertex);
    
    // Get canvas dimensions
    const canvas = camera.userData.canvas as HTMLElement || event.target as HTMLElement;
    if (!canvas) {
      console.error('VertexInteraction: No canvas found for mouse movement');
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    
    // Calculate mouse position in normalized device coordinates
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    
    // Create a raycaster
    const raycaster = new Raycaster();
    raycaster.setFromCamera(mouse as Vector2, camera);
    
    // Calculate the ray's direction vector
    const rayDirection = new Vector3();
    raycaster.ray.direction.normalize();
    rayDirection.copy(raycaster.ray.direction);
    
    // Get the current position of the selected vertex
    const positions = noseMesh.geometry.attributes.position;
    const vertexX = positions.getX(selectedVertex);
    const vertexY = positions.getY(selectedVertex);
    const vertexZ = positions.getZ(selectedVertex);
    const vertexPosition = new Vector3(vertexX, vertexY, vertexZ);
    vertexPosition.applyMatrix4(noseMesh.matrixWorld);
    
    // Create a plane perpendicular to the camera at the vertex position
    const planeNormal = new Vector3().subVectors(camera.position, vertexPosition).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, vertexPosition);
    
    // Find where the ray intersects the plane
    const targetPosition = new Vector3();
    const didIntersect = raycaster.ray.intersectPlane(plane, targetPosition);
    
    if (!didIntersect) {
      console.log('VertexInteraction: Ray did not intersect the plane');
      return;
    }
    
    console.log('VertexInteraction: Moving vertex from', vertexPosition, 'to', targetPosition);
    
    // Convert the target position back to local space
    const inverseMatrix = new THREE.Matrix4().copy(noseMesh.matrixWorld).invert();
    const localTargetPosition = targetPosition.clone().applyMatrix4(inverseMatrix);
    
    // Calculate the movement vector
    const moveVector = new Vector3().subVectors(localTargetPosition, new Vector3(vertexX, vertexY, vertexZ));
    
    // Update the selected vertex position
    positions.setXYZ(selectedVertex, localTargetPosition.x, localTargetPosition.y, localTargetPosition.z);
    
    // IMPROVED DEFORMATION: Apply to anatomical regions
    // Define a much larger falloff radius to affect more of the nose
    const falloffRadius = 1.5; // Increased radius for wider effect
    const maxInfluence = 0.95; // Stronger influence on nearby vertices
    const smoothingFactor = 0.9; // Added smoothing factor for more natural deformation
    
    // First pass: collect all affected vertices and their influence factors
    const affectedVertices = new Map();
    
    // Determine anatomical region based on selected vertex position
    // This is a simplified approach - you may need to adjust based on your model
    const isNoseTip = vertexZ > 0 && Math.abs(vertexX) < 0.2 && vertexY < 0.2;
    const isNostril = vertexY < 0 && Math.abs(vertexX) > 0.1;
    const isBridge = vertexY > 0.1 && Math.abs(vertexZ) < 0.2;
    
    // Apply to all nose vertices with appropriate falloff
    for (const vertexIndex of noseVertices) {
      if (vertexIndex === selectedVertex) continue;
      
      const x = positions.getX(vertexIndex);
      const y = positions.getY(vertexIndex);
      const z = positions.getZ(vertexIndex);
      const position = new Vector3(x, y, z);
      
      // Calculate distance to the selected vertex
      const distance = position.distanceTo(new Vector3(vertexX, vertexY, vertexZ));
      
      // Skip vertices that are too far away
      if (distance > falloffRadius) continue;
      
      // Calculate influence based on anatomical region
      let influence = 0;
      
      if (isNoseTip) {
        // For nose tip, affect more of the front of the nose
        if (z > 0) {
          influence = Math.max(0, 1 - (distance / falloffRadius)) * maxInfluence;
          // Stronger influence on vertices at similar height
          if (Math.abs(y - vertexY) < 0.2) {
            influence *= 1.5;
          }
        }
      } else if (isNostril) {
        // For nostrils, affect the bottom part of the nose
        if (y < 0.1) {
          influence = Math.max(0, 1 - (distance / falloffRadius)) * maxInfluence;
          // Stronger influence on same-side nostril
          if (Math.sign(x) === Math.sign(vertexX)) {
            influence *= 1.3;
          }
        }
      } else if (isBridge) {
        // For bridge, affect the top ridge of the nose
        if (y > 0) {
          influence = Math.max(0, 1 - (distance / falloffRadius)) * maxInfluence;
          // Stronger influence along the center line
          if (Math.abs(x) < 0.1) {
            influence *= 1.4;
          }
        }
      } else {
        // Default falloff for other areas - use quadratic falloff for smoother effect
        const normalizedDist = distance / falloffRadius;
        influence = maxInfluence * (1 - normalizedDist * normalizedDist);
      }
      
      // Store the vertex data for the second pass
      affectedVertices.set(vertexIndex, {
        position,
        influence,
        originalPosition: position.clone()
      });
    }
    
    // Second pass: apply smoothed deformation
    for (const [vertexIndex, data] of affectedVertices) {
      const { position, influence, originalPosition } = data;
      
      // Calculate the target position with influence
      const targetPosition = originalPosition.clone().add(
        moveVector.clone().multiplyScalar(influence * smoothingFactor)
      );
      
      // Apply the movement while maintaining local shape
      positions.setXYZ(
        vertexIndex,
        targetPosition.x,
        targetPosition.y,
        targetPosition.z
      );
    }
    
    positions.needsUpdate = true;
    
    // Recompute normals for proper lighting
    noseMesh.geometry.computeVertexNormals();
    
    // Update the highlight position
    highlightSelectedVertex(selectedVertex);
    
    // Update the visual indicator position if in a scene
    if (scene) {
      // Update any vertex markers
      const marker = scene.getObjectByName(`vertexMarker-${selectedVertex}`);
      if (marker) {
        marker.position.copy(localTargetPosition);
        marker.position.applyMatrix4(noseMesh.matrixWorld);
      }
      
      // Force a render update
      if (scene.userData.needsUpdate !== undefined) {
        scene.userData.needsUpdate = true;
      }
    }
  }, [selectedVertex, noseMesh, camera, isDragging, noseVertices, scene]);
  
  // Separate effect to handle the highlighting to break circular dependency
  useEffect(() => {
    if (selectedVertex !== null && noseMesh && scene) {
      highlightSelectedVertex(selectedVertex);
    }
  }, [selectedVertex, noseMesh, scene, highlightSelectedVertex]);

  // Handle mouse down event
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!isEditMode || !noseMesh || !camera || !scene) return;
    
    console.log('VertexInteraction: Mouse down event detected');
    
    // Get canvas dimensions from the event target
    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate mouse position in normalized device coordinates
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    console.log('VertexInteraction: Mouse click at NDC:', mouseX, mouseY);
    
    // Raycasting to find intersected objects
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(mouseX, mouseY), camera);
    
    // First, check if we hit any of the vertex markers directly
    const markerObjects = scene.children.filter(child => 
      child.name && child.name.startsWith('vertexMarker-')
    );
    
    console.log('VertexInteraction: Found', markerObjects.length, 'marker objects to test');
    
    const markerIntersects = raycaster.intersectObjects(markerObjects, false);
    console.log('VertexInteraction: Marker intersects:', markerIntersects.length);
    
    if (markerIntersects.length > 0) {
      // We hit a marker directly
      const hitMarker = markerIntersects[0].object;
      const vertexIndex = hitMarker.userData.vertexIndex;
      
      console.log(`VertexInteraction: Selected vertex ${vertexIndex} via marker`);
      setSelectedVertex(vertexIndex);
      setIsDragging(true);
      
      // Highlight the selected vertex
      highlightSelectedVertex(vertexIndex);
      
      // Start tracking mouse movement for dragging
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return;
    }
    
    // If we didn't hit a marker, try to find the closest vertex on the mesh
    const meshIntersects = raycaster.intersectObject(noseMesh, true);
    console.log('VertexInteraction: Mesh intersects:', meshIntersects.length);
    
    if (meshIntersects.length > 0) {
      const intersect = meshIntersects[0];
      console.log('VertexInteraction: Intersection point:', intersect.point);
      
      // Find the closest vertex to the intersection point
      if (noseMesh.geometry instanceof THREE.BufferGeometry) {
        const positions = noseMesh.geometry.attributes.position;
        let closestVertex = -1;
        let minDistance = Infinity;
        
        // Only consider vertices in the nose region
        for (const vertexIndex of noseVertices) {
          const x = positions.getX(vertexIndex);
          const y = positions.getY(vertexIndex);
          const z = positions.getZ(vertexIndex);
          
          const vertexPosition = new Vector3(x, y, z);
          // Apply world matrix to get the vertex position in world space
          vertexPosition.applyMatrix4(noseMesh.matrixWorld);
          
          const distance = vertexPosition.distanceTo(intersect.point);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestVertex = vertexIndex;
          }
        }
        
        // Increase the selection threshold for easier vertex selection
        const selectionThreshold = 0.2; // Increased threshold
        
        if (closestVertex !== -1 && minDistance < selectionThreshold) {
          console.log(`VertexInteraction: Selected vertex ${closestVertex} at distance ${minDistance}`);
          setSelectedVertex(closestVertex);
          setIsDragging(true);
          
          // Highlight the selected vertex
          highlightSelectedVertex(closestVertex);
          
          // Start tracking mouse movement for dragging
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        } else {
          console.log(`VertexInteraction: No vertex selected. Closest was ${closestVertex} at distance ${minDistance}`);
        }
      }
    }
  }, [isEditMode, noseMesh, camera, scene, noseVertices, setSelectedVertex, highlightSelectedVertex]);
  
  // Add and remove event listeners
  useEffect(() => {
    if (isEditMode && noseMesh) {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.addEventListener('mousedown', handleMouseDown);
        
        // We don't need to add these listeners here as they're added dynamically when needed
        // in the handleMouseDown function and removed in handleMouseUp
        // canvas.addEventListener('mousemove', handleMouseMove);
        // canvas.addEventListener('mouseup', handleMouseUp);
      }
  
      return () => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          canvas.removeEventListener('mousedown', handleMouseDown);
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        }
      };
    }
  }, [isEditMode, noseMesh, handleMouseDown, handleMouseMove, handleMouseUp]);
  
  // This effect ensures we clean up event listeners when the component unmounts
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return {
    selectedVertex,
    setSelectedVertex,
    handleMouseDown,
    handleMouseUp
  };
};