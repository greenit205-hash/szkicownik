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
     "    const h = t / 2;\n    const e1 = cornerOvershoot",
     "    const h = t / 4;\n    const e1 = cornerOvershoot"),

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
     "      const line = objects.lines[k.lineIndex];",
     "      const line = objects.lines[(k.lineIndex + 1) % objects.lines.length];"),

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
     "      .sort((a, b) => String(b.zapisano).localeCompare(String(a.zapisano)));",
     "      .sort((a, b) => String(a.zapisano).localeCompare(String(b.zapisano)));"),

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
