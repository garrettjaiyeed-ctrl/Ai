require('dotenv').config();
const express = require('express');
const path = require('path');
const browser = require('./browser-manager');
const storage = require('./storage');
const { draftReply } = require('./reply-engine');

const app = express();
const port = Number(process.env.PORT || 3030);
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/status', (_req, res) => {
  const store = storage.readStore();
  res.json({ browser: browser.status(), count: store.comments.length });
});

app.post('/api/browser/open', async (req, res) => {
  try {
    const url = req.body.url || 'https://www.tiktok.com/';
    res.json(await browser.open(url));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/comments/scan', async (_req, res) => {
  try {
    const comments = await browser.scanVisibleComments();
    const added = storage.addComments(comments);
    res.json({ found: comments.length, added });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/comments', (_req, res) => {
  res.json(storage.readStore().comments);
});

app.delete('/api/comments', (_req, res) => {
  storage.clearQueue();
  res.json({ ok: true });
});

app.post('/api/comments/:id/draft', async (req, res) => {
  try {
    const item = storage.readStore().comments.find((comment) => comment.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Comment not found.' });
    const result = await draftReply(item);
    const updated = storage.updateComment(item.id, {
      status: result.flags.flagged ? 'flagged' : 'drafted',
      draft: result.reply,
      flags: result.flags,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/comments/:id', (req, res) => {
  const updated = storage.updateComment(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Comment not found.' });
  res.json(updated);
});

app.post('/api/comments/:id/insert', async (req, res) => {
  try {
    const item = storage.readStore().comments.find((comment) => comment.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Comment not found.' });
    const reply = String(req.body.reply || item.draft || '').trim();
    if (!reply) return res.status(400).json({ error: 'Reply is empty.' });
    await browser.insertReply(item.domIndex, reply);
    const updated = storage.updateComment(item.id, { status: 'inserted', draft: reply });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`AI Opportunities Social Manager: http://localhost:${port}`);
  console.log('Keep this window open while using the app.');
});
