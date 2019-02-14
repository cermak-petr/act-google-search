const Apify = require('apify')

/* global $ */

async function getAttribute (element, attr) {
  try {
    const prop = await element.getProperty(attr)
    return (await prop.jsonValue()).trim()
  } catch (e) { return null }
}

Apify.main(async () => {
  const input = await Apify.getValue('INPUT')

  console.log('opening request queue')
  const requestQueue = await Apify.openRequestQueue()

  if (!input.queries && !input.startUrls) {
    throw new Error('Missinq "queries" or "startUrls" attribute in INPUT!')
  }

  const baseUrl = 'https://www.google.com/search?q='
  const startUrls = (input.startUrls || input.queries.map(q => baseUrl + encodeURIComponent(q)))
    .map((url) => {
      const req = url.url ? url : { url }
      req.userData = { label: 'start', page: 1 }
      return req
    })

  const requestList = new Apify.RequestList({
    sources: startUrls,
    persistStateKey: 'startUrls'
  })

  await requestList.initialize()

  const gotoFunction = async ({ page, request }) => {
    await page.setRequestInterception(true)
    page.on('request', (intercepted) => {
      const type = intercepted.resourceType()
      if (type === 'image' || type === 'stylesheet') { intercepted.abort() } else { intercepted.continue() }
    })
    console.log(`going to: ${request.url}`)
    await Apify.utils.puppeteer.hideWebDriver(page)
    return page.goto(request.url, { timeout: 200000 })
  }

  function pageFunction (inputs, userData) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now()
      const result = []

      const extractData = () => {
        // timeout after 10 seconds
        if (Date.now() - startedAt > 10000) {
          resolve('Timed out before #my_element was loaded')
          return
        }

        // if elements with class .rc still haven't been loaded, wait a little more
        if ($('.srg .g').length === 0) {
          setTimeout(extractData, 500)
          return
        }

        if (!inputs.linkTypes || inputs.linkTypes.indexOf('organic') > -1) {
          $('.g .rc').each(function parseOrganic () {
            result.push({
              name: $(this).find('h3').text(),
              link: $(this).find('.r a').attr('href'),
              displayed_link: $(this).find('cite').text(),
              text: $(this).find('.s .st').text(),
              type: 'organic',
              page: userData.page
            })
          })
        }

        if (!inputs.linkTypes || inputs.linkTypes.indexOf('ad') > -1) {
          $('.ads-ad').each(function parseAds () {
            result.push({
              name: $(this).find('h3').text(),
              link: $(this).find('h3 a').attr('href').match(/(.*)&adurl=(.*)/)[2],
              displayed_link: $(this).find('cite').text(),
              text: $(this).find('.ellip').text(),
              type: 'ad',
              page: userData.page
            })
          })
        }

        if (!inputs.linkTypes || inputs.linkTypes.indexOf('snackpack') > -1) {
          $('._gt').each(function parseSnackPack () {
            const item = {
              name: $(this).find('._rl').text(),
              link: $(this).find('h3 a').attr('href'),
              type: 'snackpack',
              star_rating: $(this).find('._PXi').text(),
              website: $(this).find('.rllt__action-button:eq(0)').attr('href'),
              address: $(this).find('.rllt__details div:eq(2) span').text(),
              hours: $(this).find('.rllt__details .rllt__wrapped').text(),
              page: userData.page
            }
            const reviewCount = $(this).find('g-review-stars').parent().contents()
              .filter(() => this.nodeType == 3)
              .text()

            if (reviewCount !== '') {
              const match = reviewCount.match(/\s\((\d+)\)\s·/)
              if (match && match.length === 2) {
                item.review_count = match[1]
              }
            }
            const contact = $(this).find('.rllt__details div:eq(2)').text()
            if (contact !== '') {
              const match1 = contact.match(/·\s(.*)/)
              if (match1 && match1.length === 2) {
                item.phone_number = match1[1]
              }
            }
            const business_category = $(this).find('.rllt__details div:eq(0)').text()
            if (business_category !== '') {
              const match2 = business_category.match(/·\s(.*)/)
              if (match2 && match2.length === 2) {
                item.business_category = match2[1]
              }
            }

            result.push(item)
          })
        }

        resolve(result)
      }

      extractData()
    })
  }

  const handlePageFunction = async ({ page, request }) => {
    console.log(`page open: ${request.userData.label} - ${request.url}`)

    page.on('console', (msg) => {
      for (let i = 0; i < msg.args.length; ++i) {
        console.log(`${i}: ${msg.args[i]}`)
      }
    })

    await page.waitForSelector('body', { timeout: 60000 })

    await Apify.utils.puppeteer.injectJQuery(page)

    if (input.maxPages && input.maxPages > 1) {
      const links = await page.$$('td a.fl')

      links.forEach(async (link) => {
        const href = await getAttribute(link, 'href')
        const pgNum = Number(await getAttribute(link, 'text'))
        if (href && pgNum <= input.maxPages) {
          await requestQueue.addRequest(new Apify.Request({
            url: href,
            uniqueKey: `page_${pgNum}`,
            userData: { label: 'page', page: pgNum }
          }))
        }
      })
    }

    const result = await page.evaluate(pageFunction, input, request.userData)
    if (result) { await Apify.pushData(result) }
  }

  const crawler = new Apify.PuppeteerCrawler({
    requestList,
    requestQueue,
    handlePageFunction,
    handleFailedRequestFunction: async ({ request }) => {
      console.log(`Request ${request.url} failed 4 times`)
    },
    maxRequestRetries: 1,
    maxConcurrency: input.parallels || 1,
    handlePageTimeoutSecs: 999999,
    launchPuppeteerOptions: input.puppeteerOptions || {},
    gotoFunction
  })

  console.log('running the crawler')
  await crawler.run()
})
