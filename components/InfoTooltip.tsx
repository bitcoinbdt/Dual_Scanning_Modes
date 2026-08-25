'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

export const InfoTooltip = ({ text }: { text: string }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="group relative inline-flex items-center ml-1">
      <Info
        className="w-3 h-3 text-slate-500 cursor-help hover:text-slate-300 transition-colors"
        /* Mobile: tap to toggle; Desktop: hover handled by CSS group */
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      />
      {/* Tooltip — visible on hover (desktop) OR when open state is true (mobile tap) */}
      <div
        className={`
          absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5
          w-52 p-2 bg-slate-800 text-slate-300 text-[10px]
          rounded shadow-xl border border-white/10
          font-sans normal-case tracking-normal text-center
          transition-opacity duration-150 z-50
          pointer-events-none
          ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
        `}
      >
        {text}
        {/* Invisible hover bridge so tooltip doesn't flicker when moving mouse to it */}
        <div className="absolute -bottom-2 left-0 right-0 h-2 bg-transparent pointer-events-auto" />
      </div>
    </div>
  );
};
