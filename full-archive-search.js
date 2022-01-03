const Twit = require('twit');
const TreeModel = require('tree-model');
const arrayToTree = require('array-to-tree');

const MS = {
    DAY: 24 * 60 * 60 * 1000,
};

const userAgent = process.env.USER_AGENT || 'andytuba app';
const token = process.env.BEARER_TOKEN;
if (!token) throw new Error("No bearer token");

const username = process.env.TWITTER_CURUSER_USERNAME.toLowerCase();
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
        count: 100,
        result_type: 'recent',

    }

    console.debug('getRequest', endpointPath, params);
    const res = await T.get(endpointPath, params);
    debugger;
    console.debug('getRequest response', res);
    if (!res || res.resp.statusCode !== 200) {
        console.error(res);
        throw new Error('Unsuccessful request');
    }
    return res.data;
}

function collateThreads(statuses) {
    const ROOT = Symbol("ROOT");
    const nodes = statuses.map(model => ({
        model,
        id: model.id_str,
        parent_id: model.in_reply_to_status_id_str || ROOT,
    }));

    const fromArray = arrayToTree(nodes);
    console.debug('fromArray'); console.dir(fromArray);
    const tree = new TreeModel().parse(fromArray);
    console.log('tree');  console.dir(tree);

    const tailsOfMyThreads = tree.all(node => {
        console.debug(`- tweet:`);
        console.dir(node);
        // Requirement: the tail of a thread
        if (!node.children) {
            console.error('  !- has children, not a tail');
            return false;
        }
        
        const ancestors = node.getPath();
        const root = ancestors.shift();
        // Requirement: I started this thread. (Prereq: these tweets are all authored by me.)
        // Requirement: this thread didn't start too long ago. (Prereq: these tweets are all authored recently.)
        if (root.model.in_reply_to_status_id_str) {
            console.error('  !- root was actually a reply');
            return false;
        }
        // Requirement: I am replying to myself and only myself in this thread.
        if (ancestors.some(ancestor => ancestor.model.in_reply_to_user_id_str !== root.model.user.id_str)) {
            console.error('  !- some ancestor tweet was replying to someone else, actually', ancestor.model.text);
            return false;
        };

        return true;
    });

    const threadsMaybeOverlap = tailsOfMyThreads.map(tail => tail.getPath());
    // TODO: merge overlaps, sort by time, dedupe
    return threadsMaybeOverlap;
}




(async function main() {
    try {
        const searchResults = await getRecentTweets();
        console.log('getRequest data');
        console.dir(searchResults, {
            depth: null
        });

        const threads = collateThreads(searchResults.statuses);

        console.log('\n======= THREADS ======= \n\n');
        for (const thread of threads) {
            console.dir(thread.map(x => ({
                id: x.model.id_str,
                created_at: x.model.created_at,
                text: x.model.text,
            })));
            console.log('\n======= ====== ======= \n\n');
        }
        // TODO: unroll threads into posts
        // TODO: dump posts to files
        // TODO: push post files to repo


    } catch (e) {
        console.error('getRequest failed');
        console.error(e);
        process.exit(-1);
    }

    process.exit();
})();
