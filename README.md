# 茉莉的私房菜 · Molly’s Food

使用 **Astro + TypeScript + Markdown** 的家常菜谱网站。构建结果只有 HTML、CSS、JavaScript 和 WebP 图片，无需数据库、服务端、Workers 或 Pages Functions。

已收录 **番茄土豆炖牛肉末、虾仁豆腐蒸蛋**，包括全部 10 张成品和步骤图。原 Obsidian 文件未修改。

## 本地运行

需要 Node.js **22.12 或以上**和 npm。依赖使用 pnpm 锁定，项目 `.node-version` 固定为本次使用的 22.23.2。

```powershell
npx pnpm@10.33.0 install --frozen-lockfile
npm run dev
```

访问终端打印的地址，通常为 `http://localhost:4321`。

```powershell
npm run check    # Astro / TypeScript 检查
npm test         # 菜谱格式与内容完整性测试
npm run build   # 生成 dist/
npm run verify  # 检查生成页面、内部链接和图片
npm run preview # 预览刚刚构建的 dist/
```

## 发布到 Cloudflare Pages

### 连接 Git 仓库

把项目上传至自己的 Git 仓库，在 Cloudflare 控制台 **Workers & Pages → Create application → Pages → Connect to Git** 中选择仓库。界面名称可能随版本略有变化。

| 配置 | 值 |
| --- | --- |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 仓库根目录；若项目在子文件夹，选择对应文件夹 |
| Node.js | 使用项目中的 `.node-version` |

不需要数据库绑定、API 密钥或适配器。后续更新 Markdown 或图片并推送，Pages 会重新构建。

提交 `pnpm-lock.yaml` 和 `package.json`；Pages 会识别 pnpm。项目中的 `packageManager` 固定了 pnpm 版本。请勿在同一个 `node_modules` 中混用 npm install 和 pnpm install；`npm run` 仅运行脚本，可以正常使用。

### 直接上传静态文件

本地运行 `npm run build`，在 Pages 的 **Direct Upload / Upload assets** 中上传 `dist` 内的内容或压缩包。压缩包根目录应直接包含 `index.html`，不能多套一层 `dist`。不要上传源码项目或 `node_modules`。

Git 集成与直接上传是不同的项目创建方式；希望以后自动部署时，建议一开始就选 Git 集成。

### 设置域名

在 Pages 环境变量中设置 `SITE_URL=https://你的最终域名` 并重新部署，用于 canonical、站点地图和分享图绝对地址。未设置时使用 Cloudflare 提供的 `CF_PAGES_URL`。

本地直接上传前，可复制 `.env.example` 为 `.env` 并填写 `SITE_URL`，或在 PowerShell 中执行：

```powershell
$env:SITE_URL = 'https://你的项目.pages.dev'
npm run build
```

没有域名也可以正常构建浏览，只会省略绝对 canonical，站点地图为空。确定正式域名后重建即可。

已有静态 `404.html`；图片和构建资源使用内容哈希文件名，通过 `_headers` 设置长期缓存。

参考：[Cloudflare Pages Astro 部署文档](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/)、[Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)。

## 新增菜谱

### 继续在 Obsidian 中写

在原来的「茉莉的菜」文件夹新增菜谱并放好附件，在本项目根目录运行：

```powershell
npm run import:recipes -- "C:\Users\wengc\Documents\note\私人菜谱\茉莉的菜"
npm run build
```

导入会递归复制 Markdown 和图片到 `content/recipes/`，保留文件夹结构，不修改原笔记，云端构建也不依赖原笔记路径。同路径文件会被更新；源目录删除的文件不会自动从网站移除。下架时手动删除网站副本或设置 `draft: true`。

支持现有的 `![[私人菜谱/茉莉的菜/附件/图片.png|640]]`、`![[附件/图片.png]]` 和 `![说明](附件/图片.png)`。附件应一起导入，图片文件名在整个菜谱目录中应唯一。缺图或重名会在构建时报错。

### 直接在项目中写

1. 复制 `templates/新菜谱.md` 到 `content/recipes/`，按菜名重命名。
2. 填写食材和做法，把 `draft: true` 改为 `draft: false`。
3. 配图放入 `content/recipes/附件/`，正文加入图片引用；没有图片也能展示，会使用菜谱图标。
4. 运行 `npm run build`，重新发布 `dist` 或推送 Git。

无需手动修改首页、列表、搜索索引或路由。

### 可选元数据

原笔记的中文 YAML 字段直接可用，也可加入网站字段：

```yaml
slug: mushroom-rice    # 建议设置稳定的英文小写链接
category: 家常好味     # 分类自动汇总，默认家常好味
order: 10             # 数字越小越靠前，默认100
featured: false       # 首页主推荐；多篇时选排序靠前的一篇
draft: false          # true 时不生成列表和详情页
description: 一句话简介 # 默认使用标题后的第一段
```

已有菜谱的分类、链接和推荐顺序放在 `content/catalog.json`，再次从 Obsidian 导入不会丢失。新菜谱也可按一级标题添加到此文件。`slug`、`category` 以 Markdown 设置优先；目录里的 `order` 优先。建议发布后保持 `slug` 不变，避免改名影响旧链接。

建议沿用 `## 食材准备`、`## 具体做法`、`## 好吃的关键`、`## 茉莉怎么吃`、`## 下次调整`。其他二级标题也会显示。示例：

```markdown
![[附件/新菜谱.png]]

## 食材准备

- [ ] 新鲜番茄 **2个**

> [!tip] 小提醒
> 这里写备菜建议。

## 具体做法

> [!recipe-step]
> ![[附件/新菜谱-步骤01.png]]
>
> ### 第一步：切配食材
>
> 这里写操作和用量。
```

支持普通 Markdown 段落、列表、表格、链接。站内图片无需外部图床，不执行笔记中的 HTML。只导入指定菜谱文件夹的 Markdown 和图片，不会发布整个 Obsidian 仓库。

## 功能与数据

- 搜索菜名、简介或食材，按分类、收藏筛选；筛选状态保留在 URL。
- 收藏、食材勾选、下次调整记录保存在当前浏览器的 `localStorage`，不上传服务器、不跨设备同步。清除网站数据会清除记录。
- 食材内容变化后，备菜进度自动从零开始，避免旧勾选对应到新食材。
- 图文步骤、食材清单、目录跳转和独立打印样式。
- 关闭 JavaScript 仍能浏览所有菜谱；搜索、收藏和本地记录需要 JavaScript。
- 沿用原笔记的 Imagegen 配图，来源说明保留在每篇菜谱末尾，没有标为实拍。

## 文件位置

| 路径 | 用途 |
| --- | --- |
| `content/recipes/` | 原始 Markdown 和图片附件 |
| `content/catalog.json` | 网站分类、排序、推荐配置 |
| `templates/新菜谱.md` | 新菜谱模板，不会直接发布 |
| `src/pages/` | 首页、详情、404、robots、sitemap |
| `src/lib/` | 笔记解析与菜谱数据 |
| `src/styles/global.css` | 视觉、手机和打印样式 |
| `src/scripts/site.ts` | 搜索、收藏、勾选、笔记 |
| `scripts/` | 导入、图片准备、构建验收 |
| `dist/` | 只发布这个构建输出文件夹 |

`src/generated` 和 `public/images` 会自动生成，无需提交。原始菜谱图片需要提交；构建会生成响应式 WebP，不会把原始 PNG 放进 `dist`。
