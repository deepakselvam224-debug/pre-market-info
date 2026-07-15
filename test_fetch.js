const url = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent('https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms');

fetch(url)
  .then(res => res.json())
  .then(data => {
    console.log("Status:", data.status);
    if (data.items && data.items.length > 0) {
      console.log("First item keys:", Object.keys(data.items[0]));
      console.log("First item Title:", data.items[0].title);
      console.log("First item Description:", data.items[0].description ? data.items[0].description.substring(0, 100) : "none");
      console.log("First item Content:", data.items[0].content ? data.items[0].content.substring(0, 100) : "none");
    } else {
      console.log("No items");
    }
  })
  .catch(err => console.error(err));
