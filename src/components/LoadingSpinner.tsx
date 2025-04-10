import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  color = 'var(--primary)' 
}) => {
  const getSize = () => {
    switch (size) {
      case 'small': return '20px';
      case 'large': return '40px';
      default: return '30px';
    }
  };

  return (
    <div 
      className="loading-spinner-container"
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div 
        className="spinner"
        style={{
          width: getSize(),
          height: getSize(),
          borderRadius: '50%',
          border: `3px solid rgba(0, 0, 0, 0.1)`,
          borderTopColor: color,
          animation: 'spin 1s linear infinite'
        }}
      />
    </div>
  );
};

export default LoadingSpinner;