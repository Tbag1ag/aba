export interface Quote {
  id: number;
  title: string;
  content: string;
  author: string;
  comment: string;
  category: string;
  is_pinned: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
}

class StorageService {
  private isLocal: boolean = true;
  private apiBase: string = '/api';

  constructor() {
    this.isLocal = localStorage.getItem('storage_mode') !== 'api';
    this.apiBase = localStorage.getItem('api_base_url') || '/api';
  }

  setMode(mode: 'local' | 'api', baseUrl?: string) {
    this.isLocal = mode === 'local';
    localStorage.setItem('storage_mode', mode);
    if (baseUrl) {
      this.apiBase = baseUrl;
      localStorage.setItem('api_base_url', baseUrl);
    }
  }

  getMode() {
    return this.isLocal ? 'local' : 'api';
  }

  getApiBase() {
    return this.apiBase;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    if (this.isLocal) {
      const data = localStorage.getItem('categories');
      if (!data) {
        const defaults = [
          { id: 1, name: '读书心得' },
          { id: 2, name: '金句摘抄' },
          { id: 3, name: '灵感随笔' },
          { id: 4, name: '未分类' }
        ];
        localStorage.setItem('categories', JSON.stringify(defaults));
        return defaults;
      }
      return JSON.parse(data);
    }
    const res = await fetch(`${this.apiBase}/categories`);
    return res.json();
  }

  async addCategory(name: string): Promise<Category> {
    if (this.isLocal) {
      const categories = await this.getCategories();
      const newCat = { id: Date.now(), name };
      categories.push(newCat);
      localStorage.setItem('categories', JSON.stringify(categories));
      return newCat;
    }
    const res = await fetch(`${this.apiBase}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return res.json();
  }

  async deleteCategory(id: number): Promise<void> {
    if (this.isLocal) {
      let categories = await this.getCategories();
      const catToDelete = categories.find(c => c.id === id);
      if (catToDelete) {
        categories = categories.filter(c => c.id !== id);
        localStorage.setItem('categories', JSON.stringify(categories));
        
        // Update quotes in this category to '未分类'
        let quotes = await this.getQuotes();
        quotes = quotes.map(q => q.category === catToDelete.name ? { ...q, category: '未分类' } : q);
        localStorage.setItem('quotes', JSON.stringify(quotes));
      }
      return;
    }
    await fetch(`${this.apiBase}/categories/${id}`, { method: 'DELETE' });
  }

  // Quotes
  async getQuotes(category?: string, search?: string): Promise<Quote[]> {
    if (this.isLocal) {
      const data = localStorage.getItem('quotes');
      let quotes: Quote[] = data ? JSON.parse(data) : [];
      
      if (category && category !== '全部') {
        quotes = quotes.filter(q => q.category === category);
      }
      if (search) {
        const s = search.toLowerCase();
        quotes = quotes.filter(q => 
          q.title.toLowerCase().includes(s) || 
          q.content.toLowerCase().includes(s) || 
          q.author.toLowerCase().includes(s) || 
          q.comment.toLowerCase().includes(s)
        );
      }
      
      return quotes.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    const res = await fetch(`${this.apiBase}/quotes?${params.toString()}`);
    return res.json();
  }

  async addQuote(quote: Omit<Quote, 'id' | 'created_at'>): Promise<Quote> {
    if (this.isLocal) {
      const quotes = await this.getQuotes();
      const newQuote = {
        ...quote,
        id: Date.now(),
        created_at: new Date().toISOString()
      };
      quotes.push(newQuote);
      localStorage.setItem('quotes', JSON.stringify(quotes));
      return newQuote;
    }
    const res = await fetch(`${this.apiBase}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quote),
    });
    return res.json();
  }

  async updateQuote(id: number, quote: Partial<Quote>): Promise<Quote> {
    if (this.isLocal) {
      let quotes = await this.getQuotes();
      const index = quotes.findIndex(q => q.id === id);
      if (index !== -1) {
        quotes[index] = { ...quotes[index], ...quote };
        localStorage.setItem('quotes', JSON.stringify(quotes));
        return quotes[index];
      }
      throw new Error('Quote not found');
    }
    const res = await fetch(`${this.apiBase}/quotes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quote),
    });
    return res.json();
  }

  async deleteQuote(id: number): Promise<void> {
    if (this.isLocal) {
      let quotes = await this.getQuotes();
      quotes = quotes.filter(q => q.id !== id);
      localStorage.setItem('quotes', JSON.stringify(quotes));
      return;
    }
    await fetch(`${this.apiBase}/quotes/${id}`, { method: 'DELETE' });
  }
}

export const storage = new StorageService();
