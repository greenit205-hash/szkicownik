/* Szkicownik - lica grubych ścian, punkty odniesienia, przegrody.
 * Uruchomienie:  node tests/test-mury.js     (wymaga: npm install)
 *
 * Trzy sprawy zgłoszone z terenu:
 *  1. Przy ścianie 50 cm rysowanie kolejnego pomieszczenia przyciągało do OSI,
 *     więc nowy pokój zaczynał się w środku muru i wchodził w poprzedni.
 *  2. Wybór „pas: lewa / oś / prawa" wymagał myślenia w kategoriach kierunku
 *     rysowania — program ma to ustalać sam.
 *  3. Nie dało się wskazać miejsca oddalonego o zadaną odległość od narożnika
 *     czy od okna.
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
  const stan = { strokeStyle: '', fillStyle: '', font: 'bold 13px Arial' };
  const c = {
    canvas: { width: 3000, height: 3000 }, measureText: t => ({ width: String(t).length * 7 }),
    createLinearGradient: () => ({ addColorStop: nic }), createPattern: () => null,
    getImageData: () => ({ data: [] }), setLineDash: nic, save: nic, restore: nic,
    get strokeStyle() { return stan.strokeStyle; }, set strokeStyle(v) { stan.strokeStyle = v; },
    get fillStyle() { return stan.fillStyle; }, set fillStyle(v) { stan.fillStyle = v; },
    get font() { return stan.font; }, set font(v) { stan.font = v; },
    fillText: (t, x, y) => slad.push({ op: 'fillText', t: String(t), x, y })
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
                 noteLines:[], apexDims:{}, hatches:[], slopes:[], callouts:[], obstacles:[],
                 proste:[], punkty:[] }`;

function nowySzkic() {
  app(`
    sketches = [{ id:1, name:'Parter', kind:'rzut', height:'2.60',
      panX:0, panY:0, zoomLevel:1, showDimensions:true, objects: ${PUSTE} }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
    autoStronaOn = true; currentMode = 'line';
  `);
}

function pokoj5x4(gr) {
  app(`
    const P = PIXELS_PER_METER, O = 400;
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 ${gr ? 'l.gr = ' + gr + ';' : ''} objects.lines.push(l); return l; };
    objects.lines = [];
    L(0,0, 5,0); L(5,0, 5,4); L(5,4, 0,4); L(0,4, 0,0);
    const face = findEnclosingFace({ x:O+2.5*P, y:O+2*P });
    objects.rooms = [{ id:1, num:'1', name:'Pokój', polygon: face, centroid: getVisualCenter(face) }];
    recalculateRooms();
  `);
}

// ===================== LICA GRUBYCH ŚCIAN =====================
console.log('--- przyciąganie do lica, nie do osi ---');
{
  nowySzkic();
  pokoj5x4(50);
  const lica = app("return licaSciany(objects.lines[0]);");
  sprawdz('gruba ściana podstawia swoje lica', lica.length >= 1, lica.length);
  sprawdz('cienka ściana nie ma osobnych lic',
    app("return licaSciany({ x1:0,y1:0,x2:100,y2:0 }).length;") === 0);

  // ściana górna pokoju: oś na y=400, mur 50 cm rośnie na zewnątrz (do góry)
  const gr = 50 / 100 * 50;      // 25 px
  const odleglosci = app(`
    return licaSciany(objects.lines[0]).map(f => Math.round((f.y1 - objects.lines[0].y1) * 100) / 100);
  `);
  sprawdz('lico jest odsunięte o pełną grubość muru',
    odleglosci.some(d => Math.abs(Math.abs(d) - gr) < 0.01), JSON.stringify(odleglosci));

  // palec tuż za murem ma trafić w lico, a nie w oś
  const snapLico = app(`
    const l = objects.lines[0];
    const f = licaSciany(l)[0];
    const s = findSnapPoint({ x: f.x1 + 100, y: f.y1 + 2 });
    return { y: Math.round(s.pt.y * 100) / 100, licoY: Math.round(f.y1 * 100) / 100,
             osY: Math.round(l.y1 * 100) / 100 };
  `);
  sprawdz('przyciąganie trafia w lico muru, nie w jego oś',
    Math.abs(snapLico.y - snapLico.licoY) < 0.5 && Math.abs(snapLico.y - snapLico.osY) > 1,
    JSON.stringify(snapLico));

  // bez grubości zachowanie zostaje jak dotąd
  nowySzkic();
  pokoj5x4(0);
  const snapOs = app(`
    const l = objects.lines[0];
    const s = findSnapPoint({ x: l.x1 + 100, y: l.y1 + 2 });
    return Math.abs(s.pt.y - l.y1) < 0.5;
  `);
  sprawdz('przy cienkiej ścianie przyciąganie działa jak dotąd', snapOs === true);
}

// ===================== STRONA MURU USTALANA SAMA =====================
console.log('--- mur rośnie tam, gdzie nie ma pomieszczenia ---');
{
  nowySzkic();
  pokoj5x4(50);
  app("ustalStronySamodzielnie();");

  // sprawdzamy wprost: po nadaniu grubości środek pasa każdej ściany
  // musi wypaść POZA pomieszczeniem
  const naZewnatrz = app(`
    return objects.lines.every(l => {
      const n = normalnaSciany(l);
      const o = wallBandOffsetPx(l);
      const sx = (l.x1 + l.x2) / 2 + n.nx * o;
      const sy = (l.y1 + l.y2) / 2 + n.ny * o;
      return !innerFaces().some(f => pointInPolygon({ x:sx, y:sy }, f));
    });
  `);
  sprawdz('mur każdej ściany zewnętrznej wypada poza pomieszczeniem', naZewnatrz === true);

  sprawdz('powierzchnia pomieszczenia nie zmienia się od nadania grubości',
    app("recalculateRooms(); return polygonSignedArea(objects.rooms[0].polygon) / (PIXELS_PER_METER*PIXELS_PER_METER);") > 19.9,
    app("return polygonSignedArea(objects.rooms[0].polygon) / (PIXELS_PER_METER*PIXELS_PER_METER);"));

  // ściana wewnętrzna: pomieszczenia po obu stronach -> mur po osi
  nowySzkic();
  app(`
    const P = PIXELS_PER_METER, O = 400;
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 l.gr = 12; objects.lines.push(l); return l; };
    objects.lines = [];
    L(0,0, 6,0); L(6,0, 6,4); L(6,4, 0,4); L(0,4, 0,0);
    const dzialowa = L(3,0, 3,4);
    ustalStronySamodzielnie();
    return dzialowa.str;
  `);
  sprawdz('ścianka działowa dostaje mur po osi',
    app("return objects.lines[4].str === undefined;") === true,
    app("return objects.lines[4].str;"));
  sprawdz('ścianka działowa jest rozpoznana jako wewnętrzna',
    app("return rodzajSciany(objects.lines[4]).rodzaj;") === 'wewnetrzna');
  sprawdz('ściana obwodowa jest rozpoznana jako zewnętrzna',
    app("return rodzajSciany(objects.lines[0]).rodzaj;") === 'zewnetrzna');

  // ręczny wybór nie może być nadpisywany
  app(`
    objects.lines[0].str = 'prawa';
    objects.lines[0].strRecznie = true;
    ustalStronySamodzielnie();
  `);
  sprawdz('ręcznie wybrana strona nie jest nadpisywana',
    app("return objects.lines[0].str;") === 'prawa');

  app("delete objects.lines[0].strRecznie; ustalStronySamodzielnie();");
  sprawdz('po zdjęciu blokady program ustala stronę sam',
    app("return objects.lines[0].str;") !== 'prawa', app("return objects.lines[0].str;"));

  // przełącznik
  sprawdz('tryb automatyczny jest domyślnie włączony', app("return autoStronaOn;") === true);
  app("toggleAutoStrona();");
  sprawdz('tryb da się wyłączyć', app("return autoStronaOn;") === false);
  sprawdz('przy wyłączonym trybie strony nie są przeliczane',
    app("return przeliczStrony();") === 0);
  app("toggleAutoStrona();");
}

// ===================== PUNKT ODNIESIENIA =====================
console.log('--- punkt w zadanej odległości ---');
{
  nowySzkic();
  app(`
    objects.lines = [{ x1:400, y1:400, x2:700, y2:400 }];
    objects.openings = [{ x:550, y:400, angle:0, id:'O1', width:100, height:140, typ:'okno' }];
    objects.punkty = [];
  `);

  const bazy = app("return punktyOdniesienia().length;");
  sprawdz('narożniki i otwory są punktami odniesienia', bazy >= 5, bazy);
  sprawdz('krawędzie okna też można wskazać',
    app("return punktyOdniesienia().some(p => Math.abs(p.x - 525) < 0.5 && p.opis.indexOf('krawędź') === 0);") === true);

  sprawdz('kliknięcie przy narożniku znajduje punkt odniesienia',
    app("const b = najblizszyPunktOdniesienia({ x:404, y:403 }); return b && Math.round(b.x);") === 400);
  sprawdz('kliknięcie w pustce nie znajduje niczego',
    app("return najblizszyPunktOdniesienia({ x:2000, y:2000 });") === null);

  // 215 cm od lewego narożnika wzdłuż ściany
  app(`
    openPunktDialog({ x:400, y:400, opis:'narożnik' }, objects.lines[0]);
    document.getElementById('punktDist').value = '215';
    document.getElementById('punktKierunek').value = 'wzdluz';
    document.getElementById('punktOpis').value = 'oś ścianki';
    savePunkt();
  `);
  sprawdz('punkt powstaje', app("return objects.punkty.length;") === 1);
  sprawdz('punkt stoi dokładnie 2,15 m od narożnika',
    Math.abs(app("return objects.punkty[0].x;") - (400 + 2.15 * 50)) < 0.01,
    app("return objects.punkty[0].x;"));
  sprawdz('punkt zostaje na osi ściany',
    Math.abs(app("return objects.punkty[0].y;") - 400) < 0.01);
  sprawdz('punkt pamięta opis', app("return objects.punkty[0].opis;") === 'oś ścianki');
  sprawdz('punkt pamięta, od czego był mierzony',
    app("return Math.round(objects.punkty[0].baza.x);") === 400);

  // punkt jest punktem przyciągania - po to powstał
  sprawdz('nowa ściana przyciąga się do postawionego punktu',
    app(`const s = findSnapPoint({ x: 400 + 2.15*50 + 3, y: 402 });
         return Math.abs(s.pt.x - (400 + 2.15*50)) < 4;`) === true);
  sprawdz('postawiony punkt sam staje się punktem odniesienia',
    app("return punktyOdniesienia().some(p => p.opis === 'oś ścianki');") === true);

  // kierunki prostopadłe
  app(`
    objects.punkty = [];
    openPunktDialog({ x:400, y:400, opis:'narożnik' }, null);
    document.getElementById('punktDist').value = '100';
    document.getElementById('punktKierunek').value = 'dol';
    savePunkt();
  `);
  sprawdz('kierunek „w dół" przesuwa punkt w dół',
    Math.abs(app("return objects.punkty[0].y;") - (400 + 50)) < 0.01 &&
    Math.abs(app("return objects.punkty[0].x;") - 400) < 0.01,
    JSON.stringify(app("return objects.punkty[0];")));

  // odległość bez sensu jest odrzucana
  app(`
    window.__alert = null;
    openPunktDialog({ x:400, y:400 }, null);
    document.getElementById('punktDist').value = '';
    savePunkt();
  `);
  sprawdz('pusta odległość nie tworzy punktu', app("return objects.punkty.length;") === 1);
  sprawdz('program tłumaczy, czego oczekuje',
    (dom.window.__alert || '').indexOf('centymetrach') > -1, dom.window.__alert);
  app("closePunktDialog();");

  // usuwanie
  sprawdz('kliknięcie w punkt go znajduje',
    app("return findPunktAt({ x: objects.punkty[0].x + 2, y: objects.punkty[0].y });") === 0);
  app("openPunktDialog(objects.punkty[0].baza, null, 0); deletePunkt();");
  sprawdz('punkt da się usunąć', app("return objects.punkty.length;") === 0);

  // punkt nie jest ścianą
  nowySzkic();
  pokoj5x4(0);
  const przed = app("return polygonSignedArea(objects.rooms[0].polygon);");
  app("objects.punkty = [{ x:500, y:500, dyst:100, kierunek:'prawo', opis:'X' }]; recalculateRooms();");
  sprawdz('punkt nie zmienia powierzchni pomieszczenia',
    Math.abs(app("return polygonSignedArea(objects.rooms[0].polygon);") - przed) < 0.01);
  sprawdz('punkt nie trafia do zestawienia ścian',
    app("return objects.lines.length;") === 4);
  sprawdz('rysowanie z punktami nie wywraca płótna',
    app("renderCanvasNow(); return objects.punkty.length;") === 1);

  // zapis i odczyt
  const paczka = app("return JSON.stringify(projectPayload());");
  sprawdz('punkty trafiają do pliku projektu',
    JSON.parse(paczka).sketches[0].objects.punkty.length === 1);
  app(`sketches = []; applyProjectData(${paczka});`);
  sprawdz('punkty wracają z pliku', app("return sketches[0].objects.punkty[0].opis;") === 'X');
  sprawdz('stary projekt bez punktów dostaje pustą tablicę',
    app(`applyProjectData({ format:'szkicownik', sketches:[{ id:9, name:'S', objects:{ lines:[] } }] });
         return Array.isArray(objects.punkty) && objects.punkty.length === 0;`) === true);
}

// ===================== PRZEGRODY =====================
console.log('--- oznaczenia przegród ---');
{
  nowySzkic();
  pokoj5x4(50);
  sprawdz('rodzaje przegród mają nazwy',
    app("return PRZEGRODY.every(p => p.pref && p.nazwa);") === true);
  sprawdz('SZ1 to ściana zewnętrzna',
    app("return przegrodaNazwa('SZ1');") === 'Ściana zewnętrzna');
  sprawdz('SW2 to ściana wewnętrzna',
    app("return przegrodaNazwa('SW2');") === 'Ściana wewnętrzna');
  sprawdz('nieznane oznaczenie ma nazwę zastępczą',
    app("return przegrodaNazwa('XYZ');") === 'Przegroda');

  sprawdz('pierwsza przegroda dostaje numer 1',
    app("return nastepnaPrzegroda('SZ');") === 'SZ1');
  app("objects.lines[0].przegroda = 'SZ1'; objects.lines[1].przegroda = 'SZ1';");
  sprawdz('kolejna przegroda dostaje następny numer',
    app("return nastepnaPrzegroda('SZ');") === 'SZ2');
  sprawdz('numeracja ścian wewnętrznych jest osobna',
    app("return nastepnaPrzegroda('SW');") === 'SW1');

  // zestawienie
  const zest = app("return zestawieniePrzegrod(sketches[0]);");
  sprawdz('zestawienie grupuje ściany po oznaczeniu', zest.length === 1, JSON.stringify(zest));
  sprawdz('zestawienie liczy, ile ścian ma dane oznaczenie', zest[0].ile === 2, zest[0].ile);
  sprawdz('zestawienie sumuje długość ścian',
    Math.abs(zest[0].dlugosc - 9) < 0.01, zest[0].dlugosc);
  sprawdz('zestawienie niesie grubość przegrody', zest[0].gr === 50, zest[0].gr);
  sprawdz('ta sama przegroda może być na wielu ścianach', zest[0].tag === 'SZ1');

  // ta sama przegroda na ścianach o różnej grubości - zestawienie ma to znieść
  app("objects.lines[2].przegroda = 'SW1'; objects.lines[2].gr = 12;");
  sprawdz('różne przegrody są rozdzielone w zestawieniu',
    app("return zestawieniePrzegrod(sketches[0]).length;") === 2);

  // oznaczenie zapisuje się z okna ściany
  app(`
    openThickDialog(3);
    document.getElementById('thickInput').value = '38';
    document.getElementById('thickPrzegroda').value = 'sz3';
    applyThickness();
  `);
  sprawdz('oznaczenie zapisuje się przy ścianie',
    app("return objects.lines[3].przegroda;") === 'SZ3',
    app("return objects.lines[3].przegroda;"));
  sprawdz('oznaczenie jest zapisywane wielkimi literami',
    app("return objects.lines[3].przegroda;") === app("return objects.lines[3].przegroda.toUpperCase();"));

  app(`
    openThickDialog(3);
    document.getElementById('thickPrzegroda').value = '';
    applyThickness();
  `);
  sprawdz('puste oznaczenie usuwa pole ze ściany',
    app("return objects.lines[3].przegroda === undefined;") === true);

  // podpowiedź numeru
  app("openThickDialog(0); podpowiedzPrzegrode('SW');");
  sprawdz('przycisk podpowiada wolny numer',
    doc.getElementById('thickPrzegroda').value === 'SW2',
    doc.getElementById('thickPrzegroda').value);
  app("closeThickDialog();");

  // oznaczenie nie zmienia liczb
  const poleP = app("recalculateRooms(); return polygonSignedArea(objects.rooms[0].polygon);");
  app("objects.lines.forEach(l => l.przegroda = 'SZ9'); recalculateRooms();");
  sprawdz('oznaczenie przegrody nie zmienia powierzchni',
    Math.abs(app("return polygonSignedArea(objects.rooms[0].polygon);") - poleP) < 0.01);

  // oznaczenia widać na szkicu razem z oznaczeniami ścian
  app("showWallLabels = true;");
  slad.length = 0;
  app("renderCanvasNow();");
  sprawdz('oznaczenia przegród widać na szkicu',
    slad.some(s => s.op === 'fillText' && s.t === 'SZ9'), JSON.stringify(slad.map(s => s.t).slice(0, 8)));
  app("showWallLabels = false;");
  slad.length = 0;
  app("renderCanvasNow();");
  sprawdz('przy wyłączonych oznaczeniach ścian przegrody też znikają',
    !slad.some(s => s.op === 'fillText' && s.t === 'SZ9'));

  // zapis i odczyt
  const paczka2 = app("return JSON.stringify(projectPayload());");
  app(`sketches = []; applyProjectData(${paczka2});`);
  sprawdz('oznaczenie przegrody wraca z pliku',
    app("return sketches[0].objects.lines[0].przegroda;") === 'SZ9');
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
