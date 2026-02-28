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
  Settings2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Quote {
  id: number;
  title: string;
  content: string;
  author: string;
  comment: string;
  category: string;
  is_pinned: boolean;
  created_at: string;
}

interface Category {
  id: number;
  name: string;
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

  const selectedQuote = quotes.find(q => q.id === selectedQuoteId);

  useEffect(() => {
    fetchQuotes();
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchQuotes = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== "全部") params.append("category", selectedCategory);
      if (searchQuery) params.append("search", searchQuery);
      
      const res = await fetch(`/api/quotes?${params.toString()}`);
      const data = await res.json();
      setQuotes(data);
    } catch (err) {
      console.error("Failed to fetch quotes", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error("Failed to fetch categories", err);
    }
  };

  const handleAddQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuote.content.trim()) {
      alert("内容不能为空");
      return;
    }

    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newQuote),
      });
      if (res.ok) {
        const added = await res.json();
        setNewQuote({ title: "", content: "", author: "", comment: "", category: "未分类", is_pinned: false });
        setIsAdding(false);
        fetchQuotes();
        setSelectedQuoteId(added.id);
      } else {
        const errorData = await res.json();
        alert(`保存失败: ${errorData.error || "未知错误"}`);
      }
    } catch (err) {
      console.error("Failed to add quote", err);
      alert("网络错误，保存失败");
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName }),
      });
      if (res.ok) {
        setNewCategoryName("");
        fetchCategories();
      }
    } catch (err) {
      console.error("Failed to add category", err);
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (name === "未分类") {
      alert("默认分类不能删除");
      return;
    }
    if (!window.confirm(`确定要删除分类 "${name}" 吗？该分类下的笔记将变为 "未分类"。`)) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedCategory === name) {
          setSelectedCategory("全部");
        } else {
          fetchQuotes();
        }
        fetchCategories();
      } else {
        const data = await res.json();
        alert(`删除失败: ${data.error || "未知错误"}`);
      }
    } catch (err) {
      console.error("Failed to delete category", err);
      alert("网络错误，请稍后再试");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("确定要删除这条笔记吗？")) return;
    try {
      const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedQuoteId === id) setSelectedQuoteId(null);
        fetchQuotes();
      } else {
        const data = await res.json();
        alert(`删除失败: ${data.error || "未知错误"}`);
      }
    } catch (err) {
      console.error("Failed to delete quote", err);
      alert("网络错误，请稍后再试");
    }
  };

  const handleTogglePin = async (quote: Quote) => {
    try {
      const updatedQuote = { ...quote, is_pinned: !quote.is_pinned };
      const res = await fetch(`/api/quotes/${quote.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedQuote),
      });
      if (res.ok) {
        fetchQuotes();
      }
    } catch (err) {
      console.error("Failed to toggle pin", err);
    }
  };
  const handleUpdate = async (id: number) => {
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingId(null);
        fetchQuotes();
      } else {
        const errorData = await res.json();
        alert(`更新失败: ${errorData.error || "未知错误"}`);
      }
    } catch (err) {
      console.error("Failed to update quote", err);
      alert("网络错误，更新失败");
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
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e7e]" size={18} />
              <input 
                type="text"
                placeholder="搜索标题、内容、作者或感悟..."
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

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Categories */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              {/* Mobile Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
              />
              <motion.nav
                initial={{ x: -260, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -260, opacity: 0 }}
                className="bg-[#fdfcf9] border-r border-[#e6e2d3] overflow-y-auto fixed inset-y-0 left-0 z-40 w-[260px] md:relative md:z-10"
              >
              <div className="p-6 space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8e8e7e]">笔记分类</h3>
                    <button 
                      onClick={() => setIsManagingCategories(!isManagingCategories)}
                      className={cn(
                        "p-1 rounded transition-colors",
                        isManagingCategories ? "bg-[#5A5A40] text-white" : "hover:bg-[#f9f8f4] text-[#5A5A40]"
                      )}
                      title={isManagingCategories ? "退出管理" : "管理分类"}
                    >
                      <Settings2 size={14} />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedCategory("全部")}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                        selectedCategory === "全部" 
                          ? "bg-[#5A5A40] text-white shadow-md" 
                          : "text-[#4a4a4a] hover:bg-[#f9f8f4]"
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
                            "flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all capitalize",
                            selectedCategory === cat.name 
                              ? "bg-[#5A5A40] text-white shadow-md" 
                              : "text-[#4a4a4a] hover:bg-[#f9f8f4]"
                          )}
                        >
                          <Hash size={16} className="opacity-60" />
                          {cat.name}
                        </button>
                        {isManagingCategories && cat.name !== "未分类" && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCategory(cat.id, cat.name);
                            }}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors z-10"
                            title="删除分类"
                          >
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
                        className="flex-1 bg-[#f9f8f4] border-none rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#5A5A40]"
                      />
                      <button 
                        type="submit"
                        className="p-1.5 bg-[#5A5A40] text-white rounded-lg hover:bg-[#4a4a34]"
                      >
                        <Plus size={14} />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-6 py-12 scroll-smooth">
          <div className="max-w-3xl mx-auto">
            {/* Add Form */}
            <AnimatePresence>
              {isAdding && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mb-12 bg-white rounded-3xl p-8 shadow-sm border border-[#e6e2d3]"
                >
                  <form onSubmit={handleAddQuote} className="space-y-6">
                    <div>
                      <label className="block text-xs uppercase tracking-widest font-semibold text-[#8e8e7e] mb-2">笔记标题</label>
                      <input
                        type="text"
                        value={newQuote.title}
                        onChange={e => setNewQuote({ ...newQuote, title: e.target.value })}
                        placeholder="给这则笔记起个标题..."
                        className="w-full bg-[#f9f8f4] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#5A5A40]/20 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-widest font-semibold text-[#8e8e7e] mb-2">笔记内容</label>
                      <textarea
                        required
                        value={newQuote.content}
                        onChange={e => setNewQuote({ ...newQuote, content: e.target.value })}
                        placeholder="记录下书中那些触动你的文字..."
                        className="w-full bg-[#f9f8f4] border-none rounded-2xl p-4 focus:ring-2 focus:ring-[#5A5A40]/20 min-h-[120px] font-serif text-xl italic"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs uppercase tracking-widest font-semibold text-[#8e8e7e] mb-2">作者/出处</label>
                        <input
                          type="text"
                          value={newQuote.author}
                          onChange={e => setNewQuote({ ...newQuote, author: e.target.value })}
                          placeholder="书名或作者"
                          className="w-full bg-[#f9f8f4] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-widest font-semibold text-[#8e8e7e] mb-2">分类</label>
                        <select
                          value={newQuote.category}
                          onChange={e => setNewQuote({ ...newQuote, category: e.target.value })}
                          className="w-full bg-[#f9f8f4] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#5A5A40]/20 appearance-none"
                        >
                          {categories.length > 0 ? (
                            categories.map(cat => (
                              <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))
                          ) : (
                            <option value="未分类">未分类</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-widest font-semibold text-[#8e8e7e] mb-2">我的感悟</label>
                        <input
                          type="text"
                          value={newQuote.comment}
                          onChange={e => setNewQuote({ ...newQuote, comment: e.target.value })}
                          placeholder="写下你的第一反应..."
                          className="w-full bg-[#f9f8f4] border-none rounded-xl p-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div 
                          onClick={() => setNewQuote({ ...newQuote, is_pinned: !newQuote.is_pinned })}
                          className={cn(
                            "w-10 h-5 rounded-full transition-colors relative",
                            newQuote.is_pinned ? "bg-[#5A5A40]" : "bg-[#e6e2d3]"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform",
                            newQuote.is_pinned ? "translate-x-5" : "translate-x-0"
                          )} />
                        </div>
                        <span className="text-xs font-semibold text-[#8e8e7e] uppercase tracking-widest">置顶此笔记</span>
                      </label>
                      <button
                        type="submit"
                        className="bg-[#5A5A40] text-white px-8 py-3 rounded-full font-medium hover:bg-[#4a4a34] transition-colors shadow-lg"
                      >
                        保存到笔记集
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quotes List */}
            <div className="space-y-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-[#8e8e7e] flex items-center gap-2">
                  <FolderOpen size={14} />
                  {selectedCategory}
                  {searchQuery && <span className="text-[#5A5A40] lowercase font-normal"> / 搜索: {searchQuery}</span>}
                </h2>
                <span className="text-xs text-[#8e8e7e]">{quotes.length} 条笔记</span>
              </div>
              
              {quotes.length === 0 ? (
                <div className="text-center py-20 opacity-40">
                  <BookOpen size={48} className="mx-auto mb-4" />
                  <p className="font-serif italic text-lg">
                    {searchQuery ? "未找到相关笔记" : "暂无笔记，开始你的阅读记录吧"}
                  </p>
                </div>
              ) : (
                quotes.map((quote) => {
                  const date = formatDate(quote.created_at);
                  return (
                    <motion.article
                      layout
                      key={quote.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "group relative cursor-pointer transition-all duration-300",
                        selectedQuoteId === quote.id ? "scale-[1.02]" : "hover:scale-[1.01]"
                      )}
                      onClick={() => setSelectedQuoteId(quote.id)}
                    >
                      <div className="flex gap-6">
                        {/* Date/Timeline */}
                        <div className="hidden md:flex flex-col items-center pt-2 w-12">
                          <div className="flex flex-col items-center bg-[#f9f8f4] rounded-2xl p-2 border border-[#e6e2d3] group-hover:border-[#5A5A40]/30 transition-colors">
                            <span className="text-[10px] font-bold text-[#8e8e7e] uppercase tracking-tighter">{date.month}</span>
                            <span className="text-xl font-serif font-bold text-[#5A5A40]">{date.day}</span>
                            <span className="text-[8px] text-[#8e8e7e]">{date.year}</span>
                          </div>
                          <div className="w-px h-full bg-[#e6e2d3] mt-4 group-last:bg-transparent" />
                        </div>

                        {/* Content Card */}
                        <div className={cn(
                          "flex-1 bg-white rounded-[2rem] p-8 shadow-sm border transition-all duration-300",
                          selectedQuoteId === quote.id 
                            ? "border-[#5A5A40] shadow-md ring-1 ring-[#5A5A40]/20" 
                            : "border-[#e6e2d3] hover:border-[#5A5A40]/30"
                        )}>
                          {editingId === quote.id ? (
                            <div className="space-y-4" onClick={e => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editForm.title}
                                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                className="w-full bg-[#f9f8f4] border-none rounded-lg p-2 text-sm font-bold"
                                placeholder="笔记标题"
                              />
                              <textarea
                                value={editForm.content}
                                onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                                className="w-full bg-[#f9f8f4] border-none rounded-xl p-4 font-serif text-lg italic"
                              />
                              <div className="grid grid-cols-2 gap-4">
                                <input
                                  type="text"
                                  value={editForm.author}
                                  onChange={e => setEditForm({ ...editForm, author: e.target.value })}
                                  className="w-full bg-[#f9f8f4] border-none rounded-lg p-2 text-sm"
                                  placeholder="作者/出处"
                                />
                                <select
                                  value={editForm.category}
                                  onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                  className="w-full bg-[#f9f8f4] border-none rounded-lg p-2 text-sm"
                                >
                                  {categories.length > 0 ? (
                                    categories.map(cat => (
                                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                                    ))
                                  ) : (
                                    <option value="未分类">未分类</option>
                                  )}
                                </select>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={editForm.is_pinned}
                                    onChange={e => setEditForm({ ...editForm, is_pinned: e.target.checked })}
                                    className="w-4 h-4 rounded border-[#e6e2d3] text-[#5A5A40] focus:ring-[#5A5A40]"
                                  />
                                  <span className="text-xs font-semibold text-[#8e8e7e] uppercase tracking-widest">置顶此笔记</span>
                                </label>
                                <div className="flex gap-2">
                                  <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm">取消</button>
                                  <button 
                                    onClick={() => handleUpdate(quote.id)}
                                    className="bg-[#5A5A40] text-white px-4 py-2 rounded-full text-sm flex items-center gap-2"
                                  >
                                    <Save size={14} /> 保存
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="relative">
                              <QuoteIcon className="absolute -top-4 -left-4 text-[#5A5A40]/10" size={40} />
                              <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] bg-[#5A5A40]/10 px-2 py-0.5 rounded">
                                    {quote.category}
                                  </span>
                                  {quote.is_pinned && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                      <Pin size={10} /> 置顶
                                    </span>
                                  )}
                                </div>
                                <span className="md:hidden text-[10px] text-[#8e8e7e] font-medium">
                                  {date.month} {date.day}, {date.year}
                                </span>
                              </div>
                              
                              <h3 className="text-lg font-serif font-bold text-[#1a1a1a] mb-2 group-hover:text-[#5A5A40] transition-colors">
                                {quote.title || "无标题笔记"}
                              </h3>
                              
                              <p className="font-serif text-base leading-relaxed text-[#4a4a4a] mb-4 line-clamp-1 italic">
                                {quote.content}
                              </p>

                              <div className="flex items-center justify-between">
                                <cite className="not-italic font-medium text-[#5A5A40] text-sm border-l-2 border-[#5A5A40] pl-3">
                                  — {quote.author || "未知"}
                                </cite>
                                <div className="flex gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10 relative">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTogglePin(quote);
                                    }}
                                    className={cn(
                                      "p-2 hover:bg-[#f9f8f4] rounded-full transition-colors",
                                      quote.is_pinned ? "text-amber-500" : "text-[#8e8e7e] hover:text-[#5A5A40]"
                                    )}
                                    title={quote.is_pinned ? "取消置顶" : "置顶"}
                                  >
                                    {quote.is_pinned ? <PinOff size={18} /> : <Pin size={18} />}
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingId(quote.id);
                                      setEditForm({ title: quote.title, content: quote.content, author: quote.author, comment: quote.comment, category: quote.category, is_pinned: quote.is_pinned });
                                    }}
                                    className="p-2 hover:bg-[#f9f8f4] rounded-full text-[#8e8e7e] hover:text-[#5A5A40] transition-colors"
                                    title="编辑"
                                  >
                                    <Edit3 size={18} />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(quote.id);
                                    }}
                                    className="p-2 hover:bg-red-50 rounded-full text-[#8e8e7e] hover:text-red-500 transition-colors"
                                    title="删除"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.article>
                  );
                })
              )}
            </div>
          </div>
        </main>

        {/* Standalone Sidebar */}
        <AnimatePresence>
          {selectedQuoteId && selectedQuote && (
            <>
              {/* Mobile Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedQuoteId(null)}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
              />
              
              <motion.aside
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 right-0 w-full md:w-[400px] lg:w-[500px] bg-white shadow-2xl z-40 flex flex-col md:relative md:z-10 md:shadow-none md:border-l md:border-[#e6e2d3]"
              >
                <div className="p-6 border-b border-[#e6e2d3] flex justify-between items-center bg-[#fdfcf9]">
                  <div className="flex items-center gap-2 text-[#5A5A40]">
                    <MessageSquare size={18} />
                    <h2 className="font-bold text-sm uppercase tracking-widest">参阅感悟</h2>
                  </div>
                  <button 
                    onClick={() => setSelectedQuoteId(null)}
                    className="p-2 hover:bg-[#f9f8f4] rounded-full text-[#8e8e7e] transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-10 scroll-smooth">
                  {/* Quote Context in Sidebar */}
                  <div className="space-y-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#8e8e7e]">正在参阅</div>
                    <h3 className="text-xl font-serif font-bold text-[#1a1a1a] mb-2">
                      {selectedQuote.title || "无标题笔记"}
                    </h3>
                    <blockquote className="font-serif text-xl italic text-[#1a1a1a] border-l-4 border-[#5A5A40] pl-6 leading-relaxed">
                      “{selectedQuote.content}”
                    </blockquote>
                    <div className="text-sm font-medium text-[#5A5A40] pl-6">— {selectedQuote.author || "佚名"}</div>
                  </div>

                  {/* User Comment */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#8e8e7e]">我的感悟</div>
                      <button 
                        onClick={() => {
                          setEditingId(selectedQuote.id);
                          setEditForm({ title: selectedQuote.title, content: selectedQuote.content, author: selectedQuote.author, comment: selectedQuote.comment, category: selectedQuote.category, is_pinned: selectedQuote.is_pinned });
                        }}
                        className="flex items-center gap-1 text-[10px] text-[#5A5A40] hover:underline font-bold"
                      >
                        <Edit3 size={10} />
                        编辑感悟
                      </button>
                    </div>
                    {editingId === selectedQuote.id ? (
                      <div className="space-y-3">
                        <textarea
                          autoFocus
                          value={editForm.comment}
                          onChange={e => setEditForm({ ...editForm, comment: e.target.value })}
                          className="w-full bg-[#f9f8f4] border-none rounded-2xl p-5 text-sm min-h-[150px] focus:ring-2 focus:ring-[#5A5A40]/10 transition-all"
                          placeholder="在这里记录你的思考、感悟或联想..."
                        />
                        <div className="flex justify-end gap-3">
                          <button onClick={() => setEditingId(null)} className="text-xs px-4 py-2 text-[#8e8e7e] hover:text-[#2c2c2c]">取消</button>
                          <button 
                            onClick={() => handleUpdate(selectedQuote.id)}
                            className="bg-[#5A5A40] text-white px-6 py-2 rounded-full text-xs font-bold shadow-md active:scale-95 transition-all"
                          >
                            保存感悟
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#fdfcf9] p-8 rounded-[2rem] border border-[#f0eee6] shadow-inner relative group/comment">
                        {selectedQuote.comment ? (
                          <p className="text-[#2c2c2c] text-base leading-relaxed italic font-serif">
                            {selectedQuote.comment}
                          </p>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-[#8e8e7e] text-sm italic opacity-60 mb-4">
                              尚未记录感悟...
                            </p>
                            <button 
                              onClick={() => {
                                setEditingId(selectedQuote.id);
                                setEditForm({ title: selectedQuote.title, content: selectedQuote.content, author: selectedQuote.author, comment: selectedQuote.comment, category: selectedQuote.category, is_pinned: selectedQuote.is_pinned });
                              }}
                              className="text-xs text-[#5A5A40] border border-[#5A5A40]/20 px-4 py-2 rounded-full hover:bg-[#5A5A40] hover:text-white transition-all"
                            >
                              立即记录
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-[#fdfcf9] border-t border-[#e6e2d3] text-[10px] text-center text-[#8e8e7e] uppercase tracking-widest font-bold">
                  智慧如泉 • 常流不息
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
