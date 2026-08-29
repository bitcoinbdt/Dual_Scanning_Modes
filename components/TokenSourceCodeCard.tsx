'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code2, ChevronUp, ChevronDown, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { OnChainData } from '@/types/scanner';
import { SourceCodeViewer } from './source/SourceCodeViewer';
import { InfoTooltip } from './InfoTooltip';

export const TokenSourceCodeCard = ({ token }: { token: OnChainData }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isVerified = Boolean(token.contractSource && token.contractSource.sourceFiles?.length > 0);
  const isSolana = token.network?.toLowerCase() === 'solana';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="glass-card rounded-2xl border border-white/10 overflow-hidden"
    >
      {/* Clickable Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-purple-400" />
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            Smart Contract Source Code
          </h4>
          <InfoTooltip text="Verified smart contract source code extracted directly from block explorers." />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {isVerified ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">
                  {token.contractSource?.contractName || 'Verified Contract'}
                </span>
              </>
            ) : isSolana ? (
              <span className="text-xs font-semibold text-slate-400">Solana Program</span>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400">Unverified Source</span>
              </>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expandable Body */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 bg-slate-900/40 p-4"
          >
            <SourceCodeViewer
              contractSource={token.contractSource}
              tokenAddress={token.address}
              network={token.network}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};