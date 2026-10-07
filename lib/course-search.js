export function selectCoursePassages(sources, question, budget = 48000) {
  const terms = [...new Set(String(question).toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [])];
  const passages = sources.flatMap(source => {
    const result = [];
    for (let offset = 0; offset < source.text.length; offset += 2400) {
      const text = source.text.slice(offset, offset + 2800);
      const value = `${source.title} ${text}`.toLowerCase();
      result.push({...source, text, score: terms.reduce((sum, term) => sum + (value.includes(term) ? 1 : 0), 0)});
    }
    return result;
  }).sort((a, b) => b.score - a.score);
  // Include one passage from every readable week before adding relevant detail.
  const selected = [], weeks = new Set();
  let length = 0;
  for (const passage of passages) {
    if (weeks.has(passage.week) || length + passage.text.length > budget) continue;
    selected.push(passage); weeks.add(passage.week); length += passage.text.length;
  }
  for (const passage of passages) {
    if (selected.includes(passage) || length + passage.text.length > budget) continue;
    selected.push(passage); length += passage.text.length;
  }
  return selected;
}
