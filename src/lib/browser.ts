import url from "url";
import fs from "fs-extra";
import puppeteer from "puppeteer";
import tempy from "tempy";

let browser: puppeteer.Browser;
let tempEmptyHtmlFile: string;

export async function createBrowserContext() {
  if (!browser) {
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--enable-local-file-accesses'
      ]
    });

    tempEmptyHtmlFile = await tempy.write('', { extension: 'html' });
    process.on('exit', () => fs.removeSync(tempEmptyHtmlFile));
  }

  const context = await browser.newPage();
  await context.goto(url.pathToFileURL(tempEmptyHtmlFile).toString());
  return context;
}
