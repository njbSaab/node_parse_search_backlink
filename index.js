const path = require("path");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3232;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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

    // Определяем язык страницы
    const lang = $("html").attr("lang") || "";

    // Сбор ссылок, относящихся к целевому домену
    const links = {};
    let totalLinks = 0;

    $(`a[href*="${targetDomain}"]`).each((_, el) => {
      const anchor = $(el).text().trim() || "No anchor text";
      const href = $(el).attr("href");
      if (!links[anchor]) {
        links[anchor] = [];
      }
      links[anchor].push(href);
      totalLinks++;
    });

    await browser.close();

    return {
      url,
      lang,
      links,
      linkCount: totalLinks,
    };
  } catch (error) {
    console.error(`Ошибка при обработке ${url}: ${error.message}`);
    return null;
  }
};

app.post("/scrape", async (req, res) => {
  const { urls, targetDomain } = req.body;

  if (!Array.isArray(urls) || urls.length === 0 || !targetDomain) {
    return res
      .status(400)
      .json({ error: "Invalid request. Provide URLs and a target domain." });
  }

  const results = [];
  const dynamicHeaders = new Set();

  for (const url of urls) {
    console.log(`Processing: ${url}`);
    const pageData = await scrapeWithPuppeteer(url, targetDomain);
    if (pageData) {
      const row = {
        url: pageData.url,
        lang: pageData.lang,
        linkCount: pageData.linkCount,
        "URL search or find": targetDomain, // Новая колонка с доменом для поиска
      };
      for (const [anchor, hrefs] of Object.entries(pageData.links)) {
        row[anchor] = hrefs.join(" | ");
        dynamicHeaders.add(anchor);
      }
      results.push(row);
    }
  }

  const csvHeaders = [
    { id: "url", title: "URL" },
    { id: "lang", title: "Lang" },
    { id: "URL search or find", title: "URL search or find" },
    { id: "linkCount", title: "Link Count" },
    ...Array.from(dynamicHeaders).map((header) => ({
      id: header,
      title: header,
    })),
  ];

  const csvFilePath = path.join(__dirname, "web_data.csv");
  const csvWriter = createCsvWriter({ path: csvFilePath, header: csvHeaders });

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
