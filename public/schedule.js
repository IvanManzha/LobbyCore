// public/schedule.js

/**
 * Клиентский кэш с localStorage
 * @param {string} url — URL запроса
 * @param {string} cacheKey — ключ в localStorage
 * @param {number} ttl — время жизни кеша в мс
 */
async function fetchWithCache(url, cacheKey, ttl = 60_000) {
    const now   = Date.now();
    const tsKey = cacheKey + ':ts';
    const last  = Number(localStorage.getItem(tsKey) || 0);
    if (now - last < ttl) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Ошибка ${res.status} при запросе ${url}`);
    const data = await res.json();
    localStorage.setItem(cacheKey, JSON.stringify(data));
    localStorage.setItem(tsKey, now);
    return data;
  }
  
  // Сбрасываем кэш для турнира и списка
  function invalidateCaches(tournamentId) {
    localStorage.removeItem(`table:${tournamentId}`);
    localStorage.removeItem(`table:${tournamentId}:ts`);
    localStorage.removeItem('tournamentsList');
    localStorage.removeItem('tournamentsList:ts');
  }
  
  // Загрузка всех никнеймов (для mixed)
  let allPlayerNames = [];
  async function loadAllPlayerNames() {
    if (allPlayerNames.length) return;
    try {
      const res = await fetch('/api/players');
      if (res.ok) allPlayerNames = await res.json();
    } catch {}
  }
  
  // Загрузка барьеров (для mixed)
  const barrierMap = {};
  async function loadBarriers() {
    const tournaments = await fetchWithCache('/api/tournaments', 'tournamentsList', 300_000);
  
    for (const t of tournaments) {
      if (t.type === 'solo') continue; // solo не проверяем
  
      try {
        const res = await fetch(`/api/tournaments/${encodeURIComponent(t.id)}/table`);
        if (!res.ok) continue;
        const table = await res.json();
        const barrier = table?.tournament?.barrier;
        if (typeof barrier === 'number') {
          barrierMap[t.id] = barrier;
        }
      } catch (err) {
        console.warn(`Не удалось загрузить table.json для ${t.id}:`, err);
      }
    }
  }
  
  
  
  
  // Состояние формы mixed
  let currentTournamentId = null;
  let roster = [];
  
  document.addEventListener('DOMContentLoaded', () => {
    setupThemeToggle();
    setupProfileButton();
    setupScheduleButton();
    loadAllPlayerNames();
    loadBarriers();
    renderActiveButton();
    renderSchedule().catch(e => {
      console.error(e);
      document.body.innerHTML = `<p style="color:red; padding:2rem;">Ошибка: ${e.message}</p>`;
    });
  });

  // 1) renderSchedule — только одна кнопка регистрации для mixed (открывает модалку)
  async function renderSchedule() {
    const today = new Date(); today.setHours(0,0,0,0);
    let playerName = null;
    try { playerName = JSON.parse(localStorage.getItem('profile')||'{}').name; } catch {}
  
    const upBody   = document.querySelector('#upcoming-table tbody');
    const pastBody = document.querySelector('#past-table tbody');
    upBody.innerHTML = ''; pastBody.innerHTML = '';
  
    const tours = await fetchWithCache('/api/tournaments','tournamentsList',300_000);
    for (const t of tours) {
      const tDate      = new Date(t.date); tDate.setHours(0,0,0,0);
      const isCancelled= t.state==='Турнир отменен';
      const datePast   = tDate < today;
      const isUpcoming = !isCancelled && !datePast && t.state!=='Турнир окончен';
      const targetBody = isUpcoming ? upBody : pastBody;
  
      // Загрузка таблицы турнира
      let tableJson = null, teamsCount = 0;
      try {
        tableJson  = await fetchWithCache(
          `/api/tournaments/${encodeURIComponent(t.id)}/table`,
          `table:${t.id}`, 60000
        );
        teamsCount = (tableJson.teams||[]).length;
      } catch {}
  
      // Проверяем, зарегистрирован ли текущий игрок
      let registered = false;
      if (t.type === 'solo') {
        registered = playerName && tableJson &&
          tableJson.teams.some(tm => tm.name === playerName);
      } else {
        registered = playerName && tableJson &&
          tableJson.teams.some(tm =>
            Array.isArray(tm.players) && tm.players.includes(playerName)
          );
      }
  
      // Формируем кнопку/отметку
      let actionHTML = '';
if (isUpcoming) {
  if (t.type === 'solo') {
    // Соло: показываем ✓ или кнопку регистрации
    actionHTML = registered
      ? '✓'
      : `<button class="btn-register" data-id="${t.id}">Регистрация</button>`;
  } else {
    // Командный турнир
    if (playerName === 'IVANCHK') {
      // Для IVANCHK всегда показываем кнопку (даже если он уже "зарегистрирован")
      actionHTML = `<button class="btn-open-team-modal" data-id="${t.id}">Регистрация</button>`;
    } else {
      // Для остальных — привычная логика: ✓ или кнопка
      actionHTML = registered
        ? '✓'
        : `<button class="btn-open-team-modal" data-id="${t.id}">Регистрация</button>`;
    }
  }

  actionHTML = `<td class="action-cell">${actionHTML}</td>`;
}

  
      const priceText  = t.price!=null ? `${t.price}₽` : '—';
      const ratingText = t.ratingRules ? 'Учитывается' : 'Не учитывается';
  
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><a href="index.html?tournament=${encodeURIComponent(t.id)}">${t.name}</a></td>
        <td>${t.type}</td>
        <td class="teams-count">${teamsCount}</td>
        <td>${t.date}</td>
        <td>${priceText}</td>
        <td>${ratingText}</td>
        <td>${t.state}</td>
        <td><button class="btn-rules" data-rules="${encodeURIComponent(t.rules||'')}">Правила</button></td>
        ${actionHTML}
      `;
      targetBody.append(tr);
    }
  
    // Привязываем события
    document.querySelectorAll('.btn-register').forEach(b =>
      b.addEventListener('click', registerSolo)
    );
    document.querySelectorAll('.btn-open-team-modal').forEach(b =>
      b.addEventListener('click', () => openTeamModal(b.dataset.id))
    );
    document.querySelectorAll('.btn-rules').forEach(b =>
      b.addEventListener('click', () =>
        alert(decodeURIComponent(b.dataset.rules) || 'Правила не заданы')
      )
    );
  }
  

  
  
  async function registerSolo(e) {
    const btn = e.currentTarget;
    const raw = localStorage.getItem('profile');
    if (!raw) return alert('Сначала выберите ник через Профиль.');
    const playerName   = JSON.parse(raw).name;
    const tournamentId = btn.dataset.id;
  
    btn.disabled = true; btn.textContent = '…';
    try {
      const r = await fetch('/api/register', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ tournamentId, playerName })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error||'Ошибка регистрации');
  
      invalidateCaches(tournamentId);
      await renderSchedule();
    } catch (err) {
      alert('Ошибка: '+err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Регистрация';
    }
  }
  
  // --- Модалка для mixed ---
  function openTeamModal(tid) {
    currentTournamentId = tid;
    roster = [];
    document.getElementById('roster-list').innerHTML = '';
    document.getElementById('player-input').value = '';
    document.getElementById('team-name-input').value = '';
    document.getElementById('confirm-btn').disabled = true;
    document.getElementById('team-modal').style.display = 'flex';
  }
  
  document.getElementById('cancel-btn').addEventListener('click', () => {
    document.getElementById('team-modal').style.display = 'none';
  });
  
  document.getElementById('add-player-btn').addEventListener('click', async () => {
    const inp = document.getElementById('player-input');
    const raw = inp.value.trim();
    if (!raw) return alert('Введите ник');
  
    // 1) Нормализуем регистр
    const lower = raw.toLowerCase();
    const proper = allPlayerNames.find(n => n.toLowerCase() === lower);
    if (!proper) return alert(`Игрок "${raw}" не найден`);
  
    // 2) Проверяем, нет ли его уже в своём roster
    if (roster.some(p => p.nick === proper)) {
      return alert(`Игрок "${proper}" уже добавлен в вашу команду`);
    }
  
    // 3) Проверяем, не зарегистрирован ли он в другой команде этого турнира
    try {
      const table = await fetchWithCache(
        `/api/tournaments/${encodeURIComponent(currentTournamentId)}/table`,
        `table:${currentTournamentId}`,
        0  // force-запрос, чтобы быть уверенным в актуальности
      );
      const already = table.teams.some(team =>
        Array.isArray(team.players) && team.players.includes(proper)
      );
      if (already) {
        return alert(`Игрок "${proper}" уже зарегистрирован в другой команде`);
      }
    } catch (err) {
      console.warn('Не удалось проверить регистрацию игрока:', err);
      // по желанию можно прервать или продолжить
    }
  
    // 4) Всё ок — тащим его рейтинг и добавляем
    try {
      const profileRes = await fetch(`/players/${encodeURIComponent(proper)}.json`);
      if (!profileRes.ok) throw new Error();
      const profile = await profileRes.json();
      const rating = profile.rating || 0;
  
      // проверка барьера
      const totalRating = roster.reduce((sum, p) => sum + p.rating, 0) + rating;
      if (barrierMap[currentTournamentId] != null &&
          totalRating > barrierMap[currentTournamentId]) {
        return alert('Рейтинг команды превысил барьер');
      }
  
      // пушим в локальный roster
      roster.push({ nick: proper, rating });
  
      // рендерим в список
      const li = document.createElement('li');
      li.innerHTML = `
        ${proper} (${rating})
        <button class="remove-player-btn" title="Удалить">×</button>
      `;
      li.querySelector('.remove-player-btn').addEventListener('click', () => {
        roster = roster.filter(p => p.nick !== proper);
        li.remove();
        document.getElementById('confirm-btn').disabled = roster.length === 0;
      });
      document.getElementById('roster-list').append(li);
  
      inp.value = '';
      document.getElementById('confirm-btn').disabled = roster.length === 0;
    } catch {
      alert(`Не удалось загрузить профиль "${proper}"`);
    }
  });
  
  
  // 2) Confirm-кнопка в модалке: solo если 1 ник, team если 2–4 ника
  document.getElementById('confirm-btn').addEventListener('click', async () => {
    if (!roster.length) {
      return alert('Введите хотя бы один ник');
    }

    const tournamentId = currentTournamentId;
    const rawProfile   = localStorage.getItem('profile');
    if (!rawProfile) {
      return alert('Сначала выберите ник через Профиль.');
    }
    const playerName = roster[0].nick;

    try {
      let res;
      if (roster.length === 1) {
        // соло-регистрация
        res = await fetch('/api/register', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ tournamentId, playerName })
        });
      } else {
        // командная регистрация (допустимо от 2 до 4 игроков)
        if (roster.length > 4) {
          return alert('Команда должна состоять не более чем из 4 человек');
        }
        const teamNameRaw = document.getElementById('team-name-input').value.trim();
        if (!teamNameRaw) {
          return alert('Введите название команды');
        }
        const teamName = teamNameRaw.split(/\s+/).join('_');
        const players  = roster.map(p => p.nick).join(',');
        res = await fetch('/api/register-team', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ tournamentId, teamName, players })
        });
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Ошибка регистрации');
      }

      // Закрываем модалку и перерисовываем расписание
      document.getElementById('team-modal').style.display = 'none';
      invalidateCaches(tournamentId);
      await renderSchedule();
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  });

  
  // --- Утилиты кнопок ---
  function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    if (localStorage.getItem('theme')==='dark') {
      document.body.classList.add('dark-theme');
      btn.textContent='☀️ Тема';
    }
    btn.addEventListener('click', ()=>{
      const dark = document.body.classList.toggle('dark-theme');
      localStorage.setItem('theme', dark?'dark':'light');
      btn.textContent = dark?'☀️ Тема':'🌙 Тема';
    });
  }
  
  function setupProfileButton() {
    const btn = document.getElementById('profile-btn');
    if (!btn) return;
    btn.style.display = 'none';
    try {
      const p = JSON.parse(localStorage.getItem('profile')||'{}');
      if (p.name) {
        btn.style.display = 'block';
        btn.addEventListener('click', ()=> {
          window.location.href = `player.html?player=${encodeURIComponent(p.name)}`;
        });
      }
    } catch {}
  }
  
  function setupScheduleButton() {
    const btn = document.getElementById('schedule-btn');
    if (!btn) return;
    btn.addEventListener('click', ()=> {
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
  
  
  