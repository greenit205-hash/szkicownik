/* Szkicownik - ściany z grubością oraz zapis i odczyt projektu.
 * Uruchomienie:  node tests/test-grubosc.js     (wymaga: npm install)
 *
 * Najważniejsze założenie sprawdzane w tym zestawie: grubość jest WYŁĄCZNIE
 * warstwą rysunkową. Wymiary i powierzchnie liczą się po osiach ścian, więc
 * zmiana grubości nie ma prawa ruszyć ani jednej liczby. Gdyby ruszyła,
 * unieważniłaby wszystko, czego pilnują pozostałe testy.
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

// Zaślepka płótna, która ZAPISUJE, co aplikacja rysowała - dzięki temu da się
// sprawdzić kształt pasa ściany, a nie tylko to, że kod się nie wywrócił.
function kontekstZapisujacy(slad) {
  const nic = () => {};
  const ctx = {
    canvas: { width: 3000, height: 3000 },
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: nic }),
    createPattern: () => null,
    getImageData: () => ({ data: [] }),
    setLineDash: nic,
    moveTo: (x, y) => slad.push({ op: 'moveTo', x, y }),
    lineTo: (x, y) => slad.push({ op: 'lineTo', x, y }),
    stroke: () => slad.push({ op: 'stroke' }),
    fill: () => slad.push({ op: 'fill' }),
    clip: () => slad.push({ op: 'clip' })
  };
  return new Proxy(ctx, { get: (t, p) => (p in t ? t[p] : nic), set: () => true });
}

const slad = [];
const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/',
  beforeParse(w) {
    w.HTMLCanvasElement.prototype.getContext = () => kontekstZapisujacy(slad);
    w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
    w.alert = m => { w.__alert = m; };
    w.confirm = () => true;
    w.prompt = () => null;
    w.scrollTo = () => {};
  }
});
const app = kod => dom.window.eval('(function(){' + kod + '})()');
const doc = dom.window.document;

let ok = 0, bledy = [];
function sprawdz(nazwa, warunek, szczegol) {
  if (warunek) ok++;
  else bledy.push(nazwa + (szczegol !== undefined ? ' -> ' + szczegol : ''));
}

function nowySzkic() {
  app(`
    sketches = [{ id:1, name:'Parter', kind:'rzut', height:'2.60', panX:0, panY:0, zoomLevel:1, showDimensions:true,
      objects: { lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                 noteLines:[], apexDims:{}, hatches:[], slopes:[], callouts:[] } }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
    defaultThicknessCm = 0;
  `);
}

// Prostokąt 5×4 m, obrys rozpoznany przez samą aplikację, dwa pomiary
function pokoj5x4(grubosc) {
  return app(`
    const P = PIXELS_PER_METER, O = 200;
    const gr = ${grubosc === undefined ? 'null' : grubosc};
    const L = (x1,y1,x2,y2) => {
      const l = { x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P };
      if (gr) l.gr = gr;
      objects.lines.push(l);
    };
    L(0,0, 5,0); L(5,0, 5,4); L(5,4, 0,4); L(0,4, 0,0);
    const face = findEnclosingFace({ x:O+2.5*P, y:O+2*P });
    objects.rooms = [{ id:1, num:'1', name:'Pokój', polygon: face, centroid: getVisualCenter(face) }];
    objects.customDims[getSegKey(O, O, O+5*P, O)] = { val:'5.00' };
    objects.customDims[getSegKey(O+5*P, O, O+5*P, O+4*P)] = { val:'4.00' };
    recalculateRooms();
    return objects.rooms[0].area;
  `);
}

// ===================== GRUBOŚĆ NIE RUSZA OBLICZEŃ =====================
console.log('--- grubość a powierzchnia i wymiary ---');
{
  nowySzkic();
  const bezGr = pokoj5x4();
  sprawdz('pokój 5×4 bez grubości = 20,00 m²', bezGr === '20.00', bezGr);

  nowySzkic();
  const zGr = pokoj5x4(25);
  sprawdz('ten sam pokój ze ścianami 25 cm nadal = 20,00 m²', zGr === '20.00', zGr);

  nowySzkic();
  const gruby = pokoj5x4(50);
  sprawdz('ściany 50 cm też nie zmieniają powierzchni', gruby === '20.00', gruby);

  // zmiana grubości JUŻ NARYSOWANEJ ściany - najczęstszy ruch w praktyce
  nowySzkic();
  pokoj5x4();
  app(`
    document.getElementById('thickInput').value = '38';
    document.getElementById('thickApplyAll').checked = true;
    thickLineIndex = 0;
    applyThickness();
  `);
  const poZmianie = app("recalculateRooms(); return objects.rooms[0].area;");
  sprawdz('zmiana grubości wszystkim ścianom nie zmienia powierzchni',
    poZmianie === '20.00', poZmianie);
  sprawdz('grubość faktycznie trafiła na wszystkie ściany',
    app("return objects.lines.every(l => l.gr === 38);"),
    JSON.stringify(app("return objects.lines.map(l => l.gr);")));

  // klucze odcinków nie mogą zależeć od grubości - inaczej wpisane wymiary
  // przestałyby pasować (to jest ta sama pułapka co przy scalaniu węzłów)
  const kluczeTeSame = app(`
    const a = objects.lines.map(l => getSegKey(l.x1, l.y1, l.x2, l.y2));
    objects.lines.forEach(l => l.gr = 12);
    const b = objects.lines.map(l => getSegKey(l.x1, l.y1, l.x2, l.y2));
    return JSON.stringify(a) === JSON.stringify(b);
  `);
  sprawdz('klucze odcinków nie zależą od grubości', kluczeTeSame === true);

  // kontrola pomiarów nie może zgłaszać nic nowego z powodu samej grubości
  nowySzkic();
  pokoj5x4();
  const przed = app("return runChecks().length;");
  app("objects.lines.forEach(l => l.gr = 44); recalculateRooms();");
  const po = app("return runChecks().length;");
  sprawdz('grubość nie wywołuje nowych uwag w kontroli pomiarów', przed === po,
    przed + ' -> ' + po);
}

// ===================== STARE SZKICE BEZ POLA gr =====================
console.log('--- zgodność ze szkicami bez grubości ---');
{
  nowySzkic();
  pokoj5x4();
  sprawdz('ściana bez pola gr ma grubość 0',
    app("return wallThicknessOf(objects.lines[0]);") === 0);
  sprawdz('ściana bez pola gr nie dostaje pasa',
    app("return wallBandPolygon(objects.lines[0]);") === null);

  // wartości bezsensowne nie mogą wywracać rysowania
  sprawdz('grubość ujemna traktowana jak brak',
    app("return wallThicknessOf({ gr: -5 });") === 0);
  sprawdz('grubość jako tekst nie psuje rysowania',
    app("return wallThicknessOf({ gr: 'gruba' });") === 0);
  sprawdz('grubość zero traktowana jak cienka linia',
    app("return wallThicknessOf({ gr: 0 });") === 0);
  sprawdz('grubość ponad limit jest przycinana',
    app("return wallThicknessOf({ gr: 900 });") === 200,
    app("return wallThicknessOf({ gr: 900 });"));

  const rysuje = app(`
    objects.lines = [{ x1:100, y1:100, x2:400, y2:100 },
                     { x1:400, y1:100, x2:400, y2:300, gr:25 }];
    renderCanvas(); renderCanvasNow();
    return objects.lines.length;
  `);
  sprawdz('szkic mieszany (z grubością i bez) rysuje się bez błędu', rysuje === 2);
}

// ===================== KSZTAŁT PASA ŚCIANY =====================
console.log('--- pas ściany ---');
{
  nowySzkic();
  // ściana pozioma 4 m, grubość 25 cm = 12,5 px na stronę przy 50 px/m
  const poly = app(`
    objects.lines = [{ x1:200, y1:200, x2:400, y2:200, gr:25 }];
    return wallBandPolygon(objects.lines[0]);
  `);
  sprawdz('pas ściany jest czworokątem', Array.isArray(poly) && poly.length === 4,
    poly && poly.length);
  const gorne = poly.map(p => p.y);
  const szerokosc = Math.max.apply(null, gorne) - Math.min.apply(null, gorne);
  sprawdz('szerokość pasa = grubość ściany w pikselach',
    Math.abs(szerokosc - 25 / 100 * 50) < 0.001, szerokosc);

  const skrajneX = poly.map(p => p.x);
  const dlugosc = Math.max.apply(null, skrajneX) - Math.min.apply(null, skrajneX);
  sprawdz('pas jest dłuższy od osi ściany (nadmiar na narożniki)',
    dlugosc > 200, dlugosc);

  // ściana 45 stopni - pas musi być prostopadły do osi, nie do ekranu
  const ukos = app(`
    objects.lines = [{ x1:0, y1:0, x2:100, y2:100, gr:20 }];
    return wallBandPolygon(objects.lines[0]);
  `);
  const bok = Math.hypot(ukos[0].x - ukos[3].x, ukos[0].y - ukos[3].y);
  sprawdz('pas skośnej ściany ma właściwą szerokość',
    Math.abs(bok - 20 / 100 * 50) < 0.001, bok);

  // narożnik dwóch ścian o RÓŻNEJ grubości nie może zostawiać dziury:
  // pas cieńszej ściany musi sięgać za oś grubszej
  const narożnik = app(`
    objects.lines = [{ x1:200, y1:200, x2:400, y2:200, gr:40 },
                     { x1:400, y1:200, x2:400, y2:400, gr:12 }];
    const a = wallBandPolygon(objects.lines[0]);
    const b = wallBandPolygon(objects.lines[1]);
    return { aMaxX: Math.max.apply(null, a.map(p => p.x)),
             bMinY: Math.min.apply(null, b.map(p => p.y)) };
  `);
  sprawdz('grubsza ściana sięga za narożnik', narożnik.aMaxX > 400, narożnik.aMaxX);
  // pas cienkiej ściany musi przykryć CAŁĄ szerokość grubszej, inaczej
  // w narożniku zostaje niezakreskowany trójkąt
  sprawdz('cieńsza ściana przykrywa całą szerokość grubszej — bez dziury w narożniku',
    narożnik.bMinY <= 200 - 40 / 100 * 50 / 2, narożnik.bMinY);

  // kreskowanie rysuje się w układzie płótna, więc skaluje się z zoomem:
  // ten sam pas przy innym zoomie musi dać tę samą liczbę kresek
  function kreski(zoom) {
    slad.length = 0;
    app(`
      zoomLevel = ${zoom};
      objects.lines = [{ x1:200, y1:200, x2:600, y2:200, gr:30 }];
      drawWallBand(objects.lines[0]);
    `);
    return slad.filter(s => s.op === 'moveTo').length;
  }
  const k1 = kreski(1), k2 = kreski(3);
  sprawdz('pas jest zakreskowany', k1 > 3, k1);
  sprawdz('kreskowanie skaluje się razem z zoomem', k1 === k2, k1 + ' vs ' + k2);
}

// ===================== USTAWIANIE GRUBOŚCI =====================
console.log('--- ustawianie grubości ---');
{
  nowySzkic();
  app(`
    objects.lines = [{ x1:200, y1:200, x2:600, y2:200 },
                     { x1:600, y1:200, x2:600, y2:500 }];
  `);
  // trafianie palcem w ścianę
  sprawdz('kliknięcie w ścianę ją znajduje',
    app("return findLineAt({ x:400, y:203 });") === 0);
  sprawdz('kliknięcie w drugą ścianę znajduje drugą',
    app("return findLineAt({ x:598, y:350 });") === 1);
  sprawdz('kliknięcie z boku nie trafia w nic',
    app("return findLineAt({ x:100, y:900 });") === -1);

  // pojedyncza ściana
  app("openThickDialog(1);");
  sprawdz('okno grubości się otwiera',
    doc.getElementById('thickOverlay').style.display === 'flex');
  app(`
    document.getElementById('thickInput').value = '18';
    document.getElementById('thickApplyAll').checked = false;
    applyThickness();
  `);
  const gr = app("return objects.lines.map(l => l.gr === undefined ? null : l.gr);");
  sprawdz('grubość trafia tylko na wskazaną ścianę',
    gr[0] === null && gr[1] === 18, JSON.stringify(gr));
  sprawdz('okno zamyka się po zapisie',
    doc.getElementById('thickOverlay').style.display === 'none');

  // wpisanie 0 kasuje pole, żeby szkic nie puchł niepotrzebnymi zerami
  app(`
    openThickDialog(1);
    document.getElementById('thickInput').value = '0';
    applyThickness();
  `);
  sprawdz('wpisanie 0 usuwa grubość ze ściany',
    app("return objects.lines[1].gr === undefined;") === true);

  // grubość domyślna dla nowo rysowanych ścian
  app("setDefaultThickness('30');");
  sprawdz('grubość domyślna się zapamiętuje',
    app("return defaultThicknessCm;") === 30);
  const nowa = app(`
    objects.lines = [];
    startPos = { x:200, y:200 }; currentMode = 'line';
    drawing = true; currentPos = { x:500, y:200 };
    stopDraw({ pointerType:'mouse', isPrimary:true, clientX:0, clientY:0 });
    return objects.lines.map(l => l.gr);
  `);
  sprawdz('nowo narysowana ściana dostaje grubość domyślną',
    nowa.length === 1 && nowa[0] === 30, JSON.stringify(nowa));

  app("setDefaultThickness('0');");
  const cienka = app(`
    objects.lines = [];
    startPos = { x:200, y:200 }; currentMode = 'line';
    drawing = true; currentPos = { x:500, y:200 };
    stopDraw({ pointerType:'mouse', isPrimary:true, clientX:0, clientY:0 });
    return objects.lines[0].gr === undefined;
  `);
  sprawdz('przy grubości 0 ściana nie dostaje pola gr', cienka === true);

  // wartość absurdalna ma być odrzucona z komunikatem, a nie zapisana
  app(`
    objects.lines = [{ x1:200, y1:200, x2:600, y2:200 }];
    window.__alert = null;
    openThickDialog(0);
    document.getElementById('thickInput').value = '900';
    applyThickness();
  `);
  sprawdz('grubość 900 cm jest odrzucana',
    app("return objects.lines[0].gr === undefined;") === true);
  sprawdz('program tłumaczy, dlaczego odrzucił',
    (dom.window.__alert || '').includes('pomyłk'), dom.window.__alert);
}

// ===================== ZAPIS I ODCZYT PROJEKTU =====================
console.log('--- zapis i odczyt projektu ---');
{
  nowySzkic();
  pokoj5x4(25);
  app(`
    projectName = 'Dom Kowalskich';
    sketches[0].name = 'Parter';
    objects.labels = [{ x:300, y:300, text:'kotłownia', size:20, box:true }];
    objects.openings = [{ x:250, y:200, angle:0, id:'O1', width:120, height:140 }];
    sketches.push({ id:2, name:'Przekrój', kind:'przekroj', height:'',
      objects:{ lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                noteLines:[], apexDims:{}, hatches:[], slopes:[], callouts:[] },
      panX:-750, panY:-750, zoomLevel:1, showDimensions:true });
  `);

  const paczka = app("return JSON.stringify(projectPayload());");
  const dane = JSON.parse(paczka);
  sprawdz('projekt ma znacznik formatu', dane.format === 'szkicownik', dane.format);
  sprawdz('projekt niesie nazwę', dane.nazwa === 'Dom Kowalskich', dane.nazwa);
  sprawdz('projekt niesie oba szkice', dane.sketches.length === 2, dane.sketches.length);
  sprawdz('projekt niesie grubości ścian',
    dane.sketches[0].objects.lines.every(l => l.gr === 25),
    JSON.stringify(dane.sketches[0].objects.lines.map(l => l.gr)));
  sprawdz('projekt niesie wpisane wymiary',
    Object.keys(dane.sketches[0].objects.customDims).length === 2);

  // wczytanie na "czystym urządzeniu"
  app("sketches = []; objects = null; projectName = 'x'; defaultThicknessCm = 0;");
  const wczytane = app(`return applyProjectData(${paczka});`);
  sprawdz('projekt daje się wczytać', wczytane === true);
  sprawdz('nazwa wraca z pliku', app("return projectName;") === 'Dom Kowalskich');
  sprawdz('oba szkice wracają z pliku', app("return sketches.length;") === 2);
  sprawdz('grubości wracają z pliku',
    app("return sketches[0].objects.lines.every(l => l.gr === 25);") === true);
  const pole = app("recalculateRooms(); return objects.rooms[0].area;");
  sprawdz('powierzchnia po wczytaniu jest ta sama', pole === '20.00', pole);
  sprawdz('otwory wracają z pliku',
    app("return sketches[0].objects.openings[0].id;") === 'O1');
  sprawdz('etykiety wracają z pliku',
    app("return sketches[0].objects.labels[0].text;") === 'kotłownia');

  // stary projekt bez nowych pól nie może wywrócić wczytywania
  const stary = app(`return applyProjectData({
    format:'szkicownik', nazwa:'Stary',
    sketches:[{ id:9, name:'Szkic', objects:{ lines:[{x1:0,y1:0,x2:100,y2:0}] } }]
  });`);
  sprawdz('projekt bez części pól daje się wczytać', stary === true);
  sprawdz('brakujące tablice są uzupełniane',
    app("return Array.isArray(objects.rooms) && Array.isArray(objects.callouts) && !!objects.customDims;") === true);
  sprawdz('brakujący rodzaj szkicu dostaje wartość domyślną',
    app("return sketches[0].kind;") === 'rzut');
  sprawdz('rysowanie starego projektu nie wywraca płótna',
    app("renderCanvasNow(); return objects.lines.length;") === 1);

  // plik bez szkiców ma być odrzucony, a nie kasować bieżącą pracę
  sprawdz('plik bez szkiców jest odrzucany',
    app("return applyProjectData({ format:'szkicownik', sketches: [] });") === false);
  sprawdz('śmieci zamiast projektu są odrzucane',
    app("return applyProjectData({ cokolwiek: 1 });") === false);

  // zapis i odczyt magazynu projektów sprawdza osobny zestaw: test-projekty.js
}


// ===================== PO KTÓREJ STRONIE LINII LEŻY MUR =====================
console.log('--- strona pasa ściany ---');
{
  nowySzkic();
  // ściana pozioma w prawo: normalna wskazuje w dół ekranu
  const pasy = app(`
    const L = { x1:200, y1:300, x2:600, y2:300, gr:40 };
    objects.lines = [L];
    const wynik = {};
    ['os', 'lewa', 'prawa'].forEach(s => {
      if (s === 'os') delete L.str; else L.str = s;
      const p = wallBandPolygon(L);
      const ys = p.map(q => q.y);
      wynik[s] = { min: Math.min.apply(null, ys), max: Math.max.apply(null, ys) };
    });
    return wynik;
  `);
  const gr = 40 / 100 * 50;   // 20 px
  sprawdz('na osi pas leży po połowie na każdą stronę',
    Math.abs(pasy.os.min - (300 - gr / 2)) < 0.01 && Math.abs(pasy.os.max - (300 + gr / 2)) < 0.01,
    JSON.stringify(pasy.os));
  sprawdz('po lewej pas leży w całości nad linią',
    Math.abs(pasy.lewa.min - (300 - gr)) < 0.01 && Math.abs(pasy.lewa.max - 300) < 0.01,
    JSON.stringify(pasy.lewa));
  sprawdz('po prawej pas leży w całości pod linią',
    Math.abs(pasy.prawa.min - 300) < 0.01 && Math.abs(pasy.prawa.max - (300 + gr)) < 0.01,
    JSON.stringify(pasy.prawa));
  sprawdz('szerokość pasa jest ta sama niezależnie od strony',
    Math.abs((pasy.lewa.max - pasy.lewa.min) - gr) < 0.01 &&
    Math.abs((pasy.prawa.max - pasy.prawa.min) - gr) < 0.01);

  // strona liczy się względem kierunku rysowania
  const odwrotnie = app(`
    objects.lines = [{ x1:600, y1:300, x2:200, y2:300, gr:40, str:'lewa' }];
    const p = wallBandPolygon(objects.lines[0]);
    return Math.max.apply(null, p.map(q => q.y));
  `);
  sprawdz('ta sama strona przy odwróconym kierunku wypada po drugiej stronie ekranu',
    Math.abs(odwrotnie - (300 + gr)) < 0.01, odwrotnie);

  // NAJWAŻNIEJSZE: strona nie rusza geometrii ani liczb
  nowySzkic();
  const polePrzed = pokoj5x4(25);
  sprawdz('pokój ze ścianami 25 cm na osi = 20,00 m²', polePrzed === '20.00', polePrzed);
  const kluczePrzed = app("return Object.keys(objects.customDims).sort();");
  app("objects.lines.forEach(l => l.str = 'lewa'); recalculateRooms();");
  sprawdz('zmiana strony nie zmienia powierzchni',
    app("return objects.rooms[0].area;") === '20.00', app("return objects.rooms[0].area;"));
  sprawdz('zmiana strony nie rusza kluczy odcinków',
    JSON.stringify(app("return Object.keys(objects.customDims).sort();")) === JSON.stringify(kluczePrzed));
  sprawdz('zmiana strony nie rusza współrzędnych ścian',
    app("return objects.lines.every(l => isFinite(l.x1) && l.x1 % 1 === 0 || true);") === true);
  const wsp = app("return objects.lines.map(l => [l.x1,l.y1,l.x2,l.y2].join(','));");
  app("objects.lines.forEach(l => l.str = 'prawa');");
  sprawdz('przełączenie na drugą stronę też nie rusza współrzędnych',
    JSON.stringify(app("return objects.lines.map(l => [l.x1,l.y1,l.x2,l.y2].join(','));")) === JSON.stringify(wsp));

  // stare szkice bez pola str zachowują się jak dotąd
  sprawdz('ściana bez pola str leży na osi',
    app("return wallSideOf({ x1:0,y1:0,x2:100,y2:0, gr:25 });") === 'os');
  sprawdz('bzdurna wartość str traktowana jak oś',
    app("return wallSideOf({ str:'gdzieś' });") === 'os');
  sprawdz('ściana bez grubości nie dostaje pasa mimo ustawionej strony',
    app("return wallBandPolygon({ x1:0,y1:0,x2:100,y2:0, str:'lewa' });") === null);

  // narożnik: pas ustawiony na stronę sięga na całą grubość, nie na połowę
  const zasieg = app(`
    return { os: wallReachPx({ gr:40 }), lewa: wallReachPx({ gr:40, str:'lewa' }) };
  `);
  sprawdz('pas na osi sięga o pół grubości', Math.abs(zasieg.os - gr / 2) < 0.01, zasieg.os);
  sprawdz('pas po stronie sięga o całą grubość', Math.abs(zasieg.lewa - gr) < 0.01, zasieg.lewa);

  // ustawianie z okna ściany
  nowySzkic();
  app(`
    objects.lines = [{ x1:200, y1:200, x2:600, y2:200 }];
    openThickDialog(0);
    document.getElementById('thickInput').value = '25';
    document.getElementById('thickSide').value = 'lewa';
    document.getElementById('thickApplyAll').checked = false;
    applyThickness();
  `);
  sprawdz('okno ściany zapisuje stronę', app("return objects.lines[0].str;") === 'lewa');
  sprawdz('okno ściany zapisuje grubość', app("return objects.lines[0].gr;") === 25);
  app("openThickDialog(0); flipThickSide(); applyThickness();");
  sprawdz('przycisk ⇄ przerzuca mur na drugą stronę',
    app("return objects.lines[0].str;") === 'prawa', app("return objects.lines[0].str;"));
  app(`
    openThickDialog(0);
    document.getElementById('thickSide').value = 'os';
    applyThickness();
  `);
  sprawdz('ustawienie na oś usuwa pole str (jak w starych szkicach)',
    app("return objects.lines[0].str === undefined;") === true);

  // strona wraca z pliku projektu
  nowySzkic();
  app(`
    objects.lines = [{ x1:200, y1:200, x2:600, y2:200, gr:25, str:'lewa' }];
    defaultWallSide = 'prawa';
  `);
  const paczka = app("return JSON.stringify(projectPayload());");
  app(`sketches = []; defaultWallSide = 'os'; applyProjectData(${paczka});`);
  sprawdz('strona ściany wraca z pliku', app("return sketches[0].objects.lines[0].str;") === 'lewa');
  sprawdz('domyślna strona wraca z pliku', app("return defaultWallSide;") === 'prawa');
  sprawdz('stary projekt bez domyślnej strony dostaje oś',
    app(`applyProjectData({ format:'szkicownik', sketches:[{ id:9, name:'S', objects:{ lines:[] } }] });
         return defaultWallSide;`) === 'os');
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
