// 분석 글 3편(영어·한국어). 모든 수치는 scripts/data/sim-results.json(= node scripts/simulate.mjs 출력)에서 그대로 가져온다.
// 숫자를 손으로 적지 않는다 — 시뮬레이션을 다시 돌리면 글의 수치도 같이 바뀐다.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const D = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'data', 'sim-results.json'), 'utf8'));
export const SIM = D;
const bd = D.board.desktop, bm = D.board.mobile;
const n = (x) => Number(x).toLocaleString('en-US');
const bot = (size, strat, time) => D.bots[size].find((r) => r.strat === strat && r.time === time);
const sizeRow = (s, k) => (s.bySize.find((x) => x.k === k) || { perBoard: 0 }).perBoard;
const digit = (s, d) => s.digits.find((x) => x.d === d);
const comboK = (k) => D.combos.filter((c) => c.k === k);
const probK = (k) => comboK(k).reduce((a, c) => a + c.probPct, 0);
const totalMoves = (s) => s.bySize.reduce((a, x) => a + x.perBoard, 0);
// 새 PC 판의 모든 묶음 중 '짧은 목록'이 차지하는 누적 비율
const PAIRS = ['1+9', '2+8', '3+7', '4+6', '5+5'], TRIPLES_DISTINCT = ['1+2+7', '1+3+6', '1+4+5', '2+3+5'];
function coverage(s) {
  const tm = totalMoves(s), share = (keys) => keys.reduce((a, k) => a + (s.combosOnBoard[k] || 0), 0) / tm * 100;
  const triplesAll = D.combos.filter((c) => c.k === 3).map((c) => c.key);
  const steps = [PAIRS, [...PAIRS, ...TRIPLES_DISTINCT], [...PAIRS, ...triplesAll], [...PAIRS, ...triplesAll, '1+2+3+4']];
  return steps.map(share);
}

// 9 가 처음에 1 과 붙어 있지 않을 확률의 이론값(가운데·가장자리·모서리 칸 비율로 계산)
function nineTheory(R, C) {
  const corner = 4, edge = 2 * (R - 2) + 2 * (C - 2), inner = (R - 2) * (C - 2), q = 8 / 9;
  return { corner, edge, inner, pInner: q ** 4, pEdge: q ** 3, pCorner: q ** 2, p: (inner * q ** 4 + edge * q ** 3 + corner * q ** 2) / (R * C) };
}
const p100 = (x, d = 1) => (x * 100).toFixed(d);
// 숫자가 하나 커질 때 '처음에 묶음 없음' 비율이 늘어나는 폭의 최소·최대
const steps = (s) => { const v = s.digits.map((x) => x.noMoveAtStartPct), d = v.slice(1).map((x, i) => x - v[i]); return [Math.min(...d).toFixed(1), Math.max(...d).toFixed(1)]; };

// 가로 막대 그림(인라인 SVG). rows: [이름, 값, 표시 문자열]
function bars(title, rows, { max } = {}) {
  const top = max || Math.max(...rows.map((r) => r[1])), rh = 28, lw = 150, W = 640, H = rows.length * rh + 8;
  const body = rows.map(([label, v, txt], i) => {
    const y = i * rh + 4, w = Math.max(2, ((W - lw - 70) * v) / top);
    return `<text x="${lw - 8}" y="${y + 18}" text-anchor="end" font-size="13" fill="#555">${label}</text><rect x="${lw}" y="${y + 5}" width="${w.toFixed(1)}" height="17" rx="4" fill="#f97316"/><text x="${(lw + w + 6).toFixed(1)}" y="${y + 18}" font-size="13" fill="#333" font-weight="700">${txt}</text>`;
  }).join('');
  return `<figure class="fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}" style="width:100%;height:auto;display:block">${body}</svg><figcaption>${title}</figcaption></figure>`;
}
const table = (head, rows) => `<div class="tbl-wrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

// 판당 바로 터뜨릴 수 있는 짝 수 분포를 5개 단위 구간으로 묶는다
function pairBuckets(s) {
  const b = new Map();
  for (const [k, v] of Object.entries(s.pairsHist)) { const lo = Math.floor(+k / 5) * 5; b.set(lo, (b.get(lo) || 0) + v); }
  return [...b.entries()].sort((a, c) => a[0] - c[0]).map(([lo, v]) => [`${lo}–${lo + 4}`, v / s.boards * 100, `${p100(v / s.boards)}%`]).filter((r) => r[1] >= 0.05);
}

const STRAT = {
  en: { pairs: 'Pairs first', big: 'Biggest box first', random: 'Random legal move', high: 'Highest number first' },
  ko: { pairs: '짝 먼저', big: '가장 큰 네모 먼저', random: '아무 묶음이나', high: '큰 숫자 먼저' },
};
const TIMEL = {
  en: { fast: 'Fast: 1.5 s per move', size: 'Size-dependent: 0.9 s + 0.5 s per tangerine', slow: 'Slow: 3 s per move' },
  ko: { fast: '빠름: 한 번에 1.5초', size: '크기 비례: 0.9초 + 귤 하나당 0.5초', slow: '느림: 한 번에 3초' },
};
const ORDER = ['pairs', 'high', 'random', 'big'];

function botTable(lang, size, time) {
  const L = lang === 'ko'
    ? ['전략', '평균 점수', '하위 10%–상위 10%', '터뜨린 귤', '터뜨린 횟수', '최장 콤보', '수가 바닥난 판']
    : ['Strategy', 'Mean score', '10th–90th pct', 'Tangerines cleared', 'Clears', 'Longest combo', 'Ran out of moves'];
  return table(L, ORDER.map((s) => { const r = bot(size, s, time); return [STRAT[lang][s], `<b>${r.score.mean}</b>`, `${r.score.p10}–${r.score.p90}`, r.cleared.mean, r.moves.mean, r.maxCombo.mean, `${r.stuckPct}%`]; }));
}

export const ARTICLES = {
  board: {
    en: { path: '/board-statistics', title: 'Tangerine 10 Board Statistics — 100,000 Simulated Boards', h1: 'What 100,000 Tangerine 10 boards look like', desc: 'A simulation of 100,000 fresh Tangerine 10 boards: how many moves a new board offers, how many pairs, which digits get stranded, and how often a 9 starts with no 1 beside it.' },
    ko: { path: '/ko/board-statistics', title: '귤게임 판 통계 — 새 판 10만 개 시뮬레이션', h1: '귤게임 새 판 10만 개를 만들어 보니', desc: '귤게임 Tangerine 10의 새 판 10만 개를 시뮬레이션했습니다. 판마다 바로 터뜨릴 수 있는 묶음과 짝의 수, 숫자별로 고립되는 비율, 9가 처음부터 1과 떨어져 있을 확률.' },
  },
  bots: {
    en: { path: '/bot-strategies', title: 'Tangerine 10 Bot Strategies — Pairs vs Big Boxes in 120 Seconds', h1: 'Pairs or big boxes? Four bots, 120 seconds, real scoring rules', desc: 'Four automatic Tangerine 10 players, three play speeds, 5,000 games each under the real combo and multiplier rules. Which strategy scores most, and when does it stop being true?' },
    ko: { path: '/ko/bot-strategies', title: '귤게임 봇 전략 비교 — 짝 먼저 vs 큰 네모 먼저', h1: '짝이 나을까, 큰 네모가 나을까 — 봇 네 개로 120초 점수 비교', desc: '귤게임 실제 규칙(콤보 2초, 배율)대로 움직이는 자동 플레이 봇 네 개를 세 가지 속도로 5,000판씩 돌려 120초 점수를 비교했습니다.' },
  },
  combos: {
    en: { path: '/make-ten-combinations', title: 'Every Way to Make Ten in Tangerine 10 — Combinations and How Often They Appear', h1: 'Every way to make ten, and how often each one shows up', desc: 'All 29 combinations of two to five numbers from 1 to 9 that add up to ten, the exact odds of each, and how often each appears as a clearable box on a fresh Tangerine 10 board.' },
    ko: { path: '/ko/make-ten-combinations', title: '합이 10인 숫자 조합 전부 — 귤게임 출현 빈도', h1: '합이 10이 되는 조합 전부와 실제로 나오는 빈도', desc: '1~9 숫자 2~5개로 10을 만드는 조합 29가지, 각 조합이 나올 정확한 확률, 귤게임 새 판에 터뜨릴 수 있는 네모로 실제 나타나는 빈도.' },
  },
};

const reproduceEn = `<h2>Reproducing these numbers</h2>
<p>Everything on this page comes from one script, <code>scripts/simulate.mjs</code>, run with Node.js. It copies the game's <code>makeBoard</code> line exactly — each cell gets <code>Math.floor(random × 9) + 1</code> — but swaps the browser's random number generator for a seeded one (seed ${D.seed}) so the same run produces the same numbers every time. The script writes its results to a JSON file, and this page is built from that file, so no figure here was typed by hand. Change the seed and the decimals will move a little; the conclusions will not.</p>`;
const reproduceKo = `<h2>이 숫자를 다시 만들어 보려면</h2>
<p>이 페이지의 수치는 모두 Node.js로 돌리는 스크립트 하나, <code>scripts/simulate.mjs</code>에서 나왔습니다. 게임의 <code>makeBoard</code> 한 줄(칸마다 <code>Math.floor(난수 × 9) + 1</code>)을 그대로 옮기고, 브라우저 난수 대신 시드(${D.seed})를 고정한 난수를 써서 몇 번을 돌려도 같은 결과가 나오게 했습니다. 스크립트가 결과를 JSON 파일로 남기고 이 페이지는 그 파일로 만들어지기 때문에, 여기 있는 숫자 중 손으로 적은 것은 없습니다. 시드를 바꾸면 소수점 아래는 조금 달라지지만 결론은 그대로입니다.</p>`;

// ---------------- (a) 판 통계 ----------------
function boardEn() {
  const th = nineTheory(10, 17), d9 = digit(bd, 9), d1 = digit(bd, 1), tm = totalMoves(bd);
  return `
<nav class="crumb"><a href="/">Home</a> › <a href="/analysis">Analysis</a> › Board statistics</nav>
<h1>${ARTICLES.board.en.h1}</h1>
<p class="lead">Every Tangerine 10 game deals a new random board. To see what a "typical" board actually contains, we generated ${n(bd.boards)} desktop boards and ${n(bm.boards)} mobile boards with the game's own board code and counted every move available before the first drag.</p>

<h2>How the simulation works</h2>
<p>The game builds a board with one line of code: every cell receives a whole number from 1 to 9, each equally likely, independent of its neighbours. There is no shuffling of a fixed deck, no guarantee of a certain number of nines and no check that the board is solvable. The simulation reproduces that line exactly and then looks at the board the way the selection box does.</p>
<p>A <b>move</b> here means any rectangle whose tangerines add up to exactly ten. On a fresh board nothing has been cleared yet, so a rectangle selects every tangerine inside it. That has a useful consequence: two tangerines can only be cleared together as a pair if they sit directly next to each other, horizontally or vertically. Any larger rectangle would sweep up a third tangerine. Diagonal neighbours need a 2×2 box, which always holds four numbers.</p>
<p>Desktop boards are 10 rows by 17 columns (170 tangerines). Phones narrower than 600 pixels get 12 rows by 14 columns (168 tangerines). Both were simulated separately because the shape changes how many cells sit on an edge, and edges matter more than you might expect.</p>

<h2>How many moves a new board offers</h2>
<p>The average fresh desktop board offers <b>${bd.moves.mean}</b> distinct rectangles that add up to ten. That number varies far less than intuition suggests. Nine boards out of ten fall between ${bd.moves.p10} and ${bd.moves.p90} moves, the thinnest board in the whole run had ${bd.moves.min}, and the richest had ${bd.moves.max}. Mobile boards are almost identical: ${bm.moves.mean} moves on average, between ${bm.moves.p10} and ${bm.moves.p90} for nine boards in ten.</p>
${table(['', 'Desktop 10×17', 'Mobile 12×14'], [
    ['All moves (mean)', `<b>${bd.moves.mean}</b>`, `<b>${bm.moves.mean}</b>`],
    ['All moves (10th–90th percentile)', `${bd.moves.p10}–${bd.moves.p90}`, `${bm.moves.p10}–${bm.moves.p90}`],
    ['All moves (min / max)', `${bd.moves.min} / ${bd.moves.max}`, `${bm.moves.min} / ${bm.moves.max}`],
    ['Adjacent pairs (mean)', `<b>${bd.pairs.mean}</b>`, `<b>${bm.pairs.mean}</b>`],
    ['Adjacent pairs (min / max)', `${bd.pairs.min} / ${bd.pairs.max}`, `${bm.pairs.min} / ${bm.pairs.max}`],
    ['Boards with no pair at all', `${bd.zeroPairBoards}`, `${bm.zeroPairBoards}`],
    ['Tangerines in no move at the start', `${bd.deadTiles.mean} of 170`, `${bm.deadTiles.mean} of 168`],
  ])}
<p>Two figures stand out. First, pairs dominate: ${bd.pairs.mean} of the ${bd.moves.mean} opening moves on a desktop board are two adjacent tangerines. Second, not a single board in ${n(bd.boards * 2)} started without a pair. The leanest board still had ${Math.min(bd.pairs.min, bm.pairs.min)} of them, so a game can never open with nothing to do.</p>
${bars('Share of desktop boards by number of adjacent pairs at the start', pairBuckets(bd))}
<p>The distribution is a bell curve centred in the mid-thirties. That is what you would expect from a board of 170 independent cells: a desktop board has ${10 * 16 + 9 * 17} horizontal and vertical neighbour links, and each link is a pair with probability 9 in 81, or one in nine. ${10 * 16 + 9 * 17} divided by nine is ${((10 * 16 + 9 * 17) / 9).toFixed(1)}, and the simulation landed on ${bd.pairs.mean}. The arithmetic and the simulation agree, which is a good sign that the simulation is counting the right thing.</p>

<h2>Moves by size</h2>
<p>Larger boxes exist, but they thin out quickly. The table counts how many moves of each size an average fresh board contains.</p>
${table(['Tangerines in the box', 'Desktop (per board)', 'Mobile (per board)', 'Share of desktop moves'], bd.bySize.map((x) => [x.k, x.perBoard, sizeRow(bm, x.k), `${p100(x.perBoard / tm)}%`]))}
<p>Three-tangerine moves are worth looking for, at roughly ${sizeRow(bd, 3)} per board. Four-tangerine moves appear about ${sizeRow(bd, 4)} times. Five or more is rare: about ${(sizeRow(bd, 5) + sizeRow(bd, 6) + sizeRow(bd, 7)).toFixed(2)} per board in total, which means most opening boards contain none at all. A player who scans for big boxes at the start of a game is mostly scanning for something that is not there.</p>
<p>The shapes follow the same pattern. The most common rectangles on a fresh desktop board are:</p>
${table(['Box shape (rows × columns)', 'Per desktop board'], bd.shapes.map((s) => [s.key, s.perBoard]))}
<p>Horizontal and vertical pairs are almost equally common; horizontal ones edge ahead on desktop simply because a 17-column board has more side-by-side links than top-to-bottom ones. A 2×2 square that adds to ten — four tangerines, all small — turns up about ${bd.shapes.find((s) => s.key === '2x2')?.perBoard ?? 0} times per board.</p>

<h2>Every digit is equally common, but not equally useful</h2>
<p>Each digit appears about ${digit(bd, 5).perBoard} times on a desktop board, exactly as a uniform draw predicts. Each tangerine also has, on average, about ${d9.partnersPerTile} neighbours that complete a pair with it, whatever its number. The difference between digits shows up somewhere else: in how many tangerines of each number are part of <i>no</i> move at all when the game begins.</p>
${table(['Digit', 'Per desktop board', 'Pair partners next to it (avg)', 'In no move at the start'], bd.digits.map((x) => [x.d, x.perBoard, x.partnersPerTile, `<b>${x.noMoveAtStartPct}%</b>`]))}
${bars('Desktop: share of each digit that belongs to no move on a fresh board', bd.digits.map((x) => [`Digit ${x.d}`, x.noMoveAtStartPct, `${x.noMoveAtStartPct}%`]), { max: 100 })}
<p>The pattern is a clean staircase. Only ${d1.noMoveAtStartPct}% of ones are stuck at the start, against ${d9.noMoveAtStartPct}% of nines. The reason is that small numbers have more ways to reach ten. A 1 can finish a pair with a 9, but it can also sit inside 1+2+7, 1+3+6, 1+4+5, 1+1+8 and a dozen longer combinations. A 9 has exactly one possible partner. Every step up the number line removes options, and in the table each step up adds between ${steps(bd)[0]} and ${steps(bd)[1]} percentage points.</p>

<h2>How often a 9 starts stranded</h2>
<p>For a 9, "in no move" has a precise meaning: none of the cells touching it holds a 1. That can be checked with plain probability, which gives a second, independent way to test the simulation. Each neighbour is a 1 with probability one in nine, so a 9 in the middle of the board (four neighbours) is stranded with probability (8/9)<sup>4</sup> = ${p100(th.pInner)}%. On an edge it has three neighbours, (8/9)<sup>3</sup> = ${p100(th.pEdge)}%; in a corner two, (8/9)<sup>2</sup> = ${p100(th.pCorner)}%.</p>
${table(['Position on a 10×17 board', 'Cells', 'Chance a 9 there has no adjacent 1'], [
    ['Interior', th.inner, `${p100(th.pInner)}%`], ['Edge', th.edge, `${p100(th.pEdge)}%`], ['Corner', th.corner, `${p100(th.pCorner)}%`],
    ['<b>Whole board (weighted)</b>', 170, `<b>${p100(th.p, 2)}%</b>`],
  ])}
<p>Weighting by how many cells of each kind exist gives ${p100(th.p, 2)}% for the whole board. The simulation measured <b>${d9.noMoveAtStartPct}%</b>. Roughly two nines in three start the game with no way out.</p>
<p>There is also a harder limit that no amount of skill gets around. A 9 can only ever leave the board together with exactly one 1, and each 1 can only be used once. On ${bd.nineExcess.boardsPct}% of desktop boards the nines outnumber the ones, and on average ${bd.nineExcess.mean} nines per board have no 1 left to pair with even in a perfect game. On the most lopsided board in the run, ${bd.nineExcess.max} nines were left without a possible partner. Since ones also disappear into combinations like 1+2+7, the real number of unclearable nines in a typical game is higher still.</p>

<h2>What the numbers mean for a player</h2>
<p>Three practical readings follow from the data. A fresh board is never empty of options: there are always dozens of pairs, so a slow opening is a scanning problem, not a board problem. Big boxes are rare at the start and grow more common only as holes open up, which you can see in the <a href="/bot-strategies">bot experiment</a>. And nines are the least useful number on the board by a wide margin. How to turn that into a habit is covered in the <a href="/strategy">strategy guide</a>, so it is not repeated here. The complete list of combinations, with odds, is on the <a href="/make-ten-combinations">make-ten combinations</a> page.</p>
${reproduceEn}
<p><a class="cta" href="/">Play a board</a></p>`;
}

function boardKo() {
  const th = nineTheory(10, 17), d9 = digit(bd, 9), d1 = digit(bd, 1), tm = totalMoves(bd);
  return `
<nav class="crumb"><a href="/ko/">홈</a> › <a href="/ko/analysis">분석</a> › 판 통계</nav>
<h1>${ARTICLES.board.ko.h1}</h1>
<p class="lead">귤게임은 판마다 숫자가 무작위로 깔립니다. 그렇다면 "보통의 판"에는 무엇이 들어 있을까요? 게임에 들어 있는 판 만드는 코드 그대로 PC 판 ${n(bd.boards)}개, 휴대폰 판 ${n(bm.boards)}개를 만들고, 첫 드래그 전에 터뜨릴 수 있는 묶음을 전부 세어 봤습니다.</p>

<h2>어떻게 시뮬레이션했나</h2>
<p>게임은 코드 한 줄로 판을 만듭니다. 칸마다 1부터 9까지 정수 하나를 똑같은 확률로, 옆 칸과 상관없이 넣습니다. 정해진 숫자 묶음을 섞는 방식이 아니어서 9가 몇 개 나온다는 보장도 없고, 다 지울 수 있는 판인지 확인하지도 않습니다. 시뮬레이션은 이 한 줄을 그대로 옮긴 뒤, 선택 네모가 판을 보는 방식 그대로 판을 살펴봅니다.</p>
<p>여기서 <b>묶음</b>은 안에 든 귤의 합이 정확히 10인 네모를 말합니다. 새 판에는 빈칸이 없어서 네모 안의 귤이 전부 선택됩니다. 그래서 두 개짜리 짝은 위아래나 좌우로 바로 붙어 있어야만 터뜨릴 수 있습니다. 네모를 조금만 키워도 세 번째 귤이 끼어들기 때문입니다. 대각선으로 붙은 두 귤을 잡으려면 2×2 네모가 필요한데, 그러면 귤 네 개가 같이 잡힙니다.</p>
<p>PC 판은 10줄 × 17칸(귤 170개), 화면 폭 600픽셀 이하 휴대폰 판은 12줄 × 14칸(귤 168개)입니다. 판 모양이 달라지면 가장자리에 놓이는 칸의 수가 달라지고, 가장자리는 생각보다 중요하기 때문에 둘을 따로 돌렸습니다.</p>

<h2>새 판에는 묶음이 몇 개 있나</h2>
<p>새 PC 판에는 합이 10인 네모가 평균 <b>${bd.moves.mean}개</b> 있습니다. 판마다 차이도 생각보다 작습니다. 열 판 중 아홉 판이 ${bd.moves.p10}~${bd.moves.p90}개 사이였고, 전체에서 가장 적은 판이 ${bd.moves.min}개, 가장 많은 판이 ${bd.moves.max}개였습니다. 휴대폰 판도 거의 같아서 평균 ${bm.moves.mean}개, 열 판 중 아홉 판이 ${bm.moves.p10}~${bm.moves.p90}개였습니다.</p>
${table(['', 'PC 10×17', '휴대폰 12×14'], [
    ['전체 묶음 (평균)', `<b>${bd.moves.mean}</b>`, `<b>${bm.moves.mean}</b>`],
    ['전체 묶음 (하위 10%–상위 10%)', `${bd.moves.p10}–${bd.moves.p90}`, `${bm.moves.p10}–${bm.moves.p90}`],
    ['전체 묶음 (최소 / 최대)', `${bd.moves.min} / ${bd.moves.max}`, `${bm.moves.min} / ${bm.moves.max}`],
    ['붙어 있는 짝 (평균)', `<b>${bd.pairs.mean}</b>`, `<b>${bm.pairs.mean}</b>`],
    ['붙어 있는 짝 (최소 / 최대)', `${bd.pairs.min} / ${bd.pairs.max}`, `${bm.pairs.min} / ${bm.pairs.max}`],
    ['짝이 하나도 없는 판', `${bd.zeroPairBoards}`, `${bm.zeroPairBoards}`],
    ['처음에 어떤 묶음에도 못 들어가는 귤', `170개 중 ${bd.deadTiles.mean}`, `168개 중 ${bm.deadTiles.mean}`],
  ])}
<p>눈에 띄는 숫자가 둘 있습니다. 첫째, 짝이 압도적입니다. PC 판의 첫 묶음 ${bd.moves.mean}개 중 ${bd.pairs.mean}개가 붙어 있는 두 개짜리 짝입니다. 둘째, ${n(bd.boards * 2)}개 판 가운데 짝 없이 시작한 판은 하나도 없었습니다. 가장 빈약한 판에도 짝이 ${Math.min(bd.pairs.min, bm.pairs.min)}개는 있었으니, 할 게 없는 상태로 게임이 시작되는 일은 없습니다.</p>
${bars('PC 판: 시작할 때 붙어 있는 짝 수별 판 비율', pairBuckets(bd))}
<p>분포는 30개 중반을 꼭대기로 한 종 모양입니다. 서로 상관없는 칸 170개로 된 판이라면 당연한 결과입니다. PC 판에는 위아래·좌우로 이웃한 칸의 연결이 ${10 * 16 + 9 * 17}개 있고, 연결 하나가 짝일 확률은 81분의 9, 즉 9분의 1입니다. ${10 * 16 + 9 * 17}을 9로 나누면 ${((10 * 16 + 9 * 17) / 9).toFixed(1)}이고, 시뮬레이션 값은 ${bd.pairs.mean}이었습니다. 손으로 한 계산과 시뮬레이션이 맞아떨어지니, 시뮬레이션이 제대로 세고 있다는 뜻입니다.</p>

<h2>묶음 크기별로 보면</h2>
<p>큰 네모도 있지만 금방 드물어집니다. 아래 표는 새 판 하나에 크기별 묶음이 평균 몇 개 있는지 센 것입니다.</p>
${table(['네모 안의 귤 수', 'PC (판당)', '휴대폰 (판당)', 'PC 전체 묶음 중 비율'], bd.bySize.map((x) => [x.k, x.perBoard, sizeRow(bm, x.k), `${p100(x.perBoard / tm)}%`]))}
<p>세 개짜리는 판마다 ${sizeRow(bd, 3)}개쯤 있어서 찾아볼 만합니다. 네 개짜리는 ${sizeRow(bd, 4)}개 정도입니다. 다섯 개 이상은 다 합쳐도 판당 ${(sizeRow(bd, 5) + sizeRow(bd, 6) + sizeRow(bd, 7)).toFixed(2)}개라 대부분의 첫 판에는 아예 없습니다. 게임 초반에 큰 네모를 찾는 사람은 대개 없는 것을 찾고 있는 셈입니다.</p>
<p>모양도 같은 흐름입니다. 새 PC 판에서 가장 흔한 네모 모양은 이렇습니다.</p>
${table(['네모 모양 (줄 × 칸)', 'PC 판당'], bd.shapes.map((s) => [s.key, s.perBoard]))}
<p>가로 짝과 세로 짝은 거의 같은 수만큼 나옵니다. PC에서 가로 짝이 조금 많은 건 17칸짜리 판이라 좌우 연결이 위아래 연결보다 많아서입니다. 작은 숫자 네 개로 합 10을 만드는 2×2 정사각형은 판당 ${bd.shapes.find((s) => s.key === '2x2')?.perBoard ?? 0}개쯤 나옵니다.</p>

<h2>숫자는 똑같이 나오지만 쓸모는 다르다</h2>
<p>PC 판에서 숫자 하나는 평균 ${digit(bd, 5).perBoard}개씩 나옵니다. 균일하게 뽑으면 나와야 할 값 그대로입니다. 어떤 숫자든 귤 하나 옆에 짝이 되는 이웃이 평균 ${d9.partnersPerTile}개 있는 것도 같습니다. 차이는 다른 데서 납니다. 게임이 시작될 때 <i>어떤 묶음에도</i> 들어가지 못하는 귤의 비율입니다.</p>
${table(['숫자', 'PC 판당 개수', '옆에 붙은 짝 (평균)', '처음에 묶음이 없는 비율'], bd.digits.map((x) => [x.d, x.perBoard, x.partnersPerTile, `<b>${x.noMoveAtStartPct}%</b>`]))}
${bars('PC 판: 새 판에서 어떤 묶음에도 못 들어가는 숫자별 비율', bd.digits.map((x) => [`숫자 ${x.d}`, x.noMoveAtStartPct, `${x.noMoveAtStartPct}%`]), { max: 100 })}
<p>깔끔한 계단 모양입니다. 처음에 묶음이 없는 1은 ${d1.noMoveAtStartPct}%뿐인데, 9는 ${d9.noMoveAtStartPct}%입니다. 작은 숫자일수록 10을 만드는 길이 많기 때문입니다. 1은 9와 짝을 이룰 수도 있지만 1+2+7, 1+3+6, 1+4+5, 1+1+8, 그리고 더 긴 조합 여러 개에도 들어갈 수 있습니다. 9의 짝은 정확히 하나뿐입니다. 숫자가 하나 커질 때마다 선택지가 줄고, 표를 보면 한 칸 올라갈 때마다 ${steps(bd)[0]}~${steps(bd)[1]}%포인트씩 늘어납니다.</p>

<h2>9가 처음부터 고립될 확률</h2>
<p>9에게 "묶음이 없다"는 말은 정확한 뜻이 있습니다. 맞닿은 칸 중에 1이 하나도 없다는 것입니다. 이건 확률 계산으로도 구할 수 있어서 시뮬레이션을 검증할 두 번째 방법이 됩니다. 이웃 한 칸이 1일 확률은 9분의 1이므로, 판 가운데(이웃 4칸)의 9가 고립될 확률은 (8/9)<sup>4</sup> = ${p100(th.pInner)}%입니다. 가장자리(이웃 3칸)는 (8/9)<sup>3</sup> = ${p100(th.pEdge)}%, 모서리(이웃 2칸)는 (8/9)<sup>2</sup> = ${p100(th.pCorner)}%입니다.</p>
${table(['10×17 판에서의 위치', '칸 수', '그 자리 9 옆에 1이 없을 확률'], [
    ['가운데', th.inner, `${p100(th.pInner)}%`], ['가장자리', th.edge, `${p100(th.pEdge)}%`], ['모서리', th.corner, `${p100(th.pCorner)}%`],
    ['<b>판 전체 (가중 평균)</b>', 170, `<b>${p100(th.p, 2)}%</b>`],
  ])}
<p>칸 수로 가중 평균하면 판 전체로 ${p100(th.p, 2)}%가 나옵니다. 시뮬레이션 측정값은 <b>${d9.noMoveAtStartPct}%</b>였습니다. 9 세 개 중 두 개꼴로 빠져나갈 길 없이 게임을 시작한다는 뜻입니다.</p>
<p>실력으로도 넘을 수 없는 한계도 있습니다. 9는 반드시 1 하나와 함께만 판에서 사라질 수 있고, 1은 한 번밖에 못 씁니다. PC 판의 ${bd.nineExcess.boardsPct}%에서 9가 1보다 많았고, 판마다 평균 ${bd.nineExcess.mean}개의 9는 완벽하게 플레이해도 짝지을 1이 남지 않습니다. 이번 시뮬레이션에서 가장 치우친 판에서는 9 ${bd.nineExcess.max}개가 짝이 될 1 없이 남았습니다. 1은 1+2+7 같은 조합에도 쓰이니 실제 게임에서 못 지우는 9는 이보다 더 많습니다.</p>

<h2>플레이할 때 의미하는 것</h2>
<p>데이터에서 세 가지를 읽을 수 있습니다. 새 판에는 할 게 없을 일이 없습니다. 짝이 늘 수십 개 있으니 초반이 느린 건 판 탓이 아니라 훑는 방법 탓입니다. 큰 네모는 초반에 드물고 빈칸이 생기면서 늘어나는데, 이 흐름은 <a href="/ko/bot-strategies">봇 실험</a>에서 볼 수 있습니다. 그리고 9는 판에서 가장 쓸모없는 숫자입니다. 이것을 습관으로 바꾸는 방법은 <a href="/ko/strategy">공략</a>에 있어서 여기서는 되풀이하지 않습니다. 확률까지 붙인 전체 조합 목록은 <a href="/ko/make-ten-combinations">합이 10인 조합</a> 페이지에 있습니다.</p>
${reproduceKo}
<p><a class="cta" href="/ko/">한 판 해 보기</a></p>`;
}

// ---------------- (b) 봇 ----------------
function botsEn() {
  const f = (s) => bot('desktop', s, 'fast'), z = (s) => bot('desktop', s, 'size'), w = (s) => bot('desktop', s, 'slow');
  return `
<nav class="crumb"><a href="/">Home</a> › <a href="/analysis">Analysis</a> › Bot strategies</nav>
<h1>${ARTICLES.bots.en.h1}</h1>
<p class="lead">Strategy advice for make-ten puzzles usually comes from feel. This page tests it instead: four automatic players with different rules for choosing a move, each playing ${n(D.gamesPerSetting)} games per setting under Tangerine 10's real scoring, combo and timer rules.</p>

<h2>The rules the bots play by</h2>
<p>The bots do not play a simplified version of the game. The simulation implements the same rules as the code in the browser:</p>
<ul>
  <li>A new 10×17 board (or 12×14 for the mobile runs) of random numbers 1–9, built by the game's own <code>makeBoard</code> formula.</li>
  <li>A move is a rectangle whose remaining tangerines add up to exactly ten. Cleared cells are empty and ignored, so later moves can stretch across holes.</li>
  <li>Each move adds <code>floor(tangerines × multiplier)</code> points. The multiplier is ×1 at combo 1, ×1.5 at 2–4, ×2 at 5–9, ×3 at 10–19 and ×5 from 20.</li>
  <li>If more than two seconds pass between clears, the combo falls back to zero, exactly like the two-second timer in the game.</li>
  <li>The game ends at 120 seconds, or earlier if the board has no rectangle left that adds up to ten.</li>
</ul>

<h2>The four strategies</h2>
<p>Every bot sees the whole board perfectly and never mis-drags. They differ only in which legal move they pick when there are several.</p>
${table(['Bot', 'How it picks a move'], [
    [STRAT.en.pairs, 'The legal move with the fewest tangerines. Ties go to the one nearest the top-left.'],
    [STRAT.en.big, 'The legal move with the most tangerines.'],
    [STRAT.en.random, 'Any legal move, chosen at random.'],
    [STRAT.en.high, 'The move containing the largest number (clearing 9s and 8s whenever possible), fewest tangerines on ties.'],
  ])}

<h2>The part that is an assumption: speed</h2>
<p>A bot does not need time to think, so the simulation has to decide how long each move takes. Nobody has measured real players doing this, so instead of pretending to know, the experiment runs three different speed models and reports all of them.</p>
${table(['Speed model', 'Time per move', 'What it represents'], [
    [TIMEL.en.fast, '1.5 s for every move', 'A quick player who never breaks the combo.'],
    [TIMEL.en.size, '0.9 s + 0.5 s × tangerines', 'Bigger boxes take longer. A pair takes 1.9 s and keeps the combo; three tangerines take 2.4 s and break it.'],
    [TIMEL.en.slow, '3 s for every move', 'A careful player who never manages to keep a combo.'],
  ])}

<h2>Results on the desktop board</h2>
<h3>${TIMEL.en.fast}</h3>
${botTable('en', 'desktop', 'fast')}
<h3>${TIMEL.en.size}</h3>
${botTable('en', 'desktop', 'size')}
<h3>${TIMEL.en.slow}</h3>
${botTable('en', 'desktop', 'slow')}
${bars('Mean 120-second score by strategy and speed (desktop board)', ['fast', 'size', 'slow'].flatMap((t) => ORDER.map((s) => [`${t === 'fast' ? 'Fast' : t === 'size' ? 'Size' : 'Slow'} · ${STRAT.en[s]}`, bot('desktop', s, t).score.mean, `${bot('desktop', s, t).score.mean}`])))}

<h2>Finding 1: with a fast hand, pairs win by a wide margin</h2>
<p>At 1.5 seconds a move, the pairs-first bot averaged <b>${f('pairs').score.mean}</b> points. The biggest-box bot averaged ${f('big').score.mean}. That is a gap of ${(f('pairs').score.mean - f('big').score.mean).toFixed(1)} points, and it is not caused by the combo, because at this speed no bot ever breaks its combo. The difference is in how many tangerines each bot manages to clear before the board runs dry: ${f('pairs').cleared.mean} for pairs-first against ${f('big').cleared.mean} for biggest-first.</p>
<p>The likely reason is that big boxes eat small numbers. A five-tangerine box that adds to ten is made of ones, twos and threes, and those small numbers are exactly the ones that could have finished pairs with eights, nines and sevens later. Spend them early and the high numbers are left with nothing. Picking pairs keeps the flexible small numbers on the board for longer.</p>

<h2>Finding 2: a fast player runs out of board, not time</h2>
<p>The most surprising number in the fast table is the last column. Every single bot, in every one of the ${n(D.gamesPerSetting)} games, ran out of legal moves before the clock did. The pairs-first bot hit a dead board after ${f('pairs').stuckAtMean} seconds on average; biggest-first after ${f('big').stuckAtMean}. After that point no rectangle on the board adds to exactly ten, however you draw it. No game ended with an empty board: the best pairs-first run cleared ${f('pairs').cleared.max} of 170 tangerines, and a typical run left about ${(170 - f('pairs').cleared.mean).toFixed(0)} behind.</p>
<p>This puts a ceiling on scores. A player who is fast enough will not be limited by 120 seconds but by how many tangerines can still be matched, and that depends on what was cleared earlier.</p>

<h2>Finding 3: when bigger boxes cost time, the gap widens</h2>
<p>In the size-dependent model a pair still keeps the combo, but anything larger breaks it. The pairs-first bot dropped to ${z('pairs').score.mean} points with about ${z('pairs').comboBreaks.mean} broken combos per game; it only takes a larger box when no pair is left anywhere on the board. The biggest-box bot broke its combo ${z('big').comboBreaks.mean} times per game and fell to ${z('big').score.mean}. The random bot finished lowest at ${z('random').score.mean}. Here pairs-first scored ${(z('pairs').score.mean / z('big').score.mean).toFixed(1)} times as much as biggest-first.</p>

<h2>Finding 4: if you cannot keep a combo, the advice flips</h2>
<p>At three seconds a move, the combo never survives, so the multiplier is always ×1 and score is simply the number of tangerines cleared. Under those conditions the ranking reverses. Biggest-first scored ${w('big').score.mean}, random ${w('random').score.mean}, and pairs-first only ${w('pairs').score.mean}. With roughly 40 moves available in 120 seconds, a bot that takes three tangerines when it can clears more per move.</p>
<p>That is the honest conclusion of the experiment: "take pairs" is not a universal rule. It is the right rule for anyone fast enough to chain clears inside two seconds, which is the whole point of the combo system. A player who is still learning the board and cannot yet keep a streak loses little by taking bigger boxes.</p>

<h2>What about clearing high numbers first?</h2>
<p>The highest-number-first bot tests the idea of rescuing nines and eights while you can. It scored ${f('high').score.mean} at the fast speed, slightly below pairs-first, and cleared ${f('high').cleared.mean} tangerines against ${f('pairs').cleared.mean}. Prioritising high numbers gives back a little, because it sometimes reaches for a three-tangerine box to free an 8 when a pair was available. The gap is small, so it is not a bad habit, but it does not help either.</p>

<h2>How much the board itself decides</h2>
<p>Because the bots never hesitate and never misread a number, any difference between two of their games comes from the board alone. That makes them a clean way to measure luck. Playing pairs-first at the fast speed, the bot's worst tenth of games scored ${f('pairs').score.p10} or less and its best tenth ${f('pairs').score.p90} or more; the single worst game scored ${f('pairs').score.min} and the best ${f('pairs').score.max}. The standard deviation was ${f('pairs').score.sd} points on a mean of ${f('pairs').score.mean}.</p>
<p>In other words, an identical player can score half again as much on one board as on another, purely from how the numbers fell. For a person comparing two runs, a difference of 20 or 30 points between consecutive games says very little about whether they improved. Averages over several games are a much better measure than any single score, and the same is true of the leaderboard: a top score is partly a good player and partly a good board.</p>
<p>The slow model shows the other side of this. At three seconds a move, the pairs-first bot's scores sat between ${w('pairs').score.p10} and ${w('pairs').score.p90} for most games, a far narrower band, because the clock rather than the board was the limit in most games and every move earned the same one point per tangerine.</p>

<h2>Mobile board</h2>
<p>The 12×14 phone board gives almost the same picture. Fast pairs-first averaged ${bot('mobile', 'pairs', 'fast').score.mean}, fast biggest-first ${bot('mobile', 'big', 'fast').score.mean}; in the slow model biggest-first again won with ${bot('mobile', 'big', 'slow').score.mean} against ${bot('mobile', 'pairs', 'slow').score.mean}.</p>
${botTable('en', 'mobile', 'size')}

<h2>What the bots cannot tell you</h2>
<p>These bots see every legal move at once. People do not, and the time it takes a person to find the next pair depends on how cluttered the board is, how tired they are and whether they are using a mouse or a thumb. That is why the speed models are labelled as assumptions rather than measurements, and why the fast-model scores are probably well above what most people reach. What the experiment does show reliably is the direction of each effect: which strategy beats which under each speed, and why. For turning that into habits, see the <a href="/strategy">strategy guide</a>; for the rules the bots follow, the <a href="/how-to-play">rules page</a>.</p>
${reproduceEn}
<p><a class="cta" href="/">Try the pairs-first rule yourself</a></p>`;
}

function botsKo() {
  const f = (s) => bot('desktop', s, 'fast'), z = (s) => bot('desktop', s, 'size'), w = (s) => bot('desktop', s, 'slow');
  return `
<nav class="crumb"><a href="/ko/">홈</a> › <a href="/ko/analysis">분석</a> › 봇 전략 비교</nav>
<h1>${ARTICLES.bots.ko.h1}</h1>
<p class="lead">숫자 10 만들기 게임의 공략은 보통 감으로 나옵니다. 이 페이지는 그 감을 직접 시험해 봅니다. 묶음을 고르는 기준이 다른 자동 플레이 봇 네 개가 귤게임의 실제 점수·콤보·타이머 규칙 그대로 설정마다 ${n(D.gamesPerSetting)}판씩 플레이했습니다.</p>

<h2>봇이 따르는 규칙</h2>
<p>봇은 게임을 단순하게 바꾼 버전이 아니라, 브라우저에서 돌아가는 코드와 같은 규칙으로 플레이합니다.</p>
<ul>
  <li>게임의 <code>makeBoard</code> 식 그대로 1~9 무작위 숫자로 만든 새 10×17 판(휴대폰 실험은 12×14).</li>
  <li>남은 귤의 합이 정확히 10인 네모가 한 번의 수입니다. 터진 칸은 빈칸이 되어 계산에서 빠지므로, 나중에는 빈칸을 가로질러 넓게 잡을 수 있습니다.</li>
  <li>한 번 터뜨릴 때마다 <code>floor(귤 수 × 배율)</code>점. 배율은 콤보 1에서 ×1, 2~4 ×1.5, 5~9 ×2, 10~19 ×3, 20부터 ×5입니다.</li>
  <li>터뜨린 뒤 2초 넘게 다음 묶음을 못 터뜨리면 콤보가 0으로 돌아갑니다. 게임의 2초 타이머와 같습니다.</li>
  <li>120초가 지나면 끝나고, 그 전에 합이 10인 네모가 하나도 안 남으면 그때 끝납니다.</li>
</ul>

<h2>네 가지 전략</h2>
<p>봇은 판 전체를 한 번에 정확히 보고, 잘못 끄는 일도 없습니다. 차이는 가능한 묶음이 여러 개일 때 무엇을 고르느냐뿐입니다.</p>
${table(['봇', '고르는 기준'], [
    [STRAT.ko.pairs, '귤 수가 가장 적은 묶음. 같으면 왼쪽 위에 가까운 것.'],
    [STRAT.ko.big, '귤 수가 가장 많은 묶음.'],
    [STRAT.ko.random, '가능한 묶음 중 아무거나 무작위로.'],
    [STRAT.ko.high, '가장 큰 숫자가 들어간 묶음(9·8을 가능할 때 먼저 처리). 같으면 귤 수가 적은 것.'],
  ])}

<h2>가정이 들어간 부분: 속도</h2>
<p>봇은 생각할 시간이 필요 없어서, 한 번 터뜨리는 데 몇 초가 걸리는지는 시뮬레이션이 정해 줘야 합니다. 실제 사람이 얼마나 걸리는지 잰 자료는 없습니다. 아는 척하는 대신 속도 모델 세 가지를 모두 돌려 결과를 다 보여 드립니다.</p>
${table(['속도 모델', '한 번에 걸리는 시간', '뜻'], [
    [TIMEL.ko.fast, '매번 1.5초', '콤보를 절대 놓치지 않는 빠른 손.'],
    [TIMEL.ko.size, '0.9초 + 귤 수 × 0.5초', '큰 네모일수록 오래 걸림. 짝은 1.9초라 콤보가 이어지고, 세 개짜리는 2.4초라 끊김.'],
    [TIMEL.ko.slow, '매번 3초', '콤보를 한 번도 못 잇는 신중한 손.'],
  ])}

<h2>PC 판 결과</h2>
<h3>${TIMEL.ko.fast}</h3>
${botTable('ko', 'desktop', 'fast')}
<h3>${TIMEL.ko.size}</h3>
${botTable('ko', 'desktop', 'size')}
<h3>${TIMEL.ko.slow}</h3>
${botTable('ko', 'desktop', 'slow')}
${bars('전략·속도별 120초 평균 점수 (PC 판)', ['fast', 'size', 'slow'].flatMap((t) => ORDER.map((s) => [`${t === 'fast' ? '빠름' : t === 'size' ? '크기' : '느림'} · ${STRAT.ko[s]}`, bot('desktop', s, t).score.mean, `${bot('desktop', s, t).score.mean}`])))}

<h2>발견 1: 손이 빠르면 짝이 크게 이긴다</h2>
<p>한 번에 1.5초일 때 짝 먼저 봇은 평균 <b>${f('pairs').score.mean}점</b>, 큰 네모 먼저 봇은 ${f('big').score.mean}점이었습니다. ${(f('pairs').score.mean - f('big').score.mean).toFixed(1)}점 차이인데, 이 속도에서는 어느 봇도 콤보를 끊기지 않으니 콤보 때문이 아닙니다. 차이는 판이 바닥나기 전까지 터뜨린 귤 수에서 납니다. 짝 먼저는 ${f('pairs').cleared.mean}개, 큰 네모 먼저는 ${f('big').cleared.mean}개였습니다.</p>
<p>큰 네모가 작은 숫자를 먹어 치우기 때문으로 보입니다. 귤 다섯 개로 10을 만드는 네모는 1, 2, 3 같은 작은 숫자로 이루어지는데, 바로 그 작은 숫자들이 나중에 8, 9, 7과 짝을 이룰 수 있었던 숫자입니다. 일찍 써 버리면 큰 숫자들은 짝 없이 남습니다. 짝을 먼저 고르면 쓸모가 많은 작은 숫자가 판에 더 오래 남습니다.</p>

<h2>발견 2: 빠른 사람은 시간보다 판이 먼저 바닥난다</h2>
<p>빠른 속도 표에서 가장 놀라운 숫자는 마지막 칸입니다. 봇 네 개 모두 ${n(D.gamesPerSetting)}판 전부에서 시간보다 둘 수 있는 묶음이 먼저 떨어졌습니다. 짝 먼저 봇은 평균 ${f('pairs').stuckAtMean}초, 큰 네모 먼저 봇은 ${f('big').stuckAtMean}초에 막힌 판을 만났습니다. 그 뒤로는 어떻게 네모를 그려도 합이 정확히 10이 되지 않습니다. 판을 다 비운 게임은 하나도 없었습니다. 짝 먼저 봇이 가장 잘한 판도 170개 중 ${f('pairs').cleared.max}개를 터뜨리는 데 그쳤고, 보통은 ${(170 - f('pairs').cleared.mean).toFixed(0)}개쯤이 남았습니다.</p>
<p>이는 점수에 천장이 있다는 뜻입니다. 충분히 빠른 사람에게 한계는 120초가 아니라 아직 짝지을 수 있는 귤이 몇 개 남았느냐이고, 그건 앞에서 무엇을 터뜨렸느냐에 달려 있습니다.</p>

<h2>발견 3: 큰 네모가 시간을 잡아먹으면 차이가 더 벌어진다</h2>
<p>크기 비례 모델에서는 짝은 여전히 콤보를 잇지만 그보다 큰 묶음은 콤보를 끊습니다. 짝 먼저 봇은 판마다 콤보가 ${z('pairs').comboBreaks.mean}번쯤 끊기며(이 봇은 판 어디에도 짝이 없을 때만 큰 네모를 고릅니다) ${z('pairs').score.mean}점으로 내려왔습니다. 큰 네모 먼저 봇은 판마다 ${z('big').comboBreaks.mean}번 끊기며 ${z('big').score.mean}점까지 떨어졌습니다. 아무거나 봇은 ${z('random').score.mean}점으로 가장 낮았습니다. 이 모델에서 짝 먼저는 큰 네모 먼저의 ${(z('pairs').score.mean / z('big').score.mean).toFixed(1)}배를 얻었습니다.</p>

<h2>발견 4: 콤보를 못 이으면 결론이 뒤집힌다</h2>
<p>한 번에 3초가 걸리면 콤보가 한 번도 이어지지 않아 배율은 늘 ×1이고, 점수는 그냥 터뜨린 귤 수입니다. 이때는 순위가 뒤집힙니다. 큰 네모 먼저가 ${w('big').score.mean}점, 아무거나 ${w('random').score.mean}점, 짝 먼저는 ${w('pairs').score.mean}점뿐이었습니다. 120초에 40번 남짓 둘 수 있으니, 셋을 잡을 수 있을 때 셋을 잡는 봇이 한 번에 더 많이 지웁니다.</p>
<p>이 실험의 솔직한 결론은 이렇습니다. "짝을 먼저"는 언제나 맞는 규칙이 아닙니다. 2초 안에 연달아 터뜨릴 만큼 빠른 사람에게 맞는 규칙이고, 콤보 제도가 바로 그걸 노리고 만들어졌습니다. 아직 판에 익숙하지 않아 연속을 못 잇는 사람은 큰 네모를 잡아도 손해가 거의 없습니다.</p>

<h2>큰 숫자를 먼저 치우면?</h2>
<p>큰 숫자 먼저 봇은 9와 8을 살릴 수 있을 때 살리자는 생각을 시험합니다. 빠른 속도에서 ${f('high').score.mean}점으로 짝 먼저보다 조금 낮았고, 터뜨린 귤도 ${f('high').cleared.mean}개로 ${f('pairs').cleared.mean}개보다 적었습니다. 짝이 있는데도 8을 빼내려고 세 개짜리 네모를 고를 때가 있어서 조금 손해를 봅니다. 차이가 작아서 나쁜 습관은 아니지만 도움이 되지도 않습니다.</p>

<h2>판 자체가 결정하는 몫</h2>
<p>봇은 머뭇거리지도 숫자를 잘못 보지도 않으니, 봇의 두 게임 사이에 생기는 차이는 순전히 판에서 옵니다. 그래서 운이 얼마나 작용하는지 재기에 좋습니다. 빠른 속도의 짝 먼저 봇은 하위 10% 게임이 ${f('pairs').score.p10}점 이하, 상위 10% 게임이 ${f('pairs').score.p90}점 이상이었고, 가장 못한 게임은 ${f('pairs').score.min}점, 가장 잘한 게임은 ${f('pairs').score.max}점이었습니다. 평균 ${f('pairs').score.mean}점에 표준편차는 ${f('pairs').score.sd}점이었습니다.</p>
<p>똑같은 실력이라도 숫자가 어떻게 깔렸느냐에 따라 어떤 판에서는 다른 판보다 1.5배를 얻을 수 있다는 뜻입니다. 연달아 한 두 판의 점수가 20~30점 차이 나는 건 실력이 늘었는지에 대해 거의 아무것도 말해 주지 않습니다. 한 판의 점수보다 여러 판의 평균이 훨씬 좋은 잣대이고, 랭킹도 마찬가지입니다. 최고 점수에는 실력과 함께 좋은 판의 몫도 들어 있습니다.</p>
<p>느린 모델은 반대쪽을 보여 줍니다. 한 번에 3초면 짝 먼저 봇의 점수는 대부분 ${w('pairs').score.p10}~${w('pairs').score.p90}점의 훨씬 좁은 범위에 모였습니다. 대부분의 게임에서 판보다 시계가 먼저 한계가 됐고, 한 번 터뜨릴 때마다 귤 하나당 똑같이 1점을 얻었기 때문입니다.</p>

<h2>휴대폰 판</h2>
<p>12×14 휴대폰 판도 거의 같은 그림입니다. 빠른 속도에서 짝 먼저 ${bot('mobile', 'pairs', 'fast').score.mean}점, 큰 네모 먼저 ${bot('mobile', 'big', 'fast').score.mean}점이었고, 느린 모델에서는 역시 큰 네모 먼저가 ${bot('mobile', 'big', 'slow').score.mean}점으로 짝 먼저(${bot('mobile', 'pairs', 'slow').score.mean}점)를 이겼습니다.</p>
${botTable('ko', 'mobile', 'size')}

<h2>봇이 알려 주지 못하는 것</h2>
<p>이 봇들은 가능한 묶음을 한눈에 전부 봅니다. 사람은 그렇지 않고, 다음 짝을 찾는 시간은 판이 얼마나 복잡한지, 얼마나 지쳤는지, 마우스인지 엄지인지에 따라 달라집니다. 그래서 속도 모델을 측정값이 아니라 가정이라고 밝혔고, 빠른 모델의 점수가 대부분의 사람이 내는 점수보다 높을 것도 그 때문입니다. 이 실험이 믿을 만하게 보여 주는 건 효과의 방향입니다. 속도마다 어떤 전략이 무엇을 이기는지, 그리고 왜 그런지입니다. 이를 습관으로 바꾸는 방법은 <a href="/ko/strategy">공략</a>에, 봇이 따른 규칙은 <a href="/ko/how-to-play">게임 방법</a>에 있습니다.</p>
${reproduceKo}
<p><a class="cta" href="/ko/">짝 먼저 규칙 직접 해 보기</a></p>`;
}

// ---------------- (c) 조합 ----------------
function combosEn() {
  const rows = [2, 3, 4, 5].flatMap((k) => comboK(k).map((c) => [k, `<b>${c.key}</b>`, c.orders, `${c.probPct}%`, bd.combosOnBoard[c.key] ?? 0]));
  const longer = D.combos.filter((c) => c.k >= 6);
  const top = bd.topCombos;
  const fb = bot('desktop', 'big', 'fast').sizeSharePct, fp = bot('desktop', 'pairs', 'fast').sizeSharePct;
  return `
<nav class="crumb"><a href="/">Home</a> › <a href="/analysis">Analysis</a> › Make-ten combinations</nav>
<h1>${ARTICLES.combos.en.h1}</h1>
<p class="lead">There are only so many ways to make ten from the numbers 1 to 9. This page lists every one of them from two to five numbers, works out exactly how likely each is, and then checks how often each actually turns up as a clearable box on ${n(bd.boards)} simulated Tangerine 10 boards.</p>

<h2>How many combinations exist</h2>
<p>Count the combinations as sets of numbers, ignoring order — 3+7 and 7+3 are the same thing on the board, because a box does not care which corner a number sits in. Using numbers from 1 to 9 and allowing repeats, there are exactly <b>${comboK(2).length}</b> ways to make ten with two numbers, <b>${comboK(3).length}</b> with three, <b>${comboK(4).length}</b> with four and <b>${comboK(5).length}</b> with five. That is ${comboK(2).length + comboK(3).length + comboK(4).length + comboK(5).length} combinations in the range a player will realistically use. Beyond five numbers there are ${longer.length} more, ending with ten ones, but as the board statistics show, boxes that large almost never exist on a real board.</p>
${table(['Size', 'Count', 'Combinations'], [2, 3, 4, 5].map((k) => [k, comboK(k).length, comboK(k).map((c) => c.key).join(', ')]).concat([['6–10', longer.length, longer.map((c) => c.key).join(', ')]]))}

<h2>The full table with odds and frequency</h2>
<p>The table below gives three numbers for each combination. <b>Orders</b> is how many different sequences of tiles produce it: 1+9 can appear as 1 then 9 or 9 then 1, so it has two, while 5+5 has only one. <b>Chance</b> is the exact probability that a group of that many random tiles is this combination, which is the number of orders divided by 9 to the power of the group size. <b>Per board</b> is how many times the combination appeared as a clearable rectangle on an average fresh desktop board in the simulation.</p>
${table(['Size', 'Combination', 'Orders', 'Chance for random tiles', 'Per fresh desktop board'], rows)}

<h2>Why 5+5 is half as common as every other pair</h2>
<p>All five pairs look equally simple, but they are not equally common. Each of 1+9, 2+8, 3+7 and 4+6 appeared about ${top[0].perBoard} times per board, while 5+5 appeared ${bd.combosOnBoard['5+5']} times — almost exactly half. The reason is the orders column. Two neighbouring cells make 1+9 if the first is 1 and the second is 9, or the other way round: two chances out of 81. They only make 5+5 if both are 5: one chance out of 81. The simulation reproduces that two-to-one ratio almost perfectly.</p>
<p>The same effect runs through the larger combinations. Among the triples, the four with three different numbers (1+2+7, 1+3+6, 1+4+5 and 2+3+5) each have six orders and each appeared about ${bd.combosOnBoard['1+2+7']} times per board. Triples with a repeated number, like 1+1+8 or 2+4+4, have only three orders and appeared about half as often. Among the fours, 1+2+3+4 is the only combination with four different numbers. It has 24 orders, which makes it by far the most common four-tangerine box at ${bd.combosOnBoard['1+2+3+4']} per board.</p>

<h2>The odds shrink fast with size</h2>
<p>Add up the chances for each size and you get the probability that a random group of that many tiles makes ten at all.</p>
${table(['Group size', 'Ways (ordered)', 'Chance it adds to ten'], [2, 3, 4, 5].map((k) => [k, comboK(k).reduce((a, c) => a + c.orders, 0), `<b>${probK(k).toFixed(3)}%</b>`]))}
${bars('Chance that a random group of tiles adds up to exactly ten', [2, 3, 4, 5].map((k) => [`${k} tiles`, probK(k), `${probK(k).toFixed(3)}%`]))}
<p>Two random tiles make ten one time in nine. Three random tiles do it about one time in twenty. By five tiles the chance has dropped to roughly one in five hundred. On top of that, a larger group also needs the right shape: on a fresh board, five tiles in a box means a 1×5 strip, since 5 is prime and nothing else fits. That double squeeze is why a fresh board offers dozens of pairs and usually no five-tangerine box at all.</p>

<h2>Which combinations really appear on a board</h2>
<p>Put the two effects together and you get the list of the most common boxes on a fresh desktop board. These twelve make up the large majority of all opening moves.</p>
${bars('Most common make-ten boxes on a fresh desktop board (per board)', top.map((c) => [c.key, c.perBoard, `${c.perBoard}`]))}
<p>Four pairs share the top spots, then 5+5, then the four triples with all-different numbers, then 1+2+3+4. Every combination that involves a repeated number sits lower than its all-different neighbours, for the same reason 5+5 trails the other pairs.</p>

<h2>How much of the board a short list covers</h2>
<p>Because a few combinations are so much more common than the rest, a short list covers most of what a fresh board offers. The table adds up the per-board frequencies above and divides by the total number of moves on an average desktop board (${totalMoves(bd).toFixed(2)}).</p>
${table(['Combinations you know', 'How many', 'Share of all opening moves they cover'], [
    ['The five pairs', 5, `<b>${coverage(bd)[0].toFixed(1)}%</b>`],
    ['+ the four all-different triples', 9, `<b>${coverage(bd)[1].toFixed(1)}%</b>`],
    ['+ the other four triples', 13, `<b>${coverage(bd)[2].toFixed(1)}%</b>`],
    ['+ 1+2+3+4', 14, `<b>${coverage(bd)[3].toFixed(1)}%</b>`],
  ])}
<p>The five pairs alone account for about ${coverage(bd)[0].toFixed(0)}% of the moves on an opening board. Adding just four triples lifts that to ${coverage(bd)[1].toFixed(0)}%, and with fourteen combinations in total you have seen ${coverage(bd)[3].toFixed(0)}% of everything a fresh board contains. The other ${comboK(4).length - 1 + comboK(5).length} combinations of four or five numbers, plus the ${D.combos.filter((c) => c.k >= 6).length} longer ones, share what is left. This is the strongest argument in the data for learning a small set well rather than a large set loosely: those extra ${comboK(4).length - 1 + comboK(5).length} combinations would add only a few percentage points of coverage while costing search time on every drag.</p>
<p>The coverage also explains a common experience in the first few games. New players often find the board "full of almost-tens" — a 4 next to a 5, a 3 next to an 8. Those near misses are not bad luck. With only one pair in nine adjacent links making exactly ten, eight in nine do not, and most of those land close to ten simply because most pairs of numbers from 1 to 9 add up to something between 6 and 14.</p>

<h2>Combinations during a game, not just at the start</h2>
<p>A fresh board has no holes. As tangerines are cleared, rectangles start to stretch over empty cells, and combinations that were impossible become reachable. The bot experiment records the size of every move each bot made. A bot that always picks the biggest available box made ${fb['2'] ?? 0}% of its moves with pairs, ${fb['3'] ?? 0}% with three tangerines, ${fb['4'] ?? 0}% with four and ${((fb['5'] || 0) + (fb['6'] || 0) + (fb['7'] || 0)).toFixed(2)}% with five or more — even while actively searching for large boxes. A bot that prefers pairs made ${fp['2'] ?? 0}% of its moves with pairs. Large combinations are not just rare at the start; they stay rare for the whole game.</p>

<h2>Using the list</h2>
<p>You do not need to memorise all ${D.combos.length} combinations. The data says the five pairs and four all-different triples cover almost everything a board offers. How to train your eye on those is covered in the <a href="/strategy">strategy guide</a>, and the full statistics of a fresh board, including how often each digit is stranded, are on the <a href="/board-statistics">board statistics</a> page.</p>
${reproduceEn}
<p><a class="cta" href="/">Spot some combinations</a></p>`;
}

function combosKo() {
  const rows = [2, 3, 4, 5].flatMap((k) => comboK(k).map((c) => [k, `<b>${c.key}</b>`, c.orders, `${c.probPct}%`, bd.combosOnBoard[c.key] ?? 0]));
  const longer = D.combos.filter((c) => c.k >= 6);
  const top = bd.topCombos;
  const fb = bot('desktop', 'big', 'fast').sizeSharePct, fp = bot('desktop', 'pairs', 'fast').sizeSharePct;
  return `
<nav class="crumb"><a href="/ko/">홈</a> › <a href="/ko/analysis">분석</a> › 합이 10인 조합</nav>
<h1>${ARTICLES.combos.ko.h1}</h1>
<p class="lead">1부터 9까지의 숫자로 10을 만드는 방법은 많지 않습니다. 이 페이지는 2~5개짜리 조합을 하나도 빠짐없이 나열하고, 각각이 나올 정확한 확률을 계산한 뒤, 시뮬레이션한 귤게임 판 ${n(bd.boards)}개에서 실제로 터뜨릴 수 있는 네모로 얼마나 자주 나타나는지 확인합니다.</p>

<h2>조합은 몇 가지인가</h2>
<p>순서는 무시하고 숫자의 묶음으로 셉니다. 네모는 숫자가 어느 구석에 있는지 따지지 않으니 3+7과 7+3은 판 위에서 같은 것입니다. 1~9 숫자로, 같은 숫자를 여러 번 써도 된다고 하면 10을 만드는 방법은 두 개로 정확히 <b>${comboK(2).length}가지</b>, 세 개로 <b>${comboK(3).length}가지</b>, 네 개로 <b>${comboK(4).length}가지</b>, 다섯 개로 <b>${comboK(5).length}가지</b>입니다. 실제로 쓸 만한 범위에서 모두 ${comboK(2).length + comboK(3).length + comboK(4).length + comboK(5).length}가지입니다. 여섯 개 이상도 1 열 개까지 ${longer.length}가지가 더 있지만, 판 통계에서 보듯 그렇게 큰 네모는 실제 판에 거의 없습니다.</p>
${table(['개수', '가짓수', '조합'], [2, 3, 4, 5].map((k) => [k, comboK(k).length, comboK(k).map((c) => c.key).join(', ')]).concat([['6–10', longer.length, longer.map((c) => c.key).join(', ')]]))}

<h2>확률과 빈도를 붙인 전체 표</h2>
<p>아래 표에는 조합마다 숫자 세 개가 붙어 있습니다. <b>순서</b>는 그 조합이 나오는 칸 순서의 가짓수입니다. 1+9는 1 다음 9, 9 다음 1로 두 가지지만 5+5는 한 가지뿐입니다. <b>확률</b>은 그만큼의 무작위 귤이 바로 이 조합일 정확한 확률로, 순서 가짓수를 9의 (개수)제곱으로 나눈 값입니다. <b>판당</b>은 시뮬레이션에서 새 PC 판 하나에 그 조합이 터뜨릴 수 있는 네모로 평균 몇 번 나왔는지입니다.</p>
${table(['개수', '조합', '순서', '무작위 귤일 때 확률', '새 PC 판당'], rows)}

<h2>5+5만 다른 짝의 절반인 이유</h2>
<p>다섯 짝은 똑같이 쉬워 보이지만 똑같이 자주 나오지는 않습니다. 1+9, 2+8, 3+7, 4+6은 판마다 ${top[0].perBoard}번쯤 나왔는데 5+5는 ${bd.combosOnBoard['5+5']}번으로 거의 정확히 절반이었습니다. 이유는 순서 칸에 있습니다. 나란한 두 칸이 1+9가 되려면 앞이 1이고 뒤가 9이거나 그 반대면 되니 81분의 2입니다. 5+5는 둘 다 5여야 하니 81분의 1입니다. 시뮬레이션은 이 2 대 1 비율을 거의 그대로 보여 줍니다.</p>
<p>더 큰 조합에서도 똑같습니다. 세 개짜리 중 숫자가 모두 다른 네 가지(1+2+7, 1+3+6, 1+4+5, 2+3+5)는 순서가 여섯 가지씩이고, 판마다 각각 ${bd.combosOnBoard['1+2+7']}번쯤 나왔습니다. 1+1+8이나 2+4+4처럼 같은 숫자가 겹치는 조합은 순서가 세 가지뿐이라 그 절반쯤 나왔습니다. 네 개짜리에서 숫자가 모두 다른 조합은 1+2+3+4 하나뿐입니다. 순서가 24가지라 판당 ${bd.combosOnBoard['1+2+3+4']}번으로 네 개짜리 중 단연 가장 흔합니다.</p>

<h2>크기가 커질수록 확률은 빠르게 준다</h2>
<p>크기별로 확률을 더하면, 그만큼의 무작위 귤이 합 10이 될 확률이 나옵니다.</p>
${table(['귤 개수', '경우의 수 (순서 있음)', '합이 10일 확률'], [2, 3, 4, 5].map((k) => [k, comboK(k).reduce((a, c) => a + c.orders, 0), `<b>${probK(k).toFixed(3)}%</b>`]))}
${bars('무작위 귤 묶음의 합이 정확히 10일 확률', [2, 3, 4, 5].map((k) => [`${k}개`, probK(k), `${probK(k).toFixed(3)}%`]))}
<p>무작위 귤 두 개는 아홉 번에 한 번 10이 됩니다. 세 개는 스무 번에 한 번쯤입니다. 다섯 개가 되면 오백 번에 한 번 정도로 떨어집니다. 게다가 큰 묶음은 모양도 맞아야 합니다. 새 판에서 귤 다섯 개가 든 네모는 5가 소수라 1×5 한 줄밖에 없습니다. 이 이중 조건 때문에 새 판에는 짝이 수십 개 있어도 다섯 개짜리 네모는 대개 하나도 없습니다.</p>

<h2>판에 실제로 나오는 조합</h2>
<p>두 효과를 합치면 새 PC 판에서 가장 흔한 네모 목록이 나옵니다. 이 열두 가지가 첫 묶음의 대부분을 차지합니다.</p>
${bars('새 PC 판에서 가장 흔한 합 10 네모 (판당)', top.map((c) => [c.key, c.perBoard, `${c.perBoard}`]))}
<p>짝 네 가지가 맨 위를 나눠 갖고, 그다음 5+5, 숫자가 모두 다른 세 개짜리 네 가지, 그리고 1+2+3+4 순입니다. 같은 숫자가 겹치는 조합은 모두 숫자가 다른 이웃 조합보다 아래에 있습니다. 5+5가 다른 짝보다 뒤처지는 것과 같은 이유입니다.</p>

<h2>짧은 목록으로 판의 얼마를 덮을 수 있나</h2>
<p>몇몇 조합이 나머지보다 훨씬 흔하기 때문에, 짧은 목록만으로 새 판의 대부분을 덮을 수 있습니다. 아래 표는 위의 판당 빈도를 더해 새 PC 판의 평균 전체 묶음 수(${totalMoves(bd).toFixed(2)}개)로 나눈 것입니다.</p>
${table(['알고 있는 조합', '가짓수', '첫 판 전체 묶음 중 차지하는 비율'], [
    ['짝 다섯 가지', 5, `<b>${coverage(bd)[0].toFixed(1)}%</b>`],
    ['+ 숫자가 모두 다른 세 개짜리 네 가지', 9, `<b>${coverage(bd)[1].toFixed(1)}%</b>`],
    ['+ 나머지 세 개짜리 네 가지', 13, `<b>${coverage(bd)[2].toFixed(1)}%</b>`],
    ['+ 1+2+3+4', 14, `<b>${coverage(bd)[3].toFixed(1)}%</b>`],
  ])}
<p>짝 다섯 가지만으로 첫 판 묶음의 ${coverage(bd)[0].toFixed(0)}%쯤을 차지합니다. 세 개짜리 네 가지만 더하면 ${coverage(bd)[1].toFixed(0)}%가 되고, 모두 열네 가지면 새 판에 있는 것의 ${coverage(bd)[3].toFixed(0)}%를 본 셈입니다. 나머지 네 개·다섯 개짜리 ${comboK(4).length - 1 + comboK(5).length}가지와 그보다 긴 ${D.combos.filter((c) => c.k >= 6).length}가지가 남은 몫을 나눠 갖습니다. 많이 대충 아는 것보다 적게 확실히 아는 게 낫다는 가장 강한 근거가 이 숫자입니다. 그 ${comboK(4).length - 1 + comboK(5).length}가지를 더 외워도 몇 %포인트밖에 늘지 않는데, 드래그할 때마다 찾는 시간은 늘어납니다.</p>
<p>처음 몇 판에서 흔히 느끼는 것도 이것으로 설명됩니다. 처음 하는 사람은 판이 "10이 될 뻔한 것투성이"라고 느끼곤 합니다. 5 옆의 4, 8 옆의 3 같은 것들입니다. 운이 나빠서가 아닙니다. 이웃한 두 칸이 정확히 10이 될 확률은 9분의 1이니 아홉 중 여덟은 10이 아니고, 1~9 두 숫자의 합은 대부분 6에서 14 사이라 그 여덟도 10 근처에 몰립니다.</p>

<h2>시작할 때만이 아니라 게임 내내</h2>
<p>새 판에는 빈칸이 없습니다. 귤이 터지면서 네모가 빈칸을 가로질러 늘어나고, 처음엔 불가능했던 조합이 가능해집니다. 봇 실험은 봇이 둔 모든 수의 크기를 기록했습니다. 늘 가장 큰 네모를 고르는 봇조차 짝이 ${fb['2'] ?? 0}%, 세 개짜리 ${fb['3'] ?? 0}%, 네 개짜리 ${fb['4'] ?? 0}%, 다섯 개 이상 ${((fb['5'] || 0) + (fb['6'] || 0) + (fb['7'] || 0)).toFixed(2)}%였습니다. 일부러 큰 네모를 찾아다녔는데도 그렇습니다. 짝을 먼저 고르는 봇은 ${fp['2'] ?? 0}%를 짝으로 터뜨렸습니다. 큰 조합은 처음에만 드문 게 아니라 게임 내내 드뭅니다.</p>

<h2>이 목록을 쓰는 법</h2>
<p>${D.combos.length}가지를 전부 외울 필요는 없습니다. 데이터로 보면 짝 다섯 가지와 숫자가 모두 다른 세 개짜리 네 가지가 판에 나오는 거의 전부입니다. 이것들을 눈에 익히는 방법은 <a href="/ko/strategy">공략</a>에, 숫자별로 얼마나 자주 고립되는지까지 담은 새 판 통계는 <a href="/ko/board-statistics">판 통계</a>에 있습니다.</p>
${reproduceKo}
<p><a class="cta" href="/ko/">조합 찾으러 가기</a></p>`;
}

export const articleBody = { board: { en: boardEn, ko: boardKo }, bots: { en: botsEn, ko: botsKo }, combos: { en: combosEn, ko: combosKo } };

// 분석 목록 페이지와 홈에서 쓰는 한 줄 요약(수치 포함)
export function teaser(id, lang) {
  const fp = bot('desktop', 'pairs', 'fast'), fbg = bot('desktop', 'big', 'fast'), wb = bot('desktop', 'big', 'slow'), wp = bot('desktop', 'pairs', 'slow');
  const t = {
    board: {
      en: `A fresh desktop board offers ${bd.moves.mean} moves on average, ${bd.pairs.mean} of them adjacent pairs. ${digit(bd, 9).noMoveAtStartPct}% of nines start with no 1 beside them.`,
      ko: `새 PC 판에는 평균 ${bd.moves.mean}개의 묶음이 있고 그중 ${bd.pairs.mean}개가 붙어 있는 짝입니다. 9의 ${digit(bd, 9).noMoveAtStartPct}%는 옆에 1 없이 시작합니다.`,
    },
    bots: {
      en: `With a fast hand, pairs-first averaged ${fp.score.mean} points against ${fbg.score.mean} for biggest-box-first. At 3 seconds a move the order flips: ${wb.score.mean} vs ${wp.score.mean}.`,
      ko: `손이 빠르면 짝 먼저가 평균 ${fp.score.mean}점, 큰 네모 먼저가 ${fbg.score.mean}점. 한 번에 3초가 걸리면 순서가 뒤집혀 ${wb.score.mean}점 대 ${wp.score.mean}점.`,
    },
    combos: {
      en: `${comboK(2).length + comboK(3).length + comboK(4).length + comboK(5).length} combinations of two to five numbers make ten. Two random tiles do it ${probK(2).toFixed(1)}% of the time, five only ${probK(5).toFixed(2)}%.`,
      ko: `2~5개 숫자로 10을 만드는 조합은 ${comboK(2).length + comboK(3).length + comboK(4).length + comboK(5).length}가지. 무작위 귤 두 개는 ${probK(2).toFixed(1)}%, 다섯 개는 ${probK(5).toFixed(2)}% 확률로 10이 됩니다.`,
    },
  };
  return t[id][lang];
}
