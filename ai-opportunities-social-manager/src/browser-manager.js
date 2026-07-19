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

    await this.page.waitForTimeout(1200);

    const raw = await this.page.evaluate(() => {
      const selectors = [
        '[data-e2e="comment-level-1"]',
        '[data-e2e="comment-item"]',
        'div[class*="DivCommentItemContainer"]',
        'div[class*="CommentItem"]'
      ];

      let nodes = [];
      for (const selector of selectors) {
        const found = Array.from(document.querySelectorAll(selector));
        if (found.length > nodes.length) nodes = found;
      }

      const visible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      };

      return nodes.filter(visible).map((node, index) => {
        const textNode = node.querySelector('[data-e2e="comment-level-1"] p, [data-e2e="comment-item"] p, p[class*="CommentText"], span[data-e2e="comment-level-1"]') || node.querySelector('p');
        const authorNode = node.querySelector('a[href*="/@"], [data-e2e="comment-username-1"], span[class*="Author"]');
        const text = (textNode?.innerText || '').trim();
        const author = (authorNode?.innerText || 'TikTok user').trim();
        return { text, author, domIndex: index };
      }).filter((item) => item.text.length > 0 && item.text.length < 1000);
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
      const selectors = [
        '[data-e2e="comment-level-1"]',
        '[data-e2e="comment-item"]',
        'div[class*="DivCommentItemContainer"]',
        'div[class*="CommentItem"]'
      ];
      let nodes = [];
      for (const selector of selectors) {
        const found = Array.from(document.querySelectorAll(selector));
        if (found.length > nodes.length) nodes = found;
      }
      const node = nodes[domIndex];
      if (!node) return false;
      const replyButton = Array.from(node.querySelectorAll('button, span')).find((el) => /reply/i.test(el.textContent || ''));
      if (!replyButton) return false;
      replyButton.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
      const editor = document.querySelector('[contenteditable="true"][data-e2e*="comment"], div[contenteditable="true"]');
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
