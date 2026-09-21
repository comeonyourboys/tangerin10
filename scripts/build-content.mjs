// 콘텐츠 페이지 생성 (게임 규칙·전략·FAQ). 실행: node scripts/build-content.mjs
// 게임 규칙은 public/index.html 의 실제 로직에서 확인한 값만 사용한다.
//   보드 1~9 무작위 · 데스크톱 10x17 / 모바일 12x14 · 제한 120초
//   드래그 사각형 안 숫자 합이 정확히 10 이어야 제거
//   점수 = floor(제거한 타일 수 × 배수), 배수: 콤보 2~4 x1.5, 5~9 x2, 10~19 x3, 20+ x5
//   콤보는 마지막 제거 후 2초가 지나면 0 으로 초기화
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public');
const SITE = { url: 'https://tangerin10.web.app', name: 'Tangerine 10', adsense: 'ca-pub-5479403345572412', gsv: '8nUCFYxTph7TOTN0ZC0zWvamYgyQMd026qCLSBL9YgE', coupang: { tracking: 'AF7330023', id: 1017186 } };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jsonld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

const CSS = `
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Outfit',-apple-system,BlinkMacSystemFont,sans-serif;color:#1a1a1a;background:#fff;line-height:1.7;-webkit-text-size-adjust:100%;}
a{color:#f97316;}
.wrap{max-width:780px;margin:0 auto;padding:0 20px;}
.topbar{border-bottom:1px solid #f0f0f0;position:sticky;top:0;background:rgba(255,255,255,.95);backdrop-filter:blur(8px);z-index:20;}
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;height:56px;gap:14px;}
.logo{display:flex;align-items:baseline;gap:5px;text-decoration:none;white-space:nowrap;}
.logo-t{font-size:16px;font-weight:600;color:#999;}
.logo-10{font-size:22px;font-weight:900;color:#f97316;letter-spacing:-1px;}
.nav{display:flex;gap:2px;flex-wrap:wrap;justify-content:flex-end;}
.nav a{font-size:13px;font-weight:600;color:#777;text-decoration:none;padding:6px 9px;border-radius:8px;white-space:nowrap;}
.nav a:hover,.nav a.on{background:#fff4ea;color:#ea580c;}
.crumb{font-size:12px;color:#aaa;margin:16px 0 4px;}
.crumb a{color:#f97316;text-decoration:none;}
h1{font-size:clamp(25px,5vw,32px);font-weight:900;letter-spacing:-.6px;margin:14px 0 8px;line-height:1.25;}
.lead{font-size:16px;color:#666;margin-bottom:26px;line-height:1.75;}
h2{font-size:20px;font-weight:800;margin:34px 0 12px;letter-spacing:-.3px;}
h3{font-size:16px;font-weight:700;margin:22px 0 8px;}
p{font-size:16px;color:#333;margin-bottom:14px;}
ul,ol{margin:0 0 16px 20px;}
li{font-size:15.5px;color:#333;margin-bottom:8px;line-height:1.7;}
.box{background:#fff8f2;border:1px solid #ffe4cc;border-radius:14px;padding:18px 20px;margin:18px 0;}
.box p:last-child,.box ul:last-child,.box li:last-child{margin-bottom:0;}
.box strong{color:#ea580c;}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:15px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #f0f0f0;}
th,td{padding:11px 14px;text-align:left;border-bottom:1px solid #f5f5f5;}
th{background:#fafafa;font-weight:700;font-size:13.5px;color:#777;}
tr:last-child th,tr:last-child td{border-bottom:none;}
td b{color:#ea580c;}
.tbl-wrap{overflow-x:auto;}
.cta{display:inline-block;background:#f97316;color:#fff;font-weight:800;font-size:16px;padding:13px 26px;border-radius:999px;text-decoration:none;margin:10px 0 6px;}
.cta:hover{background:#ea580c;}
.faq-q{font-weight:800;font-size:16.5px;margin:24px 0 6px;}
.ad-wrap{margin:34px 0 0;}
.disclose{font-size:11px;color:#c4c4c4;text-align:center;margin-top:6px;}
footer{border-top:1px solid #f0f0f0;margin-top:36px;padding:24px 0 46px;}
.ftr-nav{display:flex;flex-wrap:wrap;justify-content:center;gap:2px 0;}
.ftr-nav a{font-size:12.5px;color:#888;text-decoration:none;padding:4px 9px;}
.ftr-note{font-size:11.5px;color:#bbb;text-align:center;margin-top:10px;line-height:1.8;}
@media(max-width:600px){.nav a{font-size:12px;padding:5px 7px;}p,li{font-size:15px;}}
`;

const NAV = [['/', 'Play'], ['/how-to-play', 'How to Play'], ['/strategy', 'Strategy'], ['/faq', 'FAQ']];

function layout({ title, desc, path, body, ld = [] }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE.url}${path}">
<meta name="robots" content="index, follow">
<meta name="google-site-verification" content="${SITE.gsv}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE.url}${path}">
<meta property="og:image" content="${SITE.url}/og-tangerin10.png?v=7">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Tangerine 10 number puzzle">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE.url}/og-tangerin10.png?v=7">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍊</text></svg>">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${CSS}</style>
${ld.map(jsonld).join('\n')}
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adsense}" crossorigin="anonymous"></script>
</head>
<body>
<header class="topbar"><div class="wrap">
  <a class="logo" href="/"><span class="logo-t">🍊 Tangerine</span><span class="logo-10">10</span></a>
  <nav class="nav">${NAV.map(([h, t]) => `<a href="${h}"${h === path ? ' class="on"' : ''}>${t}</a>`).join('')}</nav>
</div></header>
<main class="wrap">
${body}
</main>
<div class="wrap ad-wrap"><div><script src="https://ads-partners.coupang.com/g.js"></script><script>new PartnersCoupang.G({"id":${SITE.coupang.id},"template":"carousel","trackingCode":"${SITE.coupang.tracking}","width":"100%","height":"140","tsource":""});</script></div>
<p class="disclose">This page participates in the Coupang Partners program and may earn a commission.</p></div>
<footer><div class="wrap">
  <div class="ftr-nav">${NAV.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}<a href="/privacy">Privacy Policy</a></div>
  <p class="ftr-note">Tangerine 10 is a free browser puzzle game. No sign-up, no download. © ${new Date().getFullYear()} Tangerine 10</p>
</div></footer>
</body>
</html>`;
}

// ---------- How to Play ----------
const howBody = `
<nav class="crumb"><a href="/">Home</a> › How to Play</nav>
<h1>How to Play Tangerine 10</h1>
<p class="lead">Tangerine 10 is a two-minute number puzzle. You drag a box around tangerines whose numbers add up to exactly ten, and they pop. Here is every rule, including the ones the game never spells out.</p>

<h2>The board</h2>
<p>Every game starts with a fresh grid of tangerines. Each one carries a number from 1 to 9, drawn at random, so no two games are ever the same. The grid size depends on your screen.</p>
<div class="tbl-wrap"><table><tbody>
<tr><th>Desktop</th><td>10 rows × 17 columns — <b>170 tangerines</b></td></tr>
<tr><th>Mobile</th><td>12 rows × 14 columns — <b>168 tangerines</b></td></tr>
<tr><th>Numbers</th><td>1 to 9, randomly distributed</td></tr>
<tr><th>Time limit</th><td><b>120 seconds</b></td></tr>
</tbody></table></div>

<h2>The one rule that matters</h2>
<p>Press and drag to draw a rectangle across the board. Every tangerine whose center falls inside that rectangle gets selected. When you release, the game adds up the selected numbers. If the total is <b>exactly 10</b>, those tangerines pop and you score. If it is 9, or 11, or anything else, nothing happens and you try again.</p>
<div class="box">
  <p><strong>Exactly ten.</strong> Not "ten or less", not "a multiple of ten". A selection of 3 + 7 clears. A selection of 3 + 7 + 1 does not, and neither does 3 + 6.</p>
</div>
<p>Because the selection is a rectangle, the shape of your drag matters as much as the numbers. Two tangerines sitting diagonally from each other can be caught by one box, but that box will also catch whatever sits in the other two corners. Empty spaces left by tangerines you already popped are ignored, which is why the board gets easier to work with as it thins out.</p>

<h2>How scoring works</h2>
<p>Your score is not the sum of the numbers. It is the <b>number of tangerines you clear</b>, multiplied by your current combo bonus.</p>
<div class="tbl-wrap"><table><tbody>
<tr><th>Score per clear</th><td>tangerines cleared × combo multiplier, rounded down</td></tr>
<tr><th>Clearing 1 + 9</th><td>2 tangerines → 2 points at base rate</td></tr>
<tr><th>Clearing 1 + 2 + 3 + 4</th><td>4 tangerines → 4 points at base rate</td></tr>
</tbody></table></div>
<p>This is the single most important thing to understand about the game. A pair that adds to ten is worth two points. Four small numbers that add to ten are worth four. The numbers themselves are irrelevant to your score — only how many tangerines you removed.</p>

<h2>The combo multiplier</h2>
<p>Clear tangerines in quick succession and a combo counter builds. The multiplier climbs in steps, and it is generous at the top end.</p>
<div class="tbl-wrap"><table>
<thead><tr><th>Combo count</th><th>Multiplier</th><th>Four tangerines are worth</th></tr></thead>
<tbody>
<tr><td>1</td><td>×1</td><td>4 points</td></tr>
<tr><td>2 – 4</td><td><b>×1.5</b></td><td>6 points</td></tr>
<tr><td>5 – 9</td><td><b>×2</b></td><td>8 points</td></tr>
<tr><td>10 – 19</td><td><b>×3</b></td><td>12 points</td></tr>
<tr><td>20 and above</td><td><b>×5</b></td><td>20 points</td></tr>
</tbody></table></div>
<div class="box">
  <p><strong>The combo resets after two seconds.</strong> Every successful clear restarts a two-second countdown. Pause longer than that to look for a better move and your streak drops to zero, taking the multiplier with it.</p>
</div>
<p>That two-second window is the real difficulty of Tangerine 10. Finding matches is easy. Finding the next one before the timer runs out, twenty times in a row, is not.</p>

<h2>Controls</h2>
<ul>
  <li><b>Mouse:</b> hold the left button, drag a box, release to submit the selection.</li>
  <li><b>Touch:</b> press and drag with one finger. The board does not scroll while you drag, so you can start a box anywhere.</li>
  <li><b>Restart:</b> the circular arrow button in the top bar starts a new board immediately.</li>
</ul>

<h2>When the game ends</h2>
<p>At 120 seconds the board locks and your score is final. The game shows how many tangerines you cleared, saves the run to your local history, and submits the score to the global leaderboard. Your history lives in your own browser, so clearing site data will erase it.</p>
<p><a class="cta" href="/">Play Tangerine 10</a></p>
<p>New to the game? Read the <a href="/strategy">strategy guide</a> next — it explains why chasing big rectangles is usually the wrong instinct.</p>
`;

// ---------- Strategy ----------
const stratBody = `
<nav class="crumb"><a href="/">Home</a> › Strategy</nav>
<h1>Tangerine 10 Strategy Guide</h1>
<p class="lead">Most players plateau around the same score because they optimize the wrong thing. Here is what actually moves the number, derived from how the game calculates points.</p>

<h2>Speed beats size</h2>
<p>The instinct is to hunt for a big rectangle — five or six tangerines adding to ten feels like a jackpot. It usually is not. Because score equals tiles cleared times your multiplier, the multiplier does far more work than the tile count.</p>
<div class="tbl-wrap"><table>
<thead><tr><th>Approach</th><th>Over 10 seconds</th><th>Score</th></tr></thead>
<tbody>
<tr><td>Five careful clears of 4 tiles, combo broken each time</td><td>20 tiles</td><td>20 points</td></tr>
<tr><td>Ten fast clears of 2 tiles, combo held at ×3</td><td>20 tiles</td><td><b>60 points</b></td></tr>
</tbody></table></div>
<p>Same number of tangerines removed, three times the score. The lesson is blunt: take the match you can see right now, not the better one you might find in four seconds.</p>

<h2>Learn the five pairs</h2>
<p>There are exactly five ways two numbers make ten. Burn them into memory so you stop calculating.</p>
<div class="box">
  <p><strong>1 + 9 · 2 + 8 · 3 + 7 · 4 + 6 · 5 + 5</strong></p>
  <p>Pairs are the fastest clears in the game. They need the smallest rectangle, they are the easiest to spot, and at a ×5 multiplier a pair is worth ten points — more than a four-tile clear at base rate.</p>
</div>
<p>Once pairs are automatic, add the common triples: 1+2+7, 1+3+6, 1+4+5, 2+3+5, and the all-purpose 8+1+1. Anything longer than four tiles is rarely worth the search time.</p>

<h2>Scan in strips, not in circles</h2>
<p>Your eyes waste time wandering the whole grid. Work one horizontal band at a time, two or three rows deep, and sweep left to right. Within a band the rectangles you need are short and wide, which is the shape your hand draws most naturally. When a band dries up, move down a band rather than jumping back to the top.</p>

<h2>Protect the streak, then rebuild</h2>
<p>Two seconds is not long. Treat your combo as a resource with a visible cost: once you are at combo 10 or higher, a single hesitation throws away a ×3 or ×5 bonus that took twenty clears to build.</p>
<ul>
  <li>When the streak is alive, take any legal match, however small.</li>
  <li>When the streak has just broken, that is the moment to spend three or four seconds finding a dense cluster and setting up your next run.</li>
  <li>Near the 120-second mark, stop planning entirely and clear whatever you can reach.</li>
</ul>

<h2>Use the holes</h2>
<p>Cleared tangerines leave gaps, and gaps are ignored by your selection box. This is the quiet mechanic that makes late-game boards easier than early ones. A 5 and a 5 sitting six columns apart are unmatchable at the start; after the tiles between them are gone, one wide rectangle catches both. When you are stuck, look for two numbers that already have an empty corridor between them.</p>

<h2>Give up on nines early</h2>
<p>A 9 can only ever pair with a 1. If no 1 sits in a workable rectangle, that 9 is dead weight for the rest of the run. The same applies in weaker form to 8s and 7s. Clear the low and middle numbers that combine flexibly — 3s, 4s, 5s, 6s — and let the stranded high numbers sit. Spending ten seconds rescuing one 9 costs you a combo worth far more.</p>

<h2>Play on the bigger board when you can</h2>
<p>Desktop gives you 170 tangerines across 17 columns; mobile gives 168 across 14. The wider desktop grid puts more candidates inside any given horizontal sweep, which means less scrolling of the eyes and more matches per second. If you are chasing a leaderboard place, play on a laptop.</p>

<h2>A realistic progression</h2>
<p>Do not compare your first run to the leaderboard. Most players follow roughly this curve: the first few games are spent learning the drag, then pairs become automatic, then the combo clicks and the score roughly doubles. The jump from decent to good is almost entirely about holding the streak, not about spotting cleverer combinations.</p>
<p><a class="cta" href="/">Try it now</a></p>
<p>If any rule here is unfamiliar, the <a href="/how-to-play">rules page</a> covers the mechanics in full.</p>
`;

// ---------- FAQ ----------
const faqs = [
  ['Is Tangerine 10 free?', 'Yes. The game runs in your browser with no sign-up, no download, and no payment. The site is supported by advertising.'],
  ['Do I need to install anything?', 'No. Tangerine 10 is a web page. It works in any modern browser on desktop, tablet, or phone. Adding it to your home screen makes it feel like an app, but nothing is installed.'],
  ['How long is one game?', 'Exactly 120 seconds. The timer starts when you press Start and the board locks the moment it hits zero.'],
  ['Does the sum have to be exactly ten?', 'Yes, exactly ten. A selection adding to 9 or 11 does nothing at all. The game does not clear partial matches.'],
  ['Why did my selection not clear?', 'Three usual reasons. The total was not exactly ten, the rectangle caught an extra tangerine you did not notice, or a tangerine you expected to be inside had its center just outside the box. Selection is decided by the center of each tangerine, not by whether the box touches its edge.'],
  ['How is the score calculated?', 'Score equals the number of tangerines you clear, multiplied by your combo bonus and rounded down. The values on the tangerines do not affect the score, only how many you remove.'],
  ['How does the combo work?', 'Each successful clear adds one to your combo and restarts a two-second timer. Combo 2 to 4 gives ×1.5, 5 to 9 gives ×2, 10 to 19 gives ×3, and 20 or more gives ×5. Go two seconds without clearing and the combo resets to zero.'],
  ['Is the board the same every game?', 'No. Every tangerine is assigned a random number from 1 to 9 at the start of each game, so every board is different.'],
  ['Is it possible to clear the whole board?', 'In practice, no. Numbers run out in awkward combinations long before the grid empties, and 120 seconds is short. Clearing the board is not the goal; clearing as many tangerines as possible is.'],
  ['Where are my scores saved?', 'Your personal history is stored in your own browser. The leaderboard keeps the top global scores on a server. Clearing your browser data removes your local history but not your leaderboard entry.'],
  ['Can I play offline?', 'The game itself is simple enough to run without a connection once loaded, but the leaderboard needs the internet to submit and show scores.'],
  ['What is this game called elsewhere?', 'Puzzles built on the same idea — drag a rectangle over numbers that add to ten — are often called the apple game or fruit box. Tangerine 10 uses tangerines, a two-minute limit, and a combo multiplier that rewards continuous play.'],
];
const faqBody = `
<nav class="crumb"><a href="/">Home</a> › FAQ</nav>
<h1>Frequently Asked Questions</h1>
<p class="lead">Everything players ask about Tangerine 10 — the rules, the scoring, and the things that look like bugs but are not.</p>
${faqs.map(([q, a]) => `<p class="faq-q">${esc(q)}</p><p>${esc(a)}</p>`).join('\n')}
<h2>Still stuck?</h2>
<p>The <a href="/how-to-play">rules page</a> walks through the board, the selection box, and the combo timer in detail. The <a href="/strategy">strategy guide</a> explains why fast small clears outscore slow big ones.</p>
<p><a class="cta" href="/">Play Tangerine 10</a></p>
`;

mkdirSync(OUT, { recursive: true });
const pages = [
  ['how-to-play.html', layout({ title: 'How to Play Tangerine 10 — Rules, Scoring and Combos', desc: 'Complete rules for Tangerine 10: the 120-second timer, the exactly-ten selection rule, how score is calculated from tiles cleared, and how the combo multiplier works.', path: '/how-to-play', body: howBody, ld: [{ '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to play Tangerine 10', description: 'Drag a rectangle over tangerines whose numbers add up to exactly ten to clear them before the 120-second timer ends.', step: [{ '@type': 'HowToStep', name: 'Start the game', text: 'Press Start. A grid of tangerines numbered 1 to 9 appears and a 120-second timer begins.' }, { '@type': 'HowToStep', name: 'Drag a selection box', text: 'Press and drag to draw a rectangle. Every tangerine whose center falls inside is selected.' }, { '@type': 'HowToStep', name: 'Make exactly ten', text: 'Release when the selected numbers total exactly ten. The tangerines pop and you score.' }, { '@type': 'HowToStep', name: 'Keep the combo alive', text: 'Clear again within two seconds to build the combo multiplier, which reaches five times at combo twenty.' }] }] })],
  ['strategy.html', layout({ title: 'Tangerine 10 Strategy — How to Score Higher', desc: 'Why fast pairs beat big rectangles in Tangerine 10, the five number pairs to memorize, how to scan the board, and how to protect a combo streak.', path: '/strategy', body: stratBody, ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: 'Tangerine 10 Strategy Guide', description: 'Scoring math and practical tactics for the Tangerine 10 number puzzle.', inLanguage: 'en', mainEntityOfPage: SITE.url + '/strategy', author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url } }] })],
  ['faq.html', layout({ title: 'Tangerine 10 FAQ — Rules, Scoring and Common Questions', desc: 'Answers to common Tangerine 10 questions: game length, why a selection did not clear, how scoring and combos work, and where scores are saved.', path: '/faq', body: faqBody, ld: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] })],
];
for (const [name, html] of pages) writeFileSync(join(OUT, name), html);

const today = new Date().toISOString().slice(0, 10);
const urls = [['/', '1.0', 'weekly'], ['/how-to-play', '0.8', 'monthly'], ['/strategy', '0.8', 'monthly'], ['/faq', '0.7', 'monthly'], ['/privacy.html', '0.2', 'yearly']];
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([l, p, f]) => `  <url><loc>${SITE.url}${l}</loc><lastmod>${today}</lastmod><changefreq>${f}</changefreq><priority>${p}</priority></url>`).join('\n')}\n</urlset>\n`);

const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log('✔ 콘텐츠 페이지 생성');
for (const [name, html] of pages) console.log(`  ${name.padEnd(18)} 본문 ${strip(html).length.toLocaleString()}자`);
console.log(`  sitemap.xml 항목 ${urls.length}개`);
