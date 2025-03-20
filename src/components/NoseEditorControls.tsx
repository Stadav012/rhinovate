import { useState } from 'react';

interface NoseEditorControlsProps {
  isEditMode: boolean;
  setIsEditMode: (isEditMode: boolean) => void;
  resetNose: () => void;
  adjustNoseBridge: (amount: number) => void;
  adjustNoseTip: (amount: number) => void;
  adjustNostrilWidth: (amount: number) => void;
  selectedVertex: number | null;
}

const NoseEditorControls = ({
  isEditMode,
  setIsEditMode,
  resetNose,
  adjustNoseBridge,
  adjustNoseTip,
  adjustNostrilWidth,
  selectedVertex
}: NoseEditorControlsProps) => {
  const [bridgeAmount, setBridgeAmount] = useState<number>(0);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [nostrilAmount, setNostrilAmount] = useState<number>(0);

  const handleBridgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setBridgeAmount(value);
    adjustNoseBridge(value / 50); // Scale down for more precise control
  };

  const handleTipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setTipAmount(value);
    adjustNoseTip(value / 50); // Scale down for more precise control
  };

  const handleNostrilChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setNostrilAmount(value);
    adjustNostrilWidth(value / 50); // Scale down for more precise control
  };

  return (
    <div className="nose-editor-controls">
      <div className="control-header">
        <h3>Rhinoplasty Planning Tools</h3>
        <button 
          className={`edit-mode-toggle ${isEditMode ? 'active' : ''}`}
          onClick={() => setIsEditMode(!isEditMode)}
        >
          {isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
        </button>
      </div>

      <div className="control-section">
        <p className="section-title">Predefined Adjustments</p>
        
        <div className="control-group">
          <label htmlFor="bridge-slider">Bridge Height:</label>
          <input
            id="bridge-slider"
            type="range"
            min="-10"
            max="10"
            step="0.1"
            value={bridgeAmount}
            onChange={handleBridgeChange}
            disabled={!isEditMode}
          />
          <span className="value-display">{bridgeAmount.toFixed(1)}</span>
        </div>

        <div className="control-group">
          <label htmlFor="tip-slider">Tip Projection:</label>
          <input
            id="tip-slider"
            type="range"
            min="-10"
            max="10"
            step="0.1"
            value={tipAmount}
            onChange={handleTipChange}
            disabled={!isEditMode}
          />
          <span className="value-display">{tipAmount.toFixed(1)}</span>
        </div>

        <div className="control-group">
          <label htmlFor="nostril-slider">Nostril Width:</label>
          <input
            id="nostril-slider"
            type="range"
            min="-10"
            max="10"
            step="0.1"
            value={nostrilAmount}
            onChange={handleNostrilChange}
            disabled={!isEditMode}
          />
          <span className="value-display">{nostrilAmount.toFixed(1)}</span>
        </div>
      </div>

      <div className="control-section">
        <p className="section-title">Manual Editing</p>
        <p className="instruction-text">
          {isEditMode 
            ? 'Click on the nose area to select and drag vertices' 
            : 'Enable edit mode to manually edit vertices'}
        </p>
        <p className="selected-info">
          {selectedVertex !== null 
            ? `Selected vertex: ${selectedVertex}` 
            : 'No vertex selected'}
        </p>
      </div>

      <div className="control-actions">
        <button 
          className="reset-button" 
          onClick={resetNose}
          disabled={!isEditMode}
        >
          Reset Changes
        </button>
        <button className="save-button" disabled={!isEditMode}>
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default NoseEditorControls;