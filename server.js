const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const puppeteer = require('puppeteer');
const fs = require('fs');

app.use(jsonParser);
app.use(cors());

app.get('/', (req, res) => {
  res.send('from server');
});


app.post('/api/google-search', async (req, res) => {
  try {
    const { i: query }  = req.body;
    console.log(query);

    // Use Puppeteer to perform the Google search
    const searchResults = await performGoogleSearch(query);
    const ContentResults = await scrapeUrls(searchResults)
console.log(searchResults, ContentResults);
    // Send the search results back to the client
    res.json({ searchResults, ContentResults });
  } catch (error) {
    console.error('Error occurred during the search:', error);
    res.status(500).json({ error: 'An error occurred during the search' });
  }
});

// Function to perform the Google search using Puppeteer
const performGoogleSearch = async (query) => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: null,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36'}); // Set headless to false to see the browser actions
  const page = await browser.newPage();

  try {
    const url = `https://www.google.com/search?q=${query}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' , timeout: 30000});

    // Wait for the search results to load
    await page.waitForSelector('div.g', { timeout: 5000 });

    // Extract the search results
    const searchResults = await page.evaluate(() => {
      const results = document.querySelectorAll('div.g');

      const urls = Array.from(results).slice(0, 5).map((result) => {
        const link = result.querySelector('a');
        return link.href;
      })
      return urls;
    });


    return searchResults;
  } catch (error) {
    console.error('Error during Google search:', error);
    return [];
  } finally {
    await browser.close();
  }
};


const scrapeUrls = async (urls) => {
  const concurrencyLimit = 5; // Adjust the concurrency limit as needed

  try {
    let allContent = '';
    const scrapedData = [];
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: null,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
    });

    // Split the URLs into smaller chunks based on the concurrency limit
    const urlChunks = [];
    for (let i = 0; i < urls.length; i += concurrencyLimit) {
      urlChunks.push(urls.slice(i, i + concurrencyLimit));
    }

    const processChunk = async (chunk) => {
      const page = await browser.newPage();

      for (const url of chunk) {
        const urlData = {
          url,
          content: '',
        };

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });

          // Wait for the element that contains the main content to appear
          await page.waitForSelector('main', { timeout: 30000 });

          const bodyText = await page.evaluate(() => {
            const bodyElements = document.querySelectorAll('main'); // Adjust this selector as needed
            return Array.from(bodyElements).map((element) => element.innerText).join('\n');
          });
          urlData.content = bodyText;

          // Accumulate content for saving to a single file
          allContent += `URL: ${url}\n${bodyText}\n\n`;
        } catch (error) {
          console.error(`Error occurred while scraping ${url}:`, error);
        }
        scrapedData.push(urlData);
      }

      await page.close();
    };

    // Run the chunks concurrently
    await Promise.all(urlChunks.map(processChunk));

    // Write all the accumulated content to a single text file
    const filename = `scraped_all_${Date.now()}.txt`;
    fs.writeFileSync(filename, allContent);
    console.log(`All scraped data has been saved to ${filename}`);

    await browser.close();

    return scrapedData;
  } catch (error) {
    console.error('Error during scraping:', error);
    return [];
  }
};



const port = 3001;
app.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
});
