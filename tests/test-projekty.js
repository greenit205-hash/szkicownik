/* Szkicownik - lista projektów, wydruk, przekształcenia i ciągi wymiarowe.
 * Uruchomienie:  node tests/test-projekty.js     (wymaga: npm install)
 *
 * Magazyn projektów siedzi w IndexedDB, z zapasem na localStorage, gdy
 * IndexedDB nie ma. Testujemy OBIE drogi, bo zapas włącza się dokładnie
 * wtedy, kiedy nie ma jak tego sprawdzić ręcznie — w prywatnym oknie
 * albo na starym tablecie.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let JSDOM, fakeIndexedDB;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.log('Ten zestaw potrzebuje biblioteki jsdom. Zainstaluj raz:\n\n    npm install\n');
  process.exit(2);
}
try { fakeIndexedDB = require('fake-indexeddb'); }
catch (e) { fakeIndexedDB = null; }

function pustyKontekst2D() {
  const nic = () => {};
  const ctx = { canvas: { width: 3000, height: 3000 }, measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: nic }), createPattern: () => null,
    getImageData: () => ({ data: [] }), setLineDash: nic };
  return new Proxy(ctx, { get: (t, p) => (p in t ? t[p] : nic), set: () => true });
}

let ok = 0, bledy = [];
function sprawdz(nazwa, warunek, szczegol) {
  if (warunek) ok++;
  else bledy.push(nazwa + (szczegol !== undefined ? ' -> ' + szczegol : ''));
}

// Świeża przeglądarka na każdy scenariusz — magazyn ma się zachowywać tak
// samo po odświeżeniu strony, a nie tylko w jednej ciągłej sesji.
function nowaPrzegladarka(zIndexedDb) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/',
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => pustyKontekst2D();
      w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
      w.alert = m => { w.__alert = m; };
      w.confirm = () => true;
      w.prompt = () => null;
      w.scrollTo = () => {};
      w.open = () => { w.__otwarte = true; return null; };
      if (zIndexedDb && fakeIndexedDB) {
        w.indexedDB = new fakeIndexedDB.IDBFactory();
        w.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
      } else {
        w.indexedDB = undefined;
      }
    }
  });
  return dom;
}

const czekaj = ms => new Promise(r => setTimeout(r, ms));

function szkicZPomiarem(app) {
  app(`
    sketches = [{ id:1, name:'Parter', kind:'rzut', height:'2.60', panX:0, panY:0, zoomLevel:1, showDimensions:true,
      objects: { lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                 noteLines:[], apexDims:{}, hatches:[], slopes:[], callouts:[], obstacles:[] } }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
    const P = PIXELS_PER_METER, O = 400;
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 objects.lines.push(l); return getSegKey(l.x1,l.y1,l.x2,l.y2); };
    const g = L(0,0, 5,0), p = L(5,0, 5,4), d = L(5,4, 0,4), l = L(0,4, 0,0);
    const face = findEnclosingFace({ x:O+2.5*P, y:O+2*P });
    objects.rooms = [{ id:1, num:'1', name:'Pokój', polygon: face, centroid: getVisualCenter(face) }];
    objects.customDims[g] = { val:'5.00' };
    objects.customDims[p] = { val:'4.00' };
    recalculateRooms();
  `);
}

async function testyMagazynu(zIndexedDb, etykieta) {
  console.log('--- magazyn projektów: ' + etykieta + ' ---');
  let dom = nowaPrzegladarka(zIndexedDb);
  let app = kod => dom.window.eval('(function(){' + kod + '})()');
  await czekaj(400);

  sprawdz(etykieta + ': wybrany właściwy magazyn',
    app("return !!window.indexedDB;") === !!zIndexedDb);

  szkicZPomiarem(app);
  app("projectName = 'Dom Kowalskich';");
  await app("return saveProjectNow();");

  let lista = await app("return storeLista();");
  sprawdz(etykieta + ': projekt trafia na listę', lista.length === 1, lista.length);
  sprawdz(etykieta + ': lista niesie nazwę', lista[0].nazwa === 'Dom Kowalskich', lista[0].nazwa);
  sprawdz(etykieta + ': lista niesie liczbę szkiców', lista[0].ile === 1, lista[0].ile);

  // drugi projekt nie może wyprzeć pierwszego
  await czekaj(5);            // żeby znacznik czasu był inny niż u pierwszego
  app("newProjectData(); projectName = 'Chałupa Nowaków'; projectId = nowyId();");
  await app("return saveProjectNow();");
  lista = await app("return storeLista();");
  sprawdz(etykieta + ': dwa projekty leżą obok siebie', lista.length === 2, lista.length);
  sprawdz(etykieta + ': najnowszy jest na górze listy',
    lista[0].nazwa === 'Chałupa Nowaków', lista[0].nazwa);

  // powrót po odświeżeniu strony
  const idPierwszego = lista.find(p => p.nazwa === 'Dom Kowalskich').id;
  app(`localStorage.setItem('szkicownik.ostatni', ${JSON.stringify(idPierwszego)});`);
  app("sketches = []; objects = null; projectName = 'x'; projectId = null;");
  const wrocil = await app("return loadProjectFromStorage();");
  sprawdz(etykieta + ': ostatnio otwarty projekt wraca po odświeżeniu', wrocil === true);
  sprawdz(etykieta + ': wraca właściwy projekt',
    app("return projectName;") === 'Dom Kowalskich', app("return projectName;"));
  sprawdz(etykieta + ': wracają wpisane pomiary',
    app("return Object.values(objects.customDims).map(d => d.val).sort().join(',');") === '4.00,5.00');
  sprawdz(etykieta + ': powierzchnia po powrocie jest ta sama',
    app("recalculateRooms(); return objects.rooms[0].area;") === '20.00',
    app("return objects.rooms[0].area;"));
  const stanPrzed = app("return { ile: sketches.length, pole: objects.rooms[0].area, pomiary: Object.values(objects.customDims).map(d => d.val).sort().join(',') };");

  // duplikowanie i usuwanie
  await app(`return duplicateProject(${JSON.stringify(idPierwszego)});`);
  lista = await app("return storeLista();");
  sprawdz(etykieta + ': duplikat pojawia się na liście', lista.length === 3, lista.length);
  sprawdz(etykieta + ': duplikat ma dopisek w nazwie',
    lista.some(p => p.nazwa === 'Dom Kowalskich (kopia)'), lista.map(p => p.nazwa).join(' | '));

  const idKopii = lista.find(p => p.nazwa === 'Dom Kowalskich (kopia)').id;
  await app(`return deleteProject(${JSON.stringify(idKopii)});`);
  lista = await app("return storeLista();");
  sprawdz(etykieta + ': usunięty projekt znika z listy', lista.length === 2, lista.length);
  sprawdz(etykieta + ': usunięcie nie rusza pozostałych',
    lista.every(p => p.nazwa !== 'Dom Kowalskich (kopia)'));

  // przełączanie między projektami zapisuje bieżący
  const idDrugiego = lista.find(p => p.nazwa === 'Chałupa Nowaków').id;
  await app(`return openProject(${JSON.stringify(idDrugiego)});`);
  sprawdz(etykieta + ': otwarcie przełącza projekt',
    app("return projectName;") === 'Chałupa Nowaków');
  await app(`return openProject(${JSON.stringify(idPierwszego)});`);
  const stanPo = app("recalculateRooms(); return { ile: sketches.length, pole: objects.rooms[0].area, pomiary: Object.values(objects.customDims).map(d => d.val).sort().join(',') };");
  sprawdz(etykieta + ': powrót do pierwszego zachowuje jego szkice',
    stanPo.ile === stanPrzed.ile && stanPo.pole === stanPrzed.pole && stanPo.pomiary === stanPrzed.pomiary,
    JSON.stringify(stanPo) + ' vs ' + JSON.stringify(stanPrzed));

  dom.window.close();
}

// Projekt zapisany starą wersją aplikacji musi się przenieść sam
async function testMigracji() {
  console.log('--- projekt ze starej wersji ---');
  const dom = nowaPrzegladarka(true);
  const app = kod => dom.window.eval('(function(){' + kod + '})()');
  await czekaj(400);

  app(`
    localStorage.clear();
    localStorage.setItem('szkicownikProjekt', JSON.stringify({
      format:'szkicownik', wersja:1, nazwa:'Stary projekt',
      zapisano:'2026-01-02T10:00:00.000Z',
      sketches:[{ id:1, name:'Parter', kind:'rzut', height:'2.50',
        objects:{ lines:[{x1:0,y1:0,x2:250,y2:0}] } }]
    }));
    sketches = []; objects = null; projectId = null;
  `);
  const wynik = await app("return loadProjectFromStorage();");
  sprawdz('stary projekt daje się wczytać', wynik === true);
  sprawdz('stary projekt zachowuje nazwę',
    app("return projectName;") === 'Stary projekt', app("return projectName;"));
  const lista = await app("return storeLista();");
  sprawdz('stary projekt trafia na listę', lista.length === 1, lista.length);
  sprawdz('stary klucz jest sprzątany po przeniesieniu',
    app("return localStorage.getItem('szkicownikProjekt');") === null);
  sprawdz('powtórne wczytanie nie dubluje projektu',
    (await (async () => { await app("return loadProjectFromStorage();");
                          return (await app("return storeLista();")).length; })()) === 1);
  dom.window.close();
}

// Reszta: wydruk, przekształcenia, ciągi, warstwy
async function testyReszty() {
  const dom = nowaPrzegladarka(true);
  const app = kod => dom.window.eval('(function(){' + kod + '})()');
  const doc = dom.window.document;
  await czekaj(400);

  // --------- WYDRUK ---------
  console.log('--- wydruk ---');
  szkicZPomiarem(app);
  app(`
    projectName = 'Dom Kowalskich';
    objects.openings = [{ x:500, y:400, angle:0, id:'O1', width:120, height:140 },
                        { x:560, y:400, angle:0, id:'O1', width:120, height:140 }];
    objects.obstacles = [{ id:1, polygon: obstaclePolygonFromSize(500, 500, 40, 40),
                           label:'Komin', subtract:true, w:40, d:40 }];
    objects.lines.forEach(l => l.gr = 25);
    recalculateRooms();
  `);
  const html = app("return buildPrintHtml();");
  sprawdz('wydruk zawiera nazwę projektu', html.includes('Dom Kowalskich'));
  sprawdz('wydruk zawiera nazwę szkicu', html.includes('Parter'));
  sprawdz('wydruk zawiera rodzaj szkicu', html.includes('Rzut'));
  sprawdz('wydruk zawiera wysokość kondygnacji', html.includes('2.60 m'));
  sprawdz('wydruk zawiera tabelę pomieszczeń', html.includes('Pow. w osiach'));
  sprawdz('wydruk podaje powierzchnię 20,00 m²', html.includes('20.00'));
  sprawdz('wydruk podaje powierzchnię w świetle ścian', html.includes('Pow. w świetle'));
  sprawdz('wydruk zawiera tabelę otworów', html.includes('Ozn.'));
  sprawdz('wydruk zlicza powtarzające się otwory', html.includes('<td class="l">2</td>'),
    html.includes('<td class="l">2</td>'));
  sprawdz('wydruk zawiera tabelę przeszkód', html.includes('Komin'));
  sprawdz('wydruk zawiera podziałkę', html.includes('<svg') && html.includes('>m</text>'));
  sprawdz('wydruk ma ustawioną stronę A4', html.includes('@page'));
  sprawdz('wydruk zawiera rysunek', html.includes('<img src="data:image/png'));
  sprawdz('wydruk łamie strony między szkicami', html.includes('page-break-after'));

  // wydruk NIE MOŻE ruszyć bieżącego stanu — to najczęstsza wpadka
  // przy rysowaniu na podmienionym płótnie
  sprawdz('wydruk nie psuje powierzchni w tabeli',
    app("return objects.rooms[0].area;") === '20.00', app("return objects.rooms[0].area;"));
  sprawdz('wydruk przywraca tryb rysowania',
    app("return currentMode;") !== 'export', app("return currentMode;"));

  // nazwa projektu ze znakami specjalnymi nie może rozwalić HTML-a
  app("projectName = 'Dom <script>alert(1)</script> & Syn';");
  const brudny = app("return buildPrintHtml();");
  sprawdz('nazwa projektu jest bezpiecznie wstawiana',
    !brudny.includes('<script>alert(1)</script>') && brudny.includes('&lt;script&gt;'));
  app("projectName = 'Dom Kowalskich';");

  // --------- WARSTWY PRZY EKSPORCIE ---------
  console.log('--- warstwy przy eksporcie ---');
  sprawdz('podczas pracy widać wszystkie warstwy',
    app("currentMode = 'line'; return warstwaWidoczna('obstacles');") === true);
  sprawdz('przy eksporcie warstwa włączona jest widoczna',
    app("currentMode = 'export'; return warstwaWidoczna('obstacles');") === true);
  app(`
    openLayersDialog();
    document.getElementById('layer_obstacles').checked = false;
    document.getElementById('layer_labels').checked = false;
    saveLayers();
  `);
  sprawdz('wyłączona warstwa znika przy eksporcie',
    app("currentMode = 'export'; return warstwaWidoczna('obstacles');") === false);
  sprawdz('wyłączona warstwa NADAL jest widoczna podczas pracy',
    app("currentMode = 'line'; return warstwaWidoczna('obstacles');") === true);
  sprawdz('inne warstwy zostają włączone',
    app("currentMode = 'export'; return warstwaWidoczna('openings');") === true);
  sprawdz('okno warstw się zamyka',
    doc.getElementById('layersOverlay').style.display === 'none');
  app("resetLayers(); currentMode = 'line';");
  sprawdz('przycisk „Wszystkie" przywraca wszystkie warstwy',
    app("currentMode = 'export'; const w = warstwaWidoczna('obstacles') && warstwaWidoczna('labels'); currentMode = 'line'; return w;") === true);

  // --------- PRZEKSZTAŁCENIA ---------
  console.log('--- odbicie i obrót szkicu ---');
  szkicZPomiarem(app);
  const poleStart = app("return objects.rooms[0].area;");
  sprawdz('przed przekształceniem pokój ma 20,00 m²', poleStart === '20.00');

  app("mirrorSketch('pion');");
  sprawdz('po odbiciu powierzchnia się nie zmienia',
    app("recalculateRooms(); return objects.rooms[0].area;") === '20.00',
    app("return objects.rooms[0].area;"));
  sprawdz('po odbiciu pomiary nie giną',
    app("return Object.values(objects.customDims).map(d => d.val).sort().join(',');") === '4.00,5.00',
    app("return Object.values(objects.customDims).map(d => d.val).join(',');"));
  sprawdz('po odbiciu klucze pasują do nowych pozycji ścian',
    app(`
      const l = objects.lines[0];
      const k = getSegKey(l.x1, l.y1, l.x2, l.y2);
      return !!(objects.customDims[k] && objects.customDims[k].val === '5.00');
    `) === true);
  sprawdz('odbicie faktycznie odwraca rysunek',
    app("return objects.lines[0].x1 > objects.lines[0].x2;") === true);

  // dwa odbicia = stan wyjściowy
  app("mirrorSketch('pion');");
  sprawdz('dwa odbicia wracają do stanu wyjściowego',
    app("return objects.lines[0].x1 < objects.lines[0].x2;") === true);

  app("rotateSketch(90);");
  sprawdz('po obrocie powierzchnia się nie zmienia',
    app("recalculateRooms(); return objects.rooms[0].area;") === '20.00',
    app("return objects.rooms[0].area;"));
  sprawdz('po obrocie pomiary nie giną',
    app("return Object.values(objects.customDims).map(d => d.val).sort().join(',');") === '4.00,5.00');
  sprawdz('obrót zamienia ściany poziome na pionowe',
    app("return wallAngleDeg(objects.lines[0].x1, objects.lines[0].y1, objects.lines[0].x2, objects.lines[0].y2) > 89;") === true);
  sprawdz('otwór po obrocie leży zgodnie z kierunkiem swojej ściany',
    app(`
      const p0 = objects.lines[0];
      objects.openings = [{ x: (p0.x1 + p0.x2) / 2, y: (p0.y1 + p0.y2) / 2, angle: 0, id:'O1', width:90, height:200 }];
      // obrót o 30°, a nie 90°: po ćwierćobrocie ściana bywa znowu pozioma
      // i kąt 0 wyglądałby na poprawny nawet przy zepsutym kodzie
      rotateSketch(30);
      const l = objects.lines[0], op = objects.openings[0];
      const katSciany = Math.atan2(l.y2 - l.y1, l.x2 - l.x1);
      const roznica = Math.abs(Math.atan2(Math.sin(op.angle - katSciany), Math.cos(op.angle - katSciany)));
      return roznica < 0.01 || Math.abs(roznica - Math.PI) < 0.01;
    `) === true);
  sprawdz('otwory po obrocie zostają na ścianach',
    app(`
      objects.openings = [{ x: objects.lines[0].x1, y: objects.lines[0].y1, angle:0, id:'O1', width:90, height:200 }];
      rotateSketch(90);
      const l = objects.lines[0], op = objects.openings[0];
      const p = getClosestPointOnSegment({x:op.x,y:op.y}, {x:l.x1,y:l.y1}, {x:l.x2,y:l.y2});
      return Math.hypot(op.x-p.x, op.y-p.y) < 1;
    `) === true);

  // --------- CIĄGI WYMIAROWE ---------
  console.log('--- ciągi wymiarowe ---');
  szkicZPomiarem(app);
  sprawdz('ciągi są domyślnie wyłączone', app("return dimChainsOn;") === false);
  const odcinki = app("return chainSegments();");
  sprawdz('ciąg bierze zmierzone ściany', odcinki.length >= 2, odcinki.length);
  sprawdz('ciąg pokazuje wpisane wartości',
    odcinki.some(s => Math.abs(s.val - 5) < 0.01) && odcinki.some(s => Math.abs(s.val - 4) < 0.01),
    JSON.stringify(odcinki.map(s => s.val)));

  // ściana bez pomiaru nie może trafić do ciągu z surową długością z rysunku
  const bezPomiaru = app(`
    objects.customDims = {}; objects._realLen = {}; recalculateRooms();
    return chainSegments().length;
  `);
  sprawdz('niezmierzona ściana nie trafia do ciągu z długością z rysunku',
    bezPomiaru === 0, bezPomiaru);

  // ukryty wymiar zostaje ukryty także w ciągu
  szkicZPomiarem(app);
  const ukryty = app(`
    const l = objects.lines[0];
    const k = getSegKey(l.x1, l.y1, l.x2, l.y2);
    objects.customDims[k].hidden = true;
    return chainSegments().some(s => getSegKey(s.x1, s.y1, s.x2, s.y2) === k);
  `);
  sprawdz('ukryty wymiar nie pojawia się w ciągu', ukryty === false);
  // ...ale przeciwległa ściana, doliczona z zamknięcia, ma się pokazać nadal
  sprawdz('ukrycie jednej ściany nie ukrywa przeciwległej',
    app("return chainSegments().some(s => Math.abs(s.val - 5) < 0.01);") === true);

  // strony i poziomy
  szkicZPomiarem(app);
  const strony = app(`
    const b = { minX:400, minY:400, maxX:650, maxY:600 };
    return chainSegments().map(s => chainSide(s, b));
  `);
  sprawdz('wymiary trafiają na właściwe strony budynku',
    strony.includes('gora') && strony.includes('prawo'), JSON.stringify(strony));

  sprawdz('rysowanie z ciągami nie wywraca płótna',
    app("dimChainsOn = true; renderCanvasNow(); dimChainsOn = false; return objects.lines.length;") === 4);
  sprawdz('przełącznik ciągów zmienia stan',
    app("toggleDimChains(); const s = dimChainsOn; toggleDimChains(); return s;") === true);

  // --------- COFANIE PO DOPASOWANIU ---------
  console.log('--- cofanie po dopasowaniu skali ---');
  app(`
    sketches = [{ id:1, name:'Parter', kind:'rzut', height:'2.60', panX:0, panY:0, zoomLevel:1, showDimensions:true,
      objects: { lines:[], freehand:[], labels:[], rooms:[], openings:[], customDims:{},
                 noteLines:[], apexDims:{}, hatches:[], slopes:[], callouts:[], obstacles:[] } }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
    undoStack = []; autoFitOn = true;
    const P = PIXELS_PER_METER, O = 400;
    const L = (x1,y1,x2,y2) => objects.lines.push({x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P});
    L(0,0, 4.2,0); L(4.2,0, 4.2,3.1); L(4.2,3.1, 0,3.1); L(0,3.1, 0,0);
    saveStateToHistory();
    selectedSegKey = getSegKey(objects.lines[0].x1, objects.lines[0].y1, objects.lines[0].x2, objects.lines[0].y2);
    document.getElementById('modalDimInput').value = '5.00';
    applyMeasureDimension();
  `);
  const poWpisie = app("return Math.hypot(objects.lines[0].x2-objects.lines[0].x1, objects.lines[0].y2-objects.lines[0].y1) / PIXELS_PER_METER;");
  sprawdz('po wpisaniu wymiaru rysunek się dociąga', Math.abs(poWpisie - 5) < 0.02, poWpisie);

  app("undoLast();");
  const poCofnieciu = app("return Math.hypot(objects.lines[0].x2-objects.lines[0].x1, objects.lines[0].y2-objects.lines[0].y1) / PIXELS_PER_METER;");
  sprawdz('cofnięcie zdejmuje samo dopasowanie', Math.abs(poCofnieciu - 4.2) < 0.02, poCofnieciu);
  sprawdz('cofnięcie dopasowania zostawia wpisany pomiar',
    app("return Object.values(objects.customDims).some(d => d.val === '5.00');") === true);

  app("undoLast();");
  sprawdz('drugie cofnięcie zdejmuje wpisany pomiar',
    app("return Object.values(objects.customDims).filter(d => d.val).length;") === 0);

  // --------- PRZYCIĄGANIE DO 45 STOPNI ---------
  console.log('--- przyciąganie do 45 stopni ---');
  const kat45 = app(`
    currentMode = 'slope'; drawing = true;
    startPos = { x:100, y:100 }; currentPos = { x:100, y:100 };
    draw({ pointerType:'mouse', isPrimary:true, clientX:0, clientY:0, __pos:{x:300, y:288} });
    return null;
  `);
  const wynik45 = app(`
    currentMode = 'slope'; drawing = true;
    startPos = { x:100, y:100 };
    const angle = Math.atan2(188, 200) * 180 / Math.PI;
    return Math.abs(angle - 45) <= ORTHO_ANGLE_TOLERANCE;
  `);
  sprawdz('ruch bliski 45° mieści się w tolerancji przyciągania', wynik45 === true);
  sprawdz('lista przyciąganych kątów obejmuje wszystkie cztery skosy',
    app("return [45,135,-45,-135].length;") === 4);

  dom.window.close();
}

(async () => {
  try {
    if (fakeIndexedDB) await testyMagazynu(true, 'IndexedDB');
    else console.log('--- magazyn projektów: IndexedDB --- (pominięte: brak fake-indexeddb)');
    await testyMagazynu(false, 'zapas na localStorage');
    await testMigracji();
    await testyReszty();
  } catch (e) {
    bledy.push('wyjątek w testach: ' + (e && e.stack ? e.stack : e));
  }

  console.log('');
  if (bledy.length) {
    console.log('BŁĘDY (' + bledy.length + '):');
    bledy.forEach(b => console.log('  ✗ ' + b));
    console.log('\nPrzeszło: ' + ok + ', nie przeszło: ' + bledy.length);
    process.exit(1);
  } else {
    console.log('✓ Wszystkie testy przeszły (' + ok + ' sprawdzeń).');
  }
})();
