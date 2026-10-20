// 게임 데이터 시뮬레이션. 실행: node scripts/simulate.mjs
// 결과는 scripts/data/sim-results.json 에 저장하고, build-content.mjs 가 이 파일의 수치를 그대로 분석 글에 넣는다.
//
// 게임 규칙은 public/index.html 의 실제 코드와 같다.
//   makeBoard: 칸마다 Math.floor(Math.random()*9)+1  → 여기서는 같은 식에 시드 고정 난수(mulberry32)를 넣어 재현 가능하게 한다.
//   판 크기: 화면 폭 600px 이하 12줄×14칸, 그 밖 10줄×17칸 · 제한 120초
//   선택: 네모 안에 가운데가 들어온 귤(빈칸 제외)의 합이 정확히 10이면 제거
//   점수: floor(제거한 개수 × 배율), 콤보 1 ×1 · 2~4 ×1.5 · 5~9 ×2 · 10~19 ×3 · 20+ ×5
//   콤보: 마지막 제거 후 2초가 지나면 0 으로 초기화
//
// 세 가지를 계산한다.
//   (a) board  — 새 판 10만 개의 통계(판당 바로 터뜨릴 수 있는 묶음 수, 숫자별 짝 수, 9 가 고립될 확률 등)
//   (b) bots   — 자동 플레이 봇 전략별 120초 점수(실제 배율·2초 콤보 규칙 그대로)
//   (c) combos — 합이 10인 2~5개 숫자 조합 목록과 새 판에서의 출현 빈도
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'data');
const BOARDS = 100000;   // (a)(c) 새 판 개수
const GAMES = 5000;      // (b) 전략·시간 모델·판 크기 조합마다 돌리는 판 수
const SEED = 20261020;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// public/index.html 의 makeBoard 와 같은 식. Math.random 대신 시드 고정 난수를 쓴다.
function makeBoard(R, C, rand) { const b = new Int8Array(R * C); for (let i = 0; i < R * C; i++) b[i] = Math.floor(rand() * 9) + 1; return b; }

// 합이 10인 네모를 모두 찾는다. 빈칸(0)은 선택에서 빠진다.
// 같은 귤 묶음을 고르는 네모가 여러 개면(빈 줄로 넓힌 네모) 귤에 딱 맞는 네모 하나만 센다.
function findMoves(b, R, C) {
  const W = C + 1, S = new Int32Array((R + 1) * W), N = new Int32Array((R + 1) * W);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const v = b[r * C + c];
    S[(r + 1) * W + c + 1] = v + S[r * W + c + 1] + S[(r + 1) * W + c] - S[r * W + c];
    N[(r + 1) * W + c + 1] = (v > 0 ? 1 : 0) + N[r * W + c + 1] + N[(r + 1) * W + c] - N[r * W + c];
  }
  const sum = (A, r1, c1, r2, c2) => A[(r2 + 1) * W + c2 + 1] - A[r1 * W + c2 + 1] - A[(r2 + 1) * W + c1] + A[r1 * W + c1];
  const moves = [];
  for (let r1 = 0; r1 < R; r1++) for (let c1 = 0; c1 < C; c1++) {
    for (let r2 = r1; r2 < R; r2++) {
      if (sum(S, r1, c1, r2, c1) > 10) break;
      for (let c2 = c1; c2 < C; c2++) {
        const s = sum(S, r1, c1, r2, c2);
        if (s > 10) break;
        if (s !== 10) continue;
        // 네 변 모두에 귤이 있어야 딱 맞는 네모
        if (sum(N, r1, c1, r1, c2) === 0 || sum(N, r2, c1, r2, c2) === 0 || sum(N, r1, c1, r2, c1) === 0 || sum(N, r1, c2, r2, c2) === 0) continue;
        moves.push({ r1, c1, r2, c2, k: sum(N, r1, c1, r2, c2) });
      }
    }
  }
  return moves;
}
const cellsOf = (b, C, m) => { const out = []; for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) if (b[r * C + c] > 0) out.push(r * C + c); return out; };
const mult = (combo) => (combo >= 20 ? 5 : combo >= 10 ? 3 : combo >= 5 ? 2 : combo >= 2 ? 1.5 : 1);

const stats = (arr) => {
  const a = Float64Array.from(arr).sort(), n = a.length, mean = a.reduce((x, y) => x + y, 0) / n;
  const sd = Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / n), q = (p) => a[Math.min(n - 1, Math.floor(p * n))];
  return { mean: +mean.toFixed(2), sd: +sd.toFixed(2), min: a[0], p10: q(0.1), median: q(0.5), p90: q(0.9), max: a[n - 1] };
};
const pct = (x) => +(x * 100).toFixed(2);

// ---------- (a)(c) 새 판 통계 ----------
function boardStats(R, C, seed) {
  const rand = mulberry32(seed);
  const movesPer = [], pairsPer = [], bySize = new Float64Array(11), excess9 = [], deadPer = [];
  const digitCount = new Float64Array(10), partnerSum = new Float64Array(10), lonely = new Float64Array(10);
  const combo = new Map(), shape = new Map();
  let boardsWith9Excess = 0, boardsZeroPairs = 0;
  for (let g = 0; g < BOARDS; g++) {
    const b = makeBoard(R, C, rand), moves = findMoves(b, R, C);
    const inMove = new Uint8Array(R * C);
    let pairs = 0;
    for (const m of moves) {
      bySize[m.k]++; if (m.k === 2) pairs++;
      const cs = cellsOf(b, C, m);
      for (const i of cs) inMove[i] = 1;
      const key = cs.map((i) => b[i]).sort((x, y) => x - y).join('+');
      combo.set(key, (combo.get(key) || 0) + 1);
      const sk = `${m.r2 - m.r1 + 1}x${m.c2 - m.c1 + 1}`;
      shape.set(sk, (shape.get(sk) || 0) + 1);
    }
    movesPer.push(moves.length); pairsPer.push(pairs); if (pairs === 0) boardsZeroPairs++;
    const n = new Int32Array(10);
    let dead = 0;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const i = r * C + c, d = b[i], want = 10 - d;
      n[d]++; digitCount[d]++;
      let p = 0;
      if (r > 0 && b[i - C] === want) p++;
      if (r < R - 1 && b[i + C] === want) p++;
      if (c > 0 && b[i - 1] === want) p++;
      if (c < C - 1 && b[i + 1] === want) p++;
      partnerSum[d] += p;
      if (!inMove[i]) { lonely[d]++; dead++; }
    }
    deadPer.push(dead);
    const ex = Math.max(0, n[9] - n[1]); excess9.push(ex); if (ex > 0) boardsWith9Excess++;
  }
  const hist = {}; for (const p of pairsPer) hist[p] = (hist[p] || 0) + 1;
  const digits = [];
  for (let d = 1; d <= 9; d++) digits.push({ d, perBoard: +(digitCount[d] / BOARDS).toFixed(2), partnersPerTile: +(partnerSum[d] / digitCount[d]).toFixed(3), noMoveAtStartPct: pct(lonely[d] / digitCount[d]) });
  const top = (m, k) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([key, v]) => ({ key, perBoard: +(v / BOARDS).toFixed(3) }));
  return {
    R, C, tiles: R * C, boards: BOARDS,
    moves: stats(movesPer), pairs: stats(pairsPer), pairsHist: hist, zeroPairBoards: boardsZeroPairs,
    bySize: Array.from(bySize).map((v, k) => ({ k, perBoard: +(v / BOARDS).toFixed(3) })).filter((x) => x.k >= 2 && x.perBoard > 0),
    deadTiles: stats(deadPer), digits,
    nineExcess: { ...stats(excess9), boardsPct: pct(boardsWith9Excess / BOARDS) },
    combosOnBoard: Object.fromEntries([...combo.entries()].map(([k, v]) => [k, +(v / BOARDS).toFixed(4)])),
    topCombos: top(combo, 12), shapes: top(shape, 10),
  };
}

// ---------- (b) 봇 ----------
const STRATS = {
  pairs: { label: 'pairs-first', pick: (ms) => ms.reduce((a, m) => (m.k < a.k ? m : a)) },
  big: { label: 'biggest-box-first', pick: (ms) => ms.reduce((a, m) => (m.k > a.k ? m : a)) },
  random: { label: 'random-legal-move', pick: (ms, rand) => ms[Math.floor(rand() * ms.length)] },
  high: { label: 'highest-number-first', pick: (ms, rand, b, C) => { let best = null, bv = -1; for (const m of ms) { const v = Math.max(...cellsOf(b, C, m).map((i) => b[i])) * 100 - m.k; if (v > bv) { bv = v; best = m; } } return best; } },
};
// 한 번 터뜨리는 데 걸리는 시간(초). 사람의 탐색 시간은 측정값이 아니라 가정이라 두 가지로 나눠 본다.
// fast: 콤보가 절대 끊기지 않는 빠른 손 / size: 큰 네모일수록 오래 걸림(짝 1.9초, 셋부터 2초 초과) / slow: 매번 3초라 콤보가 늘 끊김
const TIME = {
  fast: { label: 'every move 1.5 s', t: () => 1.5 },
  size: { label: '0.9 s + 0.5 s per tangerine', t: (k) => 0.9 + 0.5 * k },
  slow: { label: 'every move 3 s', t: () => 3 },
};
function playBot(R, C, strat, time, rand) {
  const b = makeBoard(R, C, rand);
  let t = 0, combo = 0, score = 0, cleared = 0, moves = 0, maxCombo = 0, stuck = false, breaks = 0;
  const sizes = new Float64Array(11);
  for (;;) {
    const ms = findMoves(b, R, C);
    if (!ms.length) { stuck = true; break; }
    const m = STRATS[strat].pick(ms, rand, b, C), dt = TIME[time].t(m.k);
    if (t + dt > 120) break;
    t += dt;
    if (moves > 0 && dt > 2) { combo = 0; breaks++; } // 2초 넘게 못 터뜨리면 콤보 0
    combo++; maxCombo = Math.max(maxCombo, combo);
    const cs = cellsOf(b, C, m);
    score += Math.floor(cs.length * mult(combo));
    cleared += cs.length; moves++; sizes[cs.length]++;
    for (const i of cs) b[i] = 0;
  }
  return { score, cleared, moves, maxCombo, stuck, stuckAt: stuck ? t : null, breaks, sizes };
}
function botStats(R, C, seed) {
  const out = [];
  for (const time of Object.keys(TIME)) for (const strat of Object.keys(STRATS)) {
    const rand = mulberry32(seed), rs = [];
    for (let g = 0; g < GAMES; g++) rs.push(playBot(R, C, strat, time, rand));
    const sizes = new Float64Array(11); rs.forEach((r) => r.sizes.forEach((v, i) => (sizes[i] += v)));
    const totalMoves = rs.reduce((a, r) => a + r.moves, 0), stuck = rs.filter((r) => r.stuck);
    out.push({
      strat, stratLabel: STRATS[strat].label, time, timeLabel: TIME[time].label, games: GAMES,
      score: stats(rs.map((r) => r.score)), cleared: stats(rs.map((r) => r.cleared)), moves: stats(rs.map((r) => r.moves)),
      maxCombo: stats(rs.map((r) => r.maxCombo)), comboBreaks: stats(rs.map((r) => r.breaks)),
      stuckPct: pct(stuck.length / GAMES), stuckAtMean: stuck.length ? +(stuck.reduce((a, r) => a + r.stuckAt, 0) / stuck.length).toFixed(1) : null,
      sizeSharePct: Object.fromEntries([...sizes].map((v, k) => [k, pct(v / totalMoves)]).filter(([, v]) => v > 0)),
    });
  }
  return out;
}

// ---------- (c) 합이 10인 조합 ----------
function combosList() {
  const res = [];
  const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
  const rec = (k, start, left, acc) => {
    if (k === 0) { if (left === 0) res.push(acc.slice()); return; }
    for (let d = start; d <= 9 && d <= left; d++) { acc.push(d); rec(k - 1, d, left - d, acc); acc.pop(); }
  };
  for (let k = 2; k <= 10; k++) rec(k, 1, 10, []);
  return res.map((ds) => {
    const k = ds.length, cnt = {}; ds.forEach((d) => (cnt[d] = (cnt[d] || 0) + 1));
    const orders = fact(k) / Object.values(cnt).reduce((a, c) => a * fact(c), 1);
    return { key: ds.join('+'), k, orders, probPct: +((orders / 9 ** k) * 100).toFixed(4) };
  });
}

const t0 = Date.now();
mkdirSync(OUT, { recursive: true });
const result = {
  generatedBy: 'scripts/simulate.mjs', seed: SEED, boardsPerSize: BOARDS, gamesPerSetting: GAMES,
  board: { desktop: boardStats(10, 17, SEED), mobile: boardStats(12, 14, SEED + 1) },
  combos: combosList(),
};
result.bots = { desktop: botStats(10, 17, SEED + 2), mobile: botStats(12, 14, SEED + 3) };
writeFileSync(join(OUT, 'sim-results.json'), JSON.stringify(result, null, 1));

// 사람이 읽는 요약(글에 넣는 수치는 위 JSON 에서 그대로 가져간다)
const B = result.board;
for (const [name, s] of Object.entries(B)) {
  console.log(`\n[board ${name} ${s.R}x${s.C}, ${s.boards.toLocaleString()} boards]`);
  console.log(` valid moves per new board: mean ${s.moves.mean} sd ${s.moves.sd} min ${s.moves.min} p10 ${s.moves.p10} median ${s.moves.median} p90 ${s.moves.p90} max ${s.moves.max}`);
  console.log(` adjacent pairs per board: mean ${s.pairs.mean} sd ${s.pairs.sd} min ${s.pairs.min} max ${s.pairs.max}; boards with zero pairs ${s.zeroPairBoards}`);
  console.log(` by size: ${s.bySize.map((x) => `${x.k}:${x.perBoard}`).join(' ')}`);
  console.log(` tiles with no valid move at start: mean ${s.deadTiles.mean} of ${s.tiles}`);
  console.log(` digits: ${s.digits.map((d) => `${d.d}[n${d.perBoard} partners${d.partnersPerTile} none${d.noMoveAtStartPct}%]`).join(' ')}`);
  console.log(` nines without a 1 to spare: boards ${s.nineExcess.boardsPct}% mean ${s.nineExcess.mean} max ${s.nineExcess.max}`);
  console.log(` top combos: ${s.topCombos.map((c) => `${c.key}:${c.perBoard}`).join(' ')}`);
  console.log(` shapes: ${s.shapes.map((c) => `${c.key}:${c.perBoard}`).join(' ')}`);
}
for (const [name, rows] of Object.entries(result.bots)) {
  console.log(`\n[bots ${name}, ${GAMES} games each]`);
  for (const r of rows) console.log(` ${r.timeLabel.padEnd(30)} ${r.stratLabel.padEnd(22)} score mean ${r.score.mean} (p10 ${r.score.p10}, p90 ${r.score.p90}) cleared ${r.cleared.mean} moves ${r.moves.mean} maxCombo ${r.maxCombo.mean} breaks ${r.comboBreaks.mean} stuck ${r.stuckPct}% at ${r.stuckAtMean}s sizes ${JSON.stringify(r.sizeSharePct)}`);
}
console.log(`\n[combos] ${[2, 3, 4, 5].map((k) => `${k}: ${result.combos.filter((c) => c.k === k).length}`).join(', ')} (6+: ${result.combos.filter((c) => c.k >= 6).length})`);
console.log(`\n✔ scripts/data/sim-results.json (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
