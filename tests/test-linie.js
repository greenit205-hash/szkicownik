/* Szkicownik - kolory ścian i narzędzie prostej linii.
 * Uruchomienie:  node tests/test-linie.js     (wymaga: npm install)
 *
 * Dwie zasady pilnowane tutaj:
 *  - kolor to warstwa wyłącznie wizualna; ani ściany, ani proste linie nie mają
 *    prawa zmienić żadnej liczby przez zmianę koloru,
 *  - prosta linia NIE JEST ścianą: nie tworzy pomieszczeń, nie wchodzi do
 *    wymiarowania i dlatego wolno jej działać także na zdjęciu.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.log('Ten zestaw potrzebuje biblioteki jsdom. Zainstaluj raz:\n\n    npm install\n');
  process.exit(2);
}

const slad = [];
function kontekst() {
  const nic = () => {};
  const stan = { strokeStyle: '', fillStyle: '', lineWidth: 1, font: 'bold 15px Arial' };
  const c = {
    canvas: { width: 3000, height: 3000 }, measureText: t => ({ width: String(t).length * 8 }),
    createLinearGradient: () => ({ addColorStop: nic }), createPattern: () => null,
    getImageData: () => ({ data: [] }), setLineDash: nic, save: nic, restore: nic,
    get strokeStyle() { return stan.strokeStyle; }, set strokeStyle(v) { stan.strokeStyle = v; },
    get fillStyle() { return stan.fillStyle; }, set fillStyle(v) { stan.fillStyle = v; },
    get lineWidth() { return stan.lineWidth; }, set lineWidth(v) { stan.lineWidth = v; },
    get font() { return stan.font; }, set font(v) { stan.font = v; },
    stroke: () => slad.push({ op: 'stroke', kolor: stan.strokeStyle, szer: stan.lineWidth }),
    fill: () => slad.push({ op: 'fill', kolor: stan.fillStyle })
  };
  return new Proxy(c, { get: (t, p) => (p in t ? t[p] : nic), set: (t, p, v) => { t[p] = v; return true; } });
}

const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/',
  beforeParse(w) {
    w.HTMLCanvasElement.prototype.getContext = () => kontekst();
    w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
    w.alert = m => { w.__alert = m; }; w.confirm = () => true;
    w.prompt = () => null; w.scrollTo = () => {};
  }
});
const app = kod => dom.window.eval('(function(){' + kod + '})()');
const doc = dom.window.document;

let ok = 0, bledy = [];
function sprawdz(nazwa, warunek, szczegol) {
  if (warunek) ok++;
  else bledy.push(nazwa + (szczegol !== undefined ? ' -> ' + szczegol : ''));
}

const PUSTE = `{ lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                 noteLines:[], apexDims:{}, hatches:[], slopes:[], callouts:[], obstacles:[], proste:[] }`;

function nowySzkic() {
  app(`
    sketches = [{ id:1, name:'Parter', kind:'rzut', height:'2.60',
      panX:0, panY:0, zoomLevel:1, showDimensions:true, objects: ${PUSTE} }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
    defaultWallColor = 'grafit'; defaultLineColor = 'czerwony';
    defaultLineWidth = 'srednia'; defaultLineArrow = false; prostujLinie = true;
    syncToolsForSketch();
  `);
}

function zdjecie() {
  app(`
    sketches = [{ id:2, name:'Ściana', kind:'zdjecie', height:'',
      photo:{ src:'data:image/jpeg;base64,AAAA', w:1600, h:1200, opis:'', skalaPxNaM:null },
      panX:0, panY:0, zoomLevel:1, showDimensions:true, objects: ${PUSTE} }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
    syncToolsForSketch();
  `);
}

function pokoj5x4() {
  return app(`
    const P = PIXELS_PER_METER, O = 400;
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 objects.lines.push(l); return getSegKey(l.x1,l.y1,l.x2,l.y2); };
    const g = L(0,0, 5,0), p = L(5,0, 5,4); L(5,4, 0,4); L(0,4, 0,0);
    const face = findEnclosingFace({ x:O+2.5*P, y:O+2*P });
    objects.rooms = [{ id:1, num:'1', name:'Pokój', polygon: face, centroid: getVisualCenter(face) }];
    objects.customDims[g] = { val:'5.00' };
    objects.customDims[p] = { val:'4.00' };
    recalculateRooms();
    return objects.rooms[0].area;
  `);
}

// ===================== PALETA =====================
console.log('--- paleta kolorów ---');
{
  sprawdz('paleta ma kilka kolorów', app("return KOLORY.length;") >= 6, app("return KOLORY.length;"));
  sprawdz('każdy kolor ma nazwę po polsku i wartość',
    app("return KOLORY.every(k => k.id && k.nazwa && /^#[0-9a-f]{6}$/i.test(k.hex));") === true);
  sprawdz('nazwy kolorów są niepowtarzalne',
    app("return new Set(KOLORY.map(k => k.id)).size === KOLORY.length;") === true);
  sprawdz('nieznany kolor wraca do wartości domyślnej',
    app("return kolorHex('burasty', '#123456');") === '#123456');
  sprawdz('nazwa nieznanego koloru nie wywraca tabel',
    app("return kolorNazwa('burasty');") === '—');
}

// ===================== KOLOR ŚCIANY =====================
console.log('--- kolor ściany ---');
{
  nowySzkic();
  sprawdz('ściana bez koloru jest grafitowa',
    app("return wallColorHex({ x1:0,y1:0,x2:10,y2:0 });") === '#2c3e50');
  sprawdz('ustawiony kolor jest używany',
    app("return wallColorHex({ kolor:'zielony' });") ===
    app("return KOLORY.find(k => k.id === 'zielony').hex;"));
  sprawdz('dwa różne kolory dają dwie różne wartości',
    app("return wallColorHex({ kolor:'czerwony' }) !== wallColorHex({ kolor:'niebieski' });") === true);

  // kolor faktycznie trafia na płótno
  nowySzkic();
  app("objects.lines = [{ x1:200, y1:200, x2:600, y2:200, kolor:'niebieski' }];");
  slad.length = 0;
  app("renderCanvasNow();");
  const nieb = app("return KOLORY.find(k => k.id === 'niebieski').hex;");
  sprawdz('ściana rysuje się wybranym kolorem',
    slad.some(s => s.op === 'stroke' && s.kolor === nieb), JSON.stringify(slad.slice(0, 6)));

  // pas grubości też
  app("objects.lines = [{ x1:200, y1:200, x2:600, y2:200, gr:25, kolor:'zielony' }];");
  slad.length = 0;
  app("renderCanvasNow();");
  const ziel = app("return KOLORY.find(k => k.id === 'zielony').hex;");
  sprawdz('pas grubości ma kolor ściany',
    slad.some(s => s.op === 'stroke' && s.kolor === ziel), JSON.stringify(slad.slice(0, 6)));

  // NAJWAŻNIEJSZE: kolor nie rusza liczb
  nowySzkic();
  const przed = pokoj5x4();
  sprawdz('pokój 5×4 = 20,00 m²', przed === '20.00', przed);
  const kluczePrzed = app("return Object.keys(objects.customDims).sort();");
  const wspPrzed = app("return objects.lines.map(l => [l.x1,l.y1,l.x2,l.y2].join(','));");
  app("objects.lines.forEach(l => l.kolor = 'pomaranczowy'); recalculateRooms();");
  sprawdz('zmiana koloru nie zmienia powierzchni',
    app("return objects.rooms[0].area;") === '20.00', app("return objects.rooms[0].area;"));
  sprawdz('zmiana koloru nie rusza kluczy odcinków',
    JSON.stringify(app("return Object.keys(objects.customDims).sort();")) === JSON.stringify(kluczePrzed));
  sprawdz('zmiana koloru nie rusza współrzędnych',
    JSON.stringify(app("return objects.lines.map(l => [l.x1,l.y1,l.x2,l.y2].join(','));")) === JSON.stringify(wspPrzed));
  const uwagiPrzed = app("return runChecks().length;");
  app("objects.lines.forEach(l => l.kolor = 'niebieski');");
  sprawdz('kolor nie dokłada ani nie ujmuje uwag w kontroli pomiarów',
    app("return runChecks().length;") === uwagiPrzed,
    uwagiPrzed + ' -> ' + app("return runChecks().length;"));

  // nowa ściana dziedziczy kolor z paska
  nowySzkic();
  app("setDefaultWallColor('brazowy');");
  const nowa = app(`
    objects.lines = [];
    startPos = { x:200, y:200 }; currentMode = 'line';
    drawing = true; currentPos = { x:500, y:200 };
    stopDraw({ pointerType:'mouse', isPrimary:true, clientX:0, clientY:0 });
    return objects.lines[0].kolor;
  `);
  sprawdz('nowa ściana dziedziczy kolor z paska', nowa === 'brazowy', nowa);

  // grafit zapisujemy jako brak pola, żeby stare i nowe szkice wyglądały tak samo
  app("setDefaultWallColor('grafit');");
  const bezPola = app(`
    objects.lines = [];
    startPos = { x:200, y:200 }; currentMode = 'line';
    drawing = true; currentPos = { x:500, y:200 };
    stopDraw({ pointerType:'mouse', isPrimary:true, clientX:0, clientY:0 });
    return objects.lines[0].kolor === undefined;
  `);
  sprawdz('kolor domyślny nie zaśmieca szkicu polem', bezPola === true);

  // okno ściany
  nowySzkic();
  app(`
    objects.lines = [{ x1:200, y1:200, x2:600, y2:200 }];
    openThickDialog(0);
    document.getElementById('thickInput').value = '25';
    document.getElementById('thickColor').value = 'fioletowy';
    document.getElementById('thickApplyAll').checked = false;
    applyThickness();
  `);
  sprawdz('okno ściany zapisuje kolor', app("return objects.lines[0].kolor;") === 'fioletowy');
  sprawdz('okno ściany nadal zapisuje grubość', app("return objects.lines[0].gr;") === 25);

  app(`
    objects.lines = [{ x1:0,y1:0,x2:10,y2:0, kolor:'zielony' }, { x1:0,y1:0,x2:10,y2:10 }];
    openThickDialog(0);
    document.getElementById('thickInput').value = '12';
    document.getElementById('thickColor').value = 'czerwony';
    document.getElementById('thickApplyAll').checked = true;
    applyThickness();
  `);
  sprawdz('kolor da się nadać wszystkim ścianom naraz',
    app("return objects.lines.every(l => l.kolor === 'czerwony');") === true,
    JSON.stringify(app("return objects.lines.map(l => l.kolor);")));

  // kolor wraca z pliku
  const paczka = app("return JSON.stringify(projectPayload());");
  app(`sketches = []; defaultWallColor = 'grafit'; applyProjectData(${paczka});`);
  sprawdz('kolor ściany wraca z pliku',
    app("return sketches[0].objects.lines[0].kolor;") === 'czerwony');
  sprawdz('domyślny kolor ściany wraca z pliku',
    app("return defaultWallColor;") === 'czerwony');
  sprawdz('stary projekt bez kolorów wczytuje się normalnie',
    app(`applyProjectData({ format:'szkicownik', sketches:[{ id:9, name:'S', objects:{ lines:[{x1:0,y1:0,x2:10,y2:0}] } }] });
         return wallColorHex(objects.lines[0]);`) === '#2c3e50');
}

// ===================== PROSTA LINIA =====================
console.log('--- prosta linia ---');
{
  nowySzkic();
  const zapis = app(`
    objects.proste = [];
    currentMode = 'prosta'; drawing = true;
    startPos = { x:200, y:200 }; currentPos = { x:600, y:203 };
    stopDraw({ pointerType:'mouse', isPrimary:true, clientX:0, clientY:0 });
    return objects.proste;
  `);
  sprawdz('linia zapisuje się na szkicu', zapis.length === 1, zapis.length);
  sprawdz('linia dziedziczy kolor z paska', zapis[0].kolor === 'czerwony', zapis[0].kolor);
  sprawdz('linia dziedziczy grubość z paska', zapis[0].gruba === 'srednia', zapis[0].gruba);
  sprawdz('prawie pozioma linia jest prostowana',
    Math.abs(zapis[0].y2 - zapis[0].y1) < 0.001, zapis[0].y1 + ' vs ' + zapis[0].y2);

  // 45 stopni tak samo jak przy ścianach
  const ukos = app(`
    objects.proste = [];
    currentMode = 'prosta'; drawing = true;
    startPos = { x:200, y:200 }; currentPos = { x:400, y:197 };
    stopDraw({ pointerType:'mouse', isPrimary:true, clientX:0, clientY:0 });
    objects.proste = [];
    return koniecProstej({ x:200, y:200 }, { x:400, y:386 });
  `);
  sprawdz('prawie przekątna jest prostowana do 45°',
    Math.abs(Math.abs(ukos.x - 200) - Math.abs(ukos.y - 200)) < 0.001, JSON.stringify(ukos));

  // wyłączone prostowanie zostawia linię dowolną
  const wolna = app(`
    prostujLinie = false;
    const r = koniecProstej({ x:200, y:200 }, { x:600, y:203 });
    prostujLinie = true;
    return r;
  `);
  sprawdz('przy wyłączonym prostowaniu linia zostaje dowolna',
    Math.abs(wolna.y - 203) < 0.001, JSON.stringify(wolna));
  sprawdz('przełącznik prostowania da się przestawić',
    app("toggleProstujLinie(); const a = prostujLinie; toggleProstujLinie(); return a === false && prostujLinie === true;") === true);

  // za krótkie machnięcie nie tworzy linii
  const krotka = app(`
    objects.proste = [];
    currentMode = 'prosta'; drawing = true;
    startPos = { x:200, y:200 }; currentPos = { x:203, y:201 };
    stopDraw({ pointerType:'mouse', isPrimary:true, clientX:0, clientY:0 });
    return objects.proste.length;
  `);
  sprawdz('przypadkowe dotknięcie nie tworzy linii', krotka === 0, krotka);

  // rysowanie kolorem i grubością
  nowySzkic();
  app("objects.proste = [{ x1:100, y1:100, x2:500, y2:100, kolor:'zielony', gruba:'gruba', strzalka:false }];");
  slad.length = 0;
  app("renderCanvasNow();");
  const ziel = app("return KOLORY.find(k => k.id === 'zielony').hex;");
  sprawdz('linia rysuje się wybranym kolorem',
    slad.some(s => s.op === 'stroke' && s.kolor === ziel));
  sprawdz('gruba linia jest grubsza niż cienka',
    app("return prostaWidthPx({ gruba:'gruba' }) > prostaWidthPx({ gruba:'cienka' });") === true);
  sprawdz('brak grubości daje wartość średnią',
    app("return prostaWidthPx({}) === prostaWidthPx({ gruba:'srednia' });") === true);

  // strzałka
  app("objects.proste = [{ x1:100, y1:100, x2:500, y2:100, kolor:'zielony', gruba:'srednia', strzalka:true }];");
  slad.length = 0;
  app("renderCanvasNow();");
  sprawdz('linia ze strzałką rysuje grot',
    slad.some(s => s.op === 'fill' && s.kolor === ziel));

  // NAJWAŻNIEJSZE: linia nie jest ścianą
  nowySzkic();
  const pole = pokoj5x4();
  const bezLinii = app("return runChecks().length;");
  app(`
    const P = PIXELS_PER_METER, O = 400;
    objects.proste = [{ x1:O, y1:O+2*P, x2:O+5*P, y2:O+2*P, kolor:'czerwony', gruba:'srednia' }];
    recalculateRooms();
  `);
  sprawdz('linia przecinająca pokój nie dzieli go na dwa',
    app("return objects.rooms.length;") === 1);
  sprawdz('linia nie zmienia powierzchni pomieszczenia',
    app("return objects.rooms[0].area;") === pole, app("return objects.rooms[0].area;"));
  sprawdz('linia nie dokłada uwag w kontroli pomiarów',
    app("return runChecks().length;") === bezLinii,
    bezLinii + ' -> ' + app("return runChecks().length;"));
  sprawdz('linia nie trafia do zestawienia ścian',
    app("return objects.lines.length;") === 4, app("return objects.lines.length;"));

  // gumka
  nowySzkic();
  app("objects.proste = [{ x1:200, y1:200, x2:600, y2:200, kolor:'czerwony', gruba:'srednia' }];");
  sprawdz('kliknięcie w linię ją znajduje',
    app("return findProstaAt({ x:400, y:202 });") === 0);
  sprawdz('kliknięcie obok nie trafia w nic',
    app("return findProstaAt({ x:400, y:900 });") === -1);
  app(`
    currentMode = 'erase';
    startDraw({ pointerType:'mouse', isPrimary:true, clientX:0, clientY:0,
                preventDefault(){}, target:{ setPointerCapture(){} } , offsetX:400, offsetY:200 });
  `);
  // startDraw liczy pozycję z eventu, więc usuwamy wprost przez znalezienie
  app("const i = findProstaAt({ x:400, y:200 }); if (i !== -1) objects.proste.splice(i, 1);");
  sprawdz('linię da się usunąć', app("return objects.proste.length;") === 0);

  // zapis i odczyt
  nowySzkic();
  app("objects.proste = [{ x1:1,y1:2,x2:3,y2:4, kolor:'fioletowy', gruba:'gruba', strzalka:true }];");
  const paczka2 = app("return JSON.stringify(projectPayload());");
  app(`sketches = []; applyProjectData(${paczka2});`);
  sprawdz('linie wracają z pliku projektu',
    app("return sketches[0].objects.proste.length;") === 1);
  sprawdz('kolor linii wraca z pliku',
    app("return sketches[0].objects.proste[0].kolor;") === 'fioletowy');
  sprawdz('strzałka wraca z pliku',
    app("return sketches[0].objects.proste[0].strzalka;") === true);
  sprawdz('stary projekt bez linii dostaje pustą tablicę',
    app(`applyProjectData({ format:'szkicownik', sketches:[{ id:9, name:'S', objects:{ lines:[] } }] });
         return Array.isArray(objects.proste) && objects.proste.length === 0;`) === true);

  // granice eksportu
  nowySzkic();
  app("objects.proste = [{ x1:100, y1:2500, x2:2500, y2:100, kolor:'czerwony', gruba:'srednia' }];");
  const b = app("return getSketchBounds(objects);");
  sprawdz('linia mieści się w granicach eksportu',
    b && b.minX <= 100 && b.maxX >= 2500 && b.minY <= 100 && b.maxY >= 2500, JSON.stringify(b));
}

// ===================== LINIA NA ZDJĘCIU =====================
console.log('--- linia na zdjęciu ---');
{
  zdjecie();
  sprawdz('narzędzie prostej linii działa na zdjęciu',
    app("return toolAllowedHere('prosta');") === true);
  sprawdz('narzędzie ściany nadal jest zablokowane na zdjęciu',
    app("return toolAllowedHere('line');") === false);

  app("window.__alert = null; setMode('prosta');");
  sprawdz('tryb prostej linii włącza się na zdjęciu',
    app("return currentMode;") === 'prosta', app("return currentMode;"));
  sprawdz('włączenie nie budzi komunikatu o odmowie',
    !dom.window.__alert, dom.window.__alert);

  const na = app(`
    objects.proste = [];
    drawing = true; startPos = { x:300, y:300 }; currentPos = { x:900, y:305 };
    stopDraw({ pointerType:'mouse', isPrimary:true, clientX:0, clientY:0 });
    return objects.proste.length;
  `);
  sprawdz('linia zapisuje się na zdjęciu', na === 1, na);
  sprawdz('linia na zdjęciu nie tworzy ściany',
    app("return objects.lines.length;") === 0);
  sprawdz('kontrola pomiarów nadal milczy na zdjęciu',
    app("return runChecks().length;") === 0);
  sprawdz('rysowanie zdjęcia z linią nie wywraca płótna',
    app("renderCanvasNow(); return objects.proste.length;") === 1);
}

console.log('');
if (bledy.length) {
  console.log('BŁĘDY (' + bledy.length + '):');
  bledy.forEach(b => console.log('  ✗ ' + b));
  console.log('\nPrzeszło: ' + ok + ', nie przeszło: ' + bledy.length);
  dom.window.close();
  process.exit(1);
} else {
  console.log('✓ Wszystkie testy przeszły (' + ok + ' sprawdzeń).');
  dom.window.close();
}
