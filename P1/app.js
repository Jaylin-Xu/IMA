/* ==================== 全局元素与状态 ==================== */
// 弹幕场地
const danmakuBox = document.getElementById('danmaku');
let spawnBtn = null;   // Start/Pause（训练场）
let battleBtn = null;  // 训练场 → 战场
const card       = document.getElementById('meaningCard');
const closeCard  = document.getElementById('closeCard');
const wordText   = document.getElementById('wordText');
const meanText   = document.getElementById('meanText');

const choiceGroup = document.getElementById('choiceGroup');
const btnNo  = document.getElementById('btnNo');   // Battlefield
const btnYes = document.getElementById('btnYes');  // Training Ground
const subtitle   = document.getElementById('subtitle');
const startMount = document.getElementById('startMount');

// 全屏渐黑 + 白字
const noOverlay = document.getElementById('noOverlay');
const noMessage = document.getElementById('noMessage');

// Quiz
const quiz        = document.getElementById('quiz');
const quizWordEl  = document.getElementById('quizWord');     // 这里放“英文句子+中文词”
const quizOptsEl  = document.getElementById('quizOptions');   // 三个选项
const quizHintEl  = document.getElementById('quizHint');      // 一行反馈

// 提示显示时长（别一闪而过）
const HINT_SHOW_MS_CORRECT = 1400;
const HINT_SHOW_MS_WRONG   = 1400;
let   quizHintTimer = null;

function setQuizHint(msg, type){
  clearQuizHint();
  quizHintEl.textContent = msg;
  quizHintEl.classList.toggle('success', type === 'success');
  quizHintEl.classList.toggle('error',   type === 'error');
}
function clearQuizHint(){
  if (quizHintTimer) { clearTimeout(quizHintTimer); quizHintTimer = null; }
  quizHintEl.textContent = '';
  quizHintEl.classList.remove('success','error');
}

// 词库
let WORDS = [];
let running = false;
let spawnTimer = null;
let selectedBullet = null;
let mode = 'idle';  // 'idle' | 'yes' | 'quiz' | 'no'

/* YES 模式：简单“车道”避免弹幕挤车尾 */
let lanes = [];
let laneHeight = 42;
let minGap = 24;

/* NO 模式：对射 + 局部“墨水扩散” + 慢慢黑屏 */
const NO_SPAWN_DURATION_MS = 2600;
const NO_MAX_BULLETS       = 80;
const NO_DURATION_MIN      = 6;
const NO_DURATION_MAX      = 10;
let   noToggleLeft         = true;
let   noFrameTick          = 0;

// “墨水”画布
let inkCanvas = null;
let inkCtx = null;
let inkAnimId = null;
const CELL_SIZE         = 28;
const GROW_PER_FRAME    = 0.10;
const DECAY_PER_FRAME   = 0.025;
const MAX_ENERGY        = 1.00;
const GROW_MULTIPLIER   = 2.2;
const CELLS_DRAW_LIMIT  = 120;
let   overlapCells      = new Map();

/* ==================== 语音（只读中文） ==================== */
let zhVoice = null;
function loadVoices(){
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  if (!voices || !voices.length) return;
  zhVoice = voices.find(v => /zh[-_]CN/i.test(v.lang)) ||
            voices.find(v => /^zh/i.test(v.lang)) ||
            voices.find(v => /chinese/i.test(v.name)) ||
            null;
}
if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => loadVoices();
}
function speakZh(text){
  if (!('speechSynthesis' in window) || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  if (zhVoice) u.voice = zhVoice;
  u.rate = 0.95;
  u.pitch = 1.0;
  u.volume = 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/* ==================== 小工具 ==================== */
function hideTopControls(){
  startMount.innerHTML = '';
  subtitle.hidden = true;
}
function rand(a,b){ return a + Math.random() * (b - a); }
function debounce(fn, wait) { let t = null; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); }; }
function shuffleInPlace(arr){
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
// 包一层：点弹幕先发音，再做原来那件事（比如暂停/开卡片）
function attachPronounceClick(el, word, extra){
  el.addEventListener('click', (evt) => {
    speakZh(word);
    if (typeof extra === 'function') extra(evt);
  });
}

/* ==================== 初始化 ==================== */
window.addEventListener('DOMContentLoaded', async () => {
  subtitle.hidden = true;
  startMount.innerHTML = '';
  if (noOverlay) { noOverlay.style.pointerEvents = 'none'; noOverlay.hidden = true; noOverlay.style.opacity = '0'; }
  if (noMessage) { noMessage.style.pointerEvents = 'none'; noMessage.hidden = true; noMessage.style.opacity = '0'; }

  // 拉词库（这次里面有 contexts，直接拿来出题）
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('Failed to load data.json');
    WORDS = await res.json();
  } catch {
    // 怕断网之类的，随便兜个底，至少不崩
    WORDS = [
      { word: '内卷', meaning: 'Involution; escalating competition with little real gain.', contexts: ["Workload doubled for no reason，太内卷了."] },
      { word: '摆烂', meaning: 'To give up trying and let things slide on purpose.', contexts: ["Third delay today, 大家都摆烂了."] },
      { word: '躺平', meaning: 'Opting out of the rat race.', contexts: ["I’ll just 躺平 this week."] }
    ];
  }

  initLanes();
  window.addEventListener('resize', debounce(() => {
    initLanes();
    sizeInkCanvas();
  }, 150));

  // 左键：Battlefield → 先 Quiz
  btnNo.addEventListener('click', () => {
    if (mode !== 'idle') return;
    mode = 'quiz';
    openQuiz();
  });

  // 右键：Training Ground
  btnYes.addEventListener('click', () => {
    if (mode !== 'idle') return;
    mode = 'yes';
    if (choiceGroup && choiceGroup.parentNode) choiceGroup.remove();
    subtitle.hidden = false;

    const group = document.createElement('div');
    group.className = 'btn-group';

    // Start / Pause
    spawnBtn = document.createElement('button');
    spawnBtn.id = 'spawnBtn';
    spawnBtn.className = 'btn';
    spawnBtn.type = 'button';
    spawnBtn.setAttribute('aria-pressed', 'false');
    spawnBtn.textContent = 'Start';
    group.appendChild(spawnBtn);

    // Go to Battlefield
    battleBtn = document.createElement('button');
    battleBtn.id = 'btnGotoBattle';
    battleBtn.className = 'btn';
    battleBtn.type = 'button';
    battleBtn.textContent = 'Go to Battlefield';
    group.appendChild(battleBtn);

    startMount.innerHTML = '';
    startMount.appendChild(group);

    spawnBtn.addEventListener('click', () => {
      running = !running;
      spawnBtn.textContent = running ? 'Pause' : 'Start';
      spawnBtn.setAttribute('aria-pressed', String(running));
      if (running) { resumeAll(); startSpawning(); }
      else { stopSpawning(); pauseAll(); }
    });

    battleBtn.addEventListener('click', goToBattlefieldFromYes);
  });

  // 释义卡片关一下，把那条“暂停弹幕”松绑
  closeCard.addEventListener('click', () => {
    card.setAttribute('aria-hidden', 'true');
    if (selectedBullet) {
      selectedBullet.dataset.locked = 'false';
      selectedBullet.classList.remove('is-selected');
      selectedBullet.style.animationPlayState = running ? 'running' : 'paused';
      selectedBullet = null;
    }
  });

  // Quiz 题干：只读中文词（句子里会包 .zh）
  if (quizWordEl) {
    quizWordEl.setAttribute('tabindex', '0');
    quizWordEl.setAttribute('role', 'button');
    quizWordEl.setAttribute('aria-label', 'Play Chinese pronunciation');
    const speakQuizWord = () => {
      const zhEl = quizWordEl.querySelector('.zh');
      const txt = zhEl ? zhEl.textContent.trim() : '';
      if (txt) speakZh(txt);
    };
    quizWordEl.addEventListener('click', speakQuizWord);
    quizWordEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); speakQuizWord(); }
    });
  }
});

/* ============== 训练场 → 战场（进入 Quiz） ============== */
function goToBattlefieldFromYes(){
  if (mode !== 'yes') return;
  running = false;
  stopSpawning();
  pauseAll();

  card.setAttribute('aria-hidden', 'true');
  if (selectedBullet) {
    selectedBullet.dataset.locked = 'false';
    selectedBullet.classList.remove('is-selected');
    selectedBullet = null;
  }

  danmakuBox.innerHTML = '';
  subtitle.hidden = false;
  mode = 'quiz';
  openQuiz();
}

/* ==================== Quiz ==================== */
function openQuiz(){
  danmakuBox.innerHTML = '';
  quiz.setAttribute('aria-hidden','false');
  renderOneQuestion();
}

// 从词条自带 contexts 抽一条，这样“语境←→词义”是绑定的，不会乱
function renderOneQuestion(){
  // 至少要有 3 个词，才能凑两个错误项
  const pool = Array.isArray(WORDS) ? WORDS.filter(w => w && w.word && w.meaning) : [];
  if (pool.length < 3) return;

  // 1) 正确词
  const correctItem = pool[Math.floor(Math.random() * pool.length)];
  const contexts = Array.isArray(correctItem.contexts) ? correctItem.contexts.filter(s => typeof s === 'string' && s.includes(correctItem.word)) : [];
  // 兜底：真没有就自己拼一句把词塞进去
  const sentenceRaw = contexts.length
    ? contexts[Math.floor(Math.random() * contexts.length)]
    : `People keep competing for nothing—完全${correctItem.word}了.`;

  // 2) 包装中文词（只包中文，不要把英文一起包了）
  const sentenceHTML = wrapZhOnce(sentenceRaw, correctItem.word);

  // 3) 两个错误释义
  const wrongPool = pool.filter(w => w.word !== correctItem.word);
  shuffleInPlace(wrongPool);
  const wrongMeanings = wrongPool.slice(0, 2).map(w => w.meaning);

  // 4) 选项随机顺序
  const options = [
    { text: correctItem.meaning, correct: true  },
    { text: wrongMeanings[0],   correct: false },
    { text: wrongMeanings[1],   correct: false }
  ];
  shuffleInPlace(options);

  // 5) 填到 UI
  quizWordEl.innerHTML = sentenceHTML;
  quizOptsEl.innerHTML = '';
  clearQuizHint();

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'quiz-btn';
    btn.type = 'button';
    btn.textContent = opt.text;
    btn.addEventListener('click', () => {
      if (opt.correct) {
        setQuizHint('✔ Correct!', 'success');
        hideTopControls();
        quizHintTimer = setTimeout(() => {
          quiz.setAttribute('aria-hidden','true');
          mode = 'no';
          if (choiceGroup && choiceGroup.parentNode) choiceGroup.remove();
          startNoMode();
        }, HINT_SHOW_MS_CORRECT);
      } else {
        setQuizHint('✖ Try another one…', 'error');
        quizHintTimer = setTimeout(() => renderOneQuestion(), HINT_SHOW_MS_WRONG);
      }
    });
    quizOptsEl.appendChild(btn);
  });
}

// 小助手：只给“第一次出现的中文词”包个 <span class="zh">，避免重复包裹
function wrapZhOnce(sentence, zhWord){
  if (!sentence || !zhWord) return sentence || '';
  // 如果已经包过 .zh，就别重复了
  if (sentence.includes('class="zh"')) return sentence;

  // 用正则找“恰好这几个字”的第一次出现（不对英文做任何事）
  const idx = sentence.indexOf(zhWord);
  if (idx === -1) return sentence;

  return sentence.slice(0, idx) + `<span class="zh">${zhWord}</span>` + sentence.slice(idx + zhWord.length);
}

/* ==================== YES：弹幕生成 ==================== */
function initLanes() {
  const boxH = danmakuBox.clientHeight || 0;
  const count = Math.max(1, Math.floor(boxH / laneHeight));
  lanes = new Array(count).fill(0).map(() => ({ last: null }));

  const bullets = Array.from(danmakuBox.querySelectorAll('.bullet'));
  bullets.forEach(b => {
    const top = parseFloat(b.style.top || '0');
    let idx = Math.round(top / laneHeight);
    idx = Math.max(0, Math.min(count - 1, idx));
    b.style.top = `${idx * laneHeight}px`;
    b.dataset.lane = String(idx);
    lanes[idx].last = lanes[idx].last || b;
  });
}
function startSpawning() {
  if (spawnTimer) return;
  for (let i = 0; i < 4; i++) spawnOne();
  spawnTimer = setInterval(spawnOne, 500);
}
function stopSpawning() { clearInterval(spawnTimer); spawnTimer = null; }
function pauseAll() { document.querySelectorAll('.bullet').forEach(b => b.style.animationPlayState = 'paused'); }
function resumeAll(){ document.querySelectorAll('.bullet').forEach(b => { if (b.dataset.locked !== 'true') b.style.animationPlayState = 'running'; }); }

function pickSafeLane() {
  if (!lanes.length) initLanes();
  const W = danmakuBox.clientWidth;
  for (let i = 0; i < lanes.length; i++) {
    const last = lanes[i].last;
    if (!last) return i;
    const rect = last.getBoundingClientRect();
    const boxRect = danmakuBox.getBoundingClientRect();
    const lastRight = rect.right - boxRect.left;
    if (lastRight < W - minGap) return i;
  }
  return -1;
}

function spawnOne() {
  if (mode !== 'yes' || !running || !WORDS.length) return;
  const laneIndex = pickSafeLane();
  if (laneIndex === -1) return;

  const item = WORDS[Math.floor(Math.random() * WORDS.length)];
  const span = document.createElement('span');
  span.className = 'bullet';
  span.textContent = item.word;

  span.style.top = `${laneIndex * laneHeight}px`;
  span.dataset.lane = String(laneIndex);

  const duration = 12 + Math.random() * 12;
  span.style.animationDuration = `${duration}s`;

  const originalHandler = () => {
    if (selectedBullet && selectedBullet !== span) {
      selectedBullet.dataset.locked = 'false';
      selectedBullet.classList.remove('is-selected');
      selectedBullet.style.animationPlayState = running ? 'running' : 'paused';
    }
    selectedBullet = span;
    span.dataset.locked = 'true';
    span.style.animationPlayState = 'paused';
    span.classList.add('is-selected');

    const wordItem = WORDS.find(w => w.word === item.word) || item;
    wordText.textContent = wordItem.word;
    meanText.textContent = wordItem.meaning || '';
    card.setAttribute('aria-hidden', 'false');
  };

  attachPronounceClick(span, item.word, originalHandler);

  span.addEventListener('animationend', () => {
    if (span.dataset.locked === 'true') return;
    const li = Number(span.dataset.lane || '-1');
    if (li >= 0 && lanes[li] && lanes[li].last === span) lanes[li].last = null;
    span.remove();
  });

  danmakuBox.appendChild(span);
  lanes[laneIndex].last = span;

  if (!running) span.style.animationPlayState = 'paused';
}

/* ==================== NO：对射 + 墨水扩散 + 渐黑 ==================== */
function startNoMode() {
  hideTopControls();
  stopSpawning(); pauseAll();

  ensureInkCanvas();
  startOverlapInkLoop();

  setTimeout(() => {
    noOverlay.hidden = false;
    // 触发过渡
    // eslint-disable-next-line no-unused-expressions
    noOverlay.offsetHeight;
    noOverlay.style.opacity = '1';
  }, 2000);

  const tStart = performance.now();
  const pump = () => {
    const now = performance.now();
    if (now - tStart < NO_SPAWN_DURATION_MS) {
      const current = danmakuBox.querySelectorAll('.bullet.inky').length;
      if (current < NO_MAX_BULLETS) {
        const y = pickNoY();
        spawnNoWord(true,  y + rand(-8, 8));
        spawnNoWord(false, y + rand(-8, 8));

        noFrameTick++;
        if (noFrameTick % 2 === 0) {
          const sideLeft = noToggleLeft; noToggleLeft = !noToggleLeft;
          spawnNoWord(sideLeft, pickNoY());
        }
      }
      requestAnimationFrame(pump);
    }
  };
  requestAnimationFrame(pump);

  setTimeout(() => {
    noMessage.hidden = false;
    // eslint-disable-next-line no-unused-expressions
    noMessage.offsetHeight;
    noMessage.style.opacity = '1';
  }, 5000);
}
function pickNoY() {
  const h = danmakuBox.clientHeight || 0;
  const margin = h * 0.2;
  return Math.max(0, Math.min(h - 10, margin + Math.random() * (h - margin * 2)));
}
function spawnNoWord(fromLeft, y) {
  if (!WORDS.length) return;
  const current = danmakuBox.querySelectorAll('.bullet.inky').length;
  if (current >= NO_MAX_BULLETS) return;

  const item = WORDS[Math.floor(Math.random() * WORDS.length)];
  const span = document.createElement('span');
  span.className = 'bullet inky';
  span.textContent = item.word;

  const boxH = danmakuBox.clientHeight || 0;
  const yy = Math.max(0, Math.min(boxH - 10, Math.floor((y ?? pickNoY()))));
  span.style.top = `${yy}px`;

  span.classList.add(fromLeft ? 'from-left' : 'from-right');

  const duration = NO_DURATION_MIN + Math.random() * (NO_DURATION_MAX - NO_DURATION_MIN);
  span.style.animationDuration = `${duration}s`;

  attachPronounceClick(span, item.word, null);

  span.addEventListener('animationend', () => span.remove());
  danmakuBox.appendChild(span);
}

/* ==================== 墨水扩散：采样 + 网格能量 ==================== */
function ensureInkCanvas() {
  if (inkCanvas && inkCanvas.parentNode) return;
  inkCanvas = document.createElement('canvas');
  inkCanvas.style.position = 'absolute';
  inkCanvas.style.inset = '0';
  inkCanvas.style.pointerEvents = 'none';
  inkCanvas.style.zIndex = '2';
  inkCanvas.className = 'ink-canvas';
  danmakuBox.style.position = 'relative';
  danmakuBox.appendChild(inkCanvas);
  inkCtx = inkCanvas.getContext('2d');
  sizeInkCanvas();
}
function sizeInkCanvas() {
  if (!inkCanvas) return;
  const rect = danmakuBox.getBoundingClientRect();
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  inkCanvas.width  = Math.max(1, Math.floor(rect.width  * dpr));
  inkCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
  inkCanvas.style.width  = rect.width + 'px';
  inkCanvas.style.height = rect.height + 'px';
  inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function startOverlapInkLoop() {
  cancelAnimationFrame(inkAnimId);
  overlapCells.clear();

  const Y_NEAR = 18;
  const X_NEAR = 90;

  const loop = () => {
    if (!inkCtx) return;
    inkCtx.globalCompositeOperation = 'source-over';
    inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);

    const lefts  = Array.from(danmakuBox.querySelectorAll('.bullet.inky.from-left'));
    const rights = Array.from(danmakuBox.querySelectorAll('.bullet.inky.from-right'));
    const boxRect = danmakuBox.getBoundingClientRect();

    if (lefts.length && rights.length) {
      const stepL = Math.ceil(lefts.length  / 28) || 1;
      const stepR = Math.ceil(rights.length / 28) || 1;

      for (let i = 0; i < lefts.length; i += stepL) {
        const L = lefts[i].getBoundingClientRect();
        const Lx = L.left - boxRect.left + L.width/2;
        const Ly = L.top  - boxRect.top  + L.height/2;

        for (let j = 0; j < rights.length; j += stepR) {
          const R = rights[j].getBoundingClientRect();
          const Rx = R.left - boxRect.left + R.width/2;
          const Ry = R.top  - boxRect.top  + R.height/2;

          if (Math.abs(Ly - Ry) < Y_NEAR && Math.abs(Lx - Rx) < X_NEAR) {
            const cx = (Lx + Rx) / 2;
            const cy = (Ly + Ry) / 2;
            const fs = (parseFloat(getComputedStyle(lefts[i]).fontSize) + parseFloat(getComputedStyle(rights[j]).fontSize)) / 2 || 24;
            const baseR = fs * 0.24;

            const gx = Math.floor(cx / CELL_SIZE);
            const gy = Math.floor(cy / CELL_SIZE);
            const key = `${gx},${gy}`;

            const now = performance.now();
            const cell = overlapCells.get(key) || { energy: 0, x: cx, y: cy, baseR, lastSeen: now };
            cell.energy = Math.min(MAX_ENERGY, cell.energy + GROW_PER_FRAME);
            cell.x = cell.x * 0.7 + cx * 0.3;
            cell.y = cell.y * 0.7 + cy * 0.3;
            cell.baseR = cell.baseR * 0.7 + baseR * 0.3;
            cell.lastSeen = now;
            overlapCells.set(key, cell);
          }
        }
      }
    }

    inkCtx.save();
    inkCtx.filter = 'blur(1.2px)';
    inkCtx.globalCompositeOperation = 'multiply';

    const now = performance.now();
    let drawn = 0;
    for (const [key, cell] of overlapCells) {
      if (now - cell.lastSeen > 40) cell.energy = Math.max(0, cell.energy - DECAY_PER_FRAME);
      if (cell.energy <= 0) { overlapCells.delete(key); continue; }
      if (drawn >= CELLS_DRAW_LIMIT) break;

      const radius = cell.baseR * (1 + cell.energy * GROW_MULTIPLIER);
      const alpha1 = 0.05 + cell.energy * 0.12;
      const alpha2 = 0.03 + cell.energy * 0.08;

      inkCtx.beginPath();
      inkCtx.fillStyle = `rgba(0,0,0,${alpha1})`;
      inkCtx.arc(cell.x, cell.y, radius, 0, Math.PI * 2);
      inkCtx.fill();

      inkCtx.beginPath();
      inkCtx.fillStyle = `rgba(0,0,0,${alpha2})`;
      inkCtx.arc(cell.x, cell.y, radius * 1.22, 0, Math.PI * 2);
      inkCtx.fill();

      drawn++;
    }

    inkCtx.restore();
    inkAnimId = requestAnimationFrame(loop);
  };

  inkAnimId = requestAnimationFrame(loop);
}
