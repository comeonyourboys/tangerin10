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
import { ARTICLES, articleBody, teaser, headline, SIM } from './articles.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public');
const SITE = { url: 'https://tangerin10.web.app', name: 'Tangerine 10', gsv: ['8nUCFYxTph7TOTN0ZC0zWvamYgyQMd026qCLSBL9YgE', 'WjzFs7iu4kDSzcJKM5QyAqGDAqx9J1P0uj-Ry4z1_NU'], adfit: 'DAN-vwzzWFnt83j2lDmM' }; // adfit: 카카오 애드핏 하단 320x50
// 카카오 애드핏 320x50 한 칸을 본문 맨 아래에 둔다. 단위 ID 가 비어 있으면 아무것도 출력하지 않는다.
// 개인정보처리방침·소개·문의·404·기록 페이지에는 광고를 넣지 않는다(layout 의 ads:false).
const adfit = (unit) => unit ? `<div class="ad-wrap" style="display:flex;justify-content:center"><ins class="kakao_ad_area" style="display:none;" data-ad-unit="${unit}" data-ad-width="320" data-ad-height="50"></ins><script async src="https://t1.kakaocdn.net/kas/static/ba.min.js"></script></div>` : '';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jsonld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

// ---------- 디자인 시스템(게임 화면과 글 페이지 공용) ----------
// 바탕은 연한 세이지, 판·강조 띠는 짙은 초록, 포인트는 귤색. 제목은 Bricolage Grotesque, 본문은 SUIT.
// 게임 화면(public/index.html)에는 /* ds:start */ ~ /* ds:end */ 구간과 머리글·바닥글을 빌드 때 이 값으로 채운다.
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/static/woff2/SUIT.css" rel="stylesheet">`;
const DS_CSS = `
:root{--bg:#EDF0E6;--bg-2:#E2E7D9;--paper:#F6F8F1;--ink:#13261B;--ink-2:#4A5A4E;--line:rgba(19,38,27,.16);--board:#173828;--fruit:#F68B1F;--leaf:#4E9A57;--link:#A84400;
--display:"Bricolage Grotesque","SUIT","Apple SD Gothic Neo",sans-serif;--body:"SUIT","Apple SD Gothic Neo","Malgun Gothic",sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;}
html{-webkit-text-size-adjust:100%;}
body{background:var(--bg);color:var(--ink);font:500 16px/1.65 var(--body);word-break:keep-all;overflow-wrap:break-word;}
a{color:inherit;}
a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid var(--fruit);outline-offset:3px;border-radius:6px;}
.wrap{max-width:1440px;margin:0 auto;padding:0 48px;}
.top{display:flex;align-items:center;gap:40px;height:68px;border-bottom:1px solid var(--line);}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font:800 21px/1 var(--display);letter-spacing:-.02em;white-space:nowrap;color:var(--ink);}
.brand i{width:22px;height:22px;border-radius:50%;background:var(--fruit);position:relative;display:block;flex:none;}
.brand i::after{content:"";position:absolute;width:9px;height:5px;border-radius:50%;background:var(--leaf);top:-2px;right:-1px;transform:rotate(-30deg);}
.brand b{color:var(--fruit);font-weight:800;}
.nav{display:flex;gap:28px;font-size:16px;font-weight:600;}
.nav a{text-decoration:none;color:var(--ink-2);white-space:nowrap;}
.nav a:hover,.nav a[aria-current]{color:var(--ink);}
.nav a[aria-current]{box-shadow:inset 0 -2px 0 var(--fruit);}
.lang{margin-left:auto;font-weight:700;font-size:15px;text-decoration:none;border:1.5px solid var(--ink);padding:6px 14px;border-radius:999px;white-space:nowrap;color:var(--ink);}
.lang:hover{background:var(--ink);color:var(--bg);}
.foot{border-top:1px solid var(--line);margin-top:56px;padding:32px 0 48px;}
.sib{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 0;}
.sib h2{font:800 16px/1.4 var(--body);margin:0 24px 0 0;letter-spacing:0;border:0;padding:0;}
.sib a{text-decoration:none;font-weight:600;padding:2px 0;margin-right:22px;border-bottom:1.5px solid transparent;color:var(--ink);}
.sib a:hover{border-color:var(--ink);}
.sib a.me{color:var(--link);font-weight:800;}
.fnav{display:flex;flex-wrap:wrap;gap:6px 22px;margin-top:22px;color:var(--ink-2);font-size:15px;}
.fnav a{text-decoration:none;}
.fnav a:hover{color:var(--ink);text-decoration:underline;}
.fine{color:var(--ink-2);font-size:15px;margin:14px 0 0;}
.studies{display:grid;}
.study{display:block;text-decoration:none;}
.big{font:800 76px/1 var(--display);color:var(--fruit);letter-spacing:-.03em;font-variant-numeric:tabular-nums;}
.big small{font-size:22px;letter-spacing:0;margin-left:6px;font-weight:700;}
.vs{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;}
.vs span{font:700 18px/1 var(--display);}
.vs .big.dim{font-size:54px;}
.study h3{font:800 20px/1.4 var(--body);margin:18px 0 8px;max-width:22em;}
.study p{margin:0;font-size:16px;max-width:32em;}
.study:hover h3{text-decoration:underline;text-underline-offset:4px;}
@media (max-width:600px){
  .wrap{padding:0 16px;}
  .top{height:auto;flex-wrap:wrap;gap:10px 16px;padding:14px 0;}
  .nav{order:3;width:100%;gap:18px;overflow-x:auto;font-size:15px;padding-bottom:2px;}
  .big{font-size:60px;}
  .vs .big.dim{font-size:42px;}
}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important;}}
`;
const NAV = {
  en: [['/', 'Play'], ['/how-to-play', 'How to Play'], ['/strategy', 'Strategy'], ['/analysis', 'Analysis'], ['/faq', 'FAQ'], ['/about', 'About'], ['/contact', 'Contact']],
  ko: [['/ko/', '게임'], ['/ko/how-to-play', '게임 방법'], ['/ko/strategy', '공략'], ['/ko/analysis', '분석'], ['/ko/faq', 'FAQ'], ['/ko/about', '소개'], ['/ko/contact', '문의']],
};
const T = {
  en: { privacy: 'Privacy Policy', privacyPath: '/privacy', note: 'Tangerine 10 is a free browser puzzle game. No sign-up, no download.', locale: 'en_US', other: '한국어', alt: 'Tangerine 10 number puzzle', menu: 'Site menu', sibs: 'Other tools by comeonyourboyz', fmenu: 'Footer' },
  ko: { privacy: '개인정보처리방침', privacyPath: '/ko/privacy', note: 'Tangerine 10은 무료 브라우저 퍼즐 게임입니다. 회원가입·설치 없이 바로 할 수 있습니다.', locale: 'ko_KR', other: 'English', alt: '귤게임 Tangerine 10 숫자 퍼즐', menu: '사이트 메뉴', sibs: 'comeonyourboyz가 만든 다른 도구', fmenu: '바닥글' },
};
// comeonyourboyz 가 만든 도구 8개. 자기 사이트(Tangerine 10)는 이 사이트 홈으로 걸고 강조한다.
const SIBLINGS = [
  ['https://todays-fortune-app.vercel.app', '오늘의 운세', "Today's Fortune"],
  ['https://dreamdict.web.app', '꿈해몽 사전', 'Dream Dictionary'],
  ['https://idiomdict.web.app', '사자성어·속담 사전', 'Korean Idiom Dictionary'],
  ['https://plantdict.web.app', '실내식물 사전', 'Houseplant Dictionary'],
  ['https://salaryrank.web.app', '내 연봉 순위', 'Salary Rank'],
  ['https://giftwheel.web.app', '선물 룰렛', 'Gift Wheel'],
  ['https://mykoreanname.web.app', 'My Korean Name', 'My Korean Name'],
  [null, 'Tangerine 10', 'Tangerine 10'],
];
// 머리글: 로고 · 메뉴 다섯 개(게임 방법~소개) · 언어 전환. path 와 같은 메뉴는 aria-current.
function siteHeader(lang, path, alt) {
  const t = T[lang], nav = NAV[lang], other = lang === 'en' ? 'ko' : 'en';
  return `<header class="top site-nav">
  <a class="brand" href="${nav[0][0]}"><i aria-hidden="true"></i><span>Tangerine <b>10</b></span></a>
  <nav class="nav" aria-label="${t.menu}">${nav.slice(1, 6).map(([h, n]) => `<a href="${h}"${h === path ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</nav>
  ${alt ? `<a class="lang" href="${alt}" hreflang="${other}">${t.other}</a>` : ''}
</header>`;
}
function siteFooter(lang, alt) {
  const t = T[lang], nav = NAV[lang], other = lang === 'en' ? 'ko' : 'en';
  return `<footer class="foot site-ftr">
  <nav class="sib" aria-label="${t.sibs}">
    <h2>${t.sibs}</h2>
    ${SIBLINGS.map(([u, ko, en]) => u ? `<a href="${u}">${lang === 'ko' ? ko : en}</a>` : `<a class="me" href="${nav[0][0]}">${lang === 'ko' ? ko : en}</a>`).join('')}
  </nav>
  <nav class="fnav" aria-label="${t.fmenu}">${nav.map(([h, n]) => `<a href="${h}">${n}</a>`).join('')}<a href="${t.privacyPath}">${t.privacy}</a>${alt ? `<a href="${alt}" hreflang="${other}">${t.other}</a>` : ''}</nav>
  <p class="fine">${t.note} © ${new Date().getFullYear()} Tangerine 10</p>
</footer>`;
}
// 분석 글 세 편을 큰 숫자와 함께 나열(홈의 초록 띠, 분석 목록 페이지 공용)
function studyList(lang) {
  return `<div class="studies">
${['board', 'bots', 'combos'].map((id) => {
    const a = ARTICLES[id][lang], h = headline(id, lang);
    const num = h.vs != null ? `<div class="vs"><div class="big">${h.big}</div><span>${h.mid}</span><div class="big dim">${h.vs}</div></div>` : `<div class="big">${h.big}<small>${h.unit}</small></div>`;
    return `    <a class="study" href="${a.path}">${num}<h3>${a.h1}</h3><p>${teaser(id, lang)}</p></a>`;
  }).join('\n')}
  </div>`;
}

// ---------- 글 페이지 전용 스타일 ----------
const CSS = DS_CSS + `
.doc{display:grid;grid-template-columns:minmax(0,1fr) 352px;gap:44px;padding-top:36px;align-items:start;}
.doc-main{max-width:760px;min-width:0;}
.crumb{font-size:14px;color:var(--ink-2);margin:0 0 10px;font-weight:600;}
.crumb a{color:var(--link);text-decoration:none;}
.crumb a:hover{text-decoration:underline;}
.doc-main h1{font:800 clamp(30px,4vw,44px)/1.15 var(--display);letter-spacing:-.025em;margin:4px 0 14px;}
.lead{font-size:19px;line-height:1.65;color:var(--ink-2);margin-bottom:30px;font-weight:600;}
.doc-main h2{font:800 24px/1.3 var(--display);letter-spacing:-.015em;margin:44px 0 14px;padding-top:16px;border-top:2px solid var(--ink);}
.doc-main h3{font:800 18px/1.4 var(--body);margin:26px 0 8px;}
.doc-main p{font-size:17px;line-height:1.75;margin-bottom:16px;}
.doc-main a{color:var(--link);text-underline-offset:3px;}
.doc-main ul,.doc-main ol{margin:0 0 18px 22px;}
.doc-main li{font-size:17px;line-height:1.7;margin-bottom:8px;}
.doc-main li::marker{color:var(--fruit);}
.box{background:var(--paper);border-left:4px solid var(--fruit);border-radius:0 12px 12px 0;padding:18px 22px;margin:20px 0;}
.box p:last-child,.box ul:last-child,.box li:last-child{margin-bottom:0;}
.box strong{color:var(--link);}
table{width:100%;border-collapse:collapse;margin:18px 0;font-size:16px;border-top:2px solid var(--ink);font-variant-numeric:tabular-nums;}
th,td{padding:11px 14px 11px 0;text-align:left;border-bottom:1px solid var(--line);vertical-align:top;}
th{font-weight:700;font-size:14px;color:var(--ink-2);}
tbody th{color:var(--ink);font-size:15px;}
td b{color:var(--link);}
.tbl-wrap{overflow-x:auto;}
.cta{display:inline-block;background:var(--fruit);color:var(--ink)!important;font-weight:800;font-size:17px;padding:13px 28px;border-radius:999px;text-decoration:none;margin:10px 0 6px;}
.cta:hover{background:#FFA348;}
.faq-q{font:800 19px/1.45 var(--body)!important;margin:30px 0 6px!important;}
.ad-wrap{margin:40px 0 0;padding:0;}
.fig{margin:22px 0;padding:16px 16px 12px;border:1px solid var(--line);border-radius:14px;background:var(--paper);}
.fig figcaption{font-size:14px;color:var(--ink-2);margin-top:8px;text-align:center;}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em;background:var(--bg-2);padding:1px 5px;border-radius:5px;}
.updated{font-size:14px!important;color:var(--ink-2);margin:-4px 0 22px!important;}
.doc-main .studies{border-top:2px solid var(--ink);margin:10px 0 8px;}
.doc-main .study{display:grid;grid-template-columns:300px minmax(0,1fr);gap:4px 28px;padding:24px 0;border-bottom:1px solid var(--line);color:var(--ink);text-decoration:none;}
.doc-main .study .big{font-size:52px;}
.doc-main .study .vs .big{font-size:44px;}
.doc-main .study .vs .big.dim{font-size:32px;color:var(--ink);}
.doc-main .study .vs{flex-wrap:nowrap;}
.doc-main .study .vs{gap:8px;}
.doc-main .study .vs span{color:var(--ink-2);font-size:15px;}
.doc-main .study .big small{color:var(--ink);font-size:18px;}
.doc-main .study h3{grid-column:2;grid-row:1;margin:0 0 6px;}
.doc-main .study p{grid-column:2;color:var(--ink-2);}
.doc-main .study > :first-child{grid-row:1/3;color:var(--fruit);}
.r-sum{background:var(--paper);border-left:4px solid var(--fruit);border-radius:0 12px 12px 0;padding:14px 18px;font-size:16px!important;font-weight:600;}
.r-empty{color:var(--ink-2);}
.doc-side{position:sticky;top:24px;display:grid;gap:22px;}
.play-card{background:var(--board);color:#EAF1EA;border-radius:22px;padding:26px 26px 28px;}
.play-card b{display:block;font:800 26px/1.2 var(--display);letter-spacing:-.02em;}
.play-card p{color:#C3D3C6;margin:10px 0 18px;font-size:16px;}
.play-card a{display:inline-block;background:var(--fruit);color:var(--ink);text-decoration:none;font-weight:800;padding:11px 22px;border-radius:999px;}
.play-card a:hover{background:#FFA348;}
.play-card a:focus-visible{outline-color:#FFD58F;}
.toc{border-top:2px solid var(--ink);padding-top:14px;}
.toc h2{font:800 18px/1.3 var(--body);margin:0 0 6px;}
.toc a{display:block;padding:9px 0;border-bottom:1px solid var(--line);text-decoration:none;font-weight:600;color:var(--ink-2);}
.toc a:last-child{border-bottom:0;}
.toc a:hover{color:var(--ink);}
.toc a[aria-current]{color:var(--link);font-weight:800;}
@media (max-width:1100px){
  .doc{grid-template-columns:minmax(0,1fr);gap:48px;}
  .doc-main{max-width:none;}
  .doc-side{position:static;grid-template-columns:1fr 1fr;align-items:start;}
}
@media (max-width:600px){
  .doc{padding-top:22px;}
  .lead{font-size:17px;}
  .doc-main p,.doc-main li{font-size:16px;}
  .doc-main h2{font-size:22px;margin-top:36px;}
  th,td{padding:9px 10px 9px 0;font-size:15px;}
  .tbl-wrap table:has(th:nth-child(5)){min-width:600px;}
  .doc-main .study{grid-template-columns:1fr;}
  .doc-main .study h3,.doc-main .study p{grid-column:1;grid-row:auto;}
  .doc-main .study > :first-child{grid-row:auto;}
  .doc-side{grid-template-columns:1fr;}
}
`;
const SIDE = {
  en: { pitch: 'Two minutes. Drag a box over tangerines that add up to exactly 10.', play: 'Play Tangerine 10', read: 'On this site', records: 'Records' },
  ko: { pitch: '합이 정확히 10이 되는 귤들을 네모로 묶으면 터집니다. 시간은 2분.', play: '귤게임 하러 가기', read: '이 사이트의 글', records: '기록' },
};
function docSide(lang, path) {
  const s = SIDE[lang], nav = NAV[lang], pre = lang === 'ko' ? '/ko' : '';
  const items = [nav[1], nav[2], nav[3], ...['board', 'bots', 'combos'].map((id) => [ARTICLES[id][lang].path, ARTICLES[id][lang].h1]), nav[4], [`${pre}/records`, s.records]];
  return `<aside class="doc-side">
  <div class="play-card"><b>Tangerine 10</b><p>${s.pitch}</p><a href="${nav[0][0]}">${s.play}</a></div>
  <nav class="toc" aria-label="${s.read}"><h2>${s.read}</h2>${items.map(([h, n]) => `<a href="${h}"${h === path ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</nav>
</aside>`;
}

// alt: 다른 언어 판의 경로. 있으면 hreflang 과 언어 전환 링크를 붙인다.
function layout({ title, desc, path, body, ld = [], lang = 'en', alt = '', noindex = false, ads = true }) {
  const t = T[lang], abs = (p) => SITE.url + p, other = lang === 'en' ? 'ko' : 'en';
  const hreflang = alt ? `<link rel="alternate" hreflang="${lang}" href="${abs(path)}"><link rel="alternate" hreflang="${other}" href="${abs(alt)}"><link rel="alternate" hreflang="x-default" href="${abs(lang === 'en' ? path : alt)}">` : '';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#EDF0E6">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${abs(path)}">
${hreflang}
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow'}">
${SITE.gsv.map((g) => `<meta name="google-site-verification" content="${g}">`).join('\n')}
<meta name="google-adsense-account" content="ca-pub-5479403345572412">
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
${FONTS}
<style>${CSS}</style>
${ld.map(jsonld).join('\n')}
</head>
<body>
<div class="wrap">
${siteHeader(lang, path, alt)}
<div class="doc">
<main class="doc-main">
${body}
${ads ? adfit(SITE.adfit) : ''}
</main>
${docSide(lang, path)}
</div>
${siteFooter(lang, alt)}
</div>
</body>
</html>`;
}

// ---------- How to Play ----------
const howBody = `
<nav class="crumb"><a href="/">Home</a> › How to Play</nav>
<h1>How to Play Tangerine 10</h1>
<p class="lead">Tangerine 10 is a two-minute number puzzle. You drag a box around tangerines whose numbers add up to exactly ten, and they pop. Here is every rule, including the ones the game never spells out.</p>

<h2>The board</h2>
<p>Every game starts with a fresh grid of tangerines. Each one carries a number from 1 to 9, drawn at random, so no two games are ever the same. The grid size depends on how wide your browser window is.</p>
<div class="tbl-wrap"><table><tbody>
<tr><th>Computers and most tablets</th><td>10 rows × 17 columns — <b>170 tangerines</b></td></tr>
<tr><th>Phones (window 600 px wide or less)</th><td>12 rows × 14 columns — <b>168 tangerines</b></td></tr>
<tr><th>Numbers</th><td>1 to 9, randomly distributed</td></tr>
<tr><th>Time limit</th><td><b>120 seconds</b></td></tr>
</tbody></table></div>

<h3>Which board does a tablet get?</h3>
<p>The game picks the board once, when the page loads, from the width of the browser window in CSS pixels. A window 600 pixels wide or narrower gets the 12 × 14 phone board; anything wider gets the 10 × 17 board. Tablets report widths well above 600 even in portrait — an iPad in portrait is 768 pixels wide or more — so tablets get the 17-column board, scaled down to fit the screen. Rotating the device or resizing the window does not change the board until you reload the page. A small tablet held in portrait shows fairly small tangerines; turning it to landscape before the page loads gives each tangerine more room.</p>

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
  <li><b>Touch:</b> press and drag with one finger. While a game is running, a touch that starts on the board draws a box instead of scrolling the page. Touches anywhere else scroll as usual.</li>
  <li><b>Restart:</b> the Restart button under the timer ends the current game straight away and shows the result card. Press Play Again for a new board.</li>
</ul>

<h2>When the game ends</h2>
<p>At 120 seconds the board locks, your score is final, and a result card appears over the board.</p>
<ul>
  <li><b>My History</b> adds the run to a list of your last five games. The list exists only while the page is open; it is not stored on your device, so reloading the page clears it.</li>
  <li><b>The leaderboard is not automatic.</b> If your score beats the current third place, a name box appears on the result card. Type a name and press <b>Save &amp; Play Again</b> — only then is the score uploaded. An empty box is saved as "Player". If you close the page or press nothing, the score is not sent anywhere.</li>
  <li>Scores that do not reach the top three show the current best score instead, and the button simply starts a new board.</li>
</ul>
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
<p>This was tested with automatic players under the real rules in the <a href="/bot-strategies">bot strategy experiment</a>, which also shows the one situation where it stops being true: a player too slow to keep any combo scores more with bigger boxes.</p>

<h2>Learn the five pairs</h2>
<p>There are exactly five ways two numbers make ten. Burn them into memory so you stop calculating.</p>
<div class="box">
  <p><strong>1 + 9 · 2 + 8 · 3 + 7 · 4 + 6 · 5 + 5</strong></p>
  <p>Pairs are the fastest clears in the game. They need the smallest rectangle, they are the easiest to spot, and at a ×5 multiplier a pair is worth ten points — more than a four-tile clear at base rate.</p>
</div>
<p>Once pairs are automatic, add the common triples: 1+2+7, 1+3+6, 1+4+5, 2+3+5, and the all-purpose 8+1+1. Anything longer than four tiles is rarely worth the search time. The <a href="/make-ten-combinations">full list of make-ten combinations</a> shows how often each one actually appears on a board.</p>

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
<p>The <a href="/board-statistics">board statistics</a> put a number on this: in ${SIM.board.desktop.boards.toLocaleString('en-US')} simulated boards, ${SIM.board.desktop.digits[8].noMoveAtStartPct}% of nines started with no 1 next to them.</p>

<h2>Play on the bigger board when you can</h2>
<p>Computers and tablets get 170 tangerines across 17 columns; phones get 168 across 14. The wider desktop grid puts more candidates inside any given horizontal sweep, which means less scrolling of the eyes and more matches per second. If you are chasing a leaderboard place, play on a laptop.</p>

<h2>A realistic progression</h2>
<p>Do not compare your first run to the leaderboard. Most players follow roughly this curve: the first few games are spent learning the drag, then pairs become automatic, then the combo clicks and the score roughly doubles. The jump from decent to good is almost entirely about holding the streak, not about spotting cleverer combinations.</p>
<p><a class="cta" href="/">Try it now</a></p>
<p>If any rule here is unfamiliar, the <a href="/how-to-play">rules page</a> covers the mechanics in full.</p>
`;

// ---------- About ----------
const aboutEn = `
<h1>About Tangerine 10</h1>
<p class="updated">Last updated: October 20, 2026</p>

<h2>What this is</h2>
<p>Tangerine 10 is a free browser puzzle. A grid fills with numbered tangerines, and you drag a rectangle around any group whose numbers add up to exactly ten. Clear as many as you can before the 120-second timer runs out. There is no sign-up, no download, and no app store.</p>
<p>The make-ten rule is not new: puzzles where you drag a box over numbers that add up to ten are often called the apple game or fruit box. This version keeps the format short — two minutes, one board, a score you can compare — and adds a combo multiplier that rewards clearing without pauses.</p>

<h2>Who runs it</h2>
<p>Tangerine 10 is made and run by one person, a software engineer in Seoul, as a personal side project outside of work. It is not a company product and has no team or investors behind it. The operator can be reached at <a href="mailto:comeonyourboyz@gmail.com">comeonyourboyz@gmail.com</a> or through the <a href="/contact">contact page</a>.</p>
<p>Because it is a one-person project, bug fixes and new features arrive when there is time.</p>

<h2>How it is made</h2>
<p>The game and this website were built with substantial help from an AI coding assistant (Anthropic's Claude). The assistant wrote much of the code and the first drafts of these pages. The operator decides what gets built, checks the rules against the game's actual code, plays and tests every change, and is responsible for everything published here.</p>
<p>The figures on the <a href="/analysis">analysis pages</a> are not AI estimates. They are the output of a simulation script that runs the game's own board code — 100,000 boards and thousands of automatic games — and those pages are generated directly from the script's output file.</p>

<h2>Why it works this way</h2>
<p><b>Two minutes, not twenty.</b> The timer is short on purpose, so a game fits into a short break.</p>
<p><b>No account.</b> You can play without giving any personal information. Saving a leaderboard score only needs a name you make up.</p>
<p><b>It works on a phone.</b> On narrow screens the board switches to a 12 × 14 layout so each tangerine stays large enough to drag with a thumb.</p>

<h2>How scores are stored</h2>
<p>When your score reaches the top three and you choose to save it, the name you typed, the score and the date are stored in Firebase Realtime Database and shown on the leaderboard. The My History panel exists only in the open page and is not stored anywhere. No email address, phone number or account identity is collected at any point. The <a href="/privacy">privacy policy</a> covers this in full.</p>

<h2>Advertising</h2>
<p>The game is free and there is nothing to buy inside it — no hints, no extra time, no cosmetic items. Hosting is paid for out of pocket, and advertising helps offset that. Ads appear below the page content, never over the board or between rounds. This page, the contact page, the privacy policy and the error page carry no ads.</p>

<h2>Corrections</h2>
<p>If a rule on <a href="/how-to-play">How to Play</a> or an answer in the <a href="/faq">FAQ</a> is wrong or unclear, please say so through the <a href="/contact">contact page</a>.</p>
`;

// ---------- Privacy ----------
const privacyEn = `
<h1>Privacy Policy</h1>
<p class="updated">Last updated: October 20, 2026</p>

<h2>Overview</h2>
<p>This policy explains what Tangerine 10 (tangerin10.web.app, "the site") stores, which third-party services it uses, and how advertising cookies work on it. The site is run by one individual; see the <a href="/about">about page</a>.</p>

<h2>Who the site is for</h2>
<p>Tangerine 10 is a general-audience website for people who enjoy number puzzles. It is not designed for or directed at children, and it does not ask for anyone's age.</p>

<h2>Information we collect</h2>
<p><b>Leaderboard entries.</b> Only if your score reaches the top three and you press Save &amp; Play Again, the name you typed (up to 12 characters), your score and the date are stored in Google Firebase Realtime Database and shown publicly on the leaderboard. Use a nickname if you do not want your real name shown.</p>
<p><b>Nothing else is collected by the game.</b> There is no account, and the game never asks for an email address or phone number. The My History panel exists only in the open page and disappears when you reload it; the game does not write cookies or local storage on your device.</p>

<h2>Advertising and cookies</h2>
<p><b>Google AdSense.</b> This site uses, or may use, Google AdSense to show ads. Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to this website or other websites. Google's use of advertising cookies enables it and its partners to serve ads to you based on your visit to this site and/or other sites on the Internet.</p>
<p>You can opt out of personalised advertising by visiting Google's Ads Settings at <a href="https://adssettings.google.com" target="_blank" rel="noopener">https://adssettings.google.com</a>. You can also opt out of a third-party vendor's use of cookies for personalised advertising by visiting <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener">https://www.aboutads.info/choices</a>. How Google uses information from sites that use its services is explained at <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">policies.google.com/technologies/partner-sites</a>.</p>
<p><b>Kakao AdFit.</b> Some pages show ads from Kakao AdFit. Kakao may use cookies to serve ads based on your prior visits. You can opt out of Kakao's personalised advertising on <a href="https://info.ad.daum.net/optoutko.do" target="_blank" rel="noopener">Kakao's targeted advertising page</a> (in Korean); ads will still appear but may be less relevant.</p>
<p>The site itself does not set cookies. You can block or delete cookies in your browser settings, and the game works without them.</p>

<h2>Other third-party services</h2>
<p><b>Firebase (Google).</b> The site is hosted on Firebase Hosting and the leaderboard uses Firebase Realtime Database. Like any web server, Firebase receives your IP address and browser information when you load a page; see the <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener">Firebase privacy information</a>.</p>
<p><b>Web fonts.</b> Fonts are loaded from Google Fonts and from jsDelivr (cdn.jsdelivr.net), which receive your IP address when they deliver them.</p>
<p><b>Kakao Share SDK.</b> The game page loads Kakao's share library. When you use the Kakao share button, Kakao's privacy policy applies.</p>

<h2>Children</h2>
<p>Because the site is intended for a general audience, we do not knowingly collect personal information from children under 13 (under 14 in Korea). If you believe a child has saved a leaderboard name that identifies them, email us and it will be removed.</p>

<h2>Removing your data</h2>
<p>To remove a leaderboard entry, email the name, score and date shown on the leaderboard. Entries are deleted, not edited.</p>

<h2>Changes to this policy</h2>
<p>This policy may be updated from time to time. Changes are posted on this page with a new date.</p>

<h2>Contact</h2>
<p>Questions about this policy: <a href="mailto:comeonyourboyz@gmail.com">comeonyourboyz@gmail.com</a>, or see the <a href="/contact">contact page</a>.</p>
`;

// ---------- 404 ----------
const notFoundEn = `
<h1>Page not found</h1>
<p class="lead">The page you were looking for does not exist or has moved.</p>
<p>Try one of these instead:</p>
<ul>
  <li><a href="/">Play Tangerine 10</a></li>
  <li><a href="/how-to-play">How to play</a> and the <a href="/strategy">strategy guide</a></li>
  <li><a href="/analysis">Analysis</a> — board statistics, bot strategies and make-ten combinations</li>
  <li><a href="/faq">FAQ</a></li>
</ul>
<p>한국어: <a href="/ko/">귤게임 홈으로 가기</a></p>
`;

// ---------- Analysis 목록 ----------
const analysisEn = `
<nav class="crumb"><a href="/">Home</a> › Analysis</nav>
<h1>Tangerine 10 by the numbers</h1>
<p class="lead">Three studies built from the game's own code: what a random board contains, which play style scores most, and every way to make ten. Each one comes from a simulation script, not from guesswork.</p>
${studyList('en')}
<h2>How these were made</h2>
<p>The script <code>scripts/simulate.mjs</code> copies the line of game code that fills a board — a random whole number from 1 to 9 in every cell — and uses a fixed random seed so the results can be reproduced exactly. It generated ${SIM.boardsPerSize.toLocaleString('en-US')} boards for each board size, and ran four automatic players for ${SIM.gamesPerSetting.toLocaleString('en-US')} games under each of three speed assumptions, using the real 120-second timer, two-second combo window and multiplier table. The pages read their numbers straight from the script's output file.</p>
<p>For the rules themselves, see <a href="/how-to-play">How to Play</a>; for practical habits, the <a href="/strategy">strategy guide</a>.</p>
`;

// ---------- FAQ ----------
const faqs = [
  ['Is Tangerine 10 free?', 'Yes. The game runs in your browser with no sign-up, no download, and no payment. The site is supported by advertising.'],
  ['Do I need to install anything?', 'No. Tangerine 10 is a web page. It works in any modern browser on desktop, tablet, or phone. Adding it to your home screen makes it feel like an app, but nothing is installed.'],
  ['How long is one game?', 'Exactly 120 seconds. The timer starts when you press Start and the board locks the moment it hits zero.'],
  ['Does the sum have to be exactly ten?', 'Yes, exactly ten. A selection adding to 9 or 11 does nothing at all. The game does not clear partial matches.'],
  ['Why did my selection not clear?', 'Three usual reasons. The total was not exactly ten, the rectangle caught an extra tangerine you did not notice, or a tangerine you expected to be inside had its center just outside the box. Selection is decided by the center of each tangerine, not by whether the box touches its edge.'],
  ['How is the score calculated?', 'Score equals the number of tangerines you clear, multiplied by your combo bonus and rounded down. The values on the tangerines do not affect the score, only how many you remove.'],
  ['How does the combo work?', 'Each successful clear adds one to your combo and restarts a two-second timer. The multiplier rises in steps from ×1 up to ×5 once the combo reaches 20; the full table is on the How to Play page. Go two seconds without clearing and the combo resets to zero.'],
  ['What board will I get on a tablet?', 'The board is chosen when the page loads, from the browser window width. 600 pixels or narrower gets the 12 × 14 phone board; anything wider, which includes tablets in portrait and landscape, gets the 10 × 17 board. Rotating the device does not change the board until you reload.'],
  ['Is the board the same every game?', 'No. Every tangerine is assigned a random number from 1 to 9 at the start of each game, so every board is different.'],
  ['Is it possible to clear the whole board?', 'In practice, no. Numbers run out in awkward combinations long before the grid empties, and 120 seconds is short. Clearing the board is not the goal; clearing as many tangerines as possible is.'],
  ['Where are my scores saved?', 'The My History panel keeps your last five games only while the page is open. It is not saved on your device, so reloading clears it. The leaderboard keeps scores on a server, but only the ones players choose to save: when your score makes the top three, a name box appears, and the score is uploaded when you press Save & Play Again.'],
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
  ['about.html', layout({ title: 'About Tangerine 10 — Who Runs It and How It Is Made', desc: 'Who runs Tangerine 10, how the game and this site are made (including the use of an AI coding assistant), how scores are stored, and where ads appear.', path: '/about', alt: '/ko/about', ads: false, body: aboutEn })],
  ['contact.html', layout({ title: 'Contact — Tangerine 10', desc: 'How to reach the person who builds Tangerine 10: bug reports, scoring questions, rule corrections and suggestions.', path: '/contact', alt: '/ko/contact', ads: false, body: `
<h1>Contact</h1>
<p class="updated">Last updated: October 20, 2026</p>

<h2>Email</h2>
<p><a href="mailto:comeonyourboyz@gmail.com">comeonyourboyz@gmail.com</a></p>
<p>Tangerine 10 is built and run by one person, so replies can take a few days.</p>

<h2>What is most useful to send</h2>
<p><b>Bug reports.</b> If the board stops responding, a selection that adds to ten does not clear, or the timer behaves oddly, please include your device and browser. "iPhone 15, Safari" is enough to narrow it down.</p>
<p><b>Scoring questions.</b> If a score looks wrong, tell us roughly what the board looked like and what you expected. Combo multipliers are the usual source of confusion.</p>
<p><b>Corrections.</b> If something on <a href="/how-to-play">How to Play</a>, <a href="/strategy">Strategy</a> or the <a href="/faq">FAQ</a> is wrong or unclear, saying so is genuinely helpful — those pages describe the rules, so an error there misleads everyone.</p>
<p><b>Leaderboard issues.</b> If a name on the board is offensive or a score is obviously fabricated, let us know and it will be removed.</p>

<h2>What we cannot do</h2>
<p>Lost history cannot be restored. The My History panel only lasts while the page is open and is never stored, so there is nothing to recover. Leaderboard entries can be removed on request, but not edited.</p>
<p>Advertising and partnership offers are read but usually go unanswered.</p>

<h2>About the game</h2>
<p>Who makes this and why it works the way it does is covered on the <a href="/about">about page</a>. What data the game stores is in the <a href="/privacy">privacy policy</a>.</p>
` })],
  ['faq.html', layout({ title: 'Tangerine 10 FAQ — Rules, Scoring and Common Questions', desc: 'Answers to common Tangerine 10 questions: game length, why a selection did not clear, how scoring and combos work, and where scores are saved.', path: '/faq', alt: '/ko/faq', body: faqBody, ld: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] })],
  ['privacy.html', layout({ title: 'Privacy Policy — Tangerine 10', desc: 'What Tangerine 10 stores, how Google AdSense and other advertising cookies are used, how to opt out of personalised ads, and how to remove a leaderboard entry.', path: '/privacy', alt: '/ko/privacy', ads: false, noindex: true, body: privacyEn })],
  ['404.html', layout({ title: 'Page not found — Tangerine 10', desc: 'This page does not exist. Go back to the Tangerine 10 game, rules or analysis.', path: '/404', ads: false, noindex: true, body: notFoundEn })],
  ['analysis.html', layout({ title: 'Tangerine 10 Analysis — Board Statistics, Bot Strategies and Combinations', desc: 'Simulation studies of Tangerine 10 built from the game code: 100,000 random boards, four automatic players under the real scoring rules, and every combination that makes ten.', path: '/analysis', alt: '/ko/analysis', body: analysisEn })],
  ...Object.keys(ARTICLES).map((id) => { const a = ARTICLES[id].en; return [`${a.path.slice(1)}.html`, layout({ title: a.title, desc: a.desc, path: a.path, alt: ARTICLES[id].ko.path, body: articleBody[id].en(), ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: a.h1, description: a.desc, inLanguage: 'en', datePublished: '2026-10-20', mainEntityOfPage: SITE.url + a.path, author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url } }] })]; }),
];
for (const [name, html] of pages) writeFileSync(join(OUT, name), html);

// ---------- 한국어 페이지 ----------
const analysisKo = `
<nav class="crumb"><a href="/ko/">홈</a> › 분석</nav>
<h1>숫자로 보는 귤게임</h1>
<p class="lead">게임 코드로 직접 돌린 연구 세 편입니다. 무작위 판에 무엇이 들어 있는지, 어떤 방식이 점수가 가장 높은지, 10을 만드는 방법이 몇 가지인지. 모두 짐작이 아니라 시뮬레이션 스크립트에서 나온 결과입니다.</p>
${studyList('ko')}
<h2>어떻게 만들었나</h2>
<p><code>scripts/simulate.mjs</code> 스크립트는 판을 채우는 게임 코드 한 줄(칸마다 1~9 무작위 정수)을 그대로 옮기고, 결과를 똑같이 다시 만들 수 있게 난수 시드를 고정합니다. 판 크기마다 ${SIM.boardsPerSize.toLocaleString('en-US')}개의 판을 만들었고, 자동 플레이 봇 네 개를 속도 가정 세 가지로 각각 ${SIM.gamesPerSetting.toLocaleString('en-US')}판씩 실제 120초 타이머·2초 콤보·배율 표대로 돌렸습니다. 각 페이지는 스크립트의 결과 파일에서 숫자를 바로 읽어 만듭니다.</p>
<p>규칙은 <a href="/ko/how-to-play">게임 방법</a>에, 실전 습관은 <a href="/ko/strategy">공략</a>에 있습니다.</p>
`;
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
  ['ko/about.html', layout({ lang: 'ko', title: '귤게임 Tangerine 10 소개 — 누가, 어떻게 만들었나', desc: '귤게임 Tangerine 10을 누가 운영하는지, 어떻게 만들었는지(AI 도구 사용 포함), 점수는 어떻게 저장되는지, 광고는 어디에 나오는지.', path: '/ko/about', alt: '/about', ads: false, body: aboutKo })],
  ['ko/contact.html', layout({ lang: 'ko', title: '문의하기 — 귤게임 Tangerine 10', desc: '귤게임 Tangerine 10 운영자에게 버그 신고, 점수 문의, 규칙 정정, 제안을 보내는 방법.', path: '/ko/contact', alt: '/contact', ads: false, body: contactKo })],
  ['ko/privacy.html', layout({ lang: 'ko', title: '개인정보처리방침 — 귤게임 Tangerine 10', desc: '귤게임 Tangerine 10이 저장하는 정보, Google 애드센스 등 광고 쿠키 사용과 맞춤 광고 거부 방법, 랭킹 기록 삭제 방법.', path: '/ko/privacy', alt: '/privacy', body: privacyKo, noindex: true, ads: false })],
  ['ko/analysis.html', layout({ lang: 'ko', title: '귤게임 분석 — 판 통계·봇 전략·합 10 조합', desc: '게임 코드로 돌린 귤게임 Tangerine 10 시뮬레이션 연구. 무작위 판 10만 개, 실제 점수 규칙으로 움직이는 자동 플레이 봇 네 개, 합이 10이 되는 모든 조합.', path: '/ko/analysis', alt: '/analysis', body: analysisKo })],
  ...Object.keys(ARTICLES).map((id) => { const a = ARTICLES[id].ko; return [`${a.path.slice(1)}.html`, layout({ lang: 'ko', title: a.title, desc: a.desc, path: a.path, alt: ARTICLES[id].en.path, body: articleBody[id].ko(), ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: a.h1, description: a.desc, inLanguage: 'ko', datePublished: '2026-10-20', mainEntityOfPage: SITE.url + a.path, author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url } }] })]; }),
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
  ['records.html', layout({ title: 'Tangerine 10 Records — Weekly Best and All-Time Top 10', desc: 'Saved Tangerine 10 scores: this week\'s best, the all-time top ten and saved games by month, updated from the live leaderboard.', path: '/records', alt: '/ko/records', noindex: true, ads: false, body: recordsBody('en') })],
  ['ko/records.html', layout({ lang: 'ko', title: '귤게임 기록 — 이번 주 최고 점수와 역대 순위', desc: '귤게임 Tangerine 10에 저장된 점수 모음. 이번 주 최고 점수, 역대 상위 10위, 달마다 저장된 판 수를 랭킹에서 바로 가져와 보여 줍니다.', path: '/ko/records', alt: '/records', noindex: true, ads: false, body: recordsBody('ko') })],
];
for (const [name, html] of recordPages) writeFileSync(join(OUT, name), html);

// ---------- 한국어 게임 화면 (/ko/) ----------
// 영문 게임 화면(public/index.html)을 읽어 보이는 문구만 바꾼다. 게임 코드는 한 벌만 유지.
// 바꿀 문구를 못 찾으면 빌드를 멈춘다 — 영문 화면이 바뀌었는데 한국어 판이 조용히 영어로 남는 것을 막기 위해서다.
// 홈(영문·한국어) 본문의 분석 요약 블록. 수치는 시뮬레이션 결과 파일에서 가져온다.
const homeAnalysis = (lang) => `<!-- analysis:start -->
<section class="numbers" aria-labelledby="num-h">
  <div class="wrap">
  <h2 id="num-h">${lang === 'ko' ? '숫자로 본 귤게임' : 'What the numbers say'}</h2>
  <p class="lead">${lang === 'ko' ? '게임의 판 만드는 코드를 그대로 돌려 판 10만 개와 자동 플레이 수천 판을 시뮬레이션했습니다. 결과는 세 편의 글로 정리했습니다.' : 'We ran the game\'s own board code through 100,000 simulated boards and thousands of automatic games. The results are written up in three studies.'}</p>
  ${studyList(lang)}
  </div>
</section>
<!-- analysis:end -->`;
// 영문 게임 화면: 공통 스타일·글꼴·머리글·바닥글·분석 띠를 채운다(게임 코드와 문구는 그대로).
{
  const p = join(OUT, 'index.html');
  let src = readFileSync(p, 'utf8');
  const fill = (re, to, what) => { if (!re.test(src)) throw new Error(`영문 게임 화면: ${what} 표시를 찾지 못함`); src = src.replace(re, () => to); };
  fill(/<!-- analysis:start -->[\s\S]*?<!-- analysis:end -->/, homeAnalysis('en'), 'analysis');
  fill(/\/\* ds:start[^*]*\*\/[\s\S]*?\/\* ds:end \*\//, `/* ds:start — 공통 디자인 토큰·머리글·바닥글. scripts/build-content.mjs 가 빌드 때 이 구간을 덮어쓴다. */${DS_CSS}/* ds:end */`, 'ds');
  fill(/<!-- fonts:start -->[\s\S]*?<!-- fonts:end -->/, `<!-- fonts:start -->${FONTS}<!-- fonts:end -->`, 'fonts');
  fill(/<header class="top site-nav">[\s\S]*?<\/header>/, siteHeader('en', '/', '/ko/'), 'header');
  fill(/<footer class="foot site-ftr">[\s\S]*?<\/footer>/, siteFooter('en', '/ko/'), 'footer');
  writeFileSync(p, src);
}
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
  block(/<meta name="description" content="[^"]*">/, '<meta name="description" content="2분 동안 합이 10이 되는 숫자를 골라 없애는 무료 숫자 퍼즐 게임입니다. 전 세계 랭킹에 도전해 보세요.">');
  block(/<meta name="keywords" content="[^"]*">/, '<meta name="keywords" content="귤게임, 숫자 10 만들기, 사과게임, 숫자 퍼즐, 무료 게임, 두뇌 게임, Tangerine 10">');
  sub('<title>Tangerine 10 — Number Puzzle Game</title>', `<title>${TITLE}</title>`);
  sub('<meta property="og:title" content="Tangerine 10 — Number Puzzle Game">', `<meta property="og:title" content="${TITLE}">`);
  sub('<meta name="twitter:title" content="Tangerine 10 — Number Puzzle Game">', `<meta name="twitter:title" content="${TITLE}">`);
  block(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="2분 동안 합이 10이 되는 숫자를 골라 없애는 무료 숫자 퍼즐 게임입니다. 전 세계 랭킹에 도전해 보세요.">');
  block(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="2분 동안 합이 10이 되는 숫자를 골라 없애는 무료 숫자 퍼즐 게임입니다. 전 세계 랭킹에 도전해 보세요.">');
  sub('<meta property="og:url" content="https://tangerin10.web.app">', '<meta property="og:url" content="https://tangerin10.web.app/ko/">');
  sub('<meta property="og:locale" content="en_US">', '<meta property="og:locale" content="ko_KR">');
  sub('<meta property="og:image:alt" content="Tangerine 10 number puzzle">', '<meta property="og:image:alt" content="귤게임 Tangerine 10 숫자 퍼즐">');
  sub('<link rel="canonical" href="https://tangerin10.web.app/">', '<link rel="canonical" href="https://tangerin10.web.app/ko/">');
  sub('"inLanguage":"en"}', '"inLanguage":"ko"}');
  sub('"description":"Free number puzzle game! Drag and match numbers that add up to 10. 2-minute challenge with global ranking."', '"description":"합이 10이 되게 귤을 묶어 터뜨리는 무료 숫자 퍼즐. 2분 도전과 전체 랭킹."');
  block(/<header class="top site-nav">[\s\S]*?<\/header>/, () => siteHeader('ko', '/ko/', '/'));
  block(/<div class="intro">[\s\S]*?<\/div>/, `<div class="intro">
    <h1>귤게임 Tangerine 10 — 2분 동안 숫자 합 10 만들기</h1>
    <p>합이 정확히 10이 되는 귤들을 네모로 묶으면 터집니다. <a href="/ko/how-to-play">전체 규칙</a></p>
  </div>`);
  sub('<section class="status" aria-label="Time and score">', '<section class="status" aria-label="남은 시간과 점수">');
  sub('<small class="clock-label">Time left</small>', '<small class="clock-label">남은 시간</small>');
  sub('<small class="score-label">Score</small>', '<small class="score-label">점수</small>');
  sub('<span class="restart-label">Restart</span>', '<span class="restart-label">새 판</span>');
  block(/<div class="hint">[\s\S]*?<\/div>/, '<div class="hint"><span>합이 10이 되게 드래그해서 묶으세요</span><span>빈칸은 합에서 빠집니다</span></div>');
  block(/<section class="howto"[\s\S]*?<\/section>/, () => `<section class="howto" aria-labelledby="howto-h">
    <h2 id="howto-h">30초 규칙 요약</h2>
    <ol class="rules">
      <li>누른 채 끌어서 네모를 그립니다. 귤의 가운데가 네모 안에 들어오면 선택됩니다.</li>
      <li>선택한 숫자의 합이 정확히 10일 때 손을 떼세요. 9나 11은 아무 일도 없습니다.</li>
      <li>터진 자리는 빈칸이 되고, 빈칸은 다음 선택에서 빠집니다. 판이 빌수록 쉬워집니다.</li>
      <li>120초가 되면 시계가 멈추고 점수가 확정됩니다.</li>
    </ol>
    <a class="more" href="/ko/how-to-play">전체 규칙 &rarr;</a>
  </section>`);
  sub('>Top scores<', '>최고 점수<');
  sub('>My history<', '>내 기록<');
  sub('No scores yet', '아직 기록이 없어요', 2);
  sub('No games yet', '아직 플레이 기록이 없어요', 2);
  block(/<!-- analysis:start -->[\s\S]*?<!-- analysis:end -->/, () => homeAnalysis('ko'));
  block(/<section class="about"[\s\S]*?<\/section>/, () => `<section class="about" aria-labelledby="about-h">
  <h2 id="about-h">귤게임 Tangerine 10은요</h2>
  <div class="body">
    <p>Tangerine 10은 규칙 하나로 하는 무료 브라우저 퍼즐입니다. 숫자의 합이 <b>정확히 10</b>이 되는 귤들에 네모를 그리면 터집니다. 시간은 120초. 회원가입도, 설치도, 앱스토어도 없습니다.</p>
    <p>판을 시작할 때마다 1부터 9까지 숫자가 적힌 귤이 새로 깔립니다. PC와 태블릿은 170개, 휴대폰은 168개라 같은 판을 다시 할 일은 없습니다. 내 기록 칸은 페이지가 열려 있는 동안 최근 다섯 판을 보여 줍니다. 점수가 3위 안에 들면 이름 칸이 나오고, 저장하고 다시 하기를 누르면 랭킹에 올라갑니다.</p>
    <p>점수는 터뜨린 귤의 개수에, 마지막으로 터뜨린 뒤 2초 안에 이어서 터뜨리는 동안 커지는 콤보 배율을 곱한 값입니다. 배율 전체 표는 <a href="/ko/how-to-play">게임 방법</a>에, 콤보를 이어 가는 습관은 <a href="/ko/strategy">공략</a>에 있습니다.</p>
    <nav class="links" aria-label="더 읽기">
      <a href="/ko/how-to-play">전체 규칙 &rarr;</a><a href="/ko/strategy">공략 &rarr;</a><a href="/ko/analysis">분석 &rarr;</a><a href="/ko/faq">자주 묻는 질문 &rarr;</a>
    </nav>
  </div>
</section>`);
  block(/<footer class="foot site-ftr">[\s\S]*?<\/footer>/, () => siteFooter('ko', '/'));
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
  sub('aria-label="Share on X"', 'aria-label="X로 공유"');
  sub('aria-label="Share on KakaoTalk"', 'aria-label="카카오톡으로 공유"');
  sub('aria-label="Share on Facebook"', 'aria-label="페이스북으로 공유"');
  sub('aria-label="Copy link"', 'aria-label="링크 복사"');
  sub("var SHARE_URL='https://tangerin10.web.app?v='+Date.now();", "var SHARE_URL='https://tangerin10.web.app/ko/?v='+Date.now();");
  writeFileSync(join(OUT, 'ko', 'index.html'), g);
}

const today = new Date().toISOString().slice(0, 10);
const urls = [
  // 기록(/records) 페이지는 noindex 라 넣지 않는다.
  ['/', '1.0', 'weekly'], ['/how-to-play', '0.8', 'monthly'], ['/strategy', '0.8', 'monthly'], ['/analysis', '0.7', 'monthly'], ...Object.values(ARTICLES).map((a) => [a.en.path, '0.7', 'monthly']), ['/faq', '0.7', 'monthly'], ['/about', '0.6', 'yearly'], ['/contact', '0.5', 'yearly'],
  ['/ko/', '1.0', 'weekly'], ['/ko/how-to-play', '0.8', 'monthly'], ['/ko/strategy', '0.8', 'monthly'], ['/ko/analysis', '0.7', 'monthly'], ...Object.values(ARTICLES).map((a) => [a.ko.path, '0.7', 'monthly']), ['/ko/faq', '0.7', 'monthly'], ['/ko/about', '0.6', 'yearly'], ['/ko/contact', '0.5', 'yearly'],
];
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([l, p, f]) => `  <url><loc>${SITE.url}${l}</loc><lastmod>${today}</lastmod><changefreq>${f}</changefreq><priority>${p}</priority></url>`).join('\n')}\n</urlset>\n`);

const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log('✔ 콘텐츠 페이지 생성');
for (const [name, html] of [...pages, ...pagesKo, ...recordPages]) console.log(`  ${name.padEnd(20)} 본문 ${strip(html).length.toLocaleString()}자`);
console.log(`  기록: ${RANKS ? `랭킹 ${RANKS.length}건 반영` : '랭킹을 불러오지 못해 브라우저에서 채움'}`);
console.log(`  sitemap.xml 항목 ${urls.length}개`);
