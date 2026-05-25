// public/player.js

// кеш-функция здесь
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
  
document.addEventListener('DOMContentLoaded', () => {
    setupThemeToggle();
    setupScheduleButton();
    loadPlayerProfile().catch(err => {
      document.body.innerHTML = `<p style="color:red; padding:2rem;">Ошибка: ${err.message}</p>`;
    });
    renderActiveButton();
  });

  function setupFullStatsToggle(profile, allowStats, canceledIds) {
    const btn  = document.getElementById('show-full-stats');
    const full = document.getElementById('full-stats');
    if (!btn || !full) return;
  
    if (!allowStats) {
      btn.style.setProperty('display', 'none', 'important');
      full.style.display = 'none';
      return;
    }
  
    btn.style.removeProperty('display');
    btn.style.setProperty('display', 'inline-block', 'important');
    full.style.display = 'none';
    btn.textContent = 'Полная статистика';
  
    let rendered = false;
    btn.onclick = () => {
      const show = full.style.display === 'none';
      full.style.display = show ? '' : 'none';
      btn.textContent    = show ? 'Скрыть статистику' : 'Полная статистика';
      if (show && !rendered) {
        renderPlayerStats(profile, canceledIds);
        rendered = true;
      }
    };
  }

  function renderKPI(history) {
    // Оставляем только туры с числовым place
    const done = history.filter(h => typeof h.place === 'number');
    const matches = done.length || 1;
  
    // Среднее место
    const avgPlace = (done.reduce((sum, h) => sum + h.place, 0) / matches).toFixed(2);
    document.getElementById('kpi-place').textContent = avgPlace;
  
    // K/D = суммарные киллы / матч
    const killsArr = done.map(h => Number(h.personalKills) || 0);
    const totalKills = killsArr.reduce((s, k) => s + k, 0);
    const kd = (totalKills / matches).toFixed(2);
    document.getElementById('kpi-kd').textContent = kd;
  
    // % побед (Top-1)
    const top1 = ((done.filter(h => h.place === 1).length / matches) * 100).toFixed(1) + '%';
    document.getElementById('kpi-top1').textContent = top1;
  
    // % попаданий в Top-3
    const top3 = ((done.filter(h => h.place <= 3).length / matches) * 100).toFixed(1) + '%';
    document.getElementById('kpi-top3').textContent = top3;
  }
  
  async function loadPlayerProfile() {
    const params = new URLSearchParams(window.location.search);
    const nick = params.get('player');
    if (!nick) throw new Error('Ник не задан');
  
    // 1) Фетчим профиль
    const [profile, tours] = await Promise.all([
        fetchWithCache(
          `/players/${encodeURIComponent(nick)}.json`,
          `player:${nick}`, 300_000
        ),
        fetchWithCache('/api/tournaments', 'tournaments', 300_000)
      ]);
    
    window.allTournaments = tours;
  
    // 2) Шапка
    document.title = `Профиль: ${profile.name}`;
    document.getElementById('player-name-btn').textContent = profile.name;
    document.getElementById('player-rating').textContent     = `Рейтинг: ${profile.rating || 0}`;
  
    // 3) Рейтинг v2
    const v2Elem = document.getElementById('player-rating-v2');
    if (profile.calibrating) {
      v2Elem.textContent = 'Рейтинг v2: Калибровка';
    } else {
      const v2 = profile.effectiveRating != null ? profile.effectiveRating : '—';
      v2Elem.textContent = `Рейтинг v2: ${v2}`;
    }
  
    renderKPI(profile.history || []);

    // Рендер истории турниров (аккордеон)
    const history = (profile.history || [])
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // 5) История турниров (3 + «Показать все»)
    const VISIBLE_COUNT = 3;
    const visible = history.slice(0, VISIBLE_COUNT);
    const hidden  = history.slice(VISIBLE_COUNT);
    hidden.forEach(e=>e._hidden=true);
  
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = '';
    history.forEach(e => {
      const tr = document.createElement('tr');
      if (e._hidden) tr.classList.add('hidden-row');
      tr.innerHTML = `
        <td><a href="index.html?tournament=${encodeURIComponent(e.tournamentId)}">
          ${e.tournamentName}</a></td>
        <td>${e.date}</td>
        <td>${e.place}</td>
        <td>${e.points}</td>
        <td>${e.personalKills}</td>
      `;
      tbody.append(tr);
    });
  
    const toggleBtn = document.getElementById('toggle-history-btn');
    if (hidden.length === 0) {
      toggleBtn.style.display = 'none';
    } else {
      toggleBtn.style.display = 'inline-block';
      toggleBtn.textContent  = 'Показать все турниры';
      let expanded = false;
      toggleBtn.onclick = () => {
        expanded = !expanded;
        document.querySelectorAll('#history-body tr.hidden-row')
          .forEach(tr => tr.style.display = expanded ? '' : 'none');
        toggleBtn.textContent = expanded ? 'Скрыть' : 'Показать все турниры';
      };
      document.querySelectorAll('#history-body tr.hidden-row')
        .forEach(tr => tr.style.display = 'none');
    }
  
    // 6) Рендер KPI - таблицы
    renderKPI(profile.history || []);

    const nickParam = new URLSearchParams(window.location.search).get('player') || '';
    const isIva = nickParam.toLowerCase() === 'ivanchk';
    const isARAM = nickParam.toLowerCase() === 'sharlatanhs';
    const isstillworst = nickParam.toLowerCase() === 'stillworst';
    const isilya = nickParam.toLowerCase() === 'ilya-destroyer';
    const issecret = nickParam.toLowerCase() === 'secretyt';
    const allowStats = !profile.calibrating || isIva || isARAM || isstillworst || isilya || issecret;
    

    // 7) Рендер остальной статистики
    const canceledIds = new Set(
        window.allTournaments
          .filter(t => t.state === 'Турнир отменен')
          .map(t => t.id)
      );
      setupFullStatsToggle(profile, /* allowStats */ !profile.calibrating || isIva || isARAM, canceledIds);
    

  // Передаём canceledIds в setupFullStatsToggle
    setupFullStatsToggle(profile, allowStats, canceledIds); 
  }
  
  // setupThemeToggle, setupProfileButton…
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
  
  
  
  function setupThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark-theme');
      btn.textContent = '☀️ Тема';
    }
    btn.addEventListener('click', () => {
      const dark = document.body.classList.toggle('dark-theme');
      localStorage.setItem('theme', dark ? 'dark' : 'light');
      btn.textContent = dark ? '☀️ Тема' : '🌙 Тема';
    });
  }
  
  function setupProfileButton() {
    const btn = document.getElementById('profile-btn');
    if (!btn) return;
    const raw = localStorage.getItem('profile');
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      if (p.name) {
        btn.style.display = 'block';
        btn.addEventListener('click', () => {
          window.location.href = `player.html?player=${encodeURIComponent(p.name)}`;
        });
      }
    } catch {}
  }

  function setupScheduleButton() {
    const btn = document.getElementById('schedule-btn');
    if (!btn) return;
    btn.style.display = 'block';  // на случай, если где-то скрыта
    btn.addEventListener('click', () => {
      window.location.href = 'schedule.html';
    });
  }

  // В вашем player.js
  let _chartRating = null;
  let _chartKpiRadar = null;

// renderPlayerStats — линейный график + вызов радара
function renderPlayerStats(profile, canceledIds) {
  const W = 5, M = 10;

  // Фильтруем историю
  const hist = profile.history
    .filter(h => h.newRating != null && !canceledIds.has(h.tournamentId))
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
  if (!hist.length) return;

  const dates      = hist.map(h => h.date);
  const newRatings = hist.map(h => h.newRating);

  // Рассчёт anchors и window
  const longAnchor = profile.longAnchor ?? newRatings[0];
  const longArr    = dates.map(()=>longAnchor);
  const shortArr   = newRatings.map((_,i)=>{
    const slice = newRatings.slice(Math.max(0,i+1-M), i+1);
    return slice.reduce((a,b)=>a+b,0)/slice.length;
  });
  const windowArr  = newRatings.map((_,i)=>{
    const slice = newRatings.slice(Math.max(0,i+1-W), i+1);
    return slice.reduce((a,b)=>a+b,0)/slice.length;
  });

  // Уничтожаем старый линейный чарт
  if (_chartRating) _chartRating.destroy();

  // Рисуем линейный
  _chartRating = new Chart(
    document.getElementById('chart-rating').getContext('2d'),
    {
      type:'line',
      data:{
        labels: dates,
        datasets:[
          { label:'Long Anchor',      data: longArr,    borderDash:[5,5], borderWidth:1, fill:false, pointRadius:0, tension:0 },
          { label:'Short Anchor',     data: shortArr,   borderDash:[5,5], borderWidth:2, fill:false, pointRadius:0, tension:0.2 },
          { label:'Window Rating',    data: windowArr,  borderDash:[2,2], borderWidth:2, fill:false, pointRadius:0, tension:0.2 },
          { label:'Effective Rating', data: newRatings, borderWidth:3, fill:false, pointRadius:3, tension:0.1 }
        ]
      },
      options:{
        plugins:{ legend:{ position:'bottom' }},
        scales:{
          x:{ title:{ display:true, text:'Дата турнира' }},
          y:{ title:{ display:true, text:'Рейтинг' }}
        }
      }
    }
  );

  // И сразу рисуем KPI-радар
  renderKpiRadar(hist);
}

function renderKpiRadar(hist) {
    if (!hist.length || !Array.isArray(window.allTournaments)) return;
  
    const places = hist.map(h => h.place);
    const kills  = hist.map(h => Number(h.personalKills) || 0);
    const points = hist.map(h => h.points);
    const N         = hist.length;
    const avgPlace  = places.reduce((a,b)=>a+b,0)/N;
    const avgKills  = kills.reduce((a,b)=>a+b,0)/N;
    const avgPoints = points.reduce((a,b)=>a+b,0)/N;
    const Kmax      = Math.max(...kills, 1);
    const Pmax      = Math.max(...points,1);
    const sigma     = Math.sqrt(places.reduce((s,x)=>s+(x-avgPlace)**2,0)/N);
    const totalTours = window.allTournaments.filter(t=>t.state!=='Турнир отменен').length || 1;
    const maxPlace  = Math.max(...places, 1);
  
    const m1 = ((maxPlace+1-avgPlace)/maxPlace)*(1-avgKills/Kmax);
    const m2 = avgKills/Kmax;
    const m3 = hist.filter(h=>Number(h.personalKills)>=3).length/N;
    const m4 = avgPoints/Pmax;
    const m5 = N/totalTours;
    const m6 = 1 - sigma/(maxPlace-1);
  
    const norm = x => x*0.9 + 0.05;
    const data = [m1,m2,m3,m4,m5,m6].map(norm);
    const labels = ['Интеллект','Стрельба','Агрессия','Эффективность','Активность','Стабильность'];
  
  // 2) Опции радар-чарта
  const radarOptions = {
    animation: { duration: 0 },
    layout: { padding: 0 },
    scales: {
      r: {
        beginAtZero: true,
        suggestedMax: 1,
        pointLabels: {
          font: { size: 18 },
          color: '#8f8f8f'       // подписи метрик
        },
        angleLines: { color: '#444c56' },
        grid:       { color: '#444c56' },
        ticks:      { display: false }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        titleColor: '#c9d1d9',
        bodyColor:  '#c9d1d9',
        backgroundColor: '#21262d'
      }
    }
  };
  
  
    if (_chartKpiRadar) _chartKpiRadar.destroy();
    _chartKpiRadar = new Chart(
    document.getElementById('chart-kpi-radar').getContext('2d'),
    {
        type: 'radar',
        data: {
        labels,  // ваши метки
        datasets: [{
            label: 'KPI',
            data,
            borderWidth: 2,
            pointRadius: 3,
            fill: true
        }]
        },
        options: radarOptions
    }
    );
}