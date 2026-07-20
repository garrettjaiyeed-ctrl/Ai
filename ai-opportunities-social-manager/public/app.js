const $ = (id) => document.getElementById(id);
const state = { comments: [] };

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

function setMessage(text, error = false) {
  $('message').textContent = text || '';
  $('message').style.color = error ? '#ff9b9b' : '#ffbe99';
}

function escapeHtml(value = '') {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function render() {
  const comments = state.comments;
  $('queueCount').textContent = `${comments.length} comment${comments.length === 1 ? '' : 's'}`;
  $('totalCount').textContent = comments.length;
  $('draftedCount').textContent = comments.filter((c) => ['drafted', 'flagged', 'inserted'].includes(c.status)).length;
  $('flaggedCount').textContent = comments.filter((c) => c.flags?.flagged).length;
  $('insertedCount').textContent = comments.filter((c) => c.status === 'inserted').length;

  if (!comments.length) {
    $('queue').className = 'queue empty';
    $('queue').textContent = 'No comments yet.';
    return;
  }

  $('queue').className = 'queue';
  $('queue').innerHTML = comments.map((comment) => {
    const flags = Object.entries(comment.flags || {}).filter(([key, value]) => key !== 'flagged' && value).map(([key]) => key).join(', ');
    return `<article class="comment" data-id="${comment.id}">
      <div class="comment-top">
        <span class="author">@${escapeHtml(comment.author || 'TikTok user')}</span>
        <span class="pill ${comment.flags?.flagged ? 'flagged' : ''}">${escapeHtml(comment.status || 'new')}</span>
      </div>
      <p class="comment-text">${escapeHtml(comment.text)}</p>
      <div class="reply-row">
        <textarea id="reply-${comment.id}" placeholder="Generate or type a reply…">${escapeHtml(comment.draft || '')}</textarea>
        <button class="primary" onclick="generateDraft('${comment.id}')">Generate AI reply</button>
      </div>
      ${flags ? `<div class="warning">Human review required: ${escapeHtml(flags)}</div>` : ''}
      <div class="comment-actions">
        <button class="small primary" onclick="insertReply('${comment.id}')">Insert into TikTok</button>
        <button class="small" onclick="saveEdit('${comment.id}')">Save edit</button>
        <button class="small danger" onclick="skipComment('${comment.id}')">Skip</button>
      </div>
    </article>`;
  }).join('');
}

async function refreshStatus() {
  try {
    const data = await api('/api/status');
    $('status').textContent = data.browser.open ? `Browser open • ${data.count} queued` : `Browser closed • ${data.count} queued`;
  } catch (error) {
    $('status').textContent = 'Server error';
  }
}

async function refreshQueue() {
  state.comments = await api('/api/comments');
  render();
  await refreshStatus();
}

$('openBtn').addEventListener('click', async () => {
  try {
    setMessage('Opening TikTok…');
    const url = $('videoUrl').value.trim() || 'https://www.tiktok.com/';
    await api('/api/browser/open', { method: 'POST', body: JSON.stringify({ url }) });
    setMessage('TikTok opened. Log in, open comments, and scroll before scanning.');
    await refreshStatus();
  } catch (error) { setMessage(error.message, true); }
});

$('scanBtn').addEventListener('click', async () => {
  try {
    setMessage('Scanning comments currently visible in TikTok…');
    const result = await api('/api/comments/scan', { method: 'POST', body: '{}' });
    setMessage(`Found ${result.found} visible comments and added ${result.added} new ones.`);
    await refreshQueue();
  } catch (error) { setMessage(error.message, true); }
});

$('refreshBtn').addEventListener('click', refreshQueue);
$('clearBtn').addEventListener('click', async () => {
  if (!confirm('Clear the full local comment queue?')) return;
  await api('/api/comments', { method: 'DELETE' });
  setMessage('Queue cleared.');
  await refreshQueue();
});

window.generateDraft = async (id) => {
  try {
    setMessage('Generating a careful Amore reply…');
    await api(`/api/comments/${id}/draft`, { method: 'POST', body: '{}' });
    await refreshQueue();
    setMessage('AI reply ready. Review it before inserting.');
  } catch (error) { setMessage(error.message, true); }
};

window.saveEdit = async (id) => {
  try {
    const draft = $(`reply-${id}`).value.trim();
    await api(`/api/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ draft, status: 'edited' }) });
    setMessage('Edited reply saved.');
    await refreshQueue();
  } catch (error) { setMessage(error.message, true); }
};

window.insertReply = async (id) => {
  try {
    const reply = $(`reply-${id}`).value.trim();
    if (!reply) throw new Error('Generate or type a reply first.');
    setMessage('Finding the matching TikTok comment and inserting the reply…');
    await api(`/api/comments/${id}/insert`, { method: 'POST', body: JSON.stringify({ reply }) });
    setMessage('Reply inserted. Review it in TikTok, then click Post yourself.');
    await refreshQueue();
  } catch (error) { setMessage(error.message, true); }
};

window.skipComment = async (id) => {
  await api(`/api/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'skipped' }) });
  setMessage('Comment skipped.');
  await refreshQueue();
};

refreshQueue();
setInterval(refreshStatus, 5000);
