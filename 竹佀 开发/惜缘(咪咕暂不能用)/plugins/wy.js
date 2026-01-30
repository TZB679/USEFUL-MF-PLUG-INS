"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");

const BASE_API = "https://yunzhiapi.cn/API";
const DEFAULT_COVER = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzQyYTVmNSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1zaXplPSIyNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7otJ/ouq88L3RleHQ+PC9zdmc+";

const PLATFORM = 'wy';

function formatMusicItem(item) {
    return {
        id: item.id || '',
        title: item.name || '未知歌曲',
        artist: item.artist || '未知歌手',
        album: item.album || '未知专辑',
        artwork: DEFAULT_COVER,
        source: 'netease',
        platform: '网易云音乐',
        _raw: item
    };
}

async function search(query, page = 1, type = 'music') {
    if (type !== 'music') {
        return { isEnd: true, data: [] };
    }
    
    try {
        const response = await axios_1.default.get(`${BASE_API}/hqyyid.php`, {
            params: {
                name: query,
                type: PLATFORM,
                page: page.toString(),
                limit: '20'
            },
            timeout: 10000
        });

        const data = response.data;
        
        if (data.code !== 1 || !Array.isArray(data.data)) {
            return { isEnd: true, data: [] };
        }

        const musicItems = data.data.map(item => formatMusicItem(item));

        return {
            isEnd: data.data.length < 20,
            data: musicItems
        };

    } catch (error) {
        return { isEnd: true, data: [] };
    }
}

async function getMediaSource(musicItem, quality = '320k') {
    try {
        const response = await axios_1.default.get(`${BASE_API}/yyjhss.php`, {
            params: {
                id: musicItem.id,
                type: PLATFORM
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
    try {
        const response = await axios_1.default.get(`${BASE_API}/yyjhss.php`, {
            params: {
                id: musicItem.id,
                type: PLATFORM
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
    try {
        const response = await axios_1.default.get(`${BASE_API}/yyjhss.php`, {
            params: {
                id: musicItem.id,
                type: PLATFORM
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
    platform: "惜缘网易",
    author: '竹佀',
    version: "1.0",
    srcUrl: "https://yunzhiapi.cn",
    cacheControl: "no-store",
    description: "惜缘音乐 - 网易云音乐版\n数据来源：yunzhiapi.cn\n仅支持网易云音乐搜索和播放",
    supportedSearchType: ["music"],
    search,
    getMediaSource,
    getLyric,
    getMusicInfo,
    getAlbumInfo,
    getArtistWorks
};