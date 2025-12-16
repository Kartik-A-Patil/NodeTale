import React from 'react';

export const DashboardBackground = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Dark Gradient Background */}
      <div className="absolute inset-0 bg-[#0a0a0c]" />
      
      {/* Radial Gradient for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(24,24,27,0),rgba(10,10,12,1))]" />

      {/* Animated Grid */}
      <div className="absolute inset-0 opacity-[0.03]" 
           style={{ 
               backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', 
               backgroundSize: '40px 40px',
               maskImage: 'radial-gradient(circle at center, black, transparent 80%)'
           }} 
      />

      {/* Floating Orbs / Nodes */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
      
      {/* SVG Network Pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="network-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1" fill="currentColor" className="text-zinc-500" />
            <circle cx="80" cy="80" r="1" fill="currentColor" className="text-zinc-500" />
            <circle cx="20" cy="80" r="1" fill="currentColor" className="text-zinc-500" />
            <circle cx="80" cy="20" r="1" fill="currentColor" className="text-zinc-500" />
            {/* Connecting lines */}
            <path d="M20 20 L80 80 M20 80 L80 20" stroke="currentColor" strokeWidth="0.5" className="text-zinc-700" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#network-pattern)" />
      </svg>
    </div>
  );
};
