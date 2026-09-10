/* Szkicownik - wymiarowanie ściany zaraz po narysowaniu.
 * Uruchomienie:  node tests/test-autodim.js     (wymaga: npm install)
 *
 * Pętla, której pilnuje ten zestaw: rysujesz ścianę → wyskakuje okno wymiaru →
 * dalmierz wpisuje wartość → zapisuje się sama → rysunek dociąga się do niej →
 * rysujesz następną. Każde z tych ogniw ma osobne sprawdzenie, bo zerwanie
 * któregokolwiek daje w terenie to samo: rysunek, który nie odpowiada pomiarom.
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

function kontekst() {
  const nic = () => {};
  const c = { canvas: { width: 3000, height: 3000 }, measureText: t => ({ width: String(t).length * 8 }),
    createLinearGradient: () => ({ addColorStop: nic }), createPattern: () => null,
    getImageData: () => ({ data: [] }), setLineDash: nic };
  return new Proxy(c, { get: (t, p) => (p in t ? t[p] : nic), set: () => true });
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
const czekaj = ms => new Promise(r => setTimeout(r, ms));

const PUSTE = `{ lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                 noteLines:[], apexDims:{}, hatches:[], slopes:[], callouts:[], obstacles:[], proste:[] }`;

function nowySzkic() {
  app(`
    sketches = [{ id:1, name:'Parter', kind:'rzut', height:'2.60',
      panX:0, panY:0, zoomLevel:1, showDimensions:true, objects: ${PUSTE} }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
    autoFitOn = true; autoDimOn = false; autoDimPending = false;
    defaultThicknessCm = 0; currentMode = 'line';
    closeDimEditDialog();
  `);
}

// Narysowanie ściany dokładnie tak, jak powstaje pod palcem.
function rysujSciane(x1, y1, x2, y2) {
  app(`
    currentMode = 'line'; drawing = true;
    startPos = findSnapPoint({ x:${x1}, y:${y1} }).pt;
    const k = koniecSciany(startPos, { x:${x2}, y:${y2} });
    currentPos = k.pt;
    stopDraw({ pointerType:'mouse', isPrimary:true, clientX:0, clientY:0 });
  `);
}

const oknoOtwarte = () => doc.getElementById('dimEditOverlay').style.display === 'flex';

async function main() {

// ===================== PRZEŁĄCZNIK =====================
console.log('--- przełącznik trybu ---');
{
  nowySzkic();
  sprawdz('tryb jest domyślnie wyłączony', app("return autoDimOn;") === false);

  app("autoFitOn = false; autoDimOn = false; toggleAutoDim();");
  sprawdz('włączenie trybu włącza go', app("return autoDimOn;") === true);
  sprawdz('włączenie trybu włącza też skalę 1:1 — bez niej tryb nie ma sensu',
    app("return autoFitOn;") === true);

  app("toggleAutoDim();");
  sprawdz('wyłączenie trybu wyłącza go', app("return autoDimOn;") === false);
  sprawdz('wyłączenie trybu nie wyłącza skali 1:1', app("return autoFitOn;") === true);
}

// ===================== OKNO PO NARYSOWANIU =====================
console.log('--- okno wymiaru po narysowaniu ściany ---');
{
  nowySzkic();
  rysujSciane(400, 400, 700, 402);
  await czekaj(120);
  sprawdz('przy wyłączonym trybie okno się nie otwiera', !oknoOtwarte());

  nowySzkic();
  app("autoDimOn = true;");
  rysujSciane(400, 400, 700, 402);
  await czekaj(120);
  sprawdz('po narysowaniu ściany okno wymiaru się otwiera', oknoOtwarte());
  sprawdz('okno dotyczy właśnie narysowanej ściany',
    app(`
      const l = objects.lines[objects.lines.length - 1];
      return selectedSegKey === getSegKey(l.x1, l.y1, l.x2, l.y2);
    `) === true, app("return selectedSegKey;"));
  sprawdz('pole wymiaru jest puste i czeka na wartość',
    doc.getElementById('modalDimInput').value === '');
  sprawdz('tryb jest oznaczony jako czekający na pomiar',
    app("return autoDimPending;") === true);
  sprawdz('okno tłumaczy, co zrobić',
    doc.getElementById('modalAutoDimInfo').style.display === 'block' &&
    doc.getElementById('modalAutoDimInfo').innerHTML.length > 20);

  // pominięcie
  app("skipAutoDim();");
  sprawdz('pominięcie zamyka okno', !oknoOtwarte());
  sprawdz('pominięcie kończy czekanie', app("return autoDimPending;") === false);
  sprawdz('pominięta ściana nie dostaje wymiaru',
    Object.keys(app("return objects.customDims;")).length === 0);
  sprawdz('pominięta ściana zostaje na szkicu',
    app("return objects.lines.length;") === 1);
}

// ===================== ZAPIS Z DALMIERZA =====================
console.log('--- dalmierz wpisuje i zapisuje sam ---');
{
  nowySzkic();
  app("autoDimOn = true;");
  rysujSciane(400, 400, 700, 402);
  await czekaj(120);
  sprawdz('okno czeka na pomiar', oknoOtwarte() && app("return autoDimPending;") === true);

  // to samo, co robi dalmierz: wpisuje wartość do pola i wywołuje zapis
  app("document.getElementById('modalDimInput').value = '5.00'; autoDimSave();");
  sprawdz('wymiar z dalmierza zapisuje się sam',
    app("return Object.values(objects.customDims).map(d => d.val)[0];") === '5.00',
    JSON.stringify(app("return objects.customDims;")));
  sprawdz('okno zamyka się po zapisie', !oknoOtwarte());
  sprawdz('czekanie się kończy', app("return autoDimPending;") === false);

  // i najważniejsze: rysunek dociągnął się do pomiaru
  const dl = app(`
    const l = objects.lines[0];
    return Math.hypot(l.x2-l.x1, l.y2-l.y1) / PIXELS_PER_METER;
  `);
  sprawdz('rysunek dociąga się do zmierzonej długości',
    Math.abs(dl - 5.00) < 0.02, dl);

  // zapis pustego pola nie może nic robić
  nowySzkic();
  app("autoDimOn = true;");
  rysujSciane(400, 400, 700, 402);
  await czekaj(120);
  app("document.getElementById('modalDimInput').value = ''; const r = autoDimSave(); window.__r = r;");
  sprawdz('pusta wartość nie jest zapisywana', dom.window.__r === false);
  sprawdz('przy pustej wartości okno zostaje otwarte', oknoOtwarte());
  app("skipAutoDim();");

  // Poza trybem funkcja nie ma prawa nic zapisać - nawet gdy pole jest
  // wypełnione i wskazana jest konkretna ściana. Inaczej wartość zostawiona
  // w oknie po poprzednim pomiarze wpisałaby się sama tam, gdzie nie trzeba.
  nowySzkic();
  rysujSciane(400, 400, 700, 400);
  await czekaj(120);
  app(`
    const l = objects.lines[0];
    selectedSegKey = getSegKey(l.x1, l.y1, l.x2, l.y2);
    document.getElementById('modalDimInput').value = '9.99';
    autoDimPending = false;
    window.__r2 = autoDimSave();
  `);
  sprawdz('poza trybem automatyczny zapis odmawia', dom.window.__r2 === false, dom.window.__r2);
  sprawdz('poza trybem nic nie zostaje zapisane',
    Object.keys(app("return objects.customDims;")).length === 0,
    JSON.stringify(app("return objects.customDims;")));
}

// ===================== ŚCIANA PO ŚCIANIE =====================
console.log('--- rysowanie pomieszczenia ściana po ścianie ---');
{
  // Cztery ściany rysowane krzywo, każda zmierzona zaraz po narysowaniu.
  // Na końcu rysunek ma odpowiadać pomiarom, a powierzchnia ma się zgadzać.
  nowySzkic();
  app("autoDimOn = true;");
  const P = 50, O = 400;

  const zmierz = async (x1, y1, x2, y2, val) => {
    rysujSciane(x1, y1, x2, y2);
    await czekaj(120);
    if (!oknoOtwarte()) return false;
    app(`document.getElementById('modalDimInput').value = '${val}'; autoDimSave();`);
    return true;
  };

  // rysujemy z ręki: zamiast 5,00 × 4,00 wychodzi 4,2 × 3,1
  let wszystkie = true;
  wszystkie = (await zmierz(O, O, O + 4.2 * P, O + 3, '5.00')) && wszystkie;
  const koniec1 = app("const l = objects.lines[0]; return { x:l.x2, y:l.y2 };");
  wszystkie = (await zmierz(koniec1.x, koniec1.y, koniec1.x + 4, koniec1.y + 3.1 * P, '4.00')) && wszystkie;
  const koniec2 = app("const l = objects.lines[1]; return { x:l.x2, y:l.y2 };");
  wszystkie = (await zmierz(koniec2.x, koniec2.y, koniec2.x - 4.2 * P, koniec2.y + 5, '5.00')) && wszystkie;
  const koniec3 = app("const l = objects.lines[2]; return { x:l.x2, y:l.y2 };");
  await zmierz(koniec3.x, koniec3.y, O + 3, O + 4, '4.00');

  sprawdz('okno wyskakiwało po każdej ścianie', wszystkie === true);
  sprawdz('powstały cztery ściany', app("return objects.lines.length;") === 4,
    app("return objects.lines.length;"));
  sprawdz('każda ściana ma zapisany wymiar',
    Object.keys(app("return objects.customDims;")).length === 4,
    Object.keys(app("return objects.customDims;")).length);

  const dlugosci = app(`
    return objects.lines.map(l => Math.hypot(l.x2-l.x1, l.y2-l.y1) / PIXELS_PER_METER);
  `);
  sprawdz('pierwsza ściana ma na rysunku 5,00 m', Math.abs(dlugosci[0] - 5) < 0.05, dlugosci[0]);
  sprawdz('druga ściana ma na rysunku 4,00 m', Math.abs(dlugosci[1] - 4) < 0.05, dlugosci[1]);
  sprawdz('trzecia ściana ma na rysunku 5,00 m', Math.abs(dlugosci[2] - 5) < 0.05, dlugosci[2]);
  sprawdz('czwarta ściana ma na rysunku 4,00 m', Math.abs(dlugosci[3] - 4) < 0.05, dlugosci[3]);

  // pomieszczenie da się rozpoznać i policzyć
  const pole = app(`
    const face = findEnclosingFace(getVisualCenter([
      { x: objects.lines[0].x1, y: objects.lines[0].y1 },
      { x: objects.lines[1].x2, y: objects.lines[1].y2 },
      { x: objects.lines[2].x2, y: objects.lines[2].y2 }
    ]));
    if (!face) return 'brak obrysu';
    objects.rooms = [{ id:1, num:'1', name:'Pokój', polygon: face, centroid: getVisualCenter(face) }];
    recalculateRooms();
    return objects.rooms[0].area;
  `);
  sprawdz('pomieszczenie domyka się po całej serii', pole !== 'brak obrysu', pole);
  sprawdz('powierzchnia wychodzi 20,00 m²', pole === '20.00', pole);

  // pomiary przeżyły wszystkie dociągnięcia rysunku po drodze
  const wartosci = app("return Object.values(objects.customDims).map(d => d.val).sort();");
  sprawdz('żaden pomiar nie zginął przy dociąganiu rysunku',
    JSON.stringify(wartosci) === JSON.stringify(['4.00', '4.00', '5.00', '5.00']),
    JSON.stringify(wartosci));
  sprawdz('kontrola pomiarów nie zgłasza sprzeczności',
    app("return runChecks().filter(i => i.level === 'error').length;") === 0,
    JSON.stringify(app("return runChecks().filter(i => i.level === 'error');")));
}

// ===================== CO TRYB MA ZOSTAWIĆ W SPOKOJU =====================
console.log('--- tryb nie wtrąca się gdzie indziej ---');
{
  // ołówek, miarka i prosta linia nie mogą wywoływać okna wymiaru
  nowySzkic();
  app("autoDimOn = true;");
  app(`
    currentMode = 'prosta'; drawing = true;
    startPos = { x:200, y:200 }; currentPos = { x:600, y:200 };
    stopDraw({ pointerType:'mouse', isPrimary:true, clientX:0, clientY:0 });
  `);
  await czekaj(120);
  sprawdz('prosta linia nie pyta o wymiar', !oknoOtwarte());

  app(`
    currentMode = 'noteline'; drawing = true;
    startPos = { x:200, y:800 }; currentPos = { x:600, y:800 };
    stopDraw({ pointerType:'mouse', isPrimary:true, clientX:0, clientY:0 });
  `);
  await czekaj(120);
  app("closeNoteDialog && closeNoteDialog();");
  sprawdz('miarka nie otwiera okna wymiaru ściany',
    doc.getElementById('dimEditOverlay').style.display !== 'flex');

  // ręczne wymiarowanie ✍️ nadal działa niezależnie od trybu
  nowySzkic();
  app("autoDimOn = false;");
  rysujSciane(400, 400, 700, 400);
  await czekaj(120);
  app(`
    const l = objects.lines[0];
    selectedSegKey = getSegKey(l.x1, l.y1, l.x2, l.y2);
    document.getElementById('modalDimInput').value = '6.00';
    applyMeasureDimension();
  `);
  sprawdz('ręczne wymiarowanie działa przy wyłączonym trybie',
    app("return Object.values(objects.customDims).map(d => d.val)[0];") === '6.00');
  sprawdz('ręczny wymiar też dociąga rysunek',
    Math.abs(app("const l = objects.lines[0]; return Math.hypot(l.x2-l.x1, l.y2-l.y1) / PIXELS_PER_METER;") - 6) < 0.02);
}


// ===================== TRYB PRZEŻYWA ZAMKNIĘCIE APLIKACJI =====================
console.log('--- tryb zapamiętany między sesjami ---');
{
  nowySzkic();
  app("autoDimOn = false; toggleAutoDim();");
  sprawdz('tryb jest włączony', app("return autoDimOn;") === true);
  const paczka = app("return JSON.stringify(projectPayload());");
  sprawdz('stan trybu trafia do projektu', JSON.parse(paczka).wymiarOdRazu === true,
    JSON.stringify(JSON.parse(paczka).wymiarOdRazu));

  app(`autoDimOn = false; sketches = []; applyProjectData(${paczka});`);
  sprawdz('tryb wraca włączony po wczytaniu projektu', app("return autoDimOn;") === true);

  app("syncToggleButtons();");
  sprawdz('przycisk pokazuje stan włączony',
    !doc.getElementById('btnAutoDim').innerText.includes('wył.'),
    doc.getElementById('btnAutoDim').innerText);

  // wyłączony też ma wrócić wyłączony
  app("toggleAutoDim();");
  const paczka2 = app("return JSON.stringify(projectPayload());");
  app(`autoDimOn = true; sketches = []; applyProjectData(${paczka2}); syncToggleButtons();`);
  sprawdz('tryb wraca wyłączony, gdy taki był', app("return autoDimOn;") === false);
  sprawdz('przycisk pokazuje stan wyłączony',
    doc.getElementById('btnAutoDim').innerText.includes('wył.'),
    doc.getElementById('btnAutoDim').innerText);

  // stary projekt bez tego pola nie może włączać trybu sam z siebie
  app(`applyProjectData({ format:'szkicownik', sketches:[{ id:9, name:'S', objects:{ lines:[] } }] });`);
  sprawdz('stary projekt zostawia tryb wyłączony', app("return autoDimOn;") === false);

  // pozostałe przełączniki też mają się zgadzać z tym, co wróciło z pliku
  app(`
    defaultWallColor = 'zielony'; defaultLineColor = 'niebieski';
    defaultLineWidth = 'gruba'; defaultWallSide = 'lewa';
    syncToggleButtons();
  `);
  sprawdz('pasek pokazuje kolor ściany z projektu',
    doc.getElementById('wallColorSelect').value === 'zielony');
  sprawdz('pasek pokazuje kolor linii z projektu',
    doc.getElementById('lineColorSelect').value === 'niebieski');
  sprawdz('pasek pokazuje grubość linii z projektu',
    doc.getElementById('lineWidthSelect').value === 'gruba');
  sprawdz('pasek pokazuje stronę muru z projektu',
    doc.getElementById('wallSideSelect').value === 'lewa');
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
}

main().catch(e => { console.log('BŁĄD:', e.stack || e.message); process.exit(1); });
