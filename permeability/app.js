/* ==================== 全局元素与状态 ==================== */
// DOM 引用
const danmakuBox = document.getElementById('danmaku'); // 弹幕容器
const spawnBtn   = document.getElementById('spawnBtn'); // 开始/暂停（切换）按钮
const card       = document.getElementById('meaningCard'); // 词义卡片容器
const closeCard  = document.getElementById('closeCard');   // 关闭卡片按钮
const wordText   = document.getElementById('wordText');    // 卡片：词
const meanText   = document.getElementById('meanText');    // 卡片：义

// 数据与运行态
let WORDS = [];                 // data.json 载入的词库
let running = false;            // 是否处于“播放中”
let spawnTimer = null;          // 生成定时器
let selectedBullet = null;      // 当前被点击并暂停的词条（仅允许一个）

/* ==================== 轨道（防重叠/防追尾） ==================== */
// 原理：将弹幕分配到多条“轨道”，避免纵向重叠；同轨采用“前车/后车”安全距离，防止追尾
let lanes = [];                 // 轨道数组：每项 { last: HTMLElement|null }，记录该轨道最近一条弹幕
let laneHeight = 42;            // 轨道高度（≈行高），可按视觉微调
let minGap = 24;                // 同轨“前车-后车”最小水平安全距离（像素）

/* ==================== 启动：载入数据并初始化轨道 ==================== */
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // 同源读取本地 data.json（部署时需与页面同域名目录）
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('Failed to load data.json');
    WORDS = await res.json();
  } catch (err) {
    // 兜底：读取失败时提供示例数据，确保页面可演示
    console.warn('读取 data.json 失败，使用内置示例数据。', err);
    WORDS = [
      { word: '内卷', meaning: 'Involution; people compete excessively without real progress.' },
      { word: '摆烂', meaning: 'Give up trying; do the bare minimum on purpose.' },
      { word: 'YYDS', meaning: 'GOAT; the Greatest of All Time.' }
    ];
  }

  // 初始化轨道；响应窗口尺寸变化进行重算
  initLanes();
  window.addEventListener('resize', debounce(initLanes, 150));
});

/* ==================== 轨道初始化/更新 ==================== */
function initLanes() {
  const boxH = danmakuBox.clientHeight;
  const count = Math.max(1, Math.floor(boxH / laneHeight)); // 动态计算轨道数
  lanes = new Array(count).fill(0).map(() => ({ last: null }));

  // 将现有弹幕吸附到最近轨道，避免纵向重叠
  const bullets = Array.from(danmakuBox.querySelectorAll('.bullet'));
  bullets.forEach(b => {
    const top = parseFloat(b.style.top || '0');
    let idx = Math.round(top / laneHeight);
    idx = Math.max(0, Math.min(count - 1, idx));
    b.style.top = `${idx * laneHeight}px`;
    b.dataset.lane = String(idx);
    lanes[idx].last = lanes[idx].last || b; // 若该轨道还未记录“前车”，则记录之
  });
}

/* ==================== 播放控制（单按钮：开始/暂停） ==================== */
spawnBtn.addEventListener('click', () => {
  running = !running;                                   // 切换播放状态
  spawnBtn.textContent = running ? 'Pause' : 'Start';   // 按钮文案：Pause/Start
  spawnBtn.setAttribute('aria-pressed', String(running));

  if (running) {
    resumeAll();     // 恢复所有未“锁定”的弹幕
    startSpawning(); // 开始/继续生成
  } else {
    stopSpawning();  // 停止生成
    pauseAll();      // 全部原地暂停
  }
});

/* ==================== 卡片关闭：若在播放中，恢复被选词 ==================== */
closeCard.addEventListener('click', () => {
  card.setAttribute('aria-hidden', 'true'); // 关闭卡片（CSS 控制可见/不可见）
  if (selectedBullet) {
    selectedBullet.dataset.locked = 'false';                // 取消“局部锁定”
    selectedBullet.classList.remove('is-selected');         // 移除高光描边
    selectedBullet.style.animationPlayState = running ? 'running' : 'paused'; // 全局播放中才恢复动画
    selectedBullet = null;                                  // 清空当前选中
  }
});

/* ==================== 生成调度 ==================== */
// 开始循环生成弹幕
function startSpawning() {
  if (spawnTimer) return;
  for (let i = 0; i < 4; i++) spawnOne();  // 首次连发几条
  spawnTimer = setInterval(spawnOne, 500); // 固定节奏尝试投放
}
// 停止生成
function stopSpawning() {
  clearInterval(spawnTimer);
  spawnTimer = null;
}

/* ==================== 全局暂停/恢复 ==================== */
// 暂停：所有弹幕原地停
function pauseAll() {
  document.querySelectorAll('.bullet').forEach(b => {
    b.style.animationPlayState = 'paused';
  });
}
// 恢复：只恢复未“锁定”的弹幕（被点击选中的仍暂停）
function resumeAll() {
  document.querySelectorAll('.bullet').forEach(b => {
    if (b.dataset.locked !== 'true') {
      b.style.animationPlayState = 'running';
    }
  });
}

/* ==================== 轨道选择（防追尾核心） ==================== */
// 选择一个“安全”的轨道：要求同轨前车已经与右侧拉开 minGap 的空间
function pickSafeLane() {
  if (!lanes.length) initLanes();
  const W = danmakuBox.clientWidth;

  for (let i = 0; i < lanes.length; i++) {
    const last = lanes[i].last;
    if (!last) return i; // 没有前车，安全

    // 有前车：计算其相对容器的 right 实时位置
    const rect = last.getBoundingClientRect();
    const boxRect = danmakuBox.getBoundingClientRect();
    const lastRight = rect.right - boxRect.left;

    // 安全条件：前车 right 足够靠左（为后车预留 minGap）
    if (lastRight < W - minGap) return i;
  }
  // 没有可用轨道：本次跳过（避免硬塞造成重叠/追尾）
  return -1;
}

/* ==================== 生成一条弹幕 ==================== */
function spawnOne() {
  if (!running) return;            // 全局暂停时不生成
  if (WORDS.length === 0) return;  // 无数据时不生成

  // 选择安全轨道；若当前没有可用轨道则跳过本次
  const laneIndex = pickSafeLane();
  if (laneIndex === -1) return;

  // 随机取一条词
  const item = WORDS[Math.floor(Math.random() * WORDS.length)];

  // 创建 DOM 元素
  const span = document.createElement('span');
  span.className = 'bullet';
  span.textContent = item.word;

  // 固定到轨道（避免纵向重叠）
  span.style.top = `${laneIndex * laneHeight}px`;
  span.dataset.lane = String(laneIndex);

  // 设置动画时长（越大越慢）
  const duration = 12 + Math.random() * 12; // 12s ~ 24s
  span.style.animationDuration = `${duration}s`;

  // 点击弹幕：高光 + 单条暂停 + 弹出释义卡片
  span.addEventListener('click', () => {
    // 若已有被选中且不是当前这条，先解除上一条
    if (selectedBullet && selectedBullet !== span) {
      selectedBullet.dataset.locked = 'false';
      selectedBullet.classList.remove('is-selected');
      selectedBullet.style.animationPlayState = running ? 'running' : 'paused';
    }

    // 锁定当前
    selectedBullet = span;
    span.dataset.locked = 'true';
    span.style.animationPlayState = 'paused';
    span.classList.add('is-selected');

    // 填充卡片并显示
    wordText.textContent = item.word;
    meanText.textContent = item.meaning;
    card.setAttribute('aria-hidden', 'false');
  });

  // 动画结束自动清理（若未“锁定”）
  span.addEventListener('animationend', () => {
    if (span.dataset.locked === 'true') return; // 被锁定的不要移除
    const li = Number(span.dataset.lane || '-1');
    if (li >= 0 && lanes[li] && lanes[li].last === span) {
      lanes[li].last = null; // 若移除的正好是“前车”，清空轨道引用
    }
    span.remove();
  });

  // 插入页面并启动动画
  danmakuBox.appendChild(span);
  lanes[laneIndex].last = span; // 更新该轨道的“前车”为当前

  // 若此刻全局是暂停态，新加入的也应立即停住，保证一致
  if (!running) {
    span.style.animationPlayState = 'paused';
  }
}

/* ==================== 小工具：防抖 ==================== */
// 用于 resize 等高频事件，避免频繁触发回调
function debounce(fn, wait) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* ==================== 标题点击特效：烟雾消散 + 全屏小范围墨渗 ==================== */
(() => {
  const wordEl = document.getElementById('permeabilityWord'); // 可点击单词（permeability）
  const fxCanvas = document.getElementById('screenFX');       // 全屏画布（位于弹幕上方、卡片下方）
  if (!wordEl || !fxCanvas) return;

  const ctx = fxCanvas.getContext('2d');
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);

  // 按设备像素比设置画布尺寸，避免模糊
  function sizeCanvas() {
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const w = window.innerWidth;
    const h = window.innerHeight;
    fxCanvas.width  = Math.floor(w * dpr);
    fxCanvas.height = Math.floor(h * dpr);
    fxCanvas.style.width  = w + 'px';
    fxCanvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // 计算单词在视口中心位置（作为烟雾起点/核心墨渗中心）
  function getWordAnchor() {
    const r = wordEl.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }

  // 状态池
  let smokes = [];  // 烟雾粒子：{x,y,vx,vy,life,max,size}
  let blots  = [];  // 微墨滴：{x,y,r,growth,alpha,life,maxLife}
  let animId = null;
  let phase  = 0;   // 0=静止；1=烟雾+少量墨渗；2=只墨渗（收尾）

  // 生成烟雾：自单词上方冒出，缓慢上升并淡出
  function spawnSmoke() {
    const a = getWordAnchor();
    const baseX = a.x, baseY = a.y - a.h * 0.45;
    const count = Math.round(36 + a.w * 0.10); // 数量与标题宽度关联
    for (let i = 0; i < count; i++) {
      smokes.push({
        x: baseX + rand(-a.w * 0.42, a.w * 0.42),
        y: baseY + rand(-6, 6),
        vx: rand(-0.25, 0.25),
        vy: rand(-1.1, -0.45),
        size: rand(5, 12),
        life: 0,
        max: rand(0.8, 1.4)
      });
    }
  }

  // 生成微墨滴：核心簇 + 全屏稀疏，小半径/低透明度/缓慢扩散，避免明显边界
  function spawnInk(coreCenter = true) {
    const a = getWordAnchor();
    const w = window.innerWidth, h = window.innerHeight;

    // 核心簇：以单词下方为中心，小范围聚集
    if (coreCenter) {
      const cx = a.x, cy = a.y + a.h * 0.55;
      const clusters = Math.max(2, Math.round(a.w / 160));
      for (let c = 0; c < clusters; c++) {
        const ox = rand(-a.w * 0.3, a.w * 0.3);
        const oy = rand(-8, 8);
        const drops = 6 + Math.floor(Math.random() * 6);
        for (let i = 0; i < drops; i++) {
          blots.push({
            x: cx + ox + rand(-8, 8),
            y: cy + oy + rand(-6, 6),
            r: rand(0.8, 2.2),
            growth: rand(6, 16) / 1000,
            alpha: rand(0.020, 0.050),
            life: 0,
            maxLife: rand(1.6, 2.2)
          });
        }
      }
    }

    // 全屏稀疏：随机少量微滴，增加整体“渗透”感但无明显圆形边界
    const scatter = 24;
    for (let i = 0; i < scatter; i++) {
      blots.push({
        x: rand(0, w),
        y: rand(0, h),
        r: rand(0.6, 1.8),
        growth: rand(4, 12) / 1000,
        alpha: rand(0.010, 0.030),
        life: 0,
        maxLife: rand(1.2, 2.0)
      });
    }
  }

  // 绘制烟雾（加亮混合，产生淡淡的发光感）
  function drawSmoke(dt) {
    ctx.globalCompositeOperation = 'lighter';
    smokes = smokes.filter(p => {
      p.life += dt;
      p.x += p.vx * (dt * 60);
      p.y += p.vy * (dt * 60);
      const t = p.life / p.max;                // 进度 0~1
      const fade = Math.max(0, 1 - t);         // 越到后面越透明
      ctx.beginPath();
      ctx.fillStyle = `rgba(120,120,120,${0.16 * fade})`;
      ctx.arc(p.x, p.y, p.size * (1 + t * 0.6), 0, TAU);
      ctx.fill();
      return t < 1;
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  // 绘制墨渗（乘法叠加，模拟宣纸上墨迹加深与扩散）
  function drawInk(dt) {
    ctx.globalCompositeOperation = 'multiply';

    // 先铺一层极低透明度的全屏“雾”，弱化微滴边缘
    ctx.fillStyle = 'rgba(0,0,0,0.006)';
    ctx.fillRect(0, 0, fxCanvas.width, fxCanvas.height);

    // 绘制并更新每个微墨滴
    blots = blots.filter(b => {
      b.life += dt;
      b.r += b.growth * 16;                    // 近似 60fps：每帧增长 ~growth*16 像素
      const jx = rand(-0.25, 0.25);            // 轻微抖动，打破规则圆边
      const jy = rand(-0.25, 0.25);
      const remain = 1 - Math.min(1, b.life / b.maxLife); // 逐步淡出
      ctx.beginPath();
      ctx.fillStyle = `rgba(0,0,0,${b.alpha * remain})`;
      ctx.arc(b.x + jx, b.y + jy, b.r, 0, TAU);
      ctx.fill();
      return b.life < b.maxLife;
    });

    ctx.globalCompositeOperation = 'source-over';
  }

  // 主动画循环
  let lastTs = 0, smokeElapsed = 0, inkElapsed = 0;
  function loop(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000); // 秒，限制最大步长防跳帧
    lastTs = ts;

    ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

    if (phase === 1) {
      smokeElapsed += dt;
      drawSmoke(dt);
      drawInk(dt);
      if (Math.random() < 0.25) spawnInk(false);    // 中途追加少量全屏微滴
      if (smokeElapsed > 1.1 && smokes.length === 0) phase = 2;
    } else if (phase === 2) {
      inkElapsed += dt;
      drawInk(dt);
      if (inkElapsed < 0.8 && Math.random() < 0.35) spawnInk(false);
      if (inkElapsed > 1.8) { stop(); return; }     // 渐进收尾
    }

    animId = requestAnimationFrame(loop);
  }

  // 开始特效
  function start() {
    cancelAnimationFrame(animId);
    sizeCanvas();
    smokes.length = 0; blots.length = 0;
    lastTs = 0; smokeElapsed = 0; inkElapsed = 0;

    wordEl.classList.add('fx-armed'); // 文字描边反馈

    spawnSmoke();     // 先烟雾
    spawnInk(true);   // 核心小范围墨渗
    spawnInk(false);  // 全屏少量微滴
    phase = 1;
    animId = requestAnimationFrame(loop);
  }

  // 停止并淡出残留墨迹（避免瞬间消失突兀）
  function stop() {
    cancelAnimationFrame(animId);
    animId = null; phase = 0;

    // 复制一层做 CSS 淡出动画
    const keep = fxCanvas.cloneNode(true);
    keep.getContext('2d').drawImage(fxCanvas, 0, 0);
    fxCanvas.replaceWith(keep);
    keep.className = fxCanvas.className;
    keep.style.transition = 'opacity .9s ease';
    keep.style.opacity = '1';
    requestAnimationFrame(() => keep.style.opacity = '0');

    setTimeout(() => {
      if (keep.parentNode) keep.parentNode.replaceChild(fxCanvas, keep);
      wordEl.classList.remove('fx-armed');
      const ctx2 = fxCanvas.getContext('2d');
      ctx2.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    }, 1000);
  }

  // 自适应：动画进行中才需要重设画布尺寸
  window.addEventListener('resize', debounce(() => {
    if (animId) sizeCanvas();
  }, 120));

  // 点击“permeability”触发特效
  wordEl.addEventListener('click', start);
})();