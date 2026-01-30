"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");

const TUNEHUB_API = "https://music-dl.sayqz.com/api/";
const DEFAULT_ARTWORK = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzQyYTVmNSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1zaXplPSIyNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5UVU5FSEJCPC90ZXh0Pjwvc3ZnPg==";

const SUPPORTED_PLATFORMS = {
    netease: { name: "网易云音乐", stable: true },
    qq: { name: "QQ音乐", stable: false },
    kuwo: { name: "酷我音乐", stable: true }
};

function getMusicSource() {
    try {
        const vars = env && env.getUserVariables && env.getUserVariables();
        const userSource = vars && vars.musicSource;
        return userSource && SUPPORTED_PLATFORMS[userSource] ? userSource : 'netease';
    } catch (error) {
        console.warn('[TuneHub] 获取音乐源失败，使用默认值', error.message);
        return 'netease';
    }
}

async function tunehubRequest(params) {
    try {
        const response = await axios_1.default.get(TUNEHUB_API, {
            params: params,
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });
        
        if (response.data?.code === 200) {
            return response.data.data;
        } else {
            console.error('[TuneHub] API返回错误:', response.data?.message);
            return null;
        }
    } catch (error) {
        console.error('[TuneHub] 请求失败:', error.message);
        return null;
    }
}

function formatMusicItem(item, source) {
    if (!item) return null;
    
    const availableTypes = ['128k', '320k', 'flac', 'flac24bit'];
    const qualities = {};
    
    availableTypes.forEach(type => {
        qualities[type] = { size: null };
    });
    
    let artist = '未知歌手';
    if (item.artist) {
        artist = typeof item.artist === 'string' ? item.artist : 
                 Array.isArray(item.artist) ? item.artist.join('、') : 
                 '未知歌手';
    }
    
    let artwork = DEFAULT_ARTWORK;
    if (item.pic) {
        artwork = item.pic;
    } else if (item.picUrl) {
        artwork = item.picUrl;
    }
    
    return {
        id: item.id,
        title: item.name || '未知歌曲',
        artist: artist,
        album: item.album || '',
        duration: 0,
        artwork: artwork,
        source: item.platform || source,
        qualities: qualities,
        availableTypes: availableTypes,
        _rawData: item
    };
}

async function search(query, page = 1, type = 'music') {
    if (!query || query.trim() === '') {
        return { isEnd: true, data: [] };
    }
    
    let musicSource = getMusicSource();
    const limit = 20;
    
    try {
        if (musicSource === 'qq' && !SUPPORTED_PLATFORMS.qq.stable) {
            musicSource = 'netease';
        }
        
        const params = {
            source: musicSource,
            type: 'search',
            keyword: query.trim(),
            limit: limit,
            page: page
        };
        
        const data = await tunehubRequest(params);
        
        if (!data || !data.results || !Array.isArray(data.results)) {
            return { isEnd: true, data: [] };
        }
        
        let formattedData = [];
        
        if (type === 'music') {
            formattedData = data.results
                .filter(item => item && item.id && item.name)
                .map(item => formatMusicItem(item, musicSource));
        } 
        else if (type === 'album') {
            const albumMap = new Map();
            
            data.results.forEach(item => {
                if (item && item.album) {
                    const albumName = item.album.trim();
                    if (albumName && !albumMap.has(albumName)) {
                        albumMap.set(albumName, {
                            id: `album_${item.id}`,
                            title: albumName,
                            artist: item.artist || '未知歌手',
                            artwork: item.pic || DEFAULT_ARTWORK,
                            description: '',
                            source: musicSource
                        });
                    }
                }
            });
            
            formattedData = Array.from(albumMap.values());
        }
        else if (type === 'artist') {
            const artistMap = new Map();
            
            data.results.forEach(item => {
                if (item && item.artist) {
                    const artistName = typeof item.artist === 'string' 
                        ? item.artist.split('、')[0].trim()
                        : '未知歌手';
                    
                    if (artistName && !artistMap.has(artistName)) {
                        artistMap.set(artistName, {
                            id: `artist_${artistName.replace(/\s+/g, '_')}`,
                            name: artistName,
                            avatar: item.pic || DEFAULT_ARTWORK,
                            description: '',
                            source: musicSource
                        });
                    }
                }
            });
            
            formattedData = Array.from(artistMap.values());
        }
        
        const isEnd = data.results.length < limit;
        
        return {
            isEnd: isEnd,
            data: formattedData
        };
        
    } catch (error) {
        console.error('[TuneHub] 搜索异常:', error);
        return { isEnd: true, data: [] };
    }
}

async function getMediaSource(musicItem, quality = '320k') {
    if (!musicItem || !musicItem.id) {
        console.error('[TuneHub] 音乐项无效');
        return null;
    }
    
    let selectedQuality = quality;
    
    if (musicItem.quality) {
        selectedQuality = musicItem.quality;
    } else if (musicItem._quality) {
        selectedQuality = musicItem._quality;
    }
    
    if (musicItem._rawData?.quality) {
        selectedQuality = musicItem._rawData.quality;
    }
    
    if (arguments.length > 2 && arguments[2]) {
        selectedQuality = arguments[2];
    }
    
    if (musicItem.info?.type) {
        selectedQuality = musicItem.info.type;
    }
    
    const source = musicItem.source || getMusicSource();
    
    try {
        let finalUrl = '';
        
        if (musicItem._rawData?.url) {
            let baseUrl = musicItem._rawData.url;
            const urlObj = new URL(baseUrl);
            const params = new URLSearchParams(urlObj.search);
            params.set('br', selectedQuality);
            urlObj.search = params.toString();
            finalUrl = urlObj.toString();
        } else {
            const data = await tunehubRequest({
                source: source,
                id: musicItem.id,
                type: 'url',
                br: selectedQuality
            });
            
            if (data) {
                if (typeof data === 'string') {
                    finalUrl = data;
                } else if (data.url) {
                    finalUrl = data.url;
                }
            }
        }
        
        if (!finalUrl || finalUrl.trim() === '') {
            return null;
        }
        
        let format = 'mp3';
        if (selectedQuality.includes('flac')) {
            format = 'flac';
        }
        
        return {
            url: finalUrl,
            quality: selectedQuality,
            size: null,
            format: format,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://music-dl.sayqz.com/'
            }
        };
        
    } catch (error) {
        console.error('[TuneHub] 获取媒体源失败:', error);
        return null;
    }
}

async function getLyric(musicItem) {
    if (!musicItem || !musicItem.id) {
        return null;
    }
    
    const source = musicItem.source || getMusicSource();
    
    try {
        if (musicItem._rawData?.lrc) {
            try {
                const response = await axios_1.default.get(musicItem._rawData.lrc, {
                    timeout: 5000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                
                if (response.data && typeof response.data === 'string') {
                    return { rawLrc: response.data };
                }
            } catch (error) {
                console.warn('[TuneHub] 歌词URL获取失败:', error.message);
            }
        }
        
        const data = await tunehubRequest({
            source: source,
            id: musicItem.id,
            type: 'lrc'
        });
        
        if (data && typeof data === 'string') {
            return { rawLrc: data };
        }
        
        return null;
        
    } catch (error) {
        console.error('[TuneHub] 获取歌词异常:', error);
        return null;
    }
}

async function getMusicInfo(musicItem) {
    if (!musicItem) {
        return { artwork: DEFAULT_ARTWORK };
    }
    
    return {
        artwork: musicItem.artwork || DEFAULT_ARTWORK,
        title: musicItem.title,
        artist: musicItem.artist,
        album: musicItem.album,
        duration: musicItem.duration
    };
}

async function getAlbumInfo(albumItem, page = 1) {
    if (!albumItem || !albumItem.title) {
        return { isEnd: true, musicList: [] };
    }
    
    const searchResult = await search(albumItem.title, page, 'music');
    
    return {
        isEnd: searchResult.isEnd,
        musicList: searchResult.data || [],
        total: searchResult.data?.length || 0
    };
}

async function getArtistWorks(artistItem, page = 1, type = 'music') {
    if (!artistItem || !artistItem.name) {
        return { isEnd: true, data: [] };
    }
    
    return await search(artistItem.name, page, type);
}

module.exports = {
    platform: "幻音",
    author: '竹佀',
    version: "1.0.0",
    srcUrl: "https://music-dl.sayqz.com",
    cacheControl: "no-cache",
    description: "基于TuneHub API的音乐插件\n支持网易云、QQ音乐、酷我音乐\n完整音质选择支持",
    
    userVariables: [
        {
            key: "musicSource",
            name: "音乐源",
            hint: "netease (网易云), qq (QQ音乐), kuwo (酷我音乐)，留空默认netease"
        }
    ],
    
    supportedSearchType: ["music", "album", "artist"],
    
    search,
    getMediaSource,
    getLyric,
    getAlbumInfo,
    getArtistWorks,
    getMusicInfo
};