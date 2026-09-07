/* Szkicownik - poprawianie tego, co już wstawione.
 * Uruchomienie:  node tests/test-korekty.js     (wymaga: npm install)
 *
 * Scenariusze wzięte wprost z pracy w terenie:
 *  - wstawione okno okazało się drzwiami,
 *  - pomieszczenie narysowane i zmierzone, a potem wyszła wnęka,
 *  - skasowana ściana, a powierzchnia została stara.
 * We wszystkich trzech chodzi o to samo: poprawić bez cofania całej pracy.
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
    globalOpeningsMemory = {};
  `);
}

// Prostokątne pomieszczenie 5×4 m, obrys rozpoznany przez samą aplikację
function pokoj5x4() {
  return app(`
    const P = PIXELS_PER_METER, O = 200;
    const L = (x1,y1,x2,y2) => objects.lines.push({x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P});
    L(0,0, 5,0); L(5,0, 5,4); L(5,4, 0,4); L(0,4, 0,0);
    const face = findEnclosingFace({ x:O+2.5*P, y:O+2*P });
    objects.rooms = [{ id:1, num:'1', name:'Pokój',
                       polygon: face, centroid: getVisualCenter(face) }];
    objects.customDims[getSegKey(O, O, O+5*P, O)] = { val:'5.00' };
    objects.customDims[getSegKey(O+5*P, O, O+5*P, O+4*P)] = { val:'4.00' };
    recalculateRooms();
    return objects.rooms[0].area;
  `);
}

// ===================== TYPY POMIESZCZEŃ =====================
console.log('--- typy pomieszczeń ---');
{
  const opcje = [...doc.querySelectorAll('#roomTypeSelect option')].map(o => o.value);
  sprawdz('na liście jest Piwnica', opcje.includes('Piwnica'), opcje.join(', '));
  sprawdz('na liście jest Garaż', opcje.includes('Garaż'));
  sprawdz('na liście jest strych / poddasze nieużytkowe',
    opcje.some(o => o.toLowerCase().includes('strych')));
  sprawdz('stare typy nie zniknęły',
    ['Pokój', 'Kuchnia', 'Łazienka', 'Kotłownia', 'Inny'].every(t => opcje.includes(t)));
}

// ===================== POPRAWIANIE OTWORU =====================
console.log('--- poprawianie wstawionego otworu ---');

// Okno wstawione przez pomyłkę zamiast drzwi
nowySzkic();
pokoj5x4();
app(`
  const P = PIXELS_PER_METER, O = 200;
  objects.openings = [{ x:O+2*P, y:O, angle:0, id:'O1', width:120, height:140 }];
`);
{
  const przed = app("return { id: objects.openings[0].id, w: objects.openings[0].width };");
  sprawdz('otwór wstawiony jako okno', przed.id === 'O1' && przed.w === 120);

  // klikamy w otwór narzędziem 🚪 Otwór
  app("openOpeningForEdit(0);");
  sprawdz('kliknięcie w otwór otwiera go do poprawki',
    doc.getElementById('openingOverlay').style.display === 'flex');
  sprawdz('okno wypełnia się danymi tego otworu',
    doc.getElementById('openingIdInput').value === 'O1' &&
    doc.getElementById('openingWidth').value === '120' &&
    doc.getElementById('openingHeight').value === '140');
  sprawdz('tytuł mówi o poprawianiu, nie o wstawianiu',
    doc.getElementById('openingDialogTitle').innerText.includes('Popraw'));
  sprawdz('przy poprawianiu jest przycisk usuwania',
    doc.getElementById('openingDeleteBtn').style.display === 'inline-block');

  // zmiana rodzaju: okno -> drzwi zewnętrzne
  app(`
    document.getElementById('openingTypeSelect').value = 'DZ';
    onOpeningTypeChange();
  `);
  sprawdz('zmiana rodzaju podpowiada nowy numer',
    doc.getElementById('openingIdInput').value === 'DZ1',
    doc.getElementById('openingIdInput').value);
  sprawdz('zmiana rodzaju NIE kasuje wpisanych wymiarów',
    doc.getElementById('openingWidth').value === '120' &&
    doc.getElementById('openingHeight').value === '140');

  // poprawiamy jeszcze wymiary i zapisujemy
  app(`
    document.getElementById('openingWidth').value = '90';
    document.getElementById('openingHeight').value = '200';
    addOpeningToCanvas();
  `);
  const po = app("return objects.openings.map(o => ({ id:o.id, w:o.width, h:o.height, x:o.x, y:o.y }));");
  sprawdz('poprawka nie tworzy drugiego otworu', po.length === 1, po.length);
  sprawdz('rodzaj otworu zmieniony na drzwi', po[0].id === 'DZ1', po[0].id);
  sprawdz('wymiary poprawione', po[0].w === 90 && po[0].h === 200, JSON.stringify(po[0]));
  sprawdz('otwór został na swoim miejscu',
    po[0].x === 200 + 2 * 50 && po[0].y === 200, JSON.stringify(po[0]));
  sprawdz('okno zamyka się po zapisie',
    doc.getElementById('openingOverlay').style.display === 'none');
}

// Wstawianie kolejnego otworu po poprawce musi wrócić do trybu "nowy"
{
  app(`
    editingOpeningIndex = -1; setOpeningDialogMode(false);
    document.getElementById('openingTypeSelect').value = 'O';
    pendingOpeningPos = { x:250, y:400 }; pendingOpeningAngle = 0;
    autoFillOpeningId();
    document.getElementById('openingWidth').value = '150';
    document.getElementById('openingHeight').value = '150';
    addOpeningToCanvas();
  `);
  const wszystkie = app("return objects.openings.map(o => o.id);");
  sprawdz('po poprawce dalej da się wstawiać nowe otwory',
    wszystkie.length === 2, wszystkie.join(', '));
  sprawdz('nowy otwór nie nadpisał poprawionego',
    wszystkie.includes('DZ1'), wszystkie.join(', '));
}

// Usuwanie otworu z okna poprawki
{
  app("openOpeningForEdit(1); deleteOpeningFromDialog();");
  sprawdz('otwór da się usunąć z okna poprawki',
    app("return objects.openings.length;") === 1);
}

// ===================== OBRYS PO ZMIANIE ŚCIAN =====================
console.log('--- obrys pomieszczenia po zmianie ścian ---');

// Sytuacja z terenu: pokój narysowany i zmierzony, potem wychodzi wnęka
nowySzkic();
{
  sprawdz('pokój 5×4 liczy się na 20,00 m²', pokoj5x4() === '20.00');
  sprawdz('świeżo założony obrys jest aktualny',
    app("return roomOutlineStale(objects.rooms[0]);") === false);

  // dorysowanie wnęki 1×1 m w narożniku
  app(`
    const P = PIXELS_PER_METER, O = 200;
    const L = (x1,y1,x2,y2) => objects.lines.push({x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P});
    L(4,4, 4,3); L(4,3, 5,3);
    recalculateRooms();
  `);
  sprawdz('po dorysowaniu wnęki obrys jest oznaczony jako nieaktualny',
    app("return roomOutlineStale(objects.rooms[0]);") === true);
  sprawdz('powierzchnia bez przeliczenia zostaje stara',
    app("return objects.rooms[0].area;") === '20.00');

  // klikamy 🔄
  const udane = app("return refreshRoomOutline(0, 0);");
  sprawdz('przeliczenie obrysu się udaje', udane === true);
  const po = app("return { rogi: objects.rooms[0].polygon.length, num: objects.rooms[0].num, typ: objects.rooms[0].name };");
  sprawdz('obrys ma teraz 6 rogów', po.rogi === 6, po.rogi);
  sprawdz('numer pomieszczenia zachowany', po.num === '1');
  sprawdz('typ pomieszczenia zachowany', po.typ === 'Pokój', po.typ);
  sprawdz('po przeliczeniu obrys jest aktualny',
    app("return roomOutlineStale(objects.rooms[0]);") === false);
}

// Skasowanie ściany - powierzchnia musi przestać udawać, że wszystko gra
nowySzkic();
{
  pokoj5x4();
  app(`
    const P = PIXELS_PER_METER, O = 200;
    const L = (x1,y1,x2,y2) => objects.lines.push({x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P});
    L(0,4, 0,7); L(0,7, 5,7); L(5,7, 5,4);      // drugi pokój pod spodem
    const f = findEnclosingFace({ x:O+2.5*P, y:O+5.5*P });
    objects.rooms.push({ id:2, num:'2', name:'Kuchnia',
                         polygon:f, centroid:getVisualCenter(f) });
    objects.customDims[getSegKey(O, O+4*P, O, O+7*P)] = { val:'3.00' };
    objects.customDims[getSegKey(O, O+7*P, O+5*P, O+7*P)] = { val:'5.00' };
    recalculateRooms();
  `);
  sprawdz('drugi pokój 5×3 = 15,00 m²', app("return objects.rooms[1].area;") === '15.00',
    app("return objects.rooms[1].area;"));

  // kasujemy ścianę między pokojami
  app(`
    const P = PIXELS_PER_METER, O = 200;
    const k = objects.lines.findIndex(l => Math.abs(l.y1 - (O+4*P)) < 1 && Math.abs(l.y2 - (O+4*P)) < 1);
    objects.lines.splice(k, 1);
    recalculateRooms();
    objects.rooms.forEach(r => { r._staleOutline = roomOutlineStale(r); });
  `);
  const stan = app("return objects.rooms.map(r => ({ num:r.num, area:r.area, nieakt: !!r._staleOutline }));");
  sprawdz('po skasowaniu ściany oba obrysy są oznaczone jako nieaktualne',
    stan.every(r => r.nieakt), JSON.stringify(stan));

  // przeliczenie zbiorcze
  app("dom_alert = null; refreshAllOutlines(0);");
  const po = app("return objects.rooms.map(r => ({ num:r.num, area:r.area, rogi:r.polygon.length }));");
  // po skasowaniu ściany oba pomieszczenia opisują ten sam, jeden obszar 5×7
  sprawdz('przeliczenie nie wywraca się na skasowanej ścianie', Array.isArray(po) && po.length === 2);
  sprawdz('obrysy zostały przeliczone na nowy kształt',
    po.every(r => r.rogi === 4), JSON.stringify(po));
  const kontrola = app("return runChecks().filter(i => i.level === 'error').map(i => i.text);");
  sprawdz('kontrola wyłapuje, że dwa pomieszczenia opisują ten sam obszar',
    kontrola.some(t => t.includes('ten sam obszar')), kontrola.join(' | '));
}

// Obrys otwarty - program nie może udawać, że przeliczył
nowySzkic();
{
  pokoj5x4();
  app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines.splice(0, 1);      // kasujemy górną ścianę, obrys się nie domyka
    recalculateRooms();
  `);
  sprawdz('otwarty obrys jest oznaczony jako nieaktualny',
    app("return roomOutlineStale(objects.rooms[0]);") === true);
  const wynik = app("window.__alert = null; return refreshRoomOutline(0, 0, false);");
  sprawdz('przy otwartym obrysie przeliczenie się nie udaje', wynik === false);
  sprawdz('program mówi, o co chodzi',
    (dom.window.__alert || '').includes('zamkniętego obszaru'), dom.window.__alert);
  sprawdz('stary obrys nie został skasowany',
    app("return objects.rooms[0].polygon.length;") === 4);
}

// Pomieszczenie wpisane ręcznie (bez obrysu) nie może być oznaczane
nowySzkic();
{
  app(`
    objects.rooms = [{ id:1, num:'1', name:'Piwnica',
                       manual:true, x:300, y:300, area:'12.50' }];
  `);
  sprawdz('ręcznie wpisane pomieszczenie nie jest zgłaszane jako nieaktualne',
    app("return roomOutlineStale(objects.rooms[0]);") === false);
  sprawdz('ręcznie wpisana powierzchnia zostaje nietknięta',
    app("recalculateRooms(); return objects.rooms[0].area;") === '12.50');
}


// ===================== POLE TEKSTOWE NA SZKICU =====================
console.log('--- pole tekstowe na szkicu ---');
nowySzkic();
{
  const d = dom.window.document;
  // wstawienie tekstu wielolinijkowego
  app(`
    currentMode = 'text';
    editingLabelIndex = -1;
    labelPosCanvas = { x: 300, y: 300 };
    populateLabelSelect();
    document.getElementById('labelInput').value = ['Strop drewniany','belki co 90 cm','od strony poddasza wełna'].join(String.fromCharCode(10));
    document.getElementById('labelSize').value = '28';
    document.getElementById('labelBox').checked = true;
    addTextToCanvas();
  `);
  const l = app("return objects.labels;");
  sprawdz('tekst trafia na szkic', l.length === 1, l.length);
  sprawdz('tekst zachowuje wszystkie linie',
    l[0].text.split(String.fromCharCode(10)).length === 3, JSON.stringify(l[0].text));
  sprawdz('zapisana jest wielkość liter', l[0].size === 28, l[0].size);
  sprawdz('zapisana jest informacja o ramce', l[0].box === true);

  // poprawianie istniejącego pola
  app("openLabelForEdit(0);");
  sprawdz('kliknięcie w pole otwiera je do poprawki',
    d.getElementById('labelOverlay').style.display === 'flex');
  sprawdz('okno wypełnia się treścią pola',
    d.getElementById('labelInput').value.includes('belki co 90 cm'));
  sprawdz('przy poprawce jest przycisk usuwania',
    d.getElementById('labelDeleteBtn').style.display === 'inline-block');

  app(`
    document.getElementById('labelInput').value = 'Strop drewniany - poprawione';
    document.getElementById('labelBox').checked = false;
    addTextToCanvas();
  `);
  const po = app("return objects.labels;");
  sprawdz('poprawka nie tworzy drugiego pola', po.length === 1, po.length);
  sprawdz('treść została zmieniona', po[0].text === 'Strop drewniany - poprawione', po[0].text);
  sprawdz('ramkę da się wyłączyć', po[0].box === false);
  sprawdz('pole zostało na swoim miejscu', po[0].x === 300 && po[0].y === 300);

  // gotowa pozycja z listy dopisuje się, zamiast kasować tekst
  app(`
    openLabelForEdit(0);
    document.getElementById('labelSelect').value = 'Dach';
    onLabelPresetPicked();
  `);
  sprawdz('podpowiedź z listy dopisuje się do tekstu',
    d.getElementById('labelInput').value.includes('poprawione') &&
    d.getElementById('labelInput').value.includes('Dach'),
    d.getElementById('labelInput').value);
  app("closeLabelDialog();");

  // wyczyszczenie treści = usunięcie pola
  app(`
    openLabelForEdit(0);
    document.getElementById('labelInput').value = '   ';
    addTextToCanvas();
  `);
  sprawdz('wyczyszczenie treści usuwa pole', app("return objects.labels.length;") === 0);

  // stare etykiety (bez pól size/box) muszą się nadal rysować
  app(`
    objects.labels = [{ x:100, y:100, text:'Stara etykieta' }];
    renderCanvas();
  `);
  sprawdz('etykiety ze starych szkiców nie wywracają rysowania',
    app("return objects.labels.length;") === 1);
}


// ===================== PROSTOWANIE ŚCIAN =====================
console.log('--- rysowanie ścian pod kątem prostym ---');
nowySzkic();
{
  // istniejąca ściana pionowa; rysujemy poziomą, której koniec wypada blisko
  // węzła tamtej ściany, ale NIE na jej wysokości
  app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = [{ x1:O+5*P, y1:O-3*P, x2:O+5*P, y2:O-0.4*P }];
    zoomLevel = 1;
  `);
  const koniec = app(`
    const P = PIXELS_PER_METER, O = 200;
    // palec: prawie poziomo, ale w pobliżu dolnego końca istniejącej ściany
    return koniecSciany({ x:O, y:O }, { x:O+5*P, y:O-16 });
  `);
  sprawdz('prawie pozioma ściana zostaje wyprostowana', koniec.prosto === true, JSON.stringify(koniec));
  sprawdz('koniec ma tę samą wysokość co początek', Math.abs(koniec.pt.y - 200) < 0.001,
    koniec.pt.y);

  // ten sam ruch, ale węzeł leży dokładnie na wyprostowanej linii - naroznik ma się domknąć
  app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = [{ x1:O+5*P, y1:O, x2:O+5*P, y2:O+3*P }];
  `);
  const domkniete = app(`
    const P = PIXELS_PER_METER, O = 200;
    return koniecSciany({ x:O, y:O }, { x:O+5*P-6, y:O+4 });
  `);
  sprawdz('narożnik nadal się domyka do istniejącego węzła',
    Math.abs(domkniete.pt.x - (200 + 5 * 50)) < 0.001 && Math.abs(domkniete.pt.y - 200) < 0.001,
    JSON.stringify(domkniete.pt));

  // wyraźny skos ma zostać skosem
  const skos = app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = [];
    return koniecSciany({ x:O, y:O }, { x:O+3*P, y:O+3*P });
  `);
  sprawdz('wyraźny skos nie jest spłaszczany do poziomu ani pionu',
    Math.abs(skos.pt.x - 200) > 1 && Math.abs(skos.pt.y - 200) > 1, JSON.stringify(skos.pt));
  sprawdz('skos zachowuje kierunek', Math.abs(skos.pt.x - 350) < 1 && Math.abs(skos.pt.y - 350) < 1,
    JSON.stringify(skos.pt));

  // przyciąganie do 45°: prawie-przekątna ma stać się dokładną przekątną
  const prawie = app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = []; diagSnapOn = true;
    return koniecSciany({ x:O, y:O }, { x:O+3*P, y:O+3*P-14 });
  `);
  sprawdz('prawie przekątna jest przyciągana do 45°', prawie.prosto === true, JSON.stringify(prawie));
  sprawdz('po przyciągnięciu kąt wynosi dokładnie 45°',
    Math.abs(Math.abs(prawie.pt.x - 200) - Math.abs(prawie.pt.y - 200)) < 0.001,
    JSON.stringify(prawie.pt));

  // kierunek wyraźnie inny niż 45° ma zostać nietknięty
  const wolny = app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = []; diagSnapOn = true;
    return koniecSciany({ x:O, y:O }, { x:O+2*P, y:O+1*P });
  `);
  sprawdz('kierunek daleki od 45° nie jest przyciągany', wolny.prosto === false, JSON.stringify(wolny));
  sprawdz('kierunek daleki od 45° zachowuje współrzędne',
    Math.abs(wolny.pt.x - 300) < 1 && Math.abs(wolny.pt.y - 250) < 1, JSON.stringify(wolny.pt));

  // wyłączony przełącznik przywraca dawne zachowanie
  const bezSnapu = app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = []; diagSnapOn = false;
    const r = koniecSciany({ x:O, y:O }, { x:O+3*P, y:O+3*P-14 });
    diagSnapOn = true;
    return r;
  `);
  sprawdz('przy wyłączonym 45° linia zostaje dowolna', bezSnapu.prosto === false, JSON.stringify(bezSnapu));
  sprawdz('przy wyłączonym 45° współrzędne są nietknięte',
    Math.abs(bezSnapu.pt.y - (200 + 3 * 50 - 14)) < 1, JSON.stringify(bezSnapu.pt));

  // ŚCIANA POZIOMA MA BYĆ POZIOMA, KROPKA.
  // Objaw z terenu: ściana rysowana jako pozioma wychodziła lekko ukośna
  // i nie dało się tego poprawić. Koniec był dociągany do węzła leżącego
  // OBOK linii, więc przechylał ją o różnicę wysokości.
  const doWezla = app(`
    objects.lines = [{ x1:400, y1:100, x2:400, y2:600 }];   // istniejąca ściana pionowa
    // rysujemy od prawej do lewej, kończąc 10 px pod jej górnym narożnikiem
    return koniecSciany({ x:700, y:110 }, { x:405, y:108 });
  `);
  sprawdz('ściana kończona przy węźle nadal jest zgłaszana jako prosta',
    doWezla.prosto === true, JSON.stringify(doWezla));
  sprawdz('ściana kończona przy węźle NIE przechyla się do niego',
    Math.abs(doWezla.pt.y - 110) < 0.001, JSON.stringify(doWezla.pt));
  sprawdz('koniec ściany dociąga się wzdłuż linii, do wysokości węzła',
    Math.abs(doWezla.pt.x - 400) < 0.001, JSON.stringify(doWezla.pt));

  // to samo, gdy koniec wypada blisko ŚCIANY, a nie jej narożnika
  const doSciany = app(`
    objects.lines = [{ x1:400, y1:100, x2:400, y2:600 }];
    return koniecSciany({ x:700, y:350 }, { x:420, y:347 });
  `);
  sprawdz('koniec przy ścianie też nie przechyla linii',
    Math.abs(doSciany.pt.y - 350) < 0.001, JSON.stringify(doSciany.pt));
  sprawdz('koniec przy ścianie dociąga się do niej wzdłuż linii',
    Math.abs(doSciany.pt.x - 400) < 0.001, JSON.stringify(doSciany.pt));

  // ściana pionowa ma ten sam przywilej
  const pionowa = app(`
    objects.lines = [{ x1:100, y1:400, x2:600, y2:400 }];
    return koniecSciany({ x:210, y:700 }, { x:208, y:405 });
  `);
  sprawdz('ściana pionowa kończona przy ścianie nie przechyla się',
    Math.abs(pionowa.pt.x - 210) < 0.001, JSON.stringify(pionowa.pt));

  // węzeł DALEKO w poprzek nie ma prawa niczego ruszać
  const daleko = app(`
    objects.lines = [{ x1:250, y1:100, x2:250, y2:140 }];
    return koniecSciany({ x:700, y:300 }, { x:405, y:298 });
  `);
  sprawdz('węzeł odległy w poprzek nie skraca ściany',
    Math.abs(daleko.pt.x - 405) < 0.001 && Math.abs(daleko.pt.y - 300) < 0.001,
    JSON.stringify(daleko.pt));

  // narożnik i tak się domknie - tym zajmuje się scalanie węzłów przy GAP_TOL
  const domyka = app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = [];
    objects.lines.push({ x1:O, y1:O, x2:O+5*P, y2:O });
    objects.lines.push({ x1:O+5*P, y1:O, x2:O+5*P, y2:O+4*P });
    objects.lines.push({ x1:O+5*P, y1:O+4*P, x2:O, y2:O+4*P });
    objects.lines.push({ x1:O, y1:O+4*P-9, x2:O, y2:O+3 });   // lewa ściana z luzem na obu końcach
    const face = findEnclosingFace({ x:O+2.5*P, y:O+2*P });
    return face ? face.length : 0;
  `);
  sprawdz('narożnik z luzem poniżej GAP_TOL nadal się domyka', domyka >= 4, domyka);

  // węzeł leżący OBOK linii (nie na jej przedłużeniu) - najostrzejszy przypadek,
  // bo to jego przyciąganie przechylało ścianę
  const wezelObok = app(`
    objects.lines = [{ x1:300, y1:100, x2:400, y2:100 }];   // krótka ściana kończąca się w (400,100)
    return koniecSciany({ x:700, y:110 }, { x:405, y:108 });
  `);
  sprawdz('węzeł 10 px obok linii nie przechyla ściany',
    Math.abs(wezelObok.pt.y - 110) < 0.001, JSON.stringify(wezelObok.pt));
  sprawdz('węzeł 10 px obok linii skraca ścianę do swojego pionu',
    Math.abs(wezelObok.pt.x - 400) < 0.001, JSON.stringify(wezelObok.pt));

  // prowadnice mają nadal działać w tym kierunku, w którym wolno
  const prowadnica = app(`
    objects.lines = [{ x1:400, y1:100, x2:400, y2:140 }];
    return koniecSciany({ x:700, y:300 }, { x:412, y:298 });
  `);
  sprawdz('prowadnica wyrównuje koniec ściany poziomej w poziomie',
    Math.abs(prowadnica.pt.x - 400) < 0.001, JSON.stringify(prowadnica.pt));
  sprawdz('prowadnica nie rusza wysokości ściany poziomej',
    Math.abs(prowadnica.pt.y - 300) < 0.001, JSON.stringify(prowadnica.pt));

  // pionowa ściana
  const pion = app(`
    const P = PIXELS_PER_METER, O = 200;
    objects.lines = [];
    return koniecSciany({ x:O, y:O }, { x:O+14, y:O+4*P });
  `);
  sprawdz('prawie pionowa ściana zostaje wyprostowana',
    pion.prosto === true && Math.abs(pion.pt.x - 200) < 0.001, JSON.stringify(pion));
}



// ===================== KOMENTARZ ZE STRZAŁKĄ =====================
console.log('--- komentarz ze strzałką ---');
nowySzkic();
{
  const d = dom.window.document;
  app(`
    currentMode = 'callout';
    openCalloutDialog({ x: 400, y: 300 });
    document.getElementById('calloutInput').value = 'ślady zawilgocenia';
    saveCallout();
  `);
  const lista = app("return objects.callouts;");
  sprawdz('komentarz trafia na szkic', lista.length === 1, lista.length);
  sprawdz('grot strzałki stoi we wskazanym punkcie',
    lista[0].tx === 400 && lista[0].ty === 300, JSON.stringify(lista[0]));
  sprawdz('chmurka stoi obok, żeby nie zasłaniać',
    lista[0].x !== lista[0].tx || lista[0].y !== lista[0].ty);
  sprawdz('treść komentarza jest zapisana', lista[0].text === 'ślady zawilgocenia');

  // trafianie palcem w chmurkę i w grot
  sprawdz('dotknięcie chmurki ją znajduje',
    app("return calloutHit({ x: objects.callouts[0].x, y: objects.callouts[0].y });") === 0);
  sprawdz('dotknięcie grotu znajduje strzałkę',
    app("return calloutTipHit({ x: 400, y: 300 });") === 0);
  sprawdz('dotknięcie z boku nie trafia w nic',
    app("return calloutHit({ x: 40, y: 900 });") === -1);

  // przesunięcie grotu w inne miejsce
  app("objects.callouts[0].tx = 250; objects.callouts[0].ty = 500;");
  sprawdz('grot da się przestawić',
    app("return objects.callouts[0].tx;") === 250);

  // poprawianie treści
  app(`
    openCalloutForEdit(0);
    document.getElementById('calloutInput').value = 'zawilgocenie — sprawdzić izolację';
    saveCallout();
  `);
  const po = app("return objects.callouts;");
  sprawdz('poprawka nie tworzy drugiego komentarza', po.length === 1, po.length);
  sprawdz('treść została poprawiona', po[0].text.includes('sprawdzić izolację'), po[0].text);
  sprawdz('grot został na przestawionym miejscu', po[0].tx === 250 && po[0].ty === 500);

  // wielolinijkowy komentarz
  app(`
    openCalloutDialog({ x: 100, y: 100 });
    document.getElementById('calloutInput').value = ['pierwsza linia','druga linia'].join(String.fromCharCode(10));
    saveCallout();
  `);
  sprawdz('komentarz może mieć kilka linii',
    app("return objects.callouts[1].text.split(String.fromCharCode(10)).length;") === 2);

  // pusta treść usuwa komentarz
  app(`
    openCalloutForEdit(1);
    document.getElementById('calloutInput').value = '  ';
    saveCallout();
  `);
  sprawdz('wyczyszczenie treści usuwa komentarz', app("return objects.callouts.length;") === 1);

  // usuwanie z okna i gumką
  app("openCalloutForEdit(0); deleteCalloutFromDialog();");
  sprawdz('komentarz da się usunąć z okna', app("return objects.callouts.length;") === 0);

  // rysowanie nie wywraca się na komentarzach
  app(`
    objects.callouts = [{ tx:300, ty:300, x:400, y:250, text:'test' }];
    renderCanvas();
  `);
  sprawdz('rysowanie z komentarzem nie wywraca płótna',
    app("return objects.callouts.length;") === 1);

  // szkic bez pola callouts (stary zapis) nie może psuć rysowania
  app("delete objects.callouts; renderCanvas();");
  sprawdz('stary szkic bez komentarzy rysuje się normalnie',
    app("return objects.callouts === undefined;") === true);
}


function podsumowanie() {
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

podsumowanie();
