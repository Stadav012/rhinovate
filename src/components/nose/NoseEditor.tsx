import { useRef, useState, useEffect } from 'react';
import { Group, Mesh, BufferGeometry, Vector3, Raycaster } from 'three';
import * as THREE from 'three';
import { useNoseVertexDetector } from './NoseVertexDetector';
import { useNoseAdjustments } from './NoseAdjustments';
import { useVertexInteraction } from './VertexInteraction';
import AnatomicalMeshEditor from './AnatomicalMeshEditor';

interface NoseEditorProps {
  model: Group | null;
  isEditMode: boolean;
  camera?: THREE.Camera;
  scene?: THREE.Scene;
}

const NoseEditor = ({ model, isEditMode, camera, scene }: NoseEditorProps) => {
  const noseMeshRef = useRef<Mesh | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [useAnatomicalEditor, setUseAnatomicalEditor] = useState<boolean>(true);
  
  console.log('NoseEditor: Rendering with edit mode =', isEditMode);
  
  // Use our custom hooks
  const { noseMesh, noseVertices, originalGeometry } = useNoseVertexDetector({ 
    model, 
    scene, 
    isEditMode 
  });
  
  // Use the anatomical mesh editor for region-based editing
  const {
    noseMesh: anatomicalNoseMesh,
    controlPoints,
    selectedControlPoint,
    resetNose: resetAnatomicalNose,
    toggleAnatomicalMeshVisibility,
    anatomicalMeshVisible
  } = AnatomicalMeshEditor({
    model,
    isEditMode: isEditMode && useAnatomicalEditor,
    camera,
    scene
  });
  
  // Use the vertex interaction hook for handling mouse events and vertex selection
  // Only used when not using the anatomical editor
  const { selectedVertex, setSelectedVertex, handleMouseDown } = useVertexInteraction({
    noseMesh,
    noseVertices,
    isEditMode: isEditMode && !useAnatomicalEditor,
    camera,
    scene
  });
  
  // Debug logs to help diagnose the issue
  useEffect(() => {
    if (isEditMode) {
      console.log('NoseEditor: Edit mode active, detected vertices:', noseVertices.length);
      console.log('NoseEditor: Using anatomical editor:', useAnatomicalEditor);
    }
  }, [isEditMode, noseVertices, useAnatomicalEditor]);
  
  // Update the ref when noseMesh changes
  useEffect(() => {
    noseMeshRef.current = noseMesh;
    console.log('NoseEditor: Updated noseMeshRef:', !!noseMesh);
  }, [noseMesh]);
  
  // Add debug visualization to show the model's bounding box
  useEffect(() => {
    console.log('DEBUGGING: Bounding box effect triggered, scene =', !!scene, 'noseMesh =', !!noseMeshRef.current);
    
    if (!scene || !noseMeshRef.current) {
      console.log('DEBUGGING: Skipping bounding box - missing scene or noseMesh');
      return;
    }
    
    // Add a debug visualization to show the model's bounding box
    const box = new THREE.Box3().setFromObject(noseMeshRef.current);
    const boxHelper = new THREE.Box3Helper(box, 0xff0000);
    boxHelper.name = 'modelBoundingBox';
    
    // Remove any existing box helper
    const existingHelper = scene.getObjectByName('modelBoundingBox');
    if (existingHelper) scene.remove(existingHelper);
    
    // Add the new helper
    scene.add(boxHelper);
    console.log('DEBUGGING: Added bounding box helper to visualize model', box.min, box.max);
    
    return () => {
      const helper = scene.getObjectByName('modelBoundingBox');
      if (helper) scene.remove(helper);
    };
  }, [scene, noseMesh]); // Fixed dependency array
  
  // Use the nose adjustments hook
  const { resetNose, adjustNoseBridge, adjustNoseTip, adjustNostrilWidth } = useNoseAdjustments({
    noseMesh,
    noseVertices,
    scene,
    isEditMode: isEditMode && !useAnatomicalEditor,
    originalGeometry
  });
  
  // Toggle between anatomical editor and vertex editor
  const toggleEditorMode = () => {
    setUseAnatomicalEditor(!useAnatomicalEditor);
  };
  
  // Highlight the selected vertex
  const highlightSelectedVertex = (vertexIndex: number) => {
    if (!scene || !noseMeshRef.current) return;
    
    // Remove any existing highlight
    const existingHighlight = scene.getObjectByName('selectedVertexHighlight');
    if (existingHighlight) scene.remove(existingHighlight);
    
    // Get the position of the selected vertex
    const positions = noseMeshRef.current.geometry.attributes.position;
    const x = positions.getX(vertexIndex);
    const y = positions.getY(vertexIndex);
    const z = positions.getZ(vertexIndex);
    
    // Create a larger, brighter highlight for the selected vertex
    const box = new THREE.Box3().setFromObject(noseMeshRef.current);
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
    highlight.position.applyMatrix4(noseMeshRef.current.matrixWorld);
    
    scene.add(highlight);
  };
  
  // Handle mouse movement for dragging - only used when not using anatomical editor
  const handleMouseMove = (event: MouseEvent) => {
    // Skip if using anatomical editor
    if (useAnatomicalEditor) return;
    
    if (selectedVertex === null || !noseMeshRef.current || !camera) {
      console.log('DEBUGGING: handleMouseMove - missing required elements:', 
                 'selectedVertex =', selectedVertex, 
                 'noseMeshRef.current =', !!noseMeshRef.current, 
                 'camera =', !!camera);
      return;
    }
    
    console.log('DEBUGGING: handleMouseMove - dragging vertex', selectedVertex);
    
    // Get canvas dimensions
    const canvas = event.target as HTMLElement || canvasRef.current || document.querySelector('canvas');
    if (!canvas) {
      console.error('DEBUGGING: No canvas found for mouse movement');
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
    const positions = noseMeshRef.current.geometry.attributes.position;
    const vertexX = positions.getX(selectedVertex);
    const vertexY = positions.getY(selectedVertex);
    const vertexZ = positions.getZ(selectedVertex);
    const vertexPosition = new Vector3(vertexX, vertexY, vertexZ);
    vertexPosition.applyMatrix4(noseMeshRef.current.matrixWorld);
    
    // Create a plane perpendicular to the camera at the vertex position
    const planeNormal = new Vector3().subVectors(camera.position, vertexPosition).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, vertexPosition);
    
    // Find where the ray intersects the plane
    const targetPosition = new Vector3();
    const didIntersect = raycaster.ray.intersectPlane(plane, targetPosition);
    
    if (!didIntersect) {
      console.log('DEBUGGING: Ray did not intersect the plane');
      return;
    }
    
    console.log('DEBUGGING: Moving vertex from', vertexPosition, 'to', targetPosition);
    
    // Convert the target position back to local space
    const inverseMatrix = new THREE.Matrix4().copy(noseMeshRef.current.matrixWorld).invert();
    const localTargetPosition = targetPosition.clone().applyMatrix4(inverseMatrix);
    
    // Update the vertex position
    positions.setXYZ(selectedVertex, localTargetPosition.x, localTargetPosition.y, localTargetPosition.z);
    positions.needsUpdate = true;
    
    // ENHANCED ANATOMICAL DEFORMATION
    // Use dynamic falloff radius based on model size for more appropriate influence area
    const modelSize = Math.max(size.x, size.y, size.z);
    const falloffRadius = modelSize * 0.3; // Dynamic radius based on model size (30% of model size)
    const maxInfluence = 0.95; // Stronger influence for more realistic deformation
    const smoothingFactor = 0.9; // Higher smoothing factor for more natural movement
    
    // Calculate the movement vector once
    const moveVector = new Vector3().subVectors(localTargetPosition, new Vector3(vertexX, vertexY, vertexZ));
    
    // Log the movement for debugging
    console.log('DEBUGGING: Movement vector:', moveVector, 'with magnitude:', moveVector.length());
    console.log('DEBUGGING: Using falloff radius:', falloffRadius, 'for model size:', modelSize);
    
    // Get model dimensions for better scaling
    const box = new THREE.Box3().setFromObject(noseMeshRef.current);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    
    // Add tension forces to maintain structural integrity
    const tensionFactor = 0.7; // Controls how much the structure resists deformation
    const elasticityFactor = 0.85; // Controls how much the structure returns to original shape
    
    // Determine which anatomical region the selected vertex belongs to
    // This helps us apply appropriate deformation behavior
    const isNoseTip = vertexZ > center.z + size.z * 0.3; // Front part of nose
    const isNostril = vertexY < center.y - size.y * 0.1 && Math.abs(vertexX - center.x) > size.x * 0.1; // Lower sides
    const isBridge = vertexY > center.y + size.y * 0.1 && Math.abs(vertexX - center.x) < size.x * 0.1; // Upper center
    const isSideWall = Math.abs(vertexX - center.x) > size.x * 0.15 && vertexY > center.y - size.y * 0.1; // Side walls
    const isColumella = vertexY < center.y && Math.abs(vertexX - center.x) < size.x * 0.05 && vertexZ > center.z; // Center strip between nostrils
    
    console.log('DEBUGGING: Detected anatomical region:', 
                isNoseTip ? 'Nose Tip' : 
                isNostril ? 'Nostril' : 
                isBridge ? 'Bridge' : 
                isSideWall ? 'Side Wall' : 
                isColumella ? 'Columella' : 'General Nose Area');
    
    // First pass: collect all affected vertices and their influence factors
    const affectedVertices = new Map();
    
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
      
      // Base influence calculation with quadratic falloff for smoother effect
      const normalizedDist = distance / falloffRadius;
      let influence = maxInfluence * (1 - normalizedDist * normalizedDist);
      
      // Apply anatomical region-specific influence adjustments with improved factors
      if (isNoseTip) {
        // For nose tip, affect more of the front of the nose with directional bias
        if (z > center.z) {
          // Stronger influence on vertices at similar height and forward position
          if (Math.abs(y - vertexY) < size.y * 0.2) { // Increased height range
            influence *= 1.8; // Boosted influence for vertices at similar height
          }
          // Stronger lateral (side-to-side) movement for tip widening/narrowing
          if (moveVector.x !== 0 && Math.abs(x - center.x) < size.x * 0.25) { // Wider lateral range
            const lateralFactor = 1.5; // Increased lateral factor
            influence *= lateralFactor;
          }
        }
      } else if (isNostril) {
        // For nostrils, affect the bottom part of the nose with enhanced side-specific influence
        if (y < center.y) {
          // Stronger influence on same-side nostril with improved factor
          if (Math.sign(x - center.x) === Math.sign(vertexX - center.x)) {
            influence *= 1.7; // Significantly boosted influence for same-side nostril
            
            // Apply additional boost for vertices very close to the selected vertex
            const proximityFactor = Math.max(0, 1 - (distance / (falloffRadius * 0.3)));
            influence *= (1 + proximityFactor * 0.8);
          }
          // Reduced influence on opposite side for independent nostril movement
          else {
            influence *= 0.2; // Further reduced influence on opposite nostril for better independence
          }
        }
      } else if (isBridge) {
        // For bridge, affect the top ridge of the nose with enhanced vertical bias
        if (y > center.y) {
          // Stronger influence along the center line with improved factor
          if (Math.abs(x - center.x) < size.x * 0.15) { // Wider center line range
            influence *= 1.8; // Significantly boosted influence along bridge center line
          }
          // Stronger vertical movement for bridge raising/lowering with improved factor
          if (moveVector.y !== 0) {
            // Apply non-linear vertical factor based on movement magnitude
            const verticalMagnitude = Math.abs(moveVector.y);
            const verticalFactor = 1.4 + (verticalMagnitude * 0.5); // Dynamic factor based on movement
            influence *= verticalFactor;
            
            // Apply additional coherence to bridge vertices at similar X positions
            const xSimilarity = 1 - Math.min(1, Math.abs(x - vertexX) / (size.x * 0.2));
            influence *= (1 + xSimilarity * 0.5);
          }
        }
      } else if (isSideWall) {
        // For side walls, maintain side symmetry with enhanced appropriate falloff
        const sameSide = Math.sign(x - center.x) === Math.sign(vertexX - center.x);
        if (sameSide) {
          influence *= 1.5; // Increased boost for same side for better responsiveness
          
          // Apply additional boost based on vertical proximity
          const verticalProximity = 1 - Math.min(1, Math.abs(y - vertexY) / (size.y * 0.15));
          influence *= (1 + verticalProximity * 0.6);
        } else {
          influence *= 0.3; // Further reduced influence on opposite side for better independence
        }
      } else if (isColumella) {
        // For columella (strip between nostrils), maintain structural integrity with enhanced constraints
        // This area should move less freely to maintain nasal structure
        influence *= 0.65; // Slightly reduced influence for better structural stability
        
        // Apply stronger horizontal constraints to maintain columella shape
        if (Math.abs(moveVector.x) > Math.abs(moveVector.y) && Math.abs(moveVector.x) > Math.abs(moveVector.z)) {
          influence *= 0.4; // Further reduce side-to-side movement of columella for better stability
        }
        
        // Apply additional constraints based on distance from center line
        const centerLineDistance = Math.abs(x - center.x) / (size.x * 0.1);
        const centerConstraint = Math.max(0.5, 1 - centerLineDistance);
        influence *= centerConstraint; // Stronger influence for vertices closer to center line
      }
      
      // Store the vertex data for the second pass
      affectedVertices.set(vertexIndex, {
        position,
        influence,
        originalPosition: position.clone()
      });
    }
    
    // Second pass: apply smoothed deformation with anatomical constraints
    for (const [vertexIndex, data] of affectedVertices) {
      const { position, influence, originalPosition } = data;
      
      // Calculate the target position with influence, tension, and elasticity
      // Apply tension to resist deformation based on distance from original position
      const tensionVector = new Vector3().subVectors(originalPosition, position).multiplyScalar(tensionFactor);
      
      // Apply elasticity to simulate tissue properties
      const elasticityInfluence = influence * elasticityFactor;
      
      // Get the vertex's position relative to the model center for anatomical constraints
      const relativeX = position.x - center.x;
      const relativeY = position.y - center.y;
      const relativeZ = position.z - center.z;
      
      // Determine which anatomical region this vertex belongs to
      const isVertexInTip = position.z > center.z + size.z * 0.3;
      const isVertexInNostril = position.y < center.y - size.y * 0.1 && Math.abs(relativeX) > size.x * 0.1;
      const isVertexInBridge = position.y > center.y + size.y * 0.1 && Math.abs(relativeX) < size.x * 0.1;
      const isVertexInSideWall = Math.abs(relativeX) > size.x * 0.15 && position.y > center.y - size.y * 0.1;
      const isVertexInColumella = position.y < center.y && Math.abs(relativeX) < size.x * 0.05 && position.z > center.z;
      
      // Apply region-specific movement constraints
      let movementVector = moveVector.clone().multiplyScalar(influence * smoothingFactor);
      
      // Apply anatomical constraints based on vertex and selected vertex regions
      if (isNoseTip && isVertexInTip) {
        // Enhance tip movement coherence - tip vertices move more together with improved coherence
        movementVector.multiplyScalar(1.5); // Increased multiplier for better tip coherence
        
        // Apply additional forward bias for more natural tip movement
        if (moveVector.z !== 0) {
          // Boost forward/backward movement for more natural tip reshaping
          const zComponent = new Vector3(0, 0, moveVector.z * 0.3);
          movementVector.add(zComponent);
        }
      } else if (isNostril && isVertexInNostril) {
        // Enhance nostril movement - same side nostrils move together with improved coherence
        const sameSide = Math.sign(relativeX) === Math.sign(vertexX - center.x);
        if (sameSide) {
          movementVector.multiplyScalar(1.6); // Increased multiplier for better nostril coherence
          
          // Apply additional vertical constraint for more natural flaring
          if (moveVector.y !== 0) {
            // Reduce vertical movement for more natural nostril shape
            movementVector.y *= 0.7;
          }
          
          // Enhance outward movement for better nostril flaring
          if (Math.sign(moveVector.x) === Math.sign(relativeX)) {
            // Boost outward movement for more natural flaring
            movementVector.x *= 1.3;
          }
        } else {
          // Opposite nostril moves less to maintain asymmetry
          movementVector.multiplyScalar(0.2); // Further reduced for better independence
        }
      } else if (isBridge && isVertexInBridge) {
        // Bridge vertices move more coherently for smoother bridge adjustments with improved coherence
        movementVector.multiplyScalar(1.4); // Increased multiplier for better bridge coherence
        
        // Limit lateral movement of bridge vertices for more natural deformation
        if (Math.abs(moveVector.x) > Math.abs(moveVector.y) && Math.abs(moveVector.x) > Math.abs(moveVector.z)) {
          movementVector.x *= 0.6; // Further reduced lateral movement for more natural bridge shape
        }
        
        // Enhance vertical movement for better bridge raising/lowering
        if (Math.abs(moveVector.y) > Math.abs(moveVector.x) && Math.abs(moveVector.y) > Math.abs(moveVector.z)) {
          // Apply non-linear scaling for more natural bridge height adjustment
          const heightFactor = 1.0 + (Math.abs(moveVector.y) * 0.5);
          movementVector.y *= heightFactor;
          
          // Apply coherence along the bridge center line
          const centerLineProximity = 1 - Math.min(1, Math.abs(relativeX) / (size.x * 0.1));
          movementVector.y *= (1 + centerLineProximity * 0.4);
        }
      } else if (isSideWall && isVertexInSideWall) {
        // Side wall coherence - maintain side wall shape with improved anatomical behavior
        const sameSide = Math.sign(relativeX) === Math.sign(vertexX - center.x);
        if (sameSide) {
          movementVector.multiplyScalar(1.4); // Increased multiplier for better side wall coherence
          
          // Apply additional vertical coherence for more natural side wall movement
          const verticalProximity = 1 - Math.min(1, Math.abs(relativeY - (vertexY - center.y)) / (size.y * 0.15));
          movementVector.multiplyScalar(1 + verticalProximity * 0.5);
          
          // Enhance outward movement for better side wall shaping
          if (Math.sign(moveVector.x) === Math.sign(relativeX)) {
            // Apply non-linear scaling for more natural side wall shaping
            const outwardFactor = 1.0 + (Math.abs(moveVector.x) * 0.4);
            movementVector.x *= outwardFactor;
          }
        } else {
          // Opposite side wall moves less for better independence
          movementVector.multiplyScalar(0.25); // Further reduced for better independence
        }
      } else if (isColumella && isVertexInColumella) {
        // Columella has restricted movement to maintain structural integrity
        movementVector.multiplyScalar(0.8);
        // Limit lateral movement of columella
        movementVector.x *= 0.6;
      }
      
      // Add tension forces to maintain structural integrity
      const tensionAdjustedVector = tensionVector.clone().multiplyScalar(1.0 - elasticityInfluence);
      
      // Combine all forces for realistic tissue behavior
      const targetPosition = originalPosition.clone()
        .add(movementVector)
        .add(tensionAdjustedVector);
      
      // Apply anatomical constraints to maintain realistic nose shape
      let constrainedPosition = targetPosition.clone();
      
      // Prevent extreme deformations by limiting movement range
      // Increase the max movement allowance for more responsive deformation
      const maxMovement = size.length() * 0.08; // Increased to 8% of model size for better responsiveness
      const movement = originalPosition.distanceTo(targetPosition);
      
      // Apply non-linear constraint for more natural deformation
      // This allows small movements to happen freely but increasingly constrains larger movements
      if (movement > maxMovement) {
        // Calculate a non-linear scaling factor that provides smoother constraint
        const nonLinearFactor = maxMovement * (1 + Math.log(movement / maxMovement) * 0.5);
        const direction = new Vector3().subVectors(targetPosition, originalPosition).normalize();
        constrainedPosition = originalPosition.clone().add(direction.multiplyScalar(nonLinearFactor));
      }
      
      // Apply the movement while maintaining anatomical structure
      positions.setXYZ(
        vertexIndex,
        constrainedPosition.x,
        constrainedPosition.y,
        constrainedPosition.z
      );
    }
    
    // Update the visual indicator position
    if (scene) {
      // Update the highlight position
      const highlight = scene.getObjectByName('selectedVertexHighlight');
      if (highlight) {
        highlight.position.copy(localTargetPosition);
        highlight.position.applyMatrix4(noseMeshRef.current.matrixWorld);
      }
      
      // Also update the marker position
      const marker = scene.getObjectByName(`vertexMarker-${selectedVertex}`);
      if (marker) {
        marker.position.copy(localTargetPosition);
        marker.position.applyMatrix4(noseMeshRef.current.matrixWorld);
      }
    }
    
    // Recompute normals
    noseMeshRef.current.geometry.computeVertexNormals();
    
    // Force a render update
    if (scene?.userData.needsUpdate !== undefined) {
      scene.userData.needsUpdate = true;
    }
  };
  
  // Handle mouse up event
  const handleMouseUp = () => {
    console.log('DEBUGGING: handleMouseUp - Drag ended for vertex', selectedVertex);
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Keep the vertex selected but stop dragging
    if (noseMeshRef.current) {
      // Make sure to update the geometry
      noseMeshRef.current.geometry.attributes.position.needsUpdate = true;
      noseMeshRef.current.geometry.computeVertexNormals();
      
      // Force a render update
      if (scene?.userData.needsUpdate !== undefined) {
        scene.userData.needsUpdate = true;
      }
    }
  };
  
  // Handle mouse down for vertex selection - modified to be more flexible
  const handleMouseDownLocal = (event: MouseEvent | { clientX: number; clientY: number }) => {
    console.log('DEBUGGING: handleMouseDown called with edit mode =', isEditMode, 
                'noseMesh =', !!noseMeshRef.current, 
                'camera =', !!camera);
    
    // Force edit mode to be considered active for debugging
    const editModeActive = true; // Override the isEditMode check temporarily
    
    if (!editModeActive) {
      console.warn('DEBUGGING: Cannot handle mouse down - edit mode is inactive');
      return;
    }
    
    if (!noseMeshRef.current) {
      console.warn('DEBUGGING: Cannot handle mouse down - noseMesh is null');
      return;
    }
    
    if (!camera) {
      console.warn('DEBUGGING: Cannot handle mouse down - camera is null');
      return;
    }
    
    // Get canvas dimensions
    let canvas: HTMLElement;
    
    if (event instanceof MouseEvent && event.target) {
      canvas = event.target as HTMLElement;
    } else {
      // If not a MouseEvent, try to find the canvas
      const foundCanvas = canvasRef.current || document.querySelector('canvas');
      if (!foundCanvas) {
        console.error('NoseEditor: No canvas found for mouse interaction');
        return;
      }
      canvas = foundCanvas;
    }
    
    const rect = canvas.getBoundingClientRect();
    
    // Calculate mouse position in normalized device coordinates
    const mouse = new Vector3(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
      0.5
    );
    
    console.log('DEBUGGING: Mouse click at NDC:', mouse);
    
    // Raycasting to find intersected vertices
    const raycaster = new Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    // First, check if we hit any of the vertex markers directly
    const markerObjects = scene?.children.filter(child => 
      child.name && child.name.startsWith('vertexMarker-')
    ) || [];
    
    console.log('DEBUGGING: Found', markerObjects.length, 'marker objects to test');
    
    const markerIntersects = raycaster.intersectObjects(markerObjects, true);
    console.log('DEBUGGING: Marker intersects:', markerIntersects.length);
    
    if (markerIntersects.length > 0) {
      // We hit a marker directly
      const hitMarker = markerIntersects[0].object;
      const vertexIndex = hitMarker.userData.vertexIndex;
      
      console.log(`DEBUGGING: Selected vertex ${vertexIndex} via marker`);
      setSelectedVertex(vertexIndex);
      
      // Highlight the selected vertex
      highlightSelectedVertex(vertexIndex);
      
      // Start tracking mouse movement for dragging
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return;
    }
    
    // If we didn't hit a marker, try to find the closest vertex as before
    if (!noseMeshRef.current) {
      console.warn('DEBUGGING: noseMeshRef.current became null');
      return;
    }
    
    const intersects = raycaster.intersectObject(noseMeshRef.current, true);
    console.log('DEBUGGING: Mesh intersects:', intersects.length);
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      console.log('Intersection point:', intersect.point);
      
      // Find the closest vertex to the intersection point
      if (noseMeshRef.current.geometry instanceof THREE.BufferGeometry) {
        const positions = noseMeshRef.current.geometry.attributes.position;
        let closestVertex = -1;
        let minDistance = Infinity;
        
        // Only consider vertices in the nose region
        for (const vertexIndex of noseVertices) {
          const x = positions.getX(vertexIndex);
          const y = positions.getY(vertexIndex);
          const z = positions.getZ(vertexIndex);
          
          const vertexPosition = new Vector3(x, y, z);
          // Apply world matrix to get the vertex position in world space
          vertexPosition.applyMatrix4(noseMeshRef.current.matrixWorld);
          
          const distance = vertexPosition.distanceTo(intersect.point);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestVertex = vertexIndex;
          }
        }
        
        // Increase the selection threshold for easier vertex selection
        const selectionThreshold = 0.1;
        
        if (closestVertex !== -1 && minDistance < selectionThreshold) {
          console.log(`Selected vertex ${closestVertex} at distance ${minDistance}`);
          setSelectedVertex(closestVertex);
          
          // Highlight the selected vertex
          highlightSelectedVertex(closestVertex);
          
          // Start tracking mouse movement for dragging
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        } else {
          console.log(`No vertex selected. Closest was ${closestVertex} at distance ${minDistance}`);
        }
      }
    }
  };
  
  // Near the top of the component, add a state variable for marker density
  const [markerDensity, setMarkerDensity] = useState<'low' | 'medium' | 'high'>('low');
  
  // Show vertex markers when in edit mode - with improved visibility
  useEffect(() => {
    console.log('DEBUGGING: Vertex marker effect triggered, isEditMode =', isEditMode, 'noseMesh =', !!noseMeshRef.current);
    
    if (!isEditMode) {
      console.log('DEBUGGING: Edit mode is off, not showing markers');
      return;
    }
    
    if (!noseMeshRef.current || !scene) {
      console.log('DEBUGGING: Missing noseMesh or scene for vertex markers');
      return;
    }
    
    // Remove any existing markers first
    const existingMarkers = scene.children.filter(child => 
      child.name && child.name.startsWith('vertexMarker-')
    );
    existingMarkers.forEach(marker => scene.remove(marker));
    
    console.log('DEBUGGING: Adding vertex markers for edit mode, vertices count:', noseVertices.length);
    
    try {
      // Get the geometry to access vertex positions
      const positions = noseMeshRef.current.geometry.attributes.position;
      
      // Calculate an appropriate size for markers based on model dimensions
      const box = new THREE.Box3().setFromObject(noseMeshRef.current);
      const size = box.getSize(new Vector3());
      const markerSize = Math.min(size.x, size.y, size.z) * 0.008; // Much smaller markers
      
      console.log('DEBUGGING: Model size:', size, 'Marker size:', markerSize);
      
      // First, find the center of the face (assuming the model is centered)
      const center = new Vector3();
      box.getCenter(center);
      
      // Define the nose region more precisely - focus on the actual nose area
      const noseRegion = {
        minX: center.x - size.x * 0.08,
        maxX: center.x + size.x * 0.08,
        minY: center.y - size.y * 0.05,
        maxY: center.y + size.y * 0.2,  // Reduced vertical range
        minZ: center.z + size.z * 0.1,  // Start a bit forward from center
        maxZ: center.z + size.z * 0.5   // Most protruding part
      };
      
      console.log('DEBUGGING: Nose region defined as:', noseRegion);
      
      // Collect all vertices in the nose region
      const noseVertexData = [];
      
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        
        // Check if this vertex is in the nose region
        if (x >= noseRegion.minX && x <= noseRegion.maxX &&
            y >= noseRegion.minY && y <= noseRegion.maxY &&
            z >= noseRegion.minZ && z <= noseRegion.maxZ) {
          
          noseVertexData.push({
            index: i,
            position: new Vector3(x, y, z),
            // Calculate distance from center of nose region for coloring
            distanceFromCenter: new Vector3(x, y, z).distanceTo(new Vector3(center.x, center.y, noseRegion.maxZ))
          });
        }
      }
      
      console.log('DEBUGGING: Found', noseVertexData.length, 'vertices in nose region');
      
      // Improved detection of key anatomical points
      
      // 1. Find the tip (most forward Z point)
      const tipVertex = noseVertexData.reduce((prev, current) => 
        current.position.z > prev.position.z ? current : prev
      , noseVertexData[0]);
      
      // 2. Find the bridge (highest Y point near center X)
      const bridgeVertex = noseVertexData.reduce((prev, current) => {
        const isNearCenterX = Math.abs(current.position.x - center.x) < size.x * 0.03;
        const isHighEnough = current.position.y > center.y + size.y * 0.05;
        return isNearCenterX && isHighEnough && current.position.y > prev.position.y ? current : prev;
      }, noseVertexData[0]);
      
      // 3. Find left and right nostrils (lowest Y points with X distance from center)
      const leftNostril = noseVertexData.reduce((prev, current) => {
        const isLowerNose = current.position.y < center.y - size.y * 0.02;
        const isLeftSide = current.position.x < center.x - size.x * 0.02;
        return isLowerNose && isLeftSide && current.position.x < prev.position.x ? current : prev;
      }, noseVertexData.find(v => v.position.x < center.x - size.x * 0.02) || noseVertexData[0]);
      
      const rightNostril = noseVertexData.reduce((prev, current) => {
        const isLowerNose = current.position.y < center.y - size.y * 0.02;
        const isRightSide = current.position.x > center.x + size.x * 0.02;
        return isLowerNose && isRightSide && current.position.x > prev.position.x ? current : prev;
      }, noseVertexData.find(v => v.position.x > center.x + size.x * 0.02) || noseVertexData[0]);
      
      // 4. Find the bridge sides (left and right of bridge)
      const leftBridgeVertex = noseVertexData.reduce((prev, current) => {
        const isUpperNose = current.position.y > center.y;
        const isLeftSide = current.position.x < center.x - size.x * 0.03;
        return isUpperNose && isLeftSide ? current : prev;
      }, noseVertexData.find(v => v.position.x < center.x - size.x * 0.03 && v.position.y > center.y) || noseVertexData[0]);
      
      const rightBridgeVertex = noseVertexData.reduce((prev, current) => {
        const isUpperNose = current.position.y > center.y;
        const isRightSide = current.position.x > center.x + size.x * 0.03;
        return isUpperNose && isRightSide ? current : prev;
      }, noseVertexData.find(v => v.position.x > center.x + size.x * 0.03 && v.position.y > center.y) || noseVertexData[0]);
      
      // 5. Find middle point between tip and bridge
      const midBridgeVertex = noseVertexData.reduce((prev, current) => {
        if (!bridgeVertex || !tipVertex) return prev;
        
        const bridgePos = bridgeVertex.position;
        const tipPos = tipVertex.position;
        
        // Calculate midpoint between bridge and tip
        const midPoint = new Vector3(
          (bridgePos.x + tipPos.x) / 2,
          (bridgePos.y + tipPos.y) / 2,
          (bridgePos.z + tipPos.z) / 2
        );
        
        // Find vertex closest to this midpoint
        const distToMidpoint = current.position.distanceTo(midPoint);
        const prevDistToMidpoint = prev.position.distanceTo(midPoint);
        
        return distToMidpoint < prevDistToMidpoint ? current : prev;
      }, noseVertexData[0]);
      
      // Define key points with names, colors, and sizes
      const keyPoints = [
        { vertex: tipVertex, name: 'tip', color: 0xff0000, size: 1.5, label: 'Nose Tip' },
        { vertex: bridgeVertex, name: 'bridge', color: 0x00ff00, size: 1.5, label: 'Bridge' },
        { vertex: leftNostril, name: 'leftNostril', color: 0x0000ff, size: 1.5, label: 'Left Nostril' },
        { vertex: rightNostril, name: 'rightNostril', color: 0x0000ff, size: 1.5, label: 'Right Nostril' },
        { vertex: leftBridgeVertex, name: 'leftBridge', color: 0xffff00, size: 1.5, label: 'Left Bridge' },
        { vertex: rightBridgeVertex, name: 'rightBridge', color: 0xffff00, size: 1.5, label: 'Right Bridge' },
        { vertex: midBridgeVertex, name: 'midBridge', color: 0xff00ff, size: 1.5, label: 'Mid Bridge' }
      ];
      
      // Add additional points based on marker density
      let pointsToShow = [...keyPoints];
      
      if (markerDensity === 'medium' || markerDensity === 'high') {
        // Add more points around each key anatomical region
        
        // Additional points around the tip
        const tipRegion = noseVertexData.filter(v => {
          if (!tipVertex) return false;
          const distToTip = v.position.distanceTo(tipVertex.position);
          return distToTip < size.x * 0.05 && v.index !== tipVertex.index;
        });
        
        // Additional points around the bridge
        const bridgeRegion = noseVertexData.filter(v => {
          if (!bridgeVertex) return false;
          const distToBridge = v.position.distanceTo(bridgeVertex.position);
          return distToBridge < size.x * 0.05 && v.index !== bridgeVertex.index;
        });
        
        // Additional points around the nostrils
        const nostrilRegion = noseVertexData.filter(v => {
          if (!leftNostril || !rightNostril) return false;
          const distToLeftNostril = v.position.distanceTo(leftNostril.position);
          const distToRightNostril = v.position.distanceTo(rightNostril.position);
          return (distToLeftNostril < size.x * 0.05 || distToRightNostril < size.x * 0.05) && 
                 v.index !== leftNostril.index && v.index !== rightNostril.index;
        });
        
        // Add a moderate number of additional points for medium density
        const addMediumDensityPoints = (region: any[], count: number, regionName: string, color: number) => {
          if (region.length === 0) return [];
          
          // Sort by distance from center for varied selection
          region.sort((a, b) => a.distanceFromCenter - b.distanceFromCenter);
          
          // Select evenly spaced points
          const step = Math.max(1, Math.floor(region.length / count));
          return region.filter((_, i) => i % step === 0).slice(0, count).map(v => ({
            vertex: v,
            name: `${regionName}-${v.index}`,
            color: color,
            size: 1.2,
            label: `${regionName} ${v.index}`,
            region: regionName
          }));
        };
        
        // Add points based on density
        if (markerDensity === 'medium') {
          // Add a moderate number of additional points
          pointsToShow = [
            ...pointsToShow,
            ...addMediumDensityPoints(tipRegion, 3, 'tip', 0xff0000),
            ...addMediumDensityPoints(bridgeRegion, 4, 'bridge', 0x00ff00),
            ...addMediumDensityPoints(nostrilRegion, 4, 'nostril', 0x0000ff)
          ];
        } else if (markerDensity === 'high') {
          // Add many additional points for high density
          pointsToShow = [
            ...pointsToShow,
            ...addMediumDensityPoints(tipRegion, 8, 'tip', 0xff0000),
            ...addMediumDensityPoints(bridgeRegion, 10, 'bridge', 0x00ff00),
            ...addMediumDensityPoints(nostrilRegion, 10, 'nostril', 0x0000ff)
          ];
        }
      }
      
      // Only show these key anatomical points instead of all vertices
      pointsToShow.forEach(point => {
        if (!point.vertex) return;
        
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(markerSize * point.size),
          new THREE.MeshBasicMaterial({ 
            color: point.color,
            transparent: true,
            opacity: 0.9,
            depthTest: false
          })
        );
        
        marker.name = `vertexMarker-${point.name}-${point.vertex.index}`;
        marker.userData.vertexIndex = point.vertex.index;
        marker.userData.label = point.label;
        
        marker.position.copy(point.vertex.position);
        marker.position.applyMatrix4(noseMeshRef.current.matrixWorld);
        
        marker.renderOrder = 10001;
        
        scene.add(marker);
        console.log(`DEBUGGING: Added ${point.name} marker at position:`, marker.position);
      });
      
      // Force a render update
      if (scene.userData.needsUpdate !== undefined) {
        scene.userData.needsUpdate = true;
      }
    } catch (error) {
      console.error('DEBUGGING: Error creating markers:', error);
    }
    
    // Return a cleanup function
    return () => {
      const markersToRemove = scene.children.filter(child => 
        child.name && (child.name.startsWith('vertexMarker-') || child.name === 'selectedVertexHighlight')
      );
      markersToRemove.forEach(marker => scene.remove(marker));
    };
  }, [isEditMode, noseMesh, scene, noseVertices, markerDensity]); // Added markerDensity to dependencies
  
  // Find and attach to the canvas element
  useEffect(() => {
    // Always try to find the canvas, even if not in edit mode
    // This ensures we're ready when edit mode is activated
    
    // Find the canvas element - try different selectors
    let canvas = document.querySelector('canvas');
    
    // If not found, try to find it in the scene container
    if (!canvas) {
      const container = document.getElementById('scene-container');
      if (container) {
        canvas = container.querySelector('canvas');
      }
    }
    
    if (canvas) {
      console.log('NoseEditor: Found canvas element, attaching mouse handlers');
      canvasRef.current = canvas;
      
      // Create a wrapper function that can be used with addEventListener
      const mouseDownHandler = (event: MouseEvent) => {
        console.log('NoseEditor: Mouse down event detected, isEditMode =', isEditMode);
        
        if (isEditMode && noseMesh && camera && scene) {
          handleMouseDownLocal(event);
        } else {
          console.log('NoseEditor: Cannot handle mouse down - conditions not met:',
                     'isEditMode =', isEditMode,
                     'noseMesh =', !!noseMesh,
                     'camera =', !!camera,
                     'scene =', !!scene);
        }
      };
      
      // Attach the mouse down handler
      canvas.addEventListener('mousedown', mouseDownHandler);
      
      // Store canvas reference in camera for raycasting
      if (camera) {
        camera.userData.canvas = canvas;
      }
      
      // Cleanup function
      return () => {
        console.log('NoseEditor: Removing mouse event listeners');
        canvas.removeEventListener('mousedown', mouseDownHandler);
      };
    } else {
      console.warn('NoseEditor: No canvas element found for mouse interaction');
    }
  }, [isEditMode, camera, noseMesh, scene, handleMouseDownLocal]); // Include all dependencies
  
  // Expose the adjustment functions and interaction handlers to the parent component
  // In the useEffect that exposes functions to window.noseEditor
  useEffect(() => {
    console.log('NoseEditor: Exposing functions to window.noseEditor');
    
    if (window) {
      // Create a wrapper for handleMouseDown that can be called from other components
      const handleMouseDownWrapper = (x: number, y: number) => {
        console.log('DEBUGGING: External handleMouseDown called with:', 
                    'x =', x, 'y =', y, 
                    'isEditMode =', isEditMode, 
                    'noseMeshRef.current =', !!noseMeshRef.current, 
                    'camera =', !!camera);
        
        // Force edit mode to be considered active for debugging
        const editModeActive = true; // Override the isEditMode check temporarily
        
        if (!editModeActive) {
          console.warn('DEBUGGING: Cannot handle mouse down - edit mode is inactive');
          return;
        }
        
        if (!noseMeshRef.current) {
          console.warn('DEBUGGING: Cannot handle mouse down - noseMesh is null');
          return;
        }
        
        if (!camera) {
          console.warn('DEBUGGING: Cannot handle mouse down - camera is null');
          return;
        }
        
        // Create a synthetic event with the coordinates
        const syntheticEvent = { clientX: x, clientY: y };
        handleMouseDownLocal(syntheticEvent);
      };
      
      // Add a function to change marker density
      const setMarkerDensityWrapper = (density: 'low' | 'medium' | 'high') => {
        console.log('DEBUGGING: Setting marker density to', density);
        setMarkerDensity(density);
      };
      
      // @ts-ignore
      window.noseEditor = {
        resetNose,
        adjustNoseBridge,
        adjustNoseTip,
        adjustNostrilWidth,
        handleMouseDown: handleMouseDownWrapper,
        setMarkerDensity: setMarkerDensityWrapper,
        _currentDensity: markerDensity // Add this to expose the current density
      };
      
      console.log('DEBUGGING: Functions exposed successfully', 
                  'isEditMode =', isEditMode, 
                  'noseMeshRef.current =', !!noseMeshRef.current, 
                  'camera =', !!camera);
    }
  }, [resetNose, adjustNoseBridge, adjustNoseTip, adjustNostrilWidth, isEditMode, camera, noseMeshRef.current, markerDensity]); // Add markerDensity to dependencies
  
  // Add a debug effect to show when edit mode is activated
  useEffect(() => {
    console.log('DEBUGGING: Edit mode changed to', isEditMode);
    
    if (!scene) return;
    
    // Remove any existing debug indicator
    const existingIndicator = scene.getObjectByName('editModeIndicator');
    if (existingIndicator) scene.remove(existingIndicator);
    
    if (isEditMode) {
      // Create a large, obvious indicator that edit mode is active
      const geometry = new THREE.SphereGeometry(0.5);
      const material = new THREE.MeshBasicMaterial({ 
        color: 0xff00ff,
        transparent: true,
        opacity: 0.7,
        depthTest: false
      });
      
      const indicator = new THREE.Mesh(geometry, material);
      indicator.name = 'editModeIndicator';
      indicator.position.set(0, 0, 0);
      indicator.renderOrder = 10000;
      
      scene.add(indicator);
      console.log('DEBUGGING: Added edit mode indicator to scene');
      
      // Also add a text message to the DOM
      const message = document.createElement('div');
      message.id = 'debug-message';
      message.style.position = 'fixed';
      message.style.top = '100px';
      message.style.left = '50%';
      message.style.transform = 'translateX(-50%)';
      message.style.backgroundColor = 'red';
      message.style.color = 'white';
      message.style.padding = '10px 20px';
      message.style.borderRadius = '5px';
      message.style.zIndex = '9999';
      message.style.fontWeight = 'bold';
      message.textContent = 'EDIT MODE ACTIVE - DEBUG';
      
      document.body.appendChild(message);
    } else {
      // Remove the debug message if it exists
      const message = document.getElementById('debug-message');
      if (message) {
        document.body.removeChild(message);
      }
    }
    
    return () => {
      // Clean up
      const indicator = scene.getObjectByName('editModeIndicator');
      if (indicator) scene.remove(indicator);
      
      const message = document.getElementById('debug-message');
      if (message) {
        document.body.removeChild(message);
      }
    };
  }, [isEditMode, scene]);
  
  return null; // This is a logic component, no rendering needed
};

export default NoseEditor;