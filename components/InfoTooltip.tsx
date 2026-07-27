'use client';

import { Info } from 'lucide-react';

export const InfoTooltip = ({ text }: { text: string }) => (
  <div className="group relative inline-flex items-center ml-1">
    <Info className="w-3 h-3 text-slate-500 cursor-help hover:text-slate-300" />
    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block w-48 p-2 bg-slate-800 text-slate-300 text-[10px] rounded shadow-xl z-50 border border-white/10 font-sans normal-case tracking-normal text-center">
      {text}
      {/* Invisible hover bridge to prevent tooltip from closing when moving mouse to it */}
      <div className="absolute -bottom-2 left-0 right-0 h-2 bg-transparent" />
    </div>
  </div>
);
