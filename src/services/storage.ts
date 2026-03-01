import { neon } from '@neondatabase/serverless';

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

// Get the database URL from environment variables
// Note: In Vite, variables must be prefixed with VITE_ to be accessible in the browser
const getDatabaseUrl = () => {
  try {
    return (import.meta as any).env?.VITE_DATABASE_URL;
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
        let query = 'SELECT * FROM quotes WHERE 1=1';
        const args: any[] = [];
        
        if (category && category !== '全部') {
          query += ' AND category = $1';
          args.push(category);
        }
        
        if (search) {
          const s = `%${search}%`;
          const searchIdx = args.length + 1;
          query += ` AND (title ILIKE $${searchIdx} OR content ILIKE $${searchIdx} OR author ILIKE $${searchIdx} OR comment ILIKE $${searchIdx})`;
          args.push(s);
        }
        
        query += ' ORDER BY is_pinned DESC, created_at DESC';
        
        // Use the tagged template literal correctly with dynamic parts is tricky with neon
        // For simplicity and safety with the neon driver:
        if (args.length === 0) {
          return (await this.sql`SELECT * FROM quotes ORDER BY is_pinned DESC, created_at DESC`) as Quote[];
        } else if (args.length === 1 && category && category !== '全部') {
          return (await this.sql`SELECT * FROM quotes WHERE category = ${category} ORDER BY is_pinned DESC, created_at DESC`) as Quote[];
        } else if (args.length === 1 && search) {
          const s = `%${search}%`;
          return (await this.sql`SELECT * FROM quotes WHERE (title ILIKE ${s} OR content ILIKE ${s} OR author ILIKE ${s} OR comment ILIKE ${s}) ORDER BY is_pinned DESC, created_at DESC`) as Quote[];
        } else {
          const s = `%${search}%`;
          return (await this.sql`SELECT * FROM quotes WHERE category = ${category} AND (title ILIKE ${s} OR content ILIKE ${s} OR author ILIKE ${s} OR comment ILIKE ${s}) ORDER BY is_pinned DESC, created_at DESC`) as Quote[];
        }
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
    return quotes.sort((a, b) => (a.is_pinned === b.is_pinned ? 0 : a.is_pinned ? -1 : 1));
  }

  async addQuote(quote: Omit<Quote, 'id' | 'created_at'>): Promise<Quote> {
    if (this.sql) {
      const result = await this.sql`
        INSERT INTO quotes (title, content, author, comment, category, is_pinned) 
        VALUES (${quote.title}, ${quote.content}, ${quote.author}, ${quote.comment}, ${quote.category}, ${quote.is_pinned}) 
        RETURNING *
      `;
      return result[0] as Quote;
    }
    const quotes = await this.getLocalQuotes();
    const newQuote = { ...quote, id: Date.now(), created_at: new Date().toISOString() };
    quotes.push(newQuote);
    localStorage.setItem('quotes', JSON.stringify(quotes));
    return newQuote;
  }

  async updateQuote(id: number, quote: Partial<Quote>): Promise<Quote> {
    if (this.sql) {
      // Direct update for common fields
      const existing = (await this.sql`SELECT * FROM quotes WHERE id = ${id}`)[0];
      const updated = { ...existing, ...quote };
      const result = await this.sql`
        UPDATE quotes 
        SET title = ${updated.title}, content = ${updated.content}, author = ${updated.author}, 
            comment = ${updated.comment}, category = ${updated.category}, is_pinned = ${updated.is_pinned}
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
}

export const storage = new StorageService();

