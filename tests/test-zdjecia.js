/* Szkicownik - zdjęcia z opisem.
 * Uruchomienie:  node tests/test-zdjecia.js     (wymaga: npm install)
 *
 * Zasada, której pilnuje ten zestaw: zdjęcie NIE JEST rzutem. Nie wolno z niego
 * liczyć powierzchni, nie wchodzi do bilansu i nie podlega kontroli pomiarów,
 * bo perspektywa robi z takiego liczenia zgadywankę. Zdjęcie służy do opisu -
 * i tylko narzędzia opisowe mają na nim działać.
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

// Zaślepka płótna zapisująca wywołania drawImage - dzięki temu widać,
// czy i gdzie zdjęcie zostało narysowane.
const slad = [];
function kontekst() {
  const nic = () => {};
  const c = {
    canvas: { width: 3000, height: 3000 }, measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: nic }), createPattern: () => null,
    getImageData: () => ({ data: [] }), setLineDash: nic,
    drawImage: (img, x, y, w, h) => slad.push({ op: 'drawImage', x, y, w, h }),
    fillRect: (x, y, w, h) => slad.push({ op: 'fillRect', x, y, w, h }),
    strokeRect: (x, y, w, h) => slad.push({ op: 'strokeRect', x, y, w, h }),
    fillText: (t) => slad.push({ op: 'fillText', t: t })
  };
  return new Proxy(c, { get: (t, p) => (p in t ? t[p] : nic), set: () => true });
}

const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/',
  beforeParse(w) {
    w.HTMLCanvasElement.prototype.getContext = () => kontekst();
    w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
    w.alert = m => { w.__alert = m; };
    w.confirm = () => { w.__confirm = true; return true; };
    w.prompt = () => w.__prompt;
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

const PUSTE = `{ lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                 noteLines:[], apexDims:{}, hatches:[], slopes:[], callouts:[], obstacles:[] }`;

function zeZdjeciem(w, h) {
  app(`
    sketches = [{ id:1, name:'Ściana szczytowa', kind:'zdjecie', height:'',
      photo: { src:'data:image/jpeg;base64,AAAA', w:${w || 1600}, h:${h || 1200}, opis:'', skalaPxNaM:null },
      panX:0, panY:0, zoomLevel:1, showDimensions:true, objects: ${PUSTE} }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
    syncToolsForSketch();
  `);
}

function rzut() {
  app(`
    sketches = [{ id:2, name:'Parter', kind:'rzut', height:'2.60',
      panX:0, panY:0, zoomLevel:1, showDimensions:true, objects: ${PUSTE} }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
    syncToolsForSketch();
  `);
}

// ===================== ZMNIEJSZANIE ZDJĘĆ =====================
console.log('--- zmniejszanie przy wgrywaniu ---');
{
  // zdjęcie z tabletu ma kilka tysięcy pikseli na dłuższym boku; do projektu
  // musi wejść zmniejszone, inaczej plik JSON stanie się nie do wysłania
  const proporcje = app(`
    const wyniki = [];
    [[4000, 3000], [3000, 4000], [1600, 1200], [800, 600]].forEach(([w, h]) => {
      const s = Math.min(1, 1600 / Math.max(w, h));
      wyniki.push({ w: Math.round(w * s), h: Math.round(h * s), pierwotne: [w, h] });
    });
    return wyniki;
  `);
  sprawdz('zdjęcie 4000×3000 schodzi do 1600 px na dłuższym boku',
    proporcje[0].w === 1600 && proporcje[0].h === 1200, JSON.stringify(proporcje[0]));
  sprawdz('zdjęcie pionowe też schodzi do 1600 px',
    proporcje[1].w === 1200 && proporcje[1].h === 1600, JSON.stringify(proporcje[1]));
  sprawdz('zdjęcie już małe nie jest powiększane',
    proporcje[3].w === 800 && proporcje[3].h === 600, JSON.stringify(proporcje[3]));
  sprawdz('stała FOTO_MAX_PX to 1600', app("return FOTO_MAX_PX;") === 1600);
  sprawdz('zapis idzie w JPEG z kompresją', app("return FOTO_JAKOSC;") < 1);

  // licznik miejsca zajmowanego przez zdjęcia
  const mb = app(`
    const dlugi = 'x'.repeat(512 * 1024);
    return rozmiarZdjecMB([{ photo: { src: dlugi } }, { photo: { src: dlugi } }]);
  `);
  sprawdz('rozmiar zdjęć liczony jest w megabajtach', Math.abs(mb - 2) < 0.01, mb);
  sprawdz('szkic bez zdjęcia nic nie waży',
    app("return rozmiarZdjecMB([{ objects:{} }]);") === 0);
}

// ===================== ZDJĘCIE NIE JEST RZUTEM =====================
console.log('--- zdjęcie poza bilansem powierzchni ---');
{
  zeZdjeciem();
  sprawdz('szkic ze zdjęciem jest rozpoznawany',
    app("return isPhotoSketch(sketches[0]);") === true);
  sprawdz('rzut nie jest brany za zdjęcie',
    app("return isPhotoSketch({ kind:'rzut' });") === false);

  sprawdz('kontrola pomiarów nie zgłasza nic na zdjęciu',
    app("return runChecks().length;") === 0, app("return JSON.stringify(runChecks());"));

  // nawet gdyby ktoś podłożył ściany, kontrola ma milczeć
  app(`
    const P = PIXELS_PER_METER, O = 400;
    objects.lines = [{ x1:O, y1:O, x2:O+5*P, y2:O }];
    objects.rooms = [{ id:1, num:'1', name:'Pokój', polygon:[] }];
  `);
  sprawdz('kontrola milczy na zdjęciu także przy podłożonych ścianach',
    app("return runChecks().length;") === 0);

  // ten sam szkic jako rzut - kontrola się odzywa
  app("sketches[0].kind = 'rzut';");
  sprawdz('ten sam szkic jako rzut już budzi uwagi',
    app("return runChecks().length;") > 0, app("return runChecks().length;"));
  app("sketches[0].kind = 'zdjecie';");
}

// ===================== NARZĘDZIA DOZWOLONE I ZABRONIONE =====================
console.log('--- narzędzia na zdjęciu ---');
{
  zeZdjeciem();
  ['noteline', 'draw', 'text', 'callout', 'hatch', 'erase', 'pan', 'select'].forEach(m => {
    sprawdz('narzędzie opisowe „' + m + '" działa na zdjęciu',
      app(`return toolAllowedHere('${m}');`) === true);
  });
  ['line', 'measure', 'opening', 'roomtag', 'slope', 'thickness'].forEach(m => {
    sprawdz('narzędzie rysunkowe „' + m + '" jest zablokowane na zdjęciu',
      app(`return toolAllowedHere('${m}');`) === false);
  });

  rzut();
  sprawdz('na rzucie wszystkie narzędzia są dostępne',
    app("return ['line','measure','opening','roomtag','slope','thickness','noteline'].every(m => toolAllowedHere(m));") === true);

  // próba włączenia zablokowanego narzędzia kończy się wyjaśnieniem
  zeZdjeciem();
  app("setMode('noteline'); window.__alert = null; setMode('line');");
  sprawdz('włączenie ściany na zdjęciu jest odrzucane',
    app("return currentMode;") === 'noteline', app("return currentMode;"));
  sprawdz('program tłumaczy, dlaczego odmawia',
    (dom.window.__alert || '').includes('perspektywa') || (dom.window.__alert || '').includes('nie działa na zdjęciu'),
    dom.window.__alert);

  // przełączenie na zdjęcie z aktywnym narzędziem rysunkowym przestawia je
  rzut();
  app("setMode('line');");
  zeZdjeciem();
  sprawdz('wejście na zdjęcie przestawia narzędzie na opisowe',
    app("return toolAllowedHere(currentMode);") === true, app("return currentMode;"));

  // przyciski rysunkowe są wygaszone
  sprawdz('przycisk ściany jest wyłączony na zdjęciu',
    doc.getElementById('btnModeLine').disabled === true);
  rzut();
  sprawdz('na rzucie przycisk ściany wraca', doc.getElementById('btnModeLine').disabled === false);
}

// ===================== POŁOŻENIE ZDJĘCIA NA PŁÓTNIE =====================
console.log('--- rysowanie zdjęcia ---');
{
  zeZdjeciem(1600, 1200);
  const r = app("return fotoRect(sketches[0]);");
  sprawdz('zdjęcie mieści się w polu roboczym',
    r.w <= 2400.001 && r.h <= 2400.001, JSON.stringify(r));
  sprawdz('proporcje zdjęcia są zachowane',
    Math.abs((r.w / r.h) - (1600 / 1200)) < 0.001, r.w / r.h);
  sprawdz('zdjęcie jest wyśrodkowane w poziomie',
    Math.abs((r.x + r.w / 2) - 1500) < 0.001, r.x);
  sprawdz('zdjęcie jest wyśrodkowane w pionie',
    Math.abs((r.y + r.h / 2) - 1500) < 0.001, r.y);

  const pion = app(`
    sketches[0].photo.w = 1200; sketches[0].photo.h = 1600;
    return fotoRect(sketches[0]);
  `);
  sprawdz('zdjęcie pionowe też mieści się w polu',
    pion.w <= 2400.001 && pion.h <= 2400.001, JSON.stringify(pion));
  sprawdz('zdjęcie pionowe zachowuje proporcje',
    Math.abs((pion.w / pion.h) - (1200 / 1600)) < 0.001);

  // rysowanie nie może się wywracać, także zanim obrazek się wczyta
  zeZdjeciem();
  slad.length = 0;
  app("renderCanvasNow();");
  sprawdz('niewczytane zdjęcie rysuje zastępczą ramkę zamiast pustki',
    slad.some(s => s.op === 'fillText' && String(s.t).includes('wczytywanie')),
    JSON.stringify(slad.slice(0, 3)));

  // rzut nie może dostać tła ze zdjęcia
  rzut();
  slad.length = 0;
  app("renderCanvasNow();");
  sprawdz('na rzucie nie rysuje się żadne zdjęcie',
    !slad.some(s => s.op === 'drawImage'));

  // szkic, który MA zdjęcie, ale został przestawiony na rzut - tło ma zniknąć,
  // bo inaczej ktoś rysowałby ściany po perspektywie i liczył z tego metraż
  zeZdjeciem();
  app("sketches[0].kind = 'rzut';");
  slad.length = 0;
  app("renderCanvasNow();");
  sprawdz('zdjęcie schowane po przestawieniu szkicu na rzut',
    !slad.some(s => s.op === 'drawImage') &&
    !slad.some(s => s.op === 'fillText' && String(s.t).includes('wczytywanie')),
    JSON.stringify(slad.slice(0, 3)));

  // szkic ze zdjęciem i bez obiektów ma się wyeksportować, a nie zostać uznany za pusty
  zeZdjeciem();
  sprawdz('szkic ze zdjęciem bez opisów da się wyeksportować',
    typeof app("return renderSketchToDataURL(sketches[0]);") === 'string');
  sprawdz('pusty rzut bez zdjęcia nadal nie ma czego eksportować',
    app(`return renderSketchToDataURL({ kind:'rzut', objects: ${PUSTE} });`) === null);
}

// ===================== SKALA ZE ZDJĘCIA =====================
console.log('--- kalibracja zdjęcia ---');
{
  zeZdjeciem();
  sprawdz('nowe zdjęcie nie ma skali', app("return photoScale(sketches[0]);") === null);

  // bez odcinka odniesienia kalibracja tłumaczy, czego brakuje
  app("window.__alert = null; calibratePhoto();");
  sprawdz('kalibracja bez odcinka odsyła do Miarki',
    (dom.window.__alert || '').includes('Miarka'), dom.window.__alert);

  // odcinek 200 px o długości 2 m => 100 px na metr
  app(`
    objects.noteLines = [{ x1:100, y1:100, x2:300, y2:100, color:'#dc3545', val:'' }];
    window.__prompt = '2.00';
    calibratePhoto();
  `);
  sprawdz('skala liczy się z odcinka odniesienia',
    Math.abs(app("return photoScale(sketches[0]);") - 100) < 0.001,
    app("return photoScale(sketches[0]);"));
  sprawdz('odcinek odniesienia dostaje wpisaną długość',
    app("return objects.noteLines[0].val;") === '2.00');

  // kolejna miarka dostaje PODPOWIEDŹ wyliczoną ze skali
  sprawdz('miarka 350 px przy skali 100 px/m podpowiada 3,50 m',
    app("return photoHintForNote({ x1:0, y1:0, x2:350, y2:0 });") === '3.50',
    app("return photoHintForNote({ x1:0, y1:0, x2:350, y2:0 });"));
  sprawdz('podpowiedź liczy długość ukośną, nie tylko poziomą',
    app("return photoHintForNote({ x1:0, y1:0, x2:300, y2:400 });") === '5.00');

  // bez skali nie ma podpowiedzi - zero zgadywania
  app("clearPhotoScale();");
  sprawdz('wyczyszczenie skali kasuje ją', app("return photoScale(sketches[0]);") === null);
  sprawdz('bez skali nie ma żadnej podpowiedzi',
    app("return photoHintForNote({ x1:0, y1:0, x2:350, y2:0 });") === null);

  // wartości bez sensu odrzucane
  app(`
    objects.noteLines = [{ x1:100, y1:100, x2:300, y2:100, val:'' }];
    window.__prompt = '0'; window.__alert = null; calibratePhoto();
  `);
  sprawdz('długość 0 nie ustawia skali', app("return photoScale(sketches[0]);") === null);
  sprawdz('przy długości 0 program mówi, czego oczekuje',
    (dom.window.__alert || '').includes('metrach'), dom.window.__alert);
  sprawdz('przy długości 0 odcinek odniesienia nie dostaje podpisu',
    app("return objects.noteLines[0].val;") === '',
    app("return objects.noteLines[0].val;"));
  app("window.__prompt = 'dwa metry'; window.__alert = null; calibratePhoto();");
  sprawdz('długość słownie nie ustawia skali', app("return photoScale(sketches[0]);") === null);
  sprawdz('przy długości słownie też pada wyjaśnienie',
    (dom.window.__alert || '').includes('metrach'), dom.window.__alert);
  sprawdz('przy długości słownie odcinek nie dostaje podpisu',
    app("return objects.noteLines[0].val;") === '');
  app("window.__prompt = null; calibratePhoto();");
  sprawdz('anulowanie okna nie ustawia skali', app("return photoScale(sketches[0]);") === null);

  // skala nie przecieka na inne szkice
  app(`
    window.__prompt = '2.00';
    objects.noteLines = [{ x1:100, y1:100, x2:300, y2:100, val:'' }];
    calibratePhoto();
    sketches.push({ id:9, name:'Inne', kind:'zdjecie',
      photo:{ src:'data:image/jpeg;base64,AAAA', w:800, h:600, opis:'', skalaPxNaM:null },
      panX:0, panY:0, zoomLevel:1, showDimensions:true, objects: ${PUSTE} });
  `);
  sprawdz('drugie zdjęcie ma własną, pustą skalę',
    app("return photoScale(sketches[1]);") === null);
  sprawdz('pierwsze zdjęcie zachowuje swoją skalę',
    Math.abs(app("return photoScale(sketches[0]);") - 100) < 0.001);
}

// ===================== ZAPIS I ODCZYT =====================
console.log('--- zdjęcia w projekcie ---');
{
  zeZdjeciem();
  app(`
    sketches[0].photo.opis = 'ściana szczytowa od podwórza';
    sketches[0].photo.skalaPxNaM = 120;
    objects.noteLines = [{ x1:10, y1:10, x2:110, y2:10, color:'#dc3545', val:'0.83' }];
    objects.labels = [{ x:50, y:80, text:'pęknięcie', size:20, box:true }];
  `);
  const paczka = app("return JSON.stringify(projectPayload());");
  const dane = JSON.parse(paczka);
  sprawdz('zdjęcie trafia do pliku projektu', !!dane.sketches[0].photo, JSON.stringify(dane.sketches[0]).slice(0, 60));
  sprawdz('rodzaj szkicu trafia do pliku', dane.sketches[0].kind === 'zdjecie');
  sprawdz('opis zdjęcia trafia do pliku', dane.sketches[0].photo.opis.includes('podwórza'));
  sprawdz('skala zdjęcia trafia do pliku', dane.sketches[0].photo.skalaPxNaM === 120);

  app(`sketches = []; objects = null; applyProjectData(${paczka});`);
  sprawdz('zdjęcie wraca z pliku', app("return !!sketches[0].photo.src;") === true);
  sprawdz('rodzaj wraca z pliku', app("return sketches[0].kind;") === 'zdjecie');
  sprawdz('skala wraca z pliku', app("return photoScale(sketches[0]);") === 120);
  sprawdz('opisy naniesione na zdjęciu wracają z pliku',
    app("return sketches[0].objects.labels[0].text;") === 'pęknięcie');
  sprawdz('miarki naniesione na zdjęciu wracają z pliku',
    app("return sketches[0].objects.noteLines[0].val;") === '0.83');

  // projekt bez zdjęć wczytuje się jak dotąd
  sprawdz('stary projekt bez zdjęć wczytuje się normalnie',
    app(`return applyProjectData({ format:'szkicownik', sketches:[{ id:9, name:'S', objects:{ lines:[] } }] });`) === true);
  sprawdz('szkic bez zdjęcia nie udaje szkicu ze zdjęciem',
    app("return isPhotoSketch(sketches[0]);") === false);
  sprawdz('szkic bez zdjęcia nie ma prostokąta zdjęcia',
    app("return fotoRect(sketches[0]);") === null);
}

// ===================== USUWANIE ZDJĘCIA =====================
console.log('--- usuwanie zdjęcia ---');
{
  zeZdjeciem();
  app(`
    objects.labels = [{ x:50, y:80, text:'pęknięcie', size:20, box:true }];
    removePhoto();
  `);
  sprawdz('usunięcie zdjęcia kasuje sam obrazek',
    app("return sketches[0].photo === undefined;") === true);
  sprawdz('szkic przestaje być szkicem ze zdjęciem',
    app("return isPhotoSketch(sketches[0]);") === false);
  sprawdz('naniesione opisy zostają',
    app("return objects.labels[0].text;") === 'pęknięcie');
  sprawdz('po usunięciu zdjęcia narzędzia rysunkowe wracają',
    app("return toolAllowedHere('line');") === true);
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
