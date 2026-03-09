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
  Info,
  User,
  LogOut,
  Bell,
  ShoppingBag,
  Calendar,
  LayoutGrid,
  Heart,
  MessageCircle,
  GripVertical
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { storage, type Quote, type Category } from "./services/storage";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("全部");
  const [currentView, setCurrentView] = useState<"dashboard" | "calendar" | "archive">("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "confidence">("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const [heroQuoteId, setHeroQuoteId] = useState<number | null>(() => {
    const saved = localStorage.getItem('heroQuoteId');
    return saved ? parseInt(saved) : null;
  });
  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : { name: "Tbag", bio: "Student", avatar: "https://picsum.photos/seed/user/100/100" };
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newQuote, setNewQuote] = useState({ title: "", content: "", author: "", comment: "", category: "未分类", source_url: "", is_pinned: false });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: "", content: "", author: "", comment: "", category: "", source_url: "", is_pinned: false });
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isEditingSidebar, setIsEditingSidebar] = useState(false);

  const selectedQuote = quotes.find(q => q.id === selectedQuoteId);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((cat) => cat.id === active.id);
      const newIndex = categories.findIndex((cat) => cat.id === over.id);

      const newCategories = arrayMove(categories, oldIndex, newIndex);
      setCategories(newCategories);
      
      try {
        await storage.reorderCategories(newCategories.map(c => c.id));
      } catch (err) {
        console.error("Failed to save category order", err);
      }
    }
  };

  const sortedQuotes = [...quotes].sort((a, b) => {
    // 1. Pinned notes always on top
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;

    // 2. Then apply the selected sort
    if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === "confidence") return b.confidence - a.confidence;
    return 0;
  });

  const heroQuote = quotes.find(q => q.id === heroQuoteId) || sortedQuotes[0];

  const totalPages = Math.ceil(sortedQuotes.length / itemsPerPage);
  const paginatedQuotes = sortedQuotes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, sortBy, currentView]);

  useEffect(() => {
    if (selectedQuote && !isEditingSidebar) {
      setEditForm(selectedQuote);
    }
  }, [selectedQuoteId, isEditingSidebar]);

  useEffect(() => {
    const initGarden = async () => {
      setIsLoading(true);
      try {
        // Silent decay on load
        await storage.decayKnowledge();
        await fetchData();
      } catch (err) {
        console.error("Garden maintenance failed", err);
      } finally {
        setIsLoading(false);
      }
    };
    initGarden();
  }, [selectedCategory, searchQuery, sortBy]);

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
      setNewQuote({ title: "", content: "", author: "", comment: "", category: "未分类", source_url: "", is_pinned: false });
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

  const handleSetHero = (id: number) => {
    setHeroQuoteId(id);
    localStorage.setItem('heroQuoteId', id.toString());
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
    const pct = Math.round(confidence * 100);
    if (confidence <= 0) return { icon: <Archive size={14} />, label: `土壤 ${pct}%`, color: "text-stone-600", bg: "bg-stone-100", cardBg: "bg-stone-50/30", tagBg: "bg-stone-100 text-stone-600" };
    if (confidence < 0.3) return { icon: <Wind size={14} />, label: `枯叶 ${pct}%`, color: "text-orange-600", bg: "bg-orange-50", cardBg: "bg-orange-50/30", tagBg: "bg-orange-50 text-orange-600" };
    if (confidence < 0.7) return { icon: <Wind size={14} />, label: `黄叶 ${pct}%`, color: "text-amber-600", bg: "bg-amber-50", cardBg: "bg-amber-50/30", tagBg: "bg-amber-50 text-amber-600" };
    if (confidence < 0.8) return { icon: <Sprout size={14} />, label: `萌芽 ${pct}%`, color: "text-lime-600", bg: "bg-lime-50", cardBg: "bg-lime-50/30", tagBg: "bg-lime-50 text-lime-600" };
    return { icon: <Leaf size={14} />, label: `绿叶 ${pct}%`, color: "text-emerald-600", bg: "bg-emerald-50", cardBg: "bg-emerald-50/30", tagBg: "bg-emerald-50 text-emerald-600" };
  };

  const handleUpdate = async (id: number) => {
    try {
      await storage.updateQuote(id, editForm);
      setEditingId(null);
      setIsEditingSidebar(false);
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
    <div className="min-h-screen bg-app-bg text-accent font-sans flex overflow-hidden relative">
      {/* Sidebar Backdrop for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-accent/20 backdrop-blur-sm z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:relative inset-y-0 left-0 z-40 bg-white border-r border-border w-[280px] shrink-0 transition-transform duration-300 flex flex-col shadow-2xl lg:shadow-none",
        !isSidebarOpen && "-translate-x-full lg:translate-x-0 lg:w-[80px]"
      )}>
        <div className="p-6 flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white shrink-0">
            <BookOpen size={20} />
          </div>
          {isSidebarOpen && <h1 className="text-xl font-display font-bold tracking-tight">ReadNote.</h1>}
        </div>

        <div className="px-4 mb-8">
          <div 
            onClick={() => { setIsEditingProfile(true); setSelectedQuoteId(null); }}
            className="flex items-center gap-3 p-3 rounded-2xl hover:bg-app-bg transition-colors cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden bg-muted/20 shrink-0">
              <img src={userProfile.avatar} alt="User" referrerPolicy="no-referrer" />
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm truncate">{userProfile.name}</h3>
                <p className="text-muted text-xs">{userProfile.bio}</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          <SidebarItem 
            icon={<LayoutGrid size={20} />} 
            label="Dashboard" 
            active={currentView === "dashboard" && selectedCategory === "全部"} 
            onClick={() => { setCurrentView("dashboard"); setSelectedCategory("全部"); }} 
            isOpen={isSidebarOpen} 
          />
          
          <div className="pt-4 pb-2">
            <div className="flex items-center justify-between px-4 mb-2">
              {isSidebarOpen && <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Categories</p>}
              {isSidebarOpen && (
                <button 
                  onClick={() => setIsManagingCategories(!isManagingCategories)}
                  className="text-[10px] font-bold uppercase tracking-widest text-accent hover:underline"
                >
                  {isManagingCategories ? "Done" : "Manage"}
                </button>
              )}
            </div>
            
            <div className="space-y-1">
              {isManagingCategories ? (
                <div className="space-y-2">
                  <form onSubmit={handleAddCategory} className="px-3 mb-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        placeholder="New category..."
                        className="w-full bg-app-bg border-none rounded-xl pl-3 pr-10 py-2 text-xs outline-none focus:ring-1 focus:ring-accent/10"
                      />
                      <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-accent">
                        <Plus size={16} />
                      </button>
                    </div>
                  </form>
                  
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={categories.map(c => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1">
                        {categories.map(cat => (
                          <SortableCategoryItem 
                            key={cat.id} 
                            category={cat} 
                            onDelete={() => handleDeleteCategory(cat.id, cat.name)}
                            isOpen={isSidebarOpen}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              ) : (
                <div className="space-y-1">
                  {categories.map(cat => (
                    <SidebarItem 
                      key={cat.id}
                      icon={<Hash size={18} />} 
                      label={cat.name} 
                      active={currentView === "dashboard" && selectedCategory === cat.name} 
                      onClick={() => { setCurrentView("dashboard"); setSelectedCategory(cat.name); }} 
                      isOpen={isSidebarOpen}
                      isSubItem
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <SidebarItem 
            icon={<Calendar size={20} />} 
            label="Calendar" 
            active={currentView === "calendar"}
            onClick={() => setCurrentView("calendar")}
            isOpen={isSidebarOpen} 
          />
          <SidebarItem 
            icon={<Archive size={20} />} 
            label="Archive" 
            active={currentView === "archive"}
            onClick={() => setCurrentView("archive")}
            isOpen={isSidebarOpen} 
          />
        </nav>

        <div className="p-4 border-t border-border space-y-1">
          <button 
            onClick={handleExport}
            className="w-full flex items-center gap-3 p-3 rounded-2xl text-muted hover:text-accent hover:bg-app-bg transition-all"
          >
            <Download size={20} />
            {isSidebarOpen && <span className="text-sm font-bold">Export Data</span>}
          </button>
          <label className="w-full flex items-center gap-3 p-3 rounded-2xl text-muted hover:text-accent hover:bg-app-bg transition-all cursor-pointer">
            <Upload size={20} />
            {isSidebarOpen && <span className="text-sm font-bold">Import Data</span>}
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
        {/* Top Bar */}
        <header className="h-20 px-4 md:px-8 flex items-center justify-between shrink-0 bg-app-bg/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-2 md:gap-4 flex-1 max-w-xl">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white rounded-xl transition-colors lg:hidden shrink-0">
              <Menu size={20} />
            </button>
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={16} />
              <input 
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border-none rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-accent/5 transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-2">
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-accent text-white p-3 md:px-6 md:py-3 rounded-2xl font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <Plus size={18} />
              <span className="hidden md:inline">New Note</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-32 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
            {currentView === "dashboard" && (
              <>
                {/* Hero Section */}
                {!searchQuery && selectedCategory === "全部" && heroQuote && (
                  <section className="relative bg-white rounded-[32px] md:rounded-[40px] p-6 md:py-8 md:px-12 overflow-hidden card-shadow group border-2 border-accent/5">
                    <div className="relative z-10 max-w-2xl space-y-3 md:space-y-4">
                      <div className="flex gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider">Featured</span>
                      </div>
                      <div className="space-y-1 md:space-y-2">
                        <h2 className="text-3xl md:text-5xl font-display font-black leading-tight text-accent">
                          {heroQuote.title || "Untitled Note"}
                        </h2>
                        <p className="text-muted text-base md:text-lg line-clamp-2 leading-relaxed whitespace-pre-wrap">
                          {heroQuote.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 pt-1 md:pt-2">
                        <button 
                          onClick={() => setSelectedQuoteId(heroQuote.id)}
                          className="bg-accent text-white px-6 py-2.5 md:px-8 md:py-3.5 rounded-xl md:rounded-2xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl text-sm"
                        >
                          Read Note
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {/* Grid Section */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-display font-bold">{selectedCategory} Notes</h3>
                    <div className="flex items-center gap-2 text-muted text-sm font-medium">
                      <span>Sort by:</span>
                      <div className="relative group/sort">
                        <button className="text-accent flex items-center gap-1 hover:bg-white px-3 py-1 rounded-lg transition-colors">
                          {sortBy === "newest" ? "Newest" : sortBy === "oldest" ? "Oldest" : "Confidence"} 
                          <ChevronDown size={14} />
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-border py-2 min-w-[120px] opacity-0 invisible group-hover/sort:opacity-100 group-hover/sort:visible transition-all z-50">
                          <button onClick={() => setSortBy("newest")} className={cn("w-full text-left px-4 py-2 text-xs hover:bg-app-bg transition-colors", sortBy === "newest" && "text-accent font-bold")}>Newest</button>
                          <button onClick={() => setSortBy("oldest")} className={cn("w-full text-left px-4 py-2 text-xs hover:bg-app-bg transition-colors", sortBy === "oldest" && "text-accent font-bold")}>Oldest</button>
                          <button onClick={() => setSortBy("confidence")} className={cn("w-full text-left px-4 py-2 text-xs hover:bg-app-bg transition-colors", sortBy === "confidence" && "text-accent font-bold")}>Confidence</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="animate-spin text-muted" size={32} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {paginatedQuotes.map(quote => (
                        <NoteCard 
                          key={quote.id} 
                          quote={quote} 
                          state={getKnowledgeState(quote.confidence)}
                          onClick={() => setSelectedQuoteId(quote.id)}
                          onDelete={() => handleDelete(quote.id)}
                          onBoost={() => handleBoost(quote.id)}
                          onTogglePin={() => handleTogglePin(quote)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {currentView === "calendar" && (
              <section className="space-y-8">
                <h3 className="text-3xl font-display font-bold">Timeline</h3>
                <div className="space-y-12 relative before:absolute before:inset-y-0 before:left-4 before:w-0.5 before:bg-border">
                  {Object.entries(
                    sortedQuotes.reduce((acc, quote) => {
                      const date = new Date(quote.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
                      if (!acc[date]) acc[date] = [];
                      acc[date].push(quote);
                      return acc;
                    }, {} as Record<string, Quote[]>)
                  ).map(([month, monthQuotes]) => (
                    <div key={month} className="relative pl-12 space-y-6">
                      <div className="absolute left-0 top-0 w-8 h-8 bg-accent rounded-full border-4 border-app-bg flex items-center justify-center text-white">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <h4 className="text-xl font-bold text-accent">{month}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {monthQuotes.map(quote => (
                          <NoteCard 
                            key={quote.id} 
                            quote={quote} 
                            state={getKnowledgeState(quote.confidence)}
                            onClick={() => setSelectedQuoteId(quote.id)}
                            onDelete={() => handleDelete(quote.id)}
                            onBoost={() => handleBoost(quote.id)}
                            onTogglePin={() => handleTogglePin(quote)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {currentView === "archive" && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-3xl font-display font-bold">Archive</h3>
                  <p className="text-muted text-sm">Notes that have naturally decayed over time</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {sortedQuotes.filter(q => q.confidence <= 0).length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-[32px] border border-dashed border-border">
                      <Archive size={48} className="mx-auto mb-4 text-muted opacity-20" />
                      <p className="text-muted font-medium">No archived notes yet. Keep learning!</p>
                    </div>
                  ) : (
                    sortedQuotes.filter(q => q.confidence <= 0).map(quote => (
                      <NoteCard 
                        key={quote.id} 
                        quote={quote} 
                        state={getKnowledgeState(quote.confidence)}
                        onClick={() => setSelectedQuoteId(quote.id)}
                        onDelete={() => handleDelete(quote.id)}
                        onBoost={() => handleBoost(quote.id)}
                        onTogglePin={() => handleTogglePin(quote)}
                      />
                    ))
                  )}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Floating Pagination Bar */}
        {totalPages > 1 && currentView === "dashboard" && (
          <div className="fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] md:w-auto max-w-lg">
            <div className="bg-accent text-white px-2 py-2 rounded-2xl flex items-center justify-between md:justify-start gap-1 shadow-2xl border border-white/10 glass">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-2 hover:bg-white hover:text-accent rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white"
              >
                <ChevronUp className="-rotate-90" size={18} />
              </button>
              
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      "min-w-[40px] h-10 rounded-xl font-bold text-sm transition-all shrink-0",
                      currentPage === page ? "bg-white text-accent" : "hover:bg-white/10"
                    )}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-2 hover:bg-white hover:text-accent rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white"
              >
                <ChevronUp className="rotate-90" size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Add Note Modal */}
        <AnimatePresence>
          {isAdding && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setIsAdding(false)}
                className="absolute inset-0 bg-accent/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-6 md:mb-8">
                  <h2 className="text-xl md:text-2xl font-display font-bold">New Reading Note</h2>
                  <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-app-bg rounded-xl transition-colors">
                    <X size={24} />
                  </button>
                </div>
                <form onSubmit={handleAddQuote} className="space-y-4 md:space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">Title</label>
                    <input
                      type="text"
                      value={newQuote.title}
                      onChange={e => setNewQuote({ ...newQuote, title: e.target.value })}
                      placeholder="Book title or topic"
                      className="w-full bg-app-bg border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-accent/5 transition-all outline-none font-medium text-sm md:text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">Content</label>
                    <textarea
                      required
                      value={newQuote.content}
                      onChange={e => setNewQuote({ ...newQuote, content: e.target.value })}
                      placeholder="What inspired you?"
                      className="w-full bg-app-bg border-none rounded-2xl px-4 py-4 focus:ring-2 focus:ring-accent/5 transition-all outline-none min-h-[120px] md:min-h-[150px] resize-none text-sm md:text-base"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">Author</label>
                      <input
                        type="text"
                        value={newQuote.author}
                        onChange={e => setNewQuote({ ...newQuote, author: e.target.value })}
                        placeholder="Author name"
                        className="w-full bg-app-bg border-none rounded-2xl px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">Category</label>
                      <select
                        value={newQuote.category}
                        onChange={e => setNewQuote({ ...newQuote, category: e.target.value })}
                        className="w-full bg-app-bg border-none rounded-2xl px-4 py-3 text-sm outline-none appearance-none"
                      >
                        {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">Source URL</label>
                    <input
                      type="text"
                      value={newQuote.source_url}
                      onChange={e => setNewQuote({ ...newQuote, source_url: e.target.value })}
                      placeholder="https://example.com"
                      className="w-full bg-app-bg border-none rounded-2xl px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div className="flex justify-end pt-2 md:pt-4">
                    <button type="submit" className="w-full md:w-auto bg-accent text-white px-10 py-4 rounded-2xl font-bold shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
                      Save Note
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Profile Details Sidebar */}
        <AnimatePresence>
          {isEditingProfile && (
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl z-50 flex flex-col border-l border-border"
            >
              <div className="p-6 border-b border-border flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-10">
                <h2 className="font-display font-bold text-lg">Edit Profile</h2>
                <button onClick={() => setIsEditingProfile(false)} className="p-2 hover:bg-app-bg rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                <div className="flex flex-col items-center gap-6">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-app-bg shadow-xl">
                      <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Plus size={24} />
                      <input 
                        type="text" 
                        placeholder="Avatar URL"
                        className="hidden"
                        onChange={(e) => {
                          const url = prompt("Enter Avatar URL:");
                          if (url) {
                            const updated = { ...userProfile, avatar: url };
                            setUserProfile(updated);
                            localStorage.setItem('userProfile', JSON.stringify(updated));
                          }
                        }}
                      />
                    </label>
                  </div>
                  <button 
                    onClick={() => {
                      const url = prompt("Enter Avatar URL:", userProfile.avatar);
                      if (url) {
                        const updated = { ...userProfile, avatar: url };
                        setUserProfile(updated);
                        localStorage.setItem('userProfile', JSON.stringify(updated));
                      }
                    }}
                    className="text-xs font-bold text-accent hover:underline"
                  >
                    Change Avatar URL
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted tracking-widest ml-1">Name</label>
                    <input 
                      type="text" 
                      value={userProfile.name} 
                      onChange={e => {
                        const updated = { ...userProfile, name: e.target.value };
                        setUserProfile(updated);
                        localStorage.setItem('userProfile', JSON.stringify(updated));
                      }}
                      className="w-full bg-app-bg border-none rounded-2xl p-4 text-sm font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted tracking-widest ml-1">Bio / Role</label>
                    <input 
                      type="text" 
                      value={userProfile.bio} 
                      onChange={e => {
                        const updated = { ...userProfile, bio: e.target.value };
                        setUserProfile(updated);
                        localStorage.setItem('userProfile', JSON.stringify(updated));
                      }}
                      className="w-full bg-app-bg border-none rounded-2xl p-4 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="pt-8 border-t border-border">
                  <button 
                    onClick={() => setIsEditingProfile(false)}
                    className="w-full bg-accent text-white py-4 rounded-2xl font-bold shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Details Sidebar */}

        <AnimatePresence>
          {selectedQuoteId && selectedQuote && (
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl z-50 flex flex-col border-l border-border"
            >
              <div className="p-6 border-b border-border flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-3">
                  <h2 className="font-display font-bold text-lg">Note Details</h2>
                  {isEditingSidebar ? (
                    <button onClick={() => handleUpdate(selectedQuote.id)} className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-xs font-bold bg-emerald-50 px-3 py-1 rounded-full">
                      <Save size={14} /> Save
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsEditingSidebar(true)} className="text-muted hover:text-accent flex items-center gap-1 text-xs font-bold bg-app-bg px-3 py-1 rounded-full transition-colors">
                        <Edit3 size={14} /> Edit
                      </button>
                      <button 
                        onClick={() => handleSetHero(selectedQuote.id)} 
                        className={cn(
                          "flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full transition-colors",
                          heroQuoteId === selectedQuote.id ? "bg-accent text-white" : "bg-app-bg text-muted hover:text-accent"
                        )}
                      >
                        <LayoutGrid size={14} /> {heroQuoteId === selectedQuote.id ? "Featured" : "Set as Hero"}
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={() => { setSelectedQuoteId(null); setIsEditingSidebar(false); }} className="p-2 hover:bg-app-bg rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 md:space-y-8 custom-scrollbar">
                {isEditingSidebar ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-muted tracking-widest ml-1">Title</label>
                      <input 
                        type="text" 
                        value={editForm.title} 
                        onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full bg-app-bg border-none rounded-2xl p-4 text-sm font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-muted tracking-widest ml-1">Content</label>
                      <textarea 
                        value={editForm.content} 
                        onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                        className="w-full bg-app-bg border-none rounded-2xl p-4 text-sm leading-relaxed min-h-[150px] md:min-h-[200px] outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-muted tracking-widest ml-1">Author</label>
                      <input 
                        type="text" 
                        value={editForm.author} 
                        onChange={e => setEditForm({ ...editForm, author: e.target.value })}
                        className="w-full bg-app-bg border-none rounded-2xl p-4 text-sm outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-muted tracking-widest ml-1">My Thoughts</label>
                      <textarea 
                        value={editForm.comment} 
                        onChange={e => setEditForm({ ...editForm, comment: e.target.value })}
                        className="w-full bg-app-bg border-none rounded-2xl p-4 text-sm min-h-[100px] md:min-h-[120px] outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-muted tracking-widest ml-1">Source URL</label>
                      <input 
                        type="text" 
                        value={editForm.source_url} 
                        onChange={e => setEditForm({ ...editForm, source_url: e.target.value })}
                        className="w-full bg-app-bg border-none rounded-2xl p-4 text-sm outline-none"
                        placeholder="https://..."
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-muted tracking-widest ml-1">Category</label>
                        <select
                          value={editForm.category}
                          onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                          className="w-full bg-app-bg border-none rounded-2xl px-4 py-3 text-sm outline-none appearance-none"
                        >
                          {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-muted tracking-widest ml-1">Pin Status</label>
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, is_pinned: !editForm.is_pinned })}
                          className={cn(
                            "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                            editForm.is_pinned ? "bg-amber-100 text-amber-600" : "bg-app-bg text-muted"
                          )}
                        >
                          {editForm.is_pinned ? <Pin size={14} /> : <PinOff size={14} />}
                          {editForm.is_pinned ? "Pinned" : "Not Pinned"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 md:space-y-8">
                    <div className="space-y-4">
                      <h3 className="text-3xl md:text-4xl font-display font-bold leading-tight text-accent tracking-tight">{selectedQuote.title}</h3>
                      <div className="bg-app-bg/50 p-8 md:p-10 rounded-[32px] md:rounded-[40px] text-lg md:text-xl leading-relaxed text-accent/90 whitespace-pre-wrap font-medium border border-accent/5 shadow-inner">
                        {selectedQuote.content}
                      </div>
                      <div className="flex items-center gap-3 text-muted px-2">
                        <div className="w-8 h-8 rounded-full bg-accent/5 flex items-center justify-center">
                          <User size={16} className="text-accent/40" />
                        </div>
                        <span className="font-bold text-sm md:text-base tracking-wide">{selectedQuote.author}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-4 md:space-y-6 px-2">
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-border/50"></div>
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/60">My Thoughts</h4>
                        <div className="h-px flex-1 bg-border/50"></div>
                      </div>
                      <p className="text-accent/70 leading-relaxed text-lg md:text-xl whitespace-pre-wrap font-normal">
                        {selectedQuote.comment || "No thoughts recorded yet..."}
                      </p>
                    </div>

                    {selectedQuote.source_url && (
                      <div className="space-y-3 md:space-y-4">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted">Source</h4>
                        <a 
                          href={selectedQuote.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-600 hover:underline font-medium text-sm md:text-base"
                        >
                          <Globe size={16} />
                          <span className="truncate">{selectedQuote.source_url}</span>
                        </a>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 md:gap-6 pt-6 md:pt-8 border-t border-border">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Category</p>
                        <p className="font-bold text-sm md:text-base">{selectedQuote.category}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Added on</p>
                        <p className="font-bold text-sm md:text-base">{new Date(selectedQuote.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function SortableCategoryItem({ category, onDelete, isOpen }: { category: Category, onDelete: () => void, isOpen: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="flex items-center gap-2 p-2 rounded-xl hover:bg-app-bg group transition-colors"
    >
      <button 
        {...attributes} 
        {...listeners}
        className="text-muted hover:text-accent cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <Hash size={14} className="text-muted shrink-0" />
        <span className="text-xs font-bold truncate">{category.name}</span>
      </div>
      {category.name !== "未分类" && (
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, isOpen, isSubItem }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, isOpen: boolean, isSubItem?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-2xl transition-all group",
        active ? "bg-accent text-white shadow-lg" : "text-muted hover:text-accent hover:bg-app-bg",
        isSubItem && "pl-4"
      )}
    >
      <div className={cn("shrink-0", active ? "text-white" : "text-muted group-hover:text-accent")}>
        {icon}
      </div>
      {isOpen && <span className="text-sm font-bold truncate">{label}</span>}
    </button>
  );
}

function NoteCard({ quote, state, onClick, onDelete, onBoost, onTogglePin }: { quote: Quote, state: any, onClick: () => void, onDelete: () => void, onBoost: () => void, onTogglePin: () => void }) {
  return (
    <motion.article 
      layout
      onClick={onClick}
      className={cn(
        "group rounded-[24px] md:rounded-[32px] p-6 md:p-8 card-shadow hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col h-full border border-transparent hover:border-border relative overflow-hidden",
        state.cardBg
      )}
    >
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex flex-wrap gap-2">
          <span className={cn("px-2.5 py-0.5 md:px-3 md:py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider shadow-sm", state.tagBg)}>
            {state.label}
          </span>
          {quote.is_pinned && (
            <span className="px-2.5 py-0.5 md:px-3 md:py-1 rounded-full bg-amber-50 text-amber-600 text-[9px] md:text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
              <Pin size={10} /> Pinned
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
            className={cn(
              "p-1.5 md:p-2 rounded-lg transition-colors",
              quote.is_pinned ? "bg-amber-50 text-amber-600" : "hover:bg-app-bg text-muted hover:text-accent"
            )}
            title={quote.is_pinned ? "Unpin" : "Pin"}
          >
            {quote.is_pinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onBoost(); }}
            className="p-1.5 md:p-2 hover:bg-emerald-50 text-muted hover:text-emerald-600 rounded-lg transition-colors"
            title="Boost"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 md:space-y-4">
        <h4 className="text-xl md:text-2xl font-display font-black leading-tight group-hover:text-accent transition-colors">
          {quote.title || "Untitled"}
        </h4>
        <p className="text-muted text-sm md:text-base line-clamp-4 leading-relaxed whitespace-pre-wrap">
          {quote.content}
        </p>
      </div>

      <div className="pt-6 md:pt-8 mt-auto flex items-center justify-between border-t border-border/50">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <User size={12} className="text-muted" />
            <span className="text-[10px] md:text-xs font-bold text-muted truncate max-w-[100px] md:max-w-[120px]">{quote.author}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-muted">
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 md:p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
