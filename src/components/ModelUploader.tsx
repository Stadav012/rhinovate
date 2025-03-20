import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { Group, Mesh, MeshStandardMaterial } from 'three';

interface ModelUploaderProps {
  onModelLoaded: (model: Group) => void;
  onError: (error: string) => void;
}

const ModelUploader = ({ onModelLoaded, onError }: ModelUploaderProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      setIsLoading(true);

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (!result) {
          setIsLoading(false);
          onError('Failed to read file');
          return;
        }

        try {
          let loader;
          switch (fileExtension) {
            case 'obj':
              loader = new OBJLoader();
              break;
            case 'ply':
              loader = new PLYLoader();
              break;
            case 'stl':
              loader = new STLLoader();
              break;
            default:
              throw new Error(`Unsupported file format: ${fileExtension}`);
          }

          if (fileExtension === 'obj') {
            // OBJLoader returns a Group directly
            const model = loader.parse(result as string) as Group;
            onModelLoaded(model);
          } else {
            // PLY and STL loaders return a BufferGeometry
            // We need to create a mesh from it with proper material
            const geometry = loader.parse(result as ArrayBuffer);
            
            // Create a mesh with the geometry and a standard material
            const material = new MeshStandardMaterial({ 
              color: 0xf5f5f5,
              roughness: 0.5,
              metalness: 0.1
            });
            const mesh = new Mesh(geometry, material);
            
            // Add the mesh to a group and pass it to the parent component
            const group = new Group();
            group.add(mesh);
            onModelLoaded(group);
          }
        } catch (error) {
          onError(`Error loading model: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        setIsLoading(false);
        onError('Error reading file');
      };

      if (fileExtension === 'obj') {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    },
    [onModelLoaded, onError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'model/obj': ['.obj'],
      'model/stl': ['.stl'],
      'model/ply': ['.ply'],
    },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? 'active' : ''}`}
      style={{
        border: '2px dashed #cccccc',
        borderRadius: '4px',
        padding: '20px',
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: isDragActive ? '#f0f9ff' : '#fafafa',
        marginBottom: '20px',
      }}
    >
      <input {...getInputProps()} />
      {isLoading ? (
        <p>Loading model...</p>
      ) : isDragActive ? (
        <p>Drop the 3D model here...</p>
      ) : (
        <div>
          <p>Drag and drop a 3D model here, or click to select a file</p>
          <p style={{ fontSize: '0.8em', color: '#666' }}>
            Supported formats: OBJ, STL, PLY
          </p>
        </div>
      )}
    </div>
  );
};

export default ModelUploader;