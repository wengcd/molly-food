import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const htmlFiles = [];
const fileSizes = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else { fileSizes.push((await stat(file)).size); if (file.endsWith('.html')) htmlFiles.push(file); }
  }
}
await walk(root);
assert.ok(htmlFiles.some((file) => file === path.join(root, 'index.html')), '缺少首页');
assert.ok(htmlFiles.some((file) => file === path.join(root, '404.html')), '缺少静态 404');
let images = 0;
let links = 0;
const checked = new Set();
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  assert.ok(!html.includes('![['), `${file}: Obsidian 图片未转换`);
  assert.ok(!html.includes('[!recipe-step]'), `${file}: Obsidian 提示框未转换`);
  for (const match of html.matchAll(/\b(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    let url = decodeURIComponent(match[1]).replaceAll('&amp;', '&');
    if (checked.has(url)) continue;
    checked.add(url);
    if (url.endsWith('/')) url += 'index.html';
    const target = path.join(root, url);
    assert.ok((await stat(target)).isFile(), `资源或链接不存在：${match[1]}`);
    if (/\.(webp|svg)$/.test(target)) images++; else links++;
  }
}
assert.ok(!htmlFiles.some((file) => file.includes('_worker')), '应为纯静态输出');
console.log(`检查通过：${htmlFiles.length} 个 HTML 页面，${images} 个图片引用，${links} 个页面和静态资源链接。`);
console.log(`dist 共 ${fileSizes.length} 个文件，${(fileSizes.reduce((a, b) => a + b, 0) / 1024 / 1024).toFixed(2)} MB。没有服务器或数据库依赖。`);
