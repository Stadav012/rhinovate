import { useRef, useState, useEffect } from 'react';
import { Group, Mesh, Vector3, BufferGeometry, Raycaster, MeshBasicMaterial, BoxGeometry } from 'three';
import * as THREE from 'three';

interface AnatomicalMeshEditorProps {
  model: Group | null;
  isEditMode: boolean;
  camera?: THREE.Camera;
  scene?: THREE.Scene;
}

// Define anatomical regions of the nose
type NoseRegion = 'bridge' | 'tip' | 'leftNostril' | 'rightNostril' | 'leftSidewall' | 'rightSidewall' | 'columella';

interface ControlPoint {
  position: Vector3;
  region: NoseRegion;
  mesh: THREE.Mesh;
  influenceRadius: number;
  vertexIndices: number[];
}

/**
 * AnatomicalMeshEditor provides a control mesh for editing the nose by anatomical regions
 * rather than individual vertices, which is more intuitive for surgeons and better represents
 * how actual rhinoplasty procedures modify anatomical structures.
 */
const AnatomicalMeshEditor = ({ model, isEditMode, camera, scene }: AnatomicalMeshEditorProps) => {
  const noseMeshRef = useRef<Mesh | null>(null);
  const [noseMesh, setNoseMesh] = useState<Mesh | null>(null);
  const [originalGeometry, setOriginalGeometry] = useState<BufferGeometry | null>(null);
  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([]);
  const [selectedControlPoint, setSelectedControlPoint] = useState<ControlPoint | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [anatomicalMeshVisible, setAnatomicalMeshVisible] = useState(true);
  
  // Find the nose mesh in the model
  useEffect(() => {
    console.log('AnatomicalMeshEditor: Model effect triggered, model =', !!model);
    
    if (!model) return;
    
    console.log('AnatomicalMeshEditor: Searching for nose mesh in model');
    
    let foundNoseMesh: Mesh | null = null;
    
    // Find the first mesh in the model
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        console.log('AnatomicalMeshEditor: Found mesh:', child.name || 'unnamed mesh', 
                    'visible:', child.visible, 
                    'geometry vertices:', child.geometry.attributes.position?.count);
        
        if (!foundNoseMesh) {
          foundNoseMesh = child;
        }
      }
    });
    
    if (foundNoseMesh) {
      console.log('AnatomicalMeshEditor: Setting nose mesh:', foundNoseMesh.name || 'unnamed mesh');
      
      // Make sure the mesh is visible
      foundNoseMesh.visible = true;
      
      // Store the original geometry for reset functionality
      if (foundNoseMesh.geometry instanceof THREE.BufferGeometry) {
        const originalGeometryCopy = foundNoseMesh.geometry.clone();
        setOriginalGeometry(originalGeometryCopy);
        console.log('AnatomicalMeshEditor: Stored original geometry with', 
                    originalGeometryCopy.attributes.position.count, 'vertices');
      }
      
      setNoseMesh(foundNoseMesh);
      noseMeshRef.current = foundNoseMesh;
    } else {
      console.warn('AnatomicalMeshEditor: No mesh found in the model');
    }
  }, [model]);

  // Create anatomical control mesh when nose mesh is available and edit mode is active
  useEffect(() => {
    if (!noseMesh || !scene || !isEditMode) {
      // Clean up any existing control points if edit mode is turned off
      if (!isEditMode && controlPoints.length > 0) {
        cleanupControlPoints();
      }
      return;
    }

    console.log('AnatomicalMeshEditor: Creating anatomical control mesh');
    
    // Clean up any existing control points first
    cleanupControlPoints();
    
    // Create the anatomical control mesh
    createAnatomicalControlMesh();
    
    // Add event listeners for mouse interaction
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      // Clean up event listeners
      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseup', handleMouseUp);
      }
      
      // Clean up control points
      cleanupControlPoints();
    };
  }, [noseMesh, scene, isEditMode]);

  // Clean up control points
  const cleanupControlPoints = () => {
    if (!scene) return;
    
    // Remove all control point meshes from the scene
    controlPoints.forEach(cp => {
      scene.remove(cp.mesh);
    });
    
    // Remove anatomical region visualizations (both solid and wireframe)
    const regionMeshes = scene.children.filter(child => 
      child.name && (
        child.name.startsWith('anatomicalRegion-') ||
        child.name.startsWith('anatomicalRegionWireframe-')
      )
    );
    regionMeshes.forEach(mesh => scene.remove(mesh));
    
    // Clear the control points array
    setControlPoints([]);
    setSelectedControlPoint(null);
  };

  // Create the anatomical control mesh
  const createAnatomicalControlMesh = () => {
    if (!noseMesh || !scene) return;
    
    const geometry = noseMesh.geometry;
    const positions = geometry.attributes.position;
    const vertexCount = positions.count;
    
    // Get model dimensions
    const box = new THREE.Box3().setFromObject(noseMesh);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    
    console.log('AnatomicalMeshEditor: Model center:', center, 'size:', size);
    
    // Create control points for each anatomical region
    const newControlPoints: ControlPoint[] = [];
    
    // Calculate appropriate control point size based on model dimensions
    // Slightly smaller control points for better precision
    const controlPointSize = Math.min(size.x, size.y, size.z) * 0.04;
    
    // First, find the nose tip to better position our control points
    let noseTipPosition = new Vector3();
    let maxZ = -Infinity;
    
    // Find the most protruding point in the central region (nose tip)
    for (let i = 0; i < vertexCount; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      // Calculate normalized position relative to bounding box
      const normalizedX = (x - (center.x - size.x/2)) / size.x;
      const normalizedY = (y - (center.y - size.y/2)) / size.y;
      const normalizedZ = (z - (center.z - size.z/2)) / size.z;
      
      // Look for the most protruding point in the central face region
      if (normalizedX >= 0.45 && normalizedX <= 0.55 && 
          normalizedY >= 0.45 && normalizedY <= 0.6 && 
          normalizedZ > 0.7) {
        if (z > maxZ) {
          maxZ = z;
          noseTipPosition.set(x, y, z);
        }
      }
    }
    
    // If we couldn't find a nose tip with strict criteria, use a more relaxed approach
    if (maxZ === -Infinity) {
      console.log('AnatomicalMeshEditor: Using relaxed criteria to find nose tip');
      
      for (let i = 0; i < vertexCount; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        
        // Calculate normalized position
        const normalizedX = (x - (center.x - size.x/2)) / size.x;
        const normalizedY = (y - (center.y - size.y/2)) / size.y;
        const normalizedZ = (z - (center.z - size.z/2)) / size.z;
        
        // Wider area but still focused on the front center
        if (normalizedX >= 0.4 && normalizedX <= 0.6 && 
            normalizedY >= 0.4 && normalizedY <= 0.65 && 
            normalizedZ > 0.6) {
          if (z > maxZ) {
            maxZ = z;
            noseTipPosition.set(x, y, z);
          }
        }
      }
    }
    
    // If we still couldn't find a nose tip, use the center of the front face
    if (maxZ === -Infinity) {
      console.log('AnatomicalMeshEditor: Using center of front face as nose tip');
      noseTipPosition.set(center.x, center.y, center.z + size.z/2);
    }
    
    console.log('AnatomicalMeshEditor: Identified nose tip at position:', noseTipPosition);
    
    // Now position control points relative to the detected nose tip
    // This ensures the control points are actually on the nose
    console.log('AnatomicalMeshEditor: Positioning control points relative to nose tip at', noseTipPosition);
    
    // Calculate a better scale factor based on the model size
    // This helps ensure the control points are properly scaled for different model sizes
    const scaleFactor = Math.max(size.x, size.y, size.z) * 0.01;
    
    // 1. Bridge control point - above the nose tip
    // Position it higher up and slightly back from the tip
    const bridgePosition = new Vector3(
      noseTipPosition.x, 
      noseTipPosition.y + size.y * 0.15, 
      noseTipPosition.z - size.z * 0.12
    );
    const bridgeControlPoint = createControlPoint('bridge', bridgePosition, 0x3498db, controlPointSize);
    newControlPoints.push(bridgeControlPoint);
    
    // 2. Tip control point - at the nose tip
    // Keep this exactly at the detected tip
    const tipPosition = new Vector3(
      noseTipPosition.x,
      noseTipPosition.y,
      noseTipPosition.z
    );
    const tipControlPoint = createControlPoint('tip', tipPosition, 0xe74c3c, controlPointSize);
    newControlPoints.push(tipControlPoint);
    
    // 3. Left nostril control point - below and to the left of the tip
    // Position it more accurately for the nostril
    const leftNostrilPosition = new Vector3(
      noseTipPosition.x - size.x * 0.12,
      noseTipPosition.y - size.y * 0.1,
      noseTipPosition.z - size.z * 0.08
    );
    const leftNostrilControlPoint = createControlPoint('leftNostril', leftNostrilPosition, 0x2ecc71, controlPointSize);
    newControlPoints.push(leftNostrilControlPoint);
    
    // 4. Right nostril control point - below and to the right of the tip
    // Position it more accurately for the nostril
    const rightNostrilPosition = new Vector3(
      noseTipPosition.x + size.x * 0.12,
      noseTipPosition.y - size.y * 0.1,
      noseTipPosition.z - size.z * 0.08
    );
    const rightNostrilControlPoint = createControlPoint('rightNostril', rightNostrilPosition, 0x2ecc71, controlPointSize);
    newControlPoints.push(rightNostrilControlPoint);
    
    // 5. Left sidewall control point - to the left of the tip
    // Position it more accurately for the sidewall
    const leftSidewallPosition = new Vector3(
      noseTipPosition.x - size.x * 0.15,
      noseTipPosition.y + size.y * 0.08,
      noseTipPosition.z - size.z * 0.1
    );
    const leftSidewallControlPoint = createControlPoint('leftSidewall', leftSidewallPosition, 0x9b59b6, controlPointSize);
    newControlPoints.push(leftSidewallControlPoint);
    
    // 6. Right sidewall control point - to the right of the tip
    // Position it more accurately for the sidewall
    const rightSidewallPosition = new Vector3(
      noseTipPosition.x + size.x * 0.15,
      noseTipPosition.y + size.y * 0.08,
      noseTipPosition.z - size.z * 0.1
    );
    const rightSidewallControlPoint = createControlPoint('rightSidewall', rightSidewallPosition, 0x9b59b6, controlPointSize);
    newControlPoints.push(rightSidewallControlPoint);
    
    // 7. Columella control point - below the tip
    // Position it more accurately for the columella
    const columellaPosition = new Vector3(
      noseTipPosition.x,
      noseTipPosition.y - size.y * 0.08,
      noseTipPosition.z - size.z * 0.06
    );
    const columellaControlPoint = createControlPoint('columella', columellaPosition, 0xf39c12, controlPointSize);
    newControlPoints.push(columellaControlPoint);
    
    // Log the positions of all control points for debugging
    console.log('AnatomicalMeshEditor: Created control points at positions:');
    newControlPoints.forEach(cp => {
      console.log(`${cp.region}:`, cp.position);
    });
    
    // Assign vertices to each control point based on proximity and region
    for (let i = 0; i < vertexCount; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const vertexPosition = new Vector3(x, y, z);
      
      // Determine which anatomical region this vertex belongs to
      // Normalized position relative to bounding box
      const normalizedX = (x - (center.x - size.x/2)) / size.x;
      const normalizedY = (y - (center.y - size.y/2)) / size.y;
      const normalizedZ = (z - (center.z - size.z/2)) / size.z;
      
      // Calculate distance to nose tip - useful for region assignment
      const distanceToTip = vertexPosition.distanceTo(noseTipPosition);
      const normalizedDistanceToTip = distanceToTip / Math.max(size.x, size.y, size.z);
      
      // First, filter vertices to only include those on the front portion of the face
      // This helps exclude vertices from the back of the head or other facial features
      if (normalizedZ < 0.5 && normalizedDistanceToTip > 0.3) {
        // Skip vertices that are clearly not part of the nose
        continue;
      }
      
      // Find the closest control point as a starting point
      let closestControlPoint = newControlPoints[0];
      let minDistance = vertexPosition.distanceTo(closestControlPoint.position);
      
      for (let j = 1; j < newControlPoints.length; j++) {
        const distance = vertexPosition.distanceTo(newControlPoints[j].position);
        if (distance < minDistance) {
          minDistance = distance;
          closestControlPoint = newControlPoints[j];
        }
      }
      
      // More precise region-specific logic to improve vertex assignment
      // Bridge region: upper central part of nose
      if (normalizedY > 0.55 && Math.abs(normalizedX - 0.5) < 0.15 && normalizedZ > 0.6) {
        const bridgeCP = newControlPoints.find(cp => cp.region === 'bridge');
        if (bridgeCP) closestControlPoint = bridgeCP;
      }
      // Tip region: front central part of nose
      else if (normalizedZ > 0.75 && Math.abs(normalizedX - 0.5) < 0.15 && normalizedY > 0.45 && normalizedY < 0.6) {
        const tipCP = newControlPoints.find(cp => cp.region === 'tip');
        if (tipCP) closestControlPoint = tipCP;
      }
      // Nostril regions: lower sides
      else if (normalizedY < 0.45 && normalizedZ > 0.6) {
        if (normalizedX < 0.45) {
          const leftNostrilCP = newControlPoints.find(cp => cp.region === 'leftNostril');
          if (leftNostrilCP) closestControlPoint = leftNostrilCP;
        } else if (normalizedX > 0.55) {
          const rightNostrilCP = newControlPoints.find(cp => cp.region === 'rightNostril');
          if (rightNostrilCP) closestControlPoint = rightNostrilCP;
        }
      }
      // Columella: central lower part
      else if (normalizedY < 0.5 && Math.abs(normalizedX - 0.5) < 0.1 && normalizedZ > 0.65) {
        const columellaCP = newControlPoints.find(cp => cp.region === 'columella');
        if (columellaCP) closestControlPoint = columellaCP;
      }
      // Sidewalls: sides of the nose
      else if (normalizedY > 0.4 && normalizedY < 0.6 && normalizedZ > 0.6) {
        if (normalizedX < 0.45) {
          const leftSidewallCP = newControlPoints.find(cp => cp.region === 'leftSidewall');
          if (leftSidewallCP) closestControlPoint = leftSidewallCP;
        } else if (normalizedX > 0.55) {
          const rightSidewallCP = newControlPoints.find(cp => cp.region === 'rightSidewall');
          if (rightSidewallCP) closestControlPoint = rightSidewallCP;
        }
      }
      
      // Only add vertices that are within a reasonable distance of the control point
      // This prevents regions from extending too far
      const maxInfluenceDistance = Math.max(size.x, size.y, size.z) * 0.2; // 20% of model size
      if (minDistance < maxInfluenceDistance) {
        // Add this vertex to the control point's influence
        closestControlPoint.vertexIndices.push(i);
      }
    }
    
    // Create visual representation of anatomical regions
    if (anatomicalMeshVisible) {
      createAnatomicalRegionVisualizations(newControlPoints);
    }
    
    // Update state with new control points
    setControlPoints(newControlPoints);
    
    console.log('AnatomicalMeshEditor: Created', newControlPoints.length, 'control points');
    newControlPoints.forEach(cp => {
      console.log(`Region ${cp.region} has ${cp.vertexIndices.length} vertices`);
    });
  };

  // Create a control point
  const createControlPoint = (region: NoseRegion, position: Vector3, color: number, size: number): ControlPoint => {
    if (!scene) {
      throw new Error('Scene is required to create control points');
    }
    
    // Create a mesh for the control point
    const geometry = new THREE.SphereGeometry(size);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9, // More opaque for better visibility
      depthTest: false // Always render on top
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.name = `controlPoint-${region}`;
    mesh.renderOrder = 1000; // Ensure it renders on top
    mesh.userData.region = region;
    
    // Add the mesh to the scene
    scene.add(mesh);
    
    // Calculate influence radius based on model size and region
    // Different regions need different influence radii
    let influenceRadius = size * 3;
    
    // Adjust influence radius based on region
    switch(region) {
      case 'tip':
        influenceRadius = size * 2.5; // Smaller, more precise influence
        break;
      case 'bridge':
        influenceRadius = size * 4; // Larger influence for bridge
        break;
      case 'leftNostril':
      case 'rightNostril':
        influenceRadius = size * 2.5; // Smaller for nostrils
        break;
      case 'leftSidewall':
      case 'rightSidewall':
        influenceRadius = size * 3.5; // Medium for sidewalls
        break;
      case 'columella':
        influenceRadius = size * 2.5; // Smaller for columella
        break;
    }
    
    // Create and return the control point object
    return {
      position,
      region,
      mesh,
      influenceRadius,
      vertexIndices: []
    };
  };

  // Create visual representations of anatomical regions
  const createAnatomicalRegionVisualizations = (controlPoints: ControlPoint[]) => {
    if (!noseMesh || !scene) return;
    
    const positions = noseMesh.geometry.attributes.position;
    
    // Create a mesh for each anatomical region
    controlPoints.forEach(cp => {
      // Skip if no vertices in this region
      if (cp.vertexIndices.length === 0) return;
      
      console.log(`Creating visualization for ${cp.region} with ${cp.vertexIndices.length} vertices`);
      
      // Create a geometry for this region
      const regionGeometry = new THREE.BufferGeometry();
      
      // Create position array for all vertices in this region
      const positionArray = new Float32Array(cp.vertexIndices.length * 3);
      
      // Fill the position array
      for (let i = 0; i < cp.vertexIndices.length; i++) {
        const vertexIndex = cp.vertexIndices[i];
        positionArray[i * 3] = positions.getX(vertexIndex);
        positionArray[i * 3 + 1] = positions.getY(vertexIndex);
        positionArray[i * 3 + 2] = positions.getZ(vertexIndex);
      }
      
      // Set the position attribute
      regionGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
      
      // Create indices for faces if we have enough vertices
      if (cp.vertexIndices.length > 3) {
        try {
          // Convert to Vector3 array for better processing
          const points: Vector3[] = [];
          for (let i = 0; i < cp.vertexIndices.length; i++) {
            const vertexIndex = cp.vertexIndices[i];
            const x = positions.getX(vertexIndex);
            const y = positions.getY(vertexIndex);
            const z = positions.getZ(vertexIndex);
            points.push(new Vector3(x, y, z));
          }
          
          // Calculate the centroid of all points in this region
          const centroid = new Vector3();
          points.forEach(point => {
            centroid.add(point);
          });
          centroid.divideScalar(points.length);
          
          // Calculate average distance from centroid to points
          let avgDistance = 0;
          points.forEach(point => {
            avgDistance += point.distanceTo(centroid);
          });
          avgDistance /= points.length;
          
          // Create a better-fitting hull geometry based on the actual points
          // Use a sphere as base but scale it to better match the region shape
          const hullGeometry = new THREE.SphereGeometry(
            avgDistance * 0.9, // Use average distance for better fit
            24, // More segments for smoother appearance
            24  // More rings for smoother appearance
          );
          
          // Position the hull at the centroid of the region points, not just at the control point
          hullGeometry.translate(
            centroid.x,
            centroid.y,
            centroid.z
          );
          
          // Create a material for this region - solid with wireframe overlay
          const material = new THREE.MeshBasicMaterial({
            color: cp.mesh.material instanceof MeshBasicMaterial ? 
                  cp.mesh.material.color : 0xffffff,
            transparent: true,
            opacity: 0.3, // Slightly more opaque for better visibility
            wireframe: false,
            depthTest: true
          });
          
          // Create a mesh for this region
          const regionMesh = new THREE.Mesh(hullGeometry, material);
          regionMesh.name = `anatomicalRegion-${cp.region}`;
          regionMesh.renderOrder = 998; // Render below control points
          
          // Apply the same transformation as the nose mesh to ensure proper positioning
          regionMesh.applyMatrix4(noseMesh.matrixWorld);
          
          // Add the mesh to the scene
          scene.add(regionMesh);
          
          // Also add a wireframe version to show the structure clearly
          const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: cp.mesh.material instanceof MeshBasicMaterial ? 
                  cp.mesh.material.color : 0xffffff,
            transparent: true,
            opacity: 0.7, // More opaque for better visibility
            wireframe: true,
            depthTest: false // Always render on top
          });
          
          // Create a convex hull-like geometry for the wireframe
          // This will better represent the actual shape of the region
          const wireframeGeometry = new THREE.BufferGeometry();
          
          // Add all points
          wireframeGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
          
          // Add indices to create faces connecting nearby vertices
          // This is a simplified approach to create a mesh without a full convex hull algorithm
          if (cp.vertexIndices.length > 8) {
            // Create triangles by connecting points to centroid
            const indices: number[] = [];
            for (let i = 0; i < points.length - 1; i++) {
              indices.push(i, i + 1, 0); // Connect adjacent points and first point
            }
            // Connect last point to first point
            indices.push(points.length - 1, 0, 1);
            
            wireframeGeometry.setIndex(indices);
          }
          
          const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
          wireframeMesh.name = `anatomicalRegionWireframe-${cp.region}`;
          wireframeMesh.renderOrder = 999; // Render below control points but above solid mesh
          
          // Apply the same transformation as the nose mesh
          wireframeMesh.applyMatrix4(noseMesh.matrixWorld);
          
          // Add the wireframe mesh to the scene
          scene.add(wireframeMesh);
          
        } catch (error) {
          console.warn(`Failed to create visualization for ${cp.region}:`, error);
          
          // Fallback to simple wireframe if the above fails
          const material = new THREE.MeshBasicMaterial({
            color: cp.mesh.material instanceof MeshBasicMaterial ? 
                  cp.mesh.material.color : 0xffffff,
            transparent: true,
            opacity: 0.7,
            wireframe: true,
            depthTest: false // Always render on top
          });
          
          const regionMesh = new THREE.Mesh(regionGeometry, material);
          regionMesh.name = `anatomicalRegion-${cp.region}`;
          regionMesh.renderOrder = 999; // Render below control points but above other objects
          
          // Apply the same transformation as the nose mesh
          regionMesh.applyMatrix4(noseMesh.matrixWorld);
          
          // Add the mesh to the scene
          scene.add(regionMesh);
        }
      } else {
        // Fallback for regions with too few vertices
        const material = new THREE.MeshBasicMaterial({
          color: cp.mesh.material instanceof MeshBasicMaterial ? 
                cp.mesh.material.color : 0xffffff,
          transparent: true,
          opacity: 0.7,
          wireframe: true,
          depthTest: false // Always render on top
        });
        
        const regionMesh = new THREE.Mesh(regionGeometry, material);
        regionMesh.name = `anatomicalRegion-${cp.region}`;
        regionMesh.renderOrder = 999; // Render below control points but above other objects
        
        // Apply the same transformation as the nose mesh
        regionMesh.applyMatrix4(noseMesh.matrixWorld);
        
        // Add the mesh to the scene
        scene.add(regionMesh);
      }
    });
  };

  // Handle mouse down event
  const handleMouseDown = (event: MouseEvent) => {
    if (!isEditMode || !camera || !scene) return;
    
    // Get canvas dimensions
    const canvas = event.target as HTMLElement;
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
    
    // Find intersections with control points
    const intersects = raycaster.intersectObjects(
      controlPoints.map(cp => cp.mesh),
      false
    );
    
    if (intersects.length > 0) {
      // Find the control point that was clicked
      const clickedMesh = intersects[0].object;
      const clickedControlPoint = controlPoints.find(cp => cp.mesh === clickedMesh);
      
      if (clickedControlPoint) {
        setSelectedControlPoint(clickedControlPoint);
        setIsDragging(true);
        
        // Highlight the selected control point
        highlightControlPoint(clickedControlPoint);
        
        console.log('AnatomicalMeshEditor: Selected control point:', clickedControlPoint.region);
      }
    }
  };

  // Handle mouse move event
  const handleMouseMove = (event: MouseEvent) => {
    if (!isDragging || !selectedControlPoint || !camera || !noseMesh || !scene) return;
    
    // Get canvas dimensions
    const canvas = event.target as HTMLElement;
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
    
    // Create a plane perpendicular to the camera at the control point position
    const planeNormal = new Vector3().subVectors(camera.position, selectedControlPoint.position).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, selectedControlPoint.position);
    
    // Find where the ray intersects the plane
    const targetPosition = new Vector3();
    const didIntersect = raycaster.ray.intersectPlane(plane, targetPosition);
    
    if (!didIntersect) return;
    
    // Calculate the movement vector
    const moveVector = new Vector3().subVectors(targetPosition, selectedControlPoint.position);
    
    // Limit the maximum movement per frame to prevent extreme deformations
    const maxMovement = noseMesh.geometry.boundingSphere?.radius || 1.0;
    if (moveVector.length() > maxMovement * 0.1) {
      moveVector.normalize().multiplyScalar(maxMovement * 0.1);
    }
    
    // Update the control point position
    selectedControlPoint.position.copy(targetPosition);
    selectedControlPoint.mesh.position.copy(targetPosition);
    
    // Update the vertices influenced by this control point
    updateInfluencedVertices(selectedControlPoint, moveVector);
    
    // Update the anatomical region visualization
    updateAnatomicalRegionVisualization(selectedControlPoint);
    
    // Log for debugging
    console.log('Moving control point:', selectedControlPoint.region, 'by vector:', moveVector);
  };

  // Handle mouse up event
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Highlight a control point
  const highlightControlPoint = (controlPoint: ControlPoint) => {
    // Reset all control points to their original appearance
    controlPoints.forEach(cp => {
      if (cp.mesh.material instanceof MeshBasicMaterial) {
        cp.mesh.material.opacity = 0.8;
        cp.mesh.scale.set(1, 1, 1);
      }
    });
    
    // Highlight the selected control point
    if (controlPoint.mesh.material instanceof MeshBasicMaterial) {
      controlPoint.mesh.material.opacity = 1.0;
      controlPoint.mesh.scale.set(1.2, 1.2, 1.2);
    }
  };

  // Update vertices influenced by a control point
  const updateInfluencedVertices = (controlPoint: ControlPoint, moveVector: Vector3) => {
    if (!noseMesh) return;
    
    const positions = noseMesh.geometry.attributes.position;
    
    // Get model dimensions for scaling
    const box = new THREE.Box3().setFromObject(noseMesh);
    const size = box.getSize(new Vector3());
    const modelSize = Math.max(size.x, size.y, size.z);
    
    // Apply movement to all vertices influenced by this control point with falloff based on distance
    for (const vertexIndex of controlPoint.vertexIndices) {
      const x = positions.getX(vertexIndex);
      const y = positions.getY(vertexIndex);
      const z = positions.getZ(vertexIndex);
      const vertexPosition = new Vector3(x, y, z);
      
      // Calculate distance from vertex to control point
      const distanceToControlPoint = vertexPosition.distanceTo(controlPoint.position);
      
      // Calculate influence factor (1.0 at control point, decreasing with distance)
      // Use a smooth falloff function for more natural deformation
      const normalizedDistance = distanceToControlPoint / controlPoint.influenceRadius;
      const influenceFactor = Math.max(0, 1 - Math.pow(normalizedDistance, 2));
      
      // Apply the movement to the vertex with falloff
      positions.setXYZ(
        vertexIndex,
        x + moveVector.x * influenceFactor,
        y + moveVector.y * influenceFactor,
        z + moveVector.z * influenceFactor
      );
    }
    
    // Apply partial movement to vertices in other regions based on distance
    // This creates smoother transitions between regions
    const otherControlPoints = controlPoints.filter(cp => cp !== controlPoint);
    
    for (const otherCP of otherControlPoints) {
      // Calculate distance between control points
      const distance = otherCP.position.distanceTo(controlPoint.position);
      const normalizedDistance = distance / (modelSize * 0.3); // Reduced from 0.5 to increase influence range
      
      // Skip if too far away
      if (normalizedDistance > 1) continue;
      
      // Calculate influence factor based on distance (quadratic falloff for smoother transition)
      const influence = Math.max(0, 1 - Math.pow(normalizedDistance, 2));
      
      // Apply partial movement to vertices in this region
      for (const vertexIndex of otherCP.vertexIndices) {
        const x = positions.getX(vertexIndex);
        const y = positions.getY(vertexIndex);
        const z = positions.getZ(vertexIndex);
        const vertexPosition = new Vector3(x, y, z);
        
        // Additional distance-based falloff within the region
        const distanceToOtherCP = vertexPosition.distanceTo(otherCP.position);
        const localInfluence = Math.max(0, 1 - (distanceToOtherCP / otherCP.influenceRadius));
        
        // Combined influence factor
        const combinedInfluence = influence * localInfluence * 0.7; // Increased from 0.5 for stronger effect
        
        // Apply partial movement based on influence
        positions.setXYZ(
          vertexIndex,
          x + moveVector.x * combinedInfluence,
          y + moveVector.y * combinedInfluence,
          z + moveVector.z * combinedInfluence
        );
      }
    }
    
    // Update the geometry
    positions.needsUpdate = true;
    noseMesh.geometry.computeVertexNormals();
  };

  // Update the anatomical region visualization
  const updateAnatomicalRegionVisualization = (controlPoint: ControlPoint) => {
    if (!scene || !noseMesh) return;
    
    // Remove all existing meshes for this region
    const regionMesh = scene.getObjectByName(`anatomicalRegion-${controlPoint.region}`);
    if (regionMesh) scene.remove(regionMesh);
    
    const wireframeMesh = scene.getObjectByName(`anatomicalRegionWireframe-${controlPoint.region}`);
    if (wireframeMesh) scene.remove(wireframeMesh);
    
    // Create a new region mesh
    const positions = noseMesh.geometry.attributes.position;
    
    // Create a geometry for this region
    const regionGeometry = new THREE.BufferGeometry();
    
    // Create position array for all vertices in this region
    const positionArray = new Float32Array(controlPoint.vertexIndices.length * 3);
    
    // Fill the position array
    for (let i = 0; i < controlPoint.vertexIndices.length; i++) {
      const vertexIndex = controlPoint.vertexIndices[i];
      positionArray[i * 3] = positions.getX(vertexIndex);
      positionArray[i * 3 + 1] = positions.getY(vertexIndex);
      positionArray[i * 3 + 2] = positions.getZ(vertexIndex);
    }
    
    // Set the position attribute
    regionGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
    
    // Create indices for faces if we have enough vertices
    if (controlPoint.vertexIndices.length > 3) {
      try {
        // Create a sphere geometry at the control point position to represent the region
        const hullGeometry = new THREE.SphereGeometry(
          controlPoint.influenceRadius * 0.8, // Slightly smaller than influence radius
          16, // Segments
          16  // Rings
        );
        
        // Position the hull at the control point
        hullGeometry.translate(
          controlPoint.position.x,
          controlPoint.position.y,
          controlPoint.position.z
        );
        
        // Create a material for this region - solid with wireframe overlay
        const material = new THREE.MeshBasicMaterial({
          color: controlPoint.mesh.material instanceof MeshBasicMaterial ? 
                controlPoint.mesh.material.color : 0xffffff,
          transparent: true,
          opacity: 0.2,
          wireframe: false,
          depthTest: true
        });
        
        // Create a mesh for this region
        const newRegionMesh = new THREE.Mesh(hullGeometry, material);
        newRegionMesh.name = `anatomicalRegion-${controlPoint.region}`;
        newRegionMesh.renderOrder = 998; // Render below control points
        
        // Add the mesh to the scene
        scene.add(newRegionMesh);
        
        // Also add a wireframe version to show the structure clearly
        const wireframeMaterial = new THREE.MeshBasicMaterial({
          color: controlPoint.mesh.material instanceof MeshBasicMaterial ? 
                controlPoint.mesh.material.color : 0xffffff,
          transparent: true,
          opacity: 0.5,
          wireframe: true,
          depthTest: false // Always render on top
        });
        
        const newWireframeMesh = new THREE.Mesh(regionGeometry, wireframeMaterial);
        newWireframeMesh.name = `anatomicalRegionWireframe-${controlPoint.region}`;
        newWireframeMesh.renderOrder = 999; // Render below control points but above solid mesh
        
        // Apply the same transformation as the nose mesh
        newWireframeMesh.applyMatrix4(noseMesh.matrixWorld);
        
        // Add the wireframe mesh to the scene
        scene.add(newWireframeMesh);
        
      } catch (error) {
        console.warn(`Failed to update visualization for ${controlPoint.region}:`, error);
        
        // Fallback to simple wireframe if convex hull fails
        const material = new THREE.MeshBasicMaterial({
          color: controlPoint.mesh.material instanceof MeshBasicMaterial ? 
                controlPoint.mesh.material.color : 0xffffff,
          transparent: true,
          opacity: 0.5,
          wireframe: true,
          depthTest: false // Always render on top
        });
        
        const newRegionMesh = new THREE.Mesh(regionGeometry, material);
        newRegionMesh.name = `anatomicalRegion-${controlPoint.region}`;
        newRegionMesh.renderOrder = 999; // Render below control points but above other objects
        
        // Apply the same transformation as the nose mesh
        newRegionMesh.applyMatrix4(noseMesh.matrixWorld);
        
        // Add the mesh to the scene
        scene.add(newRegionMesh);
      }
    } else {
      // Fallback for regions with too few vertices
      const material = new THREE.MeshBasicMaterial({
        color: controlPoint.mesh.material instanceof MeshBasicMaterial ? 
              controlPoint.mesh.material.color : 0xffffff,
        transparent: true,
        opacity: 0.5,
        wireframe: true,
        depthTest: false // Always render on top
      });
      
      const newRegionMesh = new THREE.Mesh(regionGeometry, material);
      newRegionMesh.name = `anatomicalRegion-${controlPoint.region}`;
      newRegionMesh.renderOrder = 999; // Render below control points but above other objects
      
      // Apply the same transformation as the nose mesh
      newRegionMesh.applyMatrix4(noseMesh.matrixWorld);
      
      // Add the mesh to the scene
      scene.add(newRegionMesh);
    }
  };

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
    
    // Recreate the control points
    createAnatomicalControlMesh();
    
    console.log('Nose reset complete');
  };

  // Toggle visibility of the anatomical mesh
  const toggleAnatomicalMeshVisibility = () => {
    const newVisibility = !anatomicalMeshVisible;
    setAnatomicalMeshVisible(newVisibility);
    
    if (!scene) return;
    
    // Toggle visibility of all region meshes (both solid and wireframe)
    const regionMeshes = scene.children.filter(child => 
      child.name && (
        child.name.startsWith('anatomicalRegion-') ||
        child.name.startsWith('anatomicalRegionWireframe-')
      )
    );
    
    regionMeshes.forEach(mesh => {
      mesh.visible = newVisibility;
    });
    
    // If turning visibility back on, ensure control points are still visible
    if (newVisibility) {
      controlPoints.forEach(cp => {
        if (cp.mesh) cp.mesh.visible = true;
      });
    }
  };

  return {
    noseMesh,
    controlPoints,
    selectedControlPoint,
    resetNose,
    toggleAnatomicalMeshVisibility,
    anatomicalMeshVisible
  };
};

export default AnatomicalMeshEditor;