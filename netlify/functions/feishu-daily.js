const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
  try {
    // 1. 连接 Neon，随机取一条笔记
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT id, title, content, author, comment, category, source_url, created_at
      FROM quotes
      ORDER BY RANDOM()
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      console.log('No quotes found in database');
      return { statusCode: 200, body: 'No quotes' };
    }

    const quote = rows[0];

    // 2. 构建内容 — 不截断，保留完整原文
    const titleText = quote.title || '无标题';
    const categoryText = quote.category || '未分类';
    const dateText = new Date(quote.created_at).toLocaleDateString('zh-CN');

    // 3. 构建飞书卡片消息
    const cardElements = [
      {
        tag: 'div',
        text: {
          content: quote.content,
          tag: 'lark_md'
        }
      },
      {
        tag: 'hr'
      },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**分类：**${categoryText}`
            }
          },
          {
            is_short: true,
            text: {
              tag: 'lark_md',
              content: `**收录日期：**${dateText}`
            }
          }
        ]
      }
    ];

    // 如果有来源链接，加一个按钮
    if (quote.source_url) {
      cardElements.push({
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              content: '查看来源',
              tag: 'plain_text'
            },
            type: 'default',
            url: quote.source_url
          },
          {
            tag: 'button',
            text: {
              content: '在 ReadNote 中查看',
              tag: 'plain_text'
            },
            type: 'primary',
            url: `https://readbo.netlify.app/?id=${quote.id}`
          }
        ]
      });
    } else {
      cardElements.push({
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              content: '在 ReadNote 中查看',
              tag: 'plain_text'
            },
            type: 'primary',
            url: `https://readbo.netlify.app/?id=${quote.id}`
          }
        ]
      });
    }

    const feishuPayload = {
      msg_type: 'interactive',
      card: {
        config: {
          wide_screen_mode: true,
          enable_forward: true
        },
        header: {
          title: {
            content: `📖 ${titleText}`,
            tag: 'plain_text'
          },
          template: 'blue'
        },
        elements: cardElements
      }
    };

    // 4. POST 到飞书 Webhook
    const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('FEISHU_WEBHOOK_URL not set');
      return { statusCode: 500, body: 'Missing webhook URL' };
    }

    const feishuRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feishuPayload)
    });

    const result = await feishuRes.json();
    console.log('Feishu response:', JSON.stringify(result));

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, quote_id: quote.id, feishu: result })
    };

  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
