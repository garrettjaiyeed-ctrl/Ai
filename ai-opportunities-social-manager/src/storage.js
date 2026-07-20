const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const queuePath = path.join(dataDir, 'queue.json');

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(queuePath)) {
    fs.writeFileSync(queuePath, JSON.stringify({ comments: [], stats: {} }, null, 2));
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  } catch {
    return { comments: [], stats: {} };
  }
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(queuePath, JSON.stringify(store, null, 2));
}

function addComments(items) {
  const store = readStore();
  const known = new Set(store.comments.map((item) => item.fingerprint));
  let added = 0;
  for (const item of items) {
    if (!known.has(item.fingerprint)) {
      store.comments.push(item);
      known.add(item.fingerprint);
      added += 1;
    }
  }
  writeStore(store);
  return added;
}

function updateComment(id, patch) {
  const store = readStore();
  const item = store.comments.find((comment) => comment.id === id);
  if (!item) return null;
  Object.assign(item, patch, { updatedAt: new Date().toISOString() });
  writeStore(store);
  return item;
}

function clearQueue() {
  const store = readStore();
  store.comments = [];
  writeStore(store);
}

module.exports = { readStore, addComments, updateComment, clearQueue };
