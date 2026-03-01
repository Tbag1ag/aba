import React, { useState } from 'react';
import { Play, Terminal, AlertCircle, CheckCircle2, Table as TableIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SqlEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('SELECT * FROM quotes LIMIT 10;');
  const [result, setResult] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const executeSql = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(Array.isArray(data.result) ? data.result : [data.result]);
      } else {
        setError(data.error || '执行失败');
      }
    } catch (err: any) {
      setError(err.message || '网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-white w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#e6e2d3]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#e6e2d3] flex items-center justify-between bg-[#f9f8f4]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#5A5A40] rounded-lg flex items-center justify-center text-white">
                <Terminal size={18} />
              </div>
              <div>
                <h2 className="text-lg font-serif font-bold">SQL 控制台</h2>
                <p className="text-[10px] text-[#5A5A40]/60 uppercase tracking-widest font-bold">Neon Database Explorer</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-black/5 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Editor Area */}
            <div className="flex-1 flex flex-col border-r border-[#e6e2d3]">
              <div className="p-4 bg-[#1e1e1e] flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">Query Editor</span>
                  <button 
                    onClick={executeSql}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-[#5A5A40] hover:bg-[#4A4A30] disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all shadow-lg active:scale-95"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Play size={14} fill="currentColor" />
                    )}
                    执行查询
                  </button>
                </div>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-[#d4d4d4] font-mono text-sm resize-none outline-none leading-relaxed"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 flex flex-col bg-[#fdfcf9] overflow-hidden">
              <div className="px-4 py-2 border-b border-[#e6e2d3] bg-[#f9f8f4] flex items-center justify-between">
                <span className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider">Results</span>
                {result && (
                  <span className="text-[10px] text-[#5A5A40]/60 font-bold">{result.length} rows returned</span>
                )}
              </div>
              
              <div className="flex-1 overflow-auto p-4">
                {isLoading && (
                  <div className="h-full flex flex-col items-center justify-center text-[#5A5A40]/40">
                    <div className="w-8 h-8 border-3 border-[#5A5A40]/10 border-t-[#5A5A40] rounded-full animate-spin mb-4" />
                    <p className="text-sm font-medium">正在执行 SQL...</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3 text-red-700">
                    <AlertCircle className="shrink-0" size={20} />
                    <div>
                      <h4 className="font-bold text-sm mb-1">执行出错</h4>
                      <p className="text-xs font-mono break-all">{error}</p>
                    </div>
                  </div>
                )}

                {result && result.length > 0 && (
                  <div className="overflow-x-auto border border-[#e6e2d3] rounded-xl shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#f9f8f4] border-b border-[#e6e2d3]">
                          {Object.keys(result[0]).map((key) => (
                            <th key={key} className="px-4 py-3 font-bold text-[#5A5A40] uppercase tracking-wider border-r border-[#e6e2d3] last:border-r-0">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.map((row, i) => (
                          <tr key={i} className="border-b border-[#e6e2d3] last:border-b-0 hover:bg-black/[0.02] transition-colors">
                            {Object.values(row).map((val: any, j) => (
                              <td key={j} className="px-4 py-3 font-mono text-[#1a1a1a] border-r border-[#e6e2d3] last:border-r-0 max-w-[200px] truncate">
                                {val === null ? <span className="text-gray-400 italic">null</span> : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {result && result.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-[#5A5A40]/40">
                    <CheckCircle2 size={40} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">执行成功，但没有返回数据</p>
                  </div>
                )}

                {!result && !error && !isLoading && (
                  <div className="h-full flex flex-col items-center justify-center text-[#5A5A40]/20">
                    <TableIcon size={48} className="mb-4" />
                    <p className="text-sm font-medium">等待执行查询</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-3 border-t border-[#e6e2d3] bg-[#f9f8f4] flex items-center justify-between">
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-[#5A5A40]/60">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                NEON CONNECTED
              </div>
            </div>
            <p className="text-[10px] text-[#5A5A40]/40 font-medium">
              Tip: Use standard PostgreSQL syntax
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
