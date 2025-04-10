interface NoseEditor {
  resetNose: () => void;
  adjustNoseBridge: (amount: number) => void;
  adjustNoseTip: (amount: number) => void;
  adjustNostrilWidth: (amount: number) => void;
  handleMouseDown: (x: number, y: number) => void;
  setMarkerDensity: (density: 'low' | 'medium' | 'high') => void;
  _currentDensity?: 'low' | 'medium' | 'high';
}

declare global {
  interface Window {
    noseEditor?: NoseEditor;
  }
}

export {};