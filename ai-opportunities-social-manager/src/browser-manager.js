const crypto = require('crypto');
const path = require('path');
const { chromium } = require('playwright');

class BrowserManager {
  constructor() {
    this.context = null;
    this.page = null;
  }

  async open(url = 'https://www.tiktok.com/') {
    if (!this.context) {
      const profileDir = path.join(__dirname, '..', 'browser-profile');
      this.context = await chromium.launchPersistentContext(profileDir, {
        headless: false,
        viewport: null,
        args: ['--start-maximized'],
      });
      this.context.on('close', () => {
        this.context = null;
        this.page = null;
      });
    }

    this.page = this.context.pages()[0] || await this.context.newPage();
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    return { open: true, url: this.page.url() };
  }

  status() {
    return { open: Boolean(this.context && this.page), url: this.page?.url() || null };
  }

  async scanVisibleComments() {
    if (!this.page) throw new Error('Open TikTok first.');

    await this.page.waitForTimeout(1500);

    const raw = await this.page.evaluate(() => {
      const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
      const results = [];
      const seen = new Set();

      const addResult = (textElement, container, index) => {
        const text = clean(textElement?.innerText || textElement?.textContent);
        if (!text || text.length > 1000) return;

        const authorElement = container?.querySelector(
          '[data-e2e="comment-username-1"], [data-e2e*="comment-username"], a[href^="/@"], a[href*="tiktok.com/@"]'
        );
        const author = clean(authorElement?.innerText || authorElement?.textContent) || 'TikTok user';
        const key = `${author}|${text}`;
        if (seen.has(key)) return;
        seen.add(key);

        results.push({ text, author, domIndex: index });
      };

      // TikTok commonly places data-e2e="comment-level-1" on the text itself,
      // rather than on the full comment container.
      const directTextNodes = Array.from(document.querySelectorAll(
        '[data-e2e="comment-level-1"], [data-e2e="comment-level-2"], [data-e2e*="comment-text"]'
      ));

      directTextNodes.forEach((textElement, index) => {
        const container = textElement.closest(
          '[data-e2e="comment-item"], [data-e2e*="comment-level"], div[class*="DivCommentItemContainer"], div[class*="CommentItem"]'
        ) || textElement.parentElement?.parentElement || textElement.parentElement;
        addResult(textElement, container, index);
      });

      // Fallback for class-based layouts and future TikTok DOM variations.
      if (results.length === 0) {
        const containers = Array.from(document.querySelectorAll(
          '[data-e2e="comment-item"], div[class*="DivCommentItemContainer"], div[class*="CommentItem"], li[class*="Comment"]'
        ));

        containers.forEach((container, index) => {
          const textElement = container.querySelector(
            '[data-e2e="comment-level-1"], [data-e2e="comment-level-2"], [data-e2e*="comment-text"], p[class*="CommentText"], p'
          );
          addResult(textElement, container, index);
        });
      }

      return results;
    });

    return raw.map((item) => {
      const fingerprint = crypto.createHash('sha256').update(`${item.author}|${item.text}`).digest('hex');
      return {
        id: crypto.randomUUID(),
        fingerprint,
        author: item.author,
        text: item.text,
        domIndex: item.domIndex,
        status: 'new',
        createdAt: new Date().toISOString(),
      };
    });
  }

  async insertReply(domIndex, reply) {
    if (!this.page) throw new Error('TikTok browser is not open.');

    const success = await this.page.evaluate(async ({ domIndex, reply }) => {
      const textNodes = Array.from(document.querySelectorAll(
        '[data-e2e="comment-level-1"], [data-e2e="comment-level-2"], [data-e2e*="comment-text"]'
      ));
      const textNode = textNodes[domIndex];
      const node = textNode?.closest(
        '[data-e2e="comment-item"], div[class*="DivCommentItemContainer"], div[class*="CommentItem"]'
      ) || textNode?.parentElement?.parentElement;

      if (!node) return false;
      const replyButton = Array.from(node.querySelectorAll('button, span, div')).find((el) => /^reply$/i.test((el.textContent || '').trim()));
      if (!replyButton) return false;
      replyButton.click();
      await new Promise((resolve) => setTimeout(resolve, 700));

      const editors = Array.from(document.querySelectorAll('[contenteditable="true"]'));
      const editor = editors.find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!editor) return false;

      editor.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, reply);
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: reply }));
      return true;
    }, { domIndex, reply });

    if (!success) throw new Error('Could not find the matching TikTok reply box. Scroll the comment into view and try again.');
    return true;
  }
}

module.exports = new BrowserManager();
