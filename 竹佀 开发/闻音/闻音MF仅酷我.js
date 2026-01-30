"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");

const API_URL = "https://kw-api.cenguigui.cn";
const DEFAULT_ARTWORK = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzQyYVRmNSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1zaXplPSIyNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5YR1lZPC90ZXh0Pjwvc3ZnPg==";

// 多个外部歌词API配置（优先顺序）
const LYRIC_APIS = [
    {
        name: "酷我歌词",
        searchUrl: "https://kuwo.cn/api/www/search/searchMusicBykeyWord",
        lyricUrl: "https://kuwo.cn/api/www/lyric/lyric",
        searchParam: "key",
        idField: "rid"
    },
    {
        name: "网易云歌词",
        searchUrl: "https://music.163.com/api/search/get",
        lyricUrl: "https://music.163.com/api/song/lyric",
        searchParam: "s",
        idField: "id",
        needEncrypt: true
    },
    {
        name: "QQ音乐歌词",
        searchUrl: "https://c.y.qq.com/soso/fcgi-bin/client_search_cp",
        lyricUrl: "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg",
        searchParam: "w",
        idField: "songid"
    }
];

// API请求
async function xgapiRequest(params) {
    try {
        const response = await axios_1.default.get(API_URL, {
            params: params,
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://cenguigui.cn'
            }
        });
        
        if (response.data && response.data.code === 200) {
            return response.data.data;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// 音质映射
const QUALITY_MAP = {
    '128k': 'standard',
    '320k': 'exhigh',
    'flac': 'lossless',
    'flac24bit': 'hires'
};

// 格式化音乐项
function formatMusicItem(item) {
    if (!item || !item.rid) return null;
    
    return {
        id: item.rid.toString(),
        platform: 'xgyy',
        title: item.name || '未知歌曲',
        artist: item.artist || '未知歌手',
        album: item.album || '',
        artwork: item.pic || DEFAULT_ARTWORK,
        url: item.url || '',
        lrc: '', // 清空原有歌词字段，完全依赖外部API
        qualities: {
            '128k': { size: null },
            '320k': { size: null },
            'flac': { size: null },
            'flac24bit': { size: null }
        },
        availableTypes: ['128k', '320k', 'flac', 'flac24bit']
    };
}

// ============ 搜索功能 ============
async function search(query, page = 1, type = 'music') {
    if (!query || query.trim() === '') {
        return { isEnd: true, data: [] };
    }
    
    const params = {
        name: query.trim(),
        page: page,
        limit: 20
    };
    
    if (type === 'album') {
        params.class = '专辑';
    } else if (type === 'artist') {
        params.class = '歌手';
    }
    
    const data = await xgapiRequest(params);
    
    if (!data) {
        return { isEnd: true, data: [] };
    }
    
    let formattedData = [];
    
    if (Array.isArray(data)) {
        for (const item of data) {
            const formatted = formatMusicItem(item);
            if (formatted) {
                formattedData.push(formatted);
            }
        }
    } else if (data.rid) {
        const formatted = formatMusicItem(data);
        if (formatted) {
            formattedData.push(formatted);
        }
    }
    
    return {
        isEnd: formattedData.length < 20,
        data: formattedData
    };
}

// ============ 获取媒体源 ============
async function getMediaSource(musicItem, quality = '320k') {
    if (!musicItem || !musicItem.id) return null;
    
    const apiQuality = QUALITY_MAP[quality] || 'exhigh';
    
    const data = await xgapiRequest({
        id: musicItem.id,
        type: 'song',
        level: apiQuality,
        format: 'json'
    });
    
    if (!data || !data.url) {
        const directUrl = `${API_URL}?id=${musicItem.id}&type=song&level=${apiQuality}&format=mp3`;
        return {
            url: directUrl,
            quality: quality,
            format: apiQuality.includes('lossless') || apiQuality.includes('hires') ? 'flac' : 'mp3'
        };
    }
    
    return {
        url: data.url,
        quality: quality,
        format: apiQuality.includes('lossless') || apiQuality.includes('hires') ? 'flac' : 'mp3'
    };
}

// ============ 从外部API获取歌词 ============
async function getLyricFromExternalAPI(musicItem) {
    if (!musicItem || !musicItem.title || !musicItem.artist) {
        return null;
    }
    
    const searchKeyword = `${musicItem.title} ${musicItem.artist}`;
    
    // 按顺序尝试各个歌词API
    for (const apiConfig of LYRIC_APIS) {
        try {
            console.log(`尝试从${apiConfig.name}获取歌词: ${searchKeyword}`);
            
            let songId = null;
            
            // 第一步：搜索歌曲获取ID
            const searchParams = {
                [apiConfig.searchParam]: searchKeyword,
                pn: 1,
                rn: 5,
                format: 'json'
            };
            
            // 网易云需要特殊处理
            if (apiConfig.name === "网易云歌词") {
                searchParams.type = 1;
                searchParams.limit = 5;
                searchParams.offset = 0;
            }
            
            // QQ音乐需要特殊处理
            if (apiConfig.name === "QQ音乐歌词") {
                searchParams.format = 'json';
                searchParams.inCharset = 'utf8';
                searchParams.outCharset = 'utf-8';
            }
            
            const searchResponse = await axios_1.default.get(apiConfig.searchUrl, {
                params: searchParams,
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': 'https://kuwo.cn/',
                    'Accept': 'application/json',
                    'Cookie': 'kw_token=123456' // 酷我需要token
                }
            });
            
            // 解析搜索结果获取歌曲ID
            if (searchResponse.data) {
                let data = searchResponse.data;
                
                // 酷我API
                if (apiConfig.name === "酷我歌词" && data.data && data.data.list) {
                    const songs = data.data.list;
                    if (songs.length > 0) {
                        songId = songs[0].rid;
                    }
                }
                // 网易云API
                else if (apiConfig.name === "网易云歌词" && data.result && data.result.songs) {
                    const songs = data.result.songs;
                    if (songs.length > 0) {
                        songId = songs[0].id;
                    }
                }
                // QQ音乐API
                else if (apiConfig.name === "QQ音乐歌词" && data.data && data.data.song) {
                    const songs = data.data.song.list;
                    if (songs && songs.length > 0) {
                        songId = songs[0].songid || songs[0].id;
                    }
                }
            }
            
            // 第二步：如果有歌曲ID，获取歌词
            if (songId) {
                console.log(`找到歌曲ID: ${songId}`);
                
                const lyricParams = {
                    [apiConfig.idField]: songId,
                    format: 'json'
                };
                
                // 各个API的特殊参数
                if (apiConfig.name === "酷我歌词") {
                    lyricParams.format = 'lrc';
                } else if (apiConfig.name === "网易云歌词") {
                    lyricParams.lv = -1;
                    lyricParams.kv = -1;
                    lyricParams.tv = -1;
                } else if (apiConfig.name === "QQ音乐歌词") {
                    lyricParams.songmid = songId;
                    lyricParams.g_tk = 5381;
                    lyricParams.format = 'json';
                    lyricParams.inCharset = 'utf8';
                    lyricParams.outCharset = 'utf-8';
                }
                
                const lyricResponse = await axios_1.default.get(apiConfig.lyricUrl, {
                    params: lyricParams,
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Referer': apiConfig.name === '酷我歌词' ? 'https://kuwo.cn/' : 
                                  apiConfig.name === '网易云歌词' ? 'https://music.163.com/' : 
                                  'https://y.qq.com/',
                        'Accept': 'application/json',
                        'Cookie': 'kw_token=123456'
                    }
                });
                
                // 解析歌词数据
                let lrcContent = '';
                const lyricData = lyricResponse.data;
                
                if (apiConfig.name === "酷我歌词" && lyricData.data && lyricData.data.lrclist) {
                    // 酷我歌词格式
                    const lrclist = lyricData.data.lrclist;
                    for (const line of lrclist) {
                        if (line.time && line.lineLyric) {
                            const minutes = Math.floor(line.time / 60);
                            const seconds = Math.floor(line.time % 60);
                            const milliseconds = Math.floor((line.time % 1) * 1000);
                            const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
                            lrcContent += `[${timeStr}]${line.lineLyric}\n`;
                        }
                    }
                } 
                else if (apiConfig.name === "网易云歌词" && lyricData.lrc && lyricData.lrc.lyric) {
                    // 网易云歌词格式
                    lrcContent = lyricData.lrc.lyric;
                }
                else if (apiConfig.name === "QQ音乐歌词" && lyricData.lyric) {
                    // QQ音乐歌词格式，可能是base64编码
                    if (lyricData.lyric.includes('base64')) {
                        // 如果是base64编码的歌词
                        const base64Str = lyricData.lyric.replace('MusicJsonCallback(', '').replace(')', '');
                        try {
                            const decoded = JSON.parse(base64Str);
                            if (decoded.lyric) {
                                // 可能是base64编码的歌词内容
                                lrcContent = Buffer.from(decoded.lyric, 'base64').toString('utf8');
                            }
                        } catch (e) {
                            lrcContent = lyricData.lyric;
                        }
                    } else {
                        lrcContent = lyricData.lyric;
                    }
                }
                
                if (lrcContent && lrcContent.trim() !== '') {
                    console.log(`成功从${apiConfig.name}获取歌词`);
                    return lrcContent;
                }
            }
        } catch (error) {
            console.log(`${apiConfig.name}获取歌词失败:`, error.message);
            continue; // 继续尝试下一个API
        }
    }
    
    return null;
}

// ============ 获取歌词（完全依赖外部API） ============
async function getLyric(musicItem) {
    if (!musicItem || !musicItem.title || !musicItem.artist) {
        return null;
    }
    
    try {
        const externalLyric = await getLyricFromExternalAPI(musicItem);
        
        if (externalLyric && externalLyric.trim() !== '') {
            return { rawLrc: externalLyric };
        }
        
        return null;
    } catch (error) {
        console.error('获取外部歌词失败:', error.message);
        return null;
    }
}

// ============ 获取音乐信息 ============
async function getMusicInfo(musicItem) {
    if (!musicItem) {
        return { artwork: DEFAULT_ARTWORK };
    }
    
    try {
        const data = await xgapiRequest({
            id: musicItem.id,
            type: 'song',
            format: 'json'
        });
        
        if (data) {
            return {
                artwork: data.pic || musicItem.artwork || DEFAULT_ARTWORK,
                title: data.name || musicItem.title || '',
                artist: data.artist || musicItem.artist || '',
                album: data.album || musicItem.album || '',
                duration: data.duration || musicItem.duration || 0
            };
        }
    } catch (error) {
        // 忽略错误，返回基本信息
    }
    
    return {
        artwork: musicItem.artwork || DEFAULT_ARTWORK,
        title: musicItem.title || '',
        artist: musicItem.artist || '',
        album: musicItem.album || '',
        duration: musicItem.duration || 0
    };
}

// ============ 获取专辑信息 ============
async function getAlbumInfo(albumItem, page = 1) {
    if (!albumItem || !albumItem.id) {
        const searchResult = await search(albumItem?.title || '', page, 'music');
        return {
            isEnd: searchResult.isEnd,
            musicList: searchResult.data,
            total: searchResult.data.length
        };
    }
    
    const data = await xgapiRequest({
        id: albumItem.id,
        type: 'albuminfo',
        page: page,
        limit: 30
    });
    
    if (!data) {
        const searchResult = await search(albumItem.title || '', page, 'music');
        return {
            isEnd: searchResult.isEnd,
            musicList: searchResult.data,
            total: searchResult.data.length
        };
    }
    
    const musicList = [];
    if (Array.isArray(data)) {
        for (const item of data) {
            const formatted = formatMusicItem(item);
            if (formatted) {
                musicList.push(formatted);
            }
        }
    }
    
    return {
        isEnd: musicList.length < 30,
        musicList: musicList,
        total: musicList.length
    };
}

// ============ 获取艺术家作品 ============
async function getArtistWorks(artistItem, page = 1, type = 'music') {
    if (!artistItem || !artistItem.id) {
        return await search(artistItem?.name || '', page, type);
    }
    
    const data = await xgapiRequest({
        id: artistItem.id,
        type: 'artistMusic',
        page: page,
        limit: 30
    });
    
    if (!data) {
        return await search(artistItem.name || '', page, type);
    }
    
    let formattedData = [];
    if (Array.isArray(data)) {
        for (const item of data) {
            const formatted = formatMusicItem(item);
            if (formatted) {
                formattedData.push(formatted);
            }
        }
    }
    
    return {
        isEnd: formattedData.length < 30,
        data: formattedData
    };
}

// ============ 热门搜索 ============
async function getHotSearch() {
    const data = await xgapiRequest({
        type: 'searchKey'
    });
    
    if (data && Array.isArray(data)) {
        return {
            isEnd: true,
            data: data.slice(0, 20).map(keyword => ({
                platform: 'xgyy',
                id: `hot_${keyword}`,
                name: keyword
            }))
        };
    }
    
    return { isEnd: true, data: [] };
}

module.exports = {
    platform: "闻音",
    author: '竹佀',
    version: "1.0.0",
    srcUrl: "https://kw-api.cenguigui.cn",
    cacheControl: "no-cache",
    description: "小黄音乐解析API插件\n支持：搜索、热门搜索、歌手、专辑\n音质：128k/320k/flac/24bit\n歌词：完全依赖外部API（酷我/网易云/QQ音乐）",
    
    userVariables: [],
    
    supportedSearchType: ["music", "album", "artist"],
    
    // 核心功能
    search,
    getMediaSource,
    getLyric,
    getMusicInfo,
    
    // 扩展功能
    getAlbumInfo,
    getArtistWorks,
    
    // 额外功能（仅保留热门搜索）
    getHotSearch,
};