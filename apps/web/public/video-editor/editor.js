/* Mavi Kadraj — all media stays on this device. No runtime network requests. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (v,a,b) => Math.max(a,Math.min(b,Number(v)));
const num = (v,d,a,b) => Number.isFinite(Number(v)) ? clamp(v,a,b) : d;
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2);
const fmt = t => `${String(Math.floor(Math.max(0,t)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
const fonts = {hand:'"Segoe Print", "Comic Sans MS", cursive',typewriter:'"Courier New", monospace',plain:'"Segoe UI", Arial, sans-serif'};
// Yazı stili ön ayarları. Ölçüler yazı boyutuna oranlıdır (em); önizleme ve dışa aktarma aynı paintText işlevini kullanır.
// fill: renk ya da [üst,alt] degrade · outer/stroke: kontur · shadow/glow: gölge/parlama · extrude: 3B kalınlık · box: satır arkası etiket.
const SANS='"Segoe UI",Arial,sans-serif',IMPACT='Impact,"Arial Narrow Bold","Arial Black",sans-serif',BLACK='"Arial Black","Segoe UI Black",Impact,sans-serif',SERIF='Georgia,"Times New Roman",serif',MONO='"Courier New",Consolas,monospace',HAND='"Segoe Print","Comic Sans MS",cursive';
// Gömülü el yazısı fontları (fonts/ klasörü, OFL). Yedek olarak sistem el yazısı fontları kullanılır.
const CAVEAT='Caveat,"Segoe Script","Segoe Print",cursive',DANCING='"Dancing Script","Segoe Script",cursive',VIBES='"Great Vibes","Segoe Script",cursive',PACIFICO='Pacifico,"Segoe Script",cursive',KAUSHAN='"Kaushan Script","Segoe Script",cursive',MARCK='"Marck Script","Segoe Script",cursive',COURGETTE='Courgette,"Segoe Script",cursive',PATRICK='"Patrick Hand","Segoe Print",cursive',SACRA='Sacramento,"Segoe Script",cursive',KALAM='Kalam,"Segoe Print",cursive',AMATIC='"Amatic SC","Segoe Print",cursive';
const FONT_LIST=["Caveat","Dancing Script","Great Vibes","Pacifico","Kaushan Script","Marck Script","Courgette","Patrick Hand","Sacramento","Kalam","Amatic SC","Bebas Neue","Anton","Oswald","Staatliches","Playfair Display","Abril Fatface","DM Serif Display","Yeseva One","Cormorant Garamond","Cinzel","Alfa Slab One","Bungee","Baloo 2","Rubik","Montserrat","Righteous","Audiowide","Exo 2","Monoton","Lobster","Bangers","Special Elite","Pirata One"];
const F=(n,fb)=>'"'+n+'",'+fb;const FB_SANS='"Segoe UI",Arial,sans-serif',FB_SERIF='Georgia,serif',FB_DISPLAY='Impact,"Arial Black",sans-serif';
const BEBAS=F('Bebas Neue',FB_DISPLAY),ANTON=F('Anton',FB_DISPLAY),OSWALD=F('Oswald',FB_DISPLAY),STAAT=F('Staatliches',FB_DISPLAY),PLAYFAIR=F('Playfair Display',FB_SERIF),ABRIL=F('Abril Fatface',FB_SERIF),DMSERIF=F('DM Serif Display',FB_SERIF),YESEVA=F('Yeseva One',FB_SERIF),CORMORANT=F('Cormorant Garamond',FB_SERIF),CINZEL=F('Cinzel',FB_SERIF),ALFA=F('Alfa Slab One',FB_SERIF),BUNGEE=F('Bungee',FB_DISPLAY),BALOO=F('Baloo 2',FB_SANS),RUBIK=F('Rubik',FB_SANS),MONTSERRAT=F('Montserrat',FB_SANS),RIGHTEOUS=F('Righteous',FB_SANS),AUDIOWIDE=F('Audiowide',FB_SANS),EXO=F('Exo 2',FB_SANS),MONOTON=F('Monoton',FB_DISPLAY),LOBSTER=F('Lobster','cursive'),BANGERS=F('Bangers',FB_DISPLAY),ELITE=F('Special Elite','"Courier New",monospace'),PIRATA=F('Pirata One',FB_SERIF);
const STYLE_CATS=['Temel','Parlayan','3B ve Baskı','Etiket ve Bant','El Yazısı','Renkli','Animasyonlu'];
const TEXT_STYLES=[
 // Temel
 {id:'none',cat:'Temel',name:'Varsayılan'},
 {id:'kalin-beyaz',cat:'Temel',name:'Kalın Beyaz',font:MONTSERRAT,weight:900,scale:.92,upper:1,fill:'#ffffff',stroke:{c:'#000',w:.16},shadow:{c:'#0009',b:.12,y:.06}},
 {id:'klasik-serif',cat:'Temel',name:'Klasik Serif',font:PLAYFAIR,weight:600,scale:.95,fill:'#ffffff',shadow:{c:'#000b',b:.14,y:.06}},
 {id:'zarif-ince',cat:'Temel',name:'Zarif İnce',font:CINZEL,weight:400,scale:.92,upper:1,spacing:.2,fill:'#ffffff',shadow:{c:'#0009',b:.2,y:.04}},
 {id:'okunur-bant',cat:'Temel',name:'Okunur Bant',font:BALOO,weight:600,fill:'#ffffff',box:{c:'#000000b3',pad:.4,r:.18}},
 {id:'sade-koyu',cat:'Temel',name:'Sade Koyu',font:OSWALD,weight:600,scale:1.05,fill:'#14181f',shadow:{c:'#ffffffb0',b:.16,y:0}},
 // Parlayan
 {id:'neon-camgobegi',cat:'Parlayan',name:'Neon Camgöbeği',font:AUDIOWIDE,weight:400,scale:.85,fill:'#e8ffff',glow:{c:'#14e0ff',b:.4,n:3}},
 {id:'neon-pembe',cat:'Parlayan',name:'Neon Pembe',font:LOBSTER,weight:400,scale:1.05,fill:'#ffffff',glow:{c:'#ff2bd6',b:.42,n:3}},
 {id:'neon-tup',cat:'Parlayan',name:'Neon Tüp',font:MONOTON,weight:400,scale:.78,fill:'#fff0fb',glow:{c:'#ff4bd8',b:.45,n:3}},
 {id:'neon-yesil',cat:'Parlayan',name:'Neon Yeşil',font:RIGHTEOUS,weight:400,upper:1,spacing:0.04,fill:'#eaffe9',glow:{c:'#35ff6b',b:.4,n:3}},
 {id:'kirmizi-parlama',cat:'Parlayan',name:'Kırmızı Parlama',font:BEBAS,weight:400,scale:1.25,upper:1,spacing:.05,fill:'#ffffff',glow:{c:'#ff2a2a',b:.36,n:3},stroke:{c:'#ff4040',w:.04}},
 {id:'yumusak-isik',cat:'Parlayan',name:'Yumuşak Işık',font:CORMORANT,weight:600,italic:1,scale:1.25,fill:'#fff4fb',glow:{c:'#ff9ad9',b:.45,n:2}},
 {id:'altin-isima',cat:'Parlayan',name:'Altın Işıma',font:CINZEL,weight:700,scale:.92,upper:1,fill:'#fff3c4',glow:{c:'#ffae00',b:.45,n:3}},
 {id:'mor-isima',cat:'Parlayan',name:'Mor Işıma',font:ABRIL,weight:400,scale:1,fill:'#ffffff',glow:{c:'#9b5cff',b:.45,n:3},stroke:{c:'#c9a8ff',w:.03}},
 {id:'ates',cat:'Parlayan',name:'Ateş',font:ANTON,weight:400,scale:1,upper:1,fill:['#fff2a8','#ff5a1f'],glow:{c:'#ff3d00',b:.38,n:2}},
 // 3B ve Baskı
 {id:'retro-3b',cat:'3B ve Baskı',name:'Retro 3B',font:BUNGEE,weight:400,scale:.85,upper:1,fill:'#ffd23f',stroke:{c:'#2b1a0f',w:.07},extrude:{c:'#9a3b12',n:7,x:.07,y:.09}},
 {id:'mavi-3b',cat:'3B ve Baskı',name:'Mavi Kabartma',font:CINZEL,weight:900,scale:.92,upper:1,fill:'#9fdcff',stroke:{c:'#0a2a66',w:.06},extrude:{c:'#1747b8',n:7,x:.07,y:.09}},
 {id:'pembe-3b',cat:'3B ve Baskı',name:'Pembe Tatlı',font:LOBSTER,weight:400,scale:1.1,fill:'#ffc9ee',stroke:{c:'#4a0a3a',w:.08},extrude:{c:'#c2188f',n:7,x:.06,y:.08}},
 {id:'altin-kabartma',cat:'3B ve Baskı',name:'Altın Kabartma',font:PLAYFAIR,weight:900,scale:.95,fill:['#fff3a8','#d89a1e'],stroke:{c:'#5a3a00',w:.06},extrude:{c:'#7a5200',n:5,x:.04,y:.06}},
 {id:'cizgi-film',cat:'3B ve Baskı',name:'Çizgi Film',font:BANGERS,weight:400,scale:1.1,upper:1,spacing:.04,fill:'#fff44f',stroke:{c:'#000',w:.12},extrude:{c:'#000',n:6,x:.06,y:.08}},
 {id:'eski-baski',cat:'3B ve Baskı',name:'Eski Baskı',font:ALFA,weight:400,scale:.9,fill:'#f4e3bd',stroke:{c:'#4a2c12',w:.08},shadow:{c:'#2a1608cc',b:.06,x:.04,y:.05}},
 {id:'gotik',cat:'3B ve Baskı',name:'Gotik',font:PIRATA,weight:400,scale:1.3,fill:'#f1f1f1',stroke:{c:'#111',w:.08},extrude:{c:'#6b0f0f',n:4,x:.04,y:.06}},
 {id:'balon-yazi',cat:'3B ve Baskı',name:'Balon',font:BALOO,weight:800,scale:1.05,fill:'#ffffff',stroke:{c:'#2a7bff',w:.2},shadow:{c:'#0007',b:.12,y:.08}},
 {id:'cizgi-yazi',cat:'3B ve Baskı',name:'Çizgi Yazı',font:BEBAS,weight:400,scale:1.25,upper:1,spacing:.08,fill:'rgba(255,255,255,0)',stroke:{c:'#ffffff',w:.055}},
 {id:'blok-golge',cat:'3B ve Baskı',name:'Blok Gölge',font:ANTON,weight:400,upper:1,spacing:.03,fill:'#ffffff',extrude:{c:'#e0245e',n:9,x:.09,y:.1}},
 {id:'sinema-3b',cat:'3B ve Baskı',name:'Sinema Kırmızı',font:PLAYFAIR,weight:900,italic:1,scale:.95,fill:'#fff3df',stroke:{c:'#5a0a0a',w:.06},extrude:{c:'#a30f1f',n:6,x:.05,y:.07}},
 // Etiket ve Bant (box: c renk/degrade, pad yatay boşluk, r köşe, h/dy yükseklik ve kayma, border çerçeve, outer dış bant, drop sert gölge; tilt eğim derecesi)
 {id:'etiket-mavi',cat:'Etiket ve Bant',name:'Mavi Etiket',font:RUBIK,weight:700,scale:1,spacing:.03,upper:1,fill:'#ffffff',box:{c:'#1d5fe0',pad:.35,r:.14}},
 {id:'etiket-sari',cat:'Etiket ve Bant',name:'Sarı Etiket',font:MONTSERRAT,weight:800,scale:.92,fill:'#111111',box:{c:'#ffd81a',pad:.35,r:.14}},
 {id:'etiket-pembe',cat:'Etiket ve Bant',name:'Pembe Hap',font:BALOO,weight:700,fill:'#ffffff',box:{c:'#ff3d8b',pad:.5,r:.62}},
 {id:'yesil-blok',cat:'Etiket ve Bant',name:'Yeşil Blok',font:EXO,weight:700,fill:'#ffffff',box:{c:'#0f5a2a',pad:.42,r:.04}},
 {id:'cift-hap',cat:'Etiket ve Bant',name:'Çift Hap',font:BANGERS,weight:400,scale:1.1,upper:1,spacing:.04,fill:'#ffffff',box:{c:'#111111',pad:.5,r:.7,outer:{c:'#8a8a1e',pad:.16}}},
 {id:'cerceve',cat:'Etiket ve Bant',name:'Çerçeve',font:CINZEL,weight:600,scale:.92,upper:1,spacing:.12,fill:'#ffffff',box:{pad:.5,r:.1,border:{c:'#ffffff',w:.045}}},
 {id:'gradyan-bant',cat:'Etiket ve Bant',name:'Turuncu Bant',font:OSWALD,weight:600,scale:1.05,upper:1,spacing:.06,fill:'#ffffff',box:{c:['#ff8a1f','#e0245e'],pad:.5,r:.2}},
 {id:'fosforlu-sari',cat:'Etiket ve Bant',name:'Fosforlu Sarı',font:DMSERIF,weight:400,fill:'#141414',box:{c:'#ffe94a',h:.72,dy:-.3,pad:.15,r:.12}},
 {id:'fosforlu-pembe',cat:'Etiket ve Bant',name:'Fosforlu Pembe',font:RIGHTEOUS,weight:400,fill:'#ffffff',box:{c:'#ff4fa3',h:.58,dy:-.1,pad:.2,r:.3}},
 {id:'alti-cizgili',cat:'Etiket ve Bant',name:'Altı Çizgili',font:LOBSTER,weight:400,scale:1.05,fill:'#ffffff',shadow:{c:'#0008',b:.1,y:.04},box:{c:'#ff3d8b',h:.09,dy:.58,pad:.05,r:.05}},
 {id:'washi-bant',cat:'Etiket ve Bant',name:'Bant',font:CAVEAT,weight:700,scale:1.3,tilt:-3,fill:'#3a2d12',box:{c:'#f4d86bdd',pad:.55,r:.03}},
 {id:'cikartma-etiket',cat:'Etiket ve Bant',name:'Sert Gölge',font:YESEVA,weight:400,fill:'#111111',box:{c:'#ffffff',pad:.4,r:.08,border:{c:'#111111',w:.06},drop:{c:'#111111',x:.09,y:.11}}},
 {id:'siyah-hap',cat:'Etiket ve Bant',name:'Siyah Hap',font:EXO,weight:700,fill:'#ffffff',box:{c:'#0b0b0b',pad:.55,r:.7,border:{c:'#ffffff',w:.04}}},
 {id:'egik-serit',cat:'Etiket ve Bant',name:'Eğik Şerit',font:ANTON,weight:400,upper:1,spacing:.05,tilt:-4,fill:'#ffffff',box:{c:'#e11d2e',pad:.5,r:.03}},
 {id:'altin-bilet',cat:'Etiket ve Bant',name:'Altın Bilet',font:ABRIL,weight:400,fill:'#3a2200',box:{c:['#fbe38e','#f0a04b'],pad:.5,r:.12,border:{c:'#7a4a00',w:.035}}},
 {id:'daktilo-not',cat:'Etiket ve Bant',name:'Daktilo Notu',font:ELITE,weight:400,scale:.95,fill:'#f5f5f5',box:{c:'#1b1b1bd9',pad:.3,r:.04}},
 {id:'kagit-not',cat:'Etiket ve Bant',name:'Kâğıt Not',font:KALAM,weight:400,scale:1,fill:'#2b2118',box:{c:'#f6ecd2',pad:.35,r:.05}},
 {id:'mektup',cat:'Etiket ve Bant',name:'Mektup',font:CORMORANT,weight:600,italic:1,scale:1.25,fill:'#3a2a1c',box:{c:'#f3e6c8',pad:.4,r:.02}},
 {id:'sinema-seridi',cat:'Etiket ve Bant',name:'Sinema Şeridi',font:BEBAS,weight:400,scale:1.2,upper:1,spacing:.14,fill:'#ffffff',box:{c:'#000000',pad:.45,r:0}},
 // El Yazısı (gerçek, eğik el yazısı fontları; scale: fontun küçük görünen harflerini dengeler)
 {id:'sade-el',cat:'El Yazısı',name:'Günlük',font:CAVEAT,weight:700,scale:1.3,fill:'#ffffff',shadow:{c:'#0009',b:.1,y:.04}},
 {id:'el-yazisi',cat:'El Yazısı',name:'Akıcı Eğik',font:DANCING,weight:700,scale:1.15,fill:'#ffffff',shadow:{c:'#000d',b:0,x:.05,y:.06}},
 {id:'el-koyu',cat:'El Yazısı',name:'Günlük Koyu',font:CAVEAT,weight:700,scale:1.3,fill:'#1a1a1a',shadow:{c:'#ffffffc8',b:.18,y:0}},
 {id:'el-pembe',cat:'El Yazısı',name:'Fırça Pembe',font:PACIFICO,weight:400,scale:1,fill:'#ffffff',stroke:{c:'#e0457b',w:.1},shadow:{c:'#0006',b:.1,y:.05}},
 {id:'el-neon',cat:'El Yazısı',name:'Neon İmza',font:DANCING,weight:700,scale:1.15,fill:'#ffffff',glow:{c:'#ff7ad9',b:.4,n:3}},
 {id:'el-kaligrafi',cat:'El Yazısı',name:'Kaligrafi',font:VIBES,weight:400,scale:1.45,fill:'#ffffff',shadow:{c:'#000a',b:.14,y:.05}},
 {id:'el-imza',cat:'El Yazısı',name:'İnce İmza',font:SACRA,weight:400,scale:1.5,fill:'#ffffff',shadow:{c:'#000a',b:.14,y:.04}},
 {id:'el-kalem',cat:'El Yazısı',name:'Kalem',font:MARCK,weight:400,scale:1.2,fill:'#ffffff',shadow:{c:'#0009',b:.1,y:.04}},
 {id:'el-murekkep',cat:'El Yazısı',name:'Mürekkep',font:KAUSHAN,weight:400,scale:1.05,fill:'#fff6df',stroke:{c:'#3a2412',w:.09},shadow:{c:'#0007',b:.1,y:.05}},
 {id:'el-kivrik',cat:'El Yazısı',name:'Kıvrık',font:COURGETTE,weight:400,scale:1.05,fill:'#ffe9f3',shadow:{c:'#5a0a3acc',b:0,x:.045,y:.055}},
 {id:'el-defter',cat:'El Yazısı',name:'Defter',font:PATRICK,weight:400,scale:1.2,fill:'#ffffff',shadow:{c:'#0009',b:.1,y:.04}},
 {id:'el-ince-uzun',cat:'El Yazısı',name:'İnce Uzun',font:AMATIC,weight:700,scale:1.55,upper:1,spacing:.05,fill:'#ffffff',shadow:{c:'#0009',b:.1,y:.04}},
 {id:'el-altin',cat:'El Yazısı',name:'Altın Kaligrafi',font:VIBES,weight:400,scale:1.45,fill:['#fff3b0','#e0a020'],glow:{c:'#ffb300',b:.3,n:2}},
 // Renkli
 {id:'sari-vurgu',cat:'Renkli',name:'Sarı Vurgu',font:ANTON,weight:400,upper:1,spacing:.03,fill:'#ffe11a',stroke:{c:'#000',w:.14},shadow:{c:'#000a',b:.1,y:.06}},
 {id:'sari-kirmizi',cat:'Renkli',name:'Sarı Kırmızı',font:BUNGEE,weight:400,scale:0.85,upper:1,fill:'#ffd400',stroke:{c:'#d4141c',w:.13},outer:{c:'#ffffff',w:.26}},
 {id:'gun-batimi',cat:'Renkli',name:'Gün Batımı',font:LOBSTER,weight:400,scale:1.05,fill:['#ffd27f','#ff4e6a'],shadow:{c:'#0008',b:.14,y:.06}},
 {id:'okyanus',cat:'Renkli',name:'Okyanus',font:OSWALD,weight:700,scale:1.05,upper:1,fill:['#8af3ff','#3f6dff'],stroke:{c:'#ffffff',w:.05},shadow:{c:'#0009',b:.14,y:.06}},
 {id:'orman',cat:'Renkli',name:'Orman',font:YESEVA,weight:400,scale:.95,fill:['#e2ff94','#1f9d55'],stroke:{c:'#ffffff',w:.04},shadow:{c:'#0009',b:.14,y:.06}},
 {id:'gul',cat:'Renkli',name:'Gül',font:DMSERIF,weight:400,italic:1,fill:['#ffd6ee','#ff4fa3'],shadow:{c:'#0008',b:.14,y:.06}},
 {id:'cikartma',cat:'Renkli',name:'Çıkartma',font:RIGHTEOUS,weight:400,fill:'#ff7bb5',stroke:{c:'#d6246e',w:.1},outer:{c:'#ffffff',w:.3},shadow:{c:'#0006',b:.1,y:.06}}
];
// Animasyonlu stiller: mevcut bir görünüm + giriş/çıkış/döngü animasyonu birlikte seçilir.
for(const [id,name,base,anim] of [
 ['anim-daktilo','Daktilo','daktilo-not',{in:'typewriter',inDur:1.8,out:'fade',outDur:.5,loop:'none'}],
 ['anim-mektup','Daktilo Mektup','mektup',{in:'typewriter',inDur:2.2,out:'fade',outDur:.6,loop:'none'}],
 ['anim-yazilir','Yazılır Gibi','el-yazisi',{in:'wipe',inDur:1.4,out:'fade',outDur:.5,loop:'none'}],
 ['anim-harf','Harf Harf','kalin-beyaz',{in:'letters',inDur:1.2,out:'fade',outDur:.5,loop:'none'}],
 ['anim-neon-titrek','Neon Titreme','neon-pembe',{in:'fade',inDur:.6,out:'none',outDur:.6,loop:'flicker'}],
 ['anim-nabiz','Parlama Nabzı','neon-camgobegi',{in:'fade',inDur:.8,out:'fade',outDur:.6,loop:'pulse'}],
 ['anim-dalga','Dalga','okyanus',{in:'rise',inDur:.7,out:'fade',outDur:.5,loop:'wave'}],
 ['anim-ziplayan','Zıplayan','sari-vurgu',{in:'pop',inDur:.5,out:'shrink',outDur:.4,loop:'breathe'}],
 ['anim-sinema','Sinema','zarif-ince',{in:'blur',inDur:1.2,out:'blur',outDur:.8,loop:'none'}],
 ['anim-cizgi','Titrek Çizgi Film','cizgi-film',{in:'pop',inDur:.5,out:'none',outDur:.6,loop:'shake'}],
 ['anim-altin','Altın Giriş','altin-kabartma',{in:'rise',inDur:.9,out:'fade',outDur:.6,loop:'none'}]
])TEXT_STYLES.push({...TEXT_STYLES.find(t=>t.id===base),id,name,cat:'Animasyonlu',anim});
const effSize=s=>s.fontSize*(styleOf(s)?.scale||1);
const styleOf=s=>s.style&&s.style!=='none'?TEXT_STYLES.find(t=>t.id===s.style)||null:null;
const defaults = () => ({id:uid(),kind:'image',name:'Fotoğraf',dur:5,look:'none',lookAmt:100,gSat:0,gVib:0,gCon:0,gExp:0,gWarm:0,gSharp:0,fGrain:0,fVig:0,fDust:0,fFlick:0,fWeave:0,text:'',textStart:0,textDur:0,roll:false,rollFit:true,rollDelay:.08,rollPause:.4,texts:[],style:'none',textIn:'none',textInDur:.8,textOut:'none',textOutDur:.6,textLoop:'none',font:'plain',fontSize:64,color:'#ffffff',textX:50,textY:82,textPosition:'bottom',fit:'cover',x:0,y:0,zoom:1,opacity:100,brightness:100,contrast:100,filter:'none',entry:'none',entryDur:0.8,entrySide:'left',motion:'none',sound:true,volume:100,background:'#182c46'});
const blank = () => ({version:2,id:uid(),name:'İsimsiz proje',scenes:[],texts:[],cinema:{bars:false,ratio:'4:5'},voice:{preset:'off',denoise:60,reverb:0,level:true},audioAssets:{},vol:{nar:1,amb:0.35},ambLoop:true,narName:'',ambName:''});
// Yazılar: sahnenin kendi yazısı (sahne alanları), sahneye bağlı ek yazılar (sahne.texts) ve tüm videoya bağlı yazılar (state.texts).
const MAX_TEXTS=30;
const TEXT_DEFAULT=()=>({id:uid(),text:'',style:'none',textIn:'none',textInDur:.8,textOut:'none',textOutDur:.6,textLoop:'none',font:'plain',fontSize:64,color:'#ffffff',textX:50,textY:82,textPosition:'bottom',textStart:0,textDur:0,roll:false,rollFit:true,rollDelay:.08,rollPause:.4});
function normTextFields(s){s.textStart=num(s.textStart,0,0,86400);s.textDur=num(s.textDur,0,0,86400);s.roll=!!s.roll;s.rollFit=s.rollFit!==false;s.rollDelay=num(s.rollDelay,.08,.02,1);s.rollPause=num(s.rollPause,.4,0,3);return s;}
function normalizeText(raw){
  const s={...TEXT_DEFAULT(),...raw,id:String(raw?.id||uid())};s.text=String(s.text||'');
  for(const [k,d,a,b] of [['fontSize',64,16,180],['textX',50,0,100],['textY',82,0,100],['textInDur',.8,.1,5],['textOutDur',.6,.1,5]])s[k]=num(s[k],d,a,b);
  if(!fonts[s.font])s.font='plain';if(!/^#[\da-f]{6}$/i.test(s.color))s.color='#ffffff';
  if(!['top','middle','bottom','custom'].includes(s.textPosition))s.textPosition='custom';
  if(!TEXT_STYLES.some(t=>t.id===s.style))s.style='none';
  if(!TEXT_IN.some(o=>o[0]===s.textIn))s.textIn='none';if(!TEXT_OUT.some(o=>o[0]===s.textOut))s.textOut='none';if(!TEXT_LOOP.some(o=>o[0]===s.textLoop))s.textLoop='none';
  return normTextFields(s);
}
// Çıktı hedefi: 9:16, 30 kare/sn. Toplam süre 10–240 saniye; tek sahne daha kısa olabilir.
const FPS=30,WIDTH=1080,HEIGHT=1920,MIN_TOTAL=10,MAX_TOTAL=240,VIDEO_BITRATE=6000000,AUDIO_BITRATE=160000;
let state=blank(), selected=null, tab='visual', dirty=false, revision=0, time=0, total=0, TL=[], playing=false, playEnd=0, playStart=0, playEpoch=0, exporting=false, exportCancelled=false, exportAbort=null, downloadURL='', toastTimer;
const media = new Map(), audioFiles = new Map();
const assets=new Map(), history=new ProjectHistory(state), projectStore=new ProjectStore();
let autosaveTimer, historyBusy=false, projectBusy=false, projectEpoch=0;
const canvas=$('#preview'), ctx=canvas.getContext('2d');
let captionBounds=[], audioContext, audioDestination, monitorGain, scheduled=[];
const videoNodes=new WeakMap();
const dbReady=projectStore.ready;
dbReady.catch(()=>toast('Tarayıcı deposu kullanılamıyor. Proje Aç → Yedeğini indir ile dosyaya kaydedebilirsin.'));
async function dbRequest(mode,fn){const db=await dbReady;return new Promise((resolve,reject)=>{const tx=db.transaction('kv',mode);let rq;try{rq=fn(tx.objectStore('kv'));}catch(e){reject(e);return;}tx.oncomplete=()=>resolve(rq?.result);tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Kayıt tamamlanamadı.'));});}
const dbGet=key=>dbRequest('readonly',s=>s.get(key));
function toast(msg){$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,6000);}
function historyUI(){ $('#undo').disabled=!history.canUndo||historyBusy||exporting;$('#redo').disabled=!history.canRedo||historyBusy||exporting; }
function registerAsset(file,kind,id){id=id||uid();if(!assets.has(id))assets.set(id,{file,kind});return id;}
function changed(group=null){dirty=true;revision++;history.commit(state,group);const used=new Set(history.entries.flatMap(s=>projectStore.refs(s)));for(const id of assets.keys())if(!used.has(id))assets.delete(id);historyUI();$('#saveStatus').textContent='Kaydediliyor…';clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>persist(false),650);}
async function persist(manual){
  clearTimeout(autosaveTimer);const rev=revision,id=state.id;
  if(manual)$('#saveProject').disabled=true;
  try{await projectStore.save(state,assets,{manual,view:{selected,time}});if(id===state.id&&rev===revision){dirty=false;$('#saveStatus').textContent=manual?'Bu cihazda kaydedildi':'Otomatik kaydedildi';}if(manual)toast('Proje, medya ve seslerle birlikte kaydedildi.');return true;}
  catch(e){if(id===state.id){dirty=true;$('#saveStatus').textContent='Kayıt başarısız · Yedek indir';}toast('Kayıt başarısız: '+e.message+' Proje Aç → Yedeğini indir seçeneğini kullan.');return false;}
  finally{$('#saveProject').disabled=false;}
}
async function restoreHistory(next){
  const loaded=new Map(),sounds=new Map(),created=[];
  try{for(const s of next.scenes){const a=assets.get(s.assetId),old=media.get(s.id);if(!a)continue;const m=old?.file===a.file?old:await loadMedia(a.file,s.kind==='video'?'video':'image');if(m!==old)created.push(m);loaded.set(s.id,m);}for(const [w,id]of Object.entries(next.audioAssets||{})){const a=assets.get(id);if(a){const raw=a.buffer||(a.buffer=await decodeAudio(a.file));sounds.set(w,{file:a.file,raw,buffer:w==='nar'?await voiceBuffer(raw,next.voice):raw});}}}
  catch(e){created.forEach(disposeMedia);throw e;}
  pause();for(const [id,m]of media)if(loaded.get(id)!==m)disposeMedia(m);media.clear();loaded.forEach((m,id)=>media.set(id,m));audioFiles.clear();sounds.forEach((a,w)=>audioFiles.set(w,a));state=next;selected=state.scenes.some(s=>s.id===selected)?selected:state.scenes.at(-1)?.id||null;timeline();time=TL.find(e=>e.sc.id===selected)?.start||0;$('#projectName').value=state.name;refresh();dirty=true;revision++;clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>persist(false),650);$('#saveStatus').textContent='Kaydediliyor…';
}
async function travelHistory(direction){if(historyBusy||projectBusy||exporting)return;const previous=history.index,next=direction==='undo'?history.undo():history.redo();if(!next)return;historyBusy=true;$('#workspace').inert=true;historyUI();try{await restoreHistory(next);}catch(e){history.index=previous;toast(e.message);}finally{historyBusy=false;$('#workspace').inert=false;historyUI();}}
const selectedScene=()=>state.scenes.find(s=>s.id===selected);
function timeline(){let t=0;TL=state.scenes.map(sc=>{const e={sc,start:t,dur:sc.dur};t+=sc.dur;return e;});total=t;time=Math.min(time,total);}
function current(t=time){return TL.find(e=>t<e.start+e.dur)||TL.at(-1);}
// Yazı sahnelerden bağımsız bir katmandır. Eski projelerde sahnenin içinde duran yazılar (kendi yazısı ve ek yazılar) açılışta
// aynı zaman aralığıyla yazı katmanına taşınır; başlık kartının giriş efekti yazının giriş animasyonuna çevrilir.
const SCENE_TEXT_FIELDS=['text','style','font','fontSize','color','textX','textY','textPosition','textIn','textInDur','textOut','textOutDur','textLoop','roll','rollFit','rollDelay','rollPause'];
function migrateSceneTexts(st){
  let at=0;const moved=[];
  for(const sc of st.scenes){
    const start=at,end=at+sc.dur;at=end;
    const lift=(src,own)=>{
      if(!String(src.text||'').trim())return;
      const a=start+clamp(src.textStart||0,0,Math.max(0,sc.dur-.1)),b=src.textDur>0?Math.min(end,a+src.textDur):end;
      const t=normalizeText({...Object.fromEntries(SCENE_TEXT_FIELDS.map(k=>[k,src[k]])),textStart:Math.round(a*1000)/1000,textDur:Math.round((b-a)*1000)/1000});
      if(own&&sc.kind==='title'&&t.textIn==='none'&&sc.entryDur>0){if(sc.entry==='fade'){t.textIn='fade';t.textInDur=Math.min(5,sc.entryDur);}else if(sc.entry==='slide'){t.textIn='slide';t.textInDur=Math.min(5,sc.entryDur);}}
      moved.push(t);
    };
    lift(sc,true);for(const x of sc.texts||[])lift(x,false);
    sc.text='';sc.texts=[];
  }
  if(moved.length)st.texts=[...(st.texts||[]),...moved].slice(0,MAX_TEXTS);
}
function normalize(raw){
  const s={...defaults(),...raw,id:String(raw.id||uid())};
  s.kind=['image','video','title','sample'].includes(s.kind)?s.kind:'image';if(!(window.Grade&&Grade.LOOKS[s.look]))s.look='none';
  s.dur=num(s.dur,5,.1,Number.MAX_SAFE_INTEGER);s.text=String(s.text||'');s.name=String(s.name||'Sahne');
  for(const [k,d,a,b] of [['lookAmt',100,0,100],['gSat',0,-100,100],['gVib',0,-100,100],['gCon',0,-100,100],['gExp',0,-100,100],['gWarm',0,-100,100],['gSharp',0,0,100],['fGrain',0,0,100],['fVig',0,0,100],['fDust',0,0,100],['fFlick',0,0,100],['fWeave',0,0,100],['x',0,-100,100],['y',0,-100,100],['zoom',1,.25,4],['opacity',100,0,100],['brightness',100,0,200],['contrast',100,0,200],['fontSize',64,16,180],['textX',50,0,100],['textY',82,0,100],['entryDur',.8,0,10],['volume',100,0,100]])s[k]=num(s[k],d,a,b);
  if(!fonts[s.font])s.font='plain';
  if(!TEXT_STYLES.some(t=>t.id===s.style))s.style='none';
  if(!TEXT_IN.some(o=>o[0]===s.textIn))s.textIn='none';if(!TEXT_OUT.some(o=>o[0]===s.textOut))s.textOut='none';if(!TEXT_LOOP.some(o=>o[0]===s.textLoop))s.textLoop='none';
  s.textInDur=num(s.textInDur,.8,.1,5);s.textOutDur=num(s.textOutDur,.6,.1,5);
  normTextFields(s);s.texts=(Array.isArray(raw.texts)?raw.texts:[]).slice(0,MAX_TEXTS).map(normalizeText);
  for(const k of ['color','background'])if(!/^#[\da-f]{6}$/i.test(s[k]))s[k]=k==='color'?'#ffffff':'#182c46';
  return s;
}
function disposeMedia(m){if(!m)return;if(m.el instanceof HTMLVideoElement){m.el.pause();m.el.removeAttribute('src');m.el.load();}URL.revokeObjectURL(m.url);}
async function loadMedia(file,kind){
  const url=URL.createObjectURL(file), el=document.createElement(kind==='video'?'video':'img');
  try{
    if(kind==='video'){
      el.preload='auto';el.playsInline=true;el.muted=true;el.addEventListener('seeked',()=>{if(!playing&&!exporting)render();});
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Video açılamadı; MP4 veya WebM deneyin.')),15000);el.onloadeddata=()=>{clearTimeout(timer);resolve();};el.onerror=()=>{clearTimeout(timer);reject(new Error('Video biçimi bu tarayıcıda açılamıyor.'));};el.src=url;});
    }else{el.src=url;await el.decode();}
    return {file,url,el};
  }catch(e){disposeMedia({url,el});throw new Error(file.name+': '+(e.message||'Dosya açılamadı.'));}
}
const kindOf=f=>f.type.startsWith('video/')||/\.(mp4|webm|mov|m4v|ogv)$/i.test(f.name)?'video':f.type.startsWith('image/')||/\.(jpe?g|png|webp|gif|avif|bmp|svg)$/i.test(f.name)?'image':null;
async function setMedia(sc,file){
  const kind=kindOf(file);if(!kind)throw new Error('Desteklenen bir fotoğraf veya video seçin.');
  const m=await loadMedia(file,kind);disposeMedia(media.get(sc.id));media.set(sc.id,m);sc.kind=kind;sc.name=file.name;sc.assetId=registerAsset(file,kind);
  // Replacing media deliberately preserves duration, text, framing and every effect.
}
async function addFiles(files){
  if(projectBusy||historyBusy||exporting)return;projectBusy=true;$('#workspace').inert=true;$('#addScene').disabled=true;pause();
  const added=[],failed=[],epoch=projectEpoch,staged=[];
  try{for(const file of [...files].sort((a,b)=>a.name.localeCompare(b.name,'tr',{numeric:true,sensitivity:'base'}))){try{const kind=kindOf(file);if(!kind)throw new Error('desteklenmeyen biçim');const m=await loadMedia(file,kind);staged.push(m);if(epoch!==projectEpoch)break;const s={...defaults(),kind,name:file.name,assetId:registerAsset(file,kind)};if(kind==='video')s.dur=Math.round(m.el.duration*10)/10||5;added.push({s,m});}catch(e){failed.push(file.name);}}
    if(epoch!==projectEpoch){staged.forEach(disposeMedia);return;}
    if(added.length){for(const {s,m}of added){media.set(s.id,m);state.scenes.push(s);}changed();refresh();selectScene(added[0].s.id);}
    if(failed.length)toast(`${added.length} dosya eklendi; ${failed.length} dosya açılamadı: ${failed.slice(0,5).join(', ')}${failed.length>5?'…':''}`);
  }finally{projectBusy=false;$('#workspace').inert=false;$('#addScene').disabled=false;}
}
function refresh(){timeline();renderTimeline();renderInspector();renderAudio();render();}
function selectScene(id){history.endGroup();pause();selected=id;tab='visual';if(tool==='text')tool='media';time=TL.find(e=>e.sc.id===id)?.start||0;renderTimeline();renderInspector();syncVideos(time,false);render();}
// ---- Zaman çizelgesi: cetvel, orantılı sahne klipleri ve yazı şeritleri (CapCut düzeni) ----
let tlPps=window.innerWidth<700?30:60;   // saniye başına piksel (yakınlaştırma); dar ekranda daha küçük
const TL_LANE=28;
const r3=v=>Math.round(v*1000)/1000;
function layoutCanvas(){const c=$('#tlCanvas');if(c)c.style.width=Math.max(1,total*tlPps)+'px';}
function renderRuler(){
  const el=$('#tlRuler');if(!el)return;
  const step=[1,2,5,10,15,30,60].find(v=>v*tlPps>=64)||60;let html='';
  for(let t=0;t<=total+1e-6;t+=step){
    html+=`<span class="tick major" style="left:${t*tlPps}px"><i>${fmt(t)}</i></span>`;
    for(let k=1;k<5;k++){const tt=t+step*k/5;if(tt<=total+1e-6)html+=`<span class="tick" style="left:${tt*tlPps}px"></span>`;}
  }
  el.innerHTML=html;
}
// Çizelgede gösterilecek tüm yazılar (sahnenin kendi yazısı yalnızca doluysa).
function timelineTexts(){
  const list=[];
  for(const e of TL){
    if(e.sc.text.trim())list.push({src:e.sc,ref:{type:'scene',id:e.sc.id,sid:e.sc.id},scene:e,...textWindow(e.sc,e,'scene')});
    for(const x of e.sc.texts||[])list.push({src:x,ref:{type:'extra',id:x.id,sid:e.sc.id},scene:e,...textWindow(x,e,'scene')});
  }
  for(const x of state.texts||[])list.push({src:x,ref:{type:'video',id:x.id,sid:null},scene:null,...textWindow(x,null,'video')});
  return list.filter(i=>i.b>i.a).sort((p,q)=>p.a-q.a||p.b-q.b);
}
function renderTextLanes(){
  const el=$('#textLanes');if(!el)return;
  const items=timelineTexts(),ends=[],cur=curTarget();
  const bars=items.map(i=>{let lane=ends.findIndex(end=>end<=i.a+1e-6);if(lane<0){lane=ends.length;ends.push(0);}ends[lane]=i.b;return {i,lane};});
  el.style.height=Math.max(1,ends.length)*TL_LANE+'px';
  el.innerHTML=bars.length?bars.map(({i,lane})=>{
    const sel=i.src===cur,label=textPreview(i.src),tip=`${i.ref.type==='video'?'Videoya bağlı':'Sahneye bağlı'} yazı · ${fmtT(i.a)} – ${fmtT(i.b)}`;
    return `<div class="tl-text ${i.ref.type==='video'?'video':'scene'}${sel?' sel':''}" data-tltext="${i.ref.type}:${i.ref.id}" style="left:${i.a*tlPps}px;width:${Math.max(6,(i.b-i.a)*tlPps)}px;top:${lane*TL_LANE}px" title="${esc(tip)}"><span class="edge l" data-edge="l"></span><span class="tl-label">${i.src.roll?'↑ ':''}${esc(label)}</span><span class="edge r" data-edge="r"></span></div>`;
  }).join(''):'<p class="lane-hint">Yazı şeritleri burada görünür. Yazı sekmesinden “+ Yazı ekle” ile videoya yazı ekle.</p>';
}
function markSelectedScene(){
  document.querySelectorAll('.scene-card').forEach(b=>{const on=b.dataset.id===selected;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
  const ps=$('#playScene');if(ps)ps.disabled=!selectedScene();
}
function updatePlayhead(){
  const ph=$('#playhead');if(!ph)return;ph.hidden=!total;ph.style.left=(time*tlPps)+'px';
  if(playing){const sc=$('#timelineScroll'),x=time*tlPps;if(x<sc.scrollLeft||x>sc.scrollLeft+sc.clientWidth-40)sc.scrollLeft=Math.max(0,x-sc.clientWidth*.3);}
}
// Şeride tıklanınca yazı seçilir: sahne ve zaman ona gider, panel Yazı sekmesini gösterir.
function selectTextRef(ref,item){
  activeText=ref.type==='scene'?null:{type:ref.type,id:ref.id};
  const sid=ref.type==='video'?current(item.a)?.sc.id:ref.sid;markSelectedScene();
  if(time<item.a||time>=item.b)time=item.a;
  tab='text';tool='text';renderInspector();render();
}
let tlDrag=null;
$('#textLanes').addEventListener('pointerdown',e=>{
  const bar=e.target.closest('.tl-text');if(!bar||projectBusy||historyBusy||exporting)return;e.preventDefault();
  const [type,id]=bar.dataset.tltext.split(':'),item=timelineTexts().find(i=>i.ref.type===type&&i.ref.id===id);if(!item)return;
  pause();history.endGroup();
  document.querySelectorAll('.tl-text').forEach(b=>b.classList.toggle('sel',b===bar));
  selectTextRef(item.ref,item);
  const video=type==='video';
  tlDrag={item,bar,edge:e.target.closest('[data-edge]')?.dataset.edge||'move',startX:e.clientX,a:item.a,b:item.b,lo:video?0:item.scene.start,hi:video?total:item.scene.start+item.scene.dur,off:video?0:item.scene.start};
  bar.setPointerCapture(e.pointerId);
});
$('#textLanes').addEventListener('pointermove',e=>{
  const d=tlDrag;if(!d)return;
  const dt=(e.clientX-d.startX)/tlPps,pts=[...TL.flatMap(x=>[x.start,x.start+x.dur]),time];
  const snap=v=>{for(const p of pts)if(Math.abs(p-v)*tlPps<7)return p;return Math.round(v*10)/10;};
  let a=d.a,b=d.b;const len=d.b-d.a;
  if(d.edge==='move'){a=clamp(snap(d.a+dt),d.lo,Math.max(d.lo,d.hi-len));b=a+len;}
  else if(d.edge==='l')a=clamp(snap(d.a+dt),d.lo,d.b-.5);
  else b=clamp(snap(d.b+dt),d.a+.5,d.hi);
  const tgt=resolveRef(d.item.ref);if(!tgt)return;
  tgt.textStart=r3(Math.max(0,a-d.off));tgt.textDur=r3(b-a);
  d.bar.style.left=a*tlPps+'px';d.bar.style.width=Math.max(6,(b-a)*tlPps)+'px';
  if(time<a||time>=b)time=a;
  changed('tlbar:'+tgt.id);render();
});
function finishTextDrag(){if(!tlDrag)return;tlDrag=null;history.endGroup();renderTextLanes();if(tab==='text')renderInspector();}
$('#textLanes').addEventListener('pointerup',finishTextDrag);$('#textLanes').addEventListener('pointercancel',finishTextDrag);
// Cetvelden zaman seçme / sürükleyerek gezinme
let rulerDrag=false;
function seekFromRuler(e){
  const r=$('#tlCanvas').getBoundingClientRect(),t=clamp((e.clientX-r.left)/tlPps,0,Math.max(0,total-.001)),before=selected;
  pause();time=t;const sc=current(time)?.sc.id;if(sc)selected=sc;markSelectedScene();if(selected!==before)renderInspector();render();
}
$('#tlRuler').addEventListener('pointerdown',e=>{if(!total||exporting)return;rulerDrag=true;$('#tlRuler').setPointerCapture(e.pointerId);seekFromRuler(e);});
$('#tlRuler').addEventListener('pointermove',e=>{if(rulerDrag)seekFromRuler(e);});
$('#tlRuler').addEventListener('pointerup',()=>{rulerDrag=false;});$('#tlRuler').addEventListener('pointercancel',()=>{rulerDrag=false;});
$('#tlZoom').oninput=e=>{tlPps=+e.target.value;const sc=$('#timelineScroll'),keep=time*tlPps-sc.clientWidth*.3;renderTimeline();sc.scrollLeft=Math.max(0,keep);};
function renderTimeline(){
  $('#sceneTrack').innerHTML=state.scenes.length?state.scenes.map((s,i)=>{
    const m=media.get(s.id), thumb=m?(s.kind==='video'?`<video src="${esc(m.url)}" muted preload="metadata"></video>`:`<img src="${esc(m.url)}" alt="">`):`<span class="title-thumb" style="background:${s.background}">${s.kind==='title'?'T':'?'}</span>`;
    return `<button class="scene-card${s.id===selected?' selected':''}" draggable="true" data-id="${esc(s.id)}" aria-label="Sahne ${i+1}: ${esc(s.name)}, ${s.dur} saniye" aria-pressed="${s.id===selected}" style="width:${Math.max(18,s.dur*tlPps)}px">${thumb}<span class="card-meta"><span>${i+1} · ${s.kind==='video'?'Video':s.kind==='title'?'Başlık':'Fotoğraf'}</span><b>${s.dur} sn</b></span><span class="resize-handle" data-resize="${esc(s.id)}" title="Süreyi ayarlamak için sürükle" aria-hidden="true"></span></button>`;
  }).join(''):'<p class="timeline-empty">Henüz sahne yok. Fotoğraflarını ekle, sırala, hikâyeni oluştur.</p>';
  $('#sceneTrack').dataset.pps=tlPps;layoutCanvas();renderRuler();renderTextLanes();renderAudioLanes();
  $('#sceneCount').textContent=state.scenes.length+' sahne';updateDurationUI();$('#scrubEnd').textContent=fmt(total);$('#scrubber').max=total;
  $('#exportVideo').disabled=!total;$('#playAll').disabled=!total;$('#playScene').disabled=!selectedScene();$('#emptyPreview').hidden=!!total;
}
function updateDurationUI(){const tenth=Math.round(total*10)%10,label=`${fmt(total)}${tenth?','+tenth:''} / 04:00`;$('#totalTime').textContent=label;$('#headerDuration').textContent=label;const issue=durationIssue();for(const id of ['#totalTime','#headerDuration'])$(id).classList.toggle('out-of-range',!!issue);$('#durationWarning').textContent=issue;$('#durationWarning').hidden=!issue;}
function range(s,k,label,min,max,step=1,suffix='%'){return `<label class="field"><span class="field-head">${label}<output data-output="${k}">${s[k]}${suffix}</output></span><input data-field="${k}" aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${s[k]}"></label>`;}
function select(s,k,label,opts){return `<label class="field">${label}<select data-field="${k}">${opts.map(([v,l])=>`<option value="${v}" ${s[k]===v?'selected':''}>${l}</option>`).join('')}</select></label>`;}
// Panel iki ana bölümdür: Sahne (görsel + hareket + görünüm) ve Yazı (sahneden bağımsız yazı katmanı).
let accOpen='layout';
const ENTRY_OPTS=[['none','Anında göster'],['fade','Yavaş belirme'],['slide','Kenardan kayarak gelme']];
const MOTION_OPTS=[['none','Sabit'],['in','Büyüt'],['out','Küçült'],['left','Sola kaydır'],['right','Sağa kaydır'],['up','Yukarı kaydır'],['down','Aşağı kaydır']];
const acc=(id,title,body)=>`<section class="acc${accOpen===id?' open':''}"><button type="button" class="acc-head" data-acc="${id}" aria-expanded="${accOpen===id}"><span>${title}</span><i>▾</i></button><div class="acc-body">${body}</div></section>`;
function sceneTabHTML(s){
  let html=`<div class="top-row"><div class="media-summary"><span title="${esc(s.name)}">${esc(s.name)}</span><button id="replaceMedia">${s.kind==='title'?'Görsel Ekle':s.kind==='video'?'Videoyu Değiştir':'Fotoğrafı Değiştir'}</button></div><label class="field">Süre (saniye)<input data-field="dur" type="number" min="0.1" step="0.1" value="${s.dur}" required></label><label class="field">Arka plan<input data-field="background" aria-label="Arka plan" type="color" value="${s.background}"></label></div>`;
  if(s.kind==='title')return html+`<p class="small">Başlık kartı renkli bir arka plandır. Yazıyı Yazı sekmesinden ekle; yazı sahneye bağlı değildir.</p>`;
  const slide=s.entry==='slide';
  html+=acc('layout','Düzen ve hareket',
    `<div class="field-row c3">${select(s,'fit','Kadraj',[['cover','Kadrajı doldur'],['contain','Tamamını göster']])}${range(s,'zoom','Yakınlaştırma',.25,4,.01,'×')}${range(s,'opacity','Opaklık',0,100)}</div>`
    +`<div class="field-row c3">${range(s,'x','Yatay konum',-100,100)}${range(s,'y','Dikey konum',-100,100)}${range(s,'entryDur','Giriş süresi',0,Math.min(10,s.dur),.1,' sn')}</div>`
    +`<div class="field-row c3">${select(s,'entry','Giriş animasyonu',ENTRY_OPTS)}${select(s,'motion','Sahne boyunca hareket',MOTION_OPTS)}${slide?select(s,'entrySide','Giriş yönü',[['left','Soldan'],['right','Sağdan'],['up','Yukarıdan'],['down','Aşağıdan']]):'<span></span>'}</div>`);
  if(s.kind==='video')html+=acc('sound','Klip sesi',`<label class="check-field"><input type="checkbox" data-field="sound" ${s.sound?'checked':''}>Video sesi açık</label>`+range(s,'volume','Video ses düzeyi',0,100)+`<p class="small">Video bitince son kare tutulur; kaynak ses biter.</p>`);
  return html;
}
function renderInspector(){
  const s=selectedScene(),textMode=tab==='text';renderLibrary();
  $('#noSelection').hidden=textMode||!!s;$('#selectedPanel').hidden=!textMode&&!s;
  $('#inspectorTitle').textContent=textMode?'Yazı':s?'Sahne '+(state.scenes.indexOf(s)+1):'Sahne ayarları';
  $('#sceneType').textContent=textMode||!s?'':({image:'Fotoğraf',video:'Video',title:'Başlık kartı',sample:'Eski örnek'})[s.kind];
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));
  const actions=document.querySelector('.scene-actions');if(actions)actions.hidden=textMode;
  if(!textMode&&!s)return;
  $('#tabContent').innerHTML=textMode?textTabHTML():sceneTabHTML(s);
  $('#tabContent').classList.toggle('fill',textMode&&(textSub==='style'||textSub==='anim'));
  $('#tabContent').classList.toggle('scene-mode',!textMode);
  if(textMode){if(textSub==='style')drawStyleTiles();else if(textSub==='anim')drawAnimTiles();}
  $('#pasteScene').disabled=!sceneClip;
  if(s){$('#moveLeft').disabled=state.scenes.indexOf(s)===0;$('#moveRight').disabled=state.scenes.indexOf(s)===state.scenes.length-1;}
}
// Yazı sekmesi dört alt sekmeye bölünür (hepsi kaydırmadan görünür): Metin · Stil · Animasyon · Zaman.
// Bir sahnede birden fazla yazı olabilir; ayrıca tüm videoya bağlı yazılar eklenebilir. Düzenlenen yazı: curTarget().
let textSub='text',animSlot='in',styleCat='Tümü',tileAnim=null,activeText=null;
const TEXT_KEYS=new Set(['text','style','font','fontSize','color','textX','textY','textPosition','textIn','textInDur','textOut','textOutDur','textLoop','textStart','textDur','roll','rollFit','rollDelay','rollPause']);
const SLOT={in:{field:'textIn',get opts(){return TEXT_IN;},name:'Giriş'},out:{field:'textOut',get opts(){return TEXT_OUT;},name:'Çıkış'},loop:{field:'textLoop',get opts(){return TEXT_LOOP;},name:'Döngü'}};
const shortName=l=>/^(Anında göster|Sahne sonuna kadar kalsın|Sabit)$/.test(l)?'Yok':l.split(' (')[0];
const mctx=document.createElement('canvas').getContext('2d');
const r1=v=>Math.round(v*10)/10,fmtT=t=>`${fmt(t)},${Math.round((Math.max(0,t)%1)*10)%10}`;
function curTarget(){
  const list=state.texts||[];
  if(activeText?.type==='video'){const x=list.find(t=>t.id===activeText.id);if(x)return x;}
  if(!list.length)return null;
  const x=list.find(t=>{const w=textWindow(t,null,'video');return time>=w.a&&time<w.b;})||list[0];
  activeText={type:'video',id:x.id};return x;
}
const targetType=t=>{const s=selectedScene();return t===s?'scene':(s?.texts||[]).includes(t)?'extra':'video';};
function resolveRef(ref){
  if(ref.type==='video')return (state.texts||[]).find(t=>t.id===ref.id)||null;
  const sc=state.scenes.find(x=>x.id===(ref.sid||ref.id));if(!sc)return null;
  return ref.type==='scene'?sc:(sc.texts||[]).find(t=>t.id===ref.id)||null;
}
const textPreview=t=>{const v=(t.text||'').replace(/\s+/g,' ').trim();return v?(v.length>14?v.slice(0,13)+'…':v):'(boş)';};
const totalTexts=()=>state.scenes.reduce((a,x)=>a+(x.texts||[]).length,0)+(state.texts||[]).length;
function targetWindow(t){const type=targetType(t),e=TL.find(x=>x.sc===selectedScene());return type==='video'?textWindow(t,null,'video'):textWindow(t,e,'scene');}
function textList(s,cur){
  const items=state.texts||[];
  return `<div class="text-list" role="group" aria-label="Yazılar">${items.map(t=>`<button type="button" class="chip text-chip${t===cur?' selected':''}" data-text="video:${t.id}" aria-pressed="${t===cur}" title="Yazı katmanı (sahnelerden bağımsız)"><i>▣</i><span>${esc(textPreview(t))}</span></button>`).join('')}<button type="button" class="chip add-chip" data-addtext="video" title="Yeni yazı ekle (oynatma çizgisinden başlar)">+ Yazı ekle</button>${cur?'<span class="text-ops"><button type="button" class="chip" data-textop="dup" title="Seçili yazıyı kopyala">⧉ Kopyala</button><button type="button" class="chip danger-chip" data-textop="del" title="Seçili yazıyı sil (Delete tuşu)">✕ Sil</button></span>':''}</div>`;
}
const EMPTY_TEXT='<p class="small empty-note">Henüz yazı yok. “+ Yazı ekle” ile yazı ekle. Yazılar sahnelerden bağımsız ayrı bir katmandır: zaman çizelgesindeki şeridi sürükleyip kenarından uzatarak istediğin görsellerin üstüne, istersen videonun sonuna kadar yayabilirsin. Her yazının konumu, stili ve süresi ayrıdır.</p>';
function timeWarnHTML(s){
  const w=targetWindow(s),ld=Math.max(.1,w.b-w.a),sch=s.roll?rollSchedule(mctx,s,ld):null,over=maxOverlap(),warn=[];
  if(sch&&!sch.fits)warn.push(`Bu süreye sığmıyor: yazının tamamı için en az ${Math.ceil(sch.need*10)/10} sn gerekir${s.rollFit?'':' (hızı artır ya da süreyi uzat)'}.`);
  if(over>MAX_ACTIVE_TEXTS)warn.push(`Aynı anda ${over} yazı görünüyor (öneri en çok ${MAX_ACTIVE_TEXTS}); okunabilirlik düşebilir.`);
  return warn.length?`<p class="warn-note" role="status">${warn.map(esc).join('<br>')}</p>`:'';
}
function refreshTimeWarn(){const t=curTarget(),el=$('#timeWarn');if(t&&el)el.innerHTML=timeWarnHTML(t);}
function timeTabHTML(s){
  const type=targetType(s),w=targetWindow(s);
  return `<div class="field-row"><label class="field">Başlangıç (sn)<input data-field="textStart" type="number" min="0" step="0.1" value="${r1(s.textStart)}"></label><label class="field">Süre (sn)<input data-field="textDur" type="number" min="0" step="0.1" value="${r1(s.textDur)}"></label></div>`
    +`<p class="small">Videonun başından itibaren. Süre 0 = videonun sonuna kadar. <b id="winInfo">Görünür: ${fmtT(w.a)} – ${fmtT(w.b)}</b></p>`
    +`<div class="text-actions span-actions"><button type="button" data-textspan="all">Tüm videoya yay</button><button type="button" data-textspan="end">Videonun sonuna kadar uzat</button></div>`
    +`<label class="check-field roll-check"><input type="checkbox" data-field="roll" ${s.roll?'checked':''}>Akan yazı: alttan yazılır, satırlar yukarı kayar, üstten kaybolur</label>`
    +(s.roll?`<p class="small">Satırların nasıl belireceğini soldaki Yazı → Animasyonlar → Giriş bölümünden seç: Daktilo, Harf harf belirme, Soldan yazılır gibi, Belirme…</p><label class="check-field"><input type="checkbox" data-field="rollFit" ${s.rollFit?'checked':''}>Yazıyı süreye yay (hız otomatik)</label>`+(s.rollFit?'':range(s,'rollDelay','Harf başına süre',.02,1,.01,' sn'))+range(s,'rollPause','Satır sonu bekleme',0,3,.05,' sn'):'')
    +`<div id="timeWarn">${timeWarnHTML(s)}</div>`
    +`<ul class="rules small"><li>Yazı sahnelerden bağımsız bir katmandır: süre ve konumu burada ya da zaman çizelgesindeki şeritten ayarlanır.</li><li>Yazı sahneler değişse de yerinde kalır; sonra eklenen üstte çizilir.</li><li>En çok ${MAX_TEXTS} yazı eklenebilir; aynı anda ${MAX_ACTIVE_TEXTS}’dan fazla yazı görününce uyarı verilir.</li></ul>`;
}
// Sağ panel (Ayrıntılar) yazı için iki parçadır: Metin · Zaman. Stiller ve animasyonlar solda kütüphanededir.
function textTabHTML(){
  const s=curTarget(),subs=[['text','Metin'],['time','Zaman']];
  if(!['text','time'].includes(textSub))textSub='text';
  const bar=`<div class="subtabs" role="tablist" aria-label="Yazı ayrıntıları">${subs.map(([k,l])=>`<button type="button" role="tab" class="subtab${k===textSub?' active':''}" data-sub="${k}" aria-selected="${k===textSub}">${l}</button>`).join('')}</div>`;
  if(!s)return bar+'<p class="small">Düzenlenecek yazı yok. Soldaki Yazı kütüphanesinden “+ Yazı ekle” ile yazı ekle ya da zaman çizelgesinden bir yazı şeridi seç.</p>';
  const style=styleOf(s);
  if(textSub==='time')return bar+timeTabHTML(s);
  return bar+`<label class="field">Yazı<textarea data-field="text" placeholder="Yazısız bırakmak için boş bırak">${esc(s.text)}</textarea></label>`
    +(style?'':select(s,'font','Yazı tipi',[['hand','El yazısı'],['typewriter','Daktilo'],['plain','Sade']]))
    +`<div class="field-row">${range(s,'fontSize','Yazı boyutu',16,180,1,' px')}<label class="field">Yazı rengi<input data-field="color" aria-label="Yazı rengi" type="color" value="${s.color}"></label></div>`
    +select(s,'textPosition','Yazı konumu',[['top','Üst'],['middle','Orta'],['bottom','Alt'],['custom','Serbest konum']]);
}
// ---- Sol kütüphane (CapCut düzeni): Medya · Yazı · Görünüm · Ses ----
let tool='media',libSub='style',libSig='';
function styleGridHTML(s){
  return `<div class="style-cats" role="group" aria-label="Stil kategorisi">${['Tümü',...STYLE_CATS].map(c=>`<button type="button" class="chip${c===styleCat?' selected':''}" data-cat="${esc(c)}" aria-pressed="${c===styleCat}">${esc(c)}</button>`).join('')}</div>`
    +`<div class="style-grid" role="group" aria-label="Yazı stili">${TEXT_STYLES.filter(t=>styleCat==='Tümü'||t.cat===styleCat).map(t=>`<button type="button" class="style-tile${(s.style||'none')===t.id?' selected':''}" data-style="${t.id}" aria-pressed="${(s.style||'none')===t.id}" aria-label="${esc(t.name)}" title="${esc(t.name)}"><canvas width="320" height="104"></canvas><span>${t.anim?'▶ ':''}${esc(t.name)}</span></button>`).join('')}</div>`;
}
function animGridHTML(s){
  const sl=SLOT[animSlot],cur=s[sl.field],lim=Math.max(.1,Math.min(5,Math.max(.1,targetWindow(s).b-targetWindow(s).a)));
  const rollPace=s.roll&&animSlot==='in'&&['none','typewriter','letters','wipe'].includes(cur);
  const durField=rollPace?'':animSlot==='in'&&cur!=='none'?range(s,'textInDur','Giriş süresi',.1,lim,.1,' sn'):animSlot==='out'&&cur!=='none'?range(s,'textOutDur','Çıkış süresi',.1,lim,.1,' sn'):'';
  return `<div class="style-cats" role="group" aria-label="Animasyon türü">${Object.entries(SLOT).map(([k,v])=>`<button type="button" class="chip${k===animSlot?' selected':''}" data-slot="${k}" aria-pressed="${k===animSlot}">${v.name}${s[v.field]!=='none'?' ●':''}</button>`).join('')}</div>`
    +`<div class="style-grid anim-grid" role="group" aria-label="${sl.name} animasyonu">${sl.opts.map(([v,l])=>`<button type="button" class="anim-tile${cur===v?' selected':''}" data-anim="${v}" aria-pressed="${cur===v}" aria-label="${esc(l)}" title="${esc(l)}"><canvas width="320" height="104"></canvas><span>${esc(shortName(l))}</span></button>`).join('')}</div>`
    +(durField?`<div class="dur-row">${durField}</div>`:`<p class="small dur-row">${rollPace?'Akan yazıda bu animasyon her satıra uygulanır; hızı sağdaki Zaman sekmesinden ayarla.':s.roll&&animSlot==='in'?'Akan yazıda bu animasyon her yeni satıra ayrı uygulanır.':cur==='none'?'Seçili değil. Bir animasyon seçince yazı kendiliğinden oynar.':'Döngü, yazı görünür kaldığı sürece sürer.'}</p>`);
}
function libTextHTML(){
  const s=curTarget();
  const subs=[['style','Stiller'],['anim','Animasyonlar']];
  const bar=`<div class="subtabs" role="tablist" aria-label="Yazı kütüphanesi">${subs.map(([k,l])=>`<button type="button" role="tab" class="subtab${k===libSub?' active':''}" data-libsub="${k}" aria-selected="${k===libSub}">${l}</button>`).join('')}</div>`;
  return textList(null,s)+(s?bar+(libSub==='anim'?animGridHTML(s):styleGridHTML(s)):EMPTY_TEXT);
}
const libMediaHTML=()=>`<p class="small">Fotoğraf, video ya da başlık kartı ekle. Dosyaları önizlemeye veya zaman çizelgesine sürükleyip bırakabilirsin; birden fazla dosya seçilebilir.</p><div class="lib-actions"><button type="button" class="primary" data-add="image">▧ Fotoğraf ekle</button><button type="button" data-add="video">▷ Video ekle</button><button type="button" data-add="title">T Başlık kartı ekle</button></div>`;
const lookOpen={fine:false,film:false};
const isGradeKey=k=>GRADE_FIELDS.includes(k);
function filmHTML(s){
  return `<details class="det" data-det="film" ${lookOpen.film?'open':''}><summary>Film efektleri</summary><p class="small">Hepsi ayrı ayarlanır; 0 = kapalı. Yazıyı etkilemez.</p>${range(s,'fGrain','İnce film greni',0,100)}${range(s,'fVig','Kenar kararması',0,100)}${range(s,'fDust','Toz ve çizik',0,100)}${range(s,'fFlick','Işık titreşimi',0,100)}${range(s,'fWeave','Film sarsıntısı',0,100)}</details>`;
}
function libLookHTML(){
  const s=selectedScene(),cin=state.cinema||{bars:false,ratio:'4:5'};
  const bars=`<div class="look-bars"><label class="check-field"><input type="checkbox" data-cin="bars" ${cin.bars?'checked':''}>Siyah sinema bantları (tüm video)</label>${cin.bars?`<label class="field">Görüntü oranı<select data-cin="ratio">${[['4:5','4:5 (geniş)'],['1:1','1:1 (kare)'],['16:9','16:9 (sinema)']].map(([v,l])=>`<option value="${v}" ${cin.ratio===v?'selected':''}>${l}</option>`).join('')}</select></label>`:''}</div>`;
  if(!s)return '<p class="small">Görünümü ayarlamak için bir sahne seç.</p>'+bars;
  if(s.kind==='title')return '<p class="small">Başlık kartında görüntü yoktur; arka plan rengi Sahne sekmesindedir.</p>'+filmHTML(s)+bars;
  const ids=Object.keys(Grade.LOOKS),card=id=>`<button type="button" class="look-card${s.look===id?' selected':''}" data-look="${id}" aria-pressed="${s.look===id}" title="${esc(Grade.LOOKS[id].name)}"><canvas width="96" height="128"></canvas><span>${esc(Grade.LOOKS[id].name)}</span></button>`;
  const grid=(label,list)=>`<p class="look-label">${label}</p><div class="look-grid">${list.map(card).join('')}</div>`;
  return grid('Orijinal ve sinematik',['none',...ids.filter(i=>Grade.LOOKS[i].cat==='sinema')])+grid('Eski film',ids.filter(i=>Grade.LOOKS[i].cat==='film'))
    +range(s,'lookAmt','Görünüm yoğunluğu',0,100)
    +`<div class="lib-row"><button type="button" data-lookop="compare" title="Basılı tutarken özgün görüntü gösterilir">◐ Orijinal (basılı tut)</button><button type="button" data-lookop="reset">Sıfırla</button><button type="button" data-lookop="apply" title="Yalnızca görünüm ayarlarını diğer sahnelere uygular">Diğer sahnelere uygula</button></div>`
    +`<details class="det" data-det="fine" ${lookOpen.fine?'open':''}><summary>İnce Ayarlar</summary><div class="field-row">${range(s,'gSat','Doygunluk',-100,100)}${range(s,'gVib','Doğal canlılık',-100,100)}</div><div class="field-row">${range(s,'gCon','Kontrast',-100,100)}${range(s,'gExp','Parlaklık / pozlama',-100,100)}</div><div class="field-row">${range(s,'gWarm','Sıcaklık',-100,100)}${range(s,'gSharp','Keskinlik',0,100)}</div><div class="field-row">${range(s,'brightness','Genel parlaklık',0,200)}${range(s,'contrast','Genel kontrast',0,200)}</div>${s.filter!=='none'?select(s,'filter','Eski filtre (önceki sürüm)',[['none','Yok'],['bw','Siyah-beyaz'],['old','Eski film']]):''}${s.kind==='video'?'<p class="small">Video kliplerde renk işlemleri yaklaşık uygulanır; keskinlik ve ten korumalı canlılık yalnızca fotoğraflarda tam çalışır.</p>':''}</details>`
    +filmHTML(s)+bars;
}
function drawLookCards(){
  const s=selectedScene(),m=s&&media.get(s.id),el=m?.el,iw=el?(el.videoWidth||el.naturalWidth):0,ih=el?(el.videoHeight||el.naturalHeight):0;
  document.querySelectorAll('.look-card').forEach(b=>{
    const c=b.querySelector('canvas').getContext('2d',{willReadFrequently:true});c.fillStyle='#2a2b30';c.fillRect(0,0,96,128);
    if(iw&&ih){const sc=Math.max(96/iw,128/ih),w=iw*sc,h=ih*sc;c.drawImage(el,(96-w)/2,(128-h)/2,w,h);}
    if(b.dataset.look!=='none'){const img=c.getImageData(0,0,96,128);Grade.apply(img,Grade.params(b.dataset.look,1,{}));c.putImageData(img,0,0);}
  });
}
function applyLook(id){
  const s=selectedScene();if(!s||s.look===id)return;pause();history.endGroup();
  s.look=id;s.lookAmt=100;const L=Grade.LOOKS[id];if(L&&L.film)for(const [k,f] of Object.entries(FILM_FIELDS))s[f]=L.film[k]||0;
  draftUntil=0;changed();renderLibrary(true);render();
}
function lookOp(op){
  const s=selectedScene();if(!s)return;pause();history.endGroup();
  if(op==='reset')Object.assign(s,GRADE_DEFAULTS);
  else if(op==='apply'){let n=0;for(const sc of state.scenes)if(sc!==s&&sc.kind!=='title'){for(const k of GRADE_FIELDS)sc[k]=s[k];n++;}toast(n?`Görünüm ${n} sahneye uygulandı.`:'Uygulanacak başka sahne yok.');}
  else return;
  draftUntil=0;changed();renderLibrary(true);render();
}
function renderLibrary(force){
  document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tool===tool)));
  for(const k of ['media','text','look','audio']){const el=$('#lib-'+k);if(el)el.hidden=k!==tool;}
  let sig=tool;
  if(tool==='text'){const t=curTarget();sig+=`|${libSub}|${styleCat}|${animSlot}|${t?.id}|${t?.style}|${t?.textIn}|${t?.textOut}|${t?.textLoop}|${t?.roll}|${t?.textInDur}|${t?.textOutDur}|${(state.texts||[]).map(x=>x.id+textPreview(x)).join(',')}`;}
  else if(tool==='look'){sig+=`|${selectedScene()?.id}`;}
  if(!force&&sig===libSig)return;libSig=sig;
  if(tool==='text'){$('#lib-text').innerHTML=libTextHTML();if(curTarget())(libSub==='anim'?drawAnimTiles:drawStyleTiles)();}
  else if(tool==='look'){$('#lib-look').innerHTML=libLookHTML();drawLookCards();}
  else if(tool==='media')$('#lib-media').innerHTML=libMediaHTML();
}
function setTool(k){tool=k;if(k==='text')tab='text';else if(k==='media'||k==='look')tab='visual';history.endGroup();stopTile();renderLibrary(true);renderInspector();}
// Yeni yazı: sahneye ya da tüm videoya bağlı. Orta konumda başlar, 3 sn görünür.
// Yeni yazı: sahnelerden bağımsız, oynatma çizgisinden başlar, 3 sn görünür (süre şeritten ya da Zaman sekmesinden ayarlanır).
function addText(){
  if(!total){toast('Önce bir sahne ekle.');return;}
  if(totalTexts()>=MAX_TEXTS){toast(`En çok ${MAX_TEXTS} yazı eklenebilir.`);return;}
  pause();history.endGroup();
  const t=normalizeText({text:'Yeni yazı',textPosition:'middle',textY:presetY('middle'),textDur:3});
  t.textStart=r1(clamp(time,0,Math.max(0,total-.5)));t.textDur=r1(Math.min(3,Math.max(.5,total-t.textStart)));
  (state.texts=state.texts||[]).push(t);activeText={type:'video',id:t.id};time=textWindow(t,null,'video').a;
  tab='text';tool='text';textSub='text';changed();renderTimeline();renderInspector();render();
}
function textSpan(kind){
  const t=curTarget();if(!t)return;pause();history.endGroup();
  if(kind==='all')t.textStart=0;t.textDur=0;
  showTarget(t);changed();renderTextLanes();renderInspector();render();
}
function textOp(op){
  const sc=selectedScene()||{texts:[]},t=curTarget();if(!t)return;pause();history.endGroup();const type=targetType(t);
  if(op==='clear'){t.text='';}
  else if(op==='dup'&&type!=='scene'){
    if(totalTexts()>=MAX_TEXTS){toast(`En çok ${MAX_TEXTS} yazı eklenebilir.`);return;}
    const copy={...structuredClone(t),id:uid()},list=type==='video'?state.texts:sc.texts;list.splice(list.indexOf(t)+1,0,copy);activeText={type,id:copy.id};
  }else if(op==='del'&&type!=='scene'){const list=type==='video'?state.texts:sc.texts;list.splice(list.indexOf(t),1);activeText=null;toast('Yazı silindi. Geri almak için Geri Al ya da Ctrl+Z.');}
  changed();renderTextLanes();renderInspector();render();
}

function showTarget(t){const sc=selectedScene();if(!sc||!t)return;if(targetType(t)==="scene"){if(current()?.sc.id!==sc.id)time=TL.find(x=>x.sc===sc).start;return;}const w=targetWindow(t);if(time<w.a||time>=w.b)time=w.a;}
// Örnek düğmeleri gerçek çizimle (paintText) yapılır. Üzerine gelince animasyon oynar.
function tileBg(c,cv,sample){
  const p=styleOf(sample)||{},hex=typeof p.fill==='string'&&/^#[\da-f]{6}/i.test(p.fill)?p.fill:'#ffffff',lum=parseInt(hex.slice(1,3),16)*.3+parseInt(hex.slice(3,5),16)*.59+parseInt(hex.slice(5,7),16)*.11,light=lum<90&&!p.box;
  const g=c.createLinearGradient(0,0,cv.width,cv.height);g.addColorStop(0,light?'#e4e8ee':'#4a4d55');g.addColorStop(1,light?'#c3c9d3':'#2a2c31');c.fillStyle=g;c.fillRect(0,0,cv.width,cv.height);
}
function paintSample(c,cv,sample,t,dur,editing){
  c.save();c.beginPath();c.rect(0,0,cv.width,cv.height);c.clip();applyFont(c,sample);c.translate(cv.width/2,cv.height/2);
  const fx=textFx(sample,t,dur,editing);applyFx(c,fx);paintText(c,[styledText(sample,'Mavi Kadraj')],57,sample,fx);c.restore();
}
function drawTile(b,local){
  const cv=b.querySelector('canvas'),c=cv.getContext('2d'),p=TEXT_STYLES.find(t=>t.id===b.dataset.style),a=p.anim||{};
  const sample={style:p.id,fontSize:44,font:'plain',color:typeof p.fill==='string'?p.fill:'#ffffff',textIn:a.in||'none',textInDur:a.inDur||.8,textOut:a.out||'none',textOutDur:a.outDur||.6,textLoop:a.loop||'none'};
  tileBg(c,cv,sample);paintSample(c,cv,sample,local??0,3.4,local==null);
}
function drawAnimTile(b,local){
  const cv=b.querySelector('canvas'),c=cv.getContext('2d'),s=curTarget(),v=b.dataset.anim,slot=SLOT[animSlot];
  const sample={style:s?.style||'none',fontSize:44,font:s?.font||'plain',color:s?.color||'#ffffff',textIn:'none',textInDur:1,textOut:'none',textOutDur:1,textLoop:'none'};
  sample[slot.field]=v;tileBg(c,cv,sample);
  if(v==='none'){c.save();c.fillStyle='#ffffff55';c.font='600 40px "Segoe UI",Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('⊘',cv.width/2,cv.height/2);c.restore();return;}
  const T=3.4,still=animSlot==='in'?.5:animSlot==='out'?T-.5:.7;
  paintSample(c,cv,sample,local??still,T,false);
}
const paintTile=(b,local)=>b.dataset.anim!==undefined?drawAnimTile(b,local):drawTile(b,local);
function drawStyleTiles(){document.querySelectorAll('.style-tile').forEach(b=>drawTile(b,null));}
function drawAnimTiles(){document.querySelectorAll('.anim-tile').forEach(b=>drawAnimTile(b,null));}
function playTile(b){
  stopTile();
  if(b.dataset.anim!==undefined){if(b.dataset.anim==='none')return;}else if(!TEXT_STYLES.find(t=>t.id===b.dataset.style)?.anim)return;
  const started=performance.now();const step=()=>{paintTile(b,((performance.now()-started)/1000)%3.4);tileAnim={b,id:requestAnimationFrame(step)};};step();
}
function stopTile(){if(tileAnim){cancelAnimationFrame(tileAnim.id);paintTile(tileAnim.b,null);tileAnim=null;}}
// ---- Anlatım: mikrofonla kayıt ve ses iyileştirme (her şey cihazda; hiçbir ses sunucuya gönderilmez) ----
const VOICE_DEFAULT={preset:'off',denoise:60,reverb:0,level:true};
function normVoice(v){const ok=window.Voice&&Voice.PRESETS[v?.preset];return {preset:ok?v.preset:'off',denoise:num(v?.denoise,60,0,100),reverb:num(v?.reverb,0,0,40),level:v?.level!==false};}
let voiceMsg='';
function setVoiceStatus(t){voiceMsg=t;const e=$('#voiceStatus');if(e)e.textContent=t;}
// Ham ses → ayarlara göre iyileştirilmiş ses (kapalıysa aynısı). Kanallar ayrı işlenir.
async function voiceBuffer(raw,voice=state.voice){
  if(!raw||!voice||voice.preset==='off'||!window.Voice)return raw;
  setVoiceStatus('Ses iyileştiriliyor…');
  const chans=[];for(let c=0;c<raw.numberOfChannels;c++)chans.push(await Voice.enhance(raw.getChannelData(c),raw.sampleRate,voice,p=>setVoiceStatus(`Ses iyileştiriliyor… %${Math.round(p*100)}`)));
  const out=audioContext.createBuffer(raw.numberOfChannels,raw.length,raw.sampleRate);chans.forEach((d,c)=>out.copyToChannel(d,c));
  setVoiceStatus('İyileştirme uygulandı.');return out;
}
async function makeAudio(file,w){const raw=await decodeAudio(file);return {file,raw,buffer:w==='nar'?await voiceBuffer(raw):raw};}
let voiceTimer=0,voiceRun=0,voiceJob=Promise.resolve();
async function runVoice(){
  const a=audioFiles.get('nar');if(!a||!a.raw)return;const run=++voiceRun;
  const buf=await voiceBuffer(a.raw);if(run===voiceRun&&audioFiles.get('nar')===a){a.buffer=buf;}
}
function reprocessVoice(){clearTimeout(voiceTimer);voiceTimer=setTimeout(()=>{voiceTimer=0;pause();voiceJob=runVoice().catch(e=>toast('Ses iyileştirilemedi: '+e.message));},350);}
async function flushVoice(){if(voiceTimer){clearTimeout(voiceTimer);voiceTimer=0;voiceJob=runVoice();}await voiceJob;}
let voicePreview=null;
async function playVoice(kind){
  const a=audioFiles.get('nar');if(!a)return;
  if(voicePreview){try{voicePreview.stop();}catch{}voicePreview=null;}
  await ensureAudio();const src=audioContext.createBufferSource();src.buffer=kind==='raw'?a.raw:a.buffer;src.connect(monitorGain);monitorGain.gain.value=1;src.start(0,0,Math.min(12,src.buffer.duration));src.onended=()=>{if(voicePreview===src)voicePreview=null;};voicePreview=src;
}
function renderVoice(){
  const box=$('#voiceBox');if(!box)return;const a=audioFiles.get('nar'),v=state.voice||VOICE_DEFAULT;
  if(!a){box.innerHTML='<p class="small">Anlatım eklenince (dosya ya da mikrofon) burada ses iyileştirme ayarları çıkar.</p>';return;}
  const opts=Object.entries(Voice.PRESETS).map(([k,p])=>`<option value="${k}" ${v.preset===k?'selected':''}>${p.name}</option>`).join('');
  box.innerHTML=`<strong>Ses iyileştirme (anlatım)</strong><label class="field">Ön ayar<select data-voice="preset">${opts}</select></label>`
    +(v.preset==='off'?'<p class="small">Kapalı: anlatım olduğu gibi kullanılır.</p>':`<label class="field"><span class="field-head">Gürültü azaltma<output>${v.denoise}%</output></span><input data-voice="denoise" type="range" min="0" max="100" value="${v.denoise}"></label><label class="field"><span class="field-head">Hafif yankı<output>${v.reverb}%</output></span><input data-voice="reverb" type="range" min="0" max="40" value="${v.reverb}"></label><label class="check-field"><input type="checkbox" data-voice="level" ${v.level?'checked':''}>Ses seviyesini otomatik dengele</label>`)
    +`<div class="lib-row"><button type="button" data-voiceplay="proc">▶ İyileştirilmiş</button><button type="button" data-voiceplay="raw">▶ Orijinal</button></div><p id="voiceStatus" class="small" role="status">${esc(voiceMsg)}</p>`;
}
// ---- Mikrofon kaydı ----
let rec=null;
const recClock=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
function recUI(running,text){$('#recStart').hidden=running;$('#recStop').hidden=!running;if(text!=null)$('#recTime').textContent=text;if(!running)$('#recLevel').style.width='0%';}
async function startRecording(){
  if(rec)return;
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){toast('Bu tarayıcı mikrofon kaydını desteklemiyor. Güncel Chrome veya Edge kullan.');return;}
  const ns=$('#recNs').checked,withVideo=$('#recPlay').checked&&total>0;
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:ns,autoGainControl:false}});}
  catch(e){toast(e&&e.name==='NotFoundError'?'Mikrofon bulunamadı. Bir mikrofon bağla.':'Mikrofona erişilemedi. Tarayıcıda mikrofon iznini ver.');return;}
  rec={stream,chunks:[],cancelled:false,withVideo};pause();recUI(true,'Hazırlan…');
  for(let i=3;i>0;i--){$('#recTime').textContent='Başlıyor… '+i;await new Promise(r=>setTimeout(r,1000));if(!rec||rec.cancelled)return;}
  await ensureAudio();
  const mime=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'].find(m=>MediaRecorder.isTypeSupported(m));
  rec.recorder=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:192000}:undefined);
  const R=rec;rec.recorder.ondataavailable=e=>{if(e.data&&e.data.size)R.chunks.push(e.data);};
  R.done=new Promise(res=>{R.recorder.onstop=res;});
  rec.an=audioContext.createAnalyser();rec.an.fftSize=1024;rec.src=audioContext.createMediaStreamSource(stream);rec.src.connect(rec.an);
  rec.recorder.start(250);rec.startedAt=performance.now();
  if(withVideo){time=0;await play('all');monitorGain.gain.value=0;}   // video sessiz oynar; yalnızca görüntü izlenir
  const buf=new Float32Array(rec.an.fftSize),limit=withVideo?total+1:MAX_TOTAL;
  rec.timer=setInterval(()=>{
    if(!rec)return;const s=(performance.now()-rec.startedAt)/1000;recUI(true,recClock(s));
    rec.an.getFloatTimeDomainData(buf);let sum=0;for(const v of buf)sum+=v*v;const dbv=20*Math.log10(Math.sqrt(sum/buf.length)+1e-9);$('#recLevel').style.width=Math.max(0,Math.min(100,(dbv+60)/60*100))+'%';
    if(s>=limit||(withVideo&&!playing&&s>1))stopRecording();
  },100);
}
async function stopRecording(){
  const r=rec;if(!r||!r.recorder)return;rec=null;clearInterval(r.timer);pause();
  try{r.recorder.state!=='inactive'&&r.recorder.stop();await r.done;}catch{}
  r.stream.getTracks().forEach(t=>t.stop());try{r.src.disconnect();}catch{}recUI(false,'00:00');
  const blob=new Blob(r.chunks,{type:r.recorder.mimeType||'audio/webm'});if(blob.size<1000){toast('Kayıt boş görünüyor; mikrofonu kontrol et.');return;}
  const ext=/ogg/.test(blob.type)?'ogg':/mp4/.test(blob.type)?'m4a':'webm',stamp=new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}).replace(':','.');
  const file=new File([blob],`Mikrofon kaydı ${stamp}.${ext}`,{type:blob.type});
  if(audioFiles.has('nar')&&!confirm('Mevcut anlatımın yerine bu kayıt konsun mu?'))return;
  try{
    if(state.voice.preset==='off'){const p=Voice.PRESETS.dogal;state.voice={preset:'dogal',denoise:p.denoise,reverb:p.reverb,level:true};}   // mikrofon kaydında varsayılan: Doğal iyileştirme
    const a=await makeAudio(file,'nar');pause();audioFiles.set('nar',a);state.audioAssets.nar=registerAsset(file,'audio');assets.get(state.audioAssets.nar).buffer=a.raw;state.narName=file.name;
    changed();renderAudio();toast(`Kayıt anlatım olarak eklendi (${recClock(a.raw.duration)}). Ses iyileştirme ayarları aşağıda.`);
  }catch(e){toast('Kayıt eklenemedi: '+(e.message||e));}
}
$('#recStart').onclick=()=>safely(startRecording)();$('#recStop').onclick=()=>safely(stopRecording)();
$('#voiceBox').addEventListener('input',e=>{
  const el=e.target.closest('[data-voice]');if(!el)return;const k=el.dataset.voice;
  if(k==='preset'){const p=Voice.PRESETS[el.value]||{};state.voice={preset:el.value,denoise:p.denoise??60,reverb:p.reverb??0,level:true};}
  else{state.voice={...state.voice,[k]:el.type==='checkbox'?el.checked:Number(el.value)};if(el.type==='range'){const o=el.closest('.field')?.querySelector('output');if(o)o.textContent=el.value+'%';}}
  changed(k==='preset'?null:'voice:'+k);reprocessVoice();if(k==='preset'||el.type==='checkbox')renderVoice();
});
$('#voiceBox').addEventListener('change',()=>history.endGroup());
$('#voiceBox').addEventListener('click',e=>{const b=e.target.closest('[data-voiceplay]');if(b)safely(()=>playVoice(b.dataset.voiceplay))();});
function renderAudio(){renderVoice();
  $('#audioControls').innerHTML=['nar','amb'].map(w=>`<div class="audio-row"><strong>${w==='nar'?'Anlatım':'Müzik / ortam'}</strong><button data-audio="${w}">${parent!==window?(w==='amb'?'Fon müziklerimden seç':'Şiir kayıtlarımdan seç'):'Dosya Seç'}</button><span class="filename" title="${esc(state[w+'Name'])}">${esc(state[w+'Name']||'Ses eklenmedi')}</span><input data-volume="${w}" aria-label="${w==='nar'?'Anlatım':'Müzik'} ses düzeyi" type="range" min="0" max="100" value="${Math.round(state.vol[w]*100)}"><label class="loop-label">${w==='amb'?`<input id="ambLoop" type="checkbox" ${state.ambLoop?'checked':''}>Tekrarla`:'Baştan başlar'}</label><button class="remove-audio" data-remove-audio="${w}" aria-label="${w==='nar'?'Anlatımı':'Müziği'} kaldır" ${audioFiles.has(w)?'':'disabled'}>×</button></div>`).join('')+ambExtras();
  renderAudioLanes();
}
function ambExtras(){return `<div class="audio-row amb-extra"><label class="loop-label"><input id="ambOn" type="checkbox" ${state.ambOn===false?'':'checked'}>Fonlu video (fon dışa aktarmaya girer)</label><label class="loop-label">Fon başlangıcı (sn)<input id="ambStart" type="number" min="0" max="600" step="1" value="${state.ambStart||0}"></label><label class="loop-label">Giriş yumuşatma (sn)<input id="ambFadeIn" type="number" min="0" max="10" step=".5" value="${state.ambFadeIn||0}"></label><label class="loop-label">Çıkış yumuşatma (sn)<input id="ambFadeOut" type="number" min="0" max="10" step=".5" value="${state.ambFadeOut||0}"></label></div>`;}
function renderAudioLanes(){
  const el=$('#audioLanes');if(!el)return;
  const rows=[['nar','Anlatım'],['amb','Fon']].map(([k,label])=>{const a=audioFiles.get(k);if(!a||!a.buffer)return '';const off=k==='amb'&&state.ambOn===false,dur=a.buffer.duration,len=k==='amb'?(state.ambLoop?Math.max(total,dur):Math.max(1,dur-(state.ambStart||0))):dur,tag=k==='amb'?(off?' · kapalı':'')+(state.ambStart?` · ${state.ambStart} sn’den`:''):'';return `<div class="tl-audio ${k}${off?' off':''}" style="width:${Math.max(40,len*tlPps)}px" title="${label}: ${esc(state[k+'Name']||'')} · ${fmtT(dur)}"><span>${label} · ${esc(state[k+'Name']||'')}${tag}</span></div>`;}).join('');
  el.innerHTML=rows||'<p class="lane-hint">Anlatım ve fon şeritleri, ses eklenince burada ayrı kanallar olarak görünür.</p>';
}
function applyFont(c,s){
  const p=styleOf(s);
  c.font=p?`${p.italic?'italic ':''}${p.weight||700} ${effSize(s)}px ${p.font}`:`${s.fontSize}px ${fonts[s.font]}`;
  c.textAlign='center';c.textBaseline='middle';
  if('letterSpacing' in c)c.letterSpacing=p&&p.spacing?(p.spacing*effSize(s))+'px':'0px';
}
const styledText=(s,t)=>styleOf(s)?.upper?t.toLocaleUpperCase('tr-TR'):t;
function boxPath(c,x,y,w,h,r){c.beginPath();if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);}
// Satır arkası etiket/bant: renk ya da degrade, çerçeve, dış bant, sert gölge; h/dy ile fosforlu ya da alt çizgi gibi ince bantlar.
function drawBox(c,b,x,y,w,fs){
  const px=b.pad*fs,h=(b.h||1.24)*fs,top=y+(b.dy??-.62)*fs,bx=x-px,bw=w+px*2,r=Math.max(0,Math.min(b.r*fs,h/2,bw/2));
  if(b.outer){const e=b.outer.pad*fs;c.fillStyle=b.outer.c;boxPath(c,bx-e,top-e,bw+e*2,h+e*2,Math.min(r+e,(h+e*2)/2,(bw+e*2)/2));c.fill();}
  if(b.drop){c.fillStyle=b.drop.c;boxPath(c,bx+b.drop.x*fs,top+b.drop.y*fs,bw,h,r);c.fill();}
  if(b.c){let f=b.c;if(Array.isArray(f)){f=c.createLinearGradient(bx,0,bx+bw,0);f.addColorStop(0,b.c[0]);f.addColorStop(1,b.c[1]);}c.fillStyle=f;boxPath(c,bx,top,bw,h,r);c.fill();}
  if(b.border){c.strokeStyle=b.border.c;c.lineWidth=b.border.w*fs;boxPath(c,bx,top,bw,h,r);c.stroke();}
}
// ---- Yazı animasyonu: Giriş / Çıkış / Döngü. Hepsi sahne içindeki zamanın işlevidir; önizleme ve dışa aktarma aynı sonucu verir. ----
const TEXT_IN=[['none','Anında göster'],['typewriter','Daktilo (harf harf yazılır)'],['letters','Harf harf belirme'],['wipe','Soldan yazılır gibi'],['fade','Belirme'],['rise','Yükselerek belirme'],['pop','Büyüyerek zıplama'],['slide','Soldan kayarak gelme'],['blur','Bulanıktan netleşme']];
const TEXT_OUT=[['none','Sahne sonuna kadar kalsın'],['fade','Solarak kaybolma'],['rise','Yukarı kayarak kaybolma'],['shrink','Küçülerek kaybolma'],['blur','Bulanıklaşarak kaybolma']];
const TEXT_LOOP=[['none','Sabit'],['breathe','Nefes alma'],['wave','Harf dalgası'],['shake','Titreme'],['flicker','Neon titremesi'],['pulse','Parlama nabzı']];
const FX0={alpha:1,dx:0,dy:0,scale:1,blur:0,chars:1,wipe:1,letter:-1,wave:0,jit:0,glowK:1,t:0};
const ease3=v=>v*v*(3-2*v);
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
// editing=true iken (duraklatılmış önizleme) giriş/çıkış tamamlanmış hâliyle gösterilir; döngü sahne zamanına göre sürer.
function textFx(s,local,dur,editing){
  const fx={...FX0,t:local},fs=s.fontSize,lim=Math.max(.1,dur);
  const inD=clamp(s.textInDur,.1,lim),outD=clamp(s.textOutDur,.1,lim);
  const pin=editing||s.textIn==='none'?1:clamp(local/inD,0,1),q=ease3(pin);
  const pout=editing||s.textOut==='none'?0:clamp((local-(dur-outD))/outD,0,1),o=ease3(pout);
  if(pin<1)switch(s.textIn){
    case 'fade':fx.alpha*=q;break;
    case 'rise':fx.alpha*=q;fx.dy+=(1-q)*fs*.9;break;
    case 'pop':{const b=1+2.70158*Math.pow(pin-1,3)+1.70158*Math.pow(pin-1,2);fx.scale*=.4+.6*b;fx.alpha*=Math.min(1,pin*4);break;}
    case 'slide':fx.alpha*=q;fx.dx-=(1-q)*420;break;
    case 'blur':fx.alpha*=Math.min(1,pin*1.6);fx.blur+=(1-q)*fs*.4;break;
    case 'typewriter':fx.chars=pin;break;
    case 'wipe':fx.wipe=pin;break;
    case 'letters':fx.letter=pin;break;
  }
  if(pout>0)switch(s.textOut){
    case 'fade':fx.alpha*=1-o;break;
    case 'rise':fx.alpha*=1-o;fx.dy-=o*fs*.9;break;
    case 'shrink':fx.alpha*=1-o;fx.scale*=1-.5*o;break;
    case 'blur':fx.alpha*=1-o;fx.blur+=o*fs*.4;break;
  }
  const t=local;
  switch(s.textLoop){
    case 'breathe':fx.scale*=1+.035*Math.sin(t*2*Math.PI/2.4);break;
    case 'wave':fx.wave=fs*.1;break;
    case 'shake':fx.jit=fs*.03;break;
    case 'flicker':{const f=Math.sin(t*37)*Math.sin(t*23.3);fx.alpha*=f>.8?.35:f>.55?.7:1;break;}
    case 'pulse':fx.glowK=.5+.5*(.5+.5*Math.sin(t*2*Math.PI/1.8));break;
  }
  return fx;
}
function applyFx(c,fx){c.globalAlpha*=fx.alpha;c.translate(fx.dx,fx.dy);c.scale(fx.scale,fx.scale);if(fx.blur>.4)c.filter=`blur(${fx.blur}px)`;}
// Yazıyı (satırları) ayrı bir katman olarak çizer. Ön ayar ve animasyon yoksa eski görünüm aynen korunur.
function paintText(c,lines,lh,s,fx=FX0){
  const p=styleOf(s),fs=effSize(s),n=lines.length,perChar=fx.wave>0||fx.jit>0||fx.letter>=0;
  const total=lines.reduce((a,l)=>a+l.length,0),shown=Math.floor(fx.chars*total+1e-9);let before=0;
  if(p){c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetX=0;c.shadowOffsetY=0;}
  lines.forEach((line,i)=>{
    let y=(i-(n-1)/2)*lh,w=c.measureText(line).width,vis=Math.max(0,Math.min(line.length,shown-before));before+=line.length;
    if(fx.chars<1&&!vis)return;
    const partial=vis<line.length,left=-w/2,mode=perChar||partial,visible=line.slice(0,vis);
    const xs=perChar?Array.from({length:vis},(_,k)=>left+c.measureText(line.slice(0,k)).width):null;
    // m: 'fillText' | 'strokeText'; ox/oy: kaydırma (3B kalınlık için).
    const put=(m,ox=0,oy=0)=>{
      if(!mode){c.textAlign='center';c[m](line,ox,y+oy);return;}
      c.textAlign='left';
      if(!perChar){c[m](visible,left+ox,y+oy);return;}
      for(let k=0;k<vis;k++){
        const ch=visible[k];if(ch===' ')continue;let dx=0,dy=0,al=1;
        if(fx.wave)dy=Math.sin(fx.t*2*Math.PI/1.4-k*.55)*fx.wave;
        if(fx.jit){const f=Math.floor(fx.t*18);dx=(hash(k*7.3+f)-.5)*2*fx.jit;dy+=(hash(k*3.1+f+99)-.5)*2*fx.jit;}
        if(fx.letter>=0){const q=ease3(clamp((fx.letter-k/Math.max(1,line.length)*.65)/.35,0,1));al=q;dy+=(1-q)*fs*.5;}
        if(al<=0)continue;
        const prev=c.globalAlpha;c.globalAlpha=prev*al;c[m](ch,xs[k]+ox+dx,y+oy+dy);c.globalAlpha=prev;
      }
    };
    c.save();c.lineJoin='round';c.miterLimit=2;
    if(p&&p.tilt){c.translate(0,y);c.rotate(p.tilt*Math.PI/180);y=0;}
    if(fx.wipe<1){c.beginPath();c.rect(left-fs*.5,y-fs*1.2,(w+fs)*fx.wipe,fs*2.4);c.clip();}
    if(!p){c.fillStyle=s.color;c.shadowColor='#000c';c.shadowBlur=12;c.shadowOffsetY=3;put('fillText');c.restore();return;}
    let fill=s.color;if(Array.isArray(p.fill)){fill=c.createLinearGradient(0,y-fs*.55,0,y+fs*.55);fill.addColorStop(0,p.fill[0]);fill.addColorStop(1,p.fill[1]);}
    if(p.box&&line.trim()){drawBox(c,p.box,left,y,partial?c.measureText(visible).width:w,fs);}
    if(p.extrude){const e=p.extrude;c.fillStyle=e.c;c.strokeStyle=e.c;if(p.stroke)c.lineWidth=p.stroke.w*fs;for(let k=e.n;k>=1;k--){put('fillText',e.x*fs*k/e.n,e.y*fs*k/e.n);if(p.stroke)put('strokeText',e.x*fs*k/e.n,e.y*fs*k/e.n);}}
    if(p.shadow){const sh=p.shadow;c.save();c.shadowColor=sh.c;c.shadowBlur=sh.b*fs;c.shadowOffsetX=(sh.x||0)*fs;c.shadowOffsetY=(sh.y||0)*fs;const wide=p.outer||p.stroke;if(wide){c.strokeStyle=wide.c;c.lineWidth=wide.w*fs;put('strokeText');}c.fillStyle=fill;put('fillText');c.restore();}
    if(p.glow){c.save();c.fillStyle=fill;c.shadowColor=p.glow.c;c.shadowBlur=p.glow.b*fs*fx.glowK;for(let k=0;k<p.glow.n;k++)put('fillText');c.restore();}
    for(const o of [p.outer,p.stroke])if(o){c.strokeStyle=o.c;c.lineWidth=o.w*fs;put('strokeText');}
    c.fillStyle=fill;put('fillText');c.restore();
  });
}
// Satırlara bölme (kelime kaydırma). Boş satır kıta aralığıdır.
function wrapLines(c,s){
  applyFont(c,s);
  const maxWidth=940,lines=[];
  for(const paragraph of styledText(s,s.text).split('\n')){
    let line='';
    for(const word of paragraph.split(' ')){
      if(c.measureText((line?line+' ':'')+word).width<=maxWidth){line+=(line?' ':'')+word;continue;}
      if(line)lines.push(line);line='';
      for(const char of word){if(c.measureText(line+char).width>maxWidth){lines.push(line);line='';}line+=char;}
    }lines.push(line);
  }
  return lines;
}
function textLayout(c,s){
  const lines=wrapLines(c,s),maxWidth=940;
  const lineHeight=effSize(s)*1.3,height=lines.length*lineHeight,width=Math.min(maxWidth,Math.max(...lines.map(l=>c.measureText(l).width),1));
  const win=frameWin(),mid=win.top+win.h/2,x=clamp(s.textX*10.8,width/2+35,1080-width/2-35),y=clamp(s.textY*19.2,Math.min(mid,win.top+height/2+35),Math.max(mid,win.top+win.h-height/2-35));
  return {lines,lineHeight,height,width,x,y};
}
// ---- Akan şiir: satırlar alttan yazılır, önceki satırlar yukarı kayar, üst güvenli çizgide solarak kaybolur ----
const ROLL_TAIL=1.2,ROLL_MIN_DELAY=.015,ROLL_SLIDE=.3;
const rollTop=()=>{const w=frameWin();return w.top+Math.round(w.h*.1);},rollBottom=()=>{const w=frameWin();return w.top+w.h-Math.round(w.h*.018);};
function rollSchedule(c,s,ld){
  const lines=wrapLines(c,s),letters=lines.reduce((a,l)=>a+l.length,0),filled=lines.filter(l=>l.length).length,blank=lines.length-filled;
  const fixed=s.rollPause*filled+s.rollPause*1.5*blank;
  const wanted=s.rollFit?(ld-ROLL_TAIL-fixed)/Math.max(1,letters):s.rollDelay,cd=Math.max(ROLL_MIN_DELAY,wanted);
  const starts=[];let acc=0;for(const l of lines){starts.push(acc);acc+=l.length?l.length*cd+s.rollPause:s.rollPause*1.5;}
  const need=acc+ROLL_TAIL,minDur=s.rollFit?fixed+letters*ROLL_MIN_DELAY+ROLL_TAIL:need;
  return {lines,starts,cd,end:acc,need,minDur,fits:ld+1e-6>=(s.rollFit?minDur:need),letters};
}
// Akan yazıda satırların nasıl belireceği Giriş animasyonuyla seçilir:
// daktilo (harf harf), harf harf belirme (şeffaftan), soldan yazılır gibi; diğerleri (belirme, yükselerek, büyüme, kayma, bulanık) her satıra ayrı uygulanır.
const ROLL_LETTER_TAIL=.9;
function drawRoll(c,s,lt,ld,editing){
  const sch=rollSchedule(c,s,ld),{lines,starts,cd}=sch;if(!lines.length)return null;
  applyFont(c,s);const fs=effSize(s),lh=fs*1.3;
  const t=editing?sch.end:lt;let k=0;for(let i=0;i<lines.length;i++)if(starts[i]<=t+1e-9)k=i;
  const width=Math.min(940,Math.max(...lines.map(l=>c.measureText(l).width),1)),x=clamp(s.textX*10.8,width/2+35,1080-width/2-35);
  const anchor=clamp(s.textY*19.2,rollTop()+lh,rollBottom()-lh/2);
  const e=editing?1:clamp((t-starts[k])/ROLL_SLIDE,0,1),slide=lh*(1-e*e*(3-2*e));
  const reveal=['typewriter','letters','wipe'].includes(s.textIn)?s.textIn:s.textIn==='none'?'typewriter':null;
  const fx=textFx({...s,textIn:'none'},lt,ld,editing),sLine={...s,textOut:'none',textLoop:'none'},base=c.globalAlpha;
  c.globalAlpha=base*fx.alpha;if(fx.blur>.4)c.filter=`blur(${fx.blur}px)`;
  let topY=Infinity,botY=-Infinity;
  for(let i=k;i>=0;i--){
    const y=anchor-(k-i)*lh+slide;if(y<rollTop())break;
    if(!lines[i])continue;
    const len=lines[i].length,tl=editing?1e6:t-starts[i],T=len*cd;
    let chars=1,letter=-1,wipe=1,lf=null;
    if(reveal==='typewriter'){const typed=editing||i<k?len:clamp(Math.floor(tl/cd+1e-9),0,len);chars=typed/len;if(typed===0)continue;}
    else if(reveal==='wipe')wipe=editing?1:clamp(tl/(T+.15),0,1);
    else if(reveal==='letters'){const span=T+ROLL_LETTER_TAIL;letter=editing||tl>=span?-1:clamp(tl/span,0,1);}
    else lf=textFx(sLine,tl,1e9,editing);
    const fade=clamp((y-rollTop())/lh,0,1)*(i===k?.35+.65*e:1);if(fade<=0)continue;
    c.save();c.translate(x+(lf?lf.dx:0),y+(lf?lf.dy:0));if(lf){c.scale(lf.scale,lf.scale);if(lf.blur>.4)c.filter=`blur(${lf.blur}px)`;}
    c.globalAlpha=base*fx.alpha*fade*(lf?lf.alpha:1);
    paintText(c,[lines[i]],lh,s,{...fx,chars,letter,wipe,dx:0,dy:0,scale:1,alpha:1,blur:0});
    c.restore();topY=Math.min(topY,y-lh/2);botY=Math.max(botY,y+lh/2);
  }
  c.globalAlpha=base;
  return topY===Infinity?null:{x:x-width/2,y:topY,w:width,h:botY-topY};
}
// ---- Yazı pencereleri: her yazı sahneye ya da videoya bağlıdır; başlangıç ve süreye göre görünür ----
const MAX_ACTIVE_TEXTS=6;
function textWindow(src,e,mode){
  if(mode==='video'){const a=clamp(src.textStart,0,Math.max(0,total-.1)),b=src.textDur>0?Math.min(total,a+src.textDur):total;return {a,b};}
  const a=e.start+clamp(src.textStart,0,Math.max(0,e.dur-.1)),b=src.textDur>0?Math.min(e.start+e.dur,a+src.textDur):e.start+e.dur;return {a,b};
}
// Çizim sırası: sahnenin kendi yazısı, sahne yazıları, sonra video yazıları (üstte).
function allTexts(){
  const list=[];
  for(const e of TL){
    list.push({src:e.sc,ref:{type:'scene',id:e.sc.id,sid:e.sc.id},scene:e,...textWindow(e.sc,e,'scene')});
    for(const x of e.sc.texts||[])list.push({src:x,ref:{type:'extra',id:x.id,sid:e.sc.id},scene:e,...textWindow(x,e,'scene')});
  }
  for(const x of state.texts||[])list.push({src:x,ref:{type:'video',id:x.id,sid:null},scene:null,...textWindow(x,null,'video')});
  return list.filter(i=>i.src.text.trim()&&i.b>i.a);
}
function activeTexts(t,e){
  return allTexts().filter(i=>(i.ref.type==='video'?true:i.scene===e)&&t>=i.a-1e-9&&t<i.b-1e-9).map(i=>i.ref.type==='video'?{...i,ref:{...i.ref,sid:e?.sc.id||null}}:i);
}
// Aynı anda en çok kaç yazı görünüyor (uyarı için).
function maxOverlap(){
  const ev=[];for(const i of allTexts()){ev.push([i.a,1]);ev.push([i.b,-1]);}
  ev.sort((x,y)=>x[0]-y[0]||x[1]-y[1]);let n=0,m=0;for(const [,d] of ev){n+=d;m=Math.max(m,n);}return m;
}
// Tek bir yazıyı çizer. legacy: sahnenin kendi yazısı için eski başlık kartı giriş/hareket davranışı.
function drawLayer(c,s,lt,ld,editing,legacy){
  c.save();const l=textLayout(c,s);c.fillStyle=s.color;c.shadowColor='#000c';c.shadowBlur=12;c.shadowOffsetY=3;
  // Caption is a separate layer: image opacity/filter never touches it.
  let a=1,dx=0,dy=0,textZoom=1;
  if(legacy){
    const sc=legacy.scene,local=legacy.local,p=legacy.p;
    a=sc.kind==='title'&&!editing&&sc.entry==='fade'&&sc.entryDur>0?clamp(local/sc.entryDur,0,1):1;
    if(sc.kind==='title'&&!editing&&sc.entry==='slide'){const q=1-clamp(local/Math.max(.001,sc.entryDur),0,1);if(sc.entrySide==='left')dx=-1080*q;if(sc.entrySide==='right')dx=1080*q;if(sc.entrySide==='up')dy=-1920*q;if(sc.entrySide==='down')dy=1920*q;}
    if(sc.kind==='title'){
      if(sc.motion==='in')textZoom=1+.18*p;if(sc.motion==='out')textZoom=1+.18*(1-p);
      if(sc.motion==='left')dx-=(p-.5)*1080*.16;if(sc.motion==='right')dx+=(p-.5)*1080*.16;if(sc.motion==='up')dy-=(p-.5)*1920*.16;if(sc.motion==='down')dy+=(p-.5)*1920*.16;
    }
  }
  c.globalAlpha=a;
  c.translate(l.x+dx,l.y+dy);c.scale(textZoom,textZoom);const fx=textFx(s,lt,ld,editing);applyFx(c,fx);
  paintText(c,l.lines,l.lineHeight,s,fx);c.restore();
  return {x:l.x+dx-l.width*textZoom/2,y:l.y+dy-l.height*textZoom/2,w:l.width*textZoom,h:l.height*textZoom};
}
// ---- Görüntü hattı: renk işleme önbelleği, film efektleri, sinema bantları ----
const GRADE_FIELDS=['look','lookAmt','gSat','gVib','gCon','gExp','gWarm','gSharp','fGrain','fVig','fDust','fFlick','fWeave','brightness','contrast','filter'];
const GRADE_DEFAULTS={look:'none',lookAmt:100,gSat:0,gVib:0,gCon:0,gExp:0,gWarm:0,gSharp:0,fGrain:0,fVig:0,fDust:0,fFlick:0,fWeave:0,brightness:100,contrast:100,filter:'none'};
const FILM_FIELDS={grain:'fGrain',vignette:'fVig',dust:'fDust',flicker:'fFlick',weave:'fWeave'};
let compareOriginal=false,draftUntil=0,draftTimer=0;
const gradeCache=[];   // en çok 4 işlenmiş görüntü (bellek sınırı)
function frameWin(){const cin=state.cinema;if(!cin||!cin.bars)return {top:0,h:1920};const h=({'4:5':1350,'1:1':1080,'16:9':608})[cin.ratio]||1350;return {top:(1920-h)/2,h};}
const presetY=pos=>{const w=frameWin();return (w.top+({top:.18,middle:.5,bottom:.82})[pos]*w.h)/19.2;};
function sceneGrade(s){return Grade.params(s.look,(s.lookAmt??100)/100,{sat:s.gSat/100,vib:s.gVib/100,con:s.gCon/100,exp:s.gExp/100,warm:s.gWarm/100,sharp:s.gSharp/100});}
// Fotoğraf: piksel hattıyla işlenmiş kopya (önizleme ve dışa aktarma aynı kodu kullanır; kaynak özgün dosyadan okunur)
function gradedSource(s,m){
  const el=m.el;if(compareOriginal||!(el instanceof HTMLImageElement)||!window.Grade)return el;
  const p=sceneGrade(s);if(Grade.isNeutral(p))return el;
  const iw=el.naturalWidth,ih=el.naturalHeight,long=Math.max(iw,ih);
  const cap=exporting?4096:(performance.now()<draftUntil?640:2304),L=Math.min(long,cap),f=L/long;
  const cw=Math.max(1,Math.round(iw*f)),ch=Math.max(1,Math.round(ih*f)),key=m.url+'|'+Grade.key(p)+'|'+cw+'x'+ch;
  const hit=gradeCache.find(g=>g.key===key);
  if(hit){gradeCache.splice(gradeCache.indexOf(hit),1);gradeCache.unshift(hit);return hit.canvas;}
  const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;const x=cv.getContext('2d',{willReadFrequently:true});
  x.imageSmoothingQuality='high';x.drawImage(el,0,0,cw,ch);
  const img=x.getImageData(0,0,cw,ch);Grade.apply(img,p);x.putImageData(img,0,0);
  gradeCache.unshift({key,canvas:cv});while(gradeCache.length>4){const old=gradeCache.pop();old.canvas.width=old.canvas.height=0;}
  return cv;
}
// Video klip: piksel hattı yok; yaklaşık CSS süzgeci
function cssGrade(s){
  if(compareOriginal||!window.Grade)return '';const p=sceneGrade(s);if(Grade.isNeutral(p))return '';
  return ` brightness(${Math.pow(2,p.exposure).toFixed(3)}) contrast(${(1+p.contrast*.6).toFixed(3)}) saturate(${(1+p.saturation+Math.max(0,p.vibrance)*.5).toFixed(3)})${p.sepia>0?` sepia(${p.sepia.toFixed(2)})`:''}${p.bw>0?` grayscale(${p.bw.toFixed(2)})`:''}`;
}
// ---- Film efektleri: kare numarasına (24 kare/sn film ritmi) bağlıdır; önizleme ve dışa aktarma aynı kareyi üretir ----
const FILM_FPS=24,filmFrame=t=>Math.floor(t*FILM_FPS+1e-6);
const hash2=(a,b)=>{const x=Math.sin(a*127.1+b*311.7+17.3)*43758.5453;return x-Math.floor(x);};
const idSeed=id=>{let h=0;for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))|0;return Math.abs(h)%1000;};
function mulberry(a){return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const grainTiles=[];
function noiseTile(i){
  if(grainTiles[i])return grainTiles[i];
  const cv=document.createElement('canvas');cv.width=cv.height=256;const x=cv.getContext('2d'),img=x.createImageData(256,256),r=mulberry(9000+i*77);
  for(let k=0;k<65536;k++){const v=Math.max(0,Math.min(255,Math.round(128+(r()+r()+r()-1.5)*120))),o=k*4;img.data[o]=img.data[o+1]=img.data[o+2]=v;img.data[o+3]=255;}
  x.putImageData(img,0,0);return grainTiles[i]=cv;
}
function weaveOffset(s,t){
  const a=(s.fWeave||0)/100;if(a<=0)return null;const f=filmFrame(t),sd=idSeed(s.id);
  return {dx:(hash2(f,sd+1)-.5)*2*a*6,dy:(hash2(f,sd+2)-.5)*2*a*6,rot:(hash2(f,sd+3)-.5)*2*a*.0044,zoom:1+a*.016};
}
function filmOverlay(c,s,t,win){
  const grain=(s.fGrain||0)/100,vig=(s.fVig||0)/100,dust=(s.fDust||0)/100,flick=(s.fFlick||0)/100;
  if(!(grain||vig||dust||flick))return;
  const f=filmFrame(t),sd=idSeed(s.id);
  c.save();c.beginPath();c.rect(0,win.top,1080,win.h);c.clip();
  if(flick>0){
    const v=hash2(f,sd+9)*.6+Math.sin(t*5.7+sd)*.4,amt=v*flick*.10;
    if(amt>0){c.globalCompositeOperation='lighter';c.fillStyle=`rgba(255,244,225,${(amt*.6).toFixed(4)})`;}else c.fillStyle=`rgba(0,0,0,${(-amt).toFixed(4)})`;
    c.fillRect(0,win.top,1080,win.h);c.globalCompositeOperation='source-over';
  }
  if(grain>0){
    const tile=noiseTile(f%8),sz=512,ox=Math.floor(hash2(f,sd+4)*sz),oy=Math.floor(hash2(f,sd+5)*sz);
    c.globalCompositeOperation='overlay';c.globalAlpha=Math.min(1,grain*.9);
    for(let y=-oy;y<win.h;y+=sz)for(let x=-ox;x<1080;x+=sz)c.drawImage(tile,x,win.top+y,sz,sz);
    c.globalAlpha=1;c.globalCompositeOperation='source-over';
  }
  if(vig>0){
    const cy=win.top+win.h/2,rad=Math.hypot(540,win.h/2),g=c.createRadialGradient(540,cy,rad*.45,540,cy,rad);
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${(vig*.85).toFixed(3)})`);c.fillStyle=g;c.fillRect(0,win.top,1080,win.h);
  }
  if(dust>0){
    const r=mulberry(sd*131+Math.floor(f/2)*7919),n=Math.round(dust*18);
    for(let k=0;k<n;k++){const x=r()*1080,y=win.top+r()*win.h,rad=.8+r()*2.6,light=r()<.5;c.fillStyle=light?`rgba(255,255,255,${(.25+r()*.35).toFixed(2)})`:`rgba(10,8,6,${(.25+r()*.35).toFixed(2)})`;c.beginPath();c.ellipse(x,y,rad,rad*(.6+r()*.6),r()*3,0,Math.PI*2);c.fill();}
    const r2=mulberry(sd*977+Math.floor(f/3)*104729);
    if(r2()<.3*dust){const x=r2()*1080,y1=win.top+r2()*win.h*.5,len=120+r2()*Math.min(700,win.h*.6);c.strokeStyle=`rgba(255,255,255,${(.18+r2()*.2).toFixed(2)})`;c.lineWidth=1.1;c.beginPath();c.moveTo(x,y1);c.lineTo(x+(r2()-.5)*6,y1+len);c.stroke();}
    const r3=mulberry(sd*313+Math.floor(f/4)*1237);
    if(r3()<.25*dust){const x=r3()*1080,y=win.top+r3()*win.h;c.strokeStyle='rgba(10,8,6,.5)';c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+(r3()-.5)*40,y+10+r3()*20,x+(r3()-.5)*60,y+25+r3()*35);c.stroke();}
  }
  c.restore();
}
function draw(c,t,editing=false,scale=1){
  c.save();if(scale!==1)c.scale(scale,scale);c.imageSmoothingQuality='high';
  c.clearRect(0,0,1080,1920);c.fillStyle='#000';c.fillRect(0,0,1080,1920);
  const e=current(t);if(!e){c.restore();return [];}const s=e.sc,local=clamp(t-e.start,0,e.dur),p=local/e.dur;
  const win=frameWin(),WH=win.h;
  c.fillStyle=s.background;c.fillRect(0,win.top,1080,WH);
  const m=media.get(s.id);
  if(m){
    const el=m.el,iw=el.videoWidth||el.naturalWidth,ih=el.videoHeight||el.naturalHeight;
    if(iw&&ih){
      let z=s.zoom,dx=s.x*10.8,dy=s.y*WH/100;
      if(s.motion==='in')z*=1+.18*p;if(s.motion==='out')z*=1+.18*(1-p);
      if(['left','right','up','down'].includes(s.motion)){z*=1.18;const travel=(p-.5)*.16;if(s.motion==='left')dx-=travel*1080;if(s.motion==='right')dx+=travel*1080;if(s.motion==='up')dy-=travel*WH;if(s.motion==='down')dy+=travel*WH;}
      const entry=editing||s.entryDur===0?1:clamp(local/Math.min(e.dur,s.entryDur),0,1),ease=entry*entry*(3-2*entry);
      if(s.entry==='slide'){const q=1-ease;if(s.entrySide==='left')dx-=1080*q;if(s.entrySide==='right')dx+=1080*q;if(s.entrySide==='up')dy-=WH*q;if(s.entrySide==='down')dy+=WH*q;}
      const sc=(s.fit==='contain'?Math.min(1080/iw,WH/ih):Math.max(1080/iw,WH/ih))*z,w=iw*sc,h=ih*sc;
      c.save();c.beginPath();c.rect(0,win.top,1080,WH);c.clip();
      c.globalAlpha=s.opacity/100*(s.entry==='fade'?ease:1);
      c.filter=`brightness(${s.brightness}%) contrast(${s.contrast}%) ${s.filter==='bw'?'grayscale(1)':s.filter==='old'?'sepia(.85) saturate(.65) contrast(.9)':''}`+(el instanceof HTMLVideoElement?cssGrade(s):'');
      const wv=compareOriginal?null:weaveOffset(s,t);
      if(wv){const cy=win.top+WH/2;c.translate(540,cy);c.rotate(wv.rot);c.scale(wv.zoom,wv.zoom);c.translate(-540,-cy);c.translate(wv.dx,wv.dy);}
      c.drawImage(gradedSource(s,m),(1080-w)/2+dx,win.top+(WH-h)/2+dy,w,h);c.restore();
    }
  }
  if(!compareOriginal)filmOverlay(c,s,t,win);   // film efektleri görüntü katmanına uygulanır, yazıya uygulanmaz
  if(win.top>0){c.fillStyle='#000';c.fillRect(0,0,1080,win.top);c.fillRect(0,win.top+WH,1080,1920-win.top-WH);}
  const boxes=[];
  for(const it of activeTexts(t,e)){
    const ld=Math.max(.001,it.b-it.a),lt=clamp(t-it.a,0,ld);
    const own=it.ref.type==='scene';
    c.save();
    const bx=it.src.roll?drawRoll(c,it.src,lt,ld,editing):drawLayer(c,it.src,lt,ld,editing,own?{scene:s,local,p}:null);
    c.restore();
    if(bx)boxes.push({ref:it.ref,...bx});
  }
  c.restore();return boxes;
}
function render(){captionBounds=draw(ctx,time,!playing&&!exporting);$('#clock').textContent=fmt(time)+' / '+fmt(total);$('#scrubTime').textContent=fmt(time);$('#scrubber').value=time;updatePlayhead();const e=current();document.querySelectorAll('.scene-card').forEach(b=>{b.classList.toggle('current',b.dataset.id===e?.sc.id);if(b.dataset.id===e?.sc.id)b.style.setProperty('--progress',clamp((time-e.start)/e.dur*100,0,100)+'%');});}
async function ensureAudio(resume=true){
  if(!audioContext){audioContext=new (window.AudioContext||window.webkitAudioContext)();audioDestination=audioContext.createMediaStreamDestination();monitorGain=audioContext.createGain();monitorGain.connect(audioContext.destination);}
  if(resume)await audioContext.resume();
}
async function decodeAudio(file){await ensureAudio(false);return audioContext.decodeAudioData(await file.arrayBuffer());}
function stopSounds(){for(const {source,gain} of scheduled){try{source.stop();}catch{}source.disconnect();gain.disconnect();}scheduled=[];for(const m of media.values())if(m.el instanceof HTMLVideoElement){m.el.pause();const node=videoNodes.get(m.el);if(node)node.gain.gain.value=0;}}
function scheduleSounds(offset,end,epoch){
  for(const [w,a] of audioFiles){const amb=w==='amb';if(amb&&state.ambOn===false)continue;const loop=amb&&state.ambLoop,b=a.buffer,bo=amb?(state.ambStart||0):0;if(!b||(!loop&&offset+bo>=b.duration))continue;const src=audioContext.createBufferSource(),gain=audioContext.createGain(),vol=state.vol[w];src.buffer=b;src.loop=loop;gain.gain.value=vol;if(amb){const fi=state.ambFadeIn||0,fo=state.ambFadeOut||0;if(fi>0&&offset<fi){gain.gain.setValueAtTime(vol*offset/fi,epoch);gain.gain.linearRampToValueAtTime(vol,epoch+(fi-offset));}if(fo>0){gain.gain.setValueAtTime(vol,epoch+Math.max(0,end-fo-offset));gain.gain.linearRampToValueAtTime(0,epoch+Math.max(0,end-offset));}}src.connect(gain);gain.connect(audioDestination);gain.connect(monitorGain);const duration=loop?end-offset:Math.min(end-offset,b.duration-offset-bo);if(duration>0){src.start(epoch,loop?(offset+bo)%b.duration:offset+bo,duration);scheduled.push({source:src,gain});}}
}
function videoNode(el){let n=videoNodes.get(el);if(!n){const source=audioContext.createMediaElementSource(el),gain=audioContext.createGain();source.connect(gain);gain.connect(audioDestination);gain.connect(monitorGain);n={source,gain};videoNodes.set(el,n);el.muted=false;}return n;}
function syncVideos(t,run){const e=current(t);for(const [id,m]of media){const el=m.el;if(!(el instanceof HTMLVideoElement))continue;const active=e?.sc.id===id,target=active?Math.min(Math.max(0,t-e.start),Math.max(0,el.duration-.035)):0;
  if(active){if(el.readyState>=2&&!el.seeking&&Math.abs(el.currentTime-target)>(run?.25:.02))el.currentTime=target;if(audioContext){const n=videoNode(el);n.gain.gain.value=run&&e.sc.sound?e.sc.volume/100:0;}if(run&&t-e.start<el.duration){if(el.paused)el.play().catch(()=>{});}else el.pause();}
  else {el.pause();const n=videoNodes.get(el);if(n)n.gain.gain.value=0;}
}}
function pause(){playing=false;stopSounds();$('#pause').hidden=true;render();}
async function play(mode){
  if(exporting||!total)return;pause();await ensureAudio();monitorGain.gain.value=1;
  const e=TL.find(e=>e.sc.id===selected);if(mode==='scene'&&!e)return;
  playStart=mode==='scene'?e.start:0;playEnd=mode==='scene'?e.start+e.dur:total;time=playStart;syncVideos(time,false);playEpoch=audioContext.currentTime+.08;scheduleSounds(playStart,playEnd,playEpoch);playing=true;$('#pause').hidden=false;
}
function tick(){if(playing){const elapsed=playStart+Math.max(0,audioContext.currentTime-playEpoch);time=Math.min(playEnd-.001,elapsed);syncVideos(time,true);render();if(elapsed>=playEnd){playing=false;stopSounds();$('#pause').hidden=true;}}requestAnimationFrame(tick);}
function moveSelected(dir){const i=state.scenes.findIndex(s=>s.id===selected),j=i+dir;if(i<0||j<0||j>=state.scenes.length)return;pause();[state.scenes[i],state.scenes[j]]=[state.scenes[j],state.scenes[i]];changed();refresh();selectScene(selected);}
function dropScene(from,to){if(from===to)return;const i=state.scenes.findIndex(s=>s.id===from),j=state.scenes.findIndex(s=>s.id===to);if(i<0||j<0)return;pause();const [s]=state.scenes.splice(i,1);state.scenes.splice(j,0,s);changed();refresh();selectScene(from);}
let sceneClip=null;   // {s: sahne kopyası, file: medya dosyası}
function copyScene(){
  const sc=selectedScene();if(!sc)return;
  sceneClip={s:structuredClone({...sc,texts:[]}),file:media.get(sc.id)?.file||null};
  $('#pasteScene').disabled=false;toast('Sahne kopyalandı. İstediğin sahneyi seçip Yapıştır\'a bas (Ctrl+V); istediğin kadar yapıştırabilirsin.');
}
async function pasteScene(){
  if(!sceneClip||projectBusy)return;projectBusy=true;
  try{
    pause();const at=selectedScene()?state.scenes.indexOf(selectedScene())+1:state.scenes.length;
    const copy={...structuredClone(sceneClip.s),id:uid(),texts:[]};
    if(sceneClip.file){copy.assetId=registerAsset(sceneClip.file,copy.kind,sceneClip.s.assetId);media.set(copy.id,await loadMedia(sceneClip.file,copy.kind));}
    state.scenes.splice(at,0,copy);changed();refresh();selectScene(copy.id);
  }finally{projectBusy=false;}
}
async function duplicate(){const s=selectedScene();if(!s||projectBusy)return;projectBusy=true;try{const copy={...s,id:uid(),texts:(s.texts||[]).map(x=>({...structuredClone(x),id:uid()}))};const m=media.get(s.id);if(m)media.set(copy.id,await loadMedia(m.file,s.kind));state.scenes.splice(state.scenes.indexOf(s)+1,0,copy);changed();refresh();selectScene(copy.id);}finally{projectBusy=false;}}
function removeSelected(){const s=selectedScene();if(!s)return;pause();const i=state.scenes.indexOf(s);disposeMedia(media.get(s.id));media.delete(s.id);state.scenes.splice(i,1);selected=state.scenes[i]?.id||state.scenes[i-1]?.id||null;changed();refresh();if(selected)selectScene(selected);}
function snapshot(){return {state:structuredClone(state),media:Object.fromEntries([...media].map(([id,m])=>[id,m.file])),audio:Object.fromEntries([...audioFiles].map(([w,a])=>[w,a.file])),savedAt:new Date().toISOString()};}
async function saveProject(){history.endGroup();return persist(true);}
function allowLeave(){return !dirty||confirm('Kaydedilmemiş değişiklikler var. Kaydetmeden devam edilsin mi?');}
async function openRecord(record){
  record=await projectStore.resolve(record);
  if(!record?.state||!Array.isArray(record.state.scenes))throw new Error('Geçerli bir Mavi Kadraj projesi değil.');
  const next={...blank(),...record.state,version:2},loaded=new Map(),sounds=new Map();next.scenes=next.scenes.map(normalize);next.texts=(Array.isArray(next.texts)?next.texts:[]).slice(0,MAX_TEXTS).map(normalizeText);migrateSceneTexts(next);next.cinema={bars:!!next.cinema?.bars,ratio:['4:5','1:1','16:9'].includes(next.cinema?.ratio)?next.cinema.ratio:'4:5'};next.voice=normVoice(next.voice);next.vol={nar:num(next.vol?.nar,1,0,1),amb:num(next.vol?.amb,.35,0,1)};
  const ids=new Set();for(const s of next.scenes){if(ids.has(s.id))throw new Error('Projede yinelenen sahne kimliği var.');ids.add(s.id);}
  try{for(const s of next.scenes){if(s.kind==='title')continue;let f=record.media?.[s.id];if(s.kind==='sample'&&!f){const response=await fetch(sampleURL(s));f=new File([await response.blob()],s.name+'.svg',{type:'image/svg+xml'});}if(!(f instanceof Blob))throw new Error(s.name+' medyası eksik.');loaded.set(s.id,await loadMedia(f,s.kind==='video'?'video':'image'));}for(const w of ['nar','amb'])if(record.audio?.[w]){const file=record.audio[w],raw=await decodeAudio(file);sounds.set(w,{file,raw,buffer:w==='nar'?await voiceBuffer(raw,next.voice):raw});}}
  catch(e){for(const m of loaded.values())disposeMedia(m);throw e;}
  clearTimeout(autosaveTimer);projectEpoch++;pause();for(const m of media.values())disposeMedia(m);media.clear();audioFiles.clear();assets.clear();
  for(const [id,m]of loaded){media.set(id,m);const s=next.scenes.find(s=>s.id===id);s.assetId=registerAsset(m.file,s.kind,s.assetId);}
  next.audioAssets={...next.audioAssets};for(const [w,a]of sounds){audioFiles.set(w,a);const id=registerAsset(a.file,'audio',next.audioAssets[w]);next.audioAssets[w]=id;assets.get(id).buffer=a.raw||a.buffer;}
  for(const w of ['nar','amb'])if(!sounds.has(w))delete next.audioAssets[w];
  state=next;selected=next.scenes.some(s=>s.id===record.view?.selected)?record.view.selected:null;time=Number(record.view?.time)||0;dirty=false;revision++;history.reset(state);historyUI();$('#projectName').value=state.name;$('#saveStatus').textContent='Kayıt açıldı';refresh();$('#projectsDialog').close();await persist(false);
}
async function legacyRecord(){const old=await dbGet('state');if(!old?.scenes)throw new Error('Eski proje bulunamadı.');const order=old.sections?.length?old.sections.flatMap(sec=>old.scenes.filter(s=>s.sec===sec.id)):old.scenes;const scenes=order.map(s=>normalize({...s,font:s.style==='baslik'?'plain':'hand',textY:s.style==='baslik'?50:82,textPosition:s.style==='baslik'?'middle':'bottom'}));const record={state:{...old,id:uid(),name:'Önceki Mavi Kadraj projesi',scenes},media:{},audio:{}};for(const s of scenes){const f=await dbGet('m:'+s.id);if(f)record.media[s.id]=f;}for(const w of ['nar','amb']){const f=await dbGet('a:'+w);if(f)record.audio[w]=f;}return record;}
async function showProjects(){
  $('#projectsDialog').showModal();$('#projectList').textContent='Kayıtlar yükleniyor…';
  try{const records=await projectStore.list();$('#projectList').innerHTML=records.map(r=>`<button class="project-item" data-project="${esc(r.id)}" data-record="${esc(r.key)}"><span>${esc(r.name)}<small>${r.count} sahne · ${r.draft?'Otomatik kayıt · ':''}${new Date(r.savedAt).toLocaleString('tr-TR')}</small></span><span>→</span></button>`).join('')||'<p class="muted">Henüz kaydedilmiş proje yok.</p>';if((await dbGet('state'))?.scenes)$('#projectList').insertAdjacentHTML('beforeend','<button class="project-item" data-legacy="true">Önceki editördeki kayıtlı projeyi aç →</button>');}
  catch(e){$('#projectList').textContent='Tarayıcı deposu kullanılamıyor. Bir proje dosyası açabilirsin.';}
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
const fileData=f=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({name:f.name||'medya',data:r.result});r.onerror=()=>reject(r.error);r.readAsDataURL(f);});
async function backup(){const r=snapshot();for(const group of ['media','audio'])for(const [id,f]of Object.entries(r[group]))r[group][id]=await fileData(f);download(new Blob([JSON.stringify(r)],{type:'application/json'}),(state.name||'proje')+'.mavikadraj');toast('Düzenlenebilir proje yedeği indirildi.');}
async function importFile(file){const r=JSON.parse(await file.text());for(const group of ['media','audio']){r[group]??={};for(const [id,f]of Object.entries(r[group])){if(typeof f.data!=='string'||!/^data:[^,]*;base64,/.test(f.data))throw new Error('Geçersiz medya verisi.');const [meta,b64]=f.data.split(','),bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));r[group][id]=new File([bytes],String(f.name),{type:meta.slice(5).split(';')[0]});}}
  // Portable imports get fresh immutable asset keys so a modified backup cannot
  // replace bytes used by another saved project.
  if(r.state?.scenes)for(const s of r.state.scenes)delete s.assetId;if(r.state)r.state.audioAssets={};delete r.format;await openRecord(r);
}

// ---- Dışa aktarma ----
// MP4, exporter.js ile kare kare üretilir (H.264 + AAC-LC, klasik MP4). WebM yalnızca yedek olarak, gerçek zamanlı kaydedilir.
const NOTE_MP4='Video bu cihazda işlenir; hiçbir dosya internete gönderilmez. İşlem bitene kadar bu pencereyi kapatma.';
const NOTE_WEBM='WebM gerçek zamanlı kaydedilir: işlem video süresi kadar sürer ve bu sekme görünür kalmalıdır. Telefonda ve WhatsApp’ta açılmayabilir.';
const NO_MP4='Bu tarayıcı telefon uyumlu MP4 üretemiyor. Güncel Chrome veya Edge kullanın.';
const tenths=v=>(Math.round(v*10)/10).toLocaleString('tr-TR')+' saniye';
// Toplam süre 10–240 saniye dışındaysa dışa aktarmayı durduran açıklamayı, uygunsa boş metni döndürür.
function durationIssue(){
  const ms=Math.round(total*1000);
  if(ms<MIN_TOTAL*1000)return `Video en az ${MIN_TOTAL} saniye olmalı. Şu an ${tenths(ms/1000)}; ${tenths(MIN_TOTAL-ms/1000)} daha ekleyin.`;
  if(ms>MAX_TOTAL*1000){const tenth=Math.round(ms/100)%10;return `Video en fazla 4 dakika olabilir. Şu an ${fmt(ms/1000)}${tenth?','+tenth:''}; ${tenths(ms/1000-MAX_TOTAL)} kısaltın.`;}
  return '';
}
const hasSound=()=>audioFiles.size>0||state.scenes.some(s=>s.kind==='video'&&s.sound&&s.volume>0&&media.has(s.id));
// Çözünürlük seçenekleri. Veri hızı P0-13/Q-10 ölçümüyle belirlenir (yeri burası).
const RES={fhd:{w:1080,h:1920,name:'Full HD',vb:6000000},'4k':{w:2160,h:3840,name:'4K',vb:20000000}};
let exportRes='fhd';
// ?vb=<bit/sn> adresi parametresi yalnızca veri hızı ölçümleri içindir (tests/quality.cjs).
const VB_OVERRIDE=Number(new URLSearchParams(location.search).get('vb'))||0;
const exportSettings=()=>({width:RES[exportRes].w,height:RES[exportRes].h,fps:FPS,videoBitrate:VB_OVERRIDE||RES[exportRes].vb,audioBitrate:AUDIO_BITRATE});
// Ölçüm kancası: bir kareyi dışa aktarmadaki gibi (özgün kaynak, hedef çözünürlük) sıkıştırılmamış olarak çizer.
window.MaviDebug={voiceStats(ranges){const a=audioFiles.get('nar');if(!a)return null;const f=(b,r)=>{const d=b.getChannelData(0),R=b.sampleRate;const i0=Math.round(r[0]*R),i1=Math.min(d.length,Math.round(r[1]*R));let sum=0;for(let i=i0;i<i1;i++)sum+=d[i]*d[i];return 20*Math.log10(Math.sqrt(sum/Math.max(1,i1-i0))+1e-9);};return {duration:a.raw.duration,name:state.narName,preset:state.voice.preset,raw:ranges.map(r=>f(a.raw,r)),processed:ranges.map(r=>f(a.buffer,r))};},renderFrame(t,scale=1){const cv=document.createElement('canvas');cv.width=1080*scale;cv.height=1920*scale;const prev=exporting;exporting=true;try{draw(cv.getContext('2d'),t,false,scale);}finally{exporting=prev;}return cv;}};
const mbText=b=>(b/1048576).toFixed(b>=1.05e8?0:1).replace('.',',')+' MB';
// Tahmini dosya boyutu: (görüntü + ses) veri hızı × süre; kodlayıcı hedefe yakın üretir, gren ve hareket üstünde bir miktar sapabilir.
const estimateBytes=()=>{const st=exportSettings();return (st.videoBitrate+(hasSound()?st.audioBitrate:0))*(Math.round(total*FPS)/FPS)/8*1.03;};
// Kaynak ayrıntısı: hedef çözünürlükte fotoğraf kaynağından kaç kat büyütülüyor (yakınlaştırma ve hareket dahil)
function sourceWarnings(k){
  const out=[],win=frameWin();
  for(const e of TL){
    const s=e.sc,m=media.get(s.id);if(!m||!(m.el instanceof HTMLImageElement))continue;
    const iw=m.el.naturalWidth,ih=m.el.naturalHeight;if(!iw||!ih)continue;
    let z=s.zoom;if(s.motion!=='none')z*=1.18;
    const ratio=(s.fit==='contain'?Math.min(1080/iw,win.h/ih):Math.max(1080/iw,win.h/ih))*z*k;
    if(ratio>1.25)out.push({name:s.name,ratio});
  }
  return out;
}
function refreshExportInfo(){
  const st=exportSettings(),k=st.width/1080,list=sourceWarnings(k),warn=$('#exportSource');
  $('.export-spec').innerHTML=`${st.width} × ${st.height} <span>9:16 · 30 kare/sn · ${RES[exportRes].name}</span>`;
  $('#exportEstimate').textContent=`Tahmini dosya boyutu: yaklaşık ${mbText(estimateBytes())} (${(st.videoBitrate/1e6).toFixed(0)} Mbit/sn${hasSound()?' + ses':''}).`;
  if(list.length){warn.hidden=false;warn.textContent=`${list.length} sahnede kaynak fotoğraf bu çözünürlük için yetersiz: ${list.slice(0,3).map(w=>`${w.name} (%${Math.round(w.ratio*100)} büyütülür)`).join(', ')}${list.length>3?'…':''}. Videoda yumuşak görünebilir; daha büyük kaynak kullan, yakınlaştırmayı azalt${exportRes==='4k'?' ya da Full HD seç':''}.`;}
  else{warn.hidden=true;warn.textContent='';}
}
function exportFormats(){
  const list=[];
  if(window.MaviExport&&window.Mp4Check&&MaviExport.available())list.push(['mp4','MP4 · H.264 (telefon uyumlu)']);
  if(window.MediaRecorder&&canvas.captureStream){const webm=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));if(webm)list.push([webm,'WebM · yalnızca bilgisayarda oynatmak için']);}
  return list;
}
function setFormats(formats){$('#exportFormat').innerHTML=formats.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');showExportNote();}
function showExportNote(){const v=$('#exportFormat').value;$('#exportNote').textContent=v==='mp4'?NOTE_MP4:v?NOTE_WEBM:'';}
let probeToken=0;
function showExport(){
  pause();const formats=exportFormats(),issue=durationIssue(),mp4=formats.some(f=>f[0]==='mp4');setFormats(formats);
  $('#exportProgress').value=0;$('#downloadAgain').hidden=true;$('#exportDevice').textContent='';delete $('#exportDialog').dataset.info;
  $('#exportName').value=!state.name||state.name===DEFAULT_PROJECT_NAME?'':state.name;$('#exportRes').value=exportRes;refreshExportInfo();
  $('#exportWhere').textContent=typeof window.showSaveFilePicker==='function'?'“Videoyu Oluştur” dediğinde videoyu kaydedeceğin klasörü ve adı seçebilirsin. Ad boş kalırsa “'+DEFAULT_FILE_NAME+'” olur.':'Dosya, tarayıcının indirme klasörüne iner. Ad boş kalırsa “'+DEFAULT_FILE_NAME+'” olur.';
  $('#exportDescription').textContent=`${state.scenes.length} sahne · ${fmt(total)} · Görüntü, yazı, efektler ve sesler tek dosyada.`;
  $('#exportStatus').textContent=issue||(!formats.length?'Bu tarayıcı video oluşturmayı desteklemiyor. Güncel Chrome veya Edge kullanın.':!mp4?NO_MP4:'İndirmeye hazır.');
  $('#startExport').disabled=!formats.length||!!issue;
  $('#exportDialog').showModal();
  if(mp4&&!issue)checkDevice(formats);
}
// Bu cihazın H.264 (ve ses varsa AAC-LC) üretebildiğini pencere açılırken doğrular.
async function checkDevice(formats){
  const token=++probeToken;$('#exportDevice').textContent='Bu cihazın kodlayıcıları denetleniyor…';
  const plan=await MaviExport.probe({...exportSettings(),audio:hasSound()}).catch(e=>({ok:false,reason:e.message||NO_MP4}));
  if(token!==probeToken||exporting||!$('#exportDialog').open)return;
  if(plan.ok){$('#exportDevice').textContent=`Bu cihazda üretilecek biçim: MP4 · ${plan.label}`;return;}
  if(exportRes==='4k'){exportRes='fhd';$('#exportRes').value='fhd';refreshExportInfo();$('#exportStatus').textContent='Bu cihaz 4K (2160 × 3840) H.264 kodlayamıyor; Full HD seçildi.';checkDevice(formats);return;}
  const rest=formats.filter(f=>f[0]!=='mp4');setFormats(rest);$('#exportDevice').textContent='';$('#exportStatus').textContent=plan.reason;$('#startExport').disabled=!rest.length;
}
// MediaRecorder's streaming WebM may omit duration. Add it to Segment/Info so
// standalone players show the real duration instead of an unbounded stream.
async function fixWebmDuration(blob,milliseconds){
  const bytes=new Uint8Array(await blob.arrayBuffer());
  function element(at){let n=1;while(n<=8&&!(bytes[at]&(1<<(8-n))))n++;if(n>8)throw new Error('WebM başlığı okunamadı.');let id=0;for(let j=0;j<n;j++)id=id*256+bytes[at+j];const sizeAt=at+n;let sizeLen=1;while(sizeLen<=8&&!(bytes[sizeAt]&(1<<(8-sizeLen))))sizeLen++;if(sizeLen>8)throw new Error('WebM boyutu okunamadı.');let size=BigInt(bytes[sizeAt]&((1<<(8-sizeLen))-1));for(let j=1;j<sizeLen;j++)size=(size<<8n)|BigInt(bytes[sizeAt+j]);const unknown=size===(1n<<BigInt(7*sizeLen))-1n;const data=sizeAt+sizeLen;return {id,at,sizeAt,sizeLen,data,size:unknown?bytes.length-data:Number(size),unknown,end:unknown?bytes.length:data+Number(size)};}
  function encodeSize(value,len){let n=BigInt(value);if(n>=(1n<<BigInt(len*7))-1n)throw new Error('WebM süre alanı eklenemedi.');const out=new Uint8Array(len);for(let j=len-1;j>=0;j--){out[j]=Number(n&255n);n>>=8n;}out[0]|=1<<(8-len);return out;}
  let seg;for(let p=0;p<bytes.length;){const e=element(p);if(e.id===0x18538067){seg=e;break;}if(e.end<=p)break;p=e.end;}if(!seg)throw new Error('WebM bölümü bulunamadı.');
  let info;for(let p=seg.data;p<seg.end;){const e=element(p);if(e.id===0x1549a966){info=e;break;}if(e.end<=p)break;p=e.end;}if(!info)throw new Error('WebM bilgisi bulunamadı.');
  let scale=1000000,duration;for(let p=info.data;p<info.end;){const e=element(p);if(e.id===0x2ad7b1){scale=0;for(let j=e.data;j<e.end;j++)scale=scale*256+bytes[j];}if(e.id===0x4489)duration=e;p=e.end;}
  const value=milliseconds*1000000/scale;
  if(duration&&(duration.size===4||duration.size===8)){const view=new DataView(bytes.buffer);if(duration.size===4)view.setFloat32(duration.data,value);else view.setFloat64(duration.data,value);return new Blob([bytes],{type:blob.type});}
  const extra=new Uint8Array(11);extra.set([0x44,0x89,0x88]);new DataView(extra.buffer).setFloat64(3,value);
  const result=new Uint8Array(bytes.length+extra.length);result.set(bytes.subarray(0,info.end));result.set(extra,info.end);result.set(bytes.subarray(info.end),info.end+extra.length);result.set(encodeSize(info.size+extra.length,info.sizeLen),info.sizeAt);if(!seg.unknown)result.set(encodeSize(seg.size+extra.length,seg.sizeLen),seg.sizeAt);
  return new Blob([result],{type:blob.type});
}
async function prepareVideos(){
  for(const m of media.values())if(m.el instanceof HTMLVideoElement){const el=m.el;videoNode(el);el.pause();if(el.currentTime!==0)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{el.removeEventListener('seeked',done);reject(new Error('Video başlangıcı okunamadı.'));},8000);function done(){clearTimeout(timer);el.removeEventListener('seeked',done);resolve();}el.addEventListener('seeked',done);el.currentTime=0;});}
}
// O anda görünen klip sahnesini istenen kareye getirir; kare kare üretimde her çizimden önce beklenir.
async function seekVideos(t){
  const e=current(t);if(!e||e.sc.kind!=='video')return;
  const m=media.get(e.sc.id);if(!m||!(m.el instanceof HTMLVideoElement))return;
  const el=m.el,target=Math.min(Math.max(0,t-e.start),Math.max(0,el.duration-.035));
  if(!el.seeking&&Math.abs(el.currentTime-target)<.0005)return;
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{el.removeEventListener('seeked',done);reject(new Error(e.sc.name+': video karesi okunamadı.'));},8000);function done(){clearTimeout(timer);el.removeEventListener('seeked',done);resolve();}el.addEventListener('seeked',done);el.currentTime=target;});
}
// Klibin sesini çözer. Dosyada ses izi olmadığı kesinse boş döner ve bunu not eder.
async function clipAudio(m){
  if(m.audio!==undefined)return m.audio;
  try{
    const data=await m.file.arrayBuffer();
    try{const r=Mp4Check.inspect(data);if(r.tracks.length&&!r.audio.length){m.noAudioTrack=true;m.audio=null;return null;}}catch{}
    await ensureAudio();m.audio=await audioContext.decodeAudioData(data);
  }catch{m.audio=null;}
  return m.audio;
}
// Ses karışımına girecek parçalar. Başlangıç zamanı ile açılış/kapanış süreleri parametredir; arayüzü sonra eklenecek (P2-02).
async function audioTracks(){
  const tracks=[];
  for(const [w,a] of audioFiles){if(!a.buffer)continue;const amb=w==='amb';if(amb&&state.ambOn===false)continue;tracks.push({buffer:a.buffer,gain:state.vol[w],start:0,offset:amb?(state.ambStart||0):0,loop:amb&&state.ambLoop,fadeIn:amb?(state.ambFadeIn||0):0,fadeOut:amb?(state.ambFadeOut||0):0});}
  for(const e of TL){
    const s=e.sc,m=media.get(s.id);if(s.kind!=='video'||!s.sound||!s.volume||!m)continue;
    const buffer=await clipAudio(m);
    if(buffer)tracks.push({buffer,gain:s.volume/100,start:e.start,offset:0,duration:e.dur,loop:false,fadeIn:0,fadeOut:0});
    else if(!m.noAudioTrack&&!confirm(`${s.name}: klibin sesi okunamadı. Klip sessiz işlensin mi?`))throw new Error('İşlem iptal edildi.');
  }
  return tracks;
}
// Sesleri cihazda, gerçek zamandan bağımsız karıştırır (48 kHz stereo). Ses yoksa null döner.
async function mixAudio(seconds){
  const tracks=await audioTracks();if(!tracks.length)return null;
  const rate=48000,off=new OfflineAudioContext(2,Math.ceil(seconds*rate),rate);
  for(const t of tracks){
    const end=Math.min(seconds,t.loop?Infinity:t.start+t.buffer.duration-t.offset,t.duration==null?Infinity:t.start+t.duration),length=end-t.start;
    if(length<=0)continue;
    const source=off.createBufferSource(),gain=off.createGain();source.buffer=t.buffer;source.loop=t.loop;gain.gain.value=t.gain;
    if(t.fadeIn>0){gain.gain.setValueAtTime(0,t.start);gain.gain.linearRampToValueAtTime(t.gain,t.start+Math.min(t.fadeIn,length));}
    if(t.fadeOut>0){gain.gain.setValueAtTime(t.gain,end-Math.min(t.fadeOut,length));gain.gain.linearRampToValueAtTime(0,end);}
    source.connect(gain);gain.connect(off.destination);source.start(t.start,t.loop?t.offset%t.buffer.duration:t.offset,length);
  }
  const buffer=await off.startRendering();let peak=0,reduced=0;
  for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);for(let i=0;i<d.length;i++){const v=d[i]<0?-d[i]:d[i];if(v>peak)peak=v;}}
  // Toplam düzey sınırı aşarsa karışımın tamamı kısılır; kırpılma olmaz.
  if(peak>.98){const k=.98/peak;for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);for(let i=0;i<d.length;i++)d[i]*=k;}reduced=Math.max(1,Math.round((1-k)*100));}
  return {buffer,peak,reduced};
}
async function produceMp4(){
  const say=t=>{$('#exportStatus').textContent=t;},stopIfCancelled=()=>{if(exportAbort.signal.aborted)throw new Error('İşlem iptal edildi.');};
  for(const m of media.values())if(m.el instanceof HTMLVideoElement)m.el.pause();
  const frames=Math.round(total*FPS),seconds=frames/FPS,settings=exportSettings();
  const mix=await mixAudio(seconds);stopIfCancelled();
  say('Kodlayıcı hazırlanıyor…');
  const plan=await MaviExport.probe({...settings,audio:!!mix});if(!plan.ok)throw new Error(plan.reason);stopIfCancelled();
  const out=document.createElement('canvas');out.width=settings.width;out.height=settings.height;const context=out.getContext('2d');
  try{
    const result=await MaviExport.render({...settings,canvas:out,frames,audio:mix?mix.buffer:null,signal:exportAbort.signal,
      prepare:seekVideos,draw:t=>{draw(context,Math.min(t,total-.001),false,settings.width/1080);},
      onProgress:(p,done)=>{time=Math.min(total,done/FPS);ctx.drawImage(out,0,0,1080,1920);$('#exportProgress').value=p*100;say(`%${Math.floor(p*100)} · ${fmt(time)} / ${fmt(total)} işleniyor`);}});
    say('Dosya denetleniyor…');
    // İndirmeden önce dosyanın gerçek yapısı okunur; hedefe uymayan dosya indirilmez.
    const report=Mp4Check.inspect(result.buffer),problems=Mp4Check.validate(report,{width:settings.width,height:settings.height,fps:FPS,frames,seconds,audio:!!mix,level:Math.max(40,plan.video.level)});
    if(problems.length)throw new Error('Üretilen dosya denetimden geçmedi ve indirilmedi: '+problems.join(' '));
    return {blob:new Blob([result.buffer],{type:'video/mp4'}),extension:'.mp4',
      status:`Video hazır · ${Mp4Check.describe(report)}${mix&&mix.reduced?` · ses kırpılmasın diye %${mix.reduced} kısıldı`:''}`,
      info:{format:'mp4',label:plan.label,software:plan.video.software,frames,seconds,ms:result.ms,maxQueue:result.maxQueue,bytes:result.buffer.byteLength,audio:!!mix,peak:mix?mix.peak:null,reduced:mix?mix.reduced:0}};
  }finally{out.width=out.height=0;}
}
// Yedek yol: yalnızca WebM, gerçek zamanlı kayıt. Sekme görünür kalmalıdır.
async function produceWebm(mime){
  let recorder,stream,timer,finished;
  try{
    await ensureAudio();monitorGain.gain.value=0;await prepareVideos();
    if(exportCancelled)throw new Error('İşlem iptal edildi.');
    const out=document.createElement('canvas');out.width=WIDTH;out.height=HEIGHT;const context=out.getContext('2d');draw(context,0);
    stream=out.captureStream(FPS);if(hasSound())for(const track of audioDestination.stream.getAudioTracks())stream.addTrack(track.clone());
    const chunks=[];
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8000000,audioBitsPerSecond:192000});
    finished=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>reject(e.error||new Error('Video kodlayıcı durdu.'));recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType}));});
    // Install the error handler before rendering so a codec failure also ends the loop.
    let recordingError;finished.catch(e=>{recordingError=e;});
    recorder.start(1000);const epoch=audioContext.currentTime+.05;scheduleSounds(0,total,epoch);
    await new Promise((resolve,reject)=>{
      timer=setInterval(()=>{
        try{
          if(recordingError)throw recordingError;
          if(exportCancelled)throw new Error('İşlem iptal edildi.');
          if(document.hidden)throw new Error('Sekme arka plana geçtiği için işlem durduruldu. Sekmeyi görünür tutarak yeniden deneyin.');
          if(audioContext.state!=='running')throw new Error('Ses işlemi durakladı. Yeniden deneyin.');
          time=Math.max(0,Math.min(total,audioContext.currentTime-epoch));syncVideos(time,true);draw(context,Math.min(time,total-.001));ctx.drawImage(out,0,0);$('#exportProgress').value=time/total*100;$('#exportStatus').textContent=`%${Math.floor(time/total*100)} · ${fmt(time)} / ${fmt(total)} işleniyor`;
          if(time>=total){clearInterval(timer);resolve();}
        }catch(e){clearInterval(timer);reject(e);}
      },1000/FPS);
    });
    stopSounds();recorder.stop();let blob=await finished;$('#exportStatus').textContent='Video dosyası tamamlanıyor…';blob=await fixWebmDuration(blob,total*1000);
    return {blob,extension:'.webm',status:`Video hazır · WebM · ${(blob.size/1048576).toFixed(1).replace('.',',')} MB · yalnızca bilgisayarda oynatmak için`,info:{format:'webm',bytes:blob.size}};
  }finally{clearInterval(timer);stopSounds();if(recorder&&recorder.state!=='inactive'){recorder.stop();if(finished)await finished.catch(()=>{});}stream?.getTracks().forEach(t=>t.stop());if(monitorGain)monitorGain.gain.value=1;}
}
const DEFAULT_FILE_NAME='Mavi Kadraj',DEFAULT_PROJECT_NAME='İsimsiz proje';
// Kullanıcının yazdığı adı güvenli bir dosya adına çevirir; boşsa marka adı kullanılır.
function exportFileName(raw){
  let n=String(raw??'').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').replace(/\.(mp4|webm)$/i,'').replace(/\s+/g,' ').trim().replace(/[. ]+$/,'').slice(0,100).trim();
  if(!n)n=DEFAULT_FILE_NAME;if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(n))n+=' video';return n;
}
// Seçilen dosya boş (yeni oluşturulmuş) ise siler; içinde veri olan mevcut bir dosyaya asla dokunmaz.
async function discardEmpty(handle){try{if(!handle||typeof handle.remove!=='function')return;const f=await handle.getFile();if(f.size===0)await handle.remove();}catch{}}
let picking=false;
async function exportVideo(){
  if(exporting||!total)return;
  const issue=durationIssue();if(issue){$('#exportStatus').textContent=issue;return;}
  const format=$('#exportFormat').value;if(!format)return;
  const baseName=exportFileName($('#exportName').value),ext=format==='mp4'?'.mp4':'.webm';
  let handle=null,saved=false;
  if(typeof window.showSaveFilePicker==='function'){
    if(picking)return;picking=true;
    try{handle=await window.showSaveFilePicker({suggestedName:baseName+ext,types:[{description:format==='mp4'?'MP4 video':'WebM video',accept:{[format==='mp4'?'video/mp4':'video/webm']:[ext]}}]});}
    catch(e){if(e&&e.name==='AbortError'){$('#exportStatus').textContent='Kaydetme iptal edildi; video oluşturulmadı.';return;}handle=null;}
    finally{picking=false;}
  }
  pause();exporting=true;exportCancelled=false;exportAbort=new AbortController();probeToken++;document.body.classList.add('exporting');
  $('#startExport').disabled=true;$('#exportFormat').disabled=true;$('#exportName').disabled=true;$('#exportRes').disabled=true;$('#cancelExport').hidden=false;$('#closeExport').disabled=true;$('#downloadAgain').hidden=true;$('#exportProgress').value=0;$('#exportStatus').textContent='Medya hazırlanıyor…';delete $('#exportDialog').dataset.info;
  let wakeLock;const oldTime=time;
  try{
    try{wakeLock=await navigator.wakeLock?.request('screen');}catch{}
    await loadFonts();await document.fonts.ready;await flushVoice();
    const result=format==='mp4'?await produceMp4():await produceWebm(format);
    if(!result.blob.size)throw new Error('Boş video üretildi. Yeniden deneyin.');
    if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(result.blob);
    const a=$('#downloadAgain');a.href=downloadURL;a.download=baseName+result.extension;a.hidden=false;
    let note='';
    if(handle){try{const w=await handle.createWritable();await w.write(result.blob);await w.close();saved=true;note=' · Kaydedildi: '+handle.name;}catch(e){await discardEmpty(handle);note=' · Seçilen dosyaya yazılamadı ('+(e.message||e.name)+'); “Tekrar İndir” ile kaydet.';}}
    else a.click();
    $('#exportProgress').value=100;$('#exportStatus').textContent=result.status+note;$('#exportDialog').dataset.info=JSON.stringify(result.info);
  }catch(e){$('#exportStatus').textContent=e.message||'Dışa aktarım başarısız. Yeniden deneyin.';if(!saved)await discardEmpty(handle);}
  finally{await wakeLock?.release().catch(()=>{});exportAbort=null;exporting=false;document.body.classList.remove('exporting');time=oldTime;syncVideos(time,false);render();$('#startExport').disabled=false;$('#exportFormat').disabled=false;$('#exportName').disabled=false;$('#exportRes').disabled=false;$('#cancelExport').hidden=true;$('#closeExport').disabled=false;}
}
const safely=fn=>async(...args)=>{try{await fn(...args);}catch(e){toast(e.message||String(e));}};
$('#addScene').onclick=()=>{const open=$('#addMenu').hidden;$('#addMenu').hidden=!open;$('#addScene').setAttribute('aria-expanded',String(open));};
document.addEventListener('click',e=>{if(!e.target.closest('.add-wrap')){$('#addMenu').hidden=true;$('#addScene').setAttribute('aria-expanded','false');}});
function addKind(kind){if(kind==='title'){const s={...defaults(),kind:'title',name:'Başlık kartı'};state.scenes.push(s);timeline();const en=TL.find(x=>x.sc===s),t=normalizeText({text:'Başlığını yaz',textPosition:'middle',textY:50,textStart:en.start,textDur:s.dur});(state.texts=state.texts||[]).push(t);activeText={type:'video',id:t.id};changed();refresh();selectScene(s.id);}else{$('#mediaPicker').accept=kind==='video'?'video/*':'image/*';$('#mediaPicker').click();}}
$('#addMenu').onclick=e=>{const kind=e.target.closest('[data-add]')?.dataset.add;if(!kind)return;$('#addMenu').hidden=true;$('#addScene').setAttribute('aria-expanded','false');addKind(kind);};
$('#mediaPicker').onchange=safely(async e=>{const files=[...e.target.files];e.target.value='';if(files.length)await addFiles(files);});
const panelClick=e=>{
  const lsub=e.target.closest('[data-libsub]');if(lsub){libSub=lsub.dataset.libsub;stopTile();renderLibrary(true);return;}
  const addk=e.target.closest('[data-add]');if(addk){addKind(addk.dataset.add);return;}
  const lk=e.target.closest('[data-look]');if(lk){applyLook(lk.dataset.look);return;}
  const lop=e.target.closest('[data-lookop]');if(lop){lookOp(lop.dataset.lookop);return;}
  if(e.target.closest('#replaceMedia')){$('#replacePicker').dataset.scene=selected;$('#replacePicker').click();return;}
  const ac=e.target.closest('[data-acc]');if(ac){accOpen=accOpen===ac.dataset.acc?'':ac.dataset.acc;renderInspector();return;}
  const pick=e.target.closest('[data-text]');if(pick){const [ty,id]=pick.dataset.text.split(':');stopTile();activeText=ty==='scene'?null:{type:ty,id};const t=curTarget();if(ty==='video'){time=targetWindow(t).a;}else showTarget(t);renderInspector();render();return;}
  const add=e.target.closest('[data-addtext]');if(add){addText(add.dataset.addtext);return;}
  const top=e.target.closest('[data-textop]');if(top){textOp(top.dataset.textop);return;}
  const span=e.target.closest('[data-textspan]');if(span){textSpan(span.dataset.textspan);return;}
  const sub=e.target.closest('[data-sub]');if(sub){textSub=sub.dataset.sub;stopTile();renderInspector();return;}
  const slot=e.target.closest('[data-slot]');if(slot){animSlot=slot.dataset.slot;stopTile();renderInspector();return;}
  const anim=e.target.closest('[data-anim]'),cs=curTarget();
  if(anim&&cs){const f=SLOT[animSlot].field,v=anim.dataset.anim;if(cs[f]===v)return;pause();history.endGroup();stopTile();cs[f]=v;showTarget(cs);changed();renderInspector();render();if(v!=='none')safely(()=>play('scene'))();return;}
  const cat=e.target.closest('[data-cat]');if(cat){styleCat=cat.dataset.cat;stopTile();renderInspector();return;}
  const tile=e.target.closest('[data-style]'),s=curTarget();
  if(tile&&s){const p=TEXT_STYLES.find(t=>t.id===tile.dataset.style);if(!p||(s.style||'none')===p.id)return;pause();history.endGroup();stopTile();s.style=p.id;if(typeof p.fill==='string')s.color=p.fill;showTarget(s);
    if(p.anim){s.textIn=p.anim.in;s.textInDur=p.anim.inDur;s.textOut=p.anim.out;s.textOutDur=p.anim.outDur;s.textLoop=p.anim.loop;}changed();renderInspector();render();}
};
$('#tabContent').onclick=panelClick;$('#libContent').onclick=panelClick;
$('#replacePicker').onchange=safely(async e=>{const f=e.target.files[0],s=state.scenes.find(s=>s.id===e.target.dataset.scene);e.target.value='';if(f&&s&&!projectBusy){projectBusy=true;$('#workspace').inert=true;try{pause();await setMedia(s,f);changed();refresh();}finally{projectBusy=false;$('#workspace').inert=false;}}});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTool(b.dataset.tab==='text'?'text':(tool==='text'||tool==='audio'?'media':tool)));
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
$('.tabs').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...document.querySelectorAll('[data-tab]')],i=tabs.indexOf(e.target),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;tabs[next].click();tabs[next].focus();};
$('#tabContent').oninput=e=>{
  const el=e.target,key=el.dataset.field,s=selectedScene();if(!key)return;
  if(el.type==='number'&&(!el.value||!el.validity.valid||!Number.isFinite(+el.value)))return;
  const tgt=tab==='text'&&TEXT_KEYS.has(key)?curTarget():s;if(!tgt)return;
  pause();if(s&&tgt===s&&current()?.sc.id!==s.id)time=TL.find(e=>e.sc===s).start;
  tgt[key]=el.type==='checkbox'?el.checked:['range','number'].includes(el.type)?Number(el.value):el.value;
  if(key==='textPosition'&&tgt.textPosition!=='custom'){tgt.textX=50;tgt.textY=presetY(tgt.textPosition);}
  if(tgt!==s)showTarget(tgt);
  if(isGradeKey(key)){draftUntil=performance.now()+250;clearTimeout(draftTimer);draftTimer=setTimeout(()=>render(),300);}
  const out=$(`[data-output="${key}"]`);if(out)out.textContent=tgt[key]+(key==='zoom'?'×':key==='fontSize'?' px':['entryDur','textInDur','textOutDur','rollDelay','rollPause'].includes(key)?' sn':'%');
  if(key==='dur'){timeline();renderTimeline();}
  if(key==='text'){const chip=$('.text-chip.selected span');if(chip)chip.textContent=textPreview(tgt);}
  if(key==='textStart'||key==='textDur'){const w=targetWindow(tgt),info=$('#winInfo');if(info)info.textContent=`Görünür: ${fmtT(w.a)} – ${fmtT(w.b)}`;}
  if(textSub==='time'&&tab==='text')refreshTimeWarn();
  if(tab==='text'&&TEXT_KEYS.has(key))renderTextLanes();
  changed(['range','number','text','color','textarea'].includes(el.type)||el.tagName==='TEXTAREA'?tgt.id+':'+key:null);syncVideos(time,false);render();if(['entry','textIn','textOut','roll','rollFit'].includes(key))renderInspector();
};
$('#libContent').addEventListener('pointerover',e=>{const b=e.target.closest('.style-tile,.anim-tile');if(b&&(!tileAnim||tileAnim.b!==b))playTile(b);});
$('#libContent').addEventListener('pointerout',e=>{if(e.target.closest('.style-tile,.anim-tile')&&!e.relatedTarget?.closest?.('.style-tile,.anim-tile'))stopTile();});
$('#tabContent').onchange=e=>{if(e.target.dataset.field==='dur'&&!e.target.validity.valid)e.target.value=selectedScene().dur;if(e.target.type==='range')history.endGroup();};
$('#tabContent').addEventListener('focusout',()=>history.endGroup());
$('#libContent').onchange=$('#tabContent').onchange;
$('#libContent').addEventListener('toggle',e=>{const d=e.target.closest?.('[data-det]');if(d)lookOpen[d.dataset.det]=d.open;},true);
$('#libContent').addEventListener('pointerdown',e=>{if(e.target.closest('[data-lookop="compare"]')){compareOriginal=true;render();}});
window.addEventListener('pointerup',()=>{if(compareOriginal){compareOriginal=false;render();}});
$('#libContent').addEventListener('change',e=>{
  const el=e.target.closest('[data-cin]');if(!el)return;pause();history.endGroup();
  state.cinema=state.cinema||{bars:false,ratio:'4:5'};if(el.dataset.cin==='bars')state.cinema.bars=el.checked;else state.cinema.ratio=el.value;
  for(const t of [...(state.texts||[]),...state.scenes.flatMap(x=>x.texts||[])])if(['top','middle','bottom'].includes(t.textPosition))t.textY=presetY(t.textPosition);
  changed();renderLibrary(true);render();
});$('#libContent').addEventListener('focusout',()=>history.endGroup());$('#libContent').oninput=$('#tabContent').oninput;
let suppressTouchClick=false;
$('#sceneTrack').onclick=e=>{if(suppressTouchClick){suppressTouchClick=false;return;}const b=e.target.closest('[data-id]');if(b)selectScene(b.dataset.id);};
let dragId;
$('#sceneTrack').ondragstart=e=>{if(e.target.closest('[data-resize]')||resizing){e.preventDefault();return;}const b=e.target.closest('[data-id]');if(b){dragId=b.dataset.id;e.dataTransfer.setData('text/plain',dragId);e.dataTransfer.effectAllowed='move';}};
$('#sceneTrack').ondragover=e=>{const b=e.target.closest('[data-id]');if(b){e.preventDefault();e.dataTransfer.dropEffect='move';b.classList.add('drag-over');}};
$('#sceneTrack').ondragleave=e=>e.target.closest('[data-id]')?.classList.remove('drag-over');
$('#sceneTrack').ondrop=e=>{if(e.dataTransfer.files.length)return;e.preventDefault();const b=e.target.closest('[data-id]');if(b)dropScene(dragId||e.dataTransfer.getData('text/plain'),b.dataset.id);dragId=null;};
$('#sceneTrack').ondragend=()=>{dragId=null;document.querySelectorAll('.drag-over').forEach(b=>b.classList.remove('drag-over'));};
// Touch devices: hold briefly, then drag horizontally. Scrolling remains available.
let touchDrag;
$('#sceneTrack').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-id]');if(e.target.closest('[data-resize]')||e.pointerType!=='touch'||!b)return;suppressTouchClick=false;b.setPointerCapture(e.pointerId);touchDrag={id:b.dataset.id,x:e.clientX,y:e.clientY,scroll:$('#timelineScroll').scrollLeft,active:false,scrolling:false,timer:setTimeout(()=>{if(touchDrag&&!touchDrag.scrolling){touchDrag.active=true;b.style.opacity='.5';}},350)};});
$('#sceneTrack').addEventListener('pointermove',e=>{if(!touchDrag)return;if(touchDrag.active){e.preventDefault();const box=$('#timelineScroll').getBoundingClientRect();if(e.clientX<box.left+30)$('#timelineScroll').scrollLeft-=10;if(e.clientX>box.right-30)$('#timelineScroll').scrollLeft+=10;}else if(touchDrag.scrolling||Math.abs(e.clientX-touchDrag.x)+Math.abs(e.clientY-touchDrag.y)>10){clearTimeout(touchDrag.timer);touchDrag.scrolling=true;$('#timelineScroll').scrollLeft=touchDrag.scroll+touchDrag.x-e.clientX;}},{passive:false});
function finishTouch(e){if(!touchDrag)return;clearTimeout(touchDrag.timer);suppressTouchClick=touchDrag.active||touchDrag.scrolling;if(touchDrag.active&&e.type==='pointerup'){const b=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-id]');if(b)dropScene(touchDrag.id,b.dataset.id);}touchDrag=null;document.querySelectorAll('.scene-card').forEach(b=>b.style.opacity='');}
$('#sceneTrack').addEventListener('pointerup',finishTouch);$('#sceneTrack').addEventListener('pointercancel',finishTouch);
// Duration handle: fixed 12 px/second, 0.1 s resolution; one history gesture.
let resizing=null;
$('#sceneTrack').addEventListener('pointerdown',e=>{
  const h=e.target.closest('[data-resize]');if(!h||projectBusy||historyBusy)return;e.preventDefault();e.stopPropagation();pause();history.endGroup();
  const s=state.scenes.find(s=>s.id===h.dataset.resize),card=h.closest('.scene-card');selected=s.id;resizing={s,startX:e.clientX,dur:s.dur,card,handle:h};card.draggable=false;h.setPointerCapture(e.pointerId);renderInspector();
},true);
$('#sceneTrack').addEventListener('pointermove',e=>{
  if(!resizing)return;e.preventDefault();const {s,startX,dur,card}=resizing,value=Math.max(.1,Math.round((dur+(e.clientX-startX)/tlPps)*10)/10);if(value===s.dur)return;
  s.dur=value;timeline();updateDurationUI();$('#scrubber').max=total;$('#scrubEnd').textContent=fmt(total);card.style.width=Math.max(18,value*tlPps)+'px';layoutCanvas();renderRuler();renderTextLanes();card.querySelector('.card-meta b').textContent=value+' sn';const input=$('[data-field="dur"]');if(input)input.value=value;changed('resize:'+s.id);render();
});
function finishResize(){if(!resizing)return;resizing.card.draggable=true;resizing=null;suppressTouchClick=true;history.endGroup();renderTimeline();renderInspector();}
$('#sceneTrack').addEventListener('pointerup',finishResize);$('#sceneTrack').addEventListener('pointercancel',finishResize);
for(const surface of [$('.preview-area'),$('.timeline')]){
  surface.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';surface.classList.add('file-drop');}});
  surface.addEventListener('dragleave',e=>{if(!surface.contains(e.relatedTarget))surface.classList.remove('file-drop');});
  surface.addEventListener('drop',safely(async e=>{surface.classList.remove('file-drop');if(!e.dataTransfer.files.length)return;e.preventDefault();e.stopPropagation();await addFiles(e.dataTransfer.files);}));
}
document.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();});
document.addEventListener('drop',e=>{if(e.dataTransfer.files.length)e.preventDefault();});
$('#moveLeft').onclick=()=>moveSelected(-1);$('#moveRight').onclick=()=>moveSelected(1);$('#duplicateScene').onclick=safely(duplicate);$('#copyScene').onclick=copyScene;$('#pasteScene').onclick=safely(pasteScene);$('#deleteScene').onclick=removeSelected;
let textDrag;
canvas.onpointerdown=e=>{
  if(exporting)return;const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*1080,y=(e.clientY-rect.top)/rect.height*1920;
  const hit=[...captionBounds].reverse().find(b=>x>=b.x-30&&x<=b.x+b.w+30&&y>=b.y-30&&y<=b.y+b.h+30);if(!hit)return;
  const tgt=resolveRef(hit.ref);if(!tgt)return;
  pause();
  const ref=hit.ref.type==='scene'?null:{type:hit.ref.type,id:hit.ref.id};
  if(curTarget()!==tgt||tab!=='text'){activeText=ref;tab='text';tool='text';renderInspector();}
  textDrag={tgt,x,y,sx:tgt.textX,sy:tgt.textY};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';
};
canvas.onpointermove=e=>{if(!textDrag)return;const t=textDrag.tgt,rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*1080,y=(e.clientY-rect.top)/rect.height*1920;t.textX=clamp(textDrag.sx+(x-textDrag.x)/10.8,0,100);t.textY=clamp(textDrag.sy+(y-textDrag.y)/19.2,0,100);t.textPosition='custom';changed('caption-drag');render();};
canvas.onpointerup=canvas.onpointercancel=()=>{if(textDrag){textDrag=null;history.endGroup();canvas.style.cursor='';renderInspector();}};
// Değer pause()'dan önce okunur: pause() önizlemeyi yeniden çizerken çubuğu eski konuma geri yazar.
$('#scrubber').oninput=e=>{const wanted=+e.target.value;pause();time=wanted;selected=current()?.sc.id||null;renderTimeline();renderInspector();syncVideos(time,false);render();};
$('#playScene').onclick=safely(()=>play('scene'));$('#playAll').onclick=safely(()=>play('all'));$('#pause').onclick=pause;
document.addEventListener('keydown',e=>{if(e.code!=='Space'||e.ctrlKey||e.altKey||e.metaKey||/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;e.preventDefault();if(playing)pause();else safely(()=>play('all'))();});
$('#audioControls').onclick=safely(async e=>{const pick=e.target.closest('[data-audio]'),remove=e.target.closest('[data-remove-audio]');if(pick){if(parent!==window){parent.postMessage({type:pick.dataset.audio==='amb'?'mk:pick-music':'mk:pick-voice'},location.origin);return;}$('#audioPicker').dataset.which=pick.dataset.audio;$('#audioPicker').click();}if(remove){pause();const w=remove.dataset.removeAudio;audioFiles.delete(w);delete state.audioAssets[w];state[w+'Name']='';changed();renderAudio();}});
$('#audioPicker').onchange=safely(async e=>{const f=e.target.files[0],w=e.target.dataset.which,epoch=projectEpoch;e.target.value='';if(!f)return;const a=await makeAudio(f,w);if(epoch!==projectEpoch)return;pause();audioFiles.set(w,a);state.audioAssets[w]=registerAsset(f,'audio');assets.get(state.audioAssets[w]).buffer=a.raw;state[w+'Name']=f.name;changed();renderAudio();});
// Üst sayfadan (Mavi Stüdyo) gelen şiir kaydını anlatım sesi olarak ekler. Yalnızca aynı kaynaktan kabul edilir.
addEventListener('message',safely(async e=>{const d=e.data;if(e.origin!==location.origin||!d||d.type!=='mk:add-audio'||!(d.blob instanceof Blob))return;
  const w=d.slot==='amb'?'amb':'nar',epoch=projectEpoch,f=new File([d.blob],String(d.name||(w==='amb'?'fon-muzigi.mp3':'siir-kaydi.wav')),{type:d.blob.type||'audio/wav'}),a=await makeAudio(f,w);
  if(epoch!==projectEpoch)return;pause();audioFiles.set(w,a);state.audioAssets[w]=registerAsset(f,'audio');assets.get(state.audioAssets[w]).buffer=a.raw;state[w+'Name']=f.name;changed();renderAudio();
  toast(w==='amb'?'Fon müziği eklendi.':'Şiir kaydı anlatım sesi olarak eklendi.');parent!==window&&parent.postMessage({type:'mk:audio-added',slot:w,name:f.name},location.origin);}));
addEventListener('message',safely(async e=>{const d=e.data;if(e.origin!==location.origin||!d||d.type!=='mk:import-performance'||!(d.voice instanceof Blob))return;
  const epoch=projectEpoch,vf=new File([d.voice],String(d.voiceName||'siir.wav'),{type:d.voice.type||'audio/wav'}),va=await makeAudio(vf,'nar');
  let mf=null,ma=null;if(d.music instanceof Blob){mf=new File([d.music],String(d.musicName||'fon.mp3'),{type:d.music.type||'audio/mpeg'});ma=await makeAudio(mf,'amb');}
  if(epoch!==projectEpoch)return;pause();
  audioFiles.set('nar',va);state.audioAssets.nar=registerAsset(vf,'audio');assets.get(state.audioAssets.nar).buffer=va.raw;state.narName=vf.name;
  if(ma){audioFiles.set('amb',ma);state.audioAssets.amb=registerAsset(mf,'audio');assets.get(state.audioAssets.amb).buffer=ma.raw;state.ambName=mf.name;const c=d.musicCfg||{};state.vol.amb=clamp(+c.volume||.35,0,1);state.ambStart=Math.max(0,+c.startSec||0);state.ambFadeIn=Math.max(0,+c.fadeInSec||0);state.ambFadeOut=Math.max(0,+c.fadeOutSec||0);state.ambOn=true;state.ambLoop=true;}
  else{audioFiles.delete('amb');delete state.audioAssets.amb;state.ambName='';}
  state.name=(String(d.title||'Şiir')+(d.poet?' — '+d.poet:'')).slice(0,100);
  state.performance={title:String(d.title||''),poet:String(d.poet||''),atmosphere:String(d.atmosphere||''),performanceId:d.performanceId||null,mix:d.mix||null};
  if(!state.scenes.length){const dur=Math.min(240,Math.max(10,Math.ceil(va.raw.duration+1)));state.scenes.push({...defaults(),kind:'title',name:String(d.title||'Şiir').slice(0,60),dur});}
  timeline();state.texts=state.texts||[];
  for(const c of (Array.isArray(d.cues)?d.cues.slice(0,28):[])){if(totalTexts()>=MAX_TEXTS)break;const st=r1(clamp(+c.start||0,0,Math.max(0,total-.5)));state.texts.push(normalizeText({text:String(c.text||'').slice(0,600),textPosition:'middle',textY:50,textStart:st,textDur:r1(Math.max(.5,Math.min((+c.end||0)-(+c.start||0)||3,total-st)))}));}
  changed();refresh();renderAudio();toast('Şiir sesi ve fon ayrı kanallar olarak aktarıldı.');
  parent!==window&&parent.postMessage({type:'mk:performance-imported',performanceId:d.performanceId||null,videoProjectId:state.id},location.origin);}));
try{if(localStorage.getItem('mk-debug')==='1')window.__mk={get state(){return state},audioFiles,audioTracks,renderAudioLanes};}catch{}
parent!==window&&parent.postMessage({type:'mk:ready'},location.origin);
$('#audioControls').oninput=e=>{const w=e.target.dataset.volume;if(w){pause();state.vol[w]=+e.target.value/100;changed('volume:'+w);}if(e.target.id==='ambLoop'){pause();state.ambLoop=e.target.checked;changed();renderAudioLanes();}if(e.target.id==='ambOn'){pause();state.ambOn=e.target.checked;changed();renderAudioLanes();}if(['ambStart','ambFadeIn','ambFadeOut'].includes(e.target.id)){pause();state[e.target.id]=Math.max(0,+e.target.value||0);changed();renderAudioLanes();}};
$('#audioControls').onchange=()=>history.endGroup();
$('#projectName').oninput=e=>{state.name=e.target.value||'İsimsiz proje';changed('project-name');};$('#projectName').onblur=()=>history.endGroup();
$('#saveProject').onclick=saveProject;$('#openProject').onclick=safely(showProjects);
$('#projectList').onclick=safely(async e=>{const b=e.target.closest('[data-project],[data-legacy]');if(!b||projectBusy||historyBusy||!allowLeave())return;projectBusy=true;$('#workspace').inert=true;try{await openRecord(b.dataset.legacy?await legacyRecord():await dbGet(b.dataset.record||'p:'+b.dataset.project));}finally{projectBusy=false;$('#workspace').inert=false;}});
$('#newProject').onclick=()=>{if(projectBusy||historyBusy||!allowLeave())return;clearTimeout(autosaveTimer);projectEpoch++;pause();for(const m of media.values())disposeMedia(m);media.clear();audioFiles.clear();assets.clear();state=blank();selected=null;time=0;dirty=false;revision++;history.reset(state);historyUI();$('#projectName').value=state.name;$('#saveStatus').textContent='Yeni proje';refresh();persist(false);};
$('#backupProject').onclick=safely(backup);$('#importProject').onclick=()=>{if(!projectBusy&&allowLeave())$('#projectPicker').click();};$('#projectPicker').onchange=safely(async e=>{const f=e.target.files[0];e.target.value='';if(!f||projectBusy)return;projectBusy=true;$('#workspace').inert=true;try{await importFile(f);}finally{projectBusy=false;$('#workspace').inert=false;}});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
$('#exportVideo').onclick=showExport;$('#startExport').onclick=exportVideo;$('#closeExport').onclick=()=>$('#exportDialog').close();$('#exportFormat').onchange=showExportNote;$('#exportRes').onchange=()=>{exportRes=$('#exportRes').value;refreshExportInfo();if($('#exportFormat').value==='mp4')checkDevice(exportFormats());};$('#cancelExport').onclick=()=>{exportCancelled=true;exportAbort?.abort();$('#exportStatus').textContent='İptal ediliyor…';};$('#exportDialog').oncancel=e=>{if(exporting){e.preventDefault();exportCancelled=true;exportAbort?.abort();}};
window.addEventListener('beforeunload',e=>{if(dirty||exporting){e.preventDefault();e.returnValue='';}});
$('#undo').onclick=()=>travelHistory('undo');$('#redo').onclick=()=>travelHistory('redo');
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey||!['c','v'].includes(e.key.toLowerCase())||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable||document.querySelector('dialog[open]')||tab!=='visual'||window.getSelection?.().toString())return;e.preventDefault();if(e.key.toLowerCase()==='c')copyScene();else safely(pasteScene)();});
document.addEventListener('keydown',e=>{if(e.key!=='Delete'||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable||document.querySelector('dialog[open]')||tab!=='text')return;const t=curTarget();if(t&&(state.texts||[]).includes(t)){e.preventDefault();textOp('del');}});
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey||document.querySelector('dialog[open]'))return;const key=e.key.toLowerCase();if(key!=='z'&&key!=='y')return;e.preventDefault();travelHistory(key==='y'||e.shiftKey?'redo':'undo');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(playing)pause();if(dirty&&!projectBusy)persist(false);}});
window.addEventListener('pagehide',()=>{if(dirty&&!projectBusy)persist(false);});
let fontsLoaded=null;
function loadFonts(){return fontsLoaded||(fontsLoaded=Promise.all(FONT_LIST.flatMap(f=>[`400 40px "${f}"`,`700 40px "${f}"`].map(spec=>document.fonts.load(spec,'ĞğŞşİıÇçÖöÜü').catch(()=>[])))).then(()=>{render();if(tab==='text'&&selectedScene())drawStyleTiles();}));}
loadFonts();
$('#tlZoom').value=tlPps;
refresh();requestAnimationFrame(tick);
(async()=>{projectBusy=true;$('#workspace').inert=true;$('.topbar').inert=true;try{const last=await projectStore.get('session:last');if(last?.id){const draft=await projectStore.get('draft:'+last.id);if(draft){await openRecord(draft);$('#saveStatus').textContent='Otomatik kayıt geri yüklendi';}}}catch(e){toast('Son proje açılamadı: '+e.message);}finally{projectBusy=false;$('#workspace').inert=false;$('.topbar').inert=false;document.body.dataset.ready='true';}})();
})();
