import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("quotes.db");
console.log("Database initialized at:", path.resolve("quotes.db"));

// Initialize database
try {
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
  `);
  console.log("Tables ensured.");
} catch (err) {
  console.error("Error creating tables:", err);
}

// Ensure default categories exist
try {
  const countResult = db.prepare("SELECT COUNT(*) as count FROM categories").get() as any;
  console.log("Current categories count:", countResult?.count);
  if (!countResult || countResult.count === 0) {
    console.log("Inserting default categories...");
    const insert = db.prepare("INSERT INTO categories (name) VALUES (?)");
    ['读书心得', '金句摘抄', '灵感随笔', '未分类'].forEach(name => {
      try {
        insert.run(name);
      } catch (e) {
        console.warn(`Category ${name} already exists or failed to insert:`, e);
      }
    });
  }
} catch (err) {
  console.error("Error checking/seeding categories:", err);
}

// Add title and is_pinned columns if they don't exist (migration)
try {
  db.prepare("ALTER TABLE quotes ADD COLUMN title TEXT").run();
  console.log("Migration: Added 'title' column to quotes.");
} catch (e: any) {
  if (!e.message.includes("duplicate column name")) {
    console.error("Migration error (title):", e.message);
  }
}
try {
  db.prepare("ALTER TABLE quotes ADD COLUMN is_pinned INTEGER DEFAULT 0").run();
  console.log("Migration: Added 'is_pinned' column to quotes.");
} catch (e: any) {
  if (!e.message.includes("duplicate column name")) {
    console.error("Migration error (is_pinned):", e.message);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get("/api/quotes", (req, res) => {
    try {
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
    } catch (err: any) {
      console.error("Error fetching quotes:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/categories", (req, res) => {
    try {
      const categories = db.prepare("SELECT * FROM categories ORDER BY id ASC").all();
      res.json(categories);
    } catch (err: any) {
      console.error("Error fetching categories:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/categories", (req, res) => {
    const { name } = req.body;
    console.log(`Attempting to add category: "${name}"`);
    try {
      if (!name || typeof name !== 'string') {
        console.error("Invalid category name received:", name);
        return res.status(400).json({ error: "分类名称无效" });
      }
      const info = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
      console.log(`Category added successfully: ID ${info.lastInsertRowid}`);
      res.json({ id: info.lastInsertRowid, name });
    } catch (err: any) {
      console.error("Error adding category:", err.message);
      res.status(400).json({ error: err.message.includes("UNIQUE") ? "该分类已存在" : err.message });
    }
  });

  app.delete("/api/categories/:id", (req, res) => {
    try {
      const { id } = req.params;
      const category = db.prepare("SELECT name FROM categories WHERE id = ?").get(id) as any;
      if (category) {
        db.prepare("UPDATE quotes SET category = '未分类' WHERE category = ?").run(category.name);
      }
      db.prepare("DELETE FROM categories WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting category:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/quotes", (req, res) => {
    try {
      const { title, content, author, comment, category, is_pinned } = req.body;
      const info = db.prepare("INSERT INTO quotes (title, content, author, comment, category, is_pinned) VALUES (?, ?, ?, ?, ?, ?)").run(
        title || '', 
        content, 
        author || '', 
        comment || '', 
        category || '未分类', 
        is_pinned ? 1 : 0
      );
      res.json({ id: info.lastInsertRowid, title, content, author, comment, category, is_pinned: !!is_pinned });
    } catch (err: any) {
      console.error("Error adding quote:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/quotes/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { title, content, author, comment, category, is_pinned } = req.body;
      db.prepare("UPDATE quotes SET title = ?, content = ?, author = ?, comment = ?, category = ?, is_pinned = ? WHERE id = ?").run(
        title || '', 
        content, 
        author || '', 
        comment || '', 
        category || '未分类', 
        is_pinned ? 1 : 0, 
        id
      );
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error updating quote:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/quotes/:id", (req, res) => {
    try {
      const { id } = req.params;
      db.prepare("DELETE FROM quotes WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting quote:", err);
      res.status(500).json({ error: err.message });
    }
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
