/**
 * Anki-Web Main Application
 * A browser-based spaced repetition flashcard app
 */

const App = {
  currentView: 'home',
  currentDeckId: null,
  reviewQueue: [],
  reviewIndex: 0,
  isFlipped: false,
  sessionStats: { reviewed: 0, correct: 0, startTime: null },

  async init() {
    await DB.init();
    this.bindEvents();
    this.bindKeyboard(); this.bindSwipe();
    this.setupImport();
    await this.renderHome();
    this.hideLoading();
  },

  hideLoading() {
    const el = document.getElementById('loading');
    if (el) { el.style.opacity = '0'; setTimeout(() => el.style.display = 'none', 300); }
  },

  showView(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const vEl = document.getElementById('view-' + view);
    if (vEl) vEl.classList.add('active');
    // Update nav button highlights
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const navMap = { home: 'nav-home', import: 'nav-import', stats: 'nav-stats', settings: 'nav-settings' };
    const navBtn = document.getElementById(navMap[view]);
    if (navBtn) navBtn.classList.add('active');
    this.currentView = view;
  },

  // ========== HOME ==========
  async renderHome() {
    this.showView('home');
    try {
    const decks = await DB.getAllDecks();
    const allCards = await DB.getAllCards();
    const dueCards = SM2.getDueCards(allCards);
    const newCards = SM2.getNewCards(allCards);
    const learningCards = allCards.filter(c => { const s = SM2.getStatus(c); return s === 'learning' || s === 'relearning'; });

    document.getElementById('stat-due').textContent = dueCards.length;
    document.getElementById('stat-new').textContent = newCards.length;
    document.getElementById('stat-learning').textContent = learningCards.length;
    document.getElementById('stat-total').textContent = allCards.length;

    const deckList = document.getElementById('deck-list');
    if (decks.length === 0) {
      deckList.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><h3>还没有牌组</h3><p>创建你的第一个牌组开始学习吧！</p><button class="btn btn-primary" onclick="App.showCreateDeck()"><span>➕</span> 创建牌组</button> <button class="btn btn-secondary" onclick="App.loadSampleDecks()" style="margin-top:8px"><span>📦</span> 加载示例牌组</button></div>';
      return;
    }

    deckList.innerHTML = '';
    for (const deck of decks) {
      const cards = await DB.getCardsByDeck(deck.id);
      const due = SM2.getDueCards(cards);
      const nc = SM2.getNewCards(cards).length;
      const lr = cards.filter(c => { const s = SM2.getStatus(c); return s === 'learning' || s === 'relearning'; }).length;

      const el = document.createElement('div');
      el.className = 'deck-card';
      el.innerHTML = '<div class="deck-info" onclick="App.openDeck(\'' + deck.id + '\')">' +
        '<div class="deck-icon">' + deck.icon + '</div>' +
        '<div class="deck-details"><h3>' + this.esc(deck.name) + '</h3><p>' + this.esc(deck.description || cards.length + ' 张卡片') + '</p></div></div>' +
        '<div class="deck-stats">' +
        '<div class="deck-stat"><span class="stat-number due">' + due.length + '</span><span class="stat-label">待复习</span></div>' +
        '<div class="deck-stat"><span class="stat-number new">' + nc + '</span><span class="stat-label">新卡片</span></div>' +
        '<div class="deck-stat"><span class="stat-number learning">' + lr + '</span><span class="stat-label">学习中</span></div></div>' +
        '<div class="deck-actions">' +
        (due.length > 0 ? '<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();App.startReview(\'' + deck.id + '\')">开始学习</button>' : '<span class="text-muted">已完成 ✓</span>') +
        ' <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();App.showDeckMenu(\'' + deck.id + '\')" title="更多">⋯</button></div>';
      deckList.appendChild(el);
    }
    } catch(e) { console.error('renderHome error:', e); }
  },

  // ========== DECK MANAGEMENT ==========
  showCreateDeck() {
    document.getElementById('deck-modal-title').textContent = '创建牌组';
    document.getElementById('deck-id').value = '';
    document.getElementById('deck-name').value = '';
    document.getElementById('deck-description').value = '';
    document.getElementById('deck-icon').value = '📚';
    document.getElementById('deck-modal').classList.add('active');
  },

  async showEditDeck(deckId) {
    const deck = await DB.getDeck(deckId);
    if (!deck) return;
    document.getElementById('deck-modal-title').textContent = '编辑牌组';
    document.getElementById('deck-id').value = deck.id;
    document.getElementById('deck-name').value = deck.name;
    document.getElementById('deck-description').value = deck.description || '';
    document.getElementById('deck-icon').value = deck.icon;
    document.getElementById('deck-modal').classList.add('active');
  },

  async saveDeck() {
    const id = document.getElementById('deck-id').value;
    const name = document.getElementById('deck-name').value.trim();
    const desc = document.getElementById('deck-description').value.trim();
    const icon = document.getElementById('deck-icon').value || '📚';
    if (!name) { this.showToast('请输入牌组名称', 'warning'); return; }
    if (id) { await DB.updateDeck(id, { name, description: desc, icon }); this.showToast('牌组已更新'); }
    else { await DB.addDeck({ name, description: desc, icon }); this.showToast('牌组已创建'); }
    document.getElementById('deck-modal').classList.remove('active');
    await this.renderHome();
  },

  async deleteDeck(deckId) {
    if (!confirm('确定要删除这个牌组及其所有卡片吗？')) return;
    await DB.deleteDeck(deckId);
    this.showToast('牌组已删除');
    await this.renderHome();
  },

  showDeckMenu(deckId) {
    this.showActionSheet([
      { label: '📝 编辑牌组', fn: "App.showEditDeck('" + deckId + "')" },
      { label: '➕ 添加卡片', fn: "App.showAddCard('" + deckId + "')" },
      { label: '📤 导出牌组', fn: "App.exportDeck('" + deckId + "')" },
      { label: '🗑️ 删除牌组', fn: "App.deleteDeck('" + deckId + "')", danger: true }
    ]);
  },

  // ========== DECK DETAIL ==========
  async openDeck(deckId) {
    this.currentDeckId = deckId;
    const deck = await DB.getDeck(deckId);
    if (!deck) return;
    const cards = await DB.getCardsByDeck(deckId);
    const due = SM2.getDueCards(cards);

    document.getElementById('deck-detail-title').textContent = deck.icon + ' ' + deck.name;
    document.getElementById('deck-detail-count').textContent = cards.length + ' 张卡片 · ' + due.length + ' 待复习';
    const btn = document.getElementById('deck-detail-start');
    btn.style.display = due.length > 0 ? 'flex' : 'none';
    btn.onclick = () => this.startReview(deckId);

    const cardList = document.getElementById('card-list');
    if (cards.length === 0) {
      cardList.innerHTML = '<div class="empty-state"><div class="empty-icon">🃏</div><h3>还没有卡片</h3><p>添加第一张卡片吧！</p></div>';
    } else {
      cardList.innerHTML = '';
      cards.sort((a, b) => new Date(b.created) - new Date(a.created)).forEach(card => {
        const status = SM2.getStatus(card);
        const sMap = { new: '新', learning: '学习中', review: '复习', relearning: '重学' };
        const el = document.createElement('div');
        el.className = 'card-item' + (card.starred ? ' starred' : '');
        el.innerHTML = '<div class="card-content" onclick="App.showEditCard(\'' + card.id + '\')">' +
          '<div class="card-front">' + this.esc(card.front).substring(0, 100) + '</div>' +
          '<div class="card-back">' + this.esc(card.back).substring(0, 100) + '</div></div>' +
          '<div class="card-meta"><span class="card-status status-' + status + '">' + sMap[status] + '</span>' +
          (card.interval ? '<span class="card-interval">' + SM2.formatInterval(card.interval) + '</span>' : '') + '</div>' +
          '<div class="card-actions">' +
          '<button class="btn-icon" onclick="event.stopPropagation();App.toggleStar(\'' + card.id + '\')" title="标星">' + (card.starred ? '⭐' : '☆') + '</button>' +
          '<button class="btn-icon" onclick="event.stopPropagation();App.deleteCardConfirm(\'' + card.id + '\')" title="删除">🗑️</button></div>';
        cardList.appendChild(el);
      });
    }
    this._currentDeckCards = cards;
    document.getElementById('btn-show-all').style.display = cards.length > 0 ? 'inline-flex' : 'none';
    this.showView('deck-detail');
  },

  showAllCards() {
    const cards = this._currentDeckCards || [];
    const list = document.getElementById('card-list');
    if (cards.length === 0) return;
    // Toggle between truncated and full view
    const isFull = list.classList.toggle('full-view');
    list.innerHTML = '';
    cards.sort((a, b) => new Date(b.created) - new Date(a.created)).forEach(card => {
      const status = SM2.getStatus(card);
      const sMap = { new: '新', learning: '学习中', review: '复习', relearning: '重学' };
      const el = document.createElement('div');
      el.className = 'card-item' + (card.starred ? ' starred' : '') + (isFull ? ' expanded' : '');
      const maxLen = isFull ? 2000 : 100;
      el.innerHTML = '<div class="card-content" onclick="App.showEditCard('' + card.id + '')">' +
        '<div class="card-front">' + this.esc(card.front).substring(0, maxLen) + '</div>' +
        '<div class="card-back">' + this.esc(card.back).substring(0, maxLen).replace(/
/g, '<br>') + '</div></div>' +
        '<div class="card-meta"><span class="card-status status-' + status + '">' + sMap[status] + '</span>' +
        (card.interval ? '<span class="card-interval">' + SM2.formatInterval(card.interval) + '</span>' : '') + '</div>' +
        '<div class="card-actions">' +
        '<button class="btn-icon" onclick="event.stopPropagation();App.toggleStar('' + card.id + '')" title="标星">' + (card.starred ? '⭐' : '☆') + '</button>' +
        '<button class="btn-icon" onclick="event.stopPropagation();App.deleteCardConfirm('' + card.id + '')" title="删除">🗑️</button></div>';
      list.appendChild(el);
    });
    document.getElementById('btn-show-all').textContent = isFull ? '▶ 收起' : '▶ 查看全部';
  },

  // ========== CARD MANAGEMENT ==========
  showAddCard(deckId) {
    document.getElementById('card-modal-title').textContent = '添加卡片';
    document.getElementById('card-id').value = '';
    document.getElementById('card-deck-id').value = deckId || this.currentDeckId;
    document.getElementById('card-front').value = '';
    document.getElementById('card-back').value = '';
    document.getElementById('card-tags').value = '';
    document.getElementById('card-modal').classList.add('active');
    setTimeout(() => document.getElementById('card-front').focus(), 100);
  },

  async showEditCard(cardId) {
    const card = await DB.getCard(cardId);
    if (!card) return;
    document.getElementById('card-modal-title').textContent = '编辑卡片';
    document.getElementById('card-id').value = card.id;
    document.getElementById('card-deck-id').value = card.deckId;
    document.getElementById('card-front').value = card.front;
    document.getElementById('card-back').value = card.back;
    document.getElementById('card-tags').value = (card.tags || []).join(', ');
    document.getElementById('card-modal').classList.add('active');
  },

  async saveCard() {
    const id = document.getElementById('card-id').value;
    const deckId = document.getElementById('card-deck-id').value;
    const front = document.getElementById('card-front').value.trim();
    const back = document.getElementById('card-back').value.trim();
    const tagsStr = document.getElementById('card-tags').value.trim();
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
    if (!front || !back) { this.showToast('请填写正面和背面内容', 'warning'); return; }
    if (id) { await DB.updateCard(id, { front, back, tags }); this.showToast('卡片已更新'); }
    else { await DB.addCard({ deckId, front, back, tags }); this.showToast('卡片已添加'); }
    document.getElementById('card-modal').classList.remove('active');
    if (this.currentView === 'deck-detail') await this.openDeck(deckId);
  },

  async deleteCardConfirm(cardId) {
    if (!confirm('确定要删除这张卡片吗？')) return;
    await DB.deleteCard(cardId);
    this.showToast('卡片已删除');
    if (this.currentDeckId) await this.openDeck(this.currentDeckId);
  },

  async toggleStar(cardId) {
    const card = await DB.getCard(cardId);
    if (card) { await DB.updateCard(cardId, { starred: !card.starred }); if (this.currentDeckId) await this.openDeck(this.currentDeckId); }
  },

  // ========== REVIEW ==========
  async startReview(deckId) {
    const cards = await DB.getCardsByDeck(deckId);
    const due = SM2.getDueCards(cards);
    const newC = SM2.getNewCards(cards).slice(0, 20);
    const ids = new Set([...due.map(c => c.id), ...newC.map(c => c.id)]);
    this.reviewQueue = cards.filter(c => ids.has(c.id));
    if (this.reviewQueue.length === 0) { this.showToast('没有需要复习的卡片！', 'info'); return; }
    this.reviewQueue.sort(() => Math.random() - 0.5);
    this.reviewIndex = 0;
    this.isFlipped = false;
    this.sessionStats = { reviewed: 0, correct: 0, startTime: Date.now() };
    this.currentDeckId = deckId;
    this.showView('review');
    this.renderReviewCard();
  },

  async renderReviewCard() {
    if (this.reviewIndex >= this.reviewQueue.length) { this.showReviewComplete(); return; }
    const card = this.reviewQueue[this.reviewIndex];
    const deck = await DB.getDeck(card.deckId);
    const status = SM2.getStatus(card);
    const sMap = { new: '新卡片', learning: '学习中', review: '复习', relearning: '重学' };
    document.getElementById('review-deck-name').textContent = deck ? deck.icon + ' ' + deck.name : '';
    document.getElementById('review-progress').textContent = (this.reviewIndex + 1) + ' / ' + this.reviewQueue.length;
    document.getElementById('review-status').textContent = sMap[status];
    document.getElementById('review-status').className = 'review-status status-' + status;
    document.getElementById('review-progress-bar').style.width = (this.reviewIndex / this.reviewQueue.length * 100) + '%';
    document.getElementById('review-front').innerHTML = '<div class="card-text">' + this.esc(card.front) + '</div><div class="swipe-hint left">⬅ 忘了</div><div class="swipe-hint right">简单 ➡</div>';
    document.getElementById('review-back').innerHTML = '<div class="card-text">' + this.esc(card.back).replace(/\n/g, '<br>') + '</div>';
    // Dynamic height: measure back content and set min-height
    this.isFlipped = false;
    const reviewCard = document.getElementById('review-card');
    reviewCard.classList.remove('flipped');
    document.getElementById('review-actions').classList.remove('visible');
    // Temporarily show back to measure height
    const backFace = document.getElementById('review-back');
    const savedDisplay = backFace.style.display;
    backFace.style.display = 'flex';
    backFace.style.position = 'relative';
    const backHeight = backFace.scrollHeight;
    const frontHeight = document.getElementById('review-front').scrollHeight;
    backFace.style.display = savedDisplay;
    backFace.style.position = '';
    const neededHeight = Math.max(400, Math.max(backHeight, frontHeight) + 64);
    reviewCard.style.minHeight = neededHeight + 'px';
  },

  flipCard() {
    this.isFlipped = !this.isFlipped;
    document.getElementById('review-card').classList.toggle('flipped');
    if (this.isFlipped) document.getElementById('review-actions').classList.add('visible');
  },

  async rateCard(quality) {
    const card = this.reviewQueue[this.reviewIndex];
    const update = SM2.calculate(card, quality);
    await DB.updateCard(card.id, update);
    await DB.addReview({ cardId: card.id, deckId: card.deckId, quality: quality, interval: update.interval, ease: update.ease });
    this.sessionStats.reviewed++;
    if (quality >= 3) this.sessionStats.correct++;
    this.reviewIndex++;
    this.renderReviewCard();
  },

  showReviewComplete() {
    const s = this.sessionStats;
    const dur = Math.round((Date.now() - s.startTime) / 1000);
    const m = Math.floor(dur / 60), sec = dur % 60;
    const acc = s.reviewed > 0 ? Math.round((s.correct / s.reviewed) * 100) : 0;
    document.getElementById('review-complete-stats').innerHTML =
      '<div class="complete-stat"><span class="complete-number">' + s.reviewed + '</span><span class="complete-label">卡片已复习</span></div>' +
      '<div class="complete-stat"><span class="complete-number">' + acc + '%</span><span class="complete-label">正确率</span></div>' +
      '<div class="complete-stat"><span class="complete-number">' + m + ':' + String(sec).padStart(2, '0') + '</span><span class="complete-label">用时</span></div>';
    this.showView('review-complete');
  },

  // ========== STATS ==========
  async renderStats() {
    const reviews = await DB.getAllReviews();
    const allCards = await DB.getAllCards();
    document.getElementById('stats-total-reviews').textContent = reviews.length;
    document.getElementById('stats-total-cards').textContent = allCards.length;

    const sc = { new: 0, learning: 0, review: 0, relearning: 0 };
    allCards.forEach(c => sc[SM2.getStatus(c)]++);
    const pct = (n) => allCards.length ? (n / allCards.length * 100) : 0;
    document.getElementById('stats-status-chart').innerHTML =
      '<div class="bar-chart">' +
      '<div class="bar-item"><div class="bar-label">新卡片</div><div class="bar-track"><div class="bar-fill new" style="width:' + pct(sc.new) + '%"></div></div><div class="bar-value">' + sc.new + '</div></div>' +
      '<div class="bar-item"><div class="bar-label">学习中</div><div class="bar-track"><div class="bar-fill learning" style="width:' + pct(sc.learning) + '%"></div></div><div class="bar-value">' + sc.learning + '</div></div>' +
      '<div class="bar-item"><div class="bar-label">复习中</div><div class="bar-track"><div class="bar-fill review" style="width:' + pct(sc.review) + '%"></div></div><div class="bar-value">' + sc.review + '</div></div>' +
      '<div class="bar-item"><div class="bar-label">重学</div><div class="bar-track"><div class="bar-fill relearning" style="width:' + pct(sc.relearning) + '%"></div></div><div class="bar-value">' + sc.relearning + '</div></div></div>';

    this.renderHeatmap(reviews);
    this.showView('stats');
  },

  renderHeatmap(reviews) {
    const c = document.getElementById('stats-heatmap');
    const today = new Date(), weeks = 12;
    const start = new Date(today); start.setDate(start.getDate() - weeks * 7 + 1);
    const dc = {}; reviews.forEach(r => { const d = new Date(r.date).toISOString().split('T')[0]; dc[d] = (dc[d] || 0) + 1; });
    const mx = Math.max(1, ...Object.values(dc));
    let h = '<div class="heatmap"><div class="heatmap-labels">';
    ['日','一','二','三','四','五','六'].forEach(d => h += '<div class="heatmap-label">' + d + '</div>');
    h += '</div><div class="heatmap-grid">';
    const cur = new Date(start); cur.setDate(cur.getDate() - cur.getDay());
    for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
      const ds = cur.toISOString().split('T')[0];
      const cnt = dc[ds] || 0;
      const lvl = cnt > 0 ? Math.min(4, Math.ceil(cnt / mx * 4)) : 0;
      h += '<div class="heatmap-cell level-' + (cur > today ? -1 : lvl) + '" title="' + ds + ': ' + cnt + ' 次"></div>';
      cur.setDate(cur.getDate() + 1);
    }
    h += '</div></div>'; c.innerHTML = h;
  },

  // ========== IMPORT ==========
  renderImport() { this.showView('import'); },

  importFile: null,
  importText: '',
  importCards: [],

  setupImport() {
    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('file-input');
    if (!zone || !input) return;
    zone.addEventListener('click', (e) => { if (e.target === zone || e.target.closest('.upload-icon') || e.target.closest('h3') || e.target.closest('p')) input.click(); });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault(); zone.classList.remove('dragover');
      if (e.dataTransfer.files.length) this.handleFileUpload(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', (e) => { if (e.target.files.length) this.handleMultipleFiles(e.target.files); });
  },

  async handleMultipleFiles(files) {
    let allText = '';
    for (let i = 0; i < files.length; i++) {
      document.getElementById('import-step1').style.display = 'none';
      document.getElementById('import-step2').style.display = 'block';
      document.getElementById('import-status').textContent = '正在处理 ' + files[i].name + ' (' + (i+1) + '/' + files.length + ')...';
      try {
        const text = await Importer.extractText(files[i]);
        allText += '

=== ' + files[i].name + ' ===
' + text;
      } catch(err) { console.error('Failed to extract:', files[i].name, err); }
    }
    if (!allText.trim()) { this.showToast('未能从文件中提取文本', 'error'); this.resetImport(); return; }
    this.importText = allText;
    document.getElementById('import-step2').style.display = 'none';
    document.getElementById('import-step3').style.display = 'block';
    const preview = this.importText.substring(0, 1500) + (this.importText.length > 1500 ? '...' : '');
    document.getElementById('import-text-preview').textContent = preview;
    document.getElementById('btn-ai-parse').style.display = 'inline-flex';
  },

  async handleFileUpload(file) {
    this.importFile = file;
    document.getElementById('import-step1').style.display = 'none';
    document.getElementById('import-step2').style.display = 'block';
    document.getElementById('import-status').textContent = '正在提取 ' + file.name + ' ...';
    try {
      this.importText = await Importer.extractText(file);
      document.getElementById('import-step2').style.display = 'none';
      document.getElementById('import-step3').style.display = 'block';
      const preview = this.importText.substring(0, 1500) + (this.importText.length > 1500 ? '...' : '');
      document.getElementById('import-text-preview').textContent = preview;
      document.getElementById('btn-ai-parse').style.display = 'inline-flex';
    } catch (err) {
      this.showToast(err.message, 'error');
      this.resetImport();
    }
  },

  parseWithRegex() {
    try {
      this.importCards = Importer.parseRegex(this.importText);
      this.showImportResults();
    } catch (err) { this.showToast('解析失败: ' + err.message, 'error'); }
  },

  async parseWithAI() {
    const key = this.getApiKey();
    if (!key) { this.showToast('请先在设置中配置 API Key', 'warning'); return; }
    document.getElementById('import-step3').style.display = 'none';
    document.getElementById('import-step2').style.display = 'block';
    document.getElementById('import-status').textContent = 'AI 正在分析文本...';
    const bar = document.getElementById('import-progress-bar-container');
    const fill = document.getElementById('import-progress-fill');
    const text = document.getElementById('import-progress-text');
    if (bar) bar.style.display = 'block';
    const steps = [
      ['正在分析文本结构...', 15],
      ['识别题型和主题...', 35],
      ['生成问答卡片...', 60],
      ['AI 正在整理结果...', 80],
      ['即将完成...', 95]
    ];
    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        if (text) text.textContent = steps[stepIdx][0];
        if (fill) fill.style.width = steps[stepIdx][1] + '%';
        stepIdx++;
      }
    }, 2000);
    try {
      const base = this.getApiBase();
      const model = this.getApiModel();
      this.importCards = await Importer.parseAI(this.importText, key, base, model);
      clearInterval(interval);
      if (fill) fill.style.width = '100%';
      if (text) text.textContent = '完成！识别到 ' + this.importCards.length + ' 张卡片';
      await new Promise(r => setTimeout(r, 800));
      document.getElementById('import-step2').style.display = 'none';
      this.showImportResults();
    } catch (err) {
      clearInterval(interval);
      this.showToast('AI 解析失败: ' + err.message, 'error');
      document.getElementById('import-step2').style.display = 'none';
      document.getElementById('import-step3').style.display = 'block';
    }
  },

  async showImportResults() {
    document.getElementById('import-step4').style.display = 'block';
    document.getElementById('import-card-count').textContent = '识别到 ' + this.importCards.length + ' 张卡片';
    const sel = document.getElementById('import-deck-select');
    const decks = await DB.getAllDecks();
    sel.innerHTML = decks.map(d => '<option value="' + d.id + '">' + d.icon + ' ' + this.esc(d.name) + '</option>').join('');
    if (decks.length === 0) sel.innerHTML = '<option value="">请先创建牌组</option>';
    const list = document.getElementById('import-card-list');
    list.innerHTML = '';
    this.importCards.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'import-card-item';
      el.innerHTML = '<div class="import-card-check"><input type="checkbox" checked data-idx="' + i + '"></div>' +
        '<div class="import-card-body">' +
        '<div class="import-card-front"><span class="import-card-type">' + this.esc(c.type || '卡片') + '</span>' + this.esc(c.front).substring(0, 300) + '</div>' +
        '<div class="import-card-back">' + this.esc(c.back).substring(0, 500) + '</div></div>';
      list.appendChild(el);
    });
  },

  async showCreateDeckFromImport() {
    const name = prompt('请输入新牌组名称:');
    if (!name || !name.trim()) return;
    const icon = prompt('请输入牌组图标（如 📚）:', '📚');
    const deck = await DB.addDeck({ name: name.trim(), description: '计划导入', icon: icon || '📚' });
    this.showToast('牌组“' + name.trim() + '”已创建');
    // Refresh the deck select
    const sel = document.getElementById('import-deck-select');
    const decks = await DB.getAllDecks();
    sel.innerHTML = decks.map(d => '<option value="' + d.id + '">' + d.icon + ' ' + this.esc(d.name) + '</option>').join('');
    sel.value = deck.id;
  },

  async confirmImport() {
    const deckId = document.getElementById('import-deck-select').value;
    if (!deckId) { this.showToast('请选择目标牌组', 'warning'); return; }
    const checks = document.querySelectorAll('#import-card-list input[type=checkbox]:checked');
    const selected = [];
    checks.forEach(ch => selected.push(this.importCards[parseInt(ch.dataset.idx)]));
    if (selected.length === 0) { this.showToast('请至少选择一张卡片', 'warning'); return; }
    const count = await Importer.importToDeck(selected, deckId);
    this.showToast('成功导入 ' + count + ' 张卡片');
    this.resetImport();
    await this.renderHome();
  },

  resetImport() {
    this.importFile = null; this.importText = ''; this.importCards = [];
    document.getElementById('import-step1').style.display = 'block';
    document.getElementById('import-step2').style.display = 'none';
    document.getElementById('import-step3').style.display = 'none';
    document.getElementById('import-step4').style.display = 'none';
    document.getElementById('file-input').value = '';
  },

  _defaultApiKey: 'tp-c58etypj3tga8i9b3dyc53oioy3enww0izd1asxeeio5m7kx',
  _defaultApiBase: 'https://token-plan-cn.xiaomimimo.com/v1',
  _defaultApiModel: 'MiMo-7B-RL',

  getApiKey() { return localStorage.getItem('anki_api_key') || this._defaultApiKey; },
  getApiBase() { return localStorage.getItem('anki_api_base') || this._defaultApiBase; },
  getApiModel() { return localStorage.getItem('anki_api_model') || this._defaultApiModel; },

  saveApiSettings() {
    localStorage.setItem('anki_api_key', document.getElementById('settings-api-key').value.trim());
    localStorage.setItem('anki_api_base', document.getElementById('settings-api-base').value.trim());
    localStorage.setItem('anki_api_model', document.getElementById('settings-api-model').value.trim());
    this.showToast('API 设置已保存');
  },

  // ========== SETTINGS ==========
  renderSettings() {
    const key = this.getApiKey();
    const base = localStorage.getItem('anki_api_base') || '';
    const model = localStorage.getItem('anki_api_model') || '';
    const keyEl = document.getElementById('settings-api-key');
    const baseEl = document.getElementById('settings-api-base');
    const modelEl = document.getElementById('settings-api-model');
    if (keyEl) { keyEl.value = key; baseEl.value = base; modelEl.value = model; }
    this.showView('settings');
  },

  async exportAllData() {
    const data = await DB.exportData();
    this.downloadJSON(data, 'anki-web-backup-' + new Date().toISOString().split('T')[0] + '.json');
    this.showToast('数据已导出');
  },

  async importData() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const d = JSON.parse(await f.text()); await DB.importData(d); this.showToast('数据已导入'); await this.renderHome(); }
      catch (err) { this.showToast('导入失败：文件格式错误', 'error'); }
    }; inp.click();
  },

  async exportDeck(deckId) {
    const deck = await DB.getDeck(deckId), cards = await DB.getCardsByDeck(deckId);
    this.downloadJSON({ decks: [deck], cards, reviews: [], exportedAt: new Date().toISOString(), version: '1.0' }, deck.name + '-export.json');
    this.showToast('牌组已导出');
  },

  async clearAllData() {
    if (!confirm('确定要清除所有数据吗？此操作不可撤销！')) return;
    if (!confirm('再次确认：所有牌组、卡片和学习记录都将被删除。')) return;
    await DB.clearAll(); this.showToast('所有数据已清除'); await this.renderHome();
  },

  async loadSampleDecks() {
    try { const r = await fetch('data/china-history.json'); await DB.importData(await r.json()); this.showToast('示例牌组已加载'); await this.renderHome(); }
    catch (e) { this.showToast('加载示例数据失败', 'error'); }
  },

  // ========== UTILS ==========
  bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (this.currentView !== 'review' || document.querySelector('.modal.active')) return;
      if (e.key === ' ') { e.preventDefault(); this.flipCard(); }
      if (this.isFlipped && e.key >= '1' && e.key <= '4') this.rateCard(parseInt(e.key));
    });
  },

  bindSwipe() {
    const card = document.getElementById('review-card');
    if (!card) return;
    let startX = 0, startY = 0, isDragging = false;
    card.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
    }, { passive: true });
    card.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const dx = e.touches[0].clientX - startX;
      if (Math.abs(dx) > 30) {
        const rot = this.isFlipped ? 'rotateY(180deg) ' : '';
        card.style.transform = rot + 'translateX(' + dx + 'px) rotate(' + (dx * 0.05) + 'deg)';
        card.classList.toggle('swiping-left', dx < -50);
        card.classList.toggle('swiping-right', dx > 50);
      }
    }, { passive: true });
    card.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      isDragging = false;
      const dx = e.changedTouches[0].clientX - startX;
      card.style.transform = '';
      card.classList.remove('swiping-left', 'swiping-right');
      if (dx > 100 && this.isFlipped) this.rateCard(4);
      else if (dx < -100 && this.isFlipped) this.rateCard(1);
    });
  },

  bindEvents() {
    document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); }));
    document.addEventListener('click', e => { const s = document.getElementById('action-sheet'); if (s.classList.contains('active') && !e.target.closest('.action-sheet-content') && !e.target.closest('.btn-icon')) s.classList.remove('active'); });
  },

  showToast(msg, type) {
    type = type || 'success';
    const c = document.getElementById('toast-container');
    const t = document.createElement('div'); t.className = 'toast toast-' + type; t.textContent = msg;
    c.appendChild(t); setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2500);
  },

  showActionSheet(actions) {
    const s = document.getElementById('action-sheet'), c = s.querySelector('.action-sheet-content');
    c.innerHTML = actions.map(a => '<button class="action-sheet-item' + (a.danger ? ' danger' : '') + '" onclick="document.getElementById(\'action-sheet\').classList.remove(\'active\');' + a.fn + '">' + a.label + '</button>').join('') +
      '<button class="action-sheet-item" onclick="this.closest(\'.action-sheet\').classList.remove(\'active\')">取消</button>';
    s.classList.add('active');
  },

  downloadJSON(data, name) {
    const b = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u);
  },

  esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
};

document.addEventListener('DOMContentLoaded', () => App.init());