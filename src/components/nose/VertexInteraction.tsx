import { useState, useEffect, useCallback } from 'react';
import { Mesh, Vector3, Raycaster } from 'three';
import * as THREE from 'three';
import { VertexInteractionProps } from './types';

// Add or update these functions in the useVertexInteraction hook
export const useVertexInteraction = ({
  noseMesh,
  noseVertices,
  isEditMode,
  camera,
  scene
}: VertexInteractionProps) => {
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  
  // Highlight the selected vertex
  const highlightSelectedVertex = useCallback((vertexIndex: number) => {
    if (!scene || !noseMesh) return;
    
    // Remove any existing highlight
    const existingHighlight = scene.getObjectByName('selectedVertexHighlight');
    if (existingHighlight) scene.remove(existingHighlight);
    
    // Get the position of the selected vertex
    const positions = noseMesh.geometry.attributes.position;
    const x = positions.getX(vertexIndex);
    const y = positions.getY(vertexIndex);
    const z = positions.getZ(vertexIndex);
    
    // Create a larger, brighter highlight for the selected vertex
    const box = new THREE.Box3().setFromObject(noseMesh);
    const size = box.getSize(new Vector3());
    const highlightSize = Math.min(size.x, size.y, size.z) * 0.01; // Larger than regular markers
    
    const highlight = new THREE.Mesh(
      new THREE.SphereGeometry(highlightSize),
      new THREE.MeshBasicMaterial({ 
        color: 0xffff00, // Yellow for better visibility
        transparent: true,
        opacity: 0.9
      })
    );
    
    highlight.name = 'selectedVertexHighlight';
    highlight.position.set(x, y, z);
    highlight.position.applyMatrix4(noseMesh.matrixWorld);
    
    scene.add(highlight);
  }, [scene, noseMesh]);
  
  // Handle mouse movement for dragging
  // In the handleMouseMove function, let's update the vertex movement logic to affect surrounding vertices
  
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (selectedVertex === null || !noseMesh || !camera) {
      console.log('VertexInteraction: handleMouseMove - missing required elements');
      return;
    }
    
    console.log('VertexInteraction: handleMouseMove - dragging vertex', selectedVertex);
    
    // Get canvas dimensions
    const canvas = camera.userData.canvas as HTMLElement || event.target as HTMLElement;
    if (!canvas) {
      console.error('VertexInteraction: No canvas found for mouse movement');
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    
    // Calculate mouse position in normalized device coordinates
    const mouse = new Vector3(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
      0.5
    );
    
    // Create a raycaster
    const raycaster = new Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
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
  }, [selectedVertex, noseMesh, camera, highlightSelectedVertex, noseVertices, scene]);
  
  // Handle mouse up event
  const handleMouseUp = useCallback(() => {
    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Keep the vertex selected but stop dragging
    console.log('VertexInteraction: Drag ended for vertex', selectedVertex);
    
    // Make sure to update the geometry
    if (noseMesh) {
      // Ensure position updates are applied
      noseMesh.geometry.attributes.position.needsUpdate = true;
      
      // Recompute normals for proper lighting
      noseMesh.geometry.computeVertexNormals();
      
      // Force a render update if in a scene
      if (scene?.userData.needsUpdate !== undefined) {
        scene.userData.needsUpdate = true;
      }
    }
  }, [handleMouseMove, selectedVertex, noseMesh, scene]);
  
  // Handle mouse interaction for vertex selection
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!isEditMode || !noseMesh || !camera || !scene) {
      console.warn('VertexInteraction: Cannot handle mouse down - missing dependencies');
      return;
    }
    
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
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
    
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
  }, [isEditMode, noseMesh, camera, scene, noseVertices, setSelectedVertex, handleMouseMove, handleMouseUp, highlightSelectedVertex]);
  
  return {
    selectedVertex,
    setSelectedVertex,
    handleMouseDown
  };
  
  // Fix the useEffect at the end of the component to properly expose the functions
  
  // Make sure these functions are properly exposed
  useEffect(() => {
    if (isEditMode && noseMesh) {
      // Expose the vertex interaction functions globally
      // @ts-ignore
      window.noseEditor = {
        ...window.noseEditor,
        handleMouseDown: (x: number, y: number) => {
          console.log('VertexInteraction: handleMouseDown called with', x, y);
          
          // Create a synthetic mouse event with the coordinates
          const canvas = camera?.userData.canvas;
          if (!canvas || !camera) {
            console.error('VertexInteraction: Missing canvas or camera');
            return;
          }
          
          // Create a synthetic event object
          const syntheticEvent = {
            clientX: x,
            clientY: y,
            target: canvas
          } as unknown as MouseEvent;
          
          // Call the actual handler
          handleMouseDown(syntheticEvent);
          
          // Add mouse move and mouse up listeners
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        },
        handleMouseMove: (x: number, y: number) => {
          console.log('VertexInteraction: handleMouseMove called with', x, y);
          
          // Create a synthetic mouse event
          const syntheticEvent = {
            clientX: x,
            clientY: y,
            target: camera?.userData.canvas
          } as unknown as MouseEvent;
          
          // Call the actual handler
          handleMouseMove(syntheticEvent);
        },
        handleMouseUp: () => {
          console.log('VertexInteraction: handleMouseUp called');
          handleMouseUp();
        }
      };
    }
    
    return () => {
      // Clean up
      if (isEditMode) {
        // @ts-ignore
        if (window.noseEditor) {
          // @ts-ignore
          delete window.noseEditor.handleMouseDown;
          // @ts-ignore
          delete window.noseEditor.handleMouseMove;
          // @ts-ignore
          delete window.noseEditor.handleMouseUp;
        }
      }
    };
  }, [isEditMode, noseMesh, camera, scene, handleMouseDown, handleMouseMove, handleMouseUp]);
};