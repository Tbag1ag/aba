import React, { useState, useEffect } from "react";
import { 
  Pin,
  PinOff,
  Plus, 
  Trash2, 
  MessageSquare, 
  Quote as QuoteIcon, 
  ChevronDown, 
  ChevronUp,
  Edit3,
  X,
  Save,
  Loader2,
  BookOpen,
  Hash,
  Library,
  FolderOpen,
  Menu,
  Search,
  Settings2,
  Globe,
  Database,
  CheckCircle2,
  Download,
  Upload,
  Sprout,
  Leaf,
  Wind,
  Archive,
  RefreshCw,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { storage, type Quote, type Category } from "./services/storage";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("全部");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newQuote, setNewQuote] = useState({ title: "", content: "", author: "", comment: "", category: "未分类", is_pinned: false });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: "", content: "", author: "", comment: "", category: "", is_pinned: false });
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const selectedQuote = quotes.find(q => q.id === selectedQuoteId);

  useEffect(() => {
    fetchData();
  }, [selectedCategory, searchQuery]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [q, c] = await Promise.all([
        storage.getQuotes(selectedCategory, searchQuery),
        storage.getCategories()
      ]);
      setQuotes(q);
      setCategories(c);
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGardenMaintenance = async () => {
    setIsLoading(true);
    try {
      await storage.decayKnowledge();
      await fetchData();
      alert("园林维护完成：过时的知识已自然凋零，常用的知识保持茂盛。");
    } catch (err) {
      alert("维护失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await storage.exportData();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `knowledge-garden-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("导出失败");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        await storage.importData(json);
        alert("导入成功！");
        fetchData();
      } catch (err) {
        alert("导入失败，请检查文件格式");
      }
    };
    reader.readAsText(file);
  };

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuote.content.trim()) return;
    try {
      const added = await storage.addQuote(newQuote);
      setNewQuote({ title: "", content: "", author: "", comment: "", category: "未分类", is_pinned: false });
      setIsAdding(false);
      fetchData();
      setSelectedQuoteId(added.id);
    } catch (err) {
      alert("保存失败，请检查数据库连接");
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      await storage.addCategory(name);
      setNewCategoryName("");
      fetchData();
    } catch (err) {
      alert("创建分类失败");
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (name === "未分类") return;
    if (!window.confirm(`确定要删除分类 "${name}" 吗？`)) return;
    try {
      await storage.deleteCategory(id);
      if (selectedCategory === name) setSelectedCategory("全部");
      fetchData();
    } catch (err) {
      alert("删除失败");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("确定要删除这条笔记吗？")) return;
    try {
      await storage.deleteQuote(id);
      if (selectedQuoteId === id) setSelectedQuoteId(null);
      fetchData();
    } catch (err) {
      alert("删除失败");
    }
  };

  const handleTogglePin = async (quote: Quote) => {
    try {
      await storage.updateQuote(quote.id, { is_pinned: !quote.is_pinned });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBoost = async (id: number) => {
    try {
      await storage.boostKnowledge(id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const getKnowledgeState = (confidence: number) => {
    if (confidence <= 0) return { icon: <Archive size={14} />, label: "土壤", color: "text-stone-600", bg: "bg-stone-100", cardBg: "bg-[#f5f5f4] border-stone-200" };
    if (confidence < 0.3) return { icon: <Wind size={14} />, label: "枯叶", color: "text-orange-800", bg: "bg-orange-100", cardBg: "bg-[#fff7ed] border-orange-200" };
    if (confidence < 0.7) return { icon: <Wind size={14} />, label: "黄叶", color: "text-amber-700", bg: "bg-amber-100", cardBg: "bg-[#fffbeb] border-amber-200" };
    if (confidence < 0.8) return { icon: <Sprout size={14} />, label: "萌芽", color: "text-lime-700", bg: "bg-lime-100", cardBg: "bg-[#f7fee7] border-lime-200" };
    return { icon: <Leaf size={14} />, label: "绿叶", color: "text-emerald-700", bg: "bg-emerald-100", cardBg: "bg-[#f0fdf4] border-emerald-200" };
  };

  const handleUpdate = async (id: number) => {
    try {
      await storage.updateQuote(id, editForm);
      setEditingId(null);
      fetchData();
    } catch (err) {
      alert("更新失败");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      day: date.getDate(),
      month: date.toLocaleDateString('zh-CN', { month: 'short' }),
      year: date.getFullYear()
    };
  };

  return (
    <div className="min-h-screen bg-[#fdfcf9] text-[#2c2c2c] font-sans selection:bg-[#e6e2d3] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#fdfcf9]/80 backdrop-blur-md border-b border-[#e6e2d3] px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-[#f9f8f4] rounded-lg text-[#5A5A40] transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white shadow-lg">
                <BookOpen size={20} />
              </div>
              <h1 className="text-2xl font-serif font-bold tracking-tight">读书笔记</h1>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <div className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                storage.isUsingNeon() ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              )}>
                {storage.isUsingNeon() ? "Neon 数据库" : "本地存储 (离线)"}
              </div>
              <div className="flex items-center gap-1 border-l border-[#e6e2d3] ml-2 pl-2">
                <button 
                  onClick={handleExport}
                  className="p-1.5 hover:bg-[#f9f8f4] rounded-lg text-[#8e8e7e] transition-colors"
                  title="导出知识库"
                >
                  <Download size={16} />
                </button>
                <label className="p-1.5 hover:bg-[#f9f8f4] rounded-lg text-[#8e8e7e] transition-colors cursor-pointer" title="导入知识库">
                  <Upload size={16} />
                  <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                </label>
                <button 
                  onClick={handleGardenMaintenance}
                  className={cn("p-1.5 hover:bg-[#f9f8f4] rounded-lg text-[#8e8e7e] transition-colors", isLoading && "animate-spin")}
                  title="园林维护 (定期索引)"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e7e]" size={18} />
              <input 
                type="text"
                placeholder="搜索标题、内容、作者..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#f9f8f4] border-none rounded-full pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
              />
            </div>
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-2 bg-[#5A5A40] hover:bg-[#4a4a34] text-white px-4 py-2 rounded-full transition-all active:scale-95 shadow-md whitespace-nowrap"
            >
              {isAdding ? <X size={18} /> : <Plus size={18} />}
              <span className="hidden sm:inline">{isAdding ? "取消" : "记录新笔记"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.nav
              initial={{ x: -260, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -260, opacity: 0 }}
              className="bg-[#fdfcf9] border-r border-[#e6e2d3] overflow-y-auto w-[260px] shrink-0"
            >
              <div className="p-6 space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8e8e7e]">笔记分类</h3>
                    <button 
                      onClick={() => setIsManagingCategories(!isManagingCategories)}
                      className="text-[10px] font-bold text-[#5A5A40] hover:underline"
                    >
                      {isManagingCategories ? "完成" : "管理"}
                    </button>
                  </div>

                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedCategory("全部")}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                        selectedCategory === "全部" ? "bg-[#5A5A40] text-white shadow-md" : "text-[#4a4a4a] hover:bg-[#f9f8f4]"
                      )}
                    >
                      <Library size={18} />
                      全部笔记
                    </button>
                    {categories.map(cat => (
                      <div key={cat.id} className="group flex items-center gap-1">
                        <button
                          onClick={() => setSelectedCategory(cat.name)}
                          className={cn(
                            "flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all truncate",
                            selectedCategory === cat.name ? "bg-[#5A5A40] text-white shadow-md" : "text-[#4a4a4a] hover:bg-[#f9f8f4]"
                          )}
                        >
                          <Hash size={16} className="opacity-60 shrink-0" />
                          <span className="truncate">{cat.name}</span>
                        </button>
                        {isManagingCategories && cat.name !== "未分类" && (
                          <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="p-2 text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isManagingCategories && (
                    <form onSubmit={handleAddCategory} className="mt-4 flex gap-2">
                      <input 
                        type="text"
                        placeholder="新分类..."
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="flex-1 bg-[#f9f8f4] border-none rounded-lg px-3 py-2 text-xs"
                      />
                      <button type="submit" className="p-2 bg-[#5A5A40] text-white rounded-lg"><Plus size={16} /></button>
                    </form>
                  )}
                </div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-6 py-12 scroll-smooth bg-[#fdfcf9]">
          <div className="max-w-3xl mx-auto">
            <AnimatePresence>
              {isAdding && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mb-12 bg-white rounded-3xl p-8 shadow-sm border border-[#e6e2d3]"
                >
                  <form onSubmit={handleAddQuote} className="space-y-6">
                    <input
                      type="text"
                      value={newQuote.title}
                      onChange={e => setNewQuote({ ...newQuote, title: e.target.value })}
                      placeholder="笔记标题"
                      className="w-full bg-[#f9f8f4] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#5A5A40]/20 font-medium"
                    />
                    <textarea
                      required
                      value={newQuote.content}
                      onChange={e => setNewQuote({ ...newQuote, content: e.target.value })}
                      placeholder="记录触动你的文字..."
                      className="w-full bg-[#f9f8f4] border-none rounded-2xl p-4 focus:ring-2 focus:ring-[#5A5A40]/20 min-h-[120px] font-serif text-xl italic"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input
                        type="text"
                        value={newQuote.author}
                        onChange={e => setNewQuote({ ...newQuote, author: e.target.value })}
                        placeholder="作者/出处"
                        className="w-full bg-[#f9f8f4] border-none rounded-xl p-3 text-sm"
                      />
                      <select
                        value={newQuote.category}
                        onChange={e => setNewQuote({ ...newQuote, category: e.target.value })}
                        className="w-full bg-[#f9f8f4] border-none rounded-xl p-3 text-sm"
                      >
                        {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                      </select>
                      <input
                        type="text"
                        value={newQuote.comment}
                        onChange={e => setNewQuote({ ...newQuote, comment: e.target.value })}
                        placeholder="我的感悟"
                        className="w-full bg-[#f9f8f4] border-none rounded-xl p-3 text-sm"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="bg-[#5A5A40] text-white px-8 py-3 rounded-full font-medium shadow-lg">保存笔记</button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-8">
              {isLoading ? (
                <div className="text-center py-20 opacity-40"><Loader2 className="mx-auto animate-spin" /></div>
              ) : quotes.length === 0 ? (
                <div className="text-center py-20 opacity-40"><BookOpen size={48} className="mx-auto mb-4" /><p>暂无笔记</p></div>
              ) : (
                quotes.map((quote) => {
                  const date = formatDate(quote.created_at);
                  const state = getKnowledgeState(quote.confidence);
                  return (
                    <motion.article 
                      layout 
                      key={quote.id} 
                      className={cn(
                        "group rounded-[2rem] p-8 shadow-sm border transition-all duration-500",
                        state.cardBg,
                        selectedQuoteId === quote.id ? "ring-2 ring-[#5A5A40]/30 shadow-md" : "hover:shadow-md"
                      )}
                      onClick={() => setSelectedQuoteId(quote.id)}
                    >
                      {editingId === quote.id ? (
                        <div className="space-y-4" onClick={e => e.stopPropagation()}>
                          <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="w-full bg-white/50 rounded-lg p-2 border border-black/5" />
                          <textarea value={editForm.content} onChange={e => setEditForm({ ...editForm, content: e.target.value })} className="w-full bg-white/50 rounded-xl p-4 font-serif italic border border-black/5" />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm">取消</button>
                            <button onClick={() => handleUpdate(quote.id)} className="bg-[#5A5A40] text-white px-6 py-2 rounded-full text-sm font-medium">保存</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-2 items-center">
                              <span className="text-[10px] font-bold uppercase bg-black/5 px-2 py-0.5 rounded text-[#5A5A40]">{quote.category}</span>
                              <div className={cn("flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow-sm", state.bg, state.color)}>
                                {state.icon}
                                {state.label} {(quote.confidence * 100).toFixed(0)}%
                              </div>
                              {quote.is_pinned && <span className="text-[10px] font-bold uppercase bg-amber-50 text-amber-600 px-2 py-0.5 rounded flex items-center gap-1 shadow-sm"><Pin size={10} /> 置顶</span>}
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleBoost(quote.id); }} 
                                className="p-2 bg-white/80 hover:bg-white rounded-full text-emerald-600 shadow-sm transition-all hover:scale-110 active:scale-90"
                                title="索引/滋养知识"
                              >
                                <RefreshCw size={16} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleTogglePin(quote); }} className={cn("p-2 bg-white/80 hover:bg-white rounded-full shadow-sm transition-all", quote.is_pinned ? "text-amber-500" : "text-gray-400")}><Pin size={16} /></button>
                              <button onClick={(e) => { e.stopPropagation(); setEditingId(quote.id); setEditForm(quote); }} className="p-2 bg-white/80 hover:bg-white rounded-full shadow-sm text-gray-400"><Edit3 size={16} /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(quote.id); }} className="p-2 bg-white/80 hover:bg-white rounded-full shadow-sm text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                            </div>
                          </div>
                          <h3 className="text-lg font-serif font-bold mb-2 text-gray-900">{quote.title}</h3>
                          <p className="font-serif text-base italic mb-4 text-gray-700 leading-relaxed">{quote.content}</p>
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <cite className="not-italic font-medium border-l-2 border-[#5A5A40] pl-3 text-[#5A5A40]">— {quote.author}</cite>
                            <div className="flex items-center gap-4">
                              <span title="最后索引时间" className="flex items-center gap-1">
                                <RefreshCw size={10} className="opacity-50" />
                                {new Date(quote.last_accessed_at).toLocaleDateString()}
                              </span>
                              <span>{date.month} {date.day}, {date.year}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.article>
                  );
                })
              )}
            </div>
          </div>
        </main>

        {/* Sidebar for Details */}
        <AnimatePresence>
          {selectedQuoteId && selectedQuote && (
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-white shadow-2xl z-50 flex flex-col border-l border-[#e6e2d3]"
            >
              <div className="p-6 border-b flex justify-between items-center">
                <h2 className="font-bold text-sm uppercase tracking-widest">参阅感悟</h2>
                <button onClick={() => setSelectedQuoteId(null)}><X size={20} /></button>
              </div>
              <div className="p-8 space-y-6 overflow-y-auto">
                <div className="bg-[#f9f8f4] p-6 rounded-2xl border border-[#e6e2d3] italic font-serif text-lg">"{selectedQuote.content}"</div>
                <div><h4 className="text-[10px] font-bold uppercase text-[#8e8e7e] mb-2">我的感悟</h4><p className="text-[#4a4a4a] leading-relaxed">{selectedQuote.comment || "暂无感悟..."}</p></div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Settings Modal Removed */}
    </div>
  );
}
