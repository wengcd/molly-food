const FAVORITES_KEY = 'mollys-food:favorites:v1';
const memoryStore = new Map<string, unknown>();
let toastTimeout: ReturnType<typeof setTimeout>;

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
  } catch { /* Browsing still works when storage is unavailable. */ }
  return (memoryStore.get(key) as T) ?? fallback;
}

function writeStore(key: string, value: unknown): boolean {
  memoryStore.set(key, value);
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

function getFavorites(): string[] {
  const stored = readStore<unknown>(FAVORITES_KEY, []);
  return Array.isArray(stored) ? [...new Set(stored.filter((item): item is string => typeof item === 'string'))] : [];
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
  document.querySelectorAll<HTMLElement>('[data-saved-count]').forEach((count) => { count.textContent = String(favorites.length); count.hidden = favorites.length === 0; });
}

document.querySelectorAll<HTMLButtonElement>('[data-favorite]').forEach((button) => {
  button.addEventListener('click', () => {
    const slug = button.dataset.favorite!;
    const favorites = getFavorites();
    const saved = favorites.includes(slug);
    const persisted = writeStore(FAVORITES_KEY, saved ? favorites.filter((item) => item !== slug) : [...favorites, slug]);
    syncFavorites();
    updateCollection();
    showToast(persisted ? (saved ? '已从收藏中移除' : '已收进你的私房菜谱 ♡') : '浏览器无法保存记录，本次页面内仍可使用');
  });
});
syncFavorites();

const search = document.querySelector<HTMLInputElement>('#recipe-search');
const filterButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-filter]')];
const cards = [...document.querySelectorAll<HTMLElement>('[data-recipe-card]')];
let activeFilter = 'all';
const urlParams = new URLSearchParams(location.search);
if (search) {
  search.value = urlParams.get('q') || '';
  const requestedFilter = urlParams.get('view') === 'saved' ? 'saved' : urlParams.get('category') || 'all';
  if (filterButtons.some((button) => button.dataset.filter === requestedFilter)) activeFilter = requestedFilter;
}

function updateCollection(updateUrl = false) {
  if (!search) return;
  const query = search.value.toLocaleLowerCase().trim();
  const terms = query.split(/\s+/).filter(Boolean);
  const favorites = getFavorites();
  let count = 0;
  cards.forEach((card) => {
    const matchesFilter = activeFilter === 'all' || (activeFilter === 'saved' ? favorites.includes(card.dataset.slug || '') : card.dataset.category === activeFilter);
    const matchesSearch = terms.every((term) => card.dataset.search?.toLocaleLowerCase().includes(term));
    card.hidden = !(matchesFilter && matchesSearch);
    if (!card.hidden) count++;
  });
  filterButtons.forEach((button) => { const selected = button.dataset.filter === activeFilter; button.classList.toggle('is-active', selected); button.setAttribute('aria-pressed', String(selected)); });
  const resultCount = document.querySelector('[data-result-count]');
  if (resultCount) resultCount.textContent = `共 ${count} 道好味`;
  const empty = document.querySelector<HTMLElement>('#empty-state');
  if (empty) {
    empty.hidden = count > 0;
    const noFavorites = activeFilter === 'saved' && !query && favorites.length === 0;
    empty.querySelector('[data-empty-title]')!.textContent = noFavorites ? '把喜欢的味道，留在这里' : '还没找到这道好味';
    empty.querySelector('[data-empty-description]')!.textContent = noFavorites ? '点一下菜谱上的爱心，下次想做时就能轻松找到。收藏仅保存在当前浏览器。' : '试试其他菜名，或用“番茄”“鸡蛋”这样的食材搜索。';
  }
  const notebook = document.querySelector<HTMLElement>('[data-collection-note]');
  if (notebook) notebook.hidden = activeFilter !== 'all' || Boolean(query) || count === 0;
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
filterButtons.forEach((button) => button.addEventListener('click', () => { activeFilter = button.dataset.filter!; updateCollection(true); }));
document.querySelector('#reset-filters')?.addEventListener('click', () => { activeFilter = 'all'; if (search) search.value = ''; updateCollection(true); search?.focus({ preventScroll: true }); });
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !(event.target instanceof HTMLElement && (event.target.closest('input, textarea, select, [contenteditable="true"]')))) { if (search) { event.preventDefault(); search.focus(); } }
});
window.addEventListener('storage', (event) => { if (event.key === FAVORITES_KEY || event.key === null) { syncFavorites(); updateCollection(); } });
updateCollection();

const recipePage = document.querySelector<HTMLElement>('[data-recipe-page]');
if (recipePage) {
  const slug = recipePage.dataset.recipePage;
  const ingredientKey = `mollys-food:ingredients:${slug}:${recipePage.dataset.revision}`;
  const checkboxes = [...recipePage.querySelectorAll<HTMLInputElement>('[data-ingredient]')];
  const rawChecked = readStore<unknown>(ingredientKey, null);
  const storedChecked = Array.isArray(rawChecked) ? rawChecked.filter((item): item is string => typeof item === 'string') : null;
  if (storedChecked) checkboxes.forEach((checkbox) => { checkbox.checked = storedChecked.includes(checkbox.dataset.ingredient!); });
  function updateProgress() {
    const count = checkboxes.filter((checkbox) => checkbox.checked).length;
    const label = document.querySelector('#ingredient-count');
    const progress = document.querySelector<HTMLProgressElement>('#ingredient-progress');
    if (label) label.textContent = count === checkboxes.length && count > 0 ? `全部备好，开始做菜吧！ ${count} / ${count}` : `已备好 ${count} / ${checkboxes.length} 项`;
    if (progress) progress.value = count;
  }
  checkboxes.forEach((checkbox) => checkbox.addEventListener('change', () => {
    const saved = writeStore(ingredientKey, checkboxes.filter((input) => input.checked).map((input) => input.dataset.ingredient));
    if (!saved) showToast('备菜进度仅在本次页面中保留');
    updateProgress();
  }));
  document.querySelector('#reset-ingredients')?.addEventListener('click', () => { checkboxes.forEach((checkbox) => { checkbox.checked = false; }); writeStore(ingredientKey, []); updateProgress(); });
  updateProgress();

  const noteKey = `mollys-food:note:${slug}`;
  const note = document.querySelector<HTMLTextAreaElement>('#recipe-note');
  const noteStatus = document.querySelector('#note-status');
  if (note) {
    const storedNote = readStore<unknown>(noteKey, '');
    note.value = typeof storedNote === 'string' ? storedNote : '';
    note.addEventListener('input', () => { const persisted = writeStore(noteKey, note.value); if (noteStatus) noteStatus.textContent = persisted ? '已自动保存 · 仅在当前浏览器可见' : '浏览器无法保存，请复制保留这份记录'; });
    document.querySelector('#clear-note')?.addEventListener('click', () => {
      if (!note.value) return;
      if (!window.confirm('清空这道菜的调整记录？此操作无法撤销。')) return;
      note.value = ''; writeStore(noteKey, ''); if (noteStatus) noteStatus.textContent = '记录已清空';
    });
  }
  document.querySelector('#print-recipe')?.addEventListener('click', () => window.print());
}
