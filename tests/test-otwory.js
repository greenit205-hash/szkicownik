/* Szkicownik - otwory: budowlany, odległość od narożnika, rodzaje.
 * Uruchomienie:  node tests/test-otwory.js     (wymaga: npm install)
 *
 * Sedno tego zestawu: otwór budowlany ma robić PRAWDZIWĄ przerwę w ścianie.
 * Nie „sklejenie pokoi" na poziomie tabeli, tylko brak ściany w tym miejscu —
 * a wtedy dwa pomieszczenia same wychodzą jako jeden obrys i jedna powierzchnia.
 * Okna i drzwi mają się zachowywać dokładnie odwrotnie: ściana zostaje ciągła.
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
    fillText: (t, x, y) => slad.push({ op: 'fillText', t: String(t), x, y, kolor: stan.fillStyle })
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
  `);
}

// Dwa pokoje 3×4 obok siebie, rozdzielone ścianką w środku.
// Ściana działowa biegnie w pionie na x = 3 m.
function dwaPokoje() {
  app(`
    const P = PIXELS_PER_METER, O = 400;
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 objects.lines.push(l); return l; };
    objects.lines = [];
    L(0,0, 6,0); L(6,0, 6,4); L(6,4, 0,4); L(0,4, 0,0);
    L(3,0, 3,4);                       // ścianka działowa
  `);
}

function obrysWokol(x, y) {
  return app(`
    const P = PIXELS_PER_METER, O = 400;
    const f = findEnclosingFace({ x: O + ${x} * P, y: O + ${y} * P });
    return f ? polygonSignedArea(f) / (P * P) : null;
  `);
}

// ===================== ROZPOZNAWANIE RODZAJU =====================
console.log('--- rodzaje otworów ---');
{
  sprawdz('O1 to okno', app("return typOtworu({ id:'O1' });") === 'okno');
  sprawdz('OPZ1 to okno połaciowe', app("return typOtworu({ id:'OPZ1' });") === 'oknoPol');
  sprawdz('DZ1 to drzwi zewnętrzne', app("return typOtworu({ id:'DZ1' });") === 'drzwi');
  sprawdz('DW1 to drzwi wewnętrzne', app("return typOtworu({ id:'DW1' });") === 'drzwiWew');
  sprawdz('OB1 to otwór budowlany', app("return typOtworu({ id:'OB1' });") === 'przejscie');
  sprawdz('DW nie wpada omyłkowo do drzwi zewnętrznych',
    app("return typOtworu({ id:'DW7' });") !== 'drzwi');
  sprawdz('OPZ nie wpada omyłkowo do okien zwykłych',
    app("return typOtworu({ id:'OPZ3' });") !== 'okno');
  sprawdz('pole typ ma pierwszeństwo nad oznaczeniem',
    app("return typOtworu({ id:'O1', typ:'przejscie' });") === 'przejscie');
  sprawdz('nieznane oznaczenie traktujemy jak okno',
    app("return typOtworu({ id:'XYZ' });") === 'okno');
  sprawdz('każdy rodzaj ma nazwę i kolor',
    app("return Object.values(OPENING_TYPES).every(t => t.nazwa && /^#[0-9a-f]{6}$/i.test(t.kolor));") === true);
  sprawdz('tylko otwór budowlany nie pokazuje wymiarów',
    app("return OPENING_TYPES.przejscie.wymiary === false && OPENING_TYPES.okno.wymiary === true;") === true);
}

// ===================== OTWÓR BUDOWLANY ŁĄCZY POMIESZCZENIA =====================
console.log('--- otwór budowlany robi przerwę w ścianie ---');
{
  nowySzkic();
  dwaPokoje();
  const lewy = obrysWokol(1.5, 2), prawy = obrysWokol(4.5, 2);
  sprawdz('bez otworu lewy pokój ma 12 m²', Math.abs(lewy - 12) < 0.01, lewy);
  sprawdz('bez otworu prawy pokój ma 12 m²', Math.abs(prawy - 12) < 0.01, prawy);

  // okno w ściance działowej NIE może niczego łączyć
  app(`
    const P = PIXELS_PER_METER, O = 400;
    objects.openings = [{ x:O+3*P, y:O+2*P, angle:Math.PI/2, id:'O1', width:120, height:140, typ:'okno' }];
  `);
  sprawdz('okno nie łączy pomieszczeń — lewy nadal 12 m²',
    Math.abs(obrysWokol(1.5, 2) - 12) < 0.01, obrysWokol(1.5, 2));

  // drzwi wewnętrzne też nie
  app("objects.openings[0] = Object.assign({}, objects.openings[0], { id:'DW1', typ:'drzwiWew', width:90 });");
  sprawdz('drzwi wewnętrzne nie łączą pomieszczeń',
    Math.abs(obrysWokol(1.5, 2) - 12) < 0.01, obrysWokol(1.5, 2));

  // a otwór budowlany ma połączyć
  app("objects.openings[0] = Object.assign({}, objects.openings[0], { id:'OB1', typ:'przejscie', width:150 });");
  const polaczone = obrysWokol(1.5, 2);
  sprawdz('otwór budowlany łączy oba pomieszczenia w jeden obrys 24 m²',
    Math.abs(polaczone - 24) < 0.05, polaczone);
  sprawdz('z drugiej strony wychodzi ta sama powierzchnia',
    Math.abs(obrysWokol(4.5, 2) - polaczone) < 0.05, obrysWokol(4.5, 2));

  // usunięcie otworu przywraca dwa pokoje
  app("objects.openings = [];");
  sprawdz('po usunięciu otworu pomieszczenia znów są osobne',
    Math.abs(obrysWokol(1.5, 2) - 12) < 0.01, obrysWokol(1.5, 2));

  // powierzchnia liczona z wymiarów też ma być wspólna
  nowySzkic();
  dwaPokoje();
  app(`
    const P = PIXELS_PER_METER, O = 400;
    objects.openings = [{ x:O+3*P, y:O+2*P, angle:Math.PI/2, id:'OB1', width:150, height:0, typ:'przejscie' }];
    const face = findEnclosingFace({ x:O+1.5*P, y:O+2*P });
    objects.rooms = [{ id:1, num:'1', name:'Salon z kuchnią', polygon: face, centroid: getVisualCenter(face) }];
    objects.customDims[getSegKey(O, O, O+6*P, O)] = { val:'6.00' };
    objects.customDims[getSegKey(O+6*P, O, O+6*P, O+4*P)] = { val:'4.00' };
    recalculateRooms();
  `);
  sprawdz('połączone pomieszczenie liczy się jako 24,00 m²',
    app("return objects.rooms[0].area;") === '24.00', app("return objects.rooms[0].area;"));
}

// ===================== PRZERWA JEST RÓWNIEŻ NA RYSUNKU =====================
console.log('--- przerwa widoczna na rysunku ---');
{
  nowySzkic();
  app(`
    const P = PIXELS_PER_METER, O = 400;
    objects.lines = [{ x1:O, y1:O, x2:O+6*P, y2:O }];
    objects.openings = [{ x:O+3*P, y:O, angle:0, id:'OB1', width:150, height:0, typ:'przejscie' }];
  `);
  const kawalki = app(`
    const l = objects.lines[0];
    return odcinkiBezPrzejsc({ x1:l.x1, y1:l.y1, x2:l.x2, y2:l.y2 }, l)
      .map(k => Math.hypot(k.x2-k.x1, k.y2-k.y1) / PIXELS_PER_METER);
  `);
  sprawdz('ściana rozpada się na dwa kawałki', kawalki.length === 2, JSON.stringify(kawalki));
  sprawdz('suma kawałków to długość ściany bez otworu',
    Math.abs(kawalki.reduce((a, b) => a + b, 0) - (6 - 1.5)) < 0.01,
    kawalki.reduce((a, b) => a + b, 0));
  sprawdz('oba kawałki mają po 2,25 m',
    Math.abs(kawalki[0] - 2.25) < 0.01 && Math.abs(kawalki[1] - 2.25) < 0.01, JSON.stringify(kawalki));

  // otwór przy samym narożniku zostawia tylko jeden kawałek
  app(`
    const P = PIXELS_PER_METER, O = 400;
    objects.openings = [{ x:O+0.75*P, y:O, angle:0, id:'OB1', width:150, height:0, typ:'przejscie' }];
  `);
  const przyRogu = app(`
    const l = objects.lines[0];
    return odcinkiBezPrzejsc({ x1:l.x1, y1:l.y1, x2:l.x2, y2:l.y2 }, l).length;
  `);
  sprawdz('otwór przy narożniku zostawia jeden kawałek ściany', przyRogu === 1, przyRogu);

  // okno nie może wycinać niczego
  app(`
    const P = PIXELS_PER_METER, O = 400;
    objects.openings = [{ x:O+3*P, y:O, angle:0, id:'O1', width:150, height:140, typ:'okno' }];
  `);
  sprawdz('okno nie dzieli ściany na kawałki',
    app(`const l = objects.lines[0];
         return odcinkiBezPrzejsc({ x1:l.x1, y1:l.y1, x2:l.x2, y2:l.y2 }, l).length;`) === 1);

  sprawdz('rysowanie ściany z przerwą nie wywraca płótna',
    app(`objects.openings = [{ x:400+3*50, y:400, angle:0, id:'OB1', width:150, height:0, typ:'przejscie' }];
         renderCanvasNow(); return objects.lines.length;`) === 1);

  // przerwa na rysunku musi zgadzać się z przerwą w grafie - inaczej rysunek
  // pokazywałby ciągłą ścianę tam, gdzie program już jej nie widzi
  const kreski = app(`
    const l = objects.lines[0];
    const k = odcinkiBezPrzejsc({ x1:l.x1, y1:l.y1, x2:l.x2, y2:l.y2 }, l);
    // dziura między kawałkami ma mieć szerokość otworu
    if (k.length !== 2) return -1;
    return Math.hypot(k[1].x1 - k[0].x2, k[1].y1 - k[0].y2) / PIXELS_PER_METER * 100;
  `);
  sprawdz('dziura na rysunku ma szerokość otworu', Math.abs(kreski - 150) < 0.5, kreski);
}

// ===================== ODLEGŁOŚĆ OD NAROŻNIKA =====================
console.log('--- odległość od narożnika ---');
{
  nowySzkic();
  app(`
    const P = PIXELS_PER_METER, O = 400;
    objects.lines = [{ x1:O, y1:O, x2:O+6*P, y2:O }];
  `);
  // lewy narożnik to ten o mniejszym x - niezależnie od kierunku rysowania
  const rogi = app("return wallCorners(objects.lines[0]);");
  sprawdz('lewy narożnik ma mniejsze x', rogi.lewy.x < rogi.prawy.x, JSON.stringify(rogi));
  const odwrocona = app("return wallCorners({ x1:1000, y1:400, x2:400, y2:400 });");
  sprawdz('kierunek rysowania nie zamienia narożników',
    odwrocona.lewy.x === 400, JSON.stringify(odwrocona));
  const pionowa = app("return wallCorners({ x1:400, y1:1000, x2:400, y2:400 });");
  sprawdz('przy ścianie pionowej lewy to górny', pionowa.lewy.y === 400, JSON.stringify(pionowa));

  // 100 cm od lewego narożnika, otwór 120 cm -> środek na 160 cm
  const poz = app(`
    return positionFromCorner(
      { width:120, odKrawedzi:{ strona:'lewa', dystans:100 } }, objects.lines[0]);
  `);
  sprawdz('odległość liczy się do krawędzi otworu, nie do środka',
    Math.abs(poz.x - (400 + 1.6 * 50)) < 0.01, poz.x);
  sprawdz('otwór zostaje na osi ściany', Math.abs(poz.y - 400) < 0.01, poz.y);
  sprawdz('otwór mieści się na ścianie', poz.miesciSie === true);

  // to samo od prawej
  const zPrawej = app(`
    return positionFromCorner(
      { width:120, odKrawedzi:{ strona:'prawa', dystans:100 } }, objects.lines[0]);
  `);
  sprawdz('licząc od prawej otwór wypada po drugiej stronie',
    Math.abs(zPrawej.x - (400 + 6 * 50 - 1.6 * 50)) < 0.01, zPrawej.x);

  // otwór, który się nie mieści, ma być zgłoszony
  const zaDaleko = app(`
    return positionFromCorner(
      { width:120, odKrawedzi:{ strona:'lewa', dystans:580 } }, objects.lines[0]);
  `);
  sprawdz('otwór wychodzący poza ścianę jest wykryty', zaDaleko.miesciSie === false);

  // podpowiedź: gdzie otwór stoi teraz
  app(`
    const P = PIXELS_PER_METER, O = 400;
    objects.openings = [{ x:O+2*P, y:O, angle:0, id:'O1', width:100, height:140, typ:'okno' }];
  `);
  const podp = app("return odlegloscOdNaroznikow(objects.openings[0]);");
  sprawdz('podpowiedź podaje odległość od lewego narożnika',
    Math.abs(podp.lewa - 150) < 1, podp.lewa);
  sprawdz('podpowiedź podaje odległość od prawego narożnika',
    Math.abs(podp.prawa - 350) < 1, podp.prawa);

  // przeliczenie: otwór stoi w złym miejscu, podana odległość ma go poprawić
  app(`
    objects.lines = [{ x1:400, y1:400, x2:400 + 6*50, y2:400 }];
    objects.openings = [{ x:400 + 3*50, y:400, angle:0, id:'O1', width:120, height:140, typ:'okno',
                          odKrawedzi:{ strona:'lewa', dystans:100 } }];
    refreshCornerOpenings();
  `);
  sprawdz('otwór jest ustawiany zgodnie z podaną odległością od narożnika',
    Math.abs(app("return objects.openings[0].x;") - (400 + 1.6 * 50)) < 0.01,
    app("return objects.openings[0].x;"));

  // a po wydłużeniu ściany ma zostać w tej samej odległości od narożnika
  app("objects.lines[0].x2 = 400 + 9*50; refreshCornerOpenings();");
  sprawdz('po wydłużeniu ściany otwór zostaje przy swoim narożniku',
    Math.abs(app("return objects.openings[0].x;") - (400 + 1.6 * 50)) < 0.01,
    app("return objects.openings[0].x;"));

  // liczony od prawej ma pojechać razem z przesuniętym narożnikiem
  app(`
    objects.openings[0].odKrawedzi = { strona:'prawa', dystans:100 };
    refreshCornerOpenings();
  `);
  sprawdz('otwór liczony od prawej jedzie razem z tym narożnikiem',
    Math.abs(app("return objects.openings[0].x;") - (400 + 9 * 50 - 1.6 * 50)) < 0.01,
    app("return objects.openings[0].x;"));

  // otwór bez odległości nie może być przesuwany
  app(`
    objects.openings = [{ x:1234, y:400, angle:0, id:'O1', width:120, height:140, typ:'okno' }];
    refreshCornerOpenings();
  `);
  sprawdz('otwór bez podanej odległości zostaje na miejscu',
    app("return objects.openings[0].x;") === 1234);
}

// ===================== RYSOWANIE W SKALI I WYMIARY =====================
console.log('--- wymiary otworu na szkicu ---');
{
  nowySzkic();
  app(`
    const P = PIXELS_PER_METER, O = 400;
    objects.lines = [{ x1:O, y1:O, x2:O+6*P, y2:O }];
    objects.openings = [{ x:O+3*P, y:O, angle:0, id:'O1', width:120, height:140, typ:'okno' }];
  `);
  sprawdz('szerokość otworu liczy się w skali rysunku',
    Math.abs(app("return openingWidthPx(objects.openings[0]);") - 60) < 0.01,
    app("return openingWidthPx(objects.openings[0]);"));
  sprawdz('szerszy otwór jest szerszy na rysunku',
    app("return openingWidthPx({ width:200 }) > openingWidthPx({ width:100 });") === true);

  slad.length = 0;
  app("renderCanvasNow();");
  sprawdz('na szkicu widać oznaczenie otworu',
    slad.some(s => s.op === 'fillText' && s.t === 'O1'), JSON.stringify(slad.map(s => s.t)));
  sprawdz('na szkicu widać wymiary okna',
    slad.some(s => s.op === 'fillText' && s.t === '120×140 cm'), JSON.stringify(slad.map(s => s.t)));

  // drzwi też
  app("objects.openings[0] = Object.assign({}, objects.openings[0], { id:'DW1', typ:'drzwiWew', width:90, height:200 });");
  slad.length = 0;
  app("renderCanvasNow();");
  sprawdz('na szkicu widać wymiary drzwi wewnętrznych',
    slad.some(s => s.op === 'fillText' && s.t === '90×200 cm'), JSON.stringify(slad.map(s => s.t)));

  // otwór budowlany pokazuje samą szerokość
  app("objects.openings[0] = Object.assign({}, objects.openings[0], { id:'OB1', typ:'przejscie', width:150, height:0 });");
  slad.length = 0;
  app("renderCanvasNow();");
  sprawdz('otwór budowlany pokazuje szerokość',
    slad.some(s => s.op === 'fillText' && s.t === 'szer. 150 cm'), JSON.stringify(slad.map(s => s.t)));
  sprawdz('otwór budowlany nie pokazuje wysokości',
    !slad.some(s => s.op === 'fillText' && String(s.t).indexOf('×') > -1));

  // różne rodzaje mają różne kolory
  sprawdz('okno i drzwi mają różne kolory',
    app("return openingColor({ id:'O1' }) !== openingColor({ id:'DZ1' });") === true);
  sprawdz('drzwi zewnętrzne i wewnętrzne mają różne kolory',
    app("return openingColor({ id:'DZ1' }) !== openingColor({ id:'DW1' });") === true);
  sprawdz('otwór budowlany ma własny kolor',
    app("return openingColor({ id:'OB1' }) !== openingColor({ id:'O1' });") === true);
}

// ===================== ZAPIS, ODCZYT, ZAKRESY =====================
console.log('--- otwory w projekcie ---');
{
  nowySzkic();
  app(`
    const P = PIXELS_PER_METER, O = 400;
    objects.lines = [{ x1:O, y1:O, x2:O+6*P, y2:O }];
    objects.openings = [{ x:O+3*P, y:O, angle:0, id:'OB1', width:150, height:0, typ:'przejscie',
                          odKrawedzi:{ strona:'lewa', dystans:225 } }];
  `);
  const paczka = app("return JSON.stringify(projectPayload());");
  const dane = JSON.parse(paczka);
  sprawdz('rodzaj otworu trafia do pliku', dane.sketches[0].objects.openings[0].typ === 'przejscie');
  sprawdz('odległość od narożnika trafia do pliku',
    dane.sketches[0].objects.openings[0].odKrawedzi.dystans === 225);
  app(`sketches = []; applyProjectData(${paczka});`);
  sprawdz('rodzaj wraca z pliku',
    app("return typOtworu(sketches[0].objects.openings[0]);") === 'przejscie');
  sprawdz('strona narożnika wraca z pliku',
    app("return sketches[0].objects.openings[0].odKrawedzi.strona;") === 'lewa');

  // stary otwór bez pola typ ma dalej działać
  app(`applyProjectData({ format:'szkicownik', sketches:[{ id:9, name:'S', objects:{
    lines:[{x1:0,y1:0,x2:300,y2:0}],
    openings:[{ x:150, y:0, angle:0, id:'DZ2', width:90, height:200 }] } }] });`);
  sprawdz('stary otwór bez pola typ jest rozpoznany po oznaczeniu',
    app("return typOtworu(objects.openings[0]);") === 'drzwi');
  sprawdz('stary otwór nie robi przerwy w ścianie',
    app(`const l = objects.lines[0];
         return odcinkiBezPrzejsc({ x1:l.x1, y1:l.y1, x2:l.x2, y2:l.y2 }, l).length;`) === 1);

  // zbyt wąskie przejście musi być odrzucone
  sprawdz('minimalna szerokość otworu budowlanego jest określona',
    app("return PRZEJSCIE_MIN_CM;") >= 30, app("return PRZEJSCIE_MIN_CM;"));
  sprawdz('minimalna szerokość jest większa niż tolerancja scalania węzłów',
    app("return PRZEJSCIE_MIN_CM / 100 * PIXELS_PER_METER > GAP_TOL;") === true,
    app("return PRZEJSCIE_MIN_CM / 100 * PIXELS_PER_METER;"));

  // numeracja osobna dla każdego rodzaju
  nowySzkic();
  app(`objects.openings = [
    { x:0,y:0,angle:0,id:'O1',width:100,height:100,typ:'okno' },
    { x:0,y:0,angle:0,id:'O2',width:100,height:100,typ:'okno' },
    { x:0,y:0,angle:0,id:'OB1',width:150,height:0,typ:'przejscie' }];`);
  sprawdz('nowe okno dostaje kolejny numer', app("return nextOpeningId('okno');") === 'O3');
  sprawdz('nowy otwór budowlany ma własną numerację',
    app("return nextOpeningId('przejscie');") === 'OB2');
  sprawdz('drzwi wewnętrzne zaczynają od jedynki',
    app("return nextOpeningId('drzwiWew');") === 'DW1');
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
