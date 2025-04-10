import { useEffect } from 'react';

interface EditModeSyncProps {
  isEditMode: boolean;
  setIsEditMode: (mode: boolean) => void;
}

const EditModeSync: React.FC<EditModeSyncProps> = ({ isEditMode, setIsEditMode }) => {
  // Expose the setIsEditMode function globally
  useEffect(() => {
    // @ts-ignore
    window.setGlobalEditMode = (mode: boolean) => {
      setIsEditMode(mode);
    };
    
    // Expose the current edit mode state
    // @ts-ignore
    window.globalEditMode = isEditMode;
    
    // Check for changes to global edit mode
    const intervalId = setInterval(() => {
      // @ts-ignore
      if (window.globalEditMode !== undefined && window.globalEditMode !== isEditMode) {
        // @ts-ignore
        setIsEditMode(window.globalEditMode);
      }
    }, 100);
    
    return () => {
      clearInterval(intervalId);
      // @ts-ignore
      delete window.setGlobalEditMode;
    };
  }, [isEditMode, setIsEditMode]);
  
  return null; // This is a logic-only component
};

export default EditModeSync;