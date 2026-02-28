import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("quotes.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT NOT NULL,
    author TEXT,
    comment TEXT,
    category TEXT DEFAULT '未分类',
    is_pinned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Insert default categories if they don't exist
  INSERT OR IGNORE INTO categories (name) VALUES ('读书心得'), ('金句摘抄'), ('灵感随笔'), ('未分类');
`);

// Ensure default categories exist
const count = db.prepare("SELECT COUNT(*) as count FROM categories").get() as any;
if (count.count === 0) {
  const insert = db.prepare("INSERT INTO categories (name) VALUES (?)");
  ['读书心得', '金句摘抄', '灵感随笔', '未分类'].forEach(name => insert.run(name));
}

// Add title and is_pinned columns if they don't exist (migration)
try {
  db.prepare("ALTER TABLE quotes ADD COLUMN title TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE quotes ADD COLUMN is_pinned INTEGER DEFAULT 0").run();
} catch (e) {}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/quotes", (req, res) => {
    const { category, search } = req.query;
    let query = "SELECT * FROM quotes WHERE 1=1";
    const params: any[] = [];
    
    if (category && category !== '全部') {
      query += " AND category = ?";
      params.push(category);
    }

    if (search) {
      query += " AND (title LIKE ? OR content LIKE ? OR author LIKE ? OR comment LIKE ?)";
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    query += " ORDER BY is_pinned DESC, created_at DESC";
    const quotes = db.prepare(query).all(...params);
    res.json(quotes);
  });

  app.get("/api/categories", (req, res) => {
    const categories = db.prepare("SELECT * FROM categories ORDER BY id ASC").all();
    res.json(categories);
  });

  app.post("/api/categories", (req, res) => {
    const { name } = req.body;
    try {
      const info = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
      res.json({ id: info.lastInsertRowid, name });
    } catch (err) {
      res.status(400).json({ error: "Category already exists" });
    }
  });

  app.delete("/api/categories/:id", (req, res) => {
    const { id } = req.params;
    // Optional: Update quotes in this category to '未分类'
    const category = db.prepare("SELECT name FROM categories WHERE id = ?").get(id) as any;
    if (category) {
      db.prepare("UPDATE quotes SET category = '未分类' WHERE category = ?").run(category.name);
    }
    db.prepare("DELETE FROM categories WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/quotes", (req, res) => {
    const { title, content, author, comment, category, is_pinned } = req.body;
    const info = db.prepare("INSERT INTO quotes (title, content, author, comment, category, is_pinned) VALUES (?, ?, ?, ?, ?, ?)").run(title || '', content, author, comment, category || '未分类', is_pinned ? 1 : 0);
    res.json({ id: info.lastInsertRowid, title, content, author, comment, category, is_pinned: !!is_pinned });
  });

  app.put("/api/quotes/:id", (req, res) => {
    const { id } = req.params;
    const { title, content, author, comment, category, is_pinned } = req.body;
    db.prepare("UPDATE quotes SET title = ?, content = ?, author = ?, comment = ?, category = ?, is_pinned = ? WHERE id = ?").run(title, content, author, comment, category, is_pinned ? 1 : 0, id);
    res.json({ success: true });
  });

  app.delete("/api/quotes/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM quotes WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
