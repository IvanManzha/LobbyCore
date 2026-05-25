// public/script.js

/**
 * Клиентский кэш с localStorage
 * @param {string} url — URL для fetch
 * @param {string} cacheKey — ключ в localStorage
 * @param {number}  ttl — время жизни кеша (мс)
 */


async function fetchWithCache(url, cacheKey, ttl = 60_000) {
    const now   = Date.now();
    const tsKey = cacheKey + ':ts';
    const last  = Number(localStorage.getItem(tsKey) || 0);
  
    if (now - last < ttl) {
      const str = localStorage.getItem(cacheKey);
      if (str) {
        return JSON.parse(str);
      }
    }
  
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Ошибка ${res.status} при запросе ${url}`);
    const data = await res.json();
  
    localStorage.setItem(cacheKey, JSON.stringify(data));
    localStorage.setItem(tsKey, now);
    return data;
  }

if ('EventSource' in window) {
const es = new EventSource('/api/stream');
es.addEventListener('table-updated', e => {
    const tid = e.data;
    // инвалидируем кеш конкретного турнира и активного
    localStorage.removeItem(`table:${tid}`);
    localStorage.removeItem(`table:${tid}:ts`);
    localStorage.removeItem('activeTable');
    localStorage.removeItem('activeTable:ts');

    // и сразу перерисовываем текущее view, если функция доступна
    if (typeof renderSchedule === 'function') renderSchedule();
    if (typeof loadTable      === 'function') loadTable();
    if (typeof loadSoloProfile === 'function') loadSoloProfile();
    if (typeof loadPlayerProfile === 'function') loadPlayerProfile();
});
}
  
  
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
  }
  
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
  }
  
  // Глобально
    let _initialRanks = null;
    let _prevScores   = null;
    let resetInitialRanks = false;

    function captureRowPositions(tbody) {
    const pos = {};
    tbody.querySelectorAll('tr').forEach(tr => {
        pos[tr.dataset.name] = tr.getBoundingClientRect().top;
    });
    return pos;
    }

    async function loadTable() {
    const tbody = document.querySelector('#table tbody');
    const oldPos = captureRowPositions(tbody);

    // 1) Определяем tid и сбрасываем состояние, если tid сменился
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('tournament') || 'active';
    const lastTid = sessionStorage.getItem('lastTid');
    if (lastTid !== tid) {
        _initialRanks = null;
        _prevScores   = null;
        sessionStorage.setItem('lastTid', tid);
    }

    // 2) Получаем данные
    const url = tid === 'active'
        ? '/api/table'
        : `/api/tournaments/${encodeURIComponent(tid)}/table`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Ошибка ${res.status} при загрузке таблицы`);
    const json = await res.json();

    // 3) Заголовок турнира
    document.getElementById('tournament-name').textContent =
        json.tournament?.name || 'Без названия';

    // 4) Сортировка команд
    const teams = (json.teams || []).slice().sort((a, b) =>
        (a.rank ?? 999) - (b.rank ?? 999)
    );

    // 5) Сохраняем текущие ранги как начальные (если впервые)
    if (!_initialRanks) {
        _initialRanks = {};
        teams.forEach(t => { _initialRanks[t.name] = t.rank; });
    }

    // 6) Рендер строк
    tbody.innerHTML = '';
    teams.forEach(team => {
        const name     = team.name;
        const curRank  = team.rank;
        const initRank = _initialRanks[name];
        let deltaHTML  = '';

        if (initRank != null) {
        const diff = initRank - curRank;
        if (diff > 0) {
            deltaHTML = `
            <span class="delta">
                ( <img src="/images/arrow-up.svg" class="delta-icon up" alt="up"> ${diff} )
            </span>`;
        } else if (diff < 0) {
            deltaHTML = `
            <span class="delta">
                ( <img src="/images/arrow-down.svg" class="delta-icon down" alt="down"> ${-diff} )
            </span>`;
        }
        }

        const tr = document.createElement('tr');
        tr.dataset.name = name;
        tr.innerHTML = `
        <td class="place-cell">${curRank}${deltaHTML}</td>
        <td class="name-cell">
        <a href="${teamLink(name, json.tournament.type, tid)}">${name}</a>
        </td>
        <td class="team-score">${team.totalPoints}</td>
        `;
        tbody.append(tr);
    });

    // 7) FLIP-анимация перемещения строк
    tbody.querySelectorAll('tr').forEach(tr => {
        const oldTop = oldPos[tr.dataset.name];
        if (oldTop != null) {
        const newTop = tr.getBoundingClientRect().top;
        const delta  = oldTop - newTop;
        if (delta) {
            tr.style.transform = `translateY(${delta}px)`;
            requestAnimationFrame(() => {
            tr.style.transition = 'transform 800ms ease';
            tr.style.transform  = '';
            });
            tr.addEventListener('transitionend', () => {
            tr.style.transition = '';
            }, { once: true });
        }
        }
    });

    // 8) Подсветка изменения очков
    if (_prevScores) {
        tbody.querySelectorAll('.team-score').forEach(cell => {
        const name = cell.closest('tr').dataset.name;
        const old  = _prevScores[name];
        const cur  = Number(cell.textContent);
        if (old != null && cur !== old) {
            cell.classList.add('score-highlight');
            setTimeout(() => cell.classList.remove('score-highlight'), 1000);
        }
        });
    }

    // 9) Сохраняем текущие очки
    _prevScores = {};
    teams.forEach(t => {
        _prevScores[t.name] = t.totalPoints;
    });
    }
  
  function teamLink(name, type, tid) {
    const base = type === 'solo' ? 'solo.html?player=' : 'team.html?team=';
    const query = encodeURIComponent(name) + (tid ? `&tournament=${encodeURIComponent(tid)}` : '');
    return base + query;
  }
  
  function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark-theme');
      btn.textContent = '☀️ Тема';
    }
    btn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-theme');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      btn.textContent = isDark ? '☀️ Тема' : '🌙 Тема';
    });
  }
  
  function setupProfileButton() {
    const btn = document.getElementById('profile-btn');
    if (!btn) return;
    const raw = localStorage.getItem('profile');
    if (!raw) {
      btn.style.display = 'none';
      return;
    }
    try {
      const profile = JSON.parse(raw);
      if (profile.name) {
        btn.style.display = 'block';
        btn.addEventListener('click', () => {
          window.location.href = `player.html?player=${encodeURIComponent(profile.name)}`;
        });
        return;
      }
    } catch {}
    btn.style.display = 'none';
  }
  function setupScheduleButton() {
    const btn = document.getElementById('schedule-btn');
    if (!btn) return;
    btn.style.display = 'block';  // на случай, если где-то скрыта
    btn.addEventListener('click', () => {
      window.location.href = 'schedule.html';
    });
  }
  async function renderActiveButton() {
    try {
      const res = await fetch('/api/tournaments');
      if (!res.ok) return;
      const tours = await res.json();
  
      const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const todayTournament = tours.find(t => {
        const tDate = new Date(t.date).toISOString().split('T')[0];
        return tDate === todayStr || t.state === 'В процессе';
      });

      const btn = document.getElementById('active-tournament-btn');
      if (!todayTournament || !btn) return;
  
      const params = new URLSearchParams(window.location.search);
      const currentTid = params.get('tournament');
  
      const isAtCurrent = (
        window.location.pathname.endsWith('index.html') &&
        (currentTid === null || currentTid === todayTournament.id)
      );
  
      if (isAtCurrent) {
        btn.style.display = 'none';
      } else {
        btn.style.display = 'block';
        btn.onclick = () => {
          window.location.href = `index.html?tournament=${encodeURIComponent(todayTournament.id)}`;
        };
      }
    } catch (err) {
      console.warn('Ошибка renderActiveButton:', err);
    }
  }
  
  

async function setupEnterResultsButton() {
    console.log('setupEnterResultsButton() called');
    const raw = localStorage.getItem('profile');
    if (!raw) {
      console.log('  no profile → hiding button');
      return;
    }
    let profile;
    try {
      profile = JSON.parse(raw);
    } catch {
      console.log('  profile parse error');
      return;
    }
    console.log('  profile loaded:', profile);
  
    // проверка change=false
    const tours = await fetch('/api/tournaments').then(r => r.json());
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('tournament');
    const active = tours.find(t => t.active);
    const cur = tid 
    ? tours.find(t => t.id === tid) 
    : active;
    console.log('  current tour:', cur);
    if (!cur || cur.change) return;

    // **Сохраняем текущий турнир в window**
    window.currentTournament = cur;

  
    const btn = document.getElementById('enter-results-btn');
    if (!btn) {
      console.error('  cannot find #enter-results-btn');
      return;
    }
    btn.style.display = 'inline-block';
    btn.addEventListener('click', () => {
      console.log('enter-results-btn clicked');
      openResultsModal();
    });
    console.log('  button is now visible and listener attached');
  }
  
  
  
  async function openResultsModal() {
    resetInitialRanks = true;
    const tid = window.currentTournament.id;
  // 1) Загрузить именно table.json
  const tableData = await fetch(`/api/tournaments/${tid}/table`)
    .then(r=>r.ok ? r.json() : Promise.reject())
    .catch(() => { alert('Не удалось загрузить таблицу турнира'); return; });
  window.currentTable = tableData;    // <— здесь

  const rounds = tableData.tournament.rounds;
  const teams  = tableData.teams;
  
    // 2) Очищаем предыдущие значения
    const ms = document.getElementById('match-select');
    ms.innerHTML = '';
    const container = document.getElementById('placements-container');
    container.innerHTML = '';
  
    // 3) Заполняем селект матчей
    for (let i = 1; i <= rounds; i++) {
      const opt = document.createElement('option');
      opt.value = i; opt.textContent = `Матч ${i}`;
      ms.append(opt);
    }
  
    // 4) Формируем блоки для каждой позиции
    teams.forEach((team, idx) => {
      const place = idx + 1;
      const div = document.createElement('div');
      div.className = 'placement-block';
      div.dataset.place = place;
      div.innerHTML = `
        <h4>${place}-е место</h4>
        <select class="team-select">
          <option value="">— выбрать команду —</option>
          ${teams.map(t => `<option value="${t.name}">${t.name}</option>`).join('')}
        </select>
        <div class="player-kills"></div>
      `;
      container.append(div);
    });
  
    // 5) Назначаем обработчик изменения селектов
    container.addEventListener('change', onTeamSelect);
  
    // 6) Кнопки
    document.getElementById('save-results-btn').disabled = true;
    document.getElementById('cancel-results-btn').onclick = () => {
      document.getElementById('results-modal').style.display = 'none';
    };
    document.getElementById('save-results-btn').onclick   = saveMatchResults;
  
    // 7) Показываем модалку
    document.getElementById('results-modal').style.display = 'flex';
  }
  
  
  function onTeamSelect(e) {
    if (!e.target.classList.contains('team-select')) return;
    const allSelects = Array.from(document.querySelectorAll('.placement-block .team-select'));
    const selections = allSelects.map(sel => sel.value).filter(v => v);
  
    allSelects.forEach(sel => {
      const currentValue = sel.value;
      // очищаем все опции
      Array.from(sel.options).forEach(opt => {
        opt.disabled = false;
      });
      // для каждой выбранной в других селектах — отключаем
      selections.forEach(val => {
        if (sel.value !== val) {
          const opt = sel.querySelector(`option[value="${val}"]`);
          if (opt) opt.disabled = true;
        }
      });
      // оставляем текущий селект с тем же value, даже если оно есть в disabled, — включаем его
      if (currentValue) {
        const selfOpt = sel.querySelector(`option[value="${currentValue}"]`);
        if (selfOpt) selfOpt.disabled = false;
      }
    });
  
    // Отрисуем блок киллов для только что изменённого селекта:
    const block = e.target.closest('.placement-block');
    const pkDiv = block.querySelector('.player-kills');
    pkDiv.innerHTML = '';
  
    if (e.target.value) {
      const team = window.currentTable.teams.find(t => t.name === e.target.value);
      team.players.forEach(player => {
        const lbl = document.createElement('label');
        lbl.innerHTML = `
          ${player}:
          <input type="number" min="0" value="0"
                 class="kill-input" data-player="${player}" />
        `;
        pkDiv.append(lbl);
      });
    }
  
    // Включаем кнопку «Сохранить», когда все селекты заполнены
    const allFilled = allSelects.every(sel => !!sel.value);
    document.getElementById('save-results-btn').disabled = !allFilled;
  }
  
  
  
  async function saveMatchResults() {
    // 0) Получаем ID турнира из глобального объекта
    const tid = window.currentTournament.id;
    
    // 1) Получаем выбранный номер матча
    const ms = document.getElementById('match-select');
    const matchNo = Number(ms.value);
    if (!matchNo) {
      return alert('Выберите номер матча');
    }
  
    // 2) Собираем все блоки с позициями
    const blocks = Array.from(document.querySelectorAll('.placement-block'));
  
    // 3) Сначала обновляем командные результаты
    for (const blk of blocks) {
      const place    = Number(blk.dataset.place);
      const teamName = blk.querySelector('.team-select').value;
      const total    = [...blk.querySelectorAll('.kill-input')]
                        .reduce((sum, inp) => sum + Number(inp.value), 0);
  
      const resp = await fetch('/api/update-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tid,
          match:       matchNo,
          placement:   place,
          kills:       total,
          teamName
        })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({error:resp.statusText}));
        return alert('Ошибка update-result: ' + (err.error||resp.statusText));
      }
    }
  
    // 4) Затем — личные киллы каждого игрока
    for (const blk of blocks) {
      const teamName = blk.querySelector('.team-select').value;
      for (const inp of blk.querySelectorAll('.kill-input')) {
        const playerName = inp.dataset.player;
        const count      = Number(inp.value);
  
        const resp = await fetch('/api/update-player-kills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tournamentId: tid,
            match:       matchNo,
            teamName,
            playerName,
            kills:       count
          })
        });
        if (!resp.ok) {
          const err = await resp.json().catch(()=>({error:resp.statusText}));
          return alert('Ошибка update-player-kills: ' + (err.error||resp.statusText));
        }
      }
    }
  
    // 5) И, наконец, пересчёт лидерборда
    {
      const resp = await fetch('/api/calc-leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tid })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({error:resp.statusText}));
        return alert('Ошибка calc-leaderboard: ' + (err.error||resp.statusText));
      }
    }
  
    // 6) Сброс кэша для этой таблицы, чтобы loadTable точно взял свежие данные
    localStorage.removeItem(`table:${tid}`);
    localStorage.removeItem(`table:${tid}:ts`);
    localStorage.removeItem('activeTable');
    localStorage.removeItem('activeTable:ts');
  
    // 7) Закрываем модалку и перерисовываем таблицу конкретного турнира
    document.getElementById('results-modal').style.display = 'none';
    await loadTable(tid);
  }
  
  
  
  
  
  
  document.addEventListener('DOMContentLoaded', () => {
    setupThemeToggle();
    loadTable();
    setInterval(loadTable, 60_000);
    setupProfileButton();
    setupScheduleButton();
    renderActiveButton();
    setupEnterResultsButton();

    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          sessionStorage.removeItem('lastTid');
        }
      });
  });
  