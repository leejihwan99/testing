let allLogs = [];
  let byTitle = [];
  let byQuarter = [];

  async function loadData() {
    const btn = document.getElementById('refresh-btn');
    btn.classList.add('loading');

    try {
      const res = await fetch(`${API_URL}?action=getPiracy`);
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      allLogs = data.logs || [];
      byTitle = data.byTitle || [];
      byQuarter = data.byQuarter || [];

      updateStats();
      renderTitleList();
      renderQuarterList();

      const now = new Date().toLocaleString('ko-KR');
      document.getElementById('last-updated').textContent = `마지막 업데이트: ${now}`;
    } catch (e) {
      showToast('데이터 로드 실패: ' + e.message, 'error');
      document.getElementById('title-list').innerHTML = `<div class="empty-state">데이터를 불러올 수 없습니다.</div>`;
      document.getElementById('quarter-list').innerHTML = `<div class="empty-state">데이터를 불러올 수 없습니다.</div>`;
    } finally {
      btn.classList.remove('loading');
    }
  }

  function updateStats() {
    document.getElementById('stat-total').textContent = allLogs.length.toLocaleString();
    document.getElementById('stat-titles').textContent = byTitle.length.toLocaleString();
    const platforms = new Set(allLogs.map(l => l.platform)).size;
    document.getElementById('stat-platforms').textContent = platforms;
  }

  function renderTitleList() {
    const container = document.getElementById('title-list');
    document.getElementById('badge-titles').textContent = `총 ${byTitle.length}개`;

    if (!byTitle.length) {
      container.innerHTML = `<div class="empty-state">데이터가 없습니다.</div>`;
      return;
    }

    const max = byTitle[0].count;

    container.innerHTML = byTitle.map((item, i) => {
      const pct = Math.round((item.count / max) * 100);
      const rankClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
      return `
        <div class="title-item" onclick="openLog('${escapeHtml(item.title)}')">
          <div class="title-rank ${rankClass}">${i + 1}</div>
          <div class="title-bar-wrap">
            <div class="title-name" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
            <div class="title-bar-bg">
              <div class="title-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="title-count">${item.count}</div>
        </div>
      `;
    }).join('');
  }

  let selectedQuarter = null;

  function renderQuarterList() {
    const container = document.getElementById('quarter-list');
    const tabsEl = document.getElementById('quarter-tabs');

    if (!byQuarter.length) {
      tabsEl.innerHTML = '';
      document.getElementById('badge-quarter').textContent = `총 0건`;
      container.innerHTML = `<div class="empty-state">10회 이상 유포 작품이 없습니다.</div>`;
      return;
    }

    // 데이터에 있는 연도+분기 추출
    const existingKeys = new Set(byQuarter.map(i => i.quarter));

    // 연도 목록 추출
    const years = [...new Set(byQuarter.map(i => i.quarter.split('-')[0]))].sort((a, b) => b - a);

    // 탭: 연도별 1~4분기 버튼 생성
    tabsEl.innerHTML = years.map(year => {
      return [1,2,3,4].map(q => {
        const key = `${year}-Q${q}`;
        const hasData = existingKeys.has(key);
        const months = { 1:'1~3월', 2:'4~6월', 3:'7~9월', 4:'10~12월' };
        return `<button
          class="quarter-tab ${!hasData ? 'disabled' : ''} ${selectedQuarter === key ? 'active' : ''}"
          onclick="selectQuarter('${key}')"
          ${!hasData ? 'disabled' : ''}
        >${year} ${q}Q<span style="font-size:10px;opacity:0.6;margin-left:3px;">${months[q]}</span></button>`;
      }).join('');
    }).join('');

    // 기본 선택: 현재 선택값 유지 or 가장 최근 분기
    if (!selectedQuarter || !existingKeys.has(selectedQuarter)) {
      const sorted = [...existingKeys].sort((a, b) => b.localeCompare(a));
      selectedQuarter = sorted[0];
      // 탭 active 재적용
      tabsEl.querySelectorAll('.quarter-tab').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim().startsWith(selectedQuarter.replace('-Q', ' ').replace('Q', '') ) );
      });
      renderQuarterContent();
      return;
    }

    renderQuarterContent();
  }

  function selectQuarter(key) {
    selectedQuarter = key;
    document.querySelectorAll('.quarter-tab').forEach(btn => {
      btn.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    renderQuarterContent();
  }

  function renderQuarterContent() {
    const container = document.getElementById('quarter-list');
    const items = byQuarter.filter(i => i.quarter === selectedQuarter);

    document.getElementById('badge-quarter').textContent = `${items.length}건`;

    if (!items.length) {
      container.innerHTML = `<div class="empty-state">해당 분기 데이터가 없습니다.</div>`;
      return;
    }

    container.innerHTML = items.map(item => {
      const badgeClass = item.count >= 30 ? 'high' : item.count >= 20 ? 'mid' : 'low';
      return `
        <div class="quarter-item" onclick="openLog('${escapeHtml(item.title)}')">
          <div class="quarter-item-left">
            <div class="quarter-item-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
          </div>
          <span class="count-badge ${badgeClass}">${item.count}회</span>
        </div>
      `;
    }).join('');
  }

  function openLog(title) {
    const logs = allLogs.filter(l => l.title === title);
    document.getElementById('modal-title').textContent = title;

    if (!logs.length) {
      document.getElementById('log-body').innerHTML =
        `<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-dim);">로그 없음</td></tr>`;
    } else {
      const sorted = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
      document.getElementById('log-body').innerHTML = sorted.map(l => {
        const isUrl = l.link.startsWith('http');
        const linkHtml = isUrl
          ? `<a class="log-link" href="${escapeHtml(l.link)}" target="_blank" rel="noopener">${escapeHtml(l.link)}</a>`
          : `<span style="font-size:12px;color:var(--text-dim);">${escapeHtml(l.link)}</span>`;
        return `
          <tr>
            <td><span class="platform-badge">${escapeHtml(l.platform)}</span></td>
            <td style="color:var(--text-dim);font-size:12px;">${l.date}</td>
            <td>${linkHtml}</td>
          </tr>
        `;
      }).join('');

      document.getElementById('modal-footer').textContent = `총 ${logs.length}건`;
    }

    document.getElementById('modal').classList.add('open');
  }

  function closeModal(e) {
    if (e.target === document.getElementById('modal')) closeModalDirect();
  }

  function closeModalDirect() {
    document.getElementById('modal').classList.remove('open');
  }

  
  
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModalDirect();
  });

  loadData();