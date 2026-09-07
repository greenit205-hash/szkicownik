/* Szkicownik - rysunek w rzeczywistej skali oraz przeszkody.
 * Uruchomienie:  node tests/test-skala.js     (wymaga: npm install)
 *
 * Najostrzejszy warunek tego zestawu: dopasowanie rysunku NIE MOŻE zmienić
 * ani jednej liczby w tabeli. Powierzchnia nadal liczy się z wpisanych
 * wymiarów, a nie z pikseli — dopasowanie tylko prostuje wygląd. Drugi
 * warunek: wpisane pomiary muszą przeżyć przesunięcie rysunku. Klucze
 * odcinków liczą się ze współrzędnych, więc bez przepisania kluczy
 * WSZYSTKIE pomiary zostałyby po cichu porzucone.
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

function pustyKontekst2D() {
  const nic = () => {};
  const ctx = { canvas: { width: 3000, height: 3000 }, measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: nic }), createPattern: () => null,
    getImageData: () => ({ data: [] }), setLineDash: nic };
  return new Proxy(ctx, { get: (t, p) => (p in t ? t[p] : nic), set: () => true });
}

const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/',
  beforeParse(w) {
    w.HTMLCanvasElement.prototype.getContext = () => pustyKontekst2D();
    w.HTMLCanvasElement.prototype.toDataURL = () => 'data:,';
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

function nowySzkic() {
  app(`
    sketches = [{ id:1, name:'Parter', kind:'rzut', height:'2.60', panX:0, panY:0, zoomLevel:1, showDimensions:true,
      objects: { lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                 noteLines:[], apexDims:{}, hatches:[], slopes:[], callouts:[], obstacles:[] } }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
    autoFitOn = true;
  `);
}

// Prostokąt narysowany NIEDOKŁADNIE (tak jak wychodzi pod palcem), ale
// zmierzony poprawnie. Po dopasowaniu rysunek ma odpowiadać pomiarom.
function krzywyProstokat(rysA, rysB, pomiarA, pomiarB) {
  return app(`
    const P = PIXELS_PER_METER, O = 400;
    const a = ${rysA}, b = ${rysB};
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 objects.lines.push(l); return getSegKey(l.x1,l.y1,l.x2,l.y2); };
    const g = L(0,0, a,0), p = L(a,0, a,b), d = L(a,b, 0,b), l = L(0,b, 0,0);
    const face = findEnclosingFace({ x:O+a/2*P, y:O+b/2*P });
    objects.rooms = [{ id:1, num:'1', name:'Pokój', polygon: face, centroid: getVisualCenter(face) }];
    objects.customDims[g] = { val:'${pomiarA}' };
    objects.customDims[p] = { val:'${pomiarB}' };
    recalculateRooms();
    return { g, p, d, l };
  `);
}

const dlugosci = () => app(`
  return objects.lines.map(l => Math.hypot(l.x2-l.x1, l.y2-l.y1) / PIXELS_PER_METER);
`);

// ===================== RYSUNEK DOCIĄGA SIĘ DO POMIARÓW =====================
console.log('--- rysunek w rzeczywistej skali ---');
{
  // narysowane 4,2 × 3,1 m, zmierzone 5,00 × 4,00 m
  nowySzkic();
  krzywyProstokat(4.2, 3.1, '5.00', '4.00');
  const przed = dlugosci();
  sprawdz('przed dopasowaniem rysunek nie odpowiada pomiarom',
    Math.abs(przed[0] - 5.00) > 0.5, przed[0]);

  const wynik = app("return fitDrawingToDimensions();");
  sprawdz('dopasowanie się udaje', !wynik.powod, JSON.stringify(wynik));
  sprawdz('dopasowanie kończy się z pomijalnym błędem', wynik.blad < 0.5, wynik.blad);

  const po = dlugosci();
  sprawdz('górna ściana ma na rysunku 5,00 m', Math.abs(po[0] - 5.00) < 0.02, po[0]);
  sprawdz('prawa ściana ma na rysunku 4,00 m', Math.abs(po[1] - 4.00) < 0.02, po[1]);
  // dolna i lewa nie były mierzone — wynikają z zamknięcia prostokąta
  sprawdz('dolna ściana wynika z zamknięcia i też ma 5,00 m',
    Math.abs(po[2] - 5.00) < 0.02, po[2]);
  sprawdz('lewa ściana wynika z zamknięcia i też ma 4,00 m',
    Math.abs(po[3] - 4.00) < 0.02, po[3]);

  // to jest warunek najważniejszy
  sprawdz('powierzchnia po dopasowaniu jest niezmieniona',
    app("recalculateRooms(); return objects.rooms[0].area;") === '20.00',
    app("return objects.rooms[0].area;"));

  // pomiary muszą przeżyć przesunięcie rysunku
  const pomiary = app("return Object.values(objects.customDims).map(d => d.val).sort();");
  sprawdz('wpisane pomiary nie giną przy przesuwaniu rysunku',
    JSON.stringify(pomiary) === JSON.stringify(['4.00', '5.00']), JSON.stringify(pomiary));
  sprawdz('klucze pomiarów pasują do nowych pozycji ścian',
    app(`
      const g = getSegKey(objects.lines[0].x1, objects.lines[0].y1, objects.lines[0].x2, objects.lines[0].y2);
      return !!(objects.customDims[g] && objects.customDims[g].val === '5.00');
    `) === true);
  sprawdz('pomieszczenie nadal nie wymaga pomiaru',
    app("return objects.rooms[0].area;") !== 'Wymaga pomiaru!');

  // ściany rysowane pod kątem prostym mają takie zostać
  const katy = app(`
    return objects.lines.map(l => wallAngleDeg(l.x1, l.y1, l.x2, l.y2));
  `);
  sprawdz('ściany zostają poziome albo pionowe',
    katy.every(k => k < 0.5 || k > 89.5), JSON.stringify(katy));

  // rysunek nie może uciec z ekranu
  const srodek = app(`
    const xs = objects.lines.map(l => l.x1).concat(objects.lines.map(l => l.x2));
    return xs.reduce((a,b) => a+b, 0) / xs.length;
  `);
  sprawdz('rysunek zostaje mniej więcej tam, gdzie był',
    Math.abs(srodek - (400 + 4.2 / 2 * 50)) < 60, srodek);
}

// ===================== POKÓJ L I ŚCIANY MIERZONE ODCINKAMI =====================
console.log('--- kształty trudniejsze niż prostokąt ---');
{
  nowySzkic();
  app(`
    const P = PIXELS_PER_METER, O = 400;
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 objects.lines.push(l); return getSegKey(l.x1,l.y1,l.x2,l.y2); };
    // rysunek celowo krzywy: 5,2 zamiast 6, 2,6 zamiast 3 itd.
    const a = L(0,0, 5.2,0), b = L(5.2,0, 5.2,2.6), c = L(5.2,2.6, 2.7,2.6),
          d = L(2.7,2.6, 2.7,4.4), e = L(2.7,4.4, 0,4.4), f = L(0,4.4, 0,0);
    objects.customDims[a] = { val:'6.00' };
    objects.customDims[b] = { val:'3.00' };
    objects.customDims[c] = { val:'3.00' };
    objects.customDims[d] = { val:'2.00' };
    objects.customDims[e] = { val:'3.00' };
    const face = findEnclosingFace({ x:O+1*P, y:O+1*P });
    objects.rooms = [{ id:1, num:'1', name:'Pokój L', polygon: face, centroid: getVisualCenter(face) }];
    recalculateRooms();
  `);
  const przedPole = app("return objects.rooms[0].area;");
  sprawdz('pokój L liczy się na 24,00 m² przed dopasowaniem', przedPole === '24.00', przedPole);

  const w = app("return fitDrawingToDimensions();");
  sprawdz('pokój L daje się dopasować', !w.powod && w.blad < 0.5, JSON.stringify(w));
  const dl = dlugosci();
  sprawdz('ściana zmierzona na 6,00 m ma 6,00 m', Math.abs(dl[0] - 6.00) < 0.02, dl[0]);
  sprawdz('ściana zmierzona na 2,00 m ma 2,00 m', Math.abs(dl[3] - 2.00) < 0.02, dl[3]);
  sprawdz('szósta ściana wynika z zamknięcia i ma 5,00 m',
    Math.abs(dl[5] - 5.00) < 0.05, dl[5]);
  sprawdz('powierzchnia pokoju L niezmieniona',
    app("recalculateRooms(); return objects.rooms[0].area;") === '24.00',
    app("return objects.rooms[0].area;"));

  // ściana podzielona ścianką działową, mierzona odcinkami
  nowySzkic();
  app(`
    const P = PIXELS_PER_METER, O = 400;
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 objects.lines.push(l); return l; };
    const gora = L(0,0, 5.4,0);
    L(5.4,0, 5.4,4); L(5.4,4, 0,4); L(0,4, 0,0);
    L(1.8,0, 1.8,4);
    recalculateRooms();
    const segs = getSegmentsForLine(gora);
    objects.customDims[getSegKey(segs[0].x1,segs[0].y1,segs[0].x2,segs[0].y2)] = { val:'2.00' };
    objects.customDims[getSegKey(segs[1].x1,segs[1].y1,segs[1].x2,segs[1].y2)] = { val:'4.00' };
  `);
  app("fitDrawingToDimensions();");
  const gora = app("const l = objects.lines[0]; return Math.hypot(l.x2-l.x1, l.y2-l.y1) / PIXELS_PER_METER;");
  sprawdz('ściana mierzona odcinkami dostaje sumę odcinków (6,00 m)',
    Math.abs(gora - 6.00) < 0.05, gora);
  const zachowane = app("return Object.values(objects.customDims).map(d => d.val).sort();");
  sprawdz('pomiary odcinków przeżywają dopasowanie',
    JSON.stringify(zachowane) === JSON.stringify(['2.00', '4.00']), JSON.stringify(zachowane));
}

// ===================== OTWORY I OBRYSY JADĄ ZE ŚCIANAMI =====================
console.log('--- otwory i obrysy po dopasowaniu ---');
{
  nowySzkic();
  krzywyProstokat(4.2, 3.1, '5.00', '4.00');
  app(`
    const P = PIXELS_PER_METER, O = 400;
    // okno w połowie górnej ściany
    objects.openings = [{ x:O + 2.1*P, y:O, angle:0, id:'O1', width:120, height:140 }];
  `);
  app("fitDrawingToDimensions();");
  const op = app("return objects.openings[0];");
  const naScianie = app(`
    const l = objects.lines[0], op = objects.openings[0];
    const p = getClosestPointOnSegment({x:op.x,y:op.y}, {x:l.x1,y:l.y1}, {x:l.x2,y:l.y2});
    return Math.hypot(op.x-p.x, op.y-p.y);
  `);
  sprawdz('okno zostaje na swojej ścianie', naScianie < 1, naScianie);
  const wzgledne = app(`
    const l = objects.lines[0], op = objects.openings[0];
    return Math.hypot(op.x-l.x1, op.y-l.y1) / Math.hypot(l.x2-l.x1, l.y2-l.y1);
  `);
  sprawdz('okno zostaje w tym samym miejscu ściany (w połowie)',
    Math.abs(wzgledne - 0.5) < 0.05, wzgledne);
  sprawdz('wymiary okna nietknięte', op.width === 120 && op.height === 140);

  // opisy, komentarze, miarki i ołówek też muszą jechać razem z rysunkiem,
  // inaczej po dociągnięciu ścian opis „kotłownia" ląduje obok pomieszczenia
  nowySzkic();
  krzywyProstokat(4.2, 3.1, '5.00', '4.00');
  app(`
    const P = PIXELS_PER_METER, O = 400;
    objects.labels    = [{ x:O + 2.1*P, y:O + 1.55*P, text:'kotłownia', size:20 }];
    objects.callouts  = [{ x:O + 3*P, y:O + 1*P, tx:O + 2*P, ty:O, text:'zawilgocenie' }];
    objects.noteLines = [{ x1:O, y1:O + 3.1*P, x2:O + 4.2*P, y2:O + 3.1*P, color:'#dc3545', val:'5.00' }];
    objects.freehand  = [{ color:'#212529', path:[{x:O + 1*P, y:O + 1*P}, {x:O + 2*P, y:O + 2*P}] }];
  `);
  const przedOpisy = app(`return {
    lbl: { x: objects.labels[0].x, y: objects.labels[0].y },
    cal: { x: objects.callouts[0].x, tx: objects.callouts[0].tx },
    note:{ x2: objects.noteLines[0].x2 },
    pen: { x: objects.freehand[0].path[1].x }
  };`);
  app("fitDrawingToDimensions();");
  const poOpisy = app(`return {
    lbl: { x: objects.labels[0].x, y: objects.labels[0].y },
    cal: { x: objects.callouts[0].x, tx: objects.callouts[0].tx },
    note:{ x2: objects.noteLines[0].x2 },
    pen: { x: objects.freehand[0].path[1].x }
  };`);
  sprawdz('opis jedzie razem z rysunkiem',
    Math.abs(poOpisy.lbl.x - przedOpisy.lbl.x) > 3, poOpisy.lbl.x + ' vs ' + przedOpisy.lbl.x);
  sprawdz('opis zostaje wewnątrz pomieszczenia',
    app("return pointInPolygon({x: objects.labels[0].x, y: objects.labels[0].y}, objects.rooms[0].polygon);") === true);
  sprawdz('chmurka komentarza jedzie razem z rysunkiem',
    Math.abs(poOpisy.cal.x - przedOpisy.cal.x) > 1, poOpisy.cal.x + ' vs ' + przedOpisy.cal.x);
  sprawdz('grot strzałki jedzie razem z rysunkiem',
    Math.abs(poOpisy.cal.tx - przedOpisy.cal.tx) > 1, poOpisy.cal.tx + ' vs ' + przedOpisy.cal.tx);
  sprawdz('miarka jedzie razem z rysunkiem',
    Math.abs(poOpisy.note.x2 - przedOpisy.note.x2) > 3, poOpisy.note.x2 + ' vs ' + przedOpisy.note.x2);
  sprawdz('ołówek jedzie razem z rysunkiem',
    Math.abs(poOpisy.pen.x - przedOpisy.pen.x) > 1, poOpisy.pen.x + ' vs ' + przedOpisy.pen.x);

  nowySzkic();
  krzywyProstokat(4.2, 3.1, '5.00', '4.00');
  app(`
    const P = PIXELS_PER_METER, O = 400;
    objects.openings = [{ x:O + 2.1*P, y:O, angle:0, id:'O1', width:120, height:140 }];
    fitDrawingToDimensions();
  `);
  const obrysNaScianach = app(`
    return objects.rooms[0].polygon.every(p =>
      objects.lines.some(l => {
        const q = getClosestPointOnSegment(p, {x:l.x1,y:l.y1}, {x:l.x2,y:l.y2});
        return Math.hypot(p.x-q.x, p.y-q.y) < 1;
      }));
  `);
  sprawdz('obrys pomieszczenia jedzie razem ze ścianami', obrysNaScianach === true);
}

// ===================== ODMOWY I SYTUACJE BRZEGOWE =====================
console.log('--- kiedy dopasowanie nie ma czego zrobić ---');
{
  nowySzkic();
  sprawdz('pusty szkic nie jest dopasowywany',
    app("return fitDrawingToDimensions().powod;") === 'brak-scian');

  nowySzkic();
  krzywyProstokat(4.2, 3.1, '5.00', '4.00');
  app("objects.customDims = {};");
  sprawdz('szkic bez pomiarów nie jest dopasowywany',
    app("return fitDrawingToDimensions().powod;") === 'brak-wymiarow');

  // rysunek już zgodny z pomiarami - dopasowanie nie może go ruszyć
  nowySzkic();
  krzywyProstokat(5, 4, '5.00', '4.00');
  const zapis = app("return JSON.stringify(objects.lines);");
  app("fitDrawingToDimensions();");
  const poDrugim = app("return JSON.stringify(objects.lines.map(l => ({x1:Math.round(l.x1), y1:Math.round(l.y1), x2:Math.round(l.x2), y2:Math.round(l.y2)})));");
  const przedZaokr = JSON.parse(zapis).map(l => ({x1:Math.round(l.x1), y1:Math.round(l.y1), x2:Math.round(l.x2), y2:Math.round(l.y2)}));
  sprawdz('zgodny rysunek nie jest ruszany', poDrugim === JSON.stringify(przedZaokr), poDrugim);

  // dopasowanie musi być powtarzalne - drugie wywołanie nic już nie zmienia
  nowySzkic();
  krzywyProstokat(4.2, 3.1, '5.00', '4.00');
  app("fitDrawingToDimensions();");
  const pierwsze = dlugosci();
  app("fitDrawingToDimensions();");
  const drugie = dlugosci();
  sprawdz('powtórne dopasowanie nic już nie zmienia',
    pierwsze.every((v, i) => Math.abs(v - drugie[i]) < 0.01),
    JSON.stringify(pierwsze) + ' vs ' + JSON.stringify(drugie));

  // sprzeczne pomiary: rysunek robi, co może, i mówi o rozbieżności
  nowySzkic();
  app(`
    const P = PIXELS_PER_METER, O = 400;
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 objects.lines.push(l); return getSegKey(l.x1,l.y1,l.x2,l.y2); };
    const g = L(0,0, 5,0), p = L(5,0, 5,4), d = L(5,4, 0,4), l = L(0,4, 0,0);
    objects.customDims[g] = { val:'5.00' };
    objects.customDims[d] = { val:'8.00' };      // ta sama strona zmierzona inaczej
    objects.customDims[p] = { val:'4.00' };
  `);
  const sprzeczne = app("return fitDrawingToDimensions();");
  sprawdz('sprzeczne pomiary są zgłaszane jako rozbieżność',
    sprzeczne.blad > 2, sprzeczne.blad);
  sprawdz('mimo sprzeczności rysunek pozostaje sensowny',
    app("return objects.lines.every(l => isFinite(l.x1) && isFinite(l.y1) && isFinite(l.x2) && isFinite(l.y2));") === true);

  // wyłączony przełącznik = rysunek nietknięty
  nowySzkic();
  krzywyProstokat(4.2, 3.1, '5.00', '4.00');
  app("autoFitOn = false;");
  const przed = dlugosci();
  app("autoFit();");
  const po = dlugosci();
  sprawdz('przy wyłączonej skali rysunek nie jest ruszany',
    JSON.stringify(przed) === JSON.stringify(po));
  app("autoFitOn = true;");
}

// ===================== PRZESZKODY =====================
console.log('--- przeszkody ---');
{
  nowySzkic();
  krzywyProstokat(5, 4, '5.00', '4.00');

  // prostokąt z podanymi wymiarami rysuje się w skali
  app(`
    openObstacleDialog({ prostokat:true, center:{x:500, y:500},
      polygon:[{x:480,y:480},{x:520,y:480},{x:520,y:520},{x:480,y:520}] });
    document.getElementById('obstacleLabel').value = 'Komin';
    document.getElementById('obstacleW').value = '40';
    document.getElementById('obstacleD').value = '60';
    document.getElementById('obstacleSubtract').checked = true;
    saveObstacle();
  `);
  const lista = app("return objects.obstacles;");
  sprawdz('przeszkoda trafia na szkic', lista.length === 1, lista.length);
  sprawdz('przeszkoda ma opis', lista[0].label === 'Komin', lista[0].label);
  const bok = app(`
    const p = objects.obstacles[0].polygon;
    return { w: Math.abs(p[1].x - p[0].x) / PIXELS_PER_METER,
             d: Math.abs(p[2].y - p[1].y) / PIXELS_PER_METER };
  `);
  sprawdz('wpisane wymiary mają pierwszeństwo nad rysunkiem — szerokość 0,40 m',
    Math.abs(bok.w - 0.40) < 0.001, bok.w);
  sprawdz('wpisane wymiary mają pierwszeństwo nad rysunkiem — głębokość 0,60 m',
    Math.abs(bok.d - 0.60) < 0.001, bok.d);
  sprawdz('powierzchnia przeszkody liczy się z wpisanych wymiarów',
    Math.abs(app("return obstacleAreaM2(objects.obstacles[0]);") - 0.24) < 0.001,
    app("return obstacleAreaM2(objects.obstacles[0]);"));

  // trafianie palcem
  sprawdz('dotknięcie przeszkody ją znajduje',
    app("return findObstacleAt({ x:500, y:500 });") === 0);
  sprawdz('dotknięcie obok nie trafia w nic',
    app("return findObstacleAt({ x:100, y:100 });") === -1);

  // odejmowanie od powierzchni pomieszczenia
  const wPokoju = app("return obstaclesInRoomM2(objects.rooms[0]);");
  sprawdz('przeszkoda wewnątrz pokoju jest doliczana do odejmowanych',
    Math.abs(wPokoju - 0.24) < 0.001, wPokoju);
  sprawdz('powierzchnia pomieszczenia sama się NIE zmienia',
    app("recalculateRooms(); return objects.rooms[0].area;") === '20.00',
    app("return objects.rooms[0].area;"));

  // odznaczona przeszkoda nie jest odejmowana
  app(`
    openObstacleDialog(null, 0);
    document.getElementById('obstacleSubtract').checked = false;
    saveObstacle();
  `);
  sprawdz('przeszkoda bez odejmowania nie wchodzi do sumy',
    app("return obstaclesInRoomM2(objects.rooms[0]);") === 0);

  // przeszkoda poza pokojem nie jest doliczana
  app(`
    openObstacleDialog(null, 0);
    document.getElementById('obstacleSubtract').checked = true;
    saveObstacle();
    objects.obstacles.push({ id:2, polygon: obstaclePolygonFromSize(2000, 2000, 50, 50),
                             label:'Poza', subtract:true, w:50, d:50 });
  `);
  sprawdz('przeszkoda poza obrysem pokoju nie jest odejmowana',
    Math.abs(app("return obstaclesInRoomM2(objects.rooms[0]);") - 0.24) < 0.001,
    app("return obstaclesInRoomM2(objects.rooms[0]);"));

  // poprawianie i usuwanie
  app(`
    openObstacleDialog(null, 0);
    document.getElementById('obstacleLabel').value = 'Komin spalinowy';
    document.getElementById('obstacleW').value = '50';
    document.getElementById('obstacleD').value = '50';
    saveObstacle();
  `);
  sprawdz('poprawka nie tworzy drugiej przeszkody',
    app("return objects.obstacles.length;") === 2);
  sprawdz('opis został poprawiony',
    app("return objects.obstacles[0].label;") === 'Komin spalinowy');
  sprawdz('wymiary zostały poprawione',
    Math.abs(app("return obstacleAreaM2(objects.obstacles[0]);") - 0.25) < 0.001);

  app("openObstacleDialog(null, 1); deleteObstacle();");
  sprawdz('przeszkodę da się usunąć', app("return objects.obstacles.length;") === 1);

  // rysowanie nie może się wywracać
  sprawdz('rysowanie z przeszkodami nie wywraca płótna',
    app("renderCanvasNow(); return objects.obstacles.length;") === 1);
  sprawdz('stary szkic bez przeszkód rysuje się normalnie',
    app("delete objects.obstacles; renderCanvasNow(); return objects.obstacles === undefined;") === true);
}

// ===================== PRZESZKODY A DOPASOWANIE I ZAPIS =====================
console.log('--- przeszkody w projekcie ---');
{
  nowySzkic();
  krzywyProstokat(4.2, 3.1, '5.00', '4.00');
  app(`
    objects.obstacles = [{ id:1, polygon: obstaclePolygonFromSize(500, 500, 40, 40),
                           label:'Komin', subtract:true, w:40, d:40 }];
  `);
  app("fitDrawingToDimensions();");
  sprawdz('przeszkoda przeżywa dopasowanie rysunku',
    app("return objects.obstacles.length;") === 1);
  sprawdz('wymiary przeszkody nie zmieniają się przy dopasowaniu',
    Math.abs(app("return obstacleAreaM2(objects.obstacles[0]);") - 0.16) < 0.001,
    app("return obstacleAreaM2(objects.obstacles[0]);"));

  const paczka = app("return JSON.stringify(projectPayload());");
  sprawdz('przeszkody trafiają do pliku projektu',
    JSON.parse(paczka).sketches[0].objects.obstacles.length === 1);
  app(`sketches = []; applyProjectData(${paczka});`);
  sprawdz('przeszkody wracają z pliku projektu',
    app("return sketches[0].objects.obstacles[0].label;") === 'Komin');
  sprawdz('stary projekt bez przeszkód dostaje pustą tablicę',
    app(`applyProjectData({ format:'szkicownik', sketches:[{ id:9, name:'S', objects:{ lines:[] } }] });
         return Array.isArray(objects.obstacles) && objects.obstacles.length === 0;`) === true);
}


// ===================== POWIERZCHNIA W ŚWIETLE ŚCIAN =====================
console.log('--- powierzchnia w świetle ścian ---');
{
  // pokój 5×4 po osiach, ściany 25 cm -> w świetle 4,75 × 3,75 = 17,81 m²
  nowySzkic();
  krzywyProstokat(5, 4, '5.00', '4.00');
  app("objects.lines.forEach(l => l.gr = 25); recalculateRooms();");
  sprawdz('powierzchnia po osiach zostaje 20,00 m²',
    app("return objects.rooms[0].area;") === '20.00', app("return objects.rooms[0].area;"));
  const netto = app("return roomNetAreaM2(objects.rooms[0]);");
  sprawdz('powierzchnia w świetle ścian 25 cm = 17,81 m²',
    Math.abs(netto - 17.8125) < 0.01, netto);

  // bez grubości obie liczby są takie same
  app("objects.lines.forEach(l => delete l.gr); recalculateRooms();");
  sprawdz('bez grubości ścian obie liczby są równe',
    Math.abs(app("return roomNetAreaM2(objects.rooms[0]);") - 20) < 0.001,
    app("return roomNetAreaM2(objects.rooms[0]);"));

  // przeszkoda odejmowana wchodzi do liczby w świetle, ale nie do tej po osiach
  app(`
    objects.lines.forEach(l => l.gr = 25);
    objects.obstacles = [{ id:1, polygon: obstaclePolygonFromSize(500, 500, 100, 100),
                           label:'Komin', subtract:true, w:100, d:100 }];
    recalculateRooms();
  `);
  sprawdz('powierzchnia po osiach nadal 20,00 m² mimo przeszkody',
    app("return objects.rooms[0].area;") === '20.00');
  sprawdz('przeszkoda 1×1 m odejmuje się od powierzchni w świetle',
    Math.abs(app("return roomNetAreaM2(objects.rooms[0]);") - 16.8125) < 0.01,
    app("return roomNetAreaM2(objects.rooms[0]);"));

  // grubsze ściany = mniejsza powierzchnia w świetle
  const cienkie = app("objects.lines.forEach(l => l.gr = 12); recalculateRooms(); return roomNetAreaM2(objects.rooms[0]);");
  const grube = app("objects.lines.forEach(l => l.gr = 44); recalculateRooms(); return roomNetAreaM2(objects.rooms[0]);");
  sprawdz('grubsze ściany dają mniejszą powierzchnię w świetle', grube < cienkie,
    grube + ' vs ' + cienkie);

  // pomieszczenie bez pomiaru nie może zmyślać drugiej liczby
  app("objects.customDims = {}; recalculateRooms();");
  sprawdz('pomieszczenie bez pomiaru nie dostaje powierzchni w świetle',
    app("return roomNetAreaM2(objects.rooms[0]);") === null,
    app("return roomNetAreaM2(objects.rooms[0]);"));
}


// ===================== TABELA PRZESZKÓD POD SZKICEM =====================
console.log('--- tabela przeszkód ---');
{
  nowySzkic();
  krzywyProstokat(5, 4, '5.00', '4.00');
  app(`
    objects.obstacles = [
      { id:1, polygon: obstaclePolygonFromSize(500, 500, 40, 60), label:'Komin', subtract:true, w:40, d:60 },
      { id:2, polygon: obstaclePolygonFromSize(560, 500, 25, 25), label:'Słup', subtract:false, w:25, d:25 }
    ];
    renderTablesPerSketch();
  `);
  const html = doc.getElementById('tablesPerSketchContainer').innerHTML;
  sprawdz('tabela przeszkód pojawia się pod szkicem', html.includes('Przeszkody:'), html.slice(0, 80));
  sprawdz('tabela wymienia opis przeszkody', html.includes('Komin') && html.includes('Słup'));
  sprawdz('tabela pokazuje wymiary w centymetrach', html.includes('40 × 60 cm'), html.includes('40'));
  sprawdz('tabela pokazuje powierzchnię przeszkody', html.includes('0.24'));
  sprawdz('suma liczy tylko przeszkody odejmowane',
    html.includes('RAZEM ODEJMOWANE:') && html.includes('>0.24 m²<'),
    html.slice(html.indexOf('RAZEM ODEJMOWANE'), html.indexOf('RAZEM ODEJMOWANE') + 120));

  // szkic bez przeszkód nie może pokazywać pustej tabeli
  app("objects.obstacles = []; renderTablesPerSketch();");
  sprawdz('bez przeszkód tabela się nie pokazuje',
    !doc.getElementById('tablesPerSketchContainer').innerHTML.includes('Przeszkody:'));

  // przeszkoda bez podanych wymiarów liczy się z rysunku
  app(`
    objects.obstacles = [{ id:3, polygon:[{x:400,y:400},{x:450,y:400},{x:450,y:450},{x:400,y:450}],
                           label:'Wnęka', subtract:true }];
    renderTablesPerSketch();
  `);
  const h2 = doc.getElementById('tablesPerSketchContainer').innerHTML;
  sprawdz('przeszkoda bez wymiarów jest oznaczona jako liczona z obrysu',
    h2.includes('wg obrysu'), h2.includes('Wnęka'));
  sprawdz('przeszkoda 1×1 m z rysunku ma 1,00 m²',
    Math.abs(app("return obstacleAreaM2(objects.obstacles[0]);") - 1.00) < 0.001,
    app("return obstacleAreaM2(objects.obstacles[0]);"));
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
