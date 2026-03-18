let allData = [];
  let currentFilter = '';
  let sortKey = 'totalViews';
  let sortAsc = false;

  // 데이터 로드
  async function loadData() {
    const btn = document.getElementById('refresh-btn');
    btn.classList.add('loading');

    try {
      const res = await fetch(`${API_URL}?action=getAll`);
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      allData = data;
      updateStats();
      renderTable();

      const now = new Date().toLocaleString('ko-KR');
      document.getElementById('last-updated').textContent = `마지막 업데이트: ${now}`;
    } catch (e) {
      showToast('데이터 로드 실패: ' + e.message, 'error');
      document.getElementById('table-body').innerHTML =
        `<tr class="empty-row"><td colspan="6">데이터를 불러올 수 없습니다.</td></tr>`;
    } finally {
      btn.classList.remove('loading');
    }
  }

  // 통계 업데이트
  function updateStats() {
    document.getElementById('stat-total').textContent = allData.length;
    document.getElementById('stat-unset').textContent = allData.filter(d => !d.status).length;
    document.getElementById('stat-exception').textContent = allData.filter(d => d.status === '예외').length;
    document.getElementById('stat-monitoring').textContent = allData.filter(d => d.status === '모니터링').length;
    document.getElementById('stat-crawling').textContent = allData.filter(d => d.status === '크롤링').length;
    document.getElementById('stat-blocked').textContent = allData.filter(d => d.status === '차단').length;
  }

  // 필터
  function setFilter(val) {
    currentFilter = val;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === val);
    });
    renderTable();
  }

  // 정렬
  function sortBy(key) {
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = false; }

    document.querySelectorAll('th').forEach(th => th.classList.remove('sorted'));
    event.currentTarget.classList.add('sorted');

    renderTable();
  }

  // 테이블 렌더링
  function renderTable() {
    const search = document.getElementById('search-input').value.trim().toLowerCase();

    let filtered = allData.filter(d => {
      const matchFilter = !currentFilter
        ? true
        : currentFilter === '__unset__'
          ? !d.status
          : d.status === currentFilter;
      const matchSearch = !search || String(d.memberId).toLowerCase().includes(search);
      return matchFilter && matchSearch;
    });

    filtered.sort((a, b) => {
      let va = a[sortKey] || '', vb = b[sortKey] || '';
      if (sortKey === 'totalViews' || sortKey === 'count') {
        va = Number(va); vb = Number(vb);
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    const tbody = document.getElementById('table-body');

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="7">조건에 맞는 데이터가 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(d => `
      <tr>
        <td>
          <span class="member-id" onclick="openLog('${d.memberId}')">${d.memberId}</span>
        </td>
        <td><span class="num">${Number(d.totalViews).toLocaleString()}</span></td>
        <td><span class="num">${d.count}</span></td>
        <td><span class="date">${formatDate(d.lastDate)}</span></td>
        <td>
          <select class="status-select s-${d.status}" onchange="updateStatus('${d.memberId}', this)">
            <option value="" ${!d.status ? 'selected' : ''}>— 미설정</option>
            <option value="예외" ${d.status === '예외' ? 'selected' : ''}>예외</option>
            <option value="모니터링" ${d.status === '모니터링' ? 'selected' : ''}>모니터링</option>
            <option value="크롤링" ${d.status === '크롤링' ? 'selected' : ''}>크롤링</option>
            <option value="차단" ${d.status === '차단' ? 'selected' : ''}>차단</option>
          </select>
        </td>
        <td><span class="blocked-date">${d.blockedDate ? formatDate(d.blockedDate) : ''}</span></td>
        <td>
          <div class="memo-cell">
            ${d.memo ? `<span class="memo-text" title="${escapeHtml(d.memo)}">${escapeHtml(d.memo)}</span>` : ''}
            <button class="memo-btn" onclick="openMemo('${d.memberId}')" title="메모 편집">✎</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // 상태 업데이트
  async function updateStatus(memberId, selectEl) {
    const newStatus = selectEl.value;
    const prevStatus = selectEl.className.replace('status-select s-', '').trim();

    selectEl.disabled = true;

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'updateStatus', memberId, status: newStatus })
      });
      const data = await res.json();

      if (!data.success) throw new Error('업데이트 실패');

      // 로컬 데이터 업데이트
      const member = allData.find(d => String(d.memberId) === String(memberId));
      if (member) {
        member.status = newStatus;
        member.blockedDate = newStatus === '차단'
          ? new Date().toISOString().split('T')[0]
          : '';
      }

      selectEl.className = `status-select s-${newStatus}`;
      updateStats();

      // 차단일 셀 업데이트
      const row = selectEl.closest('tr');
      const blockedCell = row.querySelector('.blocked-date');
      if (blockedCell) {
        blockedCell.textContent = newStatus === '차단'
          ? formatDate(new Date().toISOString().split('T')[0])
          : '';
      }

      showToast(`${memberId} 상태 변경 완료`, 'success');
    } catch (e) {
      selectEl.className = `status-select s-${prevStatus}`;
      showToast('상태 변경 실패', 'error');
    } finally {
      selectEl.disabled = false;
    }
  }

  // 로그 모달
  async function openLog(memberId) {
    document.getElementById('modal-member-id').textContent = memberId;
    document.getElementById('log-body').innerHTML =
      `<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-dim);"><span class="spinner"></span></td></tr>`;
    document.getElementById('modal-footer').textContent = '';
    document.getElementById('modal').classList.add('open');

    try {
      const res = await fetch(`${API_URL}?action=getLogs&memberId=${memberId}`);
      const logs = await res.json();

      if (!logs.length) {
        document.getElementById('log-body').innerHTML =
          `<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-dim);font-family:var(--mono);font-size:12px;">로그 없음</td></tr>`;
        return;
      }

      document.getElementById('log-body').innerHTML = logs.map(l => `
        <tr>
          <td>${l.memberId}</td>
          <td>${Number(l.views).toLocaleString()}</td>
          <td>${formatDate(l.date)}</td>
        </tr>
      `).join('');

      const total = logs.reduce((s, l) => s + Number(l.views), 0);
      document.getElementById('modal-footer').textContent =
        `총 ${logs.length}건 · 열람수 합계: ${total.toLocaleString()}`;

    } catch (e) {
      document.getElementById('log-body').innerHTML =
        `<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--red);font-family:var(--mono);font-size:12px;">로그 불러오기 실패</td></tr>`;
    }
  }

  function closeModal(e) {
    if (e.target === document.getElementById('modal')) closeModalDirect();
  }

  function closeModalDirect() {
    document.getElementById('modal').classList.remove('open');
  }

  // 날짜 포맷
  
  // 토스트
  
  // 메모
  let memoTargetId = null;

  function openMemo(memberId) {
    memoTargetId = memberId;
    const member = allData.find(d => String(d.memberId) === String(memberId));
    document.getElementById('memo-modal-member-id').textContent = memberId;
    document.getElementById('memo-textarea').value = member?.memo || '';
    document.getElementById('memo-modal').classList.add('open');
    setTimeout(() => document.getElementById('memo-textarea').focus(), 100);
  }

  function closeMemoModal(e) {
    if (e.target === document.getElementById('memo-modal')) closeMemoModalDirect();
  }

  function closeMemoModalDirect() {
    document.getElementById('memo-modal').classList.remove('open');
    memoTargetId = null;
  }

  async function saveMemo() {
    const memo = document.getElementById('memo-textarea').value.trim();
    if (!memoTargetId) return;

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'updateMemo', memberId: memoTargetId, memo })
      });
      const data = await res.json();
      if (!data.success) throw new Error();

      const member = allData.find(d => String(d.memberId) === String(memoTargetId));
      if (member) member.memo = memo;

      closeMemoModalDirect();
      renderTable();
      showToast('메모 저장 완료', 'success');
    } catch {
      showToast('메모 저장 실패', 'error');
    }
  }

  
  // ESC 키로 모달 닫기
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModalDirect();
      closeMemoModalDirect();
    }
  });

  // 초기 로드
  loadData();