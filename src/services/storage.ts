import { neon } from '@neondatabase/serverless';

export interface Quote {
  id: number;
  title: string;
  content: string;
  author: string;
  comment: string;
  category: string;
  is_pinned: boolean;
  confidence: number;
  last_accessed_at: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
}

// Get the database URL from environment variables
const getDatabaseUrl = () => {
  try {
    // We use process.env.DATABASE_URL which is injected by Vite's define config
    return (process.env as any).DATABASE_URL;
  } catch (e) {
    return undefined;
  }
};

const DATABASE_URL = getDatabaseUrl();

class StorageService {
  private sql: any = null;

  constructor() {
    if (DATABASE_URL) {
      try {
        this.sql = neon(DATABASE_URL);
      } catch (e) {
        console.error("Failed to initialize Neon:", e);
        this.sql = null;
      }
    } else {
      console.warn("VITE_DATABASE_URL is not set. Falling back to LocalStorage.");
    }
  }

  isUsingNeon() {
    return !!this.sql;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    if (this.sql) {
      try {
        const result = await this.sql`SELECT * FROM categories ORDER BY name ASC`;
        return result as Category[];
      } catch (err) {
        console.error("Neon fetch categories error:", err);
        return this.getLocalCategories();
      }
    }
    return this.getLocalCategories();
  }

  private getLocalCategories(): Category[] {
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

  async addCategory(name: string): Promise<Category> {
    if (this.sql) {
      const result = await this.sql`INSERT INTO categories (name) VALUES (${name}) RETURNING *`;
      return result[0] as Category;
    }
    const categories = await this.getCategories();
    const newCat = { id: Date.now(), name };
    categories.push(newCat);
    localStorage.setItem('categories', JSON.stringify(categories));
    return newCat;
  }

  async deleteCategory(id: number): Promise<void> {
    if (this.sql) {
      const category = await this.sql`SELECT name FROM categories WHERE id = ${id}`;
      if (category.length > 0) {
        const categoryName = category[0].name;
        await this.sql`UPDATE quotes SET category = '未分类' WHERE category = ${categoryName}`;
        await this.sql`DELETE FROM categories WHERE id = ${id}`;
      }
      return;
    }
    let categories = await this.getCategories();
    const catToDelete = categories.find(c => c.id === id);
    if (catToDelete) {
      categories = categories.filter(c => c.id !== id);
      localStorage.setItem('categories', JSON.stringify(categories));
      let quotes = await this.getQuotes();
      quotes = quotes.map(q => q.category === catToDelete.name ? { ...q, category: '未分类' } : q);
      localStorage.setItem('quotes', JSON.stringify(quotes));
    }
  }

  // Quotes
  async getQuotes(category?: string, search?: string): Promise<Quote[]> {
    if (this.sql) {
      try {
        let result;
        if (category && category !== '全部' && search) {
          const s = `%${search}%`;
          result = await this.sql`SELECT * FROM quotes WHERE category = ${category} AND (title ILIKE ${s} OR content ILIKE ${s} OR author ILIKE ${s} OR comment ILIKE ${s}) ORDER BY is_pinned DESC, confidence DESC, created_at DESC`;
        } else if (category && category !== '全部') {
          result = await this.sql`SELECT * FROM quotes WHERE category = ${category} ORDER BY is_pinned DESC, confidence DESC, created_at DESC`;
        } else if (search) {
          const s = `%${search}%`;
          result = await this.sql`SELECT * FROM quotes WHERE (title ILIKE ${s} OR content ILIKE ${s} OR author ILIKE ${s} OR comment ILIKE ${s}) ORDER BY is_pinned DESC, confidence DESC, created_at DESC`;
        } else {
          result = await this.sql`SELECT * FROM quotes ORDER BY is_pinned DESC, confidence DESC, created_at DESC`;
        }
        return result as Quote[];
      } catch (err) {
        console.error("Neon fetch quotes error:", err);
        return this.getLocalQuotes(category, search);
      }
    }
    return this.getLocalQuotes(category, search);
  }

  private getLocalQuotes(category?: string, search?: string): Quote[] {
    const data = localStorage.getItem('quotes');
    let quotes: Quote[] = data ? JSON.parse(data) : [];
    if (category && category !== '全部') quotes = quotes.filter(q => q.category === category);
    if (search) {
      const s = search.toLowerCase();
      quotes = quotes.filter(q => q.title.toLowerCase().includes(s) || q.content.toLowerCase().includes(s) || q.author.toLowerCase().includes(s));
    }
    return quotes.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  async addQuote(quote: Omit<Quote, 'id' | 'created_at' | 'confidence' | 'last_accessed_at'>): Promise<Quote> {
    const now = new Date().toISOString();
    if (this.sql) {
      const result = await this.sql`
        INSERT INTO quotes (title, content, author, comment, category, is_pinned, confidence, last_accessed_at) 
        VALUES (${quote.title}, ${quote.content}, ${quote.author}, ${quote.comment}, ${quote.category}, ${quote.is_pinned}, 0.7, ${now}) 
        RETURNING *
      `;
      return result[0] as Quote;
    }
    const quotes = await this.getLocalQuotes();
    const newQuote = { ...quote, id: Date.now(), confidence: 0.7, last_accessed_at: now, created_at: now };
    quotes.push(newQuote);
    localStorage.setItem('quotes', JSON.stringify(quotes));
    return newQuote;
  }

  async updateQuote(id: number, quote: Partial<Quote>): Promise<Quote> {
    if (this.sql) {
      const existing = (await this.sql`SELECT * FROM quotes WHERE id = ${id}`)[0];
      const updated = { ...existing, ...quote };
      const result = await this.sql`
        UPDATE quotes 
        SET title = ${updated.title}, content = ${updated.content}, author = ${updated.author}, 
            comment = ${updated.comment}, category = ${updated.category}, is_pinned = ${updated.is_pinned},
            confidence = ${updated.confidence}, last_accessed_at = ${updated.last_accessed_at}
        WHERE id = ${id}
        RETURNING *
      `;
      return result[0] as Quote;
    }
    let quotes = await this.getLocalQuotes();
    const idx = quotes.findIndex(q => q.id === id);
    if (idx !== -1) {
      quotes[idx] = { ...quotes[idx], ...quote };
      localStorage.setItem('quotes', JSON.stringify(quotes));
      return quotes[idx];
    }
    throw new Error('Not found');
  }

  async deleteQuote(id: number): Promise<void> {
    if (this.sql) {
      await this.sql`DELETE FROM quotes WHERE id = ${id}`;
      return;
    }
    let quotes = await this.getLocalQuotes();
    quotes = quotes.filter(q => q.id !== id);
    localStorage.setItem('quotes', JSON.stringify(quotes));
  }

  // Knowledge Lifecycle Logic
  async boostKnowledge(id: number): Promise<void> {
    const now = new Date().toISOString();
    if (this.sql) {
      await this.sql`
        UPDATE quotes 
        SET confidence = LEAST(1.0, confidence + 0.1), 
            last_accessed_at = ${now}
        WHERE id = ${id}
      `;
    } else {
      let quotes = await this.getLocalQuotes();
      const idx = quotes.findIndex(q => q.id === id);
      if (idx !== -1) {
        quotes[idx].confidence = Math.min(1.0, quotes[idx].confidence + 0.1);
        quotes[idx].last_accessed_at = now;
        localStorage.setItem('quotes', JSON.stringify(quotes));
      }
    }
  }

  async decayKnowledge(): Promise<void> {
    const now = new Date();
    if (this.sql) {
      // Decay logic: -0.05 confidence for every 7 days of inactivity
      await this.sql`
        UPDATE quotes 
        SET confidence = GREATEST(0.0, confidence - 0.05)
        WHERE (EXTRACT(EPOCH FROM (${now} - last_accessed_at)) / 86400) > 7
      `;
    } else {
      let quotes = await this.getLocalQuotes();
      const updatedQuotes = quotes.map(q => {
        const lastAccess = new Date(q.last_accessed_at);
        const diffDays = (now.getTime() - lastAccess.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) {
          return { ...q, confidence: Math.max(0, q.confidence - 0.05) };
        }
        return q;
      });
      localStorage.setItem('quotes', JSON.stringify(updatedQuotes));
    }
  }

  // Export/Import
  async exportData(): Promise<string> {
    const quotes = await this.getQuotes();
    const categories = await this.getCategories();
    return JSON.stringify({ quotes, categories, version: '1.0', export_at: new Date().toISOString() }, null, 2);
  }

  async importData(json: string): Promise<void> {
    const data = JSON.parse(json);
    if (!data.quotes || !data.categories) throw new Error('Invalid data format');

    if (this.sql) {
      // Clear existing (optional, but safer for a clean import)
      await this.sql`DELETE FROM quotes`;
      await this.sql`DELETE FROM categories`;

      // Import categories
      for (const cat of data.categories) {
        await this.sql`INSERT INTO categories (id, name) VALUES (${cat.id}, ${cat.name}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`;
      }

      // Import quotes
      for (const q of data.quotes) {
        await this.sql`
          INSERT INTO quotes (id, title, content, author, comment, category, is_pinned, confidence, last_accessed_at, created_at)
          VALUES (${q.id}, ${q.title}, ${q.content}, ${q.author}, ${q.comment}, ${q.category}, ${q.is_pinned}, ${q.confidence || 0.7}, ${q.last_accessed_at || q.created_at}, ${q.created_at})
          ON CONFLICT (id) DO UPDATE SET 
            title = EXCLUDED.title, content = EXCLUDED.content, author = EXCLUDED.author,
            comment = EXCLUDED.comment, category = EXCLUDED.category, is_pinned = EXCLUDED.is_pinned,
            confidence = EXCLUDED.confidence, last_accessed_at = EXCLUDED.last_accessed_at
        `;
      }
    } else {
      localStorage.setItem('quotes', JSON.stringify(data.quotes));
      localStorage.setItem('categories', JSON.stringify(data.categories));
    }
  }
}

export const storage = new StorageService();


