const express = require('express');
const app = express();
const puppeteer = require('puppeteer');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 100, checkperiod: 120 }); // TTL set to 60 seconds (cache expires after 60 seconds):
//////// explaining the params:
// the standard ttl as number in seconds for every generated cache element. 0 = unlimited.
// checkperiod: (default: 600) The period in seconds, as a number, used for the automatic delete check interval. 0 = no periodic check.


const PORT = 3000;

app.get('/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
 // Check if the data is present in the cache
 const cachedData = cache.get(query);
 if (cachedData) {
   console.log('Data was cached,  retrieved from cache.');
   res.json(cachedData);
 }
 else {
  const start = performance.now();
  const searchResults = await googleSearch(query);
  const top5Results = searchResults.slice(0, 5);
   const scrapedData = await scrapeTopResults(top5Results);
   
  // Store the scraped data in the cache
   cache.set(query, scrapedData)
     ;
  const end = performance.now();
  const totalTime = end - start;
  console.log(scrapedData)
  console.log('Total Time (ms):', totalTime);
  res.json(scrapedData);
}
  } catch (error) {
    res.status(500).json({ error: 'An error occurred' });
  }
});

async function googleSearch(query) {
  const browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          defaultViewport: null,
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
        });
  const page = await browser.newPage();

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  await page.goto(searchUrl);

  // Wait for the search results to load (I adjusted the selector (P) depending on the Google search page layouts I checked)
  await page.waitForSelector('h3');

  const searchResults = await page.evaluate(() => {
    const results = [];
    const searchElements = document.querySelectorAll('h3');
    searchElements.forEach((element) => {
      results.push(element.parentElement.href);
    });
    return results;
  });

  await browser.close();
  return searchResults;
}


async function scrapeTopResults(topResults) {
  const scrapedData = [];

  for (const result of topResults) {
    try {
        const browser = await puppeteer.launch({
          //headless:new >> modern headless puppeteer
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: null,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
      });
      const page = await browser.newPage();
      await page.goto(result);

      const contentText = await page.evaluate(() => {
        // Sample code to extract content text from the page (p selector for paragraphs hwowever some modern sites go with main and article selectors, but basically they end up with paragraphs)
        const paragraphs = Array.from(document.querySelectorAll('p'));
        return paragraphs.map(p => p.innerText).join('\n');
      });

      scrapedData.push({ url: result, content: contentText });

      await browser.close();
    } catch (error) {
      // Handle errors gracefully if any of the pages fail to load or scrape.
      console.error('Error scraping page:', error);
    }
  }

  return scrapedData;
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
