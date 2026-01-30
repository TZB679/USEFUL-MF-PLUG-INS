"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");

const BASE_API = "https://yunzhiapi.cn/API";
const DEFAULT_COVER = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzQyYTVmNSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1zaXplPSIyNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7otJ/ouq88L3RleHQ+PC9zdmc+";

const PLATFORMS = {
    'wy': { name: '网易云音乐', source: 'netease' },
    'qq': { name: 'QQ音乐', source: 'tencent' },
    'kw': { name: '酷我音乐', source: 'kuwo' },
    'mg': { name: '咪咕音乐', source: 'migu' }
};

function getMusicSource() {
    if (typeof env !== 'undefined' && env.getUserVariables) {
        const vars = env.getUserVariables();
        const userSource = (vars && vars.musicSource) || 'wy';
        return PLATFORMS[userSource] ? userSource : 'wy';
    }
    return 'wy';
}

function formatMusicItem(item, platformCode) {
    const platform = PLATFORMS[platformCode] || PLATFORMS['wy'];
    
    return {
        id: item.id || '',
        title: item.name || '未知歌曲',
        artist: item.artist || '未知歌手',
        album: item.album || '未知专辑',
        artwork: DEFAULT_COVER,
        source: platform.source,
        platform: platform.name,
        _raw: {
            ...item,
            platformCode: platformCode
        }
    };
}

async function search(query, page = 1, type = 'music') {
    if (type !== 'music') {
        return { isEnd: true, data: [] };
    }
    
    const platformCode = getMusicSource();
    
    try {
        const response = await axios_1.default.get(`${BASE_API}/hqyyid.php`, {
            params: {
                name: query,
                type: platformCode,
                page: page.toString(),
                limit: '20'
            },
            timeout: 10000
        });

        const data = response.data;
        
        if (data.code !== 1 || !Array.isArray(data.data)) {
            return { isEnd: true, data: [] };
        }

        const musicItems = data.data.map(item => formatMusicItem(item, platformCode));

        return {
            isEnd: data.data.length < 20,
            data: musicItems
        };

    } catch (error) {
        return { isEnd: true, data: [] };
    }
}

async function getMediaSource(musicItem, quality = '320k') {
    const platformCode = musicItem._raw?.platformCode || getMusicSource();
    
    try {
        const response = await axios_1.default.get(`${BASE_API}/yyjhss.php`, {
            params: {
                id: musicItem.id,
                type: platformCode
            },
            timeout: 10000
        });

        const data = response.data;
        
        if (data.code !== 1 || !data.data || !data.data.url) {
            return null;
        }

        return {
            url: data.data.url,
            quality: quality,
            type: 'audio/mpeg'
        };

    } catch (error) {
        return null;
    }
}

async function getLyric(musicItem) {
    const platformCode = musicItem._raw?.platformCode || getMusicSource();
    
    try {
        const response = await axios_1.default.get(`${BASE_API}/yyjhss.php`, {
            params: {
                id: musicItem.id,
                type: platformCode
            },
            timeout: 10000
        });

        const data = response.data;
        
        if (data.code !== 1 || !data.data || !data.data.lrc) {
            return null;
        }

        return {
            rawLrc: data.data.lrc
        };

    } catch (error) {
        return null;
    }
}

async function getMusicInfo(musicItem) {
    const platformCode = musicItem._raw?.platformCode || getMusicSource();
    
    try {
        const response = await axios_1.default.get(`${BASE_API}/yyjhss.php`, {
            params: {
                id: musicItem.id,
                type: platformCode
            },
            timeout: 8000
        });

        const data = response.data;
        
        if (data.code === 1 && data.data) {
            return {
                artwork: data.data.pic || DEFAULT_COVER
            };
        }

        return {
            artwork: DEFAULT_COVER
        };

    } catch (error) {
        return {
            artwork: DEFAULT_COVER
        };
    }
}

async function getAlbumInfo() {
    return { isEnd: true, musicList: [] };
}

async function getArtistWorks() {
    return { isEnd: true, data: [] };
}

module.exports = {
    platform: "惜缘",
    author: '竹佀',
    version: "1.0",
    srcUrl: "https://yunzhiapi.cn",
    cacheControl: "no-store",
    
    description: `惜缘音乐插件 v1.0
数据来源：yunzhiapi.cn
支持平台：网易云音乐(wy)、QQ音乐(qq)、酷我音乐(kw)、咪咕音乐(mg)

使用说明：
在用户变量中设置 musicSource
可选值：wy / qq / kw / mg
留空默认使用 wy(网易云音乐)

注意事项：
仅供学习交流使用
请勿用于商业用途
支持正版音乐`,

    userVariables: [
        {
            key: "musicSource",
            name: "音乐源平台代码",
            hint: "wy(网易)/qq(QQ)/kw(酷我)/mg(咪咕)，默认wy"
        }
    ],

    supportedSearchType: ["music"],

    search,
    getMediaSource,
    getLyric,
    getMusicInfo,
    getAlbumInfo,
    getArtistWorks
};