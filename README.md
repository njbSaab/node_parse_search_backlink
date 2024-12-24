# node_simple_parser

const path = require("path");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3232;

// Middleware для обработки JSON
app.use(express.json());

// Подключаем папку `public` для статических файлов (HTML, CSS, JS и т.д.)
app.use(express.static(path.join(\_\_dirname, "public")));

// Функция для скрапинга одной страницы
const scrapeWithPuppeteer = async (url) => {
try {
const browser = await puppeteer.launch({
headless: true,
args: ["--no-sandbox", "--disable-setuid-sandbox"], // Упрощение для серверов без root-доступа
});
const page = await browser.newPage();

    // Устанавливаем заголовки для обхода блокировок
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    // Открываем URL
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    console.log(`Status for ${url}: ${response.status()}`);

    // Ожидаем, пока появятся ключевые элементы (необязательно именно эти)
    await page.waitForSelector("body", { timeout: 30000 });

    // Получаем HTML страницы
    const html = await page.content();
    await browser.close();

    return html;

} catch (error) {
console.error(`Ошибка при обработке ${url}: ${error.message}`);
return null;
}
};

// Функция для парсинга HTML и поиска бэклинков
const parseHtmlAndCheckBacklinks = (html, url, backlinks) => {
const $ = cheerio.load(html);

// Базовые данные, как и раньше
const lang = $("html").attr("lang") || "";
const charset =
$("meta[charset]").attr("charset") ||
$('meta[http-equiv="Content-Type"]')
.attr("content")
?.match(/charset=([\w-]+)/i)?.[1] ||
"";

const title = $("title").text() || "";
const description = $('meta[name="description"]').attr("content") || "";
const keywords = $('meta[name="keywords"]').attr("content") || "";
const h1 = $("h1")
.map((i, el) => $(el).text().trim())
.get()
.join("; ");
const h2 = $("h2")
.map((i, el) => $(el).text().trim())
.get()
.join("; ");
const h3 = $("h3")
.map((i, el) => $(el).text().trim())
.get()
.join("; ");

// Собираем все href из тегов <a>
const pageHrefs = $("a")
.map((i, el) => $(el).attr("href"))
.get()
.filter(Boolean); // убираем undefined

// Определяем, какие из backlinks нашли на странице
const found = [];
const missing = [];

for (const link of backlinks) {
// Ищем точное совпадение href
const isFound = pageHrefs.some((href) => href.includes(link));
if (isFound) {
found.push(link);
} else {
missing.push(link);
}
}

return {
url,
lang,
charset,
title,
description,
keywords,
h1,
h2,
h3,
foundBacklinks: found.join(", "),
missingBacklinks: missing.join(", "),
};
};

// Эндпоинт для запуска парсинга
app.post("/scrape", async (req, res) => {
/\*\*

- Ожидаем в теле запроса что-то вроде:
- {
- "urls": ["http://example.com", "http://example2.com"],
- "backlinks": ["http://site1.com", "http://site2.com"]
- }
  \*/
  const { urls, backlinks } = req.body;

// Проверяем, что urls действительно массив и не пуст
if (!Array.isArray(urls) || urls.length === 0) {
return res
.status(400)
.json({ error: "Invalid request. Provide an array of URLs." });
}

// Проверяем, что backlinks тоже массив (может быть пустым, если нужно)
if (!Array.isArray(backlinks)) {
return res
.status(400)
.json({ error: "Invalid request. Provide an array of backlinks." });
}

const data = [];
const filePath = path.join(\_\_dirname, "web_data.csv");

// Дополняем заголовки CSV
const csvWriter = createCsvWriter({
path: filePath,
header: [
{ id: "url", title: "URL" },
{ id: "lang", title: "Lang" },
{ id: "charset", title: "Charset" },
{ id: "title", title: "Title" },
{ id: "description", title: "Description" },
{ id: "keywords", title: "Keywords" },
{ id: "h1", title: "H1" },
{ id: "h2", title: "H2" },
{ id: "h3", title: "H3" },
{ id: "foundBacklinks", title: "Found Backlinks" },
{ id: "missingBacklinks", title: "Missing Backlinks" },
],
fieldDelimiter: ";",
});

for (const url of urls) {
console.log(`Обработка: ${url}`);
const html = await scrapeWithPuppeteer(url);
if (html) {
// Парсим и ищем бэклинки
const pageData = parseHtmlAndCheckBacklinks(html, url, backlinks);
data.push(pageData);
} else {
// Если контент не получен, добавим пустые поля
data.push({
url,
lang: "",
charset: "",
title: "",
description: "",
keywords: "",
h1: "",
h2: "",
h3: "",
foundBacklinks: "",
missingBacklinks: backlinks.join(", "), // Если страница не загрузилась, всё считаем "не найдено"
});
}
}

// Записываем данные в CSV
await csvWriter.writeRecords(data);
console.log("CSV файл создан");

// Отправляем файл клиенту
res.download(filePath, "web_data.csv", (err) => {
if (err) {
console.error("Ошибка при отправке файла:", err.message);
res.status(500).send("Ошибка при отправке файла.");
} else {
console.log("Файл успешно отправлен.");
}
});
});

// Запуск сервера
app.listen(PORT, () => {
console.log(`Сервер запущен на http://localhost:${PORT}`);
});

//with links

const path = require("path");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3232;

app.use(express.json());
app.use(express.static(path.join(\_\_dirname, "public")));

const scrapeWithPuppeteer = async (url, targetDomain) => {
try {
const browser = await puppeteer.launch({
headless: true,
args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    const lang = $("html").attr("lang") || "";
    const title = $("title").text() || "";
    const description = $('meta[name="description"]').attr("content") || "";
    const h1 = $("h1")
      .map((i, el) => $(el).text().trim())
      .get()
      .join("; ");
    const h2 = $("h2")
      .map((i, el) => $(el).text().trim())
      .get()
      .join("; ");
    const h3 = $("h3")
      .map((i, el) => $(el).text().trim())
      .get()
      .join("; ");

    // Поиск ссылок, относящихся к целевому домену
    const links = [];
    $(`a[href*="${targetDomain}"]`).each((_, el) => {
      const href = $(el).attr("href");
      const context = $(el).text().trim() || "No anchor text";
      links.push({ href, context });
    });

    await browser.close();

    return {
      url,
      lang,
      title,
      description,
      h1,
      h2,
      h3,
      targetDomain,
      linkCount: links.length,
      links,
    };

} catch (error) {
console.error(`Ошибка при обработке ${url}: ${error.message}`);
return null;
}
};

// Эндпоинт для парсинга
app.post("/scrape", async (req, res) => {
const { urls, targetDomain } = req.body;

if (!Array.isArray(urls) || urls.length === 0 || !targetDomain) {
return res
.status(400)
.json({ error: "Invalid request. Provide URLs and a target domain." });
}

const results = [];
const csvFilePath = path.join(\_\_dirname, "web_data.csv");

const csvWriter = createCsvWriter({
path: csvFilePath,
header: [
{ id: "url", title: "URL" },
{ id: "lang", title: "Lang" },
{ id: "title", title: "Title" },
{ id: "description", title: "Description" },
{ id: "h1", title: "H1" },
{ id: "h2", title: "H2" },
{ id: "h3", title: "H3" },
{ id: "targetDomain", title: "Target Domain" },
{ id: "linkCount", title: "Link Count" },
{ id: "links", title: "Links (Context and Href)" },
],
});

for (const url of urls) {
console.log(`Processing: ${url}`);
const pageData = await scrapeWithPuppeteer(url, targetDomain);

    if (pageData) {
      results.push({
        ...pageData,
        links: pageData.links
          .map((link) => `${link.context}: ${link.href}`)
          .join(" | "),
      });
    }

}

await csvWriter.writeRecords(results);
console.log("CSV file created.");

res.download(csvFilePath, "web_data.csv", (err) => {
if (err) {
console.error("Error while sending file:", err.message);
res.status(500).send("File download failed.");
} else {
console.log("File sent successfully.");
}
});
});

app.listen(PORT, () => {
console.log(`Server running at http://localhost:${PORT}`);
});
