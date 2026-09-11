/* Szkicownik - odczyt od narożnika, sumowanie z dalmierza, pełny ekran.
 * Uruchomienie:  node tests/test-teren.js     (wymaga: npm install)
 *
 * Trzy rzeczy zgłoszone z terenu:
 *  1. Odczyt odległości przeskakiwał w połowie ściany na drugi narożnik,
 *     więc nie dało się wyznaczyć miejsca, w którym ma się zacząć nowa ściana.
 *  2. Dalmierz brał pierwszy strzał, a ścianę często mierzy się na kilka razy.
 *  3. „Pełny ekran" wcale nie był pełny.
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
  const c = { canvas: { width: 3000, height: 3000 }, measureText: t => ({ width: String(t).length * 7 }),
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
    // w jsdom nie ma API pełnoekranowego - podstawiamy zaślepkę już po parsowaniu
    w.__fsStub = true;
  }
});
dom.window.document.documentElement.requestFullscreen = () => Promise.resolve();
dom.window.document.exitFullscreen = () => Promise.resolve();
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
    currentMode = 'line'; resetWallHoverAnchor();
  `);
}

// ===================== ODCZYT OD NAROŻNIKA =====================
console.log('--- odległość liczona od tego narożnika, od którego zacząłeś ---');
{
  nowySzkic();
  // pozioma ściana 6 m: lewy narożnik x=400, prawy x=700
  app("objects.lines = [{ x1:400, y1:400, x2:700, y2:400 }];");

  // wchodzimy od LEWEJ strony i przesuwamy się w prawo, aż za połowę
  const odLewej = app(`
    resetWallHoverAnchor();
    const wyniki = [];
    [420, 500, 549, 551, 620, 690].forEach(x => {
      updateWallHover({ x: x, y: 400 });
      wyniki.push(wallHover ? { x: x, od: Math.round(wallHover.corner.x), d: +wallHover.dist.toFixed(2) } : null);
    });
    return wyniki;
  `);
  sprawdz('wchodząc od lewej, punkt odniesienia to lewy narożnik',
    odLewej.every(w => w && w.od === 400), JSON.stringify(odLewej));
  sprawdz('za połową ściany odczyt NIE przeskakuje na drugi narożnik',
    odLewej[3].od === 400 && odLewej[5].od === 400, JSON.stringify(odLewej.slice(3)));
  sprawdz('odległość rośnie aż do drugiego końca ściany',
    odLewej[5].d > odLewej[0].d && Math.abs(odLewej[5].d - 5.8) < 0.02, JSON.stringify(odLewej));

  // teraz wchodzimy od PRAWEJ
  const odPrawej = app(`
    resetWallHoverAnchor();
    const wyniki = [];
    [690, 620, 551, 549, 500, 420].forEach(x => {
      updateWallHover({ x: x, y: 400 });
      wyniki.push(wallHover ? { x: x, od: Math.round(wallHover.corner.x), d: +wallHover.dist.toFixed(2) } : null);
    });
    return wyniki;
  `);
  sprawdz('wchodząc od prawej, punkt odniesienia to prawy narożnik',
    odPrawej.every(w => w && w.od === 700), JSON.stringify(odPrawej));
  sprawdz('idąc od prawej odczyt też nie przeskakuje w połowie',
    odPrawej[2].od === 700 && odPrawej[5].od === 700, JSON.stringify(odPrawej.slice(2)));
  sprawdz('odległość od prawego rośnie aż do lewego końca',
    Math.abs(odPrawej[5].d - 5.6) < 0.02, odPrawej[5].d);

  // ten sam punkt daje RÓŻNY odczyt zależnie od tego, skąd przyszedłeś -
  // i to jest poprawne, bo mierzysz od innego rogu
  const tenSamPunkt = app(`
    resetWallHoverAnchor(); updateWallHover({ x:420, y:400 }); updateWallHover({ x:620, y:400 });
    const a = +wallHover.dist.toFixed(2);
    resetWallHoverAnchor(); updateWallHover({ x:690, y:400 }); updateWallHover({ x:620, y:400 });
    const b = +wallHover.dist.toFixed(2);
    return { a: a, b: b };
  `);
  sprawdz('ten sam punkt mierzony od lewej to 4,40 m',
    Math.abs(tenSamPunkt.a - 4.4) < 0.02, tenSamPunkt.a);
  sprawdz('ten sam punkt mierzony od prawej to 1,60 m',
    Math.abs(tenSamPunkt.b - 1.6) < 0.02, tenSamPunkt.b);
  sprawdz('suma obu odczytów to długość ściany',
    Math.abs(tenSamPunkt.a + tenSamPunkt.b - 6) < 0.02, tenSamPunkt.a + tenSamPunkt.b);

  // odczyt podaje też całą długość - przydaje się przy wyznaczaniu miejsca
  sprawdz('odczyt niesie długość całej ściany',
    Math.abs(app("return wallHover.calosc;") - 6) < 0.02, app("return wallHover.calosc;"));

  // zejście ze ściany kasuje punkt odniesienia
  app("resetWallHoverAnchor(); updateWallHover({ x:420, y:400 });");
  sprawdz('po zejściu ze ściany odniesienie jest ustalane od nowa',
    app(`updateWallHover({ x:420, y:3000 });
         resetWallHoverAnchor();
         updateWallHover({ x:690, y:400 });
         return Math.round(wallHover.corner.x);`) === 700);

  // przejście na INNĄ ścianę też ustala odniesienie od nowa
  app(`
    objects.lines = [{ x1:400, y1:400, x2:700, y2:400 },
                     { x1:700, y1:400, x2:700, y2:700 }];
    resetWallHoverAnchor();
    updateWallHover({ x:420, y:400 });
  `);
  const naInnej = app(`
    updateWallHover({ x:700, y:680 });
    return wallHover ? { x: Math.round(wallHover.corner.x), y: Math.round(wallHover.corner.y) } : null;
  `);
  sprawdz('po przejściu na inną ścianę odniesienie liczy się od jej narożnika',
    naInnej && naInnej.y === 700, JSON.stringify(naInnej));
}

// ===================== SUMOWANIE POMIARÓW =====================
console.log('--- dalmierz: ściana mierzona na kilka razy ---');
{
  nowySzkic();
  app("setDistoSuma(false); distoWyzerujSume();");
  sprawdz('tryb sumowania jest domyślnie wyłączony',
    app("return distoSumaOn;") === false);

  // przy wyłączonym trybie pierwszy odczyt trafia od razu do pola
  app(`
    setDistoSuma(false);
    document.getElementById('modalDimInput').value = '';
    document.getElementById('dimEditOverlay').style.display = 'flex';
    distoDeliverMeasurement(3.21);
  `);
  sprawdz('bez sumowania pomiar trafia od razu do pola',
    doc.getElementById('modalDimInput').value === '3.21',
    doc.getElementById('modalDimInput').value);

  // z sumowaniem: trzy strzały po 1 m i dopiero suma
  app(`
    document.getElementById('modalDimInput').value = '';
    setDistoSuma(true);
    distoDeliverMeasurement(1.00);
    distoDeliverMeasurement(1.00);
    distoDeliverMeasurement(1.00);
  `);
  sprawdz('w trybie sumowania pojedyncze pomiary NIE trafiają do pola',
    doc.getElementById('modalDimInput').value === '',
    doc.getElementById('modalDimInput').value);
  sprawdz('suma jest widoczna na bieżąco',
    doc.getElementById('distoSumaValue').innerText === '3.00 m',
    doc.getElementById('distoSumaValue').innerText);
  sprawdz('widać, z czego złożona jest suma',
    doc.getElementById('distoSumaSklad').innerText.indexOf('1.00 + 1.00 + 1.00') > -1,
    doc.getElementById('distoSumaSklad').innerText);

  app("distoZatwierdzSume();");
  sprawdz('dopiero zatwierdzenie wpisuje sumę do pola',
    doc.getElementById('modalDimInput').value === '3.00',
    doc.getElementById('modalDimInput').value);
  sprawdz('po zatwierdzeniu suma wraca do zera',
    doc.getElementById('distoSumaValue').innerText === '0.00 m');
  sprawdz('tryb sumowania zostaje włączony na kolejną ścianę',
    app("return distoSumaOn;") === true);

  // pomyłkowy strzał da się cofnąć
  app("distoWyzerujSume(); distoDeliverMeasurement(1.50); distoDeliverMeasurement(9.99); distoCofnijPomiar();");
  sprawdz('cofnięcie usuwa ostatni pomiar, nie całą sumę',
    doc.getElementById('distoSumaValue').innerText === '1.50 m',
    doc.getElementById('distoSumaValue').innerText);

  app("distoWyzerujSume();");
  sprawdz('wyzerowanie czyści całą sumę',
    doc.getElementById('distoSumaValue').innerText === '0.00 m');

  // zatwierdzenie pustej sumy ma być odrzucone, a nie wpisać zero
  app(`
    distoWyzerujSume();
    document.getElementById('modalDimInput').value = '1.11';
    window.__alert = null;
    distoZatwierdzSume();
  `);
  sprawdz('pusta suma nie jest wpisywana',
    doc.getElementById('modalDimInput').value === '1.11',
    doc.getElementById('modalDimInput').value);
  sprawdz('program tłumaczy, czemu nie zatwierdził',
    (dom.window.__alert || '').indexOf('zmierz') > -1 || (dom.window.__alert || '').indexOf('Nie ma') > -1,
    dom.window.__alert);

  // wyłączenie trybu porzuca niedokończoną sumę
  app("setDistoSuma(true); distoDeliverMeasurement(2.00); setDistoSuma(false);");
  sprawdz('wyłączenie trybu czyści niedokończoną sumę',
    doc.getElementById('distoSumaValue').innerText === '0.00 m');
  app("document.getElementById('dimEditOverlay').style.display = 'none';");
}

// ===================== PEŁNY EKRAN =====================
console.log('--- pełny ekran naprawdę pełny ---');
{
  nowySzkic();
  const wrapper = doc.getElementById('fullscreenWrapper');
  sprawdz('na starcie nie jesteśmy w pełnym ekranie',
    app("return fullscreenOn();") === false);
  sprawdz('panel narzędzi istnieje', !!doc.getElementById('fsPanel'));
  sprawdz('pasek narzędzi siedzi na swoim miejscu',
    doc.getElementById('toolbarBox').parentNode.id === 'toolbarHome');

  app("toggleFullscreen();");
  sprawdz('tryb pełnoekranowy się włącza', app("return fullscreenOn();") === true);
  sprawdz('strona dostaje znacznik pełnego ekranu',
    doc.body.classList.contains('fs-active'));
  sprawdz('płótno przestaje się przewijać razem ze stroną',
    doc.body.style.overflow === 'hidden');
  sprawdz('panel startuje zamknięty — płótno ma być całe',
    app("return fsPanelOn;") === false);
  sprawdz('przycisk zmienia się na zamykający',
    doc.getElementById('btnFullscreen').innerText.indexOf('Zamknij') > -1,
    doc.getElementById('btnFullscreen').innerText);

  app("toggleFsPanel();");
  sprawdz('panel się wysuwa', app("return fsPanelOn;") === true);
  sprawdz('panel dostaje klasę otwartego', doc.getElementById('fsPanel').classList.contains('open'));
  sprawdz('pasek narzędzi przenosi się do panelu w całości',
    doc.getElementById('toolbarBox').parentNode.id === 'fsPanelBody');
  sprawdz('narzędzia są dostępne z panelu',
    !!doc.getElementById('fsPanelBody').querySelector('#btnModeLine'));
  sprawdz('przyciski nie są zdublowane',
    doc.querySelectorAll('#btnModeLine').length === 1,
    doc.querySelectorAll('#btnModeLine').length);

  app("toggleFsPanel();");
  sprawdz('panel się chowa', app("return fsPanelOn;") === false);
  sprawdz('pasek wraca na swoje miejsce, gdy panel się chowa',
    doc.getElementById('toolbarBox').parentNode.id === 'toolbarHome');

  app("toggleFullscreen();");
  sprawdz('wyjście z pełnego ekranu działa', app("return fullscreenOn();") === false);
  sprawdz('znacznik pełnego ekranu znika', !doc.body.classList.contains('fs-active'));
  sprawdz('przewijanie strony wraca', doc.body.style.overflow === 'auto');
  sprawdz('pasek narzędzi jest z powrotem na swoim miejscu',
    doc.getElementById('toolbarBox').parentNode.id === 'toolbarHome');
  sprawdz('rysowanie po wyjściu nadal działa',
    app("objects.lines = [{ x1:0,y1:0,x2:100,y2:0 }]; renderCanvasNow(); return objects.lines.length;") === 1);
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
