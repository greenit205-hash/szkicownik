#!/usr/bin/env python3
# Testy mutacyjne: psujemy kod celowo i sprawdzamy, czy zestawy to wylapia.
# Test, ktory przechodzi na zepsutym kodzie, jest tylko ozdoba.
import pathlib, subprocess, shutil, sys

ROOT = pathlib.Path('/home/claude/work/out')
IDX = ROOT / 'index.html'
KOPIA = ROOT / 'index.html.bak'

MUTACJE = [
    ('powierzchnia liczona po licach zamiast po osiach',
     'tests/test-grubosc.js',
     "    return { solved: true, area: Math.abs(acc / 2), realLen: known,",
     "    const _gr = (objects.lines || []).reduce((m, l) => Math.max(m, parseFloat(l.gr) || 0), 0) / 100;\n"
     "    return { solved: true, area: Math.max(0, Math.abs(acc / 2) - _gr * 4), realLen: known,"),

    ('pas o polowe za waski',
     'tests/test-grubosc.js',
     "    const h = t / 2;\n    const o = wallBandOffsetPx(line);",
     "    const h = t / 4;\n    const o = wallBandOffsetPx(line);"),

    ('brak nadmiaru na koncach - dziura w naroznikach',
     'tests/test-grubosc.js',
     "    return max + 0.5;",
     "    return 0;"),

    ('kreskowanie w pikselach ekranu zamiast plotna',
     'tests/test-grubosc.js',
     "    for (let d = minX - span; d <= maxX; d += WALL_HATCH_STEP) {",
     "    for (let d = minX - span; d <= maxX; d += WALL_HATCH_STEP * (zoomLevel || 1)) {"),

    ('stare sciany bez gr dostaja pas',
     'tests/test-grubosc.js',
     "    if (!isFinite(v) || v <= 0) return 0;",
     "    if (!isFinite(v)) return 12;\n    if (v <= 0) return 12;"),

    ('grubosc nie wraca z pliku projektu',
     'tests/test-grubosc.js',
     "      if (!o.customDims) o.customDims = {};",
     "      (o.lines || []).forEach(l => { delete l.gr; });\n      if (!o.customDims) o.customDims = {};"),

    ('dopasowanie gubi wpisane pomiary (klucze nieprzepisane)',
     'tests/test-skala.js',
     "    applyLoosePoints(luzne, przed, poPozycje);\n    rekeyCustomDims(zakotwiczone);",
     "    applyLoosePoints(luzne, przed, poPozycje);"),

    ('pomiary trafiaja po dopasowaniu na sasiednia sciane',
     'tests/test-skala.js',
     "      const line = objects.lines[k.lineIndex];\n      if (!line) { nowe[k.key] = k.data; return; }",
     "      const line = objects.lines[(k.lineIndex + 1) % objects.lines.length];\n      if (!line) { nowe[k.key] = k.data; return; }"),

    ('sciany przestaja byc prostowane po dopasowaniu',
     'tests/test-skala.js',
     "      ortoEdges.forEach(o => {",
     "      [].forEach(o => {"),

    ('obrysy nie jada za scianami',
     'tests/test-skala.js',
     "    const kotwyObrysow = anchorPolygons(przed);",
     "    const kotwyObrysow = [];"),

    ('otwory nie jada za scianami',
     'tests/test-skala.js',
     "    applyOpenings(kotwyOtworow);",
     "    /* applyOpenings(kotwyOtworow); */"),

    ('wpisane wymiary przeszkody ignorowane, zostaje ksztalt spod palca',
     'tests/test-skala.js',
     "        polygon = obstaclePolygonFromSize(c.x, c.y, w, d);\n        ww = w; dd = d;",
     "        ww = w; dd = d;"),

    ('przeszkoda spoza pomieszczenia tez jest odejmowana',
     'tests/test-skala.js',
     "      if (pointInPolygon(c, room.polygon)) suma += obstacleAreaM2(o);",
     "      suma += obstacleAreaM2(o);"),

    ('grubosc scian pomijana w powierzchni w swietle',
     'tests/test-skala.js',
     "    const netto = a - obwodM * h + h * h * cornerBalance(room.polygon) - obstaclesInRoomM2(room);",
     "    const netto = a - obstaclesInRoomM2(room);"),

    ('opisy i notatki nie jada za scianami przy dopasowaniu',
     'tests/test-skala.js',
     "    applyLoosePoints(luzne, przed, poPozycje);",
     "    /* applyLoosePoints(luzne, przed, poPozycje); */"),

    ('odbicie szkicu gubi wpisane pomiary',
     'tests/test-projekty.js',
     "    rekeyCustomDims(zakotwiczone);\n    return true;",
     "    return true;"),

    ('obrot szkicu nie poprawia katow otworow',
     'tests/test-projekty.js',
     "      if (best) op.angle = Math.atan2(best.y2 - best.y1, best.x2 - best.x1);",
     "      if (best) op.angle = 0;"),

    ('ciag wymiarowy pokazuje surowa dlugosc z rysunku',
     'tests/test-projekty.js',
     "        if (!(val > 0)) return;",
     "        if (!(val > 0)) val = Math.hypot(sg.x2 - sg.x1, sg.y2 - sg.y1) / PIXELS_PER_METER;",),

    ('ukryty wymiar mimo wszystko trafia do ciagu',
     'tests/test-projekty.js',
     "        if (wpis && wpis.hidden) return;",
     "        if (false) return;"),

    ('warstwy wylaczone przy eksporcie i tak sie rysuja',
     'tests/test-projekty.js',
     "    if (currentMode !== 'export') return true;\n    return exportLayers[nazwa] !== false;",
     "    return true;"),

    ('warstwy wylaczone znikaja takze podczas pracy',
     'tests/test-projekty.js',
     "    if (currentMode !== 'export') return true;",
     "    if (false) return true;"),

    ('wydruk nie przywraca stanu po rysowaniu na bok',
     'tests/test-projekty.js',
     "      ctx = sv.ctx; objects = sv.objects; currentMode = sv.mode;",
     "      ctx = sv.ctx; objects = sv.objects; currentMode = 'export';"),

    ('nazwa projektu wstawiana do wydruku bez zabezpieczenia',
     'tests/test-projekty.js',
     "      .replace(/&/g, '&amp;').replace(/</g, '&lt;')",
     "      .replace(/&/g, '&amp;').replace(/\u0000/g, '&lt;')"),

    ('zapis projektu nadpisuje poprzedni zamiast zakladac nowy',
     'tests/test-projekty.js',
     "    if (!projectId) projectId = nowyId();",
     "    projectId = 'staly-identyfikator';"),

    ('lista projektow nie sortuje wedlug daty',
     'tests/test-projekty.js',
     "        const d = String(b.zapisano).localeCompare(String(a.zapisano));",
     "        const d = String(a.zapisano).localeCompare(String(b.zapisano));"),

    ('projekt ze starej wersji nie jest przenoszony',
     'tests/test-projekty.js',
     "    await migrujStaryProjekt();",
     "    /* await migrujStaryProjekt(); */"),

    ('przyciaganie do 45 stopni nie dziala',
     'tests/test-korekty.js',
     "    if (diagSnapOn) {\n      for (const c of [45, 135, -45, -135]) {",
     "    if (false) {\n      for (const c of [45, 135, -45, -135]) {"),

    ('45 stopni lapie za szeroko - kazdy skos zostaje splaszczony',
     'tests/test-korekty.js',
     "  const DIAG_ANGLE_TOLERANCE = 6;",
     "  const DIAG_ANGLE_TOLERANCE = 25;"),

    ('suma przeszkod liczy takze te nieodejmowane',
     'tests/test-skala.js',
     "                    if (o.subtract) sumaPrz += a;",
     "                    sumaPrz += a;"),

    ('prowadnice znow przechylaja wyprostowana sciane',
     'tests/test-korekty.js',
     "    if (alignY !== null && wolnoY) { target.y = alignY;",
     "    if (alignY !== null) { target.y = alignY;"),

    ('koniec sciany dociagany w poprzek linii, nie wzdluz',
     'tests/test-korekty.js',
     "            cel = { x: od.x + ux * wzdluz, y: od.y + uy * wzdluz };",
     "            cel = { x: przy.pt.x, y: przy.pt.y };"),

    ('prowadnice blokuja tez wspolrzedna, ktora wolno ruszac',
     'tests/test-korekty.js',
     "    const wolnoX = blokada !== 'x' && blokada !== 'oba';",
     "    const wolnoX = false;"),

    ('strona pasa ignorowana - zawsze na osi',
     'tests/test-grubosc.js',
     "    if (s === 'os') return 0;\n    const h = wallThicknessPx(line) / 2;\n    return s === 'prawa' ? h : -h;",
     "    return 0;"),

    ('lewa i prawa strona zamienione miejscami',
     'tests/test-grubosc.js',
     "    return s === 'prawa' ? h : -h;",
     "    return s === 'prawa' ? -h : h;"),

    ('zasieg pasa na stronie liczony jak dla osi - dziura w narozniku',
     'tests/test-grubosc.js',
     "    return wallSideOf(line) === 'os' ? t / 2 : t;",
     "    return t / 2;"),

    ('zdjecia nie sa zmniejszane przy wgrywaniu',
     'tests/test-zdjecia.js',
     "  const FOTO_MAX_PX = 1600;",
     "  const FOTO_MAX_PX = 99999;"),

    ('kontrola pomiarow liczy tez zdjecia',
     'tests/test-zdjecia.js',
     "    if (isPhotoSketch(sketches[currentSketchIndex])) return [];",
     "    if (false) return [];"),

    ('narzedzia rysunkowe dostepne na zdjeciu',
     'tests/test-zdjecia.js',
     "    if (!isPhotoSketch(sketches[currentSketchIndex])) return true;\n    return NARZEDZIA_NA_ZDJECIU.indexOf(mode) !== -1;",
     "    return true;"),

    ('skala zdjecia podpowiada mimo braku kalibracji',
     'tests/test-zdjecia.js',
     "    if (!s || !n) return null;",
     "    if (!n) return null;\n    if (!s) return '1.00';"),

    ('kalibracja przyjmuje dlugosc zero i ujemna',
     'tests/test-zdjecia.js',
     "    if (!isFinite(m) || m <= 0) { alert('Podaj długość w metrach, np. 2.05'); return; }",
     "    if (false) { return; }"),

    ('granice eksportu nie obejmuja zdjecia',
     'tests/test-zdjecia.js',
     "    if (isPhotoSketch(sketch) && sketch.photo) {",
     "    if (false) {"),

    ('zdjecie rysowane niezaleznie od rodzaju szkicu',
     'tests/test-zdjecia.js',
     "    if (!isPhotoSketch(sk) || !sk.photo) return;\n    const r = fotoRect(sk);",
     "    if (!sk || !sk.photo) return;\n    const r = fotoRect(sk);"),

    ('reczne podpisy nie rezerwuja miejsca - wymiary siadaja na nich',
     'tests/test-opisy.js',
     "    reserveManualAnnotations();\n    drawPhotoBackground();",
     "    drawPhotoBackground();"),

    ('rezerwacja miejsca dla napisow liczona na oko',
     'tests/test-opisy.js',
     "      const b = labelBox(ctx, l);\n      dimLabelRects.push({ x: b.lewo, y: b.gora, w: b.w, h: b.h });",
     "      dimLabelRects.push({ x: l.x - 30, y: l.y - 10, w: 60, h: 20 });"),

    ('chmurki poza granicami eksportu - ucinaja sie na wydruku',
     'tests/test-opisy.js',
     "      (obj.callouts||[]).forEach(c => {\n        const b = calloutBox(mc, c);",
     "      [].forEach(c => {\n        const b = calloutBox(mc, c);"),

    ('podpisy przeszkod poza granicami eksportu',
     'tests/test-opisy.js',
     "        prostokat(cx, cy, szerokosc(o.label, 'bold 13px Arial') + 14, 24);",
     "        prostokat(cx, cy, 0, 0);"),

    ('tekst chmurki lamany do zlej szerokosci - wylewa sie poza ramke',
     'tests/test-opisy.js',
     "    const linie = zawinTekst(ctx, c.text, font, CALLOUT_MAX_W - 20);",
     "    const linie = zawinTekst(ctx, c.text, font, CALLOUT_MAX_W * 5);"),

    ('kolor przeszkody ignorowany',
     'tests/test-opisy.js',
     "    const wpis = OBSTACLE_COLORS.find(c => c.id === (o && o.kolor));\n    if (wpis) return wpis.hex;",
     "    const wpis = null;\n    if (wpis) return wpis.hex;"),

    ('kolor nie zapisuje sie przy przeszkodzie',
     'tests/test-opisy.js',
     "      o.label = label; o.subtract = subtract; o.kolor = kolor;",
     "      o.label = label; o.subtract = subtract;"),

    ('dlugi tekst nie jest lamany - wychodzi poza ekran',
     'tests/test-opisy.js',
     "        if (ctx.measureText(kandydat).width <= maxSzer) { linia = kandydat; return; }",
     "        { linia = kandydat; return; }"),

    ('dlugie slowo nie jest przelamywane w srodku',
     'tests/test-opisy.js',
     "        while (ctx.measureText(reszta).width > maxSzer && reszta.length > 1) {",
     "        while (false) {"),

    ('wysokosc chmurki nie rosnie wraz z liczba linii',
     'tests/test-opisy.js',
     "    const h = linie.length * 20 + 14;\n    return { w, h, linie, lewo: c.x - w / 2, gora: c.y - h / 2 };",
     "    const h = 34;\n    return { w, h, linie, lewo: c.x - w / 2, gora: c.y - h / 2 };"),

    ('granice eksportu liczone inaczej niz rysowanie napisow',
     'tests/test-opisy.js',
     "        const b = labelBox(mc, l);\n        put(b.lewo, b.gora); put(b.lewo + b.w, b.gora + b.h);",
     "        put(l.x - 30, l.y - 10); put(l.x + 30, l.y + 10);"),

    ('reczne zlamania Enterem sa gubione',
     'tests/test-opisy.js',
     "    String(tekst || '').split('\\n').forEach(akapit => {",
     "    [String(tekst || '').replace(/\\n/g, ' ')].forEach(akapit => {"),

    ('kolor sciany ignorowany - wszystkie grafitowe',
     'tests/test-linie.js',
     "  function wallColorHex(line) {\n    return kolorHex(line && line.kolor, KOLOR_SCIANY_DOMYSLNY);",
     "  function wallColorHex(line) {\n    return KOLOR_SCIANY_DOMYSLNY;\n    return kolorHex(line && line.kolor, KOLOR_SCIANY_DOMYSLNY);"),

    ('nowa sciana nie dziedziczy koloru z paska',
     'tests/test-linie.js',
     "      if (defaultWallColor && defaultWallColor !== 'grafit') newLine.kolor = defaultWallColor;",
     "      // brak dziedziczenia"),

    ('kolor sciany nie zapisuje sie z okna',
     'tests/test-linie.js',
     "      if (kolor === 'grafit') delete l.kolor; else l.kolor = kolor;",
     "      // brak zapisu koloru"),

    ('prosta linia nie jest prostowana',
     'tests/test-linie.js',
     "    if (!prostujLinie) return { x: raw.x, y: raw.y };",
     "    return { x: raw.x, y: raw.y };"),

    ('prosta linia zapisywana jako sciana',
     'tests/test-linie.js',
     "        ensureProste().push({ x1: startPos.x, y1: startPos.y, x2: koniec.x, y2: koniec.y,",
     "        objects.lines.push({ x1: startPos.x, y1: startPos.y, x2: koniec.x, y2: koniec.y }); ensureProste().push({ x1: startPos.x, y1: startPos.y, x2: koniec.x, y2: koniec.y,"),

    ('kolor prostej linii ignorowany',
     'tests/test-linie.js',
     "    return kolorHex(p && p.kolor, KOLOR_LINII_DOMYSLNY);",
     "    return KOLOR_LINII_DOMYSLNY;"),

    ('grubosc prostej linii ignorowana',
     'tests/test-linie.js',
     "    const w = LINIA_GRUBOSCI.find(g => g.id === (p && p.gruba));\n    return w ? w.px : 4;",
     "    return 4;"),

    ('prosta linia zablokowana na zdjeciu',
     'tests/test-linie.js',
     "'pan', 'noteline', 'prosta', 'draw'",
     "'pan', 'noteline', 'draw'"),

    ('proste linie poza granicami eksportu',
     'tests/test-linie.js',
     "    (obj.proste||[]).forEach(s => { put(s.x1, s.y1); put(s.x2, s.y2); });",
     "    [].forEach(s => { put(s.x1, s.y1); put(s.x2, s.y2); });"),

    ('przypadkowe dotkniecie tworzy linie',
     'tests/test-linie.js',
     "      if (Math.hypot(koniec.x - startPos.x, koniec.y - startPos.y) > 6) {",
     "      if (true) {"),

    ('okno wymiaru nie wyskakuje po narysowaniu sciany',
     'tests/test-autodim.js',
     "              askDimensionFor(newLine);",
     "              // askDimensionFor(newLine);"),

    ('tryb pyta o wymiar takze przy wylaczonym przelaczniku',
     'tests/test-autodim.js',
     "    if (!autoDimOn || !line) return;",
     "    if (!line) return;"),

    ('dalmierz zapisuje wymiar mimo pustego pola',
     'tests/test-autodim.js',
     "    if (!pole || !String(pole.value).trim()) return false;",
     "    if (!pole) return false;"),

    ('automatyczny zapis dziala poza trybem',
     'tests/test-autodim.js',
     "  function autoDimSave() {\n    if (!autoDimPending) return false;",
     "  function autoDimSave() {\n    if (false) return false;"),

    ('okno wymiaru wskazuje inna sciane niz narysowana',
     'tests/test-autodim.js',
     "    const key = getSegKey(line.x1, line.y1, line.x2, line.y2);",
     "    const key = getSegKey(line.x1 + 40, line.y1, line.x2, line.y2);"),

    ('wlaczenie trybu nie wlacza skali 1:1',
     'tests/test-autodim.js',
     "    if (autoDimOn && !autoFitOn) {",
     "    if (false) {"),

    ('pominiecie sciany zapisuje pusty wymiar',
     'tests/test-autodim.js',
     "  function skipAutoDim() {\n    autoDimPending = false;",
     "  function skipAutoDim() {\n    applyMeasureDimension();\n    autoDimPending = false;"),

    ('lista projektow sortowana niestabilnie',
     'tests/test-projekty.js',
     "        if (d !== 0) return d;\n        return String(b.id).localeCompare(String(a.id));",
     "        return d;"),

    ('tryb wymiar od razu nie jest zapamietywany w projekcie',
     'tests/test-autodim.js',
     "      wymiarOdRazu: autoDimOn,",
     "      wymiarOdRazu: false,"),

    ('tryb nie wraca po wczytaniu projektu',
     'tests/test-autodim.js',
     "    autoDimOn = !!data.wymiarOdRazu;",
     "    autoDimOn = false;"),

    ('przycisk pokazuje co innego niz stan trybu',
     'tests/test-autodim.js',
     "      b.innerText = autoDimOn ? '\u26a1 Wymiar od razu' : '\u26a1 Wymiar od razu (wy\u0142.)';\n    }\n    const sw = document.getElementById('wallColorSelect');",
     "      b.innerText = '\u26a1 Wymiar od razu (wy\u0142.)';\n    }\n    const sw = document.getElementById('wallColorSelect');"),

    ('pasek nie odtwarza ustawien z projektu',
     'tests/test-autodim.js',
     "    const lw = document.getElementById('lineWidthSelect');\n    if (lw) lw.value = defaultLineWidth;",
     "    const lw = null;\n    if (lw) lw.value = defaultLineWidth;"),

    ('otwor budowlany nie robi przerwy w scianie',
     'tests/test-otwory.js',
     "      odcinkiBezPrzejsc(segCaly, line).forEach(seg => {",
     "      [segCaly].forEach(seg => {"),

    ('okna i drzwi tez wycinaja sciane',
     'tests/test-otwory.js',
     "      if (!isPrzejscie(op)) return;",
     "      if (false) return;"),

    ('kawalki sciany liczone bez wyciecia przejscia',
     'tests/test-otwory.js',
     "    const przej = przejsciaNaScianie(line);\n    if (!przej.length) return [seg];",
     "    const przej = [];\n    if (!przej.length) return [seg];"),

    ('kolce po kikutach scianki zostaja w obrysie',
     'tests/test-otwory.js',
     "    poly = removeSpikes(poly);",
     "    // poly = removeSpikes(poly);"),

    ('odleglosc od naroznika liczona do srodka otworu',
     'tests/test-otwory.js',
     "    const srodek = dystPx + wPx / 2;",
     "    const srodek = dystPx;"),

    ('lewy naroznik zalezy od kierunku rysowania',
     'tests/test-otwory.js',
     "    const aPierwszy = pionowa ? (a.y <= b.y) : (a.x <= b.x);",
     "    const aPierwszy = true;"),

    ('otwory rysowane w stalym rozmiarze, nie w skali',
     'tests/test-otwory.js',
     "  function openingWidthPx(op) { return (parseFloat(op.width) || 0) / 100 * PIXELS_PER_METER; }",
     "  function openingWidthPx(op) { return 60; }"),

    ('wymiary okien i drzwi nie sa pokazywane na szkicu',
     'tests/test-otwory.js',
     "      wiersze.push(op.width + '\u00d7' + op.height + ' cm');",
     "      // bez wymiarow"),

    ('rodzaj otworu zgadywany bez uwzglednienia prefiksu DW',
     'tests/test-otwory.js',
     "    if (id.indexOf('DZ') === 0) return 'drzwi';\n    if (id.indexOf('DW') === 0) return 'drzwiWew';",
     "    if (id.indexOf('D') === 0) return 'drzwi';\n    if (id.indexOf('DW') === 0) return 'drzwiWew';"),

    ('otwory z odlegloscia nie sa przeliczane po zmianie sciany',
     'tests/test-otwory.js',
     "      if (!op.odKrawedzi) return;\n      const li = hostLineIndex(op);",
     "      return;\n      const li = hostLineIndex(op);"),

    ('odczyt znow przeskakuje na blizszy naroznik',
     'tests/test-teren.js',
     "    if (!wallHoverAnchor || wallHoverAnchor.key !== best.key) {\n      wallHoverAnchor = { key: best.key, odA: fromA <= total - fromA };\n    }",
     "    wallHoverAnchor = { key: best.key, odA: fromA <= total - fromA };"),

    ('kotwica naroznika nie zmienia sie przy przejsciu na inna sciane',
     'tests/test-teren.js',
     "wallHoverAnchor.key !== best.key",
     "false"),

    ('dalmierz w trybie sumowania i tak wpisuje pierwszy pomiar',
     'tests/test-teren.js',
     "    if (distoSumaOn) {\n      // w trybie sumowania odczyt tylko dokladamy do listy",
     "    if (false) {\n      // w trybie sumowania odczyt tylko dokladamy do listy"),

    ('zatwierdzenie sumy nie zeruje skladnikow',
     'tests/test-teren.js',
     "    distoSkladniki = [];\n    renderDistoSuma();\n    // sume wpisujemy",
     "    renderDistoSuma();\n    // sume wpisujemy"),

    ('pusta suma jest wpisywana jako zero',
     'tests/test-teren.js',
     "    if (suma <= 0) { alert('Nie ma jeszcze czego zatwierdzać — zmierz przynajmniej jeden odcinek.'); return; }",
     "    if (false) { return; }"),

    ('cofniecie kasuje cala sume zamiast ostatniego pomiaru',
     'tests/test-teren.js',
     "  function distoCofnijPomiar() { distoSkladniki.pop(); renderDistoSuma(); }",
     "  function distoCofnijPomiar() { distoSkladniki = []; renderDistoSuma(); }"),

    ('pelny ekran nie chowa reszty strony',
     'tests/test-teren.js',
     "    document.body.classList.toggle('fs-active', on);",
     "    document.body.classList.toggle('fs-active', false);"),

    ('panel narzedzi startuje otwarty i zaslania plotno',
     'tests/test-teren.js',
     "    // wchodzac w pelny ekran chowamy panel - o to chodzi, zeby plotno bylo cale\n    setFsPanel(false);",
     "    setFsPanel(true);"),

    ('pasek narzedzi nie wraca po zamknieciu panelu',
     'tests/test-teren.js',
     "    if (pasek && gniazdo && pasek.parentNode !== gniazdo) gniazdo.appendChild(pasek);",
     "    if (pasek && gniazdo && fsPanelOn && pasek.parentNode !== gniazdo) gniazdo.appendChild(pasek);"),

    ('przyciaganie nie widzi lic grubych scian',
     'tests/test-mury.js',
     "    if (typeof wszystkieLica === 'function') {",
     "    if (false) {"),

    ('lico odsuniete o polowe grubosci zamiast o cala',
     'tests/test-mury.js',
     "    const lica = [srodek - gr / 2, srodek + gr / 2];",
     "    const lica = [srodek - gr / 4, srodek + gr / 4];"),

    ('mur rosnie do srodka pomieszczenia',
     'tests/test-mury.js',
     "      if (info.rodzaj === 'zewnetrzna') nowa = info.wnetrzePlus ? 'lewa' : 'prawa';",
     "      if (info.rodzaj === 'zewnetrzna') nowa = info.wnetrzePlus ? 'prawa' : 'lewa';"),

    ('sciana wewnetrzna traktowana jak zewnetrzna',
     'tests/test-mury.js',
     "    if (plus && minus) return { rodzaj: 'wewnetrzna', wnetrzePlus: true };",
     "    if (plus && minus) return { rodzaj: 'zewnetrzna', wnetrzePlus: true };"),

    ('reczny wybor strony jest nadpisywany przez tryb auto',
     'tests/test-mury.js',
     "      if (line.strRecznie) return;",
     "      if (false) return;"),

    ('punkt odniesienia liczony bez uwzglednienia odleglosci',
     'tests/test-mury.js',
     "    const d = (parseFloat(dystCm) || 0) / 100 * PIXELS_PER_METER;",
     "    const d = 0;"),

    ('punkt wzdluz sciany idzie w zla strone',
     'tests/test-mury.js',
     "      const cel = (doA <= doB) ? { x: line.x2, y: line.y2 } : { x: line.x1, y: line.y1 };",
     "      const cel = (doA <= doB) ? { x: line.x1, y: line.y1 } : { x: line.x2, y: line.y2 };"),

    ('krawedzie otworow nie sa punktami odniesienia',
     'tests/test-mury.js',
     "      lista.push({ x: op.x - ux * w / 2, y: op.y - uy * w / 2, opis: 'krawędź ' + op.id });",
     "      // bez krawedzi"),

    ('pusta odleglosc tworzy punkt w miejscu bazy',
     'tests/test-mury.js',
     "    if (!isFinite(dyst) || dyst < 0) { alert('Podaj odległość w centymetrach, np. 215'); return; }",
     "    if (false) { return; }"),

    ('zestawienie przegrod nie grupuje scian',
     'tests/test-mury.js',
     "      mapa[k].ile++;\n      mapa[k].dlugosc += Math.hypot(l.x2 - l.x1, l.y2 - l.y1) / PIXELS_PER_METER;",
     "      mapa[k].ile = 1;\n      mapa[k].dlugosc += Math.hypot(l.x2 - l.x1, l.y2 - l.y1) / PIXELS_PER_METER;"),

    ('numeracja przegrod zawsze zaczyna od jedynki',
     'tests/test-mury.js',
     "      if (m) max = Math.max(max, parseInt(m[1], 10));",
     "      if (false) max = 0;"),

    ('oznaczenie przegrody nie zapisuje sie przy scianie',
     'tests/test-mury.js',
     "      if (przegroda) l.przegroda = przegroda; else delete l.przegroda;",
     "      // bez zapisu"),

    ('limit dlugosci sciany 30 m podmieniony na 3 m',
     'tests/test-kontrola.js',
     "CHECK_WALL_MIN = 0.3, CHECK_WALL_MAX = 30;",
     "CHECK_WALL_MIN = 0.3, CHECK_WALL_MAX = 3;"),

    ('dopasowanie kluczy odcinkow wylaczone',
     'tests/test-obrysy.js',
     "  const KEY_MID_TOL = 8",
     "  const KEY_MID_TOL = 0"),

    ('prostowanie scian wylaczone',
     'tests/test-korekty.js',
     "const PIXELS_PER_METER = 50; const SNAP_RADIUS = 30; const ORTHO_ANGLE_TOLERANCE = 10;",
     "const PIXELS_PER_METER = 50; const SNAP_RADIUS = 30; const ORTHO_ANGLE_TOLERANCE = 0;"),
]

def uruchom(test):
    r = subprocess.run(['node', test], cwd=ROOT, capture_output=True, text=True, timeout=300)
    return r.returncode

def main():
    shutil.copy(IDX, KOPIA)
    oryginal = KOPIA.read_text(encoding='utf-8')
    zle = []
    try:
        for nazwa, test, stare, nowe in MUTACJE:
            if oryginal.count(stare) != 1:
                zle.append(f'{nazwa}: wzorzec nie pasuje ({oryginal.count(stare)} wystapien) — mutacja nieaktualna')
                continue
            IDX.write_text(oryginal.replace(stare, nowe), encoding='utf-8')
            kod = uruchom(test)
            znak = '✓' if kod != 0 else '✗'
            print(f'  {znak} {nazwa}  [{test.split("/")[-1]}]')
            if kod == 0:
                zle.append(f'{nazwa}: test PRZESZEDL na zepsutym kodzie')
    finally:
        IDX.write_text(oryginal, encoding='utf-8')
        KOPIA.unlink()

    print('')
    if zle:
        print('MUTACJE NIEWYKRYTE (' + str(len(zle)) + '):')
        for z in zle:
            print('  ✗ ' + z)
        sys.exit(1)
    print(f'✓ Wszystkie {len(MUTACJE)} mutacji zostało wykrytych przez testy.')

main()
