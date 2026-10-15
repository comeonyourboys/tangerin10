// 콘텐츠 페이지 생성 (게임 규칙·전략·FAQ). 실행: node scripts/build-content.mjs
// 게임 규칙은 public/index.html 의 실제 로직에서 확인한 값만 사용한다.
//   보드 1~9 무작위 · 데스크톱 10x17 / 모바일 12x14 · 제한 120초
//   드래그 사각형 안 숫자 합이 정확히 10 이어야 제거
//   점수 = floor(제거한 타일 수 × 배수), 배수: 콤보 2~4 x1.5, 5~9 x2, 10~19 x3, 20+ x5
//   콤보는 마지막 제거 후 2초가 지나면 0 으로 초기화
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { howKo, stratKo, faqsKo, aboutKo, contactKo, privacyKo } from './content-ko.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public');
const SITE = { url: 'https://tangerin10.web.app', name: 'Tangerine 10', gsv: ['8nUCFYxTph7TOTN0ZC0zWvamYgyQMd026qCLSBL9YgE', 'WjzFs7iu4kDSzcJKM5QyAqGDAqx9J1P0uj-Ry4z1_NU'], adfit: 'DAN-vwzzWFnt83j2lDmM' }; // adfit: 카카오 애드핏 하단 320x50
// 카카오 애드핏 320x50 한 칸을 본문 맨 아래에 둔다. 단위 ID 가 비어 있으면 아무것도 출력하지 않는다.
const adfit = (unit) => unit ? `<div class="wrap ad-wrap" style="display:flex;justify-content:center"><ins class="kakao_ad_area" style="display:none;" data-ad-unit="${unit}" data-ad-width="320" data-ad-height="50"></ins><script async src="https://t1.kakaocdn.net/kas/static/ba.min.js"></script></div>` : '';
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
.r-sum{background:#fff8f2;border:1px solid #ffe4cc;border-radius:12px;padding:12px 16px;font-size:14.5px;color:#7a4a1f;}
.r-empty{color:#999;}
`;

const NAV = {
  en: [['/', 'Play'], ['/how-to-play', 'How to Play'], ['/strategy', 'Strategy'], ['/faq', 'FAQ'], ['/records', 'Records'], ['/about', 'About'], ['/contact', 'Contact']],
  ko: [['/ko/', '게임'], ['/ko/how-to-play', '게임 방법'], ['/ko/strategy', '공략'], ['/ko/faq', 'FAQ'], ['/ko/records', '기록'], ['/ko/about', '소개'], ['/ko/contact', '문의']],
};
const T = {
  en: { privacy: 'Privacy Policy', privacyPath: '/privacy', note: 'Tangerine 10 is a free browser puzzle game. No sign-up, no download.', locale: 'en_US', other: '한국어', alt: 'Tangerine 10 number puzzle' },
  ko: { privacy: '개인정보처리방침', privacyPath: '/ko/privacy', note: 'Tangerine 10은 무료 브라우저 퍼즐 게임입니다. 회원가입·설치 없이 바로 할 수 있습니다.', locale: 'ko_KR', other: 'English', alt: '귤게임 Tangerine 10 숫자 퍼즐' },
};

// alt: 다른 언어 판의 경로. 있으면 hreflang 과 언어 전환 링크를 붙인다.
function layout({ title, desc, path, body, ld = [], lang = 'en', alt = '', noindex = false }) {
  const t = T[lang], nav = NAV[lang], abs = (p) => SITE.url + p, other = lang === 'en' ? 'ko' : 'en';
  const hreflang = alt ? `<link rel="alternate" hreflang="${lang}" href="${abs(path)}"><link rel="alternate" hreflang="${other}" href="${abs(alt)}"><link rel="alternate" hreflang="x-default" href="${abs(lang === 'en' ? path : alt)}">` : '';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#f97316">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${abs(path)}">
${hreflang}
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow'}">
${SITE.gsv.map((g) => `<meta name="google-site-verification" content="${g}">`).join('\n')}
<meta property="og:type" content="article">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${abs(path)}">
<meta property="og:image" content="${SITE.url}/og-tangerin10.png?v=7">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${t.alt}">
<meta property="og:locale" content="${t.locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE.url}/og-tangerin10.png?v=7">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" href="/favicon.png" sizes="512x512"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${CSS}</style>
${ld.map(jsonld).join('\n')}
</head>
<body>
<header class="topbar"><div class="wrap">
  <a class="logo" href="${nav[0][0]}"><span class="logo-t">🍊 Tangerine</span><span class="logo-10">10</span></a>
  <nav class="nav">${nav.map(([h, n]) => `<a href="${h}"${h === path ? ' class="on"' : ''}>${n}</a>`).join('')}${alt ? `<a href="${alt}" hreflang="${other}">${t.other}</a>` : ''}</nav>
</div></header>
<main class="wrap">
${body}
</main>
${adfit(SITE.adfit)}
<footer><div class="wrap">
  <div class="ftr-nav">${nav.map(([h, n]) => `<a href="${h}">${n}</a>`).join('')}<a href="${t.privacyPath}">${t.privacy}</a>${alt ? `<a href="${alt}" hreflang="${other}">${t.other}</a>` : ''}</div>
  <p class="ftr-note">${t.note} © ${new Date().getFullYear()} Tangerine 10</p>
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
  ['how-to-play.html', layout({ title: 'How to Play Tangerine 10 — Rules, Scoring and Combos', desc: 'Complete rules for Tangerine 10: the 120-second timer, the exactly-ten selection rule, how score is calculated from tiles cleared, and how the combo multiplier works.', path: '/how-to-play', alt: '/ko/how-to-play', body: howBody, ld: [{ '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to play Tangerine 10', description: 'Drag a rectangle over tangerines whose numbers add up to exactly ten to clear them before the 120-second timer ends.', step: [{ '@type': 'HowToStep', name: 'Start the game', text: 'Press Start. A grid of tangerines numbered 1 to 9 appears and a 120-second timer begins.' }, { '@type': 'HowToStep', name: 'Drag a selection box', text: 'Press and drag to draw a rectangle. Every tangerine whose center falls inside is selected.' }, { '@type': 'HowToStep', name: 'Make exactly ten', text: 'Release when the selected numbers total exactly ten. The tangerines pop and you score.' }, { '@type': 'HowToStep', name: 'Keep the combo alive', text: 'Clear again within two seconds to build the combo multiplier, which reaches five times at combo twenty.' }] }] })],
  ['strategy.html', layout({ title: 'Tangerine 10 Strategy — How to Score Higher', desc: 'Why fast pairs beat big rectangles in Tangerine 10, the five number pairs to memorize, how to scan the board, and how to protect a combo streak.', path: '/strategy', alt: '/ko/strategy', body: stratBody, ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: 'Tangerine 10 Strategy Guide', description: 'Scoring math and practical tactics for the Tangerine 10 number puzzle.', inLanguage: 'en', mainEntityOfPage: SITE.url + '/strategy', author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url } }] })],
  ['about.html', layout({ title: 'About Tangerine 10 — Who Makes This Game', desc: 'Who builds Tangerine 10, why a 120-second make-ten puzzle, how scores are stored, what the game costs, and how to get in touch.', path: '/about', alt: '/ko/about', body: `
<h1>About Tangerine 10</h1>
<p class="updated">Last updated: September 30, 2026</p>

<h2>What this is</h2>
<p>Tangerine 10 is a free browser puzzle. A grid fills with numbered tangerines, and you drag a rectangle around any group whose numbers add up to exactly ten. Clear as many as you can before the 120-second timer runs out. There is no sign-up, no download, and no app store.</p>
<p>The rule is old — the same make-ten mechanic has appeared in arcade and mobile games for years. What this version adds is a short, honest format: two minutes, one board, a score you can compare. No lives to wait for, no currency to buy, no tutorial to sit through.</p>

<h2>Who makes it</h2>
<p>Tangerine 10 is built and run by one person, a software engineer based in Seoul who builds small web projects outside of work. It is not a studio, a startup, or a company. There is no team behind the game and no investor to answer to.</p>
<p>That matters for what you can expect. Bugs get fixed when there is time. Features arrive slowly, if at all. Nothing gets shut down abruptly to chase a business model.</p>

<h2>Why it was made this way</h2>
<p><b>Two minutes, not twenty.</b> The timer is short on purpose. A puzzle you can finish during a coffee break gets played; one that demands a session gets closed.</p>
<p><b>No account.</b> Asking for an email before someone has played a single round is a bad trade. Scores are saved without one.</p>
<p><b>It works on a phone.</b> The board is sized to be tapped with a thumb. Most people who open the game are on a phone, so that is the case it is built for first.</p>

<h2>How scores work</h2>
<p>Your score comes from the number of tiles you clear, multiplied by a combo bonus that grows while you keep clearing without pausing. Speed beats size — several quick pairs usually outscore one large rectangle.</p>
<p>High scores are stored in Firebase Realtime Database with whatever ranking name you type. Your own recent sessions are kept in your browser's local storage and never leave your device. No email address, phone number, or account identity is collected at any point. The <a href="/privacy">privacy policy</a> covers this in full.</p>

<h2>What it costs</h2>
<p>The game is free and always will be. There is nothing to buy inside it — no hints, no extra time, no cosmetic items. Hosting is paid for out of pocket, and advertising is meant to offset that. Ads are placed at the edges of the page, never inside the board or between rounds, because an ad that interrupts a 120-second game ruins the game.</p>

<h2>Getting in touch</h2>
<p>Found a bug, hit a score that looks wrong, or want to suggest something? Corrections are welcome — if a rule on <a href="/how-to-play">How to Play</a> or an answer in the <a href="/faq">FAQ</a> is wrong or unclear, saying so is genuinely useful.</p>
<p>See the <a href="/contact">contact page</a> for how to reach the person who runs this.</p>
` })],
  ['contact.html', layout({ title: 'Contact — Tangerine 10', desc: 'How to reach the person who builds Tangerine 10: bug reports, scoring questions, rule corrections and suggestions.', path: '/contact', alt: '/ko/contact', body: `
<h1>Contact</h1>
<p class="updated">Last updated: September 30, 2026</p>

<h2>Email</h2>
<p><a href="mailto:comeonyourboyz@gmail.com">comeonyourboyz@gmail.com</a></p>
<p>Tangerine 10 is built and run by one person, so replies can take a few days. Every message is read.</p>

<h2>What is most useful to send</h2>
<p><b>Bug reports.</b> If the board stops responding, a selection that adds to ten does not clear, or the timer behaves oddly, please include your device and browser. "iPhone 15, Safari" is enough to narrow it down.</p>
<p><b>Scoring questions.</b> If a score looks wrong, tell us roughly what the board looked like and what you expected. Combo multipliers are the usual source of confusion.</p>
<p><b>Corrections.</b> If something on <a href="/how-to-play">How to Play</a>, <a href="/strategy">Strategy</a> or the <a href="/faq">FAQ</a> is wrong or unclear, saying so is genuinely helpful — those pages describe the rules, so an error there misleads everyone.</p>
<p><b>Leaderboard issues.</b> If a name on the board is offensive or a score is obviously fabricated, let us know and it will be removed.</p>

<h2>What we cannot do</h2>
<p>Scores cannot be restored. They are tied to the browser you played in, so clearing site data or switching devices loses your local history.</p>
<p>Advertising and partnership offers are read but usually go unanswered.</p>

<h2>About the game</h2>
<p>Who makes this and why it works the way it does is covered on the <a href="/about">about page</a>. What data the game stores is in the <a href="/privacy">privacy policy</a>.</p>
` })],
  ['faq.html', layout({ title: 'Tangerine 10 FAQ — Rules, Scoring and Common Questions', desc: 'Answers to common Tangerine 10 questions: game length, why a selection did not clear, how scoring and combos work, and where scores are saved.', path: '/faq', alt: '/ko/faq', body: faqBody, ld: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] })],
];
for (const [name, html] of pages) writeFileSync(join(OUT, name), html);

// ---------- 한국어 페이지 ----------
const faqBodyKo = `
<nav class="crumb"><a href="/ko/">홈</a> › 자주 묻는 질문</nav>
<h1>자주 묻는 질문</h1>
<p class="lead">귤게임 Tangerine 10에 대해 자주 묻는 것들 — 규칙, 점수, 그리고 버그처럼 보이지만 버그가 아닌 것들.</p>
${faqsKo.map(([q, a]) => `<p class="faq-q">${esc(q)}</p><p>${esc(a)}</p>`).join('\n')}
<h2>그래도 막히면</h2>
<p><a href="/ko/how-to-play">게임 방법</a>에서 판, 선택 네모, 콤보 타이머를 자세히 설명합니다. <a href="/ko/strategy">공략</a>은 빠른 작은 묶음이 느린 큰 묶음보다 점수가 높은 이유를 설명합니다.</p>
<p><a class="cta" href="/ko/">귤게임 하러 가기</a></p>
`;
mkdirSync(join(OUT, 'ko'), { recursive: true });
const pagesKo = [
  ['ko/how-to-play.html', layout({ lang: 'ko', title: '귤게임 하는 법 — 규칙·점수·콤보 총정리', desc: '귤게임 Tangerine 10의 모든 규칙. 120초 제한, 합이 정확히 10이어야 터지는 규칙, 터뜨린 개수로 매기는 점수, 콤보 배율까지 정리했습니다.', path: '/ko/how-to-play', alt: '/how-to-play', body: howKo, ld: [{ '@context': 'https://schema.org', '@type': 'HowTo', name: '귤게임 Tangerine 10 하는 법', inLanguage: 'ko', step: [{ '@type': 'HowToStep', name: '게임 시작', text: '시작을 누르면 1~9 숫자가 적힌 귤 판이 깔리고 120초 타이머가 돕니다.' }, { '@type': 'HowToStep', name: '네모 그리기', text: '누른 채 끌어서 네모를 그리면 가운데가 안에 들어온 귤이 선택됩니다.' }, { '@type': 'HowToStep', name: '정확히 10 만들기', text: '선택한 숫자의 합이 정확히 10이면 귤이 터지고 점수가 오릅니다.' }, { '@type': 'HowToStep', name: '콤보 이어가기', text: '2초 안에 다시 터뜨리면 콤보 배율이 쌓여 콤보 20에서 5배가 됩니다.' }] }] })],
  ['ko/strategy.html', layout({ lang: 'ko', title: '귤게임 공략 — 점수 올리는 법', desc: '귤게임 Tangerine 10에서 큰 네모보다 빠른 짝이 이기는 이유, 외워야 할 다섯 쌍, 판을 훑는 법, 콤보를 지키는 법.', path: '/ko/strategy', alt: '/strategy', body: stratKo, ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: '귤게임 Tangerine 10 공략', inLanguage: 'ko', mainEntityOfPage: SITE.url + '/ko/strategy', author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url } }] })],
  ['ko/faq.html', layout({ lang: 'ko', title: '귤게임 자주 묻는 질문 — 규칙·점수·저장', desc: '귤게임 Tangerine 10 자주 묻는 질문. 한 판 시간, 선택이 안 터지는 이유, 점수와 콤보 계산, 기록이 저장되는 곳.', path: '/ko/faq', alt: '/faq', body: faqBodyKo, ld: [{ '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: 'ko', mainEntity: faqsKo.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] })],
  ['ko/about.html', layout({ lang: 'ko', title: '귤게임 Tangerine 10 소개 — 누가, 왜 만들었나', desc: '귤게임 Tangerine 10을 누가 만드는지, 왜 2분짜리인지, 점수는 어떻게 저장되는지, 비용과 연락 방법.', path: '/ko/about', alt: '/about', body: aboutKo })],
  ['ko/contact.html', layout({ lang: 'ko', title: '문의하기 — 귤게임 Tangerine 10', desc: '귤게임 Tangerine 10 운영자에게 버그 신고, 점수 문의, 규칙 정정, 제안을 보내는 방법.', path: '/ko/contact', alt: '/contact', body: contactKo })],
  ['ko/privacy.html', layout({ lang: 'ko', title: '개인정보처리방침 — 귤게임 Tangerine 10', desc: '귤게임 Tangerine 10이 저장하는 정보와 쿠키·광고 처리 방침.', path: '/ko/privacy', alt: '/privacy', body: privacyKo, noindex: true })],
];
for (const [name, html] of pagesKo) writeFileSync(join(OUT, name), html);

// ---------- 기록 페이지 (영문·한국어) ----------
// 랭킹 DB 의 실제 기록으로 빌드 때 한 번 채우고, 페이지를 열면 같은 함수로 최신 값으로 다시 그린다.
// 통계·표 그리는 함수는 한 벌만 두고(빌드·브라우저 공용) 숫자를 손으로 적지 않는다.
const DB_URL = 'https://tangerin10-default-rtdb.firebaseio.com/rankings.json';
const RECORDS_JS = "function rEsc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c];});}"
  + "function rToday(){return new Date(Date.now()+9*3600e3).toISOString().slice(0,10);}"
  + "function rStats(list,today){var d=new Date(today+'T00:00:00Z');var ws=new Date(d.getTime()-((d.getUTCDay()+6)%7)*864e5).toISOString().slice(0,10);"
  + "var v=list.filter(function(x){return x&&typeof x.score==='number'&&typeof x.date==='string';});"
  + "var by=function(a,b){return b.score-a.score||(a.date<b.date?-1:1);};"
  + "var wk=v.filter(function(x){return x.date>=ws&&x.date<=today;}).sort(by);var m={};v.forEach(function(x){var k=x.date.slice(0,7);m[k]=(m[k]||0)+1;});"
  + "return{total:v.length,weekStart:ws,week:wk.slice(0,10),weekCount:wk.length,top:v.slice().sort(by).slice(0,10),"
  + "months:Object.keys(m).sort().reverse().slice(0,12).map(function(k){return[k,m[k]];}),last:v.reduce(function(a,x){return x.date>a?x.date:a;},'')};}"
  + "function rTable(rows,L){if(!rows.length)return'<p class=\"r-empty\">'+L.empty+'</p>';return'<div class=\"tbl-wrap\"><table><thead><tr><th>#</th><th>'+L.name+'</th><th>'+L.score+'</th><th>'+L.date+'</th></tr></thead><tbody>'"
  + "+rows.map(function(x,i){return'<tr><td>'+(i+1)+'</td><td>'+rEsc(x.name||'—')+'</td><td><b>'+x.score+'</b></td><td>'+rEsc(x.date)+'</td></tr>';}).join('')+'</tbody></table></div>';}"
  + "function rRender(s,L){return{summary:L.sum.replace('{total}',s.total).replace('{weekCount}',s.weekCount).replace('{weekStart}',s.weekStart).replace('{last}',s.last||'—'),"
  + "week:rTable(s.week,L),top:rTable(s.top,L),months:s.months.length?'<div class=\"tbl-wrap\"><table><thead><tr><th>'+L.month+'</th><th>'+L.games+'</th></tr></thead><tbody>'"
  + "+s.months.map(function(r){return'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>';}).join('')+'</tbody></table></div>':'<p class=\"r-empty\">'+L.none+'</p>'};}";
const R = new Function(`${RECORDS_JS}; return { rStats, rRender, rToday };`)();
let RANKS = null;
try { const res = await fetch(DB_URL); if (res.ok) RANKS = Object.values((await res.json()) || {}); } catch { /* 네트워크 실패 시 브라우저에서 채움 */ }
const RL = {
  en: { name: 'Name', score: 'Score', date: 'Date', month: 'Month', games: 'Saved games', empty: 'No scores saved this week yet. Be the first.', none: 'No records yet.', sum: '{total} saved scores so far · {weekCount} this week (since {weekStart}, Korea time) · latest {last}' },
  ko: { name: '이름', score: '점수', date: '날짜', month: '월', games: '저장된 판', empty: '이번 주에 저장된 기록이 아직 없습니다. 첫 기록의 주인공이 되어 보세요.', none: '아직 기록이 없습니다.', sum: '지금까지 저장된 기록 {total}건 · 이번 주({weekStart}부터, 한국 시간) {weekCount}건 · 마지막 기록 {last}' },
};
const recordsBody = (lang) => {
  const L = RL[lang], h = R.rRender(R.rStats(RANKS || [], R.rToday()), L);
  const summary = RANKS ? h.summary : (lang === 'ko' ? '기록을 불러오는 중입니다…' : 'Loading records…');
  const live = `<script>(function(){${RECORDS_JS}var L=${JSON.stringify(L)};fetch('${DB_URL}').then(function(r){return r.ok?r.json():null;}).then(function(d){if(!d)return;var h=rRender(rStats(Object.keys(d).map(function(k){return d[k];}),rToday()),L);['summary','week','top','months'].forEach(function(k){var el=document.getElementById('r-'+k);if(el)el.innerHTML=h[k];});}).catch(function(){});})();</script>`;
  if (lang === 'ko') return `
<nav class="crumb"><a href="/ko/">홈</a> › 기록</nav>
<h1>귤게임 기록</h1>
<p class="lead">게임이 끝나고 이름을 입력해 저장한 점수는 랭킹에 올라갑니다. 이 페이지는 그 기록을 모아 이번 주 최고 점수, 역대 상위 10위, 달마다 저장된 판 수를 보여 줍니다. 페이지를 열 때마다 최신 기록으로 바뀝니다.</p>
<p id="r-summary" class="r-sum">${summary}</p>
<h2>이번 주</h2>
<p>한 주는 한국 시간 월요일에 시작합니다.</p>
<div id="r-week">${h.week}</div>
<h2>역대 상위 10위</h2>
<div id="r-top">${h.top}</div>
<h2>달마다 저장된 판</h2>
<div id="r-months">${h.months}</div>
<h2>이 숫자를 읽는 법</h2>
<p>이름을 입력하고 저장한 판만 셉니다. 저장하지 않고 끝낸 판은 여기 나오지 않으니, 이 숫자는 실제로 게임을 한 사람 수가 아니라 저장된 기록의 수입니다.</p>
<p>점수는 입력된 그대로 보여 줍니다. 말이 안 되는 점수나 불쾌한 이름이 보이면 <a href="/ko/contact">문의하기</a>로 알려 주세요. 지우겠습니다.</p>
<h2>순위를 올리려면</h2>
<p>가장 빠른 방법은 콤보를 끊기지 않게 유지하는 것입니다. 큰 네모보다 2초 안에 이어지는 작은 짝이 훨씬 점수가 높습니다. 자세한 방법은 <a href="/ko/strategy">공략</a>에 있습니다.</p>
<p><a class="cta" href="/ko/">지금 도전하기</a></p>
${live}`;
  return `
<nav class="crumb"><a href="/">Home</a> › Records</nav>
<h1>Tangerine 10 Records</h1>
<p class="lead">Every score a player saves with a name at the end of a game goes on the leaderboard. This page adds those saved scores up — this week's best, the all-time top ten, and how many games were saved each month. It refreshes with the latest records whenever you open it.</p>
<p id="r-summary" class="r-sum">${summary}</p>
<h2>This week</h2>
<p>Weeks start on Monday, Korea time.</p>
<div id="r-week">${h.week}</div>
<h2>All-time top 10</h2>
<div id="r-top">${h.top}</div>
<h2>Saved games by month</h2>
<div id="r-months">${h.months}</div>
<h2>How to read these numbers</h2>
<p>Only games where the player typed a name and saved are counted. A game finished without saving does not appear here, so these are counts of saved scores, not of everyone who played.</p>
<p>Scores are shown as entered. If a score looks impossible or a name is offensive, report it on the <a href="/contact">contact page</a> and it will be removed.</p>
<h2>Want to climb the board?</h2>
<p>The fastest way up is keeping the combo alive. Quick small pairs inside the two-second window beat big rectangles by a wide margin. The <a href="/strategy">strategy guide</a> explains why.</p>
<p><a class="cta" href="/">Play now</a></p>
${live}`;
};
const recordPages = [
  ['records.html', layout({ title: 'Tangerine 10 Records — Weekly Best and All-Time Top 10', desc: 'Saved Tangerine 10 scores: this week\'s best, the all-time top ten and saved games by month, updated from the live leaderboard.', path: '/records', alt: '/ko/records', body: recordsBody('en') })],
  ['ko/records.html', layout({ lang: 'ko', title: '귤게임 기록 — 이번 주 최고 점수와 역대 순위', desc: '귤게임 Tangerine 10에 저장된 점수 모음. 이번 주 최고 점수, 역대 상위 10위, 달마다 저장된 판 수를 랭킹에서 바로 가져와 보여 줍니다.', path: '/ko/records', alt: '/records', body: recordsBody('ko') })],
];
for (const [name, html] of recordPages) writeFileSync(join(OUT, name), html);

// ---------- 한국어 게임 화면 (/ko/) ----------
// 영문 게임 화면(public/index.html)을 읽어 보이는 문구만 바꾼다. 게임 코드는 한 벌만 유지.
// 바꿀 문구를 못 찾으면 빌드를 멈춘다 — 영문 화면이 바뀌었는데 한국어 판이 조용히 영어로 남는 것을 막기 위해서다.
{
  let g = readFileSync(join(OUT, 'index.html'), 'utf8');
  const sub = (from, to, times = 1) => {
    const n = g.split(from).length - 1;
    if (n !== times) throw new Error(`한국어 게임 화면: "${from.slice(0, 50)}" 가 ${times}번이 아니라 ${n}번 있음`);
    g = g.split(from).join(to);
  };
  const block = (re, to) => { if (!re.test(g)) throw new Error(`한국어 게임 화면: ${re} 를 찾지 못함`); g = g.replace(re, to); };
  const TITLE = '귤게임 Tangerine 10 — 숫자 합 10 만들기 퍼즐';
  sub('<html lang="en">', '<html lang="ko">');
  block(/<meta name="description" content="[^"]*">/, '<meta name="description" content="귤게임 Tangerine 10 — 숫자의 합이 정확히 10이 되게 귤을 묶어 터뜨리는 무료 퍼즐. 2분 동안 몇 개나 지울 수 있을까요? 회원가입·설치 없이 바로 할 수 있습니다.">');
  block(/<meta name="keywords" content="[^"]*">/, '<meta name="keywords" content="귤게임, 숫자 10 만들기, 사과게임, 숫자 퍼즐, 무료 게임, 두뇌 게임, Tangerine 10">');
  sub('<title>Tangerine 10 — Number Puzzle Game</title>', `<title>${TITLE}</title>`);
  sub('<meta property="og:title" content="Tangerine 10 — Number Puzzle Game">', `<meta property="og:title" content="${TITLE}">`);
  sub('<meta name="twitter:title" content="Tangerine 10 — Number Puzzle Game">', `<meta name="twitter:title" content="${TITLE}">`);
  block(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="2분 안에 귤을 터뜨려라! 합이 정확히 10이 되게 묶는 무료 숫자 퍼즐.">');
  block(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="합이 정확히 10이 되게 귤을 묶어 터뜨리는 무료 숫자 퍼즐. 120초 동안 최대한 많이 지워 보세요.">');
  sub('<meta property="og:url" content="https://tangerin10.web.app">', '<meta property="og:url" content="https://tangerin10.web.app/ko/">');
  sub('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="ko_KR">');
  sub('<meta property="og:image:alt" content="Tangerine 10 number puzzle">', '<meta property="og:image:alt" content="귤게임 Tangerine 10 숫자 퍼즐">');
  sub('<link rel="canonical" href="https://tangerin10.web.app/">', '<link rel="canonical" href="https://tangerin10.web.app/ko/">');
  sub('"inLanguage":"en"}', '"inLanguage":"ko"}');
  sub('"description":"Free number puzzle game! Drag and match numbers that add up to 10. 2-minute challenge with global ranking."', '"description":"합이 10이 되게 귤을 묶어 터뜨리는 무료 숫자 퍼즐. 2분 도전과 전체 랭킹."');
  sub('<div class="score-label">SCORE</div>', '<div class="score-label">점수</div>');
  block(/<div class="hint">[\s\S]*?<\/div>/, '<div class="hint">합이 10이 되게 드래그해서 묶으세요 · <a href="/" hreflang="en" style="color:#f97316;text-decoration:none;font-weight:700;">English</a> · <a href="/ko/privacy" style="color:#ccc;text-decoration:none;">개인정보처리방침</a></div>');
  sub('🏆 TOP SCORES', '🏆 최고 점수');
  sub('📋 MY HISTORY', '📋 내 기록');
  sub('No scores yet', '아직 기록이 없어요', 2);
  sub('No games yet', '아직 플레이 기록이 없어요', 2);
  block(/<section class="site-content">[\s\S]*?<\/section>/, `<section class="site-content">
  <h2>귤게임 Tangerine 10은요</h2>
  <p>Tangerine 10은 규칙 하나로 하는 무료 브라우저 퍼즐입니다. 숫자의 합이 <b>정확히 10</b>이 되는 귤들에 네모를 그리면 터집니다. 시간은 120초. 회원가입도, 설치도, 앱스토어도 없습니다.</p>
  <p>판을 시작할 때마다 1부터 9까지 숫자가 적힌 귤이 새로 깔립니다. PC는 170개, 휴대폰은 168개라 같은 판을 다시 할 일은 없습니다. 내 기록은 브라우저에 저장되고, 이름을 입력하면 위쪽 전체 랭킹에 최고 점수가 올라갑니다.</p>
  <h2>30초 규칙 요약</h2>
  <ul>
    <li>누른 채 끌어서 네모를 그립니다. 귤의 가운데가 네모 안에 들어오면 선택됩니다.</li>
    <li>선택한 숫자의 합이 정확히 10일 때 손을 떼세요. 9나 11은 아무 일도 없습니다.</li>
    <li>터진 자리는 빈칸이 되고, 빈칸은 다음 선택에서 빠집니다. 판이 빌수록 쉬워집니다.</li>
    <li>120초가 되면 시계가 멈추고 점수가 확정됩니다.</li>
  </ul>
  <h2>점수는 이렇게 매겨집니다</h2>
  <p>처음 하는 사람 대부분이 여기서 헷갈립니다. 점수는 터뜨린 숫자의 합이 <b>아닙니다</b>. 터뜨린 귤의 개수에 콤보 배율을 곱한 값입니다.</p>
  <table class="sc-table">
    <thead><tr><th>연속 콤보</th><th>배율</th><th>귤 4개를 터뜨리면</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>&times;1</td><td>4점</td></tr>
      <tr><td>2 &ndash; 4</td><td><b>&times;1.5</b></td><td>6점</td></tr>
      <tr><td>5 &ndash; 9</td><td><b>&times;2</b></td><td>8점</td></tr>
      <tr><td>10 &ndash; 19</td><td><b>&times;3</b></td><td>12점</td></tr>
      <tr><td>20+</td><td><b>&times;5</b></td><td>20점</td></tr>
    </tbody>
  </table>
  <div class="sc-note">
    <p><strong>마지막으로 터뜨린 뒤 2초가 지나면 콤보가 끊깁니다.</strong> 대부분의 판이 이 하나로 갈립니다. 더 큰 묶음을 찾다가 콤보를 놓치는 것보다, 작은 짝이라도 바로 터뜨리는 게 낫습니다.</p>
  </div>
  <h3>바로 써먹는 팁 세 가지</h3>
  <ul>
    <li><b>다섯 쌍을 외우세요.</b> 1+9, 2+8, 3+7, 4+6, 5+5. 짝은 네모가 가장 작고, 콤보를 이어 가는 가장 빠른 방법입니다.</li>
    <li><b>가로 띠로 훑으세요.</b> 판 전체를 보지 말고 두세 줄씩 처리하세요. 필요한 네모는 납작하고 넓습니다.</li>
    <li><b>고립된 9는 포기하세요.</b> 9는 1하고만 짝이 됩니다. 닿는 곳에 1이 없으면 두고 다른 데 시간을 쓰세요.</li>
  </ul>
  <div class="sc-links">
    <a href="/ko/how-to-play">전체 규칙 &rarr;</a>
    <a href="/ko/strategy">공략 &rarr;</a>
    <a href="/ko/faq">자주 묻는 질문 &rarr;</a>
    <a href="/ko/records">기록 &rarr;</a>
  </div>
</section>`);
  block(/<footer class="site-ftr">[\s\S]*?<\/footer>/, `<footer class="site-ftr">
  <div class="fnav"><a href="/ko/">게임</a><a href="/ko/how-to-play">게임 방법</a><a href="/ko/strategy">공략</a><a href="/ko/faq">FAQ</a><a href="/ko/records">기록</a><a href="/ko/about">소개</a><a href="/ko/contact">문의</a><a href="/ko/privacy">개인정보처리방침</a><a href="/" hreflang="en">English</a></div>
  <p class="fnote">Tangerine 10은 무료 브라우저 퍼즐 게임입니다. 회원가입·설치 없이 바로 할 수 있습니다.</p>
</footer>`);
  sub('<div class="st-sub">Drag numbers that add up to 10!<br>2 minutes. How many can you clear?</div>', '<div class="st-sub">합이 10이 되게 묶어 터뜨리세요!<br>2분 동안 몇 개나 지울 수 있을까요?</div>');
  sub('▶ START', '▶ 시작');
  sub('<div class="ol" id="ol">GAME OVER</div>', '<div class="ol" id="ol">게임 종료</div>');
  sub('<div class="ou">tiles cleared</div>', '<div class="ou">점</div>');
  sub('placeholder="Enter your name"', 'placeholder="이름을 입력하세요"');
  sub('▶ Play Again', '▶ 다시 하기', 2);
  sub(`S===0?"TIME'S UP!":'GAME OVER'`, `S===0?"시간 종료!":'게임 종료'`);
  sub("'🎉 NEW HIGH SCORE!'", "'🎉 최고 기록 달성!'");
  sub("'Save & Play Again'", "'저장하고 다시 하기'");
  sub("'No tiles cleared...'", "'하나도 못 터뜨렸어요...'");
  sub("'Top: '+", "'1위: '+");
  sub("var SHARE_URL='https://tangerin10.web.app?v='+Date.now();", "var SHARE_URL='https://tangerin10.web.app/ko/?v='+Date.now();");
  writeFileSync(join(OUT, 'ko', 'index.html'), g);
}

const today = new Date().toISOString().slice(0, 10);
const urls = [
  ['/', '1.0', 'weekly'], ['/how-to-play', '0.8', 'monthly'], ['/strategy', '0.8', 'monthly'], ['/faq', '0.7', 'monthly'], ['/records', '0.6', 'daily'], ['/about', '0.6', 'yearly'], ['/contact', '0.5', 'yearly'],
  ['/ko/', '1.0', 'weekly'], ['/ko/how-to-play', '0.8', 'monthly'], ['/ko/strategy', '0.8', 'monthly'], ['/ko/faq', '0.7', 'monthly'], ['/ko/records', '0.6', 'daily'], ['/ko/about', '0.6', 'yearly'], ['/ko/contact', '0.5', 'yearly'],
];
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([l, p, f]) => `  <url><loc>${SITE.url}${l}</loc><lastmod>${today}</lastmod><changefreq>${f}</changefreq><priority>${p}</priority></url>`).join('\n')}\n</urlset>\n`);

const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log('✔ 콘텐츠 페이지 생성');
for (const [name, html] of [...pages, ...pagesKo, ...recordPages]) console.log(`  ${name.padEnd(20)} 본문 ${strip(html).length.toLocaleString()}자`);
console.log(`  기록: ${RANKS ? `랭킹 ${RANKS.length}건 반영` : '랭킹을 불러오지 못해 브라우저에서 채움'}`);
console.log(`  sitemap.xml 항목 ${urls.length}개`);
