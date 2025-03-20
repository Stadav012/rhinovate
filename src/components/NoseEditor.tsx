import { useRef, useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { Group, Mesh, Vector3, Raycaster, BufferGeometry, BufferAttribute, Box3 } from 'three';
import * as THREE from 'three';

interface NoseEditorProps {
  model: Group | null;
  isEditMode: boolean;
  camera?: THREE.Camera;
  scene?: THREE.Scene;
}

const NoseEditor = ({ model, isEditMode, camera, scene }: NoseEditorProps) => {
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [noseVertices, setNoseVertices] = useState<number[]>([]);
  const [originalGeometry, setOriginalGeometry] = useState<BufferGeometry | null>(null);
  const transformRef = useRef<any>(null);
  const noseMeshRef = useRef<Mesh | null>(null);
  
  // Find the nose mesh in the model
  useEffect(() => {
    if (!model) {
      console.warn('NoseEditor: No model provided');
      return;
    }
    
    console.log('NoseEditor: Starting nose detection on model', model);
    console.log('NoseEditor: Model children count:', model.children.length);
    console.log('NoseEditor: Model structure:', JSON.stringify(model.toJSON(), null, 2));
    
    let noseMesh: Mesh | null = null;
    let meshCount = 0;
    let allMeshes: Mesh[] = [];
    
    // First pass: collect all meshes for analysis
    model.traverse((child) => {
      if (child instanceof Mesh) {
        meshCount++;
        allMeshes.push(child);
        
        // Log detailed information about each mesh
        const box = new THREE.Box3().setFromObject(child);
        const center = box.getCenter(new Vector3());
        const size = box.getSize(new Vector3());
        
        console.log(`NoseEditor: Examining mesh ${meshCount}:`, {
          name: child.name,
          position: child.position.toArray(),
          rotation: child.rotation.toArray(),
          scale: child.scale.toArray(),
          center: center.toArray(),
          size: size.toArray(),
          vertexCount: child.geometry.attributes.position?.count || 0,
          materialType: child.material ? child.material.type : 'none',
          hasUVs: !!child.geometry.attributes.uv
        });
      }
    });
    
    console.log(`NoseEditor: Found ${meshCount} meshes in total`);
    
    // If no meshes found, log error and return
    if (meshCount === 0) {
      console.error('NoseEditor: No meshes found in the model. Cannot proceed with nose detection.');
      return;
    }
    
    // Second pass: try multiple detection strategies
    // Strategy 1: Look for mesh with name containing 'nose' or similar
    for (const mesh of allMeshes) {
      const name = mesh.name.toLowerCase();
      if (name.includes('nose') || name.includes('nasal')) {
        console.log('NoseEditor: Found nose mesh by name:', mesh.name);
        noseMesh = mesh;
        break;
      }
    }
    
    // Strategy 2: Geometric heuristics if strategy 1 failed
    if (!noseMesh) {
      console.log('NoseEditor: No nose mesh found by name, trying geometric detection...');
      
      // Find the mesh that's most likely to be the nose based on position and size
      let bestScore = -Infinity;
      let bestMesh: Mesh | null = null;
      
      for (const mesh of allMeshes) {
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new Vector3());
        const size = box.getSize(new Vector3());
        
        // Scoring system for nose likelihood:
        // 1. It should be near the center on the X axis
        // 2. It should be in the front half of the face (positive Z)
        // 3. It should be in the middle-to-upper part of the face
        // 4. It should be relatively small compared to the whole model
        const xCenterCheck = 1 - (Math.abs(center.x) / (size.x/2 || 0.001));
        const zCheck = center.z > -0.1 * size.z ? 1 : 0; // Prefer positive Z
        const yCheck = center.y > -0.3 * size.y ? 1 : 0; // Prefer upper part
        const sizeCheck = 1 - (Math.max(size.x, size.y, size.z) / 10); // Prefer smaller meshes
        
        // Combined score (weighted)
        const score = (xCenterCheck * 2) + (zCheck * 3) + (yCheck * 2) + (sizeCheck * 1);
        
        console.log(`NoseEditor: Mesh ${mesh.name} geometric score:`, {
          xCenterCheck,
          zCheck,
          yCheck,
          sizeCheck,
          totalScore: score
        });
        
        if (score > bestScore) {
          bestScore = score;
          bestMesh = mesh;
        }
      }
      
      if (bestMesh && bestScore > 3) { // Threshold for acceptance
        console.log(`NoseEditor: Selected best mesh as nose with score ${bestScore}:`, bestMesh.name);
        noseMesh = bestMesh;
      }
    }
    
    // Strategy 3: If all else fails, just take the mesh closest to the center
    if (!noseMesh && allMeshes.length > 0) {
      console.log('NoseEditor: Falling back to center-based detection...');
      
      // Calculate the center of the entire model
      const modelBox = new THREE.Box3().setFromObject(model);
      const modelCenter = modelBox.getCenter(new Vector3());
      
      // Find the mesh closest to the center
      let closestMesh = allMeshes[0];
      let minDistance = Infinity;
      
      for (const mesh of allMeshes) {
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new Vector3());
        const distance = center.distanceTo(modelCenter);
        
        console.log(`NoseEditor: Mesh ${mesh.name} distance from center:`, distance);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestMesh = mesh;
        }
      }
      
      console.log('NoseEditor: Selected center-most mesh as fallback:', closestMesh.name);
      noseMesh = closestMesh;
    }
    
    console.log(`NoseEditor: Examined ${meshCount} meshes in total`);
    
    if (noseMesh) {
      console.log('NoseEditor: Setting nose mesh reference');
      noseMeshRef.current = noseMesh;
      
      // Store original geometry for reset functionality
      if (noseMesh.geometry instanceof BufferGeometry) {
        const originalGeometryCopy = noseMesh.geometry.clone();
        setOriginalGeometry(originalGeometryCopy);
        console.log('NoseEditor: Original geometry stored for reset');
        
        // Identify vertices in the nose region using a more sophisticated approach
        const positions = noseMesh.geometry.attributes.position;
        const noseArea: number[] = [];
        
        // Calculate the bounding box of the mesh to get its dimensions
        const box = new THREE.Box3().setFromObject(noseMesh);
        const center = box.getCenter(new Vector3());
        const size = box.getSize(new Vector3());
        
        console.log('NoseEditor: Mesh dimensions:', {
          center: center.toArray(),
          size: size.toArray(),
          vertexCount: positions.count
        });
        
        // Create multiple visual helpers for better debugging
        if (isEditMode && scene) {
          // 1. Box helper to show the entire mesh bounds
          const meshBoxHelper = new THREE.BoxHelper(noseMesh, 0x0000ff);
          scene.add(meshBoxHelper);
          
          // 2. Box helper to show the estimated nose area (smaller box in the center-front)
          const noseAreaHelper = new THREE.BoxHelper(
            new THREE.Mesh(
              new THREE.BoxGeometry(size.x * 0.6, size.y * 0.4, size.z * 0.6),
              new THREE.MeshBasicMaterial({ color: 0xff0000 })
            ),
            0xff0000
          );
          // Position the nose area helper slightly forward
          const noseCenter = center.clone();
          noseCenter.z += size.z * 0.1; // Move slightly forward
          noseAreaHelper.position.copy(noseCenter);
          scene.add(noseAreaHelper);
          
          // 3. Axes helper to show the coordinate system
          const axesHelper = new THREE.AxesHelper(Math.max(size.x, size.y, size.z));
          scene.add(axesHelper);
          
          // Remove all helpers after 10 seconds
          setTimeout(() => {
            if (scene) {
              scene.remove(meshBoxHelper);
              scene.remove(noseAreaHelper);
              scene.remove(axesHelper);
            }
          }, 10000);
          
          console.log('NoseEditor: Added visual debug helpers to the scene');
        }
        
        // Try multiple approaches to identify nose vertices
        
        // APPROACH 1: Geometric heuristics based on position
        let verticesAnalyzed = 0;
        let verticesSelected = 0;
        const vertexMarkers: THREE.Mesh[] = [];
        
        // Create a map to store vertex scores
        const vertexScores: Map<number, number> = new Map();
        
        console.log('NoseEditor: Starting vertex analysis with geometric heuristics...');
        
        for (let i = 0; i < positions.count; i++) {
          verticesAnalyzed++;
          const x = positions.getX(i);
          const y = positions.getY(i);
          const z = positions.getZ(i);
          
          // Convert to world coordinates for better visualization
          const worldPos = new Vector3(x, y, z).applyMatrix4(noseMesh.matrixWorld);
          
          // Multiple scoring factors for nose vertices:
          
          // 1. Proximity to center on X axis (nose is usually centered)
          const xDistanceFromCenter = Math.abs(x - center.x);
          const xScore = 1 - Math.min(1, xDistanceFromCenter / (size.x * 0.4));
          
          // 2. Height position (nose is usually in the middle-to-upper part)
          // Normalize Y position from 0 (bottom) to 1 (top)
          const normalizedY = (y - (center.y - size.y/2)) / size.y;
          // Score highest in the middle-upper region (0.4-0.7 of height)
          const yScore = 1 - Math.min(1, Math.abs(normalizedY - 0.55) / 0.3);
          
          // 3. Forward position (nose usually protrudes forward)
          // Normalize Z from 0 (back) to 1 (front)
          const normalizedZ = (z - (center.z - size.z/2)) / size.z;
          // Score highest at the front
          const zScore = Math.pow(normalizedZ, 2); // Quadratic to emphasize front-most points
          
          // 4. Local protrusion - check if this vertex is more forward than its neighbors
          // This is a simplified approximation - ideally we'd check actual neighbors
          let protrusionScore = 0;
          if (i > 0 && i < positions.count - 1) {
            const prevZ = positions.getZ(i-1);
            const nextZ = positions.getZ(i+1);
            if (z > prevZ && z > nextZ) {
              protrusionScore = 0.5;
            }
          }
          
          // Combined score with weights
          const totalScore = (xScore * 2.5) + (yScore * 1.5) + (zScore * 3.0) + (protrusionScore * 1.0);
          vertexScores.set(i, totalScore);
          
          // Log detailed scores for some vertices for debugging
          if (i % Math.max(1, Math.floor(positions.count / 20)) === 0) {
            console.log(`Vertex ${i} scores:`, {
              position: [x, y, z],
              worldPosition: worldPos.toArray(),
              xScore, yScore, zScore, protrusionScore,
              totalScore
            });
          }
          
          // Log progress for large meshes
          if (verticesAnalyzed % 1000 === 0) {
            console.log(`NoseEditor: Analyzed ${verticesAnalyzed}/${positions.count} vertices so far`);
          }
        }
        
        // Sort vertices by score and take the top 15-20% as nose vertices
        const sortedVertices = Array.from(vertexScores.entries())
          .sort((a, b) => b[1] - a[1]); // Sort by score descending
        
        // Take top 15-20% of vertices or at least 100 vertices, but not more than 1000
        const topCount = Math.min(1000, Math.max(100, Math.floor(positions.count * 0.15)));
        const topVertices = sortedVertices.slice(0, topCount);
        
        console.log(`NoseEditor: Selected top ${topCount} vertices as nose area`);
        console.log('NoseEditor: Top 5 vertex scores:', topVertices.slice(0, 5));
        
        // Add the top vertices to the nose area
        topVertices.forEach(([index, score]) => {
          noseArea.push(index);
          verticesSelected++;
          
          // Create visual markers for some of the selected vertices
          if (isEditMode && scene && verticesSelected % Math.max(1, Math.floor(topCount / 30)) === 0) {
            const x = positions.getX(index);
            const y = positions.getY(index);
            const z = positions.getZ(index);
            
            // Color based on score (green to red)
            const scoreColor = new THREE.Color();
            scoreColor.setHSL(Math.max(0, 0.3 - (score / 10)), 1, 0.5);
            
            const vertexMarker = new THREE.Mesh(
              new THREE.SphereGeometry(size.x * 0.02), // Size relative to model
              new THREE.MeshBasicMaterial({ color: scoreColor })
            );
            vertexMarker.position.set(x, y, z);
            vertexMarker.position.applyMatrix4(noseMesh.matrixWorld);
            scene.add(vertexMarker);
            vertexMarkers.push(vertexMarker);
          }
        });
        
        // Remove vertex markers after 10 seconds
        if (isEditMode && scene && vertexMarkers.length > 0) {
          setTimeout(() => {
            vertexMarkers.forEach(marker => {
              if (scene) scene.remove(marker);
            });
            console.log('NoseEditor: Removed vertex markers');
          }, 10000);
        }
        
        console.log(`NoseEditor: Identified ${noseArea.length} vertices in nose area out of ${positions.count} total vertices`);
        
        // Fallback if no vertices were identified
        if (noseArea.length === 0) {
          console.warn('NoseEditor: No nose vertices identified! Using fallback method...');
          
          // Fallback: Just use vertices in the center-front region
          for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            
            // Simple geometric criteria
            const xDistanceFromCenter = Math.abs(x - center.x) / (size.x/2);
            const yPosition = (y - (center.y - size.y/2)) / size.y; // 0 to 1
            const zPosition = (z - (center.z - size.z/2)) / size.z; // 0 to 1
            
            // Center-front region
            if (xDistanceFromCenter < 0.5 && yPosition > 0.3 && yPosition < 0.8 && zPosition > 0.5) {
              noseArea.push(i);
            }
          }
          
          console.log(`NoseEditor: Fallback identified ${noseArea.length} vertices`);
        }
        
        if (noseArea.length < 10) {
          console.warn('NoseEditor: Very few nose vertices identified. Adjustments may not work well.');
        }
        
        setNoseVertices(noseArea);
      }
    } else {
      console.warn('No suitable nose mesh found in the model');
    }
  }, [model]);
  
  // Handle mouse interaction for vertex selection
  const handleMouseDown = (event: React.MouseEvent) => {
    if (!isEditMode || !noseMeshRef.current || !camera) return;
    
    // Get canvas dimensions from the event target
    const canvas = event.currentTarget as HTMLElement;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate mouse position in normalized device coordinates
    // Use the canvas dimensions for more accurate coordinates
    const mouse = new Vector3(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
      0.5
    );
    
    console.log('Mouse click at NDC:', mouse);
    
    // Raycasting to find intersected vertices
    const raycaster = new Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObject(noseMeshRef.current, true);
    console.log('Intersects:', intersects.length);
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      console.log('Intersection point:', intersect.point);
      
      // Find the closest vertex to the intersection point
      if (noseMeshRef.current.geometry instanceof BufferGeometry) {
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
        const selectionThreshold = 0.1; // Increased from 0.05
        
        if (closestVertex !== -1 && minDistance < selectionThreshold) {
          console.log(`Selected vertex ${closestVertex} at distance ${minDistance}`);
          setSelectedVertex(closestVertex);
          
          // Highlight the selected vertex by creating a temporary visual indicator
          // This would be implemented in the rendering part of the component
        } else {
          console.log(`No vertex selected. Closest was ${closestVertex} at distance ${minDistance}`);
        }
      }
    }
  };
  
  // Update vertex position when using transform controls
  const updateVertexPosition = (newPosition: Vector3) => {
    if (selectedVertex === null || !noseMeshRef.current) return;
    
    if (noseMeshRef.current.geometry instanceof BufferGeometry) {
      const positions = noseMeshRef.current.geometry.attributes.position;
      
      // Update the position of the selected vertex
      positions.setXYZ(
        selectedVertex,
        newPosition.x,
        newPosition.y,
        newPosition.z
      );
      
      positions.needsUpdate = true;
      noseMeshRef.current.geometry.computeVertexNormals();
    }
  };
  
  // Reset nose to original shape
  const resetNose = () => {
    if (!noseMeshRef.current || !originalGeometry) {
      console.warn('Cannot reset: missing nose mesh or original geometry');
      return;
    }
    
    console.log('Resetting nose to original shape');
    
    // Dispose of the current geometry to prevent memory leaks
    noseMeshRef.current.geometry.dispose();
    
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
    noseMeshRef.current.geometry = resetGeometry;
    
    // Ensure normals are recomputed
    noseMeshRef.current.geometry.computeVertexNormals();
    
    // Clear selection
    setSelectedVertex(null);
    
    console.log('Nose reset complete');
  };
  
  // Predefined rhinoplasty adjustments with enhanced debugging and effectiveness
  const adjustNoseBridge = (amount: number) => {
    if (!noseMeshRef.current) {
      console.warn('NoseEditor: Cannot adjust bridge - no nose mesh reference');
      return;
    }
    
    if (noseMeshRef.current.geometry instanceof BufferGeometry) {
      const positions = noseMeshRef.current.geometry.attributes.position;
      const box = new THREE.Box3().setFromObject(noseMeshRef.current);
      const center = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      
      // Significantly increase amplification for more visible effect
      const amplifiedAmount = amount * 0.3 * size.y; // Increased from 0.1 to 0.3
      let verticesAffected = 0;
      const affectedVertices: number[] = [];
      
      console.log(`NoseEditor: Starting bridge adjustment with amount ${amount}, amplified to ${amplifiedAmount}`);
      console.log(`NoseEditor: Working with ${noseVertices.length} nose vertices`);
      
      // Create visual markers for debugging if in edit mode
      const markers: THREE.Mesh[] = [];
      
      // Adjust vertices in the bridge area
      for (const vertexIndex of noseVertices) {
        const x = positions.getX(vertexIndex);
        const y = positions.getY(vertexIndex);
        const z = positions.getZ(vertexIndex);
        
        // Enhanced bridge area detection
        // Bridge is typically in the upper-middle part of the nose
        const xDistanceFromCenter = Math.abs(x - center.x);
        const xDistanceNormalized = xDistanceFromCenter / (size.x/2);
        
        // Normalized Y position (0 at bottom, 1 at top)
        const normalizedY = (y - (center.y - size.y/2)) / size.y;
        
        // Bridge vertices are near the center on X axis and in the upper part of the nose
        // More inclusive criteria
        if (xDistanceNormalized < 0.5 && normalizedY > 0.5) {
          // Apply a falloff effect based on distance from the bridge center
          const falloff = 1 - xDistanceNormalized;
          const adjustedAmount = amplifiedAmount * falloff;
          
          // Raise or lower the bridge
          positions.setY(vertexIndex, y + adjustedAmount);
          verticesAffected++;
          affectedVertices.push(vertexIndex);
          
          // Add visual marker for the first few affected vertices if in edit mode
          if (isEditMode && scene && verticesAffected <= 10) {
            const marker = new THREE.Mesh(
              new THREE.SphereGeometry(size.x * 0.02),
              new THREE.MeshBasicMaterial({ color: 0xff0000 })
            );
            marker.position.set(x, y + adjustedAmount, z);
            marker.position.applyMatrix4(noseMeshRef.current.matrixWorld);
            scene.add(marker);
            markers.push(marker);
          }
        }
      }
      
      // Remove markers after 5 seconds
      if (markers.length > 0 && scene) {
        setTimeout(() => {
          markers.forEach(marker => scene?.remove(marker));
        }, 5000);
      }
      
      console.log(`NoseEditor: Bridge adjustment affected ${verticesAffected} vertices with amount ${amplifiedAmount}`);
      if (verticesAffected === 0) {
        console.warn('NoseEditor: No vertices were affected by bridge adjustment!');
      } else if (verticesAffected < 5) {
        console.warn('NoseEditor: Very few vertices affected by bridge adjustment. Check detection criteria.');
        console.log('NoseEditor: First few affected vertices:', affectedVertices.slice(0, 5));
      }
      
      positions.needsUpdate = true;
      noseMeshRef.current.geometry.computeVertexNormals();
    }
  };
  
  const adjustNoseTip = (amount: number) => {
    if (!noseMeshRef.current) {
      console.warn('NoseEditor: Cannot adjust tip - no nose mesh reference');
      return;
    }
    
    if (noseMeshRef.current.geometry instanceof BufferGeometry) {
      const positions = noseMeshRef.current.geometry.attributes.position;
      const box = new THREE.Box3().setFromObject(noseMeshRef.current);
      const center = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      
      // Significantly increase amplification for more visible effect
      const amplifiedAmount = amount * 0.5 * size.z; // Increased from 0.3 to 0.5 for more noticeable effect
      let verticesAffected = 0;
      const affectedVertices: number[] = [];
      
      console.log(`NoseEditor: Starting tip adjustment with amount ${amount}, amplified to ${amplifiedAmount}`);
      console.log(`NoseEditor: Working with ${noseVertices.length} nose vertices`);
      
      // Create visual markers for debugging if in edit mode
      const markers: THREE.Mesh[] = [];
      
      // Find the front-most Z value to help identify the tip
      let maxZ = -Infinity;
      for (const vertexIndex of noseVertices) {
        const z = positions.getZ(vertexIndex);
        if (z > maxZ) maxZ = z;
      }
      
      console.log(`NoseEditor: Front-most Z value is ${maxZ}`);
      
      // Debug: Log the bounding box dimensions
      console.log('NoseEditor: Nose bounding box:', {
        center: center.toArray(),
        size: size.toArray()
      });
      
      // Adjust vertices in the tip area
      for (const vertexIndex of noseVertices) {
        const x = positions.getX(vertexIndex);
        const y = positions.getY(vertexIndex);
        const z = positions.getZ(vertexIndex);
        
        // Enhanced tip area detection with more inclusive criteria
        // Tip is typically at the front-most part of the nose
        const xDistanceFromCenter = Math.abs(x - center.x);
        const xDistanceNormalized = xDistanceFromCenter / (size.x/2);
        
        // Normalized Y position (0 at bottom, 1 at top)
        const normalizedY = (y - (center.y - size.y/2)) / size.y;
        
        // How close this vertex is to the front-most point
        const zDistanceFromFront = maxZ - z;
        const zDistanceNormalized = zDistanceFromFront / (size.z/2);
        
        // More inclusive criteria for tip vertices:
        // 1. Increased X distance threshold from 0.4 to 0.5
        // 2. Expanded Y range from 0.3-0.8 to 0.2-0.9
        // 3. Increased Z distance threshold from 0.3 to 0.5
        // 4. Added a special case for front-most vertices regardless of other criteria
        const isCentralVertex = xDistanceNormalized < 0.5;
        const isInYRange = normalizedY > 0.2 && normalizedY < 0.9;
        const isNearFront = zDistanceNormalized < 0.5;
        const isFrontMostVertex = zDistanceNormalized < 0.1; // Special case for very front vertices
        
        // Log some vertices for debugging
        if (vertexIndex % Math.max(1, Math.floor(noseVertices.length / 10)) === 0) {
          console.log(`Vertex ${vertexIndex} position:`, {
            x, y, z,
            xDistanceNormalized,
            normalizedY,
            zDistanceNormalized,
            isCentralVertex,
            isInYRange,
            isNearFront,
            isFrontMostVertex
          });
        }
        
        // Apply adjustment if vertex meets the criteria
        if ((isCentralVertex && isInYRange && isNearFront) || isFrontMostVertex) {
          // Apply a falloff effect based on distance from the tip center
          // Stronger effect for front-most vertices
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
          affectedVertices.push(vertexIndex);
          
          // Add visual marker for the first few affected vertices if in edit mode
          if (isEditMode && scene && verticesAffected <= 20) { // Increased from 10 to 20 markers
            const marker = new THREE.Mesh(
              new THREE.SphereGeometry(size.x * 0.02),
              new THREE.MeshBasicMaterial({ color: 0x00ff00 })
            );
            marker.position.set(x, y, z + adjustedAmount);
            marker.position.applyMatrix4(noseMeshRef.current.matrixWorld);
            scene.add(marker);
            markers.push(marker);
          }
        }
      }
      
      // Remove markers after 5 seconds
      if (markers.length > 0 && scene) {
        setTimeout(() => {
          markers.forEach(marker => scene?.remove(marker));
        }, 5000);
      }
      
      console.log(`NoseEditor: Tip adjustment affected ${verticesAffected} vertices with amount ${amplifiedAmount}`);
      if (verticesAffected === 0) {
        console.warn('NoseEditor: No vertices were affected by tip adjustment!');
        console.warn('NoseEditor: This may indicate an issue with the nose detection or model structure.');
        console.log('NoseEditor: Total nose vertices:', noseVertices.length);
        
        // Add a fallback method if no vertices were affected
        if (noseVertices.length > 0) {
          console.log('NoseEditor: Attempting fallback method for tip adjustment...');
          
          // Find the front-most 10% of vertices and adjust them
          const verticesWithZ = noseVertices.map(index => ({
            index,
            z: positions.getZ(index)
          }));
          
          // Sort by Z value descending (front-most first)
          verticesWithZ.sort((a, b) => b.z - a.z);
          
          // Take the front 10% or at least 5 vertices
          const frontVerticesCount = Math.max(5, Math.floor(noseVertices.length * 0.1));
          const frontVertices = verticesWithZ.slice(0, frontVerticesCount);
          
          console.log(`NoseEditor: Fallback - adjusting front-most ${frontVertices.length} vertices`);
          
          // Adjust these vertices
          for (const {index} of frontVertices) {
            const x = positions.getX(index);
            const y = positions.getY(index);
            const z = positions.getZ(index);
            
            positions.setZ(index, z + amplifiedAmount);
            verticesAffected++;
            
            // Add visual marker if in edit mode
            if (isEditMode && scene && verticesAffected <= 10) {
              const marker = new THREE.Mesh(
                new THREE.SphereGeometry(size.x * 0.03), // Larger marker for fallback
                new THREE.MeshBasicMaterial({ color: 0xff0000 }) // Red for fallback
              );
              marker.position.set(x, y, z + amplifiedAmount);
              marker.position.applyMatrix4(noseMeshRef.current.matrixWorld);
              scene.add(marker);
              markers.push(marker);
            }
          }
          
          console.log(`NoseEditor: Fallback method affected ${verticesAffected} vertices`);
        }
      } else if (verticesAffected < 5) {
        console.warn('NoseEditor: Very few vertices affected by tip adjustment. Check detection criteria.');
        console.log('NoseEditor: First few affected vertices:', affectedVertices.slice(0, 5));
      }
      
      positions.needsUpdate = true;
      noseMeshRef.current.geometry.computeVertexNormals();
    }
  };
  
  const adjustNostrilWidth = (amount: number) => {
    if (!noseMeshRef.current) {
      console.warn('NoseEditor: Cannot adjust nostrils - no nose mesh reference');
      return;
    }
    
    if (noseMeshRef.current.geometry instanceof BufferGeometry) {
      const positions = noseMeshRef.current.geometry.attributes.position;
      const box = new THREE.Box3().setFromObject(noseMeshRef.current);
      const center = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      
      // Significantly increase amplification for more visible effect
      const amplifiedAmount = amount * 0.3 * size.x; // Increased from 0.1 to 0.3
      let verticesAffected = 0;
      const affectedVertices: number[] = [];
      
      console.log(`NoseEditor: Starting nostril adjustment with amount ${amount}, amplified to ${amplifiedAmount}`);
      
      // Create visual markers for debugging if in edit mode
      const markers: THREE.Mesh[] = [];
      
      // Adjust vertices in the nostril area
      for (const vertexIndex of noseVertices) {
        const x = positions.getX(vertexIndex);
        const y = positions.getY(vertexIndex);
        const z = positions.getZ(vertexIndex);
        
        // Enhanced nostril area detection
        // Normalized positions
        const xDistanceFromCenter = Math.abs(x - center.x);
        const xDistanceNormalized = xDistanceFromCenter / (size.x/2);
        
        // Normalized Y position (0 at bottom, 1 at top)
        const normalizedY = (y - (center.y - size.y/2)) / size.y;
        
        // Normalized Z position (0 at back, 1 at front)
        const normalizedZ = (z - (center.z - size.z/2)) / size.z;
        
        // Nostril vertices are on the sides and lower-middle part of the nose
        // More inclusive criteria
        if (xDistanceNormalized > 0.2 && // Not at the very center
            normalizedY > 0.2 && normalizedY < 0.6 && // Lower-middle part
            normalizedZ > 0.5) { // Front half
          
          // Apply a falloff effect based on distance from the nostril center
          // Stronger effect on the sides
          const falloff = xDistanceNormalized * (1 - Math.abs(normalizedY - 0.4));
          const adjustedAmount = amplifiedAmount * falloff;
          
          // Widen or narrow the nostrils
          const direction = x > center.x ? 1 : -1;
          positions.setX(vertexIndex, x + (direction * adjustedAmount));
          verticesAffected++;
          affectedVertices.push(vertexIndex);
          
          // Add visual marker for the first few affected vertices if in edit mode
          if (isEditMode && scene && verticesAffected <= 10) {
            const marker = new THREE.Mesh(
              new THREE.SphereGeometry(size.x * 0.02),
              new THREE.MeshBasicMaterial({ color: 0x0000ff })
            );
            marker.position.set(x + (direction * adjustedAmount), y, z);
            marker.position.applyMatrix4(noseMeshRef.current.matrixWorld);
            scene.add(marker);
            markers.push(marker);
          }
        }
      }
      
      // Remove markers after 5 seconds
      if (markers.length > 0 && scene) {
        setTimeout(() => {
          markers.forEach(marker => scene?.remove(marker));
        }, 5000);
      }
      
      console.log(`NoseEditor: Nostril adjustment affected ${verticesAffected} vertices with amount ${amplifiedAmount}`);
      if (verticesAffected === 0) {
        console.warn('NoseEditor: No vertices were affected by nostril adjustment!');
      } else if (verticesAffected < 5) {
        console.warn('NoseEditor: Very few vertices affected by nostril adjustment. Check detection criteria.');
        console.log('NoseEditor: First few affected vertices:', affectedVertices.slice(0, 5));
      }
      
      positions.needsUpdate = true;
      noseMeshRef.current.geometry.computeVertexNormals();
    }
  };
  
  return {
    handleMouseDown,
    resetNose,
    adjustNoseBridge,
    adjustNoseTip,
    adjustNostrilWidth,
    selectedVertex
  };
};

export default NoseEditor;