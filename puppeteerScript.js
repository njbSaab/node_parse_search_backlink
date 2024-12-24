const puppeteer = require("puppeteer");

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    const response = await page.goto("https://example.com", {
      waitUntil: "domcontentloaded",
    });
    console.log("Status:", response.status());
    console.log("Headers:", response.headers());
    await browser.close();
  } catch (err) {
    console.error("Ошибка Puppeteer:", err.message);
  }
})();
