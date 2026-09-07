/* Szkicownik - kontrola pomiarów.
 * Uruchomienie:  node tests/test-kontrola.js     (wymaga: npm install)
 *
 * Ten zestaw powstał po teście mutacyjnym: podmiana limitu długości ściany
 * z 30 m na 3 m przechodziła przez pozostałe zestawy niezauważona. Kontrola
 * pomiarów jest jedyną rzeczą, która na miejscu u klienta mówi „coś tu nie
 * gra", więc musi być pilnowana osobno.
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

let ok = 0, bledy = [];
function sprawdz(nazwa, warunek, szczegol) {
  if (warunek) ok++;
  else bledy.push(nazwa + (szczegol !== undefined ? ' -> ' + szczegol : ''));
}

function nowySzkic(rodzaj, wysokosc) {
  app(`
    sketches = [{ id:1, name:'Parter', kind:'${rodzaj || 'rzut'}', height:'${wysokosc === undefined ? '2.60' : wysokosc}',
      panX:0, panY:0, zoomLevel:1, showDimensions:true,
      objects: { lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                 noteLines:[], apexDims:{}, hatches:[], slopes:[], callouts:[] } }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
  `);
}

// Prostokąt o zadanych wymiarach RYSUNKOWYCH (metry) i wpisanych pomiarach
function prostokat(szerRys, wysRys, pomiarSzer, pomiarWys) {
  return app(`
    const P = PIXELS_PER_METER, O = 200;
    const a = ${szerRys}, b = ${wysRys};
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 objects.lines.push(l); return getSegKey(l.x1,l.y1,l.x2,l.y2); };
    const g = L(0,0, a,0), p = L(a,0, a,b), d = L(a,b, 0,b), l = L(0,b, 0,0);
    const face = findEnclosingFace({ x:O+a/2*P, y:O+b/2*P });
    objects.rooms = [{ id:1, num:'1', name:'Pokój', polygon: face, centroid: getVisualCenter(face) }];
    objects.customDims[g] = { val:'${pomiarSzer}' };
    objects.customDims[p] = { val:'${pomiarWys}' };
    recalculateRooms();
    return { g, p, d, l };
  `);
}

const uwagi = (poziom) => app(`return runChecks().filter(i => i.level === '${poziom}').map(i => i.text);`);
const wszystkie = () => app("return runChecks().map(i => i.level + ': ' + i.text);");

// ===================== ZAKRESY WARTOŚCI =====================
// To jest ta część, która przepuszczała podmianę limitu 30 m -> 3 m.
console.log('--- zakresy wpisywanych wartości ---');
{
  // ściana o rozsądnej długości nie może budzić żadnego alarmu
  nowySzkic();
  prostokat(5, 4, '5.00', '4.00');
  sprawdz('ściana 5 m nie jest zgłaszana jako za długa',
    !uwagi('warn').some(t => t.includes('więcej niż')), uwagi('warn').join(' | '));
  sprawdz('ściana 4 m nie jest zgłaszana jako za krótka',
    !uwagi('warn').some(t => t.includes('mniej niż')), uwagi('warn').join(' | '));

  // 25 m to nadal budynek, nie pomyłka - limit musi być NAD tą wartością
  nowySzkic();
  prostokat(25, 4, '25.00', '4.00');
  sprawdz('ściana 25 m przechodzi bez ostrzeżenia o długości',
    !uwagi('warn').some(t => t.includes('więcej niż')), uwagi('warn').join(' | '));

  // 45 m przy rysunku 25 m to pomyłka - musi być zgłoszona
  nowySzkic();
  prostokat(25, 4, '45.00', '4.00');
  sprawdz('ściana 45 m jest zgłaszana jako za długa',
    uwagi('warn').some(t => t.includes('więcej niż')), uwagi('warn').join(' | '));

  // zgubiony przecinek: 0,05 m zamiast 5 m
  nowySzkic();
  prostokat(5, 4, '0.05', '4.00');
  sprawdz('ściana 5 cm jest zgłaszana jako za krótka',
    uwagi('warn').some(t => t.includes('mniej niż')), uwagi('warn').join(' | '));

  // wysokość kondygnacji poza zakresem 1,8-5 m
  nowySzkic('rzut', '2.60');
  prostokat(5, 4, '5.00', '4.00');
  sprawdz('wysokość 2,60 m nie budzi zastrzeżeń',
    !uwagi('warn').some(t => t.includes('Wysokość')), uwagi('warn').join(' | '));

  nowySzkic('rzut', '26.00');
  prostokat(5, 4, '5.00', '4.00');
  sprawdz('wysokość 26 m jest zgłaszana jako nietypowa',
    uwagi('warn').some(t => t.includes('Wysokość')), uwagi('warn').join(' | '));

  nowySzkic('rzut', '0.26');
  prostokat(5, 4, '5.00', '4.00');
  sprawdz('wysokość 26 cm jest zgłaszana jako nietypowa',
    uwagi('warn').some(t => t.includes('Wysokość')), uwagi('warn').join(' | '));

  // otwory: 30-400 cm to zakres sensowny
  nowySzkic();
  prostokat(5, 4, '5.00', '4.00');
  app("objects.openings = [{ x:300, y:200, angle:0, id:'O1', width:120, height:140 }];");
  sprawdz('okno 120×140 cm nie budzi zastrzeżeń',
    !uwagi('warn').some(t => t.includes('poza typowym')), uwagi('warn').join(' | '));

  app("objects.openings = [{ x:300, y:200, angle:0, id:'O1', width:12, height:140 }];");
  sprawdz('okno 12 cm szerokości jest zgłaszane',
    uwagi('warn').some(t => t.includes('poza typowym')), uwagi('warn').join(' | '));

  app("objects.openings = [{ x:300, y:200, angle:0, id:'O1', width:120, height:1400 }];");
  sprawdz('okno 14 m wysokości jest zgłaszane',
    uwagi('warn').some(t => t.includes('poza typowym')), uwagi('warn').join(' | '));
}

// ===================== SPRZECZNOŚCI =====================
console.log('--- sprzeczności w pomiarach ---');
{
  // suma odcinków ma się zgadzać z całą ścianą
  nowySzkic();
  const wynik = app(`
    const P = PIXELS_PER_METER, O = 200;
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 objects.lines.push(l); return l; };
    const gora = L(0,0, 6,0);
    L(6,0, 6,4); L(6,4, 0,4); L(0,4, 0,0);
    L(2,0, 2,4);                                  // ścianka dzieli górną ścianę
    recalculateRooms();
    const segs = getSegmentsForLine(gora);
    const cala = getSegKey(gora.x1, gora.y1, gora.x2, gora.y2);
    objects.customDims[cala] = { val:'6.00' };
    objects.customDims[getSegKey(segs[0].x1, segs[0].y1, segs[0].x2, segs[0].y2)] = { val:'2.00' };
    objects.customDims[getSegKey(segs[1].x1, segs[1].y1, segs[1].x2, segs[1].y2)] = { val:'4.00' };
    return segs.length;
  `);
  sprawdz('górna ściana dzieli się na dwa odcinki', wynik === 2, wynik);
  sprawdz('zgodne odcinki nie są zgłaszane jako sprzeczność',
    !uwagi('error').some(t => t.includes('sprzecznie')), uwagi('error').join(' | '));

  // teraz psujemy jeden odcinek - suma przestaje się zgadzać
  app(`
    const P = PIXELS_PER_METER, O = 200;
    const gora = objects.lines[0];
    const segs = getSegmentsForLine(gora);
    objects.customDims[getSegKey(segs[1].x1, segs[1].y1, segs[1].x2, segs[1].y2)] = { val:'9.00' };
  `);
  sprawdz('rozjazd sumy odcinków i całej ściany jest zgłaszany jako sprzeczność',
    uwagi('error').some(t => t.includes('sprzecznie')), uwagi('error').join(' | '));

  // różnica 1 cm mieści się w tolerancji - nie ma o czym mówić
  app(`
    const gora = objects.lines[0];
    const segs = getSegmentsForLine(gora);
    objects.customDims[getSegKey(segs[1].x1, segs[1].y1, segs[1].x2, segs[1].y2)] = { val:'4.01' };
  `);
  sprawdz('różnica 1 cm mieści się w tolerancji',
    !uwagi('error').some(t => t.includes('sprzecznie')), uwagi('error').join(' | '));

  // powtórzony numer pomieszczenia
  nowySzkic();
  prostokat(5, 4, '5.00', '4.00');
  app("objects.rooms.push({ id:2, num:'1', name:'Kuchnia', manual:true, x:900, y:900, area:'8.00' });");
  sprawdz('powtórzony numer pomieszczenia jest zgłaszany',
    uwagi('error').some(t => t.includes('dwa razy')), uwagi('error').join(' | '));
}

// ===================== BRAKI =====================
console.log('--- braki ---');
{
  // rzut bez opisanego pomieszczenia
  nowySzkic();
  app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines.push({ x1:O, y1:O, x2:O+5*P, y2:O });
  `);
  sprawdz('rzut bez pomieszczeń jest zgłaszany jako brak',
    uwagi('info').some(t => t.includes('nie opisano')), uwagi('info').join(' | '));

  // brak wysokości kondygnacji
  nowySzkic('rzut', '');
  prostokat(5, 4, '5.00', '4.00');
  sprawdz('brak wysokości kondygnacji jest przypominany',
    uwagi('info').some(t => t.includes('Brak wysokości')), uwagi('info').join(' | '));

  // przekrój nie ma kondygnacji, więc nie może o nią pytać
  nowySzkic('przekroj', '');
  prostokat(5, 4, '5.00', '4.00');
  sprawdz('przekrój nie pyta o wysokość kondygnacji',
    !uwagi('info').some(t => t.includes('Brak wysokości')), uwagi('info').join(' | '));

  // pomieszczenie bez kompletu pomiarów
  nowySzkic();
  app(`
    const P = PIXELS_PER_METER, O = 200;
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 objects.lines.push(l); return getSegKey(l.x1,l.y1,l.x2,l.y2); };
    const g = L(0,0, 5,0); L(5,0, 5,4); L(5,4, 0,4); L(0,4, 0,0);
    const face = findEnclosingFace({ x:O+2.5*P, y:O+2*P });
    objects.rooms = [{ id:1, num:'1', name:'Pokój', polygon: face, centroid: getVisualCenter(face) }];
    objects.customDims[g] = { val:'5.00' };      // tylko jeden pomiar
    recalculateRooms();
  `);
  sprawdz('niepełny komplet pomiarów jest zgłaszany',
    uwagi('info').some(t => t.includes('brak kompletu')), uwagi('info').join(' | '));
  sprawdz('powierzchnia bez kompletu nie jest zmyślana',
    app("return objects.rooms[0].area;") === 'Wymaga pomiaru!',
    app("return objects.rooms[0].area;"));
}

// ===================== POPRAWNY SZKIC MILCZY =====================
console.log('--- poprawny szkic bez fałszywych alarmów ---');
{
  nowySzkic('rzut', '2.60');
  prostokat(5, 4, '5.00', '4.00');
  app("objects.openings = [{ x:300, y:200, angle:0, id:'O1', width:120, height:140 }];");
  const lista = wszystkie();
  sprawdz('poprawnie zmierzony pokój nie zbiera żadnych uwag',
    lista.length === 0, lista.join(' | '));
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
