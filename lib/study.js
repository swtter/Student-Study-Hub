export const WEEK_ONE = '2026-07-27';

export function teachingWeek(now = new Date(), start = WEEK_ONE) {
  const day = 86400000;
  const diff = Math.floor((new Date(now.toDateString()) - new Date(`${start}T00:00:00`)) / day);
  return Math.max(0, Math.floor(diff / 7) + 1);
}

export function isProgressItem(item = {}) {
  const text = `${item.title || ''} ${item.name || ''}`.toLowerCase().trim();
  if (!text) return false;
  if (/\b(overview|navigation|welcome|start here|module guide|subject outline|course information|support)\b/.test(text)) return false;
  return ['Page','File','Assignment','Quiz','Discussion','ExternalUrl','ExternalTool'].includes(item.type);
}

export function classifyStage(item = {}) {
  const text = `${item.title || ''} ${item.name || ''}`.toLowerCase();
  if (/pre[- ]?class|prepare|preview|reading/.test(text)) return 'preview';
  if (/review|summary|reflection|post[- ]?class/.test(text)) return 'review';
  if (/practice|quiz|exercise|tutorial|workshop/.test(text)) return 'practice';
  return 'study';
}

export function classifyReference(text = '') {
  const value = text.toLowerCase();
  if (/required|essential|must read|prescribed/.test(value)) return 'required';
  if (/recommended|further reading|optional|extension/.test(value)) return 'recommended';
  return 'referenced';
}

export function extractWeekNumber(name = '') {
  const text = String(name).trim().toLowerCase();
  const labelled = text.match(/\b(?:week|module|topic|unit|session|chapter)\s*0*(\d{1,2})\b/i);
  if (labelled) return Number(labelled[1]);
  const leading = text.match(/^\s*0*(\d{1,2})(?:\s*[.):-]|\s+)/);
  if (leading) return Number(leading[1]);
  const words = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14};
  const word = text.match(/\b(?:week|module|topic|unit|session|chapter)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen)\b/i);
  return word ? words[word[1].toLowerCase()] : null;
}

export function extractReferences(html = '', source = {}) {
  const refs = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const title = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const url = match[1];
    if (!title || /next|previous|home|module/i.test(title)) continue;
    refs.push({ id: `${source.courseId || ''}:${source.week || ''}:${url}`, title, url, category: classifyReference(`${title} ${html.slice(Math.max(0, match.index - 100), match.index + 100)}`), sourceTitle: source.title || 'Canvas page', sourceType: source.type || 'Canvas Page' });
  }
  return refs;
}

export function normalizeModule(module = {}) {
  const week = extractWeekNumber(module.name);
  const items = (module.items || []).map(item => ({...item, stage: classifyStage(item), trackProgress: week !== null && isProgressItem(item)}));
  return {id: module.id, name: module.name, week, items};
}

export function assignSequentialWeeks(modules = []) {
  if (modules.some(module => module.week !== null)) return modules;
  let week = 0;
  return modules.map(module => {
    const substantive = module.items.some(isProgressItem) && !/\b(welcome|start here|course information|subject outline|help|support|resources?)\b/i.test(module.name || '');
    if (!substantive) return module;
    week += 1;
    return {...module, week, inferredWeek: true, items: module.items.map(item => ({...item, trackProgress: isProgressItem(item)}))};
  });
}

export function nextReview(result, level = 0, now = new Date()) {
  const intervals = [1,3,7,14,30,60];
  const nextLevel = result === 'correct' ? Math.min(level + 1, intervals.length - 1) : result === 'partial' ? Math.max(0, level - 1) : 0;
  const days = result === 'correct' ? intervals[nextLevel] : 1;
  const date = new Date(now); date.setDate(date.getDate() + days);
  return {level: nextLevel, nextReviewAt: date.toISOString(), days};
}
