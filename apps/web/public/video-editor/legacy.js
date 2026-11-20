function rng(seed){ let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function sampleURL(sc){
  const r = rng(sc.seed * 9973 + 11), R = (a, b) => a + r() * (b - a), I = (a, b) => Math.round(R(a, b));
  const pals = [['#f3c26b','#c8642a','#4f2710'],['#f0d58a','#b5651d','#3e2a14'],['#e9b44c','#9c3d1a','#2f2416'],['#f6d9a0','#d07a2d','#4a2f1a'],['#dfc27a','#8a6a2a','#2b2a17']];
  const p = pals[sc.seed % pals.length];
  const leaf = ['#d9822b','#c0451f','#e3b23c','#8f2d14','#b8860b','#6b7a2a','#e8c35a'];
  const L = () => leaf[Math.floor(r() * leaf.length)];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><defs>` +
    `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset=".55" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient>` +
    `<radialGradient id="s"><stop offset="0" stop-color="#fff6d8" stop-opacity=".95"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient>` +
    `<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16"/></filter><filter id="b2"><feGaussianBlur stdDeviation="3.5"/></filter></defs>` +
    `<rect width="1600" height="900" fill="url(#g)"/>` +
    `<circle cx="${I(300,1300)}" cy="${I(140,380)}" r="${I(320,540)}" fill="url(#s)"/>`;
  if (sc.variant === 'macro') {
    s += `<g filter="url(#b)">`;
    for (let i = 0; i < 34; i++) s += `<circle cx="${I(0,1600)}" cy="${I(0,700)}" r="${I(30,120)}" fill="${L()}" opacity="${R(.18,.5).toFixed(2)}"/>`;
    s += `</g><path d="M0 900V${I(640,700)}C400 ${I(600,680)} 1100 ${I(680,760)} 1600 ${I(620,700)}V900Z" fill="#1c1209"/>`;
    for (let i = 0; i < 9; i++) {
      const x = I(80, 1520), y = I(640, 840), w = I(70, 170), a = I(-60, 60), c = L();
      s += `<g transform="translate(${x} ${y}) rotate(${a})"><ellipse rx="${w}" ry="${Math.round(w * .42)}" fill="${c}"/><path d="M${-w} 0H${w}" stroke="#3a1c0b" stroke-width="3" opacity=".55"/></g>`;
    }
    const mx = I(500, 1100), my = I(600, 680);
    s += `<rect x="${mx - 16}" y="${my}" width="32" height="130" rx="14" fill="#efe2c8"/><path d="M${mx - 110} ${my + 8}C${mx - 90} ${my - 96} ${mx + 90} ${my - 96} ${mx + 110} ${my + 8}Z" fill="#a8431d"/>`;
  } else {
    s += `<g filter="url(#b2)" opacity=".5">`;
    for (let i = 0; i < 16; i++) s += `<rect x="${I(0,1600)}" y="0" width="${I(12,30)}" height="900" fill="#3a2415"/>`;
    s += `</g><g filter="url(#b2)">`;
    for (let i = 0; i < 70; i++) s += `<circle cx="${I(0,1600)}" cy="${I(-40,430)}" r="${I(40,125)}" fill="${L()}" opacity="${R(.3,.7).toFixed(2)}"/>`;
    s += `</g>`;
    for (let i = 0; i < 4; i++) { const x = I(100, 1500); s += `<polygon points="${x},0 ${x + I(40,90)},0 ${x - I(260,420)},900 ${x - I(480,620)},900" fill="#fff8e0" opacity=".07"/>`; }
    for (let i = 0; i < 5; i++) { const x = I(40, 1500), w = I(48, 112); s += `<path d="M${x} 0H${x + w}L${x + w + I(4,18)} 900H${x - I(4,18)}Z" fill="#1e130b"/>`; }
    s += `<path d="M0 900V${I(740,790)}C420 ${I(700,770)} 1050 ${I(770,830)} 1600 ${I(730,790)}V900Z" fill="#1a110a"/>`;
    for (let i = 0; i < 60; i++) s += `<ellipse cx="${I(0,1600)}" cy="${I(775,895)}" rx="${I(8,22)}" ry="${I(4,10)}" fill="${L()}" opacity="${R(.5,.95).toFixed(2)}" transform="rotate(${I(-40,40)} ${I(0,1600)} 830)"/>`;
  }
  s += `<text x="1572" y="878" text-anchor="end" font-family="Segoe UI,Arial,sans-serif" font-size="22" letter-spacing="3" fill="#fff" opacity=".5">ÖRNEK SAHNE</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
}

