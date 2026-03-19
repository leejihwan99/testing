let allLogs = [];
let byTitle = [];
let byQuarter = [];

async function loadData() {
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('loading');
  try {
    const rows = await sbGet('piracy_logs', '?select=*&order=date.desc');

    allLogs = rows.map(r => ({
      platform: r.platform || '',
      title: r.title || '',
      link: r.link || '',
      date: r.date || '',
    }));

    // 작품별 집계
    const titleCount = {};
    for (const l of allLogs) titleCount[l.title] = (titleCount[l.title] || 0) + 1;
    byTitle = Object.entries(titleCount)
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count);

    // 분기별 10회 이상
    const quarterCount = {};
    for (const l of allLogs) {
      const d = new Date(l.date);
      const year = d.getFullYear();
      const quarter = Math.ceil((d.getMonth() + 1) / 3);
      const key = `${year}-Q${quarter}__${l.title}`;
      quarterCount[key] = (quarterCount[key] || 0) + 1;
    }
    byQuarter = Object.entries(quarterCount)
      .filter(([, count]) => count >= 10)
      .map(([key, count]) => {
        const [qKey, title] = key.split('__');
        return { quarter: qKey, title, count };
      })
      .sort((a, b) => b.quarter.localeCompare(a.quarter) || b.count - a.count);

    updateStats();
    renderTitleList();
    renderQuarterList();
    document.getElementById('last-updated').textContent = '마지막 업데이트: ' + new Date().toLocaleString('ko-KR');
  } catch (e) {
    showToast('데이터 로드 실패: ' + e.message, 'error');
  } finally {
    btn.classList.remove('loading');
  }
}

function updateStats() {
  document.getElementById('stat-total').textContent = allLogs.length.toLocaleString();
  document.getElementById('stat-titles').textContent = byTitle.length.toLocaleString();
  document.getElementById('stat-platforms').textContent = new Set(allLogs.map(l => l.platform)).size;
}

function renderTitleList() {
  const container = document.getElementById('title-list');
  document.getElementById('badge-titles').textContent = `총 ${byTitle.length}개`;
  if (!byTitle.length) { container.innerHTML = `<div class="empty-state">데이터가 없습니다.</div>`; return; }
  const max = byTitle[0].count;
  container.innerHTML = byTitle.map((item, i) => {
    const pct = Math.round((item.count / max) * 100);
    const rankClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
    return `
      <div class="title-item" onclick="openLog('${escHtml(item.title)}')">
        <div class="title-rank ${rankClass}">${i + 1}</div>
        <div class="title-bar-wrap">
          <div class="title-name" title="${escHtml(item.title)}">${escHtml(item.title)}</div>
          <div class="title-bar-bg"><div class="title-bar-fill" style="width:${pct}%"></div></div>
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
  const existingKeys = new Set(byQuarter.map(i => i.quarter));
  const years = [...new Set(byQuarter.map(i => i.quarter.split('-')[0]))].sort((a, b) => b - a);
  tabsEl.innerHTML = years.map(year =>
    [1,2,3,4].map(q => {
      const key = `${year}-Q${q}`;
      const hasData = existingKeys.has(key);
      const months = { 1:'1~3월', 2:'4~6월', 3:'7~9월', 4:'10~12월' };
      return `<button class="quarter-tab ${!hasData ? 'disabled' : ''} ${selectedQuarter === key ? 'active' : ''}"
        onclick="selectQuarter('${key}')" ${!hasData ? 'disabled' : ''}
      >${year} ${q}Q<span style="font-size:10px;opacity:0.6;margin-left:3px;">${months[q]}</span></button>`;
    }).join('')
  ).join('');
  if (!selectedQuarter || !existingKeys.has(selectedQuarter)) {
    selectedQuarter = [...existingKeys].sort((a, b) => b.localeCompare(a))[0];
  }
  tabsEl.querySelectorAll('.quarter-tab:not(.disabled)').forEach(btn => {
    const key = btn.getAttribute('onclick').match(/'([^']+)'/)?.[1];
    btn.classList.toggle('active', key === selectedQuarter);
  });
  renderQuarterContent();
}

function selectQuarter(key) {
  selectedQuarter = key;
  document.querySelectorAll('.quarter-tab').forEach(b => b.classList.remove('active'));
  event.currentTarget.classList.add('active');
  renderQuarterContent();
}

function renderQuarterContent() {
  const container = document.getElementById('quarter-list');
  const items = byQuarter.filter(i => i.quarter === selectedQuarter);
  document.getElementById('badge-quarter').textContent = `${items.length}건`;
  if (!items.length) { container.innerHTML = `<div class="empty-state">해당 분기 데이터가 없습니다.</div>`; return; }
  container.innerHTML = items.map(item => {
    const badgeClass = item.count >= 30 ? 'high' : item.count >= 20 ? 'mid' : 'low';
    return `
      <div class="quarter-item" onclick="openLog('${escHtml(item.title)}')">
        <div class="quarter-item-left">
          <div class="quarter-item-title" title="${escHtml(item.title)}">${escHtml(item.title)}</div>
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
        ? `<a class="log-link" href="${escHtml(l.link)}" target="_blank" rel="noopener">${escHtml(l.link)}</a>`
        : `<span style="font-size:12px;color:var(--text-dim);">${escHtml(l.link)}</span>`;
      return `
        <tr>
          <td><span class="platform-badge">${escHtml(l.platform)}</span></td>
          <td style="color:var(--text-dim);font-size:12px;">${l.date}</td>
          <td>${linkHtml}</td>
        </tr>
      `;
    }).join('');
    document.getElementById('modal-footer').textContent = `총 ${logs.length}건`;
  }
  document.getElementById('modal').classList.add('open');
}

function closeModal(e) { if (e.target === document.getElementById('modal')) closeModalDirect(); }
function closeModalDirect() { document.getElementById('modal').classList.remove('open'); }

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModalDirect(); });

loadData();
