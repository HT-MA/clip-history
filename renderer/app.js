let allItems = [];
let isPaused = false;
let selectedIndex = -1;
let lastSearchQuery = '';

// ─── DOM refs ───
const searchInput = document.getElementById('searchInput');
const itemsList = document.getElementById('itemsList');
const emptyState = document.getElementById('emptyState');
const footerCount = document.getElementById('footerCount');
const toast = document.getElementById('toast');
const btnPause = document.getElementById('btnPause');
const btnClear = document.getElementById('btnClear');
const searchHint = document.getElementById('searchHint');
const statusDot = document.getElementById('statusDot');

// Modal refs
const modalOverlay = document.getElementById('modalOverlay');
const modalBody = document.getElementById('modalBody');
const modalTime = document.getElementById('modalTime');
const modalClose = document.getElementById('modalClose');
const modalCopy = document.getElementById('modalCopy');
let currentModalItem = null;

// Context menu refs
const ctxMenu = document.getElementById('ctxMenu');
let ctxTarget = null;

// Confirm dialog refs
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmMsg = document.getElementById('confirmMsg');
const confirmCancel = document.getElementById('confirmCancel');
const confirmOk = document.getElementById('confirmOk');
let confirmCallback = null;

// ─── Helpers ───
function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === now.toDateString()) return hm;
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

function formatFullTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function previewText(text) {
  if (!text) return '';
  let p = text.replace(/\n/g, ' ');
  if (p.length > 120) p = p.slice(0, 120) + '\u2026';
  return p;
}

// ─── Client-side search ───
function filterItems(query) {
  if (!query) return allItems;

  if (query.startsWith('!')) {
    const rest = query.slice(1).trim().toLowerCase();
    const favs = allItems.filter(i => i.isFavorite);
    if (!rest) return favs;
    return favs.filter(i => {
      if (i.contentType === 'image') return false;
      return i.content.toLowerCase().includes(rest);
    });
  }

  const q = query.toLowerCase();
  return allItems.filter(i => {
    if (i.contentType === 'image') return false;
    return i.content.toLowerCase().includes(q);
  });
}

// ─── Toast ───
let toastTimer = null;
function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1200);
}

// ─── Confirm dialog ───
function showConfirm(msg, callback) {
  confirmMsg.textContent = msg;
  confirmCallback = callback;
  confirmOverlay.classList.add('show');
}

function hideConfirm() {
  confirmOverlay.classList.remove('show');
  confirmCallback = null;
}

confirmCancel.addEventListener('click', hideConfirm);
confirmOverlay.addEventListener('click', (e) => {
  if (e.target === confirmOverlay) hideConfirm();
});
confirmOk.addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
  hideConfirm();
});

// ─── Context Menu ───
function showCtxMenu(e, item) {
  e.preventDefault();
  e.stopPropagation();
  ctxTarget = item;
  ctxMenu.style.left = e.clientX + 'px';
  ctxMenu.style.top = e.clientY + 'px';
  ctxMenu.classList.add('show');
}

function hideCtxMenu() {
  ctxMenu.classList.remove('show');
  ctxTarget = null;
}

document.addEventListener('click', hideCtxMenu);
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('.item-card')) hideCtxMenu();
});

document.getElementById('ctxCopy').addEventListener('click', async () => {
  if (!ctxTarget) return;
  if (ctxTarget.contentType === 'image') {
    await window.clipAPI.copyImageItem(ctxTarget.content);
  } else {
    await window.clipAPI.copyItem(ctxTarget.content);
  }
  showToast('Copied to clipboard');
  hideCtxMenu();
});

document.getElementById('ctxPaste').addEventListener('click', async () => {
  if (!ctxTarget) return;
  if (ctxTarget.contentType === 'image') {
    await window.clipAPI.copyImageItem(ctxTarget.content);
  } else {
    await window.clipAPI.copyItem(ctxTarget.content);
  }
  await window.clipAPI.pasteToActive();
  showToast('Pasted');
  hideCtxMenu();
});

document.getElementById('ctxFavorite').addEventListener('click', async () => {
  if (!ctxTarget) return;
  ctxTarget.isFavorite = !ctxTarget.isFavorite;
  await window.clipAPI.toggleFavorite(ctxTarget.id);
  const card = itemsList.querySelector(`[data-id="${ctxTarget.id}"]`);
  if (card) updateCardStar(card, ctxTarget);
  hideCtxMenu();
});

document.getElementById('ctxDelete').addEventListener('click', async () => {
  if (!ctxTarget) return;
  await window.clipAPI.deleteItem(ctxTarget.id);
  allItems = allItems.filter(i => i.id !== ctxTarget.id);
  renderFiltered(lastSearchQuery);
  showToast('Deleted');
  hideCtxMenu();
});

// ─── Card builder ───
function buildCard(item, index) {
  const card = document.createElement('div');
  card.className = 'item-card';
  card.dataset.index = index;
  card.dataset.id = item.id;

  // Image thumbnail
  if (item.contentType === 'image') {
    const thumb = document.createElement('img');
    thumb.className = 'item-thumb';
    thumb.src = item.content;
    card.appendChild(thumb);

    const badge = document.createElement('span');
    badge.className = 'item-image-badge';
    badge.textContent = '\uD83D\uDDBC Image';
    card.appendChild(badge);
  } else {
    // Time
    const time = document.createElement('div');
    time.className = 'item-time';
    time.textContent = formatTime(item.createdAt);

    // Content preview
    const content = document.createElement('div');
    content.className = 'item-content';
    content.textContent = previewText(item.content);
    content.title = item.content;

    card.appendChild(time);
    card.appendChild(content);
  }

  // Actions row
  const actions = document.createElement('div');
  actions.className = 'item-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'item-action-btn copy-btn';
  copyBtn.innerHTML = '\uD83D\uDCCB';
  copyBtn.title = 'Copy';
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (item.contentType === 'image') {
      await window.clipAPI.copyImageItem(item.content);
    } else {
      await window.clipAPI.copyItem(item.content);
    }
    card.classList.add('copied');
    setTimeout(() => card.classList.remove('copied'), 600);
    showToast('Copied to clipboard');
  });

  const pasteBtn = document.createElement('button');
  pasteBtn.className = 'item-action-btn copy-btn';
  pasteBtn.innerHTML = '\uD83D\uDCC4';
  pasteBtn.title = 'Paste to active window';
  pasteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (item.contentType === 'image') {
      await window.clipAPI.copyImageItem(item.content);
    } else {
      await window.clipAPI.copyItem(item.content);
    }
    await window.clipAPI.pasteToActive();
    showToast('Pasted');
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'item-action-btn delete-btn';
  delBtn.innerHTML = '\uD83D\uDDD1';
  delBtn.title = 'Delete';
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await window.clipAPI.deleteItem(item.id);
    allItems = allItems.filter(i => i.id !== item.id);
    renderFiltered(lastSearchQuery);
    showToast('Deleted');
  });

  actions.appendChild(copyBtn);
  actions.appendChild(pasteBtn);
  actions.appendChild(delBtn);

  // Star button
  const star = document.createElement('button');
  star.className = `item-star ${item.isFavorite ? 'active' : 'inactive'}`;
  star.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  star.title = item.isFavorite ? 'Unstar' : 'Star';
  star.addEventListener('click', async (e) => {
    e.stopPropagation();
    item.isFavorite = !item.isFavorite;
    await window.clipAPI.toggleFavorite(item.id);
    updateCardStar(card, item);
  });

  // Right-click context menu
  card.addEventListener('contextmenu', (e) => showCtxMenu(e, item));

  card.addEventListener('click', () => showDetail(item));

  card.appendChild(star);
  card.appendChild(actions);

  return card;
}

function updateCardStar(card, item) {
  const star = card.querySelector('.item-star');
  if (!star) return;
  star.className = `item-star ${item.isFavorite ? 'active' : 'inactive'}`;
  star.title = item.isFavorite ? 'Unstar' : 'Star';
}

// ─── Render ───
function renderFiltered(query) {
  if (query === undefined) query = lastSearchQuery;
  else lastSearchQuery = query;

  const visible = filterItems(query);
  itemsList.querySelectorAll('.item-card').forEach(c => c.remove());

  if (visible.length === 0) {
    emptyState.style.display = 'flex';
    footerCount.textContent = '0 items';
  } else {
    emptyState.style.display = 'none';
    footerCount.textContent = `${visible.length} item${visible.length !== 1 ? 's' : ''}`;

    const frag = document.createDocumentFragment();
    visible.forEach((item, index) => {
      frag.appendChild(buildCard(item, index));
    });
    itemsList.appendChild(frag);
  }

  // Update search hint
  if (query.startsWith('!')) {
    const rest = query.slice(1).trim();
    searchHint.textContent = rest ? `\u2605 "${rest}"` : '\u2605 Starred only';
  } else if (query) {
    searchHint.textContent = `${visible.length} found`;
  } else {
    searchHint.textContent = '';
  }

  selectedIndex = -1;
}

function prependNewCards(newItems) {
  if (lastSearchQuery) {
    allItems = newItems;
    renderFiltered(lastSearchQuery);
    return;
  }

  const existingIds = new Set(allItems.map(i => i.id));
  const fresh = newItems.filter(i => !existingIds.has(i.id));

  allItems = newItems;

  if (fresh.length === 0) return;

  const frag = document.createDocumentFragment();
  fresh.forEach(item => frag.appendChild(buildCard(item, 0)));

  const firstCard = itemsList.querySelector('.item-card');
  if (firstCard) {
    itemsList.insertBefore(frag, firstCard);
  } else {
    itemsList.appendChild(frag);
    emptyState.style.display = 'none';
  }

  // Trim excess cards beyond 500
  const allCards = itemsList.querySelectorAll('.item-card');
  for (let i = 500; i < allCards.length; i++) {
    allCards[i].remove();
  }

  footerCount.textContent = `${allItems.length} item${allItems.length !== 1 ? 's' : ''}`;
}

// ─── Modal ───
function showDetail(item) {
  currentModalItem = item;
  if (item.contentType === 'image') {
    modalBody.innerHTML = `<img src="${item.content}" style="max-width:100%;border-radius:8px;" alt="Clipboard image"/>`;
  } else {
    modalBody.textContent = item.content;
  }
  modalTime.textContent = formatFullTime(item.createdAt);
  modalOverlay.classList.add('show');
}

function closeModal() {
  modalOverlay.classList.remove('show');
  currentModalItem = null;
}

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
modalClose.addEventListener('click', closeModal);
modalCopy.addEventListener('click', async () => {
  if (currentModalItem) {
    if (currentModalItem.contentType === 'image') {
      await window.clipAPI.copyImageItem(currentModalItem.content);
    } else {
      await window.clipAPI.copyItem(currentModalItem.content);
    }
    showToast('Copied to clipboard');
    closeModal();
  }
});

// ─── Search ───
let searchTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => renderFiltered(searchInput.value), 50);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (searchInput.value) {
      searchInput.value = '';
      renderFiltered('');
    } else {
      window.clipAPI.hideWindow();
    }
    return;
  }
  const cards = itemsList.querySelectorAll('.item-card');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (cards.length === 0) return;
    selectedIndex = Math.min(selectedIndex + 1, cards.length - 1);
    updateSelection(cards);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (cards.length === 0) return;
    selectedIndex = Math.max(selectedIndex - 1, 0);
    updateSelection(cards);
  } else if (e.key === 'Enter' && selectedIndex >= 0) {
    e.preventDefault();
    const card = cards[selectedIndex];
    if (card) card.click();
  }
});

function updateSelection(cards) {
  cards.forEach((c, i) => {
    c.style.outline = i === selectedIndex ? '2px solid #34c759' : '';
    c.style.outlineOffset = '-2px';
    if (i === selectedIndex) c.scrollIntoView({ block: 'nearest' });
  });
}

// ─── Buttons ───
const btnMinimize = document.getElementById('btnMinimize');
btnMinimize.addEventListener('click', () => window.clipAPI.minimizeWindow());

const btnHide = document.getElementById('btnHide');
btnHide.addEventListener('click', () => window.clipAPI.hideWindow());

const btnExport = document.getElementById('btnExport');
btnExport.addEventListener('click', () => window.clipAPI.exportData());

const btnImport = document.getElementById('btnImport');
btnImport.addEventListener('click', async () => {
  await window.clipAPI.importData();
});

btnPause.addEventListener('click', async () => {
  isPaused = await window.clipAPI.togglePause();
  updatePauseUI();
});

btnClear.addEventListener('click', () => {
  if (allItems.length === 0) return;
  showConfirm('Clear all clipboard history? This cannot be undone.', async () => {
    await window.clipAPI.clearAll();
    allItems = [];
    renderFiltered('');
    searchInput.value = '';
    showToast('History cleared');
  });
});

function updatePauseUI() {
  btnPause.textContent = isPaused ? 'Resume' : 'Pause';
  btnPause.classList.toggle('active', isPaused);
  statusDot.classList.toggle('paused', isPaused);
}

// ─── Events from main process ───
window.clipAPI.onItemsUpdated((newItems) => {
  prependNewCards(newItems);
});
window.clipAPI.onHistoryCleared(() => {
  allItems = [];
  renderFiltered('');
  searchInput.value = '';
  searchHint.textContent = '';
});
window.clipAPI.onPauseChanged((paused) => {
  isPaused = paused;
  updatePauseUI();
});
window.clipAPI.onWindowShown(() => {
  renderFiltered('');
  searchInput.value = '';
  searchHint.textContent = '';
  searchInput.focus();
});
window.clipAPI.onConfirmClear(() => {
  showConfirm('Clear all clipboard history? This cannot be undone.', async () => {
    await window.clipAPI.clearAll();
    allItems = [];
    renderFiltered('');
    searchInput.value = '';
    showToast('History cleared');
  });
});
window.clipAPI.onToastShow((text) => {
  showToast(text);
});

// ─── Init ───
(async () => {
  allItems = await window.clipAPI.getAllItems();
  renderFiltered('');
  setTimeout(() => searchInput.focus(), 150);
})();