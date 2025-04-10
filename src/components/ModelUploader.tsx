import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { Group, Mesh, MeshStandardMaterial, Texture } from 'three';

interface ModelUploaderProps {
  onModelLoaded: (model: Group) => void;
  onError: (error: string) => void;
}

interface FileMap {
  obj?: File;
  mtl?: File;
  textures: File[];
  stl?: File;
  ply?: File;
}

const ModelUploader = ({ onModelLoaded, onError }: ModelUploaderProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('Drag & drop a 3D model, or click to select');

  // Group files by type
  const organizeFiles = (files: File[]): FileMap => {
    const fileMap: FileMap = { textures: [] };
    
    files.forEach(file => {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      
      if (extension === 'obj') {
        fileMap.obj = file;
      } else if (extension === 'mtl') {
        fileMap.mtl = file;
      } else if (extension === 'stl') {
        fileMap.stl = file;
      } else if (extension === 'ply') {
        fileMap.ply = file;
      } else if (['jpg', 'jpeg', 'png', 'bmp', 'tga'].includes(extension)) {
        fileMap.textures.push(file);
      }
    });
    
    return fileMap;
  };

  // Create object URLs for textures
  const createTextureURLs = (textureFiles: File[]): Record<string, string> => {
    const textureURLs: Record<string, string> = {};
    
    textureFiles.forEach(file => {
      const fileName = file.name.toLowerCase();
      textureURLs[fileName] = URL.createObjectURL(file);
    });
    
    return textureURLs;
  };

  // Load OBJ with materials
  const loadOBJWithMaterials = async (objFile: File, mtlFile?: File, textureFiles: File[] = []): Promise<Group> => {
    return new Promise((resolve, reject) => {
      const textureURLs = createTextureURLs(textureFiles);
      
      // If we have an MTL file, load it first
      if (mtlFile) {
        const mtlReader = new FileReader();
        
        mtlReader.onload = (mtlEvent) => {
          if (!mtlEvent.target?.result) {
            reject('Failed to read MTL file');
            return;
          }
          
          const mtlLoader = new MTLLoader();
          const materials = mtlLoader.parse(mtlEvent.target.result as string, '');
          
          // Set texture paths for the materials
          materials.materialsInfo = Object.entries(materials.materialsInfo).reduce((acc, [key, material]) => {
            if (material.map_kd) {
              const textureName = material.map_kd.toLowerCase();
              // Check if we have this texture in our uploaded files
              for (const [fileName, url] of Object.entries(textureURLs)) {
                if (fileName.includes(textureName) || textureName.includes(fileName.split('.')[0])) {
                  material.map_kd = url;
                  break;
                }
              }
            }
            acc[key] = material;
            return acc;
          }, {} as any);
          
          materials.preload();
          
          // Now load the OBJ file with the materials
          const objReader = new FileReader();
          
          objReader.onload = (objEvent) => {
            if (!objEvent.target?.result) {
              reject('Failed to read OBJ file');
              return;
            }
            
            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            
            try {
              const model = objLoader.parse(objEvent.target.result as string);
              resolve(model);
            } catch (error) {
              reject(error instanceof Error ? error.message : 'Failed to parse OBJ file');
            }
          };
          
          objReader.onerror = () => reject('Error reading OBJ file');
          objReader.readAsText(objFile);
        };
        
        mtlReader.onerror = () => reject('Error reading MTL file');
        mtlReader.readAsText(mtlFile);
      } else {
        // No MTL file, just load the OBJ
        const objReader = new FileReader();
        
        objReader.onload = (objEvent) => {
          if (!objEvent.target?.result) {
            reject('Failed to read OBJ file');
            return;
          }
          
          const objLoader = new OBJLoader();
          
          try {
            const model = objLoader.parse(objEvent.target.result as string);
            
            // Apply a default material if no MTL was provided
            model.traverse((child) => {
              if (child instanceof Mesh) {
                child.material = new MeshStandardMaterial({
                  color: 0xcccccc,
                  roughness: 0.55,
                  metalness: 0.1,
                });
              }
            });
            
            resolve(model);
          } catch (error) {
            reject(error instanceof Error ? error.message : 'Failed to parse OBJ file');
          }
        };
        
        objReader.onerror = () => reject('Error reading OBJ file');
        objReader.readAsText(objFile);
      }
    });
  };

  // Load STL or PLY file
  const loadGeometryFile = async (file: File, fileExtension: string): Promise<Group> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (!event.target?.result) {
          reject('Failed to read file');
          return;
        }
        
        try {
          let loader;
          switch (fileExtension) {
            case 'ply':
              loader = new PLYLoader();
              break;
            case 'stl':
              loader = new STLLoader();
              break;
            default:
              throw new Error(`Unsupported file format: ${fileExtension}`);
          }
          
          const geometry = loader.parse(event.target.result as ArrayBuffer);
          const material = new MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.55,
            metalness: 0.1,
          });
          const mesh = new Mesh(geometry, material);
          const group = new Group();
          group.add(mesh);
          resolve(group);
        } catch (error) {
          reject(error instanceof Error ? error.message : 'Failed to load model');
        }
      };
      
      reader.onerror = () => reject('Error reading file');
      reader.readAsArrayBuffer(file);
    });
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      
      setIsLoading(true);
      setUploadMessage('Loading model...');
      
      try {
        const fileMap = organizeFiles(acceptedFiles);
        
        // Determine which type of model to load
        if (fileMap.obj) {
          // OBJ file with possible MTL and textures
          const model = await loadOBJWithMaterials(fileMap.obj, fileMap.mtl, fileMap.textures);
          onModelLoaded(model);
        } else if (fileMap.stl) {
          // STL file
          const model = await loadGeometryFile(fileMap.stl, 'stl');
          onModelLoaded(model);
        } else if (fileMap.ply) {
          // PLY file
          const model = await loadGeometryFile(fileMap.ply, 'ply');
          onModelLoaded(model);
        } else {
          throw new Error('No supported 3D model file found');
        }
      } catch (error) {
        console.error('Error loading model:', error);
        onError(error instanceof Error ? error.message : 'Failed to load model');
      } finally {
        setIsLoading(false);
        setUploadMessage('Drag & drop a 3D model, or click to select');
      }
    },
    [onModelLoaded, onError]
  );

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      // This would ideally clean up any created object URLs, but we'd need to track them
      // For simplicity, we're not implementing full cleanup in this example
    };
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'model/obj': ['.obj'],
      'model/stl': ['.stl'],
      'model/ply': ['.ply'],
      'model/mtl': ['.mtl'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/bmp': ['.bmp'],
      'image/tga': ['.tga'],
    },
    multiple: true, // Allow multiple files to be uploaded
  });

  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? 'active' : ''}`}
    >
      <input {...getInputProps()} />
      <div className="dropzone-content">
        <div className="dropzone-icon">
          {isLoading ? (
            <div className="loading-spinner"></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          )}
        </div>
        <h3 className="dropzone-text">
          {isLoading
            ? 'Loading model...'
            : isDragActive
            ? 'Drop the files here'
            : uploadMessage}
        </h3>
        <p className="dropzone-subtext">
          Supported formats: OBJ (with MTL and textures), STL, PLY
        </p>
      </div>
    </div>
  );
};

export default ModelUploader;