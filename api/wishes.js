const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// CORS 헤더
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// 월 숫자 배열 → 멀티셀렉트 옵션 변환
function monthsToOptions(months) {
  return months.map(m => ({ name: m + "월" }));
}

// 멀티셀렉트 옵션 → 월 숫자 배열 변환
function optionsToMonths(options) {
  return options.map(o => parseInt(o.name)).filter(n => !isNaN(n)).sort((a, b) => a - b);
}

// 노션 페이지 → 위젯용 객체 변환
function pageToWish(page) {
  return {
    id: page.id,
    text: page.properties["이름"].title[0]?.text.content || "",
    months: optionsToMonths(page.properties["월"].multi_select)
  };
}

module.exports = async function handler(req, res) {
  setCors(res);

  // OPTIONS (CORS preflight)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // ===== GET — 전체 목표 가져오기 =====
    if (req.method === "GET") {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        sorts: [{ timestamp: "created_time", direction: "ascending" }]
      });
      const wishes = response.results.map(pageToWish);
      return res.status(200).json(wishes);
    }

    // ===== POST — 새 목표 추가 =====
    if (req.method === "POST") {
      const { text } = req.body;
      const page = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties: {
          "이름": { title: [{ text: { content: text } }] },
          "월": { multi_select: [] }
        }
      });
      return res.status(200).json(pageToWish(page));
    }

    // ===== PUT — 목표 수정 (월 업데이트) =====
    if (req.method === "PUT") {
      const { id, months } = req.body;
      const page = await notion.pages.update({
        page_id: id,
        properties: {
          "월": { multi_select: monthsToOptions(months) }
        }
      });
      return res.status(200).json(pageToWish(page));
    }

    // ===== DELETE — 목표 삭제 =====
    if (req.method === "DELETE") {
      const { id } = req.body;
      await notion.pages.update({
        page_id: id,
        archived: true
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
