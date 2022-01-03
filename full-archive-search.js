const Twit = require('twit');
const TreeModel = require('tree-model');
const arrayToTree = require('array-to-tree');

const MS = {
    DAY: 24 * 60 * 60 * 1000,
};
const ROOT = Symbol("ROOT");

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
    const endpointPath = 'statuses/user_timeline';
    const params = {
        screen_name: username,
        
        include_rts: false,
        'q': `from:${username} -is:retweet since:${date.toISOString().split('T')[0]}`,
        count: 100,
        result_type: 'recent',

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

function collateThreads(statuses) {
    const nodes = statuses.map(status => ({
        status,
        id: status.id_str,
        parent_id: status.in_reply_to_status_id_str || ROOT,
    }));

    const fromArray = arrayToTree(nodes);
    const tree = new TreeModel().parse({
        id: ROOT,
        children: fromArray,
    });
    console.log('tree');
    tree.all(node => {
        console.dir(node);
    });


    const tailsOfMyThreads = tree.all({ strategy: 'post' }, node => {
        console.debug(`- tweet:`);
        console.dir(node);
        // Requirement: the tail of a thread
        if (node.model.id === ROOT) { return; }
        if (!node.children) {
            console.error('  !- has children, not a tail');
            return false;
        }
        
        const ancestors = node.getPath();
        if (ancestors[0].model.id === ROOT) ancestors.shift(); // dump the ROOT
        const root = ancestors.shift();
        // Requirement: I started this thread. (Prereq: these tweets are all authored by me.)
        // Requirement: this thread didn't start too long ago. (Prereq: these tweets are all authored recently.)
        if (root.model.in_reply_to_status_id_str) {
            console.error('  !- root was actually a reply');
            return false;
        }
        // Requirement: I am replying to myself and only myself in this thread.
        // TODO: fix - just 
        if (ancestors.some(ancestor => ancestor.model.status.in_reply_to_screen_name.toLowerCase() !== username.toLowerCase())) {
            console.error('  !- some ancestor tweet was replying to someone else, actually', ancestor.model.status.text);
            return false;
        };

        return true;
    });

    const threadsMaybeOverlap = tailsOfMyThreads
        .map(tail => tail.getPath().slice(1))
        .filter(nodes => nodes.length >= 3);
    // TODO: merge overlaps, sort by time, dedupe
    return threadsMaybeOverlap;
}




(async function main() {
    try {
        const statuses = await getRecentTweets();
        console.log('getRequest data');
        console.dir(statuses, {
            depth: null
        });

        const threads = collateThreads(statuses);

        console.log('\n======= THREADS ======= \n\n');
        for (const thread of threads) {
            for (const node of thread) {
                console.log(`
${node.model.status.text}
[${node.model.status.id_str} @ ${node.model.status.created_at}]
`);
            }
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
