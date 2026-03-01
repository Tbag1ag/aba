import express from "express";
import { createServer as createViteServer } from "vite";
import { neon } from "@neondatabase/serverless";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL?.trim();

function getSql() {
  if (!DATABASE_URL) {
    throw new Error("环境变量 DATABASE_URL 未设置。请在 AI Studio 的环境变量设置中添加您的 Neon 数据库连接字符串。");
  }
  
  // Clean up the connection string
  let cleanedUrl = DATABASE_URL;
  
  // Remove 'psql ' prefix if present
  if (cleanedUrl.startsWith('psql ')) {
    cleanedUrl = cleanedUrl.substring(5).trim();
  }
  
  // Remove surrounding quotes if present
  if ((cleanedUrl.startsWith("'") && cleanedUrl.endsWith("'")) || 
      (cleanedUrl.startsWith('"') && cleanedUrl.endsWith('"'))) {
    cleanedUrl = cleanedUrl.substring(1, cleanedUrl.length - 1).trim();
  }
  
  try {
    return neon(cleanedUrl);
  } catch (err: any) {
    throw new Error(`无效的连接字符串格式: ${err.message}`);
  }
}

async function initDb() {
  if (!DATABASE_URL) {
    console.warn("DATABASE_URL is missing. Skipping database initialization.");
    return;
  }
  
  try {
    const sql = getSql();
    console.log("Initializing Neon database...");
    
    // Create tables
    await sql`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS quotes (
        id SERIAL PRIMARY KEY,
        title TEXT,
        content TEXT NOT NULL,
        author TEXT,
        comment TEXT,
        category TEXT DEFAULT '未分类',
        is_pinned INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Seed default categories
    const categories = await sql`SELECT COUNT(*) as count FROM categories`;
    if (parseInt(categories[0].count) === 0) {
      console.log("Seeding default categories...");
      const defaults = ['读书心得', '金句摘抄', '灵感随笔', '未分类'];
      for (const name of defaults) {
        await sql`INSERT INTO categories (name) VALUES (${name}) ON CONFLICT DO NOTHING`;
      }
    }
    
    console.log("Database initialization complete.");
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      if (!DATABASE_URL) {
        return res.json({ status: "error", message: "DATABASE_URL 未设置" });
      }
      const sql = getSql();
      await sql`SELECT 1`;
      res.json({ status: "ok", message: "数据库连接正常" });
    } catch (err: any) {
      res.json({ status: "error", message: `数据库连接失败: ${err.message}` });
    }
  });

  await initDb();

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get("/api/quotes", async (req, res) => {
    try {
      const sql = getSql();
      const { category, search } = req.query;
      
      let quotes;
      if (category && category !== '全部' && search) {
        const searchParam = `%${search}%`;
        quotes = await sql`
          SELECT * FROM quotes 
          WHERE category = ${category as string} 
          AND (title ILIKE ${searchParam} OR content ILIKE ${searchParam} OR author ILIKE ${searchParam} OR comment ILIKE ${searchParam})
          ORDER BY is_pinned DESC, created_at DESC
        `;
      } else if (category && category !== '全部') {
        quotes = await sql`
          SELECT * FROM quotes 
          WHERE category = ${category as string}
          ORDER BY is_pinned DESC, created_at DESC
        `;
      } else if (search) {
        const searchParam = `%${search}%`;
        quotes = await sql`
          SELECT * FROM quotes 
          WHERE (title ILIKE ${searchParam} OR content ILIKE ${searchParam} OR author ILIKE ${searchParam} OR comment ILIKE ${searchParam})
          ORDER BY is_pinned DESC, created_at DESC
        `;
      } else {
        quotes = await sql`
          SELECT * FROM quotes 
          ORDER BY is_pinned DESC, created_at DESC
        `;
      }
      
      res.json(quotes);
    } catch (err: any) {
      console.error("Error fetching quotes:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const sql = getSql();
      const categories = await sql`SELECT * FROM categories ORDER BY id ASC`;
      res.json(categories);
    } catch (err: any) {
      console.error("Error fetching categories:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/categories", async (req, res) => {
    const { name } = req.body;
    console.log(`Attempting to add category: "${name}"`);
    try {
      const sql = getSql();
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "分类名称无效" });
      }
      const result = await sql`INSERT INTO categories (name) VALUES (${name}) RETURNING id`;
      res.json({ id: result[0].id, name });
    } catch (err: any) {
      console.error("Error adding category:", err.message);
      res.status(400).json({ error: err.message.includes("unique") ? "该分类已存在" : err.message });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const sql = getSql();
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "无效的分类 ID" });
      }

      console.log(`Attempting to delete category ID: ${id}`);
      const category = await sql`SELECT name FROM categories WHERE id = ${id}`;
      
      if (category.length > 0) {
        const categoryName = category[0].name;
        console.log(`Updating quotes for category: ${categoryName}`);
        await sql`UPDATE quotes SET category = '未分类' WHERE category = ${categoryName}`;
        await sql`DELETE FROM categories WHERE id = ${id}`;
        console.log(`Category ${id} deleted successfully`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "未找到该分类" });
      }
    } catch (err: any) {
      console.error("Error deleting category:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/quotes", async (req, res) => {
    try {
      const sql = getSql();
      const { title, content, author, comment, category, is_pinned } = req.body;
      const result = await sql`
        INSERT INTO quotes (title, content, author, comment, category, is_pinned) 
        VALUES (${title || ''}, ${content}, ${author || ''}, ${comment || ''}, ${category || '未分类'}, ${is_pinned ? 1 : 0}) 
        RETURNING id
      `;
      res.json({ id: result[0].id, title, content, author, comment, category, is_pinned: !!is_pinned });
    } catch (err: any) {
      console.error("Error adding quote:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/quotes/:id", async (req, res) => {
    try {
      const sql = getSql();
      const { id } = req.params;
      const { title, content, author, comment, category, is_pinned } = req.body;
      await sql`
        UPDATE quotes 
        SET title = ${title || ''}, content = ${content}, author = ${author || ''}, comment = ${comment || ''}, category = ${category || '未分类'}, is_pinned = ${is_pinned ? 1 : 0} 
        WHERE id = ${id}
      `;
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error updating quote:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/quotes/:id", async (req, res) => {
    try {
      const sql = getSql();
      const { id } = req.params;
      await sql`DELETE FROM quotes WHERE id = ${id}`;
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting quote:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // SQL Editor endpoint
  app.post("/api/sql", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "SQL 查询无效" });
      }
      
      // Basic safety check: only allow SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER
      const forbiddenKeywords = ["GRANT", "REVOKE", "CREATE USER", "DROP USER"];
      if (forbiddenKeywords.some(keyword => query.toUpperCase().includes(keyword))) {
        return res.status(403).json({ error: "不允许执行敏感权限操作" });
      }

      const sql = getSql();
      const result = await (sql as any)(query);
      res.json({ result });
    } catch (err: any) {
      console.error("SQL Execution error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // API 404 handler
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
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
