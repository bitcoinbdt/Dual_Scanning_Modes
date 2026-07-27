'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, Info, ChevronUp, ChevronDown } from 'lucide-react';
import type { OnChainData } from '@/types/scanner';
import { InfoTooltip } from './InfoTooltip';

export const TokenAuditCard = ({ token }: { token: OnChainData }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // A simple heuristic for issues count
  const issuesCount = (token.mintFunction === 'Enabled' ? 1 : 0) + (token.freezable === 'Yes' ? 1 : 0);
  const unknownCount = (token.mintFunction === 'N/A' ? 1 : 0) + (token.freezable === 'N/A' ? 1 : 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card rounded-2xl border border-white/10 overflow-hidden"
    >
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          Audit
        </h4>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${issuesCount > 0 ? 'text-red-400' : unknownCount > 0 ? 'text-yellow-500' : 'text-green-400'}`}>
              {issuesCount > 0 ? `${issuesCount} issue${issuesCount !== 1 ? 's' : ''}` : unknownCount > 0 ? 'Unverified Data' : '0 issues'}
            </span>
            {issuesCount > 0 ? <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> : unknownCount > 0 ? <Info className="w-3.5 h-3.5 text-yellow-500" /> : null}
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 bg-slate-900/30 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <InfoTooltip text="Mintable contracts allow the creator to generate more tokens, potentially dumping on buyers and crashing the price." />
                  <span className="text-xs text-slate-300">Mintable</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {token.mintFunction === 'Enabled' ? (
                    <>
                      <ShieldAlert className="w-3 h-3 text-red-400" />
                      <span className="text-xs font-bold text-red-400">Yes</span>
                    </>
                  ) : token.mintFunction === 'Disabled' ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span className="text-xs font-bold text-green-500">No</span>
                    </>
                  ) : (
                    <>
                      <Info className="w-3 h-3 text-slate-500" />
                      <span className="text-xs font-bold text-slate-500">N/A</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <InfoTooltip text="Freezable contracts allow the creator to halt trading or blacklist wallets, leaving buyers unable to sell." />
                  <span className="text-xs text-slate-300">Freezable</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {token.freezable === 'Yes' ? (
                    <>
                      <ShieldAlert className="w-3 h-3 text-red-400" />
                      <span className="text-xs font-bold text-red-400">Yes</span>
                    </>
                  ) : token.freezable === 'No' ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span className="text-xs font-bold text-green-500">No</span>
                    </>
                  ) : (
                    <>
                      <Info className="w-3 h-3 text-slate-500" />
                      <span className="text-xs font-bold text-slate-500">N/A</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
