import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio"; // Именованный импорт
import { createObjectCsvWriter as createCsvWriter } from "csv-writer";
import express from "express";
import { franc } from "franc"; // ES модуль

const app = express();
const PORT = process.env.PORT || 3232;

app.use(express.json());
app.use(express.static(path.join(path.resolve(), "public")));

// Функция для определения языка
const detectLanguage = (text) => {
  if (!text.trim()) return "";
  const langCode = franc(text);
  return langCode === "und" ? "" : langCode;
};

// Функция для скрапинга
const scrapeWithPuppeteer = async (url) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    console.log(`Status: ${response.status()}`);
    console.log(`Headers:`, response.headers());

    await page.waitForSelector("h1, h2, h3, title, meta", { timeout: 30000 });

    const html = await page.content();
    await browser.close();

    return html;
  } catch (error) {
    console.error(`Ошибка при обработке ${url}: ${error.message}`);
    return null;
  }
};

// Функция для парсинга HTML
const parseHtml = async (html, url) => {
  const $ = cheerio.load(html);

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

  const titleLang = detectLanguage(title);
  const descriptionLang = detectLanguage(description);
  const h1Lang = detectLanguage(h1);
  const h2Lang = detectLanguage(h2);
  const h3Lang = detectLanguage(h3);

  return {
    url,
    lang,
    charset,
    title,
    titleLang,
    description,
    descriptionLang,
    keywords,
    h1,
    h1Lang,
    h2,
    h2Lang,
    h3,
    h3Lang,
  };
};

// Эндпоинт для запуска парсинга
app.post("/scrape", async (req, res) => {
  const urls = req.body.urls;

  if (!Array.isArray(urls) || urls.length === 0) {
    return res
      .status(400)
      .json({ error: "Invalid request. Provide an array of URLs." });
  }

  const data = [];
  const filePath = path.join(path.resolve(), "web_data.csv");

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: "url", title: "URL" },
      { id: "lang", title: "Lang" },
      { id: "charset", title: "Charset" },
      { id: "title", title: "Title" },
      { id: "titleLang", title: "Title Lang" },
      { id: "description", title: "Description" },
      { id: "descriptionLang", title: "Description Lang" },
      { id: "keywords", title: "Keywords" },
      { id: "h1", title: "H1" },
      { id: "h1Lang", title: "H1 Lang" },
      { id: "h2", title: "H2" },
      { id: "h2Lang", title: "H2 Lang" },
      { id: "h3", title: "H3" },
      { id: "h3Lang", title: "H3 Lang" },
    ],
    fieldDelimiter: ";",
  });

  for (const url of urls) {
    console.log(`Обработка: ${url}`);
    const html = await scrapeWithPuppeteer(url);
    if (html) {
      const pageData = await parseHtml(html, url);
      data.push(pageData);
    } else {
      data.push({
        url,
        lang: "",
        charset: "",
        title: "",
        titleLang: "",
        description: "",
        descriptionLang: "",
        keywords: "",
        h1: "",
        h1Lang: "",
        h2: "",
        h2Lang: "",
        h3: "",
        h3Lang: "",
      });
    }
  }

  await csvWriter.writeRecords(data);
  console.log("CSV файл создан");

  res.download(filePath, "web_data.csv", (err) => {
    if (err) {
      console.error("Ошибка при отправке файла:", err.message);
      res.status(500).send("Ошибка при отправке файла.");
    } else {
      console.log("Файл успешно отправлен.");
    }
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
