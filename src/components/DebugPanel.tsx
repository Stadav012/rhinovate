import React, { useEffect, useState } from 'react';

const DebugPanel: React.FC = () => {
  const [noseEditorFunctions, setNoseEditorFunctions] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<string>('None');
  
  useEffect(() => {
    const checkNoseEditor = () => {
      // @ts-ignore
      if (window.noseEditor) {
        // @ts-ignore
        const functions = Object.keys(window.noseEditor);
        setNoseEditorFunctions(functions);
        
        // Monitor function calls
        functions.forEach(funcName => {
          // @ts-ignore
          const originalFunc = window.noseEditor[funcName];
          if (typeof originalFunc === 'function') {
            // @ts-ignore
            window.noseEditor[funcName] = (...args: any[]) => {
              setLastAction(`${funcName}(${args.map(a => JSON.stringify(a)).join(', ')})`);
              return originalFunc(...args);
            };
          }
        });
      }
    };
    
    checkNoseEditor();
    const interval = setInterval(checkNoseEditor, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  if (noseEditorFunctions.length === 0) return null;
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      left: '10px',
      background: 'rgba(0,0,0,0.7)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      zIndex: 1000,
      maxWidth: '300px',
      fontSize: '12px'
    }}>
      <h4>Nose Editor Functions:</h4>
      <ul>
        {noseEditorFunctions.map(func => (
          <li key={func}>{func}</li>
        ))}
      </ul>
      <div>
        <strong>Last Action:</strong> {lastAction}
      </div>
    </div>
  );
};

export default DebugPanel;