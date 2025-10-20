// Bootstrap 5 Drug Viewer powered by local JSON

(function () {
  const JSON_PATH = './常見濫用管制藥品資料集.json';
  const GROUP_ORDER = ['第一級毒品', '第二級毒品', '第三級毒品', '第四級毒品', '未分級'];

  const dom = {
    loading: document.getElementById('loading'),
    content: document.getElementById('content'),
    filterBar: document.getElementById('filterBar')
  };

  let DATA = [];
  let activeLevel = null; // '1' | '2' | '3' | '4' | null

  // Return all display group names that an item belongs to.
  function groupsForFenji(fenjiRaw) {
    const s = String(fenjiRaw || '').trim();
    if (!s || s === '無') return ['未分級'];
    // 僅依是否包含「一、二、三、四」來決定分組；可同時落入多組
    const has1 = s.includes('一');
    const has2 = s.includes('二');
    const has3 = s.includes('三');
    const has4 = s.includes('四');

    const result = new Set();
    if (has1) result.add('第一級毒品');
    if (has2) result.add('第二級毒品');
    if (has3) result.add('第三級毒品');
    if (has4) result.add('第四級毒品');
    if (result.size === 0) result.add('未分級');
    // preserve GROUP_ORDER ordering in output
    return GROUP_ORDER.filter(k => result.has(k));
  }

  function levelMatches(item, level) {
    const fenji = String(item['分級'] || '').trim();
    if (!level) return true;
    const has1 = fenji.includes('一');
    const has2 = fenji.includes('二');
    const has3 = fenji.includes('三');
    const has4 = fenji.includes('四');
    if (level === '1') return has1;
    if (level === '2') return has2;
    if (level === '3') return has3;
    if (level === '4') return has4;
    if (level === 'U') return (!fenji || fenji === '無' || (!has1 && !has2 && !has3 && !has4));
    return false;
  }

  function parseImageSet(item) {
    const raw = item['圖片'];
    const rawText = item['圖片文字'];
    const urls = String(raw || '')
      .split(';;')
      .map(s => s.trim())
      .filter(Boolean);
    const captions = String(rawText || '')
      .split(';;')
      .map(s => s.trim())
      .filter(Boolean);

    // Pair each URL with its caption by index; expand with HTTPS-first variants
    const expanded = [];
    urls.forEach((u, i) => {
      const cap = captions[i] || '';
      const https = u.replace(/^http:\/\//i, 'https://');
      if (https !== u) expanded.push({ url: https, alt: cap });
      expanded.push({ url: u, alt: cap });
    });

    // de-duplicate by URL while preserving order
    const seen = new Set();
    const candidates = expanded.filter(x => {
      if (seen.has(x.url)) return false;
      seen.add(x.url);
      return true;
    });

    return { candidates, captions };
  }

  function buildCard(item) {
    const name = item['藥物名稱'] || '';
    const fenji = item['分級'] || '';
    const yongtu = item['醫療用途'] || '';
    const leibie = item['類別'] || '';
    const way = item['濫用方式'] || '';
    const nick = item['俗名'] || '';
    const desc = item['說明'] || '';

    const { candidates: imgCandidates, captions } = parseImageSet(item);

    const col = document.createElement('div');
    col.className = 'col';

    const card = document.createElement('div');
    card.className = 'card h-100 drug-card';
    card.dataset.fenji = fenji;

    const body = document.createElement('div');
    body.className = 'card-body d-flex flex-column';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'drug-img-wrap mb-3';

    // Prepare fallback first to avoid TDZ issues in handlers
    const fallback = document.createElement('div');
    fallback.className = 'img-fallback text-center text-muted border rounded p-3 d-none';
    const fallbackText = captions && captions.length ? captions.join('、') : '無圖片';
    fallback.textContent = fallbackText;
    if (!imgCandidates.length) {
      fallback.classList.remove('d-none');
      fallback.classList.add('d-flex', 'align-items-center', 'justify-content-center');
    }

    let img;
    if (imgCandidates.length) {
      img = document.createElement('img');
      img.className = 'img-fluid drug-img';
      img.alt = (imgCandidates[0].alt || name || '藥物圖片');
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      let idx = 0;
      const tryNext = () => {
        if (idx >= imgCandidates.length) {
          img.style.display = 'none';
          fallback.classList.remove('d-none');
          fallback.classList.add('d-flex', 'align-items-center', 'justify-content-center');
          return;
        }
        const cand = imgCandidates[idx++];
        img.alt = (cand.alt || name || '藥物圖片');
        img.src = encodeURI(cand.url);
      };
      img.onload = () => {
        // ensure fallback stays hidden if image loads
        fallback.classList.add('d-none');
        fallback.classList.remove('d-flex');
      };
      img.onerror = tryNext;
      tryNext();
      imgWrap.appendChild(img);
    }
    imgWrap.appendChild(fallback);
    body.appendChild(imgWrap);

    const title = document.createElement('h5');
    title.className = 'card-title';
    title.textContent = name || '(未命名)';
    body.appendChild(title);

    const kv = [
      ['分級', fenji],
      ['類別', leibie],
      ['醫療用途', yongtu],
      ['濫用方式', way],
      ['俗名', nick]
    ];
    kv.forEach(([k, v]) => {
      if (!v) return;
      const p = document.createElement('p');
      p.className = 'mb-1';
      p.innerHTML = `<span class="field-label">${k}：</span>${escapeHtml(String(v))}`;
      body.appendChild(p);
    });

    // 說明改放進 Modal，避免版面擁擠

    // 點擊整張卡片開啟詳情 Modal
    const openDetail = () => showDetailModal(item, img ? img.src : '', img ? img.alt : '');
    card.addEventListener('click', openDetail);
    card.style.cursor = 'pointer';

    card.appendChild(body);
    col.appendChild(card);
    return col;
  }

  function escapeHtml(s) {
    return s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function render(groups) {
    const root = document.createElement('div');
    groups.forEach(({ key, items }) => {
      if (!items.length) return;

      const sectionId = 'sec-' + key.replaceAll(/[^\w\u4e00-\u9fa5]/g, '');
      const collapseId = sectionId + '-body';

      // Header with collapse toggle icon
      const headerRow = document.createElement('div');
      headerRow.className = 'group-header mt-4 mb-2';
      headerRow.id = sectionId;

      const h = document.createElement('h2');
      h.className = 'h4 mb-0';
      h.textContent = key;
      headerRow.appendChild(h);

      const toggle = document.createElement('button');
      toggle.className = 'collapse-toggle';
      toggle.setAttribute('type', 'button');
      toggle.setAttribute('aria-label', '收合/展開');
      toggle.setAttribute('data-bs-toggle', 'collapse');
      toggle.setAttribute('data-bs-target', '#' + collapseId);
      toggle.innerHTML = '<span class="fs-4" aria-hidden="true">▾</span>';
      headerRow.appendChild(toggle);
      root.appendChild(headerRow);

      // Collapsible body
      const wrap = document.createElement('div');
      wrap.className = 'collapse show';
      wrap.id = collapseId;

      const row = document.createElement('div');
      row.className = 'row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3';
      items.forEach(item => row.appendChild(buildCard(item)));
      wrap.appendChild(row);
      root.appendChild(wrap);

      // Make whole header clickable to toggle collapse
      const iconSpan = toggle.querySelector('span');
      const collapseInst = bootstrap.Collapse.getOrCreateInstance(wrap, { toggle: false });
      headerRow.addEventListener('click', (ev) => {
        // Avoid double toggling due to button's own data attributes by preventing default
        ev.preventDefault();
        ev.stopPropagation();
        if (wrap.classList.contains('show')) collapseInst.hide();
        else collapseInst.show();
      });
      // Keep icon direction in sync
      wrap.addEventListener('shown.bs.collapse', () => { if (iconSpan) iconSpan.textContent = '▾'; });
      wrap.addEventListener('hidden.bs.collapse', () => { if (iconSpan) iconSpan.textContent = '▸'; });
    });

    dom.content.innerHTML = '';
    dom.content.appendChild(root);

    dom.loading.classList.add('d-none');
    dom.content.classList.remove('d-none');
    dom.filterBar.classList.remove('d-none');

    installFilters();
    installHeaderOffset();
  }

  function installHeaderOffset() {
    const header = document.querySelector('header.header');
    if (!header) return;
    const applyPad = () => {
      const SCROLL_TWEAK = 3; // 可微調頂端預留距離
      const pad = header.offsetHeight;
      document.body.style.paddingTop = pad + 'px';
      // 將值同步到 CSS 變數，供 scroll-margin-top 使用
      document.documentElement.style.setProperty('--header-offset', (pad + SCROLL_TWEAK) + 'px');
    };
    applyPad();
    window.addEventListener('resize', applyPad);
  }

  // Modal population
  function showDetailModal(item, imgUrl, imgAlt) {
    const modalEl = document.getElementById('detailModal');
    const mTitle = document.getElementById('detailModalLabel');
    const mImg = document.getElementById('modalImage');
    const mInfo = document.getElementById('modalInfo');
    const mDesc = document.getElementById('modalDesc');

    const name = item['藥物名稱'] || '';
    const fenji = item['分級'] || '';
    const yongtu = item['醫療用途'] || '';
    const leibie = item['類別'] || '';
    const way = item['濫用方式'] || '';
    const nick = item['俗名'] || '';
    const desc = item['說明'] || '';

    mTitle.textContent = name || '詳細資訊';

    // Image area
    mImg.innerHTML = '';
    if (imgUrl) {
      const img = document.createElement('img');
      img.className = 'img-fluid rounded';
      img.src = imgUrl;
      img.alt = imgAlt || name || '藥物圖片';
      img.referrerPolicy = 'no-referrer';
      mImg.appendChild(img);
    }

    // Info list (excluding 說明)
    const list = document.createElement('dl');
    list.className = 'row mb-0';
    const pairs = [
      ['分級', fenji],
      ['類別', leibie],
      ['醫療用途', yongtu],
      ['濫用方式', way],
      ['俗名', nick]
    ];
    pairs.forEach(([k, v]) => {
      if (!v) return;
      const dt = document.createElement('dt');
      dt.className = 'col-sm-3 text-muted';
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.className = 'col-sm-9';
      dd.textContent = v;
      list.appendChild(dt);
      list.appendChild(dd);
    });
    mInfo.innerHTML = '';
    mInfo.appendChild(list);

    // 說明
    mDesc.textContent = desc || '';

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }

  function installFilters() {
    const btns = document.querySelectorAll('.filter-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const level = btn.dataset.level;
        if (activeLevel === level) {
          activeLevel = null; // toggle off
          btns.forEach(b => b.classList.remove('active'));
        } else {
          activeLevel = level;
          btns.forEach(b => b.classList.toggle('active', b === btn));
        }
        applyFilter();
        if (activeLevel) {
          openSectionForLevel(activeLevel, { scroll: true, collapseOthers: true });
        }
      });
    });
  }

  function sectionIdForLevel(level) {
    // Map level to group display key
    let key;
    if (level === '1') key = '第一級毒品';
    else if (level === '2') key = '第二級毒品';
    else if (level === '3') key = '第三級毒品';
    else if (level === '4') key = '第四級毒品';
    else if (level === 'U') key = '未分級';
    else return null;
    return 'sec-' + key.replaceAll(/[^\w\u4e00-\u9fa5]/g, '');
  }

  function openSectionForLevel(level, opts = {}) {
    const id = sectionIdForLevel(level);
    if (!id) return;
    const headerEl = document.getElementById(id);
    const collapseEl = document.getElementById(id + '-body');
    if (!collapseEl) return;

    // Collapse others
    if (opts.collapseOthers) {
      document.querySelectorAll('.collapse').forEach(el => {
        if (el.id === collapseEl.id) return;
        const inst = bootstrap.Collapse.getOrCreateInstance(el, { toggle: false });
        inst.hide();
      });
    }

    const inst = bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: false });
    inst.show();

    if (opts.scroll && headerEl) {
      // 使用 CSS scroll-margin-top 配合 scrollIntoView
      headerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function applyFilter() {
    const cards = document.querySelectorAll('.drug-card');
    cards.forEach(card => {
      card.classList.remove('muted', 'highlight');
    });
    if (!activeLevel) return;
    DATA.forEach((item, idx) => {
      const card = document.querySelectorAll('.drug-card')[idx];
      if (!card) return;
      if (levelMatches(item, activeLevel)) {
        card.classList.add('highlight');
      } else {
        card.classList.add('muted');
      }
    });
  }

  function groupAndRender(data) {
    // stable group buckets
    const buckets = new Map(GROUP_ORDER.map(key => [key, []]));
    data.forEach(item => {
      const groups = groupsForFenji(item['分級']);
      if (!groups.length) return; // skip items without known 分級
      groups.forEach(g => buckets.get(g).push(item));
    });
    const groups = GROUP_ORDER.map(key => ({ key, items: buckets.get(key) || [] }));
    // optional: sort each group by name
    groups.forEach(g => g.items.sort((a, b) => String(a['藥物名稱']||'').localeCompare(String(b['藥物名稱']||''))));
    DATA = groups.flatMap(g => g.items);
    render(groups);
  }

  async function load() {
    try {
      const resp = await fetch(JSON_PATH);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      groupAndRender(Array.isArray(json) ? json : []);
    } catch (err) {
      dom.loading.classList.remove('alert-info');
      dom.loading.classList.add('alert-warning');
      dom.loading.innerHTML = [
        '無法載入本機 JSON（可能因為直接以檔案開啟造成 CORS 限制）。',
        '請在此資料夾啟動本機伺服器後，以 http:// 開啟：',
        '<code>python3 -m http.server 8000</code>',
        '然後瀏覽 <code>http://localhost:8000/index.html</code>'
      ].join('<br>');
      console.error(err);
    }
  }

  load();
})();
