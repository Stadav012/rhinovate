interface Toast {
  info: (message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
}

interface NoseEditor {
  resetNose: () => void;
  adjustNoseBridge: (amount: number) => void;
  adjustNoseTip: (amount: number) => void;
  adjustNostrilWidth: (amount: number) => void;
  handleMouseDown: (x: number, y: number) => void;
  handleMouseMove: (x: number, y: number) => void;
  setMarkerDensity: (density: 'low' | 'medium' | 'high') => void;
  _currentDensity?: 'low' | 'medium' | 'high';
}

declare global {
  interface Window {
    noseEditor?: NoseEditor;
    globalEditMode?: boolean;
    toast?: Toast;
  }
}

export {};