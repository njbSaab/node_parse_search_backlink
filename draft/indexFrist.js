const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

// Список ссылок для скрапинга
const urls = [
  "https://tablo.com/genres/classics/discussions/9620",
  "https://git.metabarcoding.org/MetabarcodingSchool/biodiversity-metrics/-/issues/433",
  "https://www.ictdemy.com/csharp/csharp-forum/keo-3-4-t-c-th-gi-kinh-nghi-m-ca-c-c-keo-ch-p-3-4-6340ef517b28b#goto12614",
  "https://guides.co/g/hiu-v-hiu-s-v-ngha-ca-n-trong-bng/318388",
];

// Конфигурация для CSV
const csvWriter = createCsvWriter({
  path: "web_data.csv",
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
  ],
  fieldDelimiter: ";",
});

// Функция для загрузки страницы через Puppeteer
const scrapeWithPuppeteer = async (url) => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Установка User-Agent
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-User": "?1",
    });

    // Переход на страницу
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Извлечение HTML содержимого
    const html = await page.content();

    // Закрытие браузера
    await browser.close();

    return html; // Возвращаем HTML страницы
  } catch (error) {
    console.error(`Ошибка при обработке ${url}: ${error.message}`);
    return null;
  }
};

// Функция для парсинга данных из HTML
const parseHtml = (html, url) => {
  const $ = cheerio.load(html);

  // Извлечение данных
  const lang = $("html").attr("lang") || "Не указан";
  const charset = $("meta[charset]").attr("charset") || "Не указан";
  const title = $("title").text() || "Нет заголовка";
  const description =
    $('meta[name="description"]').attr("content") || "Нет описания";
  const keywords =
    $('meta[name="keywords"]').attr("content") || "Нет ключевых слов";
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

  return { url, lang, charset, title, description, keywords, h1, h2, h3 };
};

// Основная функция
const main = async () => {
  const data = [];
  for (const url of urls) {
    console.log(`Обработка: ${url}`);
    const html = await scrapeWithPuppeteer(url);
    if (html) {
      const pageData = parseHtml(html, url);
      data.push(pageData);
    } else {
      data.push({
        url,
        lang: "Ошибка",
        charset: "Ошибка",
        title: "Ошибка",
        description: "Ошибка",
        keywords: "Ошибка",
        h1: "",
        h2: "",
        h3: "",
      });
    }
  }

  // Запись данных в CSV
  await csvWriter.writeRecords(data);
  console.log("Данные успешно сохранены в 'web_data.csv'");
};

main();
