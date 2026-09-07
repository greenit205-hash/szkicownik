/* Szkicownik - czytelność opisów, granice eksportu, kolory przeszkód.
 * Uruchomienie:  node tests/test-opisy.js     (wymaga: npm install)
 *
 * Trzy rzeczy zgłoszone z terenu, wszystkie o to samo: rysunek ma być czytelny.
 *  1. Opisy i wymiary nachodziły na siebie tak, że nic nie było widać.
 *  2. Na wydruku ucinały się chmurki i podpisy wystające poza rysunek.
 *  3. Przeszkody wszystkie w jednym kolorze zlewały się w plamę.
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

// Zaślepka mierzy tekst PROPORCJONALNIE do jego długości i rozmiaru fontu -
// bez tego nie dałoby się sprawdzić, czy podpis mieści się w kadrze.
const slad = [];
function kontekst() {
  const nic = () => {};
  const stan = { font: 'bold 15px Arial' };
  const c = {
    canvas: { width: 3000, height: 3000 },
    get font() { return stan.font; },
    set font(v) { stan.font = v; },
    measureText: (t) => {
      const m = /(\d+)px/.exec(stan.font);
      const px = m ? parseInt(m[1], 10) : 15;
      return { width: String(t).length * px * 0.55 };
    },
    createLinearGradient: () => ({ addColorStop: nic }), createPattern: () => null,
    getImageData: () => ({ data: [] }), setLineDash: nic,
    save: nic, restore: nic,
    fillText: (t, x, y) => slad.push({ op: 'fillText', t: String(t), x, y }),
    strokeStyle: '', fillStyle: ''
  };
  return new Proxy(c, {
    get: (t, p) => (p in t ? t[p] : nic),
    set: (t, p, v) => { t[p] = v; return true; }
  });
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
                 noteLines:[], apexDims:{}, hatches:[], slopes:[], callouts:[], obstacles:[] }`;

function nowySzkic() {
  app(`
    sketches = [{ id:1, name:'Parter', kind:'rzut', height:'2.60',
      panX:0, panY:0, zoomLevel:1, showDimensions:true, objects: ${PUSTE} }];
    currentSketchIndex = 0; objects = sketches[0].objects; zoomLevel = 1;
  `);
}

function prostokat5x4() {
  return app(`
    const P = PIXELS_PER_METER, O = 400;
    const L = (x1,y1,x2,y2) => { const l = {x1:O+x1*P, y1:O+y1*P, x2:O+x2*P, y2:O+y2*P};
                                 objects.lines.push(l); return getSegKey(l.x1,l.y1,l.x2,l.y2); };
    const g = L(0,0, 5,0), p = L(5,0, 5,4); L(5,4, 0,4); L(0,4, 0,0);
    const face = findEnclosingFace({ x:O+2.5*P, y:O+2*P });
    objects.rooms = [{ id:1, num:'1', name:'Pokój', polygon: face, centroid: getVisualCenter(face) }];
    objects.customDims[g] = { val:'5.00' };
    objects.customDims[p] = { val:'4.00' };
    recalculateRooms();
  `);
}

// ===================== OPISY NIE NACHODZĄ NA SIEBIE =====================
console.log('--- czytelność opisów ---');
{
  nowySzkic();
  prostokat5x4();
  // chmurka postawiona dokładnie tam, gdzie sam siada wymiar górnej ściany
  app(`
    objects.callouts = [{ x:400+2.5*50, y:400, tx:400+2.5*50, ty:500,
                          text:'wysokości poziomu 0 okna i cokołu ściany' }];
    renderCanvasNow();
  `);
  const prostokaty = app("return dimLabelRects.map(r => ({x:r.x, y:r.y, w:r.w, h:r.h}));");
  sprawdz('chmurka rezerwuje sobie miejsce', prostokaty.length > 0, prostokaty.length);

  const nachodzi = app(`
    function koliduje(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
    let pary = 0;
    for (let i = 0; i < dimLabelRects.length; i++)
      for (let j = i + 1; j < dimLabelRects.length; j++)
        if (koliduje(dimLabelRects[i], dimLabelRects[j])) pary++;
    return pary;
  `);
  sprawdz('żaden podpis nie nachodzi na inny', nachodzi === 0, nachodzi + ' kolidujących par');

  // podpis przeszkody też musi być omijany przez wymiary
  nowySzkic();
  prostokat5x4();
  app(`
    objects.obstacles = [{ id:1, polygon: obstaclePolygonFromSize(400+2.5*50, 400, 200, 60),
                           label:'Planowana opaska', subtract:true, kolor:'czerwony', w:200, d:60 }];
    renderCanvasNow();
  `);
  const nachodzi2 = app(`
    function koliduje(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
    let pary = 0;
    for (let i = 0; i < dimLabelRects.length; i++)
      for (let j = i + 1; j < dimLabelRects.length; j++)
        if (koliduje(dimLabelRects[i], dimLabelRects[j])) pary++;
    return pary;
  `);
  sprawdz('wymiar nie siada na podpisie przeszkody', nachodzi2 === 0, nachodzi2 + ' kolidujących par');

  // etykieta 🔤 Txt również
  nowySzkic();
  prostokat5x4();
  app(`
    objects.labels = [{ x:400+2.5*50, y:400, text:'ściana szczytowa', size:24, box:true }];
    renderCanvasNow();
  `);
  sprawdz('napis Txt rezerwuje miejsce proporcjonalne do treści',
    app(`
      const r = dimLabelRects[0];
      return r && r.w > 100 && r.h > 24;
    `) === true, JSON.stringify(app("return dimLabelRects[0];")));

  // dłuższy napis musi zająć więcej miejsca - inaczej mierzenie jest pozorne
  const waski = app(`
    objects.labels = [{ x:1000, y:1000, text:'A', size:20, box:true }];
    dimLabelRects = []; reserveManualAnnotations();
    return dimLabelRects[0].w;
  `);
  const szeroki = app(`
    objects.labels = [{ x:1000, y:1000, text:'ściana szczytowa od podwórza', size:20, box:true }];
    dimLabelRects = []; reserveManualAnnotations();
    return dimLabelRects[0].w;
  `);
  sprawdz('dłuższy napis rezerwuje więcej miejsca niż krótki',
    szeroki > waski * 3, waski + ' vs ' + szeroki);

  // szkic bez żadnych ręcznych podpisów nie może niczego rezerwować
  nowySzkic();
  sprawdz('pusty szkic nie rezerwuje niczego',
    app("dimLabelRects = []; reserveManualAnnotations(); return dimLabelRects.length;") === 0);
}

// ===================== GRANICE EKSPORTU =====================
console.log('--- nic się nie ucina na wydruku ---');
{
  // chmurka daleko po lewej - w wersji sprzed poprawki granice jej nie obejmowały
  nowySzkic();
  prostokat5x4();
  const bezChmurki = app("return getSketchBounds(objects);");
  app(`
    objects.callouts = [{ x:100, y:200, tx:400, ty:400,
                          text:'wysokości poziomu 0 okna i cokołu ściany' }];
  `);
  const zChmurka = app("return getSketchBounds(objects);");
  sprawdz('chmurka rozszerza granice rysunku w lewo',
    zChmurka.minX < bezChmurki.minX, bezChmurki.minX + ' -> ' + zChmurka.minX);
  sprawdz('cała szerokość chmurki mieści się w granicach',
    app(`
      const b = getSketchBounds(objects);
      const c = objects.callouts[0];
      const box = calloutBox(ctx, c);
      return b.minX <= box.lewo + 0.001 && b.maxX >= box.lewo + box.w - 0.001;
    `) === true,
    JSON.stringify(app("return { b:getSketchBounds(objects), box:calloutBox(ctx, objects.callouts[0]) };")));
  sprawdz('grot strzałki chmurki też mieści się w granicach',
    app(`
      const b = getSketchBounds(objects);
      const c = objects.callouts[0];
      return c.tx >= b.minX && c.tx <= b.maxX && c.ty >= b.minY && c.ty <= b.maxY;
    `) === true);

  // długi napis po prawej
  nowySzkic();
  prostokat5x4();
  app("objects.labels = [{ x:1200, y:500, text:'Murek oporowy przy tarasie', size:22, box:true }];");
  sprawdz('długi napis mieści się w granicach w całości',
    app(`
      const b = getSketchBounds(objects);
      ctx.save(); ctx.font = 'bold 22px Arial';
      const w = ctx.measureText(objects.labels[0].text).width + 16;
      ctx.restore();
      return b.maxX >= 1200 + w / 2 - 0.001;
    `) === true);

  // podpis przeszkody wystający poza jej obrys
  nowySzkic();
  prostokat5x4();
  app(`
    objects.obstacles = [{ id:1, polygon: obstaclePolygonFromSize(1400, 500, 20, 20),
                           label:'Wysypany kamień polny', subtract:false, kolor:'zielony', w:20, d:20 }];
  `);
  sprawdz('podpis przeszkody rozszerza granice poza jej obrys',
    app("return getSketchBounds(objects).maxX;") > 1420, app("return getSketchBounds(objects).maxX;"));

  // miarka z wpisaną wartością
  nowySzkic();
  app(`
    objects.noteLines = [{ x1:1000, y1:1000, x2:1100, y2:1000, color:'#dc3545', val:'12.34' }];
  `);
  sprawdz('podpis miarki mieści się w granicach',
    app("return getSketchBounds(objects).maxY;") > 1000, app("return getSketchBounds(objects).maxY;"));

  // skosy i kreskowania nie mogą wypadać poza kadr
  nowySzkic();
  app(`
    objects.hatches = [{ polygon:[{x:2000,y:2000},{x:2200,y:2000},{x:2200,y:2200},{x:2000,y:2200}] }];
    objects.slopes = [{ x1:100, y1:2500, x2:300, y2:2700 }];
  `);
  const b = app("return getSketchBounds(objects);");
  sprawdz('kreskowanie mieści się w granicach', b.maxX >= 2200 && b.maxY >= 2200, JSON.stringify(b));
  sprawdz('skos mieści się w granicach', b.minX <= 100 && b.maxY >= 2700, JSON.stringify(b));

  // pusty szkic nadal nie ma czego eksportować
  nowySzkic();
  sprawdz('pusty szkic nie ma granic', app("return getSketchBounds(objects);") === null);
}

// ===================== KOLORY PRZESZKÓD =====================
console.log('--- kolory przeszkód ---');
{
  nowySzkic();
  sprawdz('paleta ma kilka kolorów do wyboru',
    app("return OBSTACLE_COLORS.length;") >= 5, app("return OBSTACLE_COLORS.length;"));
  sprawdz('każdy kolor ma nazwę po polsku i wartość',
    app("return OBSTACLE_COLORS.every(c => c.id && c.nazwa && /^#[0-9a-f]{6}$/i.test(c.hex));") === true);
  sprawdz('nazwy kolorów są niepowtarzalne',
    app("return new Set(OBSTACLE_COLORS.map(c => c.id)).size === OBSTACLE_COLORS.length;") === true);

  sprawdz('wybrany kolor jest używany',
    app("return obstacleColorHex({ kolor:'niebieski' });") ===
    app("return OBSTACLE_COLORS.find(c => c.id === 'niebieski').hex;"));
  sprawdz('dwa różne kolory dają dwie różne wartości',
    app("return obstacleColorHex({ kolor:'zielony' }) !== obstacleColorHex({ kolor:'czerwony' });") === true);
  sprawdz('nieznany kolor nie wywraca rysowania',
    /^#[0-9a-f]{6}$/i.test(app("return obstacleColorHex({ kolor:'burasty' });")),
    app("return obstacleColorHex({ kolor:'burasty' });"));

  // stare szkice bez pola koloru zachowują dawny wygląd
  sprawdz('stara przeszkoda odejmowana zostaje czerwona',
    app("return obstacleColorHex({ subtract:true });") === '#b02a37');
  sprawdz('stara przeszkoda nieodejmowana zostaje szara',
    app("return obstacleColorHex({ subtract:false });") === '#6c757d');

  // zapis z okna
  app(`
    objects.obstacles = [];
    openObstacleDialog({ prostokat:true, center:{x:600, y:600},
      polygon:[{x:580,y:580},{x:620,y:580},{x:620,y:620},{x:580,y:620}] });
    document.getElementById('obstacleLabel').value = 'Planowana opaska';
    document.getElementById('obstacleW').value = '50';
    document.getElementById('obstacleD').value = '50';
    document.getElementById('obstacleColor').value = 'czerwony';
    saveObstacle();
  `);
  sprawdz('kolor zapisuje się przy przeszkodzie',
    app("return objects.obstacles[0].kolor;") === 'czerwony', app("return objects.obstacles[0].kolor;"));

  // kolejna przeszkoda dziedziczy ostatnio użyty kolor
  app(`
    openObstacleDialog({ prostokat:true, center:{x:800, y:800},
      polygon:[{x:780,y:780},{x:820,y:780},{x:820,y:820},{x:780,y:820}] });
  `);
  sprawdz('okno podpowiada ostatnio użyty kolor',
    doc.getElementById('obstacleColor').value === 'czerwony',
    doc.getElementById('obstacleColor').value);
  app("closeObstacleDialog();");

  // poprawianie koloru
  app(`
    openObstacleDialog(null, 0);
    document.getElementById('obstacleColor').value = 'zielony';
    saveObstacle();
  `);
  sprawdz('kolor da się zmienić po fakcie',
    app("return objects.obstacles[0].kolor;") === 'zielony');
  sprawdz('zmiana koloru nie tworzy drugiej przeszkody',
    app("return objects.obstacles.length;") === 1);
  sprawdz('zmiana koloru nie rusza wymiarów',
    Math.abs(app("return obstacleAreaM2(objects.obstacles[0]);") - 0.25) < 0.001);

  // skróty ustawiają kolor razem z opisem
  app(`
    openObstacleDialog({ prostokat:true, center:{x:900, y:900},
      polygon:[{x:880,y:880},{x:920,y:880},{x:920,y:920},{x:880,y:920}] });
    setObstaclePreset('Schody', 250, 100, 'fioletowy');
  `);
  sprawdz('skrót ustawia opis', doc.getElementById('obstacleLabel').value === 'Schody');
  sprawdz('skrót ustawia kolor', doc.getElementById('obstacleColor').value === 'fioletowy');
  app("closeObstacleDialog();");

  // kolor przeżywa zapis do pliku
  app("objects.obstacles = [{ id:1, polygon: obstaclePolygonFromSize(500,500,40,40), label:'Komin', subtract:true, kolor:'brazowy', w:40, d:40 }];");
  const paczka = app("return JSON.stringify(projectPayload());");
  app(`sketches = []; applyProjectData(${paczka});`);
  sprawdz('kolor wraca z pliku projektu',
    app("return sketches[0].objects.obstacles[0].kolor;") === 'brazowy');

  // rysowanie z różnymi kolorami nie może się wywracać
  app(`
    objects.obstacles = OBSTACLE_COLORS.map((c, i) => ({
      id: i, polygon: obstaclePolygonFromSize(500 + i * 120, 500, 40, 40),
      label: c.nazwa, subtract: i % 2 === 0, kolor: c.id, w:40, d:40 }));
    renderCanvasNow();
  `);
  sprawdz('wszystkie kolory rysują się bez błędu',
    app("return objects.obstacles.length;") === app("return OBSTACLE_COLORS.length;"));

  // tabela pod szkicem pokazuje kolor
  nowySzkic();
  prostokat5x4();
  app(`
    objects.obstacles = [
      { id:1, polygon: obstaclePolygonFromSize(500,500,40,40), label:'Komin', subtract:true, kolor:'brazowy', w:40, d:40 },
      { id:2, polygon: obstaclePolygonFromSize(700,500,50,50), label:'Opaska', subtract:false, kolor:'czerwony', w:50, d:50 }
    ];
    renderTablesPerSketch();
  `);
  const html = doc.getElementById('tablesPerSketchContainer').innerHTML;
  sprawdz('tabela przeszkód ma kolumnę koloru', html.includes('Kolor'), html.includes('Przeszkody'));
  sprawdz('tabela pokazuje nazwę koloru', html.includes('Brązowy') || html.includes('Czerwony'));
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
