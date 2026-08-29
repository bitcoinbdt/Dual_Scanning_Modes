'use client';

import { useState, useMemo } from 'react';
import { 
  FileCode2, 
  Copy, 
  Check, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Code2, 
  FileText, 
  Layers,
  Download
} from 'lucide-react';
import type { ContractSourceData } from '@/lib/blockchain/contractSourceService';

interface SourceCodeViewerProps {
  contractSource?: ContractSourceData | null;
  tokenAddress?: string;
  network?: string;
  maxHeight?: string;
}

export function SourceCodeViewer({
  contractSource,
  tokenAddress,
  network = 'evm',
  maxHeight = 'max-h-[500px]'
}: SourceCodeViewerProps) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const files = contractSource?.sourceFiles || [];
  const currentFile = files[selectedFileIndex] || files[0] || null;

  // Split code into lines for line numbering
  const lines = useMemo(() => {
    if (!currentFile?.content) return [];
    return currentFile.content.split('\n');
  }, [currentFile]);

  // Search match count
  const matchingLineIndices = useMemo(() => {
    if (!searchQuery.trim() || !lines.length) return new Set<number>();
    const q = searchQuery.toLowerCase();
    const matches = new Set<number>();
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(q)) {
        matches.add(idx);
      }
    });
    return matches;
  }, [lines, searchQuery]);

  const handleCopy = () => {
    if (!currentFile?.content) return;
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!currentFile?.content) return;
    const blob = new Blob([currentFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.fileName.split('/').pop() || 'Contract.sol';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // State when no source code is available
  if (!contractSource || files.length === 0) {
    const isSolana = network.toLowerCase() === 'solana';
    return (
      <div className="glass-card rounded-xl p-6 border border-white/10 text-center">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 text-muted-themed">
          <Code2 className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-themed mb-1">
          {isSolana ? 'Solana Program Code' : 'Contract Source Code Unverified'}
        </h4>
        <p className="text-xs text-muted-themed max-w-md mx-auto leading-relaxed">
          {isSolana
            ? 'Solana tokens run on compiled BPF bytecode (Rust/Anchor). On-chain Solidity decompilation is not supported for Solana programs.'
            : 'The smart contract source code for this token has not been verified on the block explorer.'}
        </p>
        {tokenAddress && (
          <p className="text-[11px] font-mono text-muted-themed/60 mt-3 truncate">
            Target: {tokenAddress}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
      {/* Header Summary */}
      <div className="p-4 border-b border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
            <FileCode2 className="w-5 h-5 text-purple-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-white truncate">
                {contractSource.contractName}
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            </div>
            <p className="text-[11px] text-muted-themed flex items-center gap-2 mt-0.5 truncate">
              <span>Solidity {contractSource.compilerVersion}</span>
              <span>•</span>
              <span>
                {contractSource.optimizationUsed
                  ? `Optimization (${contractSource.runs} runs)`
                  : 'No Optimization'}
              </span>
              <span>•</span>
              <span>{files.length} file{files.length > 1 ? 's' : ''}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* In-File Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-themed absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code..."
              className="bg-black/30 border border-white/10 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 w-32 sm:w-44 transition"
            />
            {searchQuery && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-purple-400">
                {matchingLineIndices.size}
              </span>
            )}
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
            title="Copy current file code"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span className="text-green-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition"
            title="Download source file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Multi-File Tab Selector */}
      {files.length > 1 && (
        <div className="flex items-center gap-1 p-2 bg-black/40 border-b border-white/5 overflow-x-auto scrollbar-thin">
          <Layers className="w-3.5 h-3.5 text-muted-themed ml-2 shrink-0" />
          {files.map((file, idx) => {
            const fileName = file.fileName.split('/').pop() || file.fileName;
            const isSelected = idx === selectedFileIndex;
            return (
              <button
                key={file.fileName}
                onClick={() => {
                  setSelectedFileIndex(idx);
                  setSearchQuery('');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition shrink-0 ${
                  isSelected
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
                title={file.fileName}
              >
                <FileText className="w-3 h-3" />
                <span className="truncate max-w-[160px]">{fileName}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Source Code Display with Line Numbers */}
      <div className={`overflow-auto font-mono text-xs ${maxHeight} bg-slate-950/80`}>
        <div className="flex min-w-full">
          {/* Line Numbers Gutter */}
          <div className="select-none py-3 px-3 text-right text-slate-600 bg-black/30 border-r border-white/5 shrink-0 font-mono text-[11px] leading-5">
            {lines.map((_, i) => {
              const isMatch = matchingLineIndices.has(i);
              return (
                <div
                  key={i}
                  className={`${isMatch ? 'text-purple-400 font-bold bg-purple-500/20 px-1 rounded' : ''}`}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>

          {/* Code Lines */}
          <div className="py-3 px-4 flex-1 text-slate-300 font-mono text-[11px] leading-5 whitespace-pre overflow-x-auto">
            {lines.map((line, i) => {
              const isMatch = matchingLineIndices.has(i);
              return (
                <div
                  key={i}
                  className={`${isMatch ? 'bg-purple-500/15 -mx-4 px-4 text-purple-200' : ''}`}
                >
                  {line || ' '}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Details */}
      <div className="p-2.5 px-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between text-[10px] text-muted-themed font-mono">
        <span className="truncate">{currentFile?.fileName}</span>
        <span>{lines.length} lines • {(currentFile?.content.length || 0).toLocaleString()} bytes</span>
      </div>
    </div>
  );
}