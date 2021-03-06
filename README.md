# act-google-search
Apify actor for extracting google search data.

This actor opens a google search page for the specified query and extracts all the results.

**INPUT**

Input is a JSON object with the following properties:

```javascript
{
    "query": SEARCH_QUERY, 
    "maxPages": MAX_PAGE_COUNT,
    "linkTypes": ALLOWED_LINK_TYPES,
    "puppeteerOptions": LAUNCH_PUPPETEER_OPTIONS
}
```

__query__ is the only required attribute. This is the google search query.  
__maxPages__ defines how many search pages will be crawler, default is 1.  
__linkTypes__ specifies which types of links will be allowed, it is an array containing any of __["organic", "ad", "snackpack"]__. All of them are allowed by default.  
__puppeteerOptions__ is a PuppeteerCrawler parameter [launchPuppeteerOptions](https://www.apify.com/docs/sdk/apify-runtime-js/latest#LaunchPuppeteerOptions).
