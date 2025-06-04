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
  if (fs.existsSync(KEYWORD_FILE)) {
    keywords = JSON.parse(fs.readFileSync(KEYWORD_FILE));
  } else {
    keywords = ['elden ring', 'openai', 'world news'];
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
  } catch (err) {
    console.error(`Error fetching videos for "${keyword}":`, err.response?.data || err.message);
  }
}

setInterval(() => {
  for (const keyword of keywords) {
    fetchYouTubeResults(keyword.trim());
  }
}, 30000);

app.get('/videos', (req, res) => {
  res.json(recentVideos);
});

app.get('/keywords', (req, res) => {
  res.json(keywords);
});

app.post('/add-keyword', (req, res) => {
  const newKeyword = req.body.keyword?.trim();
  if (newKeyword && !keywords.includes(newKeyword)) {
    keywords.push(newKeyword);
    saveKeywords();
    res.json({ success: true, keywords });
  } else {
    res.status(400).json({ success: false, message: 'Invalid or duplicate keyword.' });
  }
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