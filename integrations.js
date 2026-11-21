'use strict';

const NOTION_VERSION = process.env.NOTION_VERSION || '2026-03-11';
const GH_API_VERSION = process.env.GITHUB_API_VERSION || '2026-03-10';

async function requestJson(url, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  if (!headers.accept) headers.accept = 'application/json';
  if (options.body !== undefined && !headers['content-type']) headers['content-type'] = 'application/json';
  const r = await fetch(url, Object.assign({}, options, { headers, signal: options.signal || AbortSignal.timeout(15000) }));
  const text = await r.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch (e) { body = { raw: text.slice(0, 500) }; }
  return { response: r, body };
}

async function github(token, base, path, options = {}) {
  const headers = Object.assign({
    authorization: 'Bearer ' + token,
    accept: 'application/vnd.github+json',
    'x-github-api-version': GH_API_VERSION,
    'user-agent': 'ai-chatroom'
  }, options.headers || {});
  return requestJson(base.replace(/\/+$/, '') + path, Object.assign({}, options, { headers }));
}

async function notion(token, base, path, options = {}) {
  const headers = Object.assign({
    authorization: 'Bearer ' + token,
    accept: 'application/json',
    'notion-version': NOTION_VERSION
  }, options.headers || {});
  return requestJson(base.replace(/\/+$/, '') + path, Object.assign({}, options, { headers }));
}

function textContent(text, max = 1800) {
  return String(text || '').replace(/\u0000/g, '').slice(0, max);
}

function richText(text) {
  const s = textContent(text, 2000);
  if (!s) return [];
  return [{ type: 'text', text: { content: s } }];
}

function paragraph(text) {
  return { object: 'block', type: 'paragraph', paragraph: { rich_text: richText(text) } };
}

function heading(text, level = 2) {
  const type = level === 1 ? 'heading_1' : level === 3 ? 'heading_3' : 'heading_2';
  return { object: 'block', type, [type]: { rich_text: richText(text) } };
}

function codeBlock(text, language = 'plain text') {
  return { object: 'block', type: 'code', code: { rich_text: richText(textContent(text, 2000)), language: /^[a-zA-Z0-9_+.# -]{1,30}$/.test(language) ? language : 'plain text' } };
}

function notionBlocks({ title, chat, deliverable, source = 'AI 채팅방' }) {
  const blocks = [heading(title || source, 1), paragraph('AI 채팅방에서 내보냄 · ' + new Date().toISOString())];
  if (chat) {
    blocks.push(heading('대화', 2));
    String(chat).split(/\n\n+/).slice(-100).forEach(line => {
      const s = textContent(line, 1900);
      if (s.startsWith('```')) return;
      blocks.push(paragraph(s));
    });
  }
  if (deliverable) {
    blocks.push(heading('산출물', 2));
    const m = String(deliverable).match(/^```([\w.+#-]*)\n([\s\S]*?)```/);
    blocks.push(m ? codeBlock(m[2], m[1] || 'plain text') : paragraph(textContent(deliverable, 1900)));
  }
  return blocks;
}

function blocksToText(results) {
  const out = [];
  for (const b of Array.isArray(results) ? results : []) {
    const v = b[b.type] || {};
    const rt = Array.isArray(v.rich_text) ? v.rich_text : Array.isArray(v.title) ? v.title : [];
    const text = rt.map(x => x.plain_text || (x.text && x.text.content) || '').join('');
    if (text) out.push(text);
    if (b.has_children && Array.isArray(v.children)) out.push(blocksToText(v.children));
  }
  return out.filter(Boolean).join('\n');
}

function pageTitle(page) {
  const props = page && page.properties || {};
  for (const p of Object.values(props)) {
    if (p && p.type === 'title' && Array.isArray(p.title)) return p.title.map(x => x.plain_text || '').join('') || '제목 없음';
  }
  return page && page.url ? page.url : '제목 없음';
}

function pageSummary(page) {
  return { id: page.id, title: pageTitle(page), url: page.url || '', edited: page.last_edited_time || '', object: page.object || 'page' };
}

function repoName(v) {
  const s = String(v || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/^\/+|\/+$/g, '');
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s) ? s : '';
}

function repoPath(v) {
  const s = String(v || '').trim().replace(/^\/+/, '');
  return s && s.length <= 240 && !s.split('/').some(x => !x || x === '.' || x === '..' || !/^[A-Za-z0-9._-]+$/.test(x)) ? s : '';
}

module.exports = { NOTION_VERSION, requestJson, github, notion, notionBlocks, blocksToText, pageSummary, repoName, repoPath, textContent };
