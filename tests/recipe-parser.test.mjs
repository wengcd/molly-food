import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parseRecipeBody } from '../src/lib/recipe-parser.mjs';

const folder = new URL('../content/recipes/', import.meta.url);
const images = {};
for (const file of await readdir(new URL('附件/', folder))) {
  if (!file.endsWith('.png')) continue;
  images[file] = { src: `/images/${encodeURIComponent(file)}.webp`, srcset: '/images/test.webp 480w', width: 480, height: 480 };
}

for (const [name, ingredientCount] of [['番茄土豆炖牛肉末', 8], ['虾仁豆腐蒸蛋', 7]]) {
  test(`${name}: all ingredients, four illustrated steps and original guidance survive import`, async () => {
    const source = await readFile(new URL(`${name}.md`, folder), 'utf8');
    const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
    const parsed = parseRecipeBody(body, images);
    assert.equal(parsed.title, name);
    assert.equal(parsed.ingredients.length, ingredientCount);
    assert.equal(parsed.steps.length, 4);
    assert.equal(parsed.imageCount, 5);
    assert.ok(parsed.duration.includes('分钟'));
    const html = parsed.sections.map((section) => section.html).join('');
    assert.ok(html.includes('71°C'));
    assert.ok(html.includes('茉莉'));
    assert.ok(!html.includes('[!recipe-step]'));
    assert.ok(!html.includes('![['));
    assert.equal((html.match(/data-ingredient=/g) || []).length, ingredientCount);
    assert.equal((html.match(/class="recipe-step"/g) || []).length, 4);
    assert.ok(parsed.attribution.includes('Imagegen'));
    assert.ok(parsed.attribution.includes('foodsafety.gov'));
    assert.ok(parsed.notes.length >= 5);
  });
}

test('missing images fail at build time instead of publishing broken images', () => {
  assert.throws(() => parseRecipeBody('# 菜\n\n介绍\n\n![[附件/没有.png]]\n\n## 食材准备\n- [ ] 土豆 **1个**', {}), /图片不存在/);
});

test('untrusted markup stays escaped; checked ingredients and optional images work', () => {
  const result = parseRecipeBody('# 家常菜\n\n介绍\n\n## 食材准备\n- [x] 蔬菜 **100克**\n\n## 具体做法\n> [!recipe-step]\n> ### 第一步：<script>danger</script>\n>\n> <img src=x onerror=alert(1)>\n');
  assert.equal(result.cover, null);
  assert.equal(result.ingredients.length, 1);
  assert.equal(result.steps.length, 1);
  assert.match(result.sections[0].html, /checked/);
  assert.ok(result.sections[1].html.includes('&lt;script&gt;'));
  assert.ok(!result.sections[1].html.includes('<script>'));
  assert.ok(!result.sections[1].html.includes('<img src=x'));
});

test('ordinary Markdown images and extra sections remain usable', () => {
  const imageName = Object.keys(images)[0];
  const result = parseRecipeBody(`# 简单菜\n\n介绍\n\n![菜品](附件/${imageName})\n\n## 食材准备\n- [ ] 食材 **1份**\n\n## 储存方式\n冷藏。`, images);
  assert.ok(result.cover);
  assert.equal(result.sections[1].title, '储存方式');
  assert.ok(result.sections[1].html.includes('冷藏'));
});
