let allData = [];
  let allSites = [];
  let allWorks = [];
  let mainChartInstance = null;
  let modalChartInstance = null;

  // 정렬 상태
  let worksSortKey = 'total', worksSortAsc = false, worksSortEl = null;
  let sitesSortKey = 'total', sitesSortAsc = false, sitesSortEl = null;
  let allSortKey = 'searchDate', allSortAsc = false, allSortEl = null;

  // 필터 상태
  let siteFilter = '';
  let allFilter = '';

  async function loadData() {
    const btn = document.getElementById('refresh-btn');
    btn.classList.add('loading');
    try {
      const [rawData, sitesData, worksData] = await Promise.all([
        sbGet('RAW_DATA', '?select=*'),
        sbGet('sites', '?select=*'),
        sbGet('works', '?select=*')
      ]);

      allData = rawData.map(r => ({
        searchDate: r.search_date || '',
        workTitle: r.work_title || '',
        engTitle: r.eng_title || '',
        resultTitle: r.result_title || '',
        url: r.url || '',
        siteName: r.site_name || '',
        snippet: r.snippet || '',
        firstFound: r.first_found || '',
        deleted: r.deleted || '',
        deletedDate: r.deleted_date || '',
      }));

      allSites = sitesData.map(r => ({
        siteName: r.site_name || '',
        status: r.status || '',
        regDate: r.reg_date || '',
      }));

      allWorks = worksData.map(r => ({
        id: r.id,
        title: r.title || '',
        engTitle: r.eng_title || '',
        url: r.url || '',
        author: r.author || '',
      }));

      updateStats();
      renderMainDeletionChart();
      renderWorksTable();
      renderSitesTable();
      renderAllTable();

      const now = new Date().toLocaleString('ko-KR');
      document.getElementById('last-updated').textContent = `마지막 업데이트: ${now}`;
    } catch (e) {
      showToast('데이터 로드 실패: ' + e.message, 'error');
    } finally {
      btn.classList.remove('loading');
    }
  }

  function updateStats() {
    const total = allData.length;
    const active = allData.filter(d => d.deleted !== 'Y').length;
    const deleted = allData.filter(d => d.deleted === 'Y').length;
    const sites = new Set(allData.map(d => d.siteName)).size;
    const excluded = allSites.filter(s => s.status === '제외').length;

    document.getElementById('stat-total').textContent = total.toLocaleString();
    document.getElementById('stat-active').textContent = active.toLocaleString();
    document.getElementById('stat-deleted').textContent = deleted.toLocaleString();
    document.getElementById('stat-sites').textContent = sites;
    document.getElementById('stat-excluded').textContent = excluded;
  }

  // ========================
  // 탭 전환
  // ========================
  function switchTab(name, el) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section-wrap').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('tab-' + name).classList.add('active');
  }

  function setTabFilter(f) {
    allFilter = f;
    switchTab('all', document.querySelectorAll('.tab-btn')[2]);
    document.querySelectorAll('#tab-all .filter-btn').forEach(b => {
      b.classList.toggle('active', (b.textContent.trim() === '전체' && f === '') ||
        (b.textContent.trim() === '활성' && f === 'active') ||
        (b.textContent.trim() === '삭제' && f === 'deleted'));
    });
    renderAllTable();
  }

  // ========================
  // 작품별 테이블
  // ========================
  function sortWorks(key, el) {
    if (worksSortKey === key) worksSortAsc = !worksSortAsc;
    else { worksSortKey = key; worksSortAsc = false; }
    if (worksSortEl) worksSortEl.classList.remove('sorted');
    el.classList.add('sorted');
    worksSortEl = el;
    renderWorksTable();
  }

  function renderWorksTable() {
    const search = document.getElementById('search-works').value.trim().toLowerCase();

    // 작품별 집계
    const map = {};
    for (const d of allData) {
      const key = d.engTitle;
      if (!map[key]) map[key] = { workTitle: d.workTitle, engTitle: d.engTitle, total: 0, active: 0, deleted: 0, lastDate: '' };
      map[key].total++;
      if (d.deleted === 'Y') map[key].deleted++;
      else map[key].active++;
      if (!map[key].lastDate || d.searchDate > map[key].lastDate) map[key].lastDate = d.searchDate;
    }

    let rows = Object.values(map).filter(r =>
      !search || r.workTitle.toLowerCase().includes(search) || r.engTitle.toLowerCase().includes(search)
    );

    rows.sort((a, b) => {
      let va = a[worksSortKey] || '', vb = b[worksSortKey] || '';
      if (typeof va === 'number' || worksSortKey === 'total' || worksSortKey === 'active' || worksSortKey === 'deleted') {
        va = Number(va); vb = Number(vb);
      }
      if (va < vb) return worksSortAsc ? -1 : 1;
      if (va > vb) return worksSortAsc ? 1 : -1;
      return 0;
    });

    document.getElementById('count-works').textContent = `총 ${rows.length}개 작품`;

    const tbody = document.getElementById('tbody-works');
    if (!rows.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="7">데이터가 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td style="font-weight:500;">${escHtml(r.workTitle)}</td>
        <td style="color:var(--text-dim);font-size:12px;">${escHtml(r.engTitle)}</td>
        <td style="font-weight:600;">${r.total}</td>
        <td><span class="tag-active">${r.active}</span></td>
        <td>${r.deleted > 0 ? `<span class="tag-deleted">${r.deleted}</span>` : `<span style="color:var(--text-muted)">0</span>`}</td>
        <td class="date-text">${formatDateKo(r.lastDate)}</td>
        <td>
          <button class="filter-btn log-btn" style="font-size:11px;padding:3px 10px;"
            data-type="work" data-key="${escHtml(r.engTitle)}" data-label="${escHtml(r.workTitle)}">로그</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.log-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openLogModal(btn.dataset.type, btn.dataset.key, btn.dataset.label);
      });
    });
  }

  // ========================
  // 사이트별 테이블
  // ========================
  function setSiteFilter(f, el) {
    siteFilter = f;
    document.querySelectorAll('#tab-sites .filter-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    renderSitesTable();
  }

  function sortSites(key, el) {
    if (sitesSortKey === key) sitesSortAsc = !sitesSortAsc;
    else { sitesSortKey = key; sitesSortAsc = false; }
    if (sitesSortEl) sitesSortEl.classList.remove('sorted');
    el.classList.add('sorted');
    sitesSortEl = el;
    renderSitesTable();
  }

  function renderSitesTable() {
    const search = document.getElementById('search-sites').value.trim().toLowerCase();

    // 사이트별 집계
    const map = {};
    for (const d of allData) {
      const key = d.siteName;
      if (!map[key]) map[key] = { siteName: key, total: 0, active: 0, deleted: 0 };
      map[key].total++;
      if (d.deleted === 'Y') map[key].deleted++;
      else map[key].active++;
    }

    // 사이트목록 상태/등록일 병합
    const siteInfo = {};
    for (const s of allSites) siteInfo[s.siteName] = s;

    let rows = Object.values(map).map(r => ({
      ...r,
      status: siteInfo[r.siteName]?.status || '',
      regDate: siteInfo[r.siteName]?.regDate || ''
    }));

    rows = rows.filter(r => {
      const matchSearch = !search || r.siteName.toLowerCase().includes(search);
      const matchFilter = siteFilter === '' ? true
        : siteFilter === '신규' ? !r.status
        : r.status === siteFilter;
      return matchSearch && matchFilter;
    });

    rows.sort((a, b) => {
      let va = a[sitesSortKey] || '', vb = b[sitesSortKey] || '';
      if (['total','active','deleted'].includes(sitesSortKey)) { va = Number(va); vb = Number(vb); }
      if (va < vb) return sitesSortAsc ? -1 : 1;
      if (va > vb) return sitesSortAsc ? 1 : -1;
      return 0;
    });

    document.getElementById('count-sites').textContent = `총 ${rows.length}개 사이트`;

    const tbody = document.getElementById('tbody-sites');
    if (!rows.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="7">데이터가 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><span class="site-badge">${escHtml(r.siteName)}</span></td>
        <td style="font-weight:600;">${r.total}</td>
        <td><span class="tag-active">${r.active}</span></td>
        <td>${r.deleted > 0 ? `<span class="tag-deleted">${r.deleted}</span>` : `<span style="color:var(--text-muted)">0</span>`}</td>
        <td class="date-text">${formatDateKo(r.regDate)}</td>
        <td>
          <select class="site-status-select s-${escHtml(r.status)}" data-site="${escHtml(r.siteName)}">
            <option value="" ${!r.status ? 'selected' : ''}>신규</option>
            <option value="플랫폼" ${r.status === '플랫폼' ? 'selected' : ''}>플랫폼</option>
            <option value="침해" ${r.status === '침해' ? 'selected' : ''}>침해</option>
            <option value="제외" ${r.status === '제외' ? 'selected' : ''}>제외</option>
          </select>
        </td>
        <td>
          <button class="filter-btn log-btn" style="font-size:11px;padding:3px 10px;"
            data-type="site" data-key="${escHtml(r.siteName)}" data-label="${escHtml(r.siteName)}">로그</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.log-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openLogModal(btn.dataset.type, btn.dataset.key, btn.dataset.label);
      });
    });

    tbody.querySelectorAll('.site-status-select').forEach(sel => {
      sel.addEventListener('change', () => updateSiteStatus(sel.dataset.site, sel));
    });
  }

  async function updateSiteStatus(siteName, selectEl) {
    const newStatus = selectEl.value;
    selectEl.disabled = true;
    try {
      await sbPatch('sites', `site_name=eq.${encodeURIComponent(siteName)}`, { status: newStatus });
      const site = allSites.find(s => s.siteName === siteName);
      if (site) site.status = newStatus;
      selectEl.className = `site-status-select s-${newStatus}`;
      updateStats();
      showToast(`${siteName} 상태 변경 완료`, 'success');
    } catch {
      showToast('상태 변경 실패', 'error');
    } finally {
      selectEl.disabled = false;
    }
  }

  // ========================
  // 전체 로그 테이블
  // ========================
  function setAllFilter(f, el) {
    allFilter = f;
    document.querySelectorAll('#tab-all .filter-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    renderAllTable();
  }

  function sortAll(key, el) {
    if (allSortKey === key) allSortAsc = !allSortAsc;
    else { allSortKey = key; allSortAsc = false; }
    if (allSortEl) allSortEl.classList.remove('sorted');
    el.classList.add('sorted');
    allSortEl = el;
    renderAllTable();
  }

  function renderAllTable() {
    const search = document.getElementById('search-all').value.trim().toLowerCase();

    let rows = allData.filter(d => {
      const matchFilter = allFilter === '' ? true
        : allFilter === 'active' ? d.deleted !== 'Y'
        : d.deleted === 'Y';
      const matchSearch = !search ||
        d.workTitle.toLowerCase().includes(search) ||
        d.siteName.toLowerCase().includes(search) ||
        d.resultTitle.toLowerCase().includes(search);
      return matchFilter && matchSearch;
    });

    rows = [...rows].sort((a, b) => {
      let va = a[allSortKey] || '', vb = b[allSortKey] || '';
      if (va < vb) return allSortAsc ? -1 : 1;
      if (va > vb) return allSortAsc ? 1 : -1;
      return 0;
    });

    document.getElementById('count-all').textContent = `총 ${rows.length}건`;

    const tbody = document.getElementById('tbody-all');
    if (!rows.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="7">데이터가 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(d => `
      <tr>
        <td>
          <div style="font-weight:500;font-size:13px;">${escHtml(d.workTitle)}</div>
          <div style="font-size:11px;color:var(--text-dim);">${escHtml(d.engTitle)}</div>
        </td>
        <td><span class="site-badge">${escHtml(d.siteName)}</span></td>
        <td>
          <div class="result-title">${escHtml(d.resultTitle)}</div>
          <a class="result-url" href="${escHtml(d.url)}" target="_blank" rel="noopener">${escHtml(d.url)}</a>
          ${d.snippet ? `<div class="snippet-text">${escHtml(d.snippet)}</div>` : ''}
        </td>
        <td class="date-text">${formatDateKo(d.firstFound)}</td>
        <td class="date-text">${formatDateKo(d.searchDate)}</td>
        <td>${d.deleted === 'Y' ? `<span class="tag-deleted">삭제</span>` : `<span class="tag-active">활성</span>`}</td>
        <td>
          <button class="btn-delete-log" data-url="${escHtml(d.url)}" title="삭제">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-delete-log').forEach(btn => {
      btn.addEventListener('click', () => deleteLog(btn.dataset.url, 'all'));
    });
  }

  // ========================
  // 로그 모달
  // ========================
  let currentModalLogs = [];
  let currentLogTab = 'all';
  let currentModalDates = [];
  let currentDateIndex = 0;

  function openLogModal(type, key, label) {
    let logs = type === 'work'
      ? allData.filter(d => d.engTitle === key)
      : allData.filter(d => d.siteName === key);

    logs = [...logs].sort((a, b) => b.searchDate.localeCompare(a.searchDate));

    currentModalLogs = logs;
    currentLogTab = 'all';

    const dateSet = new Set(logs.map(d => d.searchDate));
    currentModalDates = [...dateSet].sort((a, b) => a.localeCompare(b)); // 오름차순 (오래된 날짜 먼저)
    currentDateIndex = currentModalDates.length - 1; // 기본값: 가장 최신 날짜

    document.getElementById('modal-label').innerHTML =
      `${type === 'work' ? '작품' : '사이트'} 로그 — <span>${escHtml(label)}</span>`;

    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.modal-tab[onclick*="all"]').classList.add('active');
    document.getElementById('modal-date-wrap').style.display = 'none';

    renderDailyChart(logs);
    renderModalLogTable(logs);

    document.getElementById('log-modal').classList.add('open');
  }

  function switchLogTab(tab, el) {
    currentLogTab = tab;
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');

    const dateWrap = document.getElementById('modal-date-wrap');
    if (tab === 'all') {
      dateWrap.style.display = 'none';
      renderModalLogTable(currentModalLogs);
    } else {
      dateWrap.style.display = 'flex';
      currentDateIndex = 0;
      renderDateLog();
    }
  }

  function moveDateLog(dir) {
    const newIdx = currentDateIndex + dir;
    if (newIdx < 0 || newIdx >= currentModalDates.length) return;
    currentDateIndex = newIdx;
    renderDateLog();
  }

  function renderDateLog() {
    const date = currentModalDates[currentDateIndex];
    const total = currentModalDates.length;
    const idx = currentDateIndex + 1;
    document.getElementById('modal-date-label').textContent =
      `${formatDateKo(date)} (${idx}/${total})`;

    const navBtns = document.querySelectorAll('.modal-date-nav');
    if (navBtns[0]) navBtns[0].disabled = currentDateIndex <= 0;
    if (navBtns[1]) navBtns[1].disabled = currentDateIndex >= currentModalDates.length - 1;

    const filtered = currentModalLogs.filter(d => d.searchDate === date);
    renderModalLogTable(filtered);
  }

  // 작품 URL 조회 헬퍼
  function getWorkUrl(workTitle) {
    const work = allWorks.find(w => w.title === workTitle);
    return work ? work.url : '';
  }

  function renderModalLogTable(logs) {
    document.getElementById('modal-log-body').innerHTML = logs.map(d => {
      const workUrl = getWorkUrl(d.workTitle);
      return `
        <tr>
          <td>
            ${workUrl
              ? `<a class="modal-work-link" href="${escHtml(workUrl)}" target="_blank" rel="noopener">${escHtml(d.workTitle)}</a>`
              : `<span style="font-weight:600;font-size:13px;">${escHtml(d.workTitle)}</span>`
            }
          </td>
          <td><span class="site-badge">${escHtml(d.siteName)}</span></td>
          <td style="font-size:12px;font-weight:500;">${escHtml(d.resultTitle)}</td>
          <td>
            <a class="result-url" href="${escHtml(d.url)}" target="_blank" rel="noopener">${escHtml(d.url)}</a>
          </td>
          <td>${d.deleted === 'Y' ? `<span class="tag-deleted">삭제</span>` : `<span class="tag-active">활성</span>`}</td>
          <td>
            <button class="btn-delete-log" data-url="${escHtml(d.url)}" title="삭제">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('#modal-log-body .btn-delete-log').forEach(btn => {
      btn.addEventListener('click', () => deleteLog(btn.dataset.url, 'modal'));
    });

    const active = logs.filter(d => d.deleted !== 'Y').length;
    const deleted = logs.filter(d => d.deleted === 'Y').length;
    document.getElementById('modal-footer-left').textContent = `${logs.length}건`;
    document.getElementById('modal-footer-right').innerHTML =
      `<span class="tag-active" style="margin-right:6px;">활성 ${active}</span><span class="tag-deleted">삭제 ${deleted}</span>`;
  }

  // ========================
  // 로그 삭제
  // ========================
  async function deleteLog(url, source) {
    if (!confirm('이 로그를 삭제할까요?')) return;
    try {
      await sbDelete('RAW_DATA', `url=eq.${encodeURIComponent(url)}`);

      // 로컬 데이터에서 제거
      const idx = allData.findIndex(d => d.url === url);
      if (idx !== -1) allData.splice(idx, 1);

      // currentModalLogs에서도 제거
      const midx = currentModalLogs.findIndex(d => d.url === url);
      if (midx !== -1) currentModalLogs.splice(midx, 1);

      updateStats();
      renderMainDeletionChart();
      renderWorksTable();
      renderSitesTable();
      renderAllTable();

      // 모달 내에서 삭제한 경우 모달 새로고침
      if (source === 'modal') {
        renderDailyChart(currentModalLogs);
        if (currentLogTab === 'daily') {
          renderDateLog();
        } else {
          renderModalLogTable(currentModalLogs);
        }
      }

      showToast('삭제 완료', 'success');
    } catch (e) {
      showToast('삭제 실패: ' + e.message, 'error');
    }
  }

  // ========================
  // 선 그래프 공통 헬퍼
  // ========================
  function buildDeletionChartData(logs, startDate, endDate) {
    // 삭제일 기준 집계
    const dateMap = {};
    for (const d of logs) {
      if (d.deleted === 'Y' && d.deletedDate) {
        dateMap[d.deletedDate] = (dateMap[d.deletedDate] || 0) + 1;
      }
    }

    // startDate ~ endDate 사이 전체 날짜 생성
    const labels = [];
    const values = [];
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      const key = cur.toISOString().split('T')[0];
      labels.push(key.slice(5)); // MM-DD
      values.push(dateMap[key] || 0);
      cur.setDate(cur.getDate() + 1);
    }
    return { labels, values };
  }

  function createLineChart(canvasId, labels, values, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    // 부모 컨테이너 크기에 맞게 canvas 명시적 설정
    const parent = canvas.parentElement;
    canvas.width = parent.offsetWidth || 800;
    canvas.height = parent.offsetHeight || 140;

    const ctx = canvas.getContext('2d');
    const rgba = color.replace('rgb(', 'rgba(').replace(')', ', 0.12)');

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: color,
          backgroundColor: rgba,
          borderWidth: 2,
          pointRadius: values.map(v => v > 0 ? 3 : 0),
          pointHoverRadius: 5,
          tension: 0.35,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#181c24',
            borderColor: '#2e3a50',
            borderWidth: 1,
            titleColor: '#e8edf5',
            bodyColor: '#8a97b0',
            callbacks: {
              label: ctx => ` ${ctx.parsed.y}건 삭제`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(46,58,80,0.4)' },
            border: { color: 'rgba(46,58,80,0.6)' },
            ticks: {
              color: '#8a97b0',
              font: { size: 10 },
              maxTicksLimit: 16,
              maxRotation: 0,
            }
          },
          y: {
            grid: { color: 'rgba(46,58,80,0.4)' },
            border: { color: 'rgba(46,58,80,0.6)' },
            ticks: {
              color: '#8a97b0',
              font: { size: 10 },
              stepSize: 1,
              precision: 0,
            },
            min: 0,
            beginAtZero: true,
          }
        }
      }
    });
  }

  // 메인 페이지 전체 삭제량 차트
  function renderMainDeletionChart() {
    if (mainChartInstance) { mainChartInstance.destroy(); mainChartInstance = null; }

    const deleted = allData.filter(d => d.deleted === 'Y' && d.deletedDate);
    const emptyEl = document.getElementById('deletion-chart-empty');
    const canvas = document.getElementById('deletion-chart');

    if (!deleted.length) {
      canvas.style.display = 'none';
      emptyEl.style.display = 'flex';
      return;
    }

    canvas.style.display = 'block';
    emptyEl.style.display = 'none';

    // 범위: 첫 삭제일 ~ 어제
    const allDates = deleted.map(d => d.deletedDate).sort();
    const startDate = allDates[0];
    const lastDeleteDate = allDates[allDates.length - 1];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    // endDate는 마지막 삭제일과 전일 중 더 최근
    const endDate = yesterdayStr > lastDeleteDate ? yesterdayStr : lastDeleteDate;

    const { labels, values } = buildDeletionChartData(allData, startDate, endDate);

    document.getElementById('deletion-chart-range').textContent =
      `${formatDateKo(startDate)} ~ ${formatDateKo(endDate)}`;

    mainChartInstance = createLineChart('deletion-chart', labels, values, 'rgb(248,113,113)');
  }

  // 모달 삭제 차트
  function renderDailyChart(logs) {
    if (modalChartInstance) { modalChartInstance.destroy(); modalChartInstance = null; }

    const canvas = document.getElementById('modal-deletion-chart');
    const emptyEl = document.getElementById('modal-chart-empty');
    const deleted = logs.filter(d => d.deleted === 'Y' && d.deletedDate);

    if (!deleted.length) {
      canvas.style.display = 'none';
      emptyEl.style.display = 'flex';
      return;
    }

    canvas.style.display = 'block';
    emptyEl.style.display = 'none';

    // 범위: 첫 검색일 ~ 어제
    const searchDates = logs.map(d => d.searchDate).sort();
    const startDate = searchDates[0];
    const lastSearchDate = searchDates[searchDates.length - 1];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const endDate = yesterdayStr > lastSearchDate ? yesterdayStr : lastSearchDate;

    const { labels, values } = buildDeletionChartData(logs, startDate, endDate);

    modalChartInstance = createLineChart('modal-deletion-chart', labels, values, 'rgb(248,113,113)');
  }

  function closeLogModal(e) {
    if (e.target === document.getElementById('log-modal')) closeLogModalDirect();
  }

  function closeLogModalDirect() {
    document.getElementById('log-modal').classList.remove('open');
  }

  // ========================
  // 유틸
  // ========================
  
  
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLogModalDirect();
  });

  loadData();