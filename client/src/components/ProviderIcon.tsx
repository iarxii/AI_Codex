import React from 'react';
import * as Icons from '@lobehub/icons';
import { ProviderInfo } from './providerMeta';

interface ProviderIconProps {
  provider: ProviderInfo;
  size?: number;
  className?: string;
}

const ProviderIcon: React.FC<ProviderIconProps> = ({ provider, size = 24, className = '' }) => {
  if (provider.brand) {
    const Component = (Icons as any)[provider.brand];
    if (Component) {
      return (
        <div className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
          <Component size={size} />
        </div>
      );
    }
  }

  // Fallback to existing icon path if brand not found or not provided
  if (provider.iconType === 'svg-file' && provider.icon) {
    return (
      <img 
        src={provider.icon} 
        alt={provider.label} 
        style={{ width: size, height: size }}
        className={`object-contain ${className}`}
      />
    );
  }

  return null;
};

export default ProviderIcon;
