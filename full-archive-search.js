const Twit = require('twit');

const MS = {
    DAY: 24 * 60 * 60 * 1000,
};

const userAgent = process.env.USER_AGENT || 'andytuba app';
const token = process.env.BEARER_TOKEN;
if (!token) throw new Error("No bearer token");

const username = process.env.TWITTER_CURUSER_USERNAME;
var T = new Twit({
    consumer_key:         process.env.TWITTER_CONSUMER_KEY,
    consumer_secret:      process.env.TWITTER_CONSUMER_SECRET,
    access_token:         process.env.TWITTER_CURUSER_ACCESS_TOKEN,
    access_token_secret:  process.env.TWITTER_CURUSER_ACCESS_SECRET,
});


async function getRecentTweets() {
    const date = new Date(new Date().getTime() - (2 * MS.DAY));
    const endpointPath = 'search/tweets';
    const params = {
        'q': `from:${username} -is:retweet since:${date.toISOString().split('T')[0]}`,
    }

    console.debug('getRequest', endpointPath, params);
    const res = await T.get(endpointPath, params);
    console.debug('getRequest response', res);
    if (!res || res.resp.statusCode !== 200) {
        console.error(res);
        throw new Error('Unsuccessful request');
    }
    return res.data;
}

(async () => {
    let searchResults; 
    try {
        searchResults = await getRecentTweets();
        console.log('getRequest data');
        console.dir(searchResults, {
            depth: null
        });

    } catch (e) {
        console.error('getRequest failed');
        console.error(e);
        process.exit(-1);
    }
    process.exit();
})();
