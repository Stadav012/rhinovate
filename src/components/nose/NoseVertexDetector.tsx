import { useState, useEffect } from 'react';
import { Group, Mesh, BufferGeometry, Vector3 } from 'three';
import * as THREE from 'three';
import { NoseVertexDetectorProps } from './types';

export const useNoseVertexDetector = ({ model, scene, isEditMode }: NoseVertexDetectorProps) => {
  const [noseMesh, setNoseMesh] = useState<Mesh | null>(null);
  const [noseVertices, setNoseVertices] = useState<number[]>([]);
  const [originalGeometry, setOriginalGeometry] = useState<BufferGeometry | null>(null);
  
  // Find the nose mesh in the model
  useEffect(() => {
    console.log('NoseVertexDetector: Model effect triggered, model =', !!model);
    
    if (!model) return;
    
    console.log('NoseVertexDetector: Searching for nose mesh in model');
    
    let foundNoseMesh: THREE.Mesh | null = null;
    
    // Find the first mesh in the model
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const meshChild = child as THREE.Mesh;
        console.log('NoseVertexDetector: Found mesh:', meshChild.name || 'unnamed mesh', 
                    'visible:', meshChild.visible, 
                    'geometry vertices:', meshChild.geometry.attributes.position?.count);
        
        if (!foundNoseMesh && meshChild.geometry instanceof THREE.BufferGeometry) {
          foundNoseMesh = meshChild;
        }
      }
    });
    
    if (foundNoseMesh) {
      // Explicitly type cast to ensure TypeScript recognizes it correctly
      const typedNoseMesh = foundNoseMesh as THREE.Mesh;
      console.log('NoseVertexDetector: Setting nose mesh:', typedNoseMesh.name || 'unnamed mesh');
      
      // Make sure the mesh is visible
      typedNoseMesh.visible = true;
      
      // Store the original geometry for reset functionality
      if (typedNoseMesh.geometry instanceof THREE.BufferGeometry) {
        const originalGeometryCopy = typedNoseMesh.geometry.clone();
        setOriginalGeometry(originalGeometryCopy);
        console.log('NoseVertexDetector: Stored original geometry with', 
                    originalGeometryCopy.attributes.position.count, 'vertices');
      }
      
      setNoseMesh(typedNoseMesh);
    } else {
      console.warn('NoseVertexDetector: No mesh found in the model');
    }
  }, [model]);
  
  // Detect nose vertices using a precise geometric approach
  useEffect(() => {
    console.log('NoseVertexDetector: Nose mesh effect triggered, noseMesh =', !!noseMesh);
    
    if (!noseMesh) return;
    
    console.log('NoseVertexDetector: Detecting nose vertices');
    
    try {
      const geometry = noseMesh.geometry;
      if (geometry instanceof THREE.BufferGeometry) {
        const positions = geometry.attributes.position;
        const vertexCount = positions.count;
        
        console.log('NoseVertexDetector: Total vertex count:', vertexCount);
        
        // Get all vertex indices
        const allVertices = Array.from({ length: vertexCount }, (_, i) => i);
        
        // Find the center and dimensions of the mesh
        const box = new THREE.Box3().setFromObject(noseMesh);
        const center = box.getCenter(new Vector3());
        const size = box.getSize(new Vector3());
        
        console.log('NoseVertexDetector: Model center:', center);
        console.log('NoseVertexDetector: Model size:', size);
        
        // Step 1: Find the front-most point in the central region (likely the nose tip)
        let maxZ = -Infinity;
        let noseTipIndex = -1;
        let noseTipPosition = new Vector3();
        
        // Search for the nose tip in the central region of the face
        for (const index of allVertices) {
          const x = positions.getX(index);
          const y = positions.getY(index);
          const z = positions.getZ(index);
          
          // Calculate normalized position relative to bounding box
          const normalizedX = (x - (center.x - size.x/2)) / size.x;
          const normalizedY = (y - (center.y - size.y/2)) / size.y;
          const normalizedZ = (z - (center.z - size.z/2)) / size.z;
          
          // Only consider points in the central region of the face for the tip
          // This is a much tighter focus on where the nose tip should be
          if (normalizedX >= 0.45 && normalizedX <= 0.55 && 
              normalizedY >= 0.45 && normalizedY <= 0.6 && 
              normalizedZ > 0.7) { // Only consider points very far forward
            if (z > maxZ) {
              maxZ = z;
              noseTipIndex = index;
              noseTipPosition.set(x, y, z);
            }
          }
        }
        
        console.log('NoseVertexDetector: Identified nose tip at vertex', noseTipIndex, 'position:', noseTipPosition);
        
        // If we couldn't find a nose tip with the strict criteria, try a more relaxed approach
        if (noseTipIndex === -1) {
          console.warn('NoseVertexDetector: Could not identify nose tip with strict criteria, using relaxed criteria');
          
          // Relaxed criteria for nose tip
          for (const index of allVertices) {
            const x = positions.getX(index);
            const y = positions.getY(index);
            const z = positions.getZ(index);
            
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
                noseTipIndex = index;
                noseTipPosition.set(x, y, z);
              }
            }
          }
        }
        
        // If we still couldn't find a nose tip, use the center of the front face
        if (noseTipIndex === -1) {
          console.warn('NoseVertexDetector: Could not identify nose tip, using center of front face');
          noseTipPosition.set(center.x, center.y, center.z + size.z/2);
        }
        
        // Step 2: Define the nose region based on proximity to the nose tip and protrusion
        const noseRegion = allVertices.filter(index => {
          const x = positions.getX(index);
          const y = positions.getY(index);
          const z = positions.getZ(index);
          const position = new Vector3(x, y, z);
          
          // Calculate normalized position
          const normalizedX = (x - (center.x - size.x/2)) / size.x;
          const normalizedY = (y - (center.y - size.y/2)) / size.y;
          const normalizedZ = (z - (center.z - size.z/2)) / size.z;
          
          // Distance to nose tip (in world units)
          const distanceToTip = position.distanceTo(noseTipPosition);
          
          // Normalized distance as a percentage of model size
          const normalizedDistance = distanceToTip / Math.max(size.x, size.y, size.z);
          
          // Define a precise nose region:
          // 1. Must be in the central X range (horizontally centered)
          const isInXRange = normalizedX >= 0.4 && normalizedX <= 0.6;
          
          // 2. Must be in the middle-upper Y range (vertically in the middle of the face)
          const isInYRange = normalizedY >= 0.35 && normalizedY <= 0.65;
          
          // 3. Must be in the front portion of the face (high Z value)
          const isInFrontPortion = normalizedZ >= 0.6;
          
          // 4. OR must be very close to the identified nose tip
          const isCloseToTip = normalizedDistance < 0.1; // Within 10% of model size from tip
          
          return (isInXRange && isInYRange && isInFrontPortion) || isCloseToTip;
        });
        
        console.log(`NoseVertexDetector: Identified ${noseRegion.length} nose vertices out of ${vertexCount} total vertices`);
        
        // If we found too few or too many vertices, try a more focused approach
        if (noseRegion.length < 20 || noseRegion.length > vertexCount * 0.3) {
          console.warn(`NoseVertexDetector: Nose detection issue - found ${noseRegion.length} vertices, trying secondary method`);
          
          // Secondary method: use a spherical region around the nose tip with a smaller radius
          const noseTipRegion = allVertices.filter(index => {
            const x = positions.getX(index);
            const y = positions.getY(index);
            const z = positions.getZ(index);
            const position = new Vector3(x, y, z);
            
            // Distance to nose tip
            const distanceToTip = position.distanceTo(noseTipPosition);
            
            // Use a smaller, more focused region
            return distanceToTip < size.x * 0.1; // 10% of model width as radius
          });
          
          console.log(`NoseVertexDetector: Secondary method found ${noseTipRegion.length} vertices`);
          
          if (noseTipRegion.length >= 10) {
            setNoseVertices(noseTipRegion);
          } else {
            // Last resort: use a very small region in the center-front of the face
            console.warn('NoseVertexDetector: Secondary method failed, using last resort method');
            
            // Find the most protruding vertices in the central face region
            const protrudingVertices = allVertices
              .map(index => {
                const x = positions.getX(index);
                const y = positions.getY(index);
                const z = positions.getZ(index);
                
                // Calculate normalized position
                const normalizedX = (x - (center.x - size.x/2)) / size.x;
                const normalizedY = (y - (center.y - size.y/2)) / size.y;
                const normalizedZ = (z - (center.z - size.z/2)) / size.z;
                
                // Only consider central face region
                if (normalizedX >= 0.4 && normalizedX <= 0.6 && 
                    normalizedY >= 0.4 && normalizedY <= 0.6) {
                  return { index, z: normalizedZ };
                }
                return null;
              })
              .filter(item => item !== null)
              // @ts-ignore - we filtered out nulls
              .sort((a, b) => b.z - a.z) // Sort by Z value (most protruding first)
              // @ts-ignore - we filtered out nulls
              .slice(0, 50) // Take top 50 most protruding vertices
              // @ts-ignore - we filtered out nulls
              .map(item => item.index);
            
            console.log(`NoseVertexDetector: Last resort method found ${protrudingVertices.length} vertices`);
            
            if (protrudingVertices.length > 0) {
              setNoseVertices(protrudingVertices);
            } else {
              // Absolute last resort - just use the original region if it had any vertices
              setNoseVertices(noseRegion.length > 0 ? noseRegion : []);
            }
          }
        } else {
          // Use the primary detection method results
          setNoseVertices(noseRegion);
        }
        
        // Add debug visualization for the detected nose area if in edit mode
        if (scene && noseMesh && isEditMode) {
          // Remove any existing visualization
          const existingVisualization = scene.getObjectByName('noseAreaVisualization');
          if (existingVisualization) scene.remove(existingVisualization);
          
          // Create a visualization of the detected nose area
          const noseAreaGeometry = new THREE.BufferGeometry();
          const vertices = [];
          
          // Get the vertices that were identified as part of the nose
          const finalNoseVertices = noseVertices.length > 0 ? noseVertices : noseRegion;
          for (const index of finalNoseVertices) {
            if (index < positions.count) {
              vertices.push(
                positions.getX(index),
                positions.getY(index),
                positions.getZ(index)
              );
            }
          }
          
          if (vertices.length > 0) {
            noseAreaGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            const noseAreaMaterial = new THREE.PointsMaterial({ 
              color: 0x00ff00, 
              size: Math.min(size.x, size.y, size.z) * 0.01,
              sizeAttenuation: true
            });
            
            const noseAreaPoints = new THREE.Points(noseAreaGeometry, noseAreaMaterial);
            noseAreaPoints.name = 'noseAreaVisualization';
            noseAreaPoints.visible = true;
            noseAreaPoints.renderOrder = 999;
            
            // Apply the same transformation as the nose mesh
            noseAreaPoints.matrix.copy(noseMesh.matrix);
            noseAreaPoints.matrixAutoUpdate = false;
            
            scene.add(noseAreaPoints);
            console.log('NoseVertexDetector: Added visualization for nose area with', vertices.length / 3, 'points');
          }
        }
      }
    } catch (error) {
      console.error('NoseVertexDetector: Error detecting nose vertices:', error);
      // Fallback to using all vertices if there's an error
      if (noseMesh && noseMesh.geometry) {
        const positions = noseMesh.geometry.attributes.position;
        const allVertices = Array.from({ length: positions.count }, (_, i) => i);
        setNoseVertices(allVertices);
        console.log('NoseVertexDetector: Using all vertices as fallback after error');
      }
    }
  }, [noseMesh]);
  
  return { noseMesh, noseVertices, originalGeometry };
};