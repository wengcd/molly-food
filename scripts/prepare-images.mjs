import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'content/recipes');
const output = path.join(root, 'public/images');
await mkdir(output, { recursive: true });
await mkdir(path.join(root, 'src/generated'), { recursive: true });
const images = {};
let sourceBytes = 0;
let outputBytes = 0;
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name);
    if (item.isDirectory()) { await walk(filename); continue; }
    if (!/\.(png|jpe?g|webp|avif)$/i.test(item.name)) continue;
    if (images[item.name]) throw new Error(`图片文件名重复，请使用不同名称：${item.name}`);
    const buffer = await readFile(filename);
    const hash = createHash('sha256').update(buffer).update('webp-v1').digest('hex').slice(0, 16);
    const metadata = await sharp(buffer).metadata();
    const variants = [];
    for (const width of [480, 960, 1440].filter((w, i) => i === 0 || w < metadata.width)) {
      const actualWidth = Math.min(width, metadata.width);
      const name = `${hash}-${actualWidth}.webp`;
      const target = path.join(output, name);
      try { await access(target); } catch {
        await sharp(buffer).rotate().resize({ width: actualWidth, withoutEnlargement: true }).webp({ quality: 83 }).toFile(target);
      }
      outputBytes += (await readFile(target)).length;
      variants.push({ src: `/images/${name}`, width: actualWidth });
    }
    const last = variants.at(-1);
    images[item.name] = {
      src: last.src,
      srcset: variants.map(({ src, width }) => `${src} ${width}w`).join(', '),
      width: last.width,
      height: Math.round(last.width * metadata.height / metadata.width),
    };
    sourceBytes += buffer.length;
  }
}
await walk(source);
await writeFile(path.join(root, 'src/generated/images.json'), JSON.stringify(images, null, 2) + '\n');
console.log(`图片：${Object.keys(images).length} 张，源文件 ${(sourceBytes / 1024 / 1024).toFixed(1)} MB → 响应式 WebP 共 ${(outputBytes / 1024 / 1024).toFixed(2)} MB。`);
