const fs = require('fs');

async function testFeeds() {
  const eqFeeds = [
    'https://www.moneycontrol.com/rss/marketnews.xml',
    'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms'
  ];
  const gasFeeds = [
    'https://finance.yahoo.com/news/category-energy/rss',
    'https://news.google.com/rss/search?q=Natural+Gas+energy+colder+storage+lng+when:2d&hl=en-US&gl=US&ceid=US:en'
  ];

  const results = {};

  for (let url of [...eqFeeds, ...gasFeeds]) {
    try {
      const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      const data = await res.json();
      results[url] = {
        status: data.status,
        feedTitle: data.feed ? data.feed.title : 'none',
        itemsCount: data.items ? data.items.length : 0,
        sampleItem: data.items && data.items.length > 0 ? {
          title: data.items[0].title,
          pubDate: data.items[0].pubDate,
          description: data.items[0].description,
          content: data.items[0].content
        } : null
      };
    } catch (e) {
      results[url] = { error: e.message };
    }
  }

  fs.writeFileSync('feeds_debug.json', JSON.stringify(results, null, 2));
  console.log("Wrote feeds_debug.json");
}

testFeeds();
