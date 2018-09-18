const Apify = require('apify');
const request = require('request-promise');

async function saveScreenshot(name, page){
    try{
        const screenshotBuffer = await page.screenshot();
        await Apify.setValue(name + '.png', screenshotBuffer, { contentType: 'image/png' });
        const html = await page.evaluate(() => document.body.innerHTML);
        await Apify.setValue(name + '.html', html, { contentType: 'text/html' });
    }
    catch(e){console.log('unable to save screenshot: ' + name);}
}

async function getText(element){
    try{
        const prop = await element.getProperty('textContent');
        return (await prop.jsonValue()).trim();
    }
    catch(e){return null;}
}

async function getAttribute(element, attr){
    try{
        const prop = await element.getProperty(attr);
        return (await prop.jsonValue()).trim();
    }
    catch(e){return null;}
}

Apify.main(async () => {
    const input = await Apify.getValue('INPUT');
    
    console.log('opening request queue');
    const requestQueue = await Apify.openRequestQueue();
    if(!input.query){throw new Error('Missinq "query" attribute in INPUT!');}
    
    const baseUrl = 'https://www.google.com/search?q=';
    const startUrl = baseUrl + encodeURIComponent(input.query);
    
	await requestQueue.addRequest(new Apify.Request({ 
    	url: startUrl,
    	uniqueKey: startUrl,
    	userData: {label: 'START', depth: 1, referrer: null}
    }));
	
	const gotoFunction = async ({ page, request }) => {
    	await page.setRequestInterception(true)
    	page.on('request', intercepted => {
    	    const type = intercepted.resourceType();
    		if(type === 'image' || type === 'stylesheet'){intercepted.abort();}
    		else{intercepted.continue();}
    	})
    	console.log('going to: ' + request.url);
    	await Apify.utils.puppeteer.hideWebDriver(page);
    	return await page.goto(request.url, {timeout: 200000});
    };
    
    function pageFunction(context) {return new Promise((resolve, reject) => {

        var startedAt = Date.now();
        var result = [];
    
        var extractData = function() {
            // timeout after 10 seconds
            if( Date.now() - startedAt > 10000 ) {
                resolve("Timed out before #my_element was loaded");
                return;
            }
    
            // if elements with class .rc still haven't been loaded, wait a little more
            if( $('.srg .g').length === 0 ) {
                setTimeout(extractData, 500);
                return;
            }
            
            $(".g .rc").each(function() {
                result.push({
                    name: $(this).find("h3").text(),
                    link: $(this).find(".r a").attr("href"),
                    displayed_link: $(this).find("cite").text(),
                    text: $(this).find(".s .st").text(),
                    type: "organic"
                });
            });
            
            $('.ads-ad').each(function() {
                result.push({
                    name: $(this).find("h3").text(),
                    link: $(this).find("h3 a").attr("href").match(/(.*)&adurl=(.*)/)[2],
                    displayed_link: $(this).find("cite").text(),
                    text: $(this).find(".ellip").text(),
                    type: "ad"
                });
            });
            
            $('._gt').each(function() {
                var item ={
                    name: $(this).find("._rl").text(),
                    link: $(this).find("h3 a").attr("href"),
                    type: "snackpack",
                    star_rating: $(this).find("._PXi").text(),
                    website: $(this).find('.rllt__action-button:eq(0)').attr("href"),
                    address: $(this).find('.rllt__details div:eq(2) span').text(),
                    hours: $(this).find('.rllt__details .rllt__wrapped').text()
                };
                var review_count = $(this).find('g-review-stars').parent().contents().filter(function(){
                    return this.nodeType == 3;
                }).text();
                if (review_count !== "") {
                    var match = review_count.match(/\s\((\d+)\)\s·/);
                    if (match && match.length === 2) {
                        item.review_count = match[1];
                    }
                }
                var contact = $(this).find('.rllt__details div:eq(2)').text();
                if (contact !== "") {
                    var match1 = contact.match(/·\s(.*)/);
                    if (match1 && match1.length === 2) {
                        item.phone_number = match1[1];
                    }
                }
                var business_category = $(this).find('.rllt__details div:eq(0)').text();
                if (business_category !== "") {
                    var match2 = business_category.match(/·\s(.*)/);
                    if (match2 && match2.length === 2) {
                        item.business_category = match2[1];
                    }
                }
                
                result.push(item);
            });
    
            resolve(result);
        };
    
        extractData();
    });}
    
    const handlePageFunction = async ({ page, request }) => {
        console.log('page open: ' + request.userData.label + ' - ' + request.url);
            
        page.on('console', msg => {
            for(let i = 0; i < msg.args.length; ++i){
                console.log(`${i}: ${msg.args[i]}`);
            }
        });
        
        await page.waitForSelector('body', {timeout: 60000});
        
        await Apify.utils.puppeteer.injectJQuery(page);
        
        const result = await page.evaluate(pageFunction, request.userData);
        if(result){await Apify.pushData(result);}
    };

    const crawler = new Apify.PuppeteerCrawler({
        requestQueue,
        handlePageFunction,
        handleFailedRequestFunction: async ({ request }) => {
            console.log(`Request ${request.url} failed 4 times`);
		},
		maxRequestRetries: 1,
		maxConcurrency: input.parallels || 1,
		pageOpsTimeoutMillis: 999999,
		launchPuppeteerOptions: {
		    //liveView: true,
            useApifyProxy: true,
            //apifyProxyGroups: ['BUYPROXIES94952'],
            apifyProxySession: 'my_session_1',
        },
		//gotoFunction,
		//launchPuppeteerOptions:{useChrome:true}
    });

	console.log('running the crawler')
    await crawler.run();
});
