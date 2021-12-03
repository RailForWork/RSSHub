const cheerio = require('cheerio');
const got = require('@/utils/got');

module.exports = async (ctx) => {
    const url = `http://rail.ally.net.cn/html/hyzix/chengguijiaotong/`;

    const response = await got.get(url);
    const $ = cheerio.load(response.data);
    const posts = $('.hynewsO').get();

    async function getFullText(url) {
        const response = await got.get(url);
        const $ = cheerio.load(response.data, { decodeEntities: false });
        let html = '';
        const detail = $('div.content_all').eq(1);
        detail.find('img').get().forEach((img) => {
            img = $(img);
            const oldSrc = img.attr('src');
            const newSrc = oldSrc.replace(/http:\/\/.+/g, `https://rss-img.rfw.workers.dev/${oldSrc}`);
            detail.find(`img[src="${oldSrc}"]`).replaceWith(`<img src='${newSrc}'>`);
        });
        detail.contents().get().forEach((child) => {
                const tagName = child.tagName;
                child = $(child);
                if (tagName === 'div') {
                    const line = child.html();
                    if (!line) {
                        return;
                    }
                    html += line === '\xa0' ? '<br>' : line;
                } else {
                    html += child.toString();
                }
            },
        );
        html = html.replace(/^\s*(<br>(?:\s*(?=<))?)*|(\s*<br>)*\s*$/g, '');
        return html;
    }

    const out = await Promise.all(
        posts.map(async (item) => {
                const $ = cheerio.load(item);

                const title_a = $('.hynewsTit a');
                const url = title_a.attr('href');

                const cache = await ctx.cache.get(url);
                if (cache) {
                    return JSON.parse(cache);
                }

                const time = $('.hynewsdate').first().text();
                const title = title_a.first().text();

                const fullDetail = await getFullText(url);

                const single = {
                    title,
                    description: fullDetail,
                    pubDate: new Date(time).toUTCString(),
                    link: url,
                    guid: url,
                };
                ctx.cache.set(url, JSON.stringify(single));
                return single;
            },
        ),
    );

    ctx.state.data = {
        title: '城轨交通 - 世界轨道交通资讯网',
        link: url,
        item: out,
    };
};
