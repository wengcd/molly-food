import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const plainText = (value) => value.replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`#]/g, '').trim();

export function parseRecipeBody(raw, images = {}) {
  const body = raw.replace(/\r\n?/g, '\n').trim();
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (!title) throw new Error('菜谱需要一个 # 菜名 标题。');
  const firstSection = body.search(/^##\s+/m);
  const intro = firstSection >= 0 ? body.slice(0, firstSection) : body;
  const description = intro.split(/\n\s*\n/).find((p) => !/^(#|!\[|👥)/u.test(p.trim()))?.trim() || '';
  let imageCounter = 0;
  let ingredientCounter = 0;
  let stepCounter = 0;
  const steps = [];
  const ingredients = [];
  const getImage = (reference) => {
    const filename = decodeURIComponent(reference.split('|')[0].trim().replace(/\\/g, '/').split('/').at(-1));
    const image = images[filename];
    if (!image) throw new Error(`菜谱「${title}」引用的图片不存在：${filename}。请把附件一起放入 content/recipes。`);
    return { ...image, alt: filename.replace(/\.[^.]+$/, '').replace(/-步骤\d+-/, ' · ') };
  };
  const imageMarkup = (reference, alt) => {
    const img = getImage(reference);
    imageCounter++;
    return `<img src="${escapeHtml(img.src)}" srcset="${escapeHtml(img.srcset)}" sizes="(max-width: 640px) 100vw, 300px" width="${img.width}" height="${img.height}" alt="${escapeHtml(alt || img.alt)}" loading="lazy" decoding="async" />`;
  };
  // Render ordinary Markdown safely, then replace only the image tokens we own.
  function renderMarkdown(value) {
    const placeholders = [];
    const prepared = value.replace(/!\[\[([^\]]+)\]\]|!\[([^\]]*)\]\(([^)]+)\)/g, (_, wiki, alt, url) => {
      const index = placeholders.length;
      placeholders.push(imageMarkup(wiki || url, alt));
      return `MOLLYIMAGEPLACEHOLDER${index}END`;
    });
    let html = markdown.render(prepared);
    html = html.replace(/MOLLYIMAGEPLACEHOLDER(\d+)END/g, (_, index) => placeholders[Number(index)]);
    html = html.replace(/<li>(?:<p>)?\[([ xX])\]\s*([\s\S]*?)(?:<\/p>)?<\/li>/g, (_, checked, content) => {
      const index = ingredientCounter++;
      ingredients.push(content.replace(/<[^>]*>/g, '').trim());
      return `<li class="ingredient"><label><input type="checkbox" data-ingredient="${index}" ${checked.toLowerCase() === 'x' ? 'checked' : ''}/><span>${content}</span></label></li>`;
    });
    return html;
  }
  function renderBlocks(value) {
    const lines = value.split('\n');
    let normal = [];
    let html = '';
    const flush = () => { if (normal.length) { html += renderMarkdown(normal.join('\n')); normal = []; } };
    for (let i = 0; i < lines.length; i++) {
      if (!/^>\s*\[![\w-]+\]/.test(lines[i])) { normal.push(lines[i]); continue; }
      flush();
      const callout = [];
      while (i < lines.length && /^>/.test(lines[i])) callout.push(lines[i++].replace(/^>\s?/, ''));
      i--;
      const [, type, heading] = callout.shift().match(/^\[!([\w-]+)\]\s*(.*)$/);
      let text = callout.join('\n').trim();
      if (type === 'recipe-step') {
        const number = ++stepCounter;
        const stepTitle = text.match(/^###\s+(.+)$/m)?.[1] || `第 ${number} 步`;
        const stepImage = text.match(/!\[\[([^\]]+)\]\]/);
        const image = stepImage ? imageMarkup(stepImage[1]) : '';
        text = text.replace(/^###\s+.+$/m, '').replace(/!\[\[[^\]]+\]\]/, '').trim();
        steps.push({ name: plainText(stepTitle), text: plainText(text) });
        html += `<article class="recipe-step" id="step-${number}"><div class="step-photo">${image}<span class="step-number">${String(number).padStart(2, '0')}</span></div><div class="step-body"><h3>${escapeHtml(stepTitle.replace(/^第[一二三四五六七八九十\d]+步[：:]\s*/, ''))}</h3>${renderMarkdown(text)}</div></article>`;
      } else {
        html += `<aside class="recipe-callout"><span class="callout-mark" aria-hidden="true">✳</span><div>${heading ? `<h3>${escapeHtml(heading)}</h3>` : ''}${renderMarkdown(text)}</div></aside>`;
      }
    }
    flush();
    return html;
  }
  const coverMatch = intro.match(/!\[\[([^\]]+)\]\]/) || intro.match(/!\[[^\]]*\]\(([^)]+)\)/);
  const cover = coverMatch ? getImage(coverMatch[1]) : null;
  const duration = intro.match(/⏱️?\s*\*\*([^*]+)\*\*/)?.[1]?.trim() || '';
  const sectionSource = firstSection >= 0 ? body.slice(firstSection) : '';
  const chunks = sectionSource.split(/(?=^##\s+)/m).filter(Boolean);
  let notes = [];
  let attribution = '';
  const sectionIds = { '食材准备': 'ingredients', '具体做法': 'method', '好吃的关键': 'tips', '茉莉怎么吃': 'family' };
  const sections = [];
  for (const [index, chunk] of chunks.entries()) {
    const sectionTitle = chunk.match(/^##\s+(.+)/)?.[1]?.trim();
    if (!sectionTitle) continue;
    let content = chunk.replace(/^##\s+.+\n?/, '').trim();
    const divider = content.search(/^---\s*$/m);
    if (divider >= 0) { attribution += renderMarkdown(content.slice(divider + 3).trim()); content = content.slice(0, divider).trim(); }
    if (sectionTitle === '下次调整') { notes = content.split('\n').filter((l) => /^-\s/.test(l)).map((l) => l.replace(/^-\s*/, '')); continue; }
    sections.push({ title: sectionTitle, id: sectionIds[sectionTitle] || `section-${index}`, html: renderBlocks(content) });
  }
  return { title, description: plainText(description), cover, duration, sections, ingredients, steps, notes, attribution, imageCount: imageCounter + (cover ? 1 : 0) };
}
