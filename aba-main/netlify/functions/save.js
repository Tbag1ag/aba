const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
  // 允许跨域（插件需要）
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // 处理 preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { content, source_url } = JSON.parse(event.body || '{}');

    if (!content || !content.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '内容不能为空' }) };
    }

    const sql = neon(process.env.DATABASE_URL);
    const now = new Date().toISOString();

    await sql`
      INSERT INTO quotes (title, content, author, comment, category, source_url, is_pinned, confidence, last_accessed_at, created_at)
      VALUES ('', ${content.trim()}, '', '', '未分类', ${source_url || ''}, false, 0.7, ${now}, ${now})
    `;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (e) {
    console.error('Save error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message || '保存失败' })
    };
  }
};
