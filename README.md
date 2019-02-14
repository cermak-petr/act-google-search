# act-google-search
Apify actor for extracting google search data.

This actor opens a google search page for the specified query and extracts all the results.

## INPUT

Input is a JSON object with the following properties:


```json
{
    "queries": ["your query"],
    "maxPages": 1,
    "linkTypes": ["organic", "ad", "snackpack"],
    "puppeteerOptions": {
        // ...
    }
}
```

See: `apify_storage/key_value_stores/default/INPUT.json`

* `queries`: is the only required attribute. This is the google search query.
* `maxPages`: defines how many search pages will be crawler, default is 1.
* `linkTypes`: specifies which types of links will be allowed, it is an array containing any of __["organic", "ad", "snackpack"]__. All of them are allowed by default.
* `puppeteerOptions`: is a PuppeteerCrawler parameter [launchPuppeteerOptions](https://www.apify.com/docs/sdk/apify-runtime-js/latest#LaunchPuppeteerOptions).

Also, instead of `queries` you may provide a `startUrls` with direct URLs to Google Search results.