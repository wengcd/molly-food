export {};

const FAVORITES_KEY = 'mollys-food:favorites:v1';
const memoryStore = new Map<string, unknown>();
let toastTimeout: ReturnType<typeof setTimeout>;

interface ClientRecipe {
  slug: string;
  number: string;
  title: string;
  category: string;
  duration: string;
  taste: string;
  age: string;
  description: string;
  cover: string;
  v2Href: string;
  ingredients: string[];
  steps: { name: string; text: string }[];
}

function showToast(message: string) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimeout = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* 浏览器禁用存储时降级为内存状态 */
  }
  return (memoryStore.get(key) as T) ?? fallback;
}

function writeStore(key: string, value: unknown): boolean {
  memoryStore.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function getFavorites(): string[] {
  const stored = readStore<unknown>(FAVORITES_KEY, []);
  return Array.isArray(stored)
    ? [...new Set(stored.filter((item): item is string => typeof item === 'string'))]
    : [];
}

function syncFavorites() {
  const favorites = getFavorites();
  document.querySelectorAll<HTMLButtonElement>('[data-favorite]').forEach((button) => {
    const saved = favorites.includes(button.dataset.favorite || '');
    button.setAttribute('aria-pressed', String(saved));
    button.title = saved ? '取消收藏' : '收藏菜谱';
    const label = button.querySelector('[data-favorite-label]');
    if (label) label.textContent = saved ? '已收藏' : '收藏菜谱';
    else button.setAttribute('aria-label', saved ? '取消收藏这道菜谱' : '收藏这道菜谱');
  });
  document.querySelectorAll<HTMLElement>('[data-saved-count]').forEach((count) => {
    count.textContent = String(favorites.length);
    count.hidden = favorites.length === 0;
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-favorite]').forEach((button) => {
  button.addEventListener('click', () => {
    const slug = button.dataset.favorite!;
    const favorites = getFavorites();
    const saved = favorites.includes(slug);
    const persisted = writeStore(
      FAVORITES_KEY,
      saved ? favorites.filter((item) => item !== slug) : [...favorites, slug],
    );
    syncFavorites();
    updateCollection();
    showToast(
      persisted
        ? saved
          ? '已从私房收藏夹移除'
          : '已收入你的私房菜手帖 ♡'
        : '当前环境仅在页面内保留收藏状态',
    );
  });
});
syncFavorites();

// 首页搜索、分类筛选、食材快筛与视图切换
const search = document.querySelector<HTMLInputElement>('#recipe-search');
const filterButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-filter]')];
const ingButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-ing-filter]')];
const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-view-mode]')];
const recipeGrid = document.querySelector<HTMLElement>('#recipe-grid');
const cards = [...document.querySelectorAll<HTMLElement>('[data-recipe-card]')];

let activeFilter = 'all';
let activeIngFilter = '';

const urlParams = new URLSearchParams(location.search);
if (search) {
  search.value = urlParams.get('q') || '';
  const requestedFilter =
    urlParams.get('view') === 'saved' ? 'saved' : urlParams.get('category') || 'all';
  if (filterButtons.some((btn) => btn.dataset.filter === requestedFilter)) {
    activeFilter = requestedFilter;
  }
}

function updateCollection(updateUrl = false) {
  if (!search) return;
  const query = search.value.toLocaleLowerCase().trim();
  const terms = query.split(/\s+/).filter(Boolean);
  const ingAlternatives = activeIngFilter
    ? activeIngFilter.toLocaleLowerCase().split('|').filter(Boolean)
    : [];
  const favorites = getFavorites();
  let count = 0;

  cards.forEach((card) => {
    const haystack = (card.dataset.search || '').toLocaleLowerCase();
    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'saved'
        ? favorites.includes(card.dataset.slug || '')
        : card.dataset.category === activeFilter);
    const matchesSearch = terms.every((term) => haystack.includes(term));
    const matchesIng =
      ingAlternatives.length === 0 || ingAlternatives.some((ing) => haystack.includes(ing));

    card.hidden = !(matchesFilter && matchesSearch && matchesIng);
    if (!card.hidden) count++;
  });

  filterButtons.forEach((btn) => {
    const selected = btn.dataset.filter === activeFilter;
    btn.classList.toggle('is-active', selected);
    btn.setAttribute('aria-pressed', String(selected));
  });

  ingButtons.forEach((btn) => {
    const selected = (btn.dataset.ingFilter || '') === activeIngFilter;
    btn.classList.toggle('is-active', selected);
    btn.setAttribute('aria-pressed', String(selected));
  });

  const resultCount = document.querySelector('[data-result-count]');
  if (resultCount) resultCount.textContent = `当前展示 ${count} 道家常好味`;

  const empty = document.querySelector<HTMLElement>('#empty-state');
  if (empty) {
    empty.hidden = count > 0;
    const noFavorites = activeFilter === 'saved' && !query && !activeIngFilter && favorites.length === 0;
    empty.querySelector('[data-empty-title]')!.textContent = noFavorites
      ? '收藏夹还是空的'
      : '没有找到符合条件的菜谱';
    empty.querySelector('[data-empty-description]')!.textContent = noFavorites
      ? '点击任意菜谱卡片右上角的爱心图标，即可把常做的菜留在这里。'
      : '试试切换食材标签，或者清空搜索词看看全部 10 道家常菜。';
  }

  if (updateUrl) {
    const next = new URL(location.href);
    ['q', 'category', 'view'].forEach((key) => next.searchParams.delete(key));
    if (query) next.searchParams.set('q', search.value.trim());
    if (activeFilter === 'saved') next.searchParams.set('view', 'saved');
    else if (activeFilter !== 'all') next.searchParams.set('category', activeFilter);
    history.replaceState(null, '', next);
  }
}

search?.addEventListener('input', () => updateCollection(true));
filterButtons.forEach((btn) =>
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter!;
    updateCollection(true);
  }),
);
ingButtons.forEach((btn) =>
  btn.addEventListener('click', () => {
    activeIngFilter = btn.dataset.ingFilter || '';
    updateCollection(false);
  }),
);
viewButtons.forEach((btn) =>
  btn.addEventListener('click', () => {
    const mode = btn.dataset.viewMode;
    viewButtons.forEach((b) => {
      const active = b.dataset.viewMode === mode;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    recipeGrid?.classList.toggle('is-list-view', mode === 'list');
  }),
);

document.querySelector('#reset-filters')?.addEventListener('click', () => {
  activeFilter = 'all';
  activeIngFilter = '';
  if (search) search.value = '';
  updateCollection(true);
  search?.focus({ preventScroll: true });
});

document.addEventListener('keydown', (event) => {
  if (
    event.key === '/' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !(
      event.target instanceof HTMLElement &&
      event.target.closest('input, textarea, select, [contenteditable="true"]')
    )
  ) {
    if (search) {
      event.preventDefault();
      search.focus();
    }
  }
});

window.addEventListener('storage', (event) => {
  if (event.key === FAVORITES_KEY || event.key === null) {
    syncFavorites();
    updateCollection();
  }
});
updateCollection();

// 解析内联菜谱数据，驱动“灵感配餐台”与“速览步骤抽屉”
const dataEl = document.getElementById('v2-recipes-data');
const allRecipes: ClientRecipe[] = dataEl ? JSON.parse(dataEl.textContent || '[]') : [];
const recipeMap = new Map(allRecipes.map((r) => [r.slug, r]));

const curatedCombos = [
  {
    slugs: ['tomato-potato-beef', 'shrimp-tofu-steamed-egg'],
    name: '★ 搭配建议：浓汁拌饭 ＋ 清润蒸菜',
    time: '建议统筹：约 45 分钟',
    desc: '炖牛肉末的时候同步用蒸锅蒸上虾仁豆腐蛋羹，一红一白、一浓一淡，茉莉既有酸甜汤汁拌软饭，又有滑嫩高蛋白。',
    ings: '核心采购：牛肉末、熟番茄、土豆、鲜虾仁、内酯豆腐、鸡蛋',
  },
  {
    slugs: ['steamed-mandarin-fish-broccoli', 'cabbage-tofu-pork'],
    name: '★ 搭配建议：清蒸鲜鱼 ＋ 暖胃白菜豆腐炖',
    time: '建议统筹：约 40 分钟',
    desc: '桂鱼少刺细嫩，搭配软烂入味的白菜豆腐猪肉末，既有优质白肉鱼，又有汤水润口的豆腐蔬菜。',
    ings: '核心采购：桂鱼、西兰花、白菜、老豆腐、猪肉末',
  },
  {
    slugs: ['mushroom-potato-chicken', 'winter-melon-shrimp'],
    name: '★ 搭配建议：菌香焖鸡腿 ＋ 清甜冬瓜虾仁',
    time: '建议统筹：约 45 分钟',
    desc: '香菇与鸡腿焖出醇厚肉香，配一碗清亮滑润的冬瓜虾仁烩，口感层次丰富且不油腻。',
    ings: '核心采购：琵琶鸡腿、鲜香菇、土豆、冬瓜、鲜虾仁',
  },
  {
    slugs: ['spinach-pork-noodles', 'tomato-cauliflower-eggs'],
    name: '★ 搭配建议：省心一锅端面食 ＋ 酸甜菜花炒蛋',
    time: '建议统筹：约 35 分钟',
    desc: '不用另外焖米饭！一锅热乎的菠菜肉末汤面做主食，配一盘酸甜软嫩的番茄菜花炒蛋，工作日晚餐快手又满足。',
    ings: '核心采购：细挂面、猪肉末、菠菜、胡萝卜、番茄、菜花、鸡蛋',
  },
  {
    slugs: ['daikon-beef-stew', 'pork-eggplant'],
    name: '★ 搭配建议：周末慢炖牛腩 ＋ 软糯肉末烧茄子',
    time: '建议统筹：周末慢炖 2.5 小时',
    desc: '适合周末从容慢火炖一锅清甜软烂的白萝卜牛腩，临开饭前炒一盘软润鲜香的肉末茄子，全家大快朵颐。',
    ings: '核心采购：牛腩、白萝卜、紫皮长茄、猪肉末',
  },
];

let currentComboIdx = 0;
const comboButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-combo-index]')];

function renderCombo(index: number) {
  const combo = curatedCombos[index % curatedCombos.length];
  if (!combo) return;
  currentComboIdx = index % curatedCombos.length;

  comboButtons.forEach((btn) => {
    btn.classList.toggle('is-active', Number(btn.dataset.comboIndex) === currentComboIdx);
  });

  const dishesEl = document.getElementById('planner-dishes');
  if (dishesEl) {
    dishesEl.innerHTML = '';
    combo.slugs.forEach((slug, i) => {
      const r = recipeMap.get(slug) || allRecipes[i];
      if (!r) return;
      const link = document.createElement('a');
      link.className = 'v2-planner-slot';
      link.href = r.v2Href;

      const img = document.createElement('img');
      img.src = r.cover;
      img.alt = r.title;
      img.width = 84;
      img.height = 84;

      const info = document.createElement('div');
      info.className = 'v2-planner-slot-info';

      const role = document.createElement('span');
      role.className = 'v2-planner-slot-role';
      role.textContent = `${i === 0 ? '主菜担当' : '搭配好味'} · ${r.category}`;

      const h3 = document.createElement('h3');
      h3.textContent = r.title;

      const p = document.createElement('p');
      p.textContent = `${r.taste} · ${r.duration}`;

      info.append(role, h3, p);
      link.append(img, info);
      dishesEl.appendChild(link);
    });
  }

  const nameEl = document.getElementById('planner-combo-name');
  const timeEl = document.getElementById('planner-combo-time');
  const descEl = document.getElementById('planner-combo-desc');
  const ingsEl = document.getElementById('planner-combo-ings');

  if (nameEl) nameEl.textContent = combo.name;
  if (timeEl) timeEl.textContent = combo.time;
  if (descEl) descEl.textContent = combo.desc;
  if (ingsEl) ingsEl.textContent = combo.ings;
}

comboButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    renderCombo(Number(btn.dataset.comboIndex || 0));
  });
});

document.getElementById('shuffle-combo')?.addEventListener('click', () => {
  renderCombo(currentComboIdx + 1);
  showToast('已为你换一桌今日配餐灵感 ✨');
});

document.getElementById('hero-random-combo')?.addEventListener('click', () => {
  renderCombo(currentComboIdx + 1);
});

// 速览步骤抽屉逻辑
const drawer = document.getElementById('v2-quick-drawer');
const closeDrawerBtn = document.getElementById('close-drawer');

function openQuickDrawer(slug: string) {
  const recipe = recipeMap.get(slug);
  if (!recipe || !drawer) return;

  const catEl = document.getElementById('drawer-category');
  const titleEl = document.getElementById('drawer-title');
  const imgEl = document.getElementById('drawer-img') as HTMLImageElement | null;
  const descEl = document.getElementById('drawer-desc');
  const metaEl = document.getElementById('drawer-meta');
  const ingsEl = document.getElementById('drawer-ingredients');
  const stepsEl = document.getElementById('drawer-steps');
  const fullLink = document.getElementById('drawer-full-link') as HTMLAnchorElement | null;

  if (catEl) catEl.textContent = `NO.${recipe.number} · ${recipe.category}`;
  if (titleEl) titleEl.textContent = recipe.title;
  if (imgEl && recipe.cover) {
    imgEl.src = recipe.cover;
    imgEl.alt = recipe.title;
  }
  if (descEl) descEl.textContent = recipe.description;
  if (metaEl) metaEl.textContent = `⏱️ ${recipe.duration} ｜ 👶 ${recipe.age}`;
  if (fullLink) fullLink.href = recipe.v2Href;

  if (ingsEl) {
    ingsEl.innerHTML = '';
    recipe.ingredients.forEach((ing) => {
      const span = document.createElement('span');
      span.className = 'v2-card-ing-pill';
      span.textContent = ing;
      ingsEl.appendChild(span);
    });
  }

  if (stepsEl) {
    stepsEl.innerHTML = '';
    recipe.steps.forEach((step, idx) => {
      const box = document.createElement('div');
      box.className = 'v2-drawer-step-item';
      const h4 = document.createElement('h4');
      h4.textContent = `STEP 0${idx + 1} · ${step.name.replace(/^第[一二三四五六七八九十\d]+步[：:]\s*/, '')}`;
      const p = document.createElement('p');
      p.textContent = step.text;
      box.append(h4, p);
      stepsEl.appendChild(box);
    });
  }

  drawer.hidden = false;
  drawer.setAttribute('aria-hidden', 'false');
}

function closeQuickDrawer() {
  if (!drawer) return;
  drawer.hidden = true;
  drawer.setAttribute('aria-hidden', 'true');
}

document.querySelectorAll<HTMLButtonElement>('[data-quick-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    openQuickDrawer(btn.dataset.quickView || '');
  });
});

closeDrawerBtn?.addEventListener('click', closeQuickDrawer);
drawer?.addEventListener('click', (e) => {
  if (e.target === drawer) closeQuickDrawer();
});

// 详情页交互：备菜进度、步骤完成打卡、全屏跟做模式、手记保存
const recipePage = document.querySelector<HTMLElement>('[data-recipe-page]');
if (recipePage) {
  const slug = recipePage.dataset.recipePage;
  const ingredientKey = `mollys-food:ingredients:${slug}:${recipePage.dataset.revision}`;
  const checkboxes = [...recipePage.querySelectorAll<HTMLInputElement>('[data-ingredient]')];
  const rawChecked = readStore<unknown>(ingredientKey, null);
  const storedChecked = Array.isArray(rawChecked)
    ? rawChecked.filter((item): item is string => typeof item === 'string')
    : null;

  if (storedChecked) {
    checkboxes.forEach((checkbox) => {
      checkbox.checked = storedChecked.includes(checkbox.dataset.ingredient!);
    });
  }

  function updateProgress() {
    const count = checkboxes.filter((checkbox) => checkbox.checked).length;
    const label = document.querySelector('#ingredient-count');
    const progress = document.querySelector<HTMLProgressElement>('#ingredient-progress');
    if (label) {
      label.textContent =
        count === checkboxes.length && count > 0
          ? `全部备齐，开火做菜吧！ ${count} / ${count}`
          : `已备好 ${count} / ${checkboxes.length} 项`;
    }
    if (progress) progress.value = count;
  }

  checkboxes.forEach((checkbox) =>
    checkbox.addEventListener('change', () => {
      const saved = writeStore(
        ingredientKey,
        checkboxes.filter((input) => input.checked).map((input) => input.dataset.ingredient),
      );
      if (!saved) showToast('备菜进度仅在本次页面中保留');
      updateProgress();
    }),
  );

  document.querySelector('#reset-ingredients')?.addEventListener('click', () => {
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
    writeStore(ingredientKey, []);
    updateProgress();
  });
  updateProgress();

  // 为每个步骤卡片注入“完成本步”打卡按钮，并收集数据供全屏跟做使用
  const stepElements = [...recipePage.querySelectorAll<HTMLElement>('.recipe-step')];
  const parsedSteps: { img: string; title: string; html: string }[] = [];

  stepElements.forEach((stepEl, idx) => {
    const imgEl = stepEl.querySelector<HTMLImageElement>('.step-photo img');
    const titleEl = stepEl.querySelector<HTMLElement>('.step-body h3');
    const bodyEl = stepEl.querySelector<HTMLElement>('.step-body');
    const paragraphs = bodyEl
      ? [...bodyEl.querySelectorAll('p')].map((p) => p.outerHTML).join('')
      : '';

    parsedSteps.push({
      img: imgEl?.src || '',
      title: titleEl?.textContent || `第 ${idx + 1} 步`,
      html: paragraphs,
    });

    if (bodyEl) {
      const doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.className = 'v2-step-done-btn';
      doneBtn.textContent = `○ 标记第 ${idx + 1} 步已完成`;
      doneBtn.addEventListener('click', () => {
        const done = stepEl.classList.toggle('is-step-done');
        doneBtn.classList.toggle('is-checked', done);
        doneBtn.textContent = done ? `✓ 第 ${idx + 1} 步已完成` : `○ 标记第 ${idx + 1} 步已完成`;
      });
      bodyEl.appendChild(doneBtn);
    }
  });

  // 全屏跟做模式 (Cooking Focus Modal)
  const cookModal = document.getElementById('v2-cook-modal');
  const openCookBtn = document.getElementById('open-cook-mode');
  const closeCookBtn = document.getElementById('close-cook-mode');
  const prevCookBtn = document.getElementById('cook-prev-btn') as HTMLButtonElement | null;
  const nextCookBtn = document.getElementById('cook-next-btn') as HTMLButtonElement | null;
  let activeStepIndex = 0;

  function renderCookStep(idx: number) {
    if (parsedSteps.length === 0) return;
    activeStepIndex = Math.max(0, Math.min(parsedSteps.length - 1, idx));
    const step = parsedSteps[activeStepIndex];

    const imgEl = document.getElementById('cook-step-img') as HTMLImageElement | null;
    const counterEl = document.getElementById('cook-step-counter');
    const titleEl = document.getElementById('cook-step-title');
    const textEl = document.getElementById('cook-step-text');
    const dotsEl = document.getElementById('cook-step-dots');

    if (imgEl && step.img) {
      imgEl.src = step.img;
      imgEl.alt = step.title;
    }
    if (counterEl) {
      counterEl.textContent = `STEP ${String(activeStepIndex + 1).padStart(2, '0')} / ${String(parsedSteps.length).padStart(2, '0')}`;
    }
    if (titleEl) titleEl.textContent = step.title;
    if (textEl) textEl.innerHTML = step.html;
    if (dotsEl) dotsEl.textContent = `步骤 ${activeStepIndex + 1} / ${parsedSteps.length}`;

    if (prevCookBtn) prevCookBtn.disabled = activeStepIndex === 0;
    if (nextCookBtn) {
      nextCookBtn.querySelector('span')!.textContent =
        activeStepIndex === parsedSteps.length - 1 ? '完成做菜 ✓' : '下一步';
    }
  }

  function openCookModal() {
    if (!cookModal || parsedSteps.length === 0) return;
    renderCookStep(0);
    cookModal.hidden = false;
    cookModal.setAttribute('aria-hidden', 'false');
  }

  function closeCookModal() {
    if (!cookModal) return;
    cookModal.hidden = true;
    cookModal.setAttribute('aria-hidden', 'true');
  }

  openCookBtn?.addEventListener('click', openCookModal);
  closeCookBtn?.addEventListener('click', closeCookModal);
  cookModal?.addEventListener('click', (e) => {
    if (e.target === cookModal) closeCookModal();
  });

  prevCookBtn?.addEventListener('click', () => renderCookStep(activeStepIndex - 1));
  nextCookBtn?.addEventListener('click', () => {
    if (activeStepIndex === parsedSteps.length - 1) {
      closeCookModal();
      showToast('辛苦啦！记得先盛出茉莉的清淡份哦 ♡');
    } else {
      renderCookStep(activeStepIndex + 1);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (cookModal && !cookModal.hidden) {
      if (e.key === 'Escape') closeCookModal();
      else if (e.key === 'ArrowLeft') renderCookStep(activeStepIndex - 1);
      else if (e.key === 'ArrowRight') renderCookStep(activeStepIndex + 1);
    } else if (drawer && !drawer.hidden && e.key === 'Escape') {
      closeQuickDrawer();
    }
  });

  // 下次调整手记保存
  const noteKey = `mollys-food:note:${slug}`;
  const note = document.querySelector<HTMLTextAreaElement>('#recipe-note');
  const noteStatus = document.querySelector('#note-status');
  if (note) {
    const storedNote = readStore<unknown>(noteKey, '');
    note.value = typeof storedNote === 'string' ? storedNote : '';
    note.addEventListener('input', () => {
      const persisted = writeStore(noteKey, note.value);
      if (noteStatus) {
        noteStatus.textContent = persisted
          ? '已自动保存 · 仅在当前浏览器可见'
          : '浏览器无法保存，请复制保留这份记录';
      }
    });
    document.querySelector('#clear-note')?.addEventListener('click', () => {
      if (!note.value) return;
      if (!window.confirm('清空这道菜的调整记录？此操作无法撤销。')) return;
      note.value = '';
      writeStore(noteKey, '');
      if (noteStatus) noteStatus.textContent = '记录已清空';
    });
  }

  document.querySelector('#print-recipe')?.addEventListener('click', () => window.print());
}
