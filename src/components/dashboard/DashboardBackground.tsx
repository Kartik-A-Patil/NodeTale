import React from 'react';

export const DashboardBackground = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0f1116] via-[#0c0c10] to-[#08080b]" />
      <div 
        className="absolute inset-0" 
        style={{
          backgroundImage: 'radial-gradient(70% 70% at 15% 20%, rgba(247,147,26,0.14), transparent), radial-gradient(90% 80% at 80% 10%, rgba(83,117,255,0.08), transparent)',
          opacity: 0.9
        }}
      />
      <div 
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(circle at center, black 40%, transparent 85%)'
        }}
      />
    </div>
  );
};
