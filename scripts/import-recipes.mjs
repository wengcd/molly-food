import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = process.argv[2];
if (!source) {
  console.error('用法：npm run import:recipes -- "菜谱文件夹的完整路径"');
  process.exit(1);
}
const from = path.resolve(source);
const destination = path.join(root, 'content', 'recipes');
if (from === destination || from.startsWith(destination + path.sep) || destination.startsWith(from + path.sep)) {
  throw new Error('源文件夹和网站菜谱文件夹必须相互独立。');
}
let count = 0;
async function copyFolder(directory, relative = '') {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const next = path.join(relative, item.name);
    if (item.isDirectory()) await copyFolder(path.join(directory, item.name), next);
    else if (item.isFile() && /\.(md|png|jpe?g|webp|avif)$/i.test(item.name) && item.name !== 'AGENTS.md') {
      const target = path.join(destination, next);
      await mkdir(path.dirname(target), { recursive: true });
      await cp(path.join(directory, item.name), target);
      count++;
    }
  }
}
await copyFolder(from);
console.log(`已复制 ${count} 个菜谱及图片文件到 content/recipes。原笔记未修改。`);
console.log('同路径文件会更新；不会自动删除网站中已有的菜谱。运行 npm run build 重新生成网站。');
