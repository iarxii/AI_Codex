import React, { useEffect, useState } from 'react';
import { LockKeyhole, RotateCw } from 'lucide-react';

const ScreenOrientationToggle: React.FC = () => {
  const [isLocked, setIsLocked] = useState(false);
  const orientation = typeof window === 'undefined' ? undefined : window.screen.orientation;
  const isSupported = typeof orientation?.lock === 'function' && typeof orientation?.unlock === 'function';

  useEffect(() => {
    return () => {
      if (isLocked) orientation?.unlock();
    };
  }, [isLocked, orientation]);

  if (!isSupported) return null;

  const toggleOrientationLock = async () => {
    if (isLocked) {
      orientation.unlock();
      setIsLocked(false);
      return;
    }

    try {
      await orientation.lock(orientation.type);
      setIsLocked(true);
    } catch (error) {
      console.warn('Unable to lock screen orientation.', error);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleOrientationLock}
      className="p-2 rounded-lg text-white/90 hover:bg-white/15 hover:text-white transition-colors touch-44"
      title={isLocked ? 'Unlock screen rotation' : 'Lock screen rotation'}
      aria-label={isLocked ? 'Unlock screen rotation' : 'Lock screen rotation'}
      aria-pressed={isLocked}
    >
      {isLocked ? <LockKeyhole className="w-4 h-4" /> : <RotateCw className="w-4 h-4" />}
    </button>
  );
};

export default ScreenOrientationToggle;