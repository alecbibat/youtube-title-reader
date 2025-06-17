const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = 'AIzaSyDSOBvoSR7fV2_6LrPY0pf4ERPSAR2FC5A';
const KEYWORD_FILE = 'keywords.json';

let keywords = [];
let lastSeen = {};
let recentVideos = [];

function loadKeywords() {
  try {
    const data = fs.readFileSync(KEYWORD_FILE);
    keywords = JSON.parse(data);
    if (!Array.isArray(keywords)) throw new Error("Not an array");
  } catch (err) {
    console.error("Failed to load keywords.json:", err.message);
    keywords = ['openai', 'world news'];
    saveKeywords();
  }
}

function saveKeywords() {
  fs.writeFileSync(KEYWORD_FILE, JSON.stringify(keywords, null, 2));
}

loadKeywords();

app.use(express.static('public'));
app.use(express.json());

async function fetchYouTubeResults(keyword) {
  try {
    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/search`, {
        params: {
          q: keyword,
          part: 'snippet',
          order: 'date',
          type: 'video',
          maxResults: 5,
          key: API_KEY
        }
      }
    );

    const newVideos = [];

    for (const item of response.data.items) {
      const videoId = item.id.videoId;
      if (!lastSeen[keyword]) lastSeen[keyword] = new Set();
      if (!lastSeen[keyword].has(videoId)) {
        lastSeen[keyword].add(videoId);
        newVideos.push({
          id: videoId,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          published: item.snippet.publishedAt,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          keyword
        });
      }
    }

    recentVideos = [...newVideos, ...recentVideos].slice(0, 50);
    console.log(`✅ Fetched ${newVideos.length} new video(s) for "${keyword}"`);
  } catch (err) {
    console.error(`❌ Error fetching for "${keyword}":`, err.response?.data || err.message);
  }
}

// ✅ Poll every 101 minutes to stay under quota for 7 keywords
let polling = true;

async function pollKeywords() {
  while (polling) {
    for (const keyword of keywords) {
      console.log("Polling:", keyword);
      await fetchYouTubeResults(keyword.trim());
    }
    await new Promise(resolve => setTimeout(resolve, 101 * 60 * 1000)); // 101 minutes
  }
}

pollKeywords();

app.get('/videos', (req, res) => {
  res.json(recentVideos);
});

app.get('/keywords', (req, res) => {
  res.json(keywords);
});

app.post('/add-keyword', (req, res) => {
  const newKeyword = req.body.keyword?.trim();
  if (!newKeyword || keywords.includes(newKeyword)) {
    return res.status(400).json({ success: false, message: 'Invalid or duplicate keyword.' });
  }
  if (keywords.length >= 7) {
    return res.status(400).json({ success: false, message: 'Max keyword limit reached (7).' });
  }

  keywords.push(newKeyword);
  saveKeywords();
  res.json({ success: true, keywords });
});

app.delete('/delete-keyword', (req, res) => {
  const delKeyword = req.body.keyword?.trim();
  if (delKeyword && keywords.includes(delKeyword)) {
    keywords = keywords.filter(k => k !== delKeyword);
    saveKeywords();
    res.json({ success: true, keywords });
  } else {
    res.status(400).json({ success: false, message: 'Keyword not found.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
