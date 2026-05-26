'use client';

import React from 'react';

interface KioskContainerProps {
  children: React.ReactNode;
}

export default function KioskContainer({ children }: KioskContainerProps) {
  return (
    <div className="min-h-screen w-full bg-[#030303] text-white flex items-center justify-center p-0 md:p-6 overflow-hidden relative">
      {/* Dynamic cyber background grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--primary-glow),transparent_60%)] pointer-events-none opacity-40" />
      <div 
        className="absolute inset-0 pointer-events-none opacity-10" 
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }}
      />
      
      {/* 9:16 Kiosk Frame */}
      <div className="w-full h-screen md:h-[92vh] md:max-w-[440px] md:aspect-[9/16] md:rounded-none bg-[#09090b] relative flex flex-col overflow-hidden border border-zinc-800/80 md:shadow-[0_0_50px_rgba(236,72,153,0.15),0_0_100px_rgba(99,102,241,0.1)] transition-all duration-300">


        {/* Main Content Area */}
        <div className="flex-1 w-full relative flex flex-col overflow-y-auto bg-gradient-to-b from-zinc-950 via-zinc-900/90 to-zinc-950">
          {children}
        </div>
      </div>
    </div>
  );
}
