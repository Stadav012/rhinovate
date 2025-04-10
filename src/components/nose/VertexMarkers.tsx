import { useEffect } from 'react';
import { Mesh, Vector3 } from 'three';
import * as THREE from 'three';
import { VertexMarkersProps } from './types';

export const useVertexMarkers = ({ 
  noseMesh, 
  noseVertices, 
  scene, 
  isEditMode,
  selectedVertex
}: VertexMarkersProps) => {
  
  // Show vertex markers when in edit mode
  useEffect(() => {
    console.log('VertexMarkers: Effect triggered with isEditMode =', isEditMode, 
                'noseMesh =', !!noseMesh, 
                'scene =', !!scene, 
                'noseVertices =', noseVertices?.length);
    
    if (!noseMesh || !scene) {
      console.warn('VertexMarkers: Missing noseMesh or scene');
      return;
    }
    
    // Remove any existing markers first
    const existingMarkers = scene.children.filter(child => 
      child.name && child.name.startsWith('vertexMarker-')
    );
    console.log('VertexMarkers: Removing', existingMarkers.length, 'existing markers');
    existingMarkers.forEach(marker => scene.remove(marker));
    
    // Only show markers in edit mode
    if (isEditMode && noseVertices.length > 0) {
      console.log('VertexMarkers: Adding vertex markers for edit mode, vertices count:', noseVertices.length);
      
      try {
        // Get the geometry to access vertex positions
        const positions = noseMesh.geometry.attributes.position;
        console.log('VertexMarkers: Position attribute exists:', !!positions);
        console.log('VertexMarkers: Position count:', positions?.count);
        
        // Calculate an appropriate size for markers based on model dimensions
        const box = new THREE.Box3().setFromObject(noseMesh);
        const size = box.getSize(new Vector3());
        console.log('VertexMarkers: Model size:', size);
        
        const markerSize = Math.min(size.x, size.y, size.z) * 0.03; // Increased size for better visibility
        console.log('VertexMarkers: Marker size:', markerSize);
        
        // Create a material for the vertex markers - make it more visible
        const markerMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xff006e, // Bright pink color
          transparent: false, // Make fully opaque
          depthTest: false, // Always render on top
          side: THREE.DoubleSide // Visible from all sides
        });
        
        // Create a reusable geometry for all markers
        const markerGeometry = new THREE.SphereGeometry(markerSize);
        
        // Show more markers for better interaction
        const vertexCount = noseVertices.length;
        const maxMarkersToShow = Math.min(300, vertexCount); // Show more markers
        const step = Math.max(1, Math.floor(vertexCount / maxMarkersToShow));
        
        console.log('VertexMarkers: Will show approximately', Math.ceil(vertexCount / step), 'markers with step', step);
        
        let markersAdded = 0;
        
        // Create markers for the selected vertices
        for (let i = 0; i < noseVertices.length; i += step) {
          const vertexIndex = noseVertices[i];
          
          if (vertexIndex >= positions.count) {
            console.warn(`VertexMarkers: Vertex index ${vertexIndex} out of bounds (max: ${positions.count - 1})`);
            continue;
          }
          
          const x = positions.getX(vertexIndex);
          const y = positions.getY(vertexIndex);
          const z = positions.getZ(vertexIndex);
          
          // Create a marker mesh
          const marker = new THREE.Mesh(markerGeometry, markerMaterial.clone());
          marker.name = `vertexMarker-${vertexIndex}`;
          marker.userData.vertexIndex = vertexIndex;
          
          // Position the marker at the vertex position in world space
          const worldPos = new Vector3(x, y, z).applyMatrix4(noseMesh.matrixWorld);
          marker.position.copy(worldPos);
          
          // Make sure markers are rendered on top
          marker.renderOrder = 999;
          
          // Add the marker to the scene
          scene.add(marker);
          markersAdded++;
          
          // Log every 10th marker for debugging
          if (markersAdded % 10 === 0 || markersAdded < 5) {
            console.log(`VertexMarkers: Added marker ${markersAdded} at position:`, worldPos);
          }
        }
        
        console.log(`VertexMarkers: Added ${markersAdded} vertex markers`);
        
        // Add a special marker at the tip of the nose for easier selection
        // Find the front-most vertex for the tip
        let maxZ = -Infinity;
        let tipVertexIndex = -1;
        
        for (const vertexIndex of noseVertices) {
          if (vertexIndex >= positions.count) continue;
          const z = positions.getZ(vertexIndex);
          if (z > maxZ) {
            maxZ = z;
            tipVertexIndex = vertexIndex;
          }
        }
        
        if (tipVertexIndex !== -1) {
          const x = positions.getX(tipVertexIndex);
          const y = positions.getY(tipVertexIndex);
          const z = positions.getZ(tipVertexIndex);
          
          const tipMarker = new THREE.Mesh(
            new THREE.SphereGeometry(markerSize * 2),
            new THREE.MeshBasicMaterial({ 
              color: 0x00ff00, 
              transparent: false, 
              depthTest: false,
              side: THREE.DoubleSide
            })
          );
          
          tipMarker.name = `vertexMarker-tip-${tipVertexIndex}`;
          tipMarker.userData.vertexIndex = tipVertexIndex;
          
          // Position in world space
          const worldPos = new Vector3(x, y, z).applyMatrix4(noseMesh.matrixWorld);
          tipMarker.position.copy(worldPos);
          
          // Make sure it's rendered on top
          tipMarker.renderOrder = 1000;
          
          scene.add(tipMarker);
          
          console.log('VertexMarkers: Added special tip marker at position', worldPos);
        }
        
        // Add debug axes to help with orientation
        const axesHelper = new THREE.AxesHelper(Math.max(size.x, size.y, size.z) * 0.5);
        axesHelper.name = 'vertexMarker-axes';
        scene.add(axesHelper);
        console.log('VertexMarkers: Added axes helper');
        
        // Force a render update
        if (scene.userData.needsUpdate !== undefined) {
          scene.userData.needsUpdate = true;
        }
      } catch (error) {
        console.error('VertexMarkers: Error creating markers:', error);
      }
    }
    
    // Return a cleanup function
    return () => {
      console.log('VertexMarkers: Cleanup function called');
      const markersToRemove = scene.children.filter(child => 
        child.name && (child.name.startsWith('vertexMarker-') || child.name === 'selectedVertexHighlight')
      );
      console.log('VertexMarkers: Removing', markersToRemove.length, 'markers in cleanup');
      markersToRemove.forEach(marker => scene.remove(marker));
    };
  }, [isEditMode, noseMesh, scene, noseVertices]);

  // Highlight the selected vertex
  useEffect(() => {
    if (!scene || !noseMesh || selectedVertex === null) return;
    
    // Remove any existing highlight
    const existingHighlight = scene.getObjectByName('selectedVertexHighlight');
    if (existingHighlight) scene.remove(existingHighlight);
    
    // Get the position of the selected vertex
    const positions = noseMesh.geometry.attributes.position;
    const x = positions.getX(selectedVertex);
    const y = positions.getY(selectedVertex);
    const z = positions.getZ(selectedVertex);
    
    // Create a larger, brighter highlight for the selected vertex
    const box = new THREE.Box3().setFromObject(noseMesh);
    const size = box.getSize(new Vector3());
    const highlightSize = Math.min(size.x, size.y, size.z) * 0.03; // Larger highlight
    
    const highlight = new THREE.Mesh(
      new THREE.SphereGeometry(highlightSize),
      new THREE.MeshBasicMaterial({ 
        color: 0xffff00, // Yellow for better visibility
        transparent: false,
        depthTest: false, // Always render on top
        side: THREE.DoubleSide
      })
    );
    
    highlight.name = 'selectedVertexHighlight';
    highlight.position.set(x, y, z);
    highlight.position.applyMatrix4(noseMesh.matrixWorld);
    
    // Make sure it's rendered on top
    highlight.renderOrder = 1001;
    
    scene.add(highlight);
    
    console.log('VertexMarkers: Added highlight for selected vertex', selectedVertex);
  }, [selectedVertex, noseMesh, scene]);
};