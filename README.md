# Szkicownik

Rzuty, przekroje i elewacje. Jeden plik `index.html`, działa offline na tablecie,
dane zostają w przeglądarce. Bez konta, bez serwera, bez Dysku.

---

## Co potrafi

**Rysowanie.** Ściany z prostowaniem prawie prostych linii i przyciąganiem do
istniejących narożników, otwory, pomieszczenia rozpoznawane po kliknięciu
w środku, skosy poddasza, obszary kreskowane, ołówek, miarka, opisy, komentarze
ze strzałką, szablony gotowych rzutów.

**Ściany z grubością.** Grubość w centymetrach, ściana rysuje się jako
zakreskowany pas. Pole **Pas** decyduje, po której stronie rysowanej linii ten
mur leży: na osi (po połowie na każdą stronę), po lewej albo po prawej — licząc
względem kierunku rysowania, z przyciskiem ⇄ do przerzucenia. Rysując po licu
wewnętrznym i kładąc pas na zewnątrz, dostajesz powierzchnię w świetle ścian
wprost, bez przeliczeń. Domyślną grubość ustawia się polem obok narzędzia
📏 Ściana, pojedynczą ścianę zmienia się narzędziem 🧱 Grubość. Ściana
o grubości 0 jest cienką linią, tak jak wcześniej.

**Rysunek w rzeczywistej skali (📐 Skala 1:1).** Po wpisaniu wymiaru rysunek
sam dociąga się tak, żeby długości na ekranie odpowiadały zmierzonym. Ściany
rysowane pod kątem prostym takie zostają, a ściany niemierzone wynikają
z zamknięcia figury. Przełącznik da się wyłączyć, jest też ręczne ⟳ Dopasuj.

**Przeszkody (⬛).** W siedmiu kolorach — komin, szacht, opaska i taras na jednym
rysunku przestają się zlewać. Kolor trafia też do tabel i na wydruk.
 Komin, słup, szacht, zabudowa, schody. Przeciągnięcie
palcem daje prostokąt, kliknięcie wewnątrz obszaru domkniętego ścianami
wypełnia cały obrys. Wymiary podaje się w centymetrach i wtedy rysunek jest
w skali. Można zaznaczyć, że przeszkoda ma być odejmowana od powierzchni.

**Wymiarowanie.** Liczą się wyłącznie wpisane wymiary — program nigdy nie
podaje długości odczytanej z rysunku. Prostokąt wymaga dwóch pomiarów, nie
czterech; ściany scalają się w ciągi; jeden skos liczy się sam z zamknięcia.

**Dwie powierzchnie.** Po osiach ścian (jak dotąd) oraz w świetle ścian —
pomniejszona o pas ścian wzdłuż obwodu i o odejmowane przeszkody. To druga,
osobna liczba; pierwsza się nie zmienia.

**Kontrola pomiarów.** Panel pod szkicem, liczony lokalnie i offline:
⛔ sprzeczności, ⚠️ do sprawdzenia, ℹ️ braki. Nie blokuje pracy.

**Dalmierz Leica DISTO** przez Bluetooth (X3, X4). Wymaga zainstalowanej
aplikacji spod adresu HTTPS — z pliku otwartego z pamięci przeglądarka
blokuje Bluetooth.

**Ciągi wymiarowe (📏 Ciągi).** Wymiary odsunięte poza obrys budynku, z liniami
pomocniczymi z narożników i ukośnymi kreskami zamiast strzałek — tak jak na
rysunku technicznym. Ma sens przy włączonej skali 1:1, bo dopiero wtedy liczby
zgadzają się z długością linii pod nimi.

**Przyciąganie do 45° (◺).** Skosy dachu i ścięte narożniki rzadko udaje się
trafić palcem. Linia prowadzona blisko przekątnej dociąga się do dokładnych 45°,
z węższą tolerancją niż przy poziomie i pionie (6° zamiast 10°), żeby skosy,
które mają zostać dowolne, zostały dowolne. Przełącznik można wyłączyć.

**Odbicie i obrót (⇋ ⇅ ⟳).** Odbicie lewo-prawo, góra-dół, obrót o 90°.
Wpisane pomiary jadą razem z rysunkiem.

**Lista projektów (🗂️).** Kilka budynków obok siebie, przełączanie bez pliku
pośredniego, duplikowanie i usuwanie. Projekty siedzą w IndexedDB, więc limit
5 MB z localStorage już nie obowiązuje. Projekt zapisany starszą wersją
przenosi się sam przy pierwszym uruchomieniu.

**Zdjęcia z opisem (🖼️).** Osobny rodzaj szkicu: w tle leży zdjęcie, a wszystkie
narzędzia opisowe — 📐 Miarka, ✏️ Ołówek, 🔤 Txt, 💬 Komentarz, ▨ Kreskowanie —
działają na nim tak samo jak na rysunku. Zdjęcia są przy wgrywaniu zmniejszane
do 1600 px i zapisywane jako JPEG, żeby plik projektu nadawał się do wysłania.
Można wgrać kilka naraz; każde trafia na własną zakładkę.

Opcjonalna **kalibracja**: rysujesz Miarką odcinek na czymś, czego długość znasz
(framuga, płyta, rozłożona miarka), podajesz ile ma metrów — i kolejne miarki
dostają podpowiedź długości. Podpowiedź, nie wpis: skala jest wiarygodna tylko
w płaszczyźnie odcinka odniesienia, perspektywa zafałszuje wszystko, co leży
bliżej albo dalej od aparatu.

Na zdjęciu nie ma ścian, pomieszczeń, otworów, powierzchni ani kontroli pomiarów
— te narzędzia są wygaszone. Zdjęcie nie jest rzutem i nie wchodzi do bilansu
metrażu.

**Wydruk (🖨️).** Strony A4 poziomo, po jednej na szkic: tabelka z nazwą projektu
i datą, rysunek, podziałka metrowa oraz tabele pomieszczeń, otworów i przeszkód.
Zwykłe okno drukowania przeglądarki — da się z niego zapisać PDF.

**Warstwy przy eksporcie (🧱).** Wyłączenie przeszkód, otworów, opisów,
komentarzy, miarek, ołówka albo kreskowania przed zapisem PNG i wydrukiem.
Na ekranie podczas pracy widać wszystko.

**Dane.** Autozapis w przeglądarce, pobranie szkicu jako PNG, zapis i wczytanie
całego projektu jako plik JSON. Wczytany plik zakłada nowy projekt na liście,
zamiast nadpisywać otwarty.

---

## Wdrożenie na GitHub Pages

1. Wgraj do repozytorium całą zawartość tego katalogu, razem z ukrytymi
   plikami `.nojekyll` i `.github/`.
2. `Settings → Pages → Source = GitHub Actions`.
   **Nie „Deploy from a branch"** — stary mechanizm wiesza się na przetwarzaniu
   Jekyll.
3. Poczekaj, aż zakładka *Actions* pokaże zielony znaczek. Adres pojawi się
   w `Settings → Pages`.
4. Na tablecie otwórz ten adres w Chrome i wybierz *Zainstaluj aplikację*.

### Po każdej zmianie w `index.html`

Podbij `CACHE_NAME` w `sw.js`:

```js
const CACHE_NAME = 'szkicownik-v1';   // -> v2, v3, ...
```

Bez tego urządzenia zostaną na starej wersji i będziesz szukał błędu, którego
dawno nie ma w kodzie. To najczęstsza przyczyna „poprawiłeś, a dalej nie działa".

---

## Testy

```bash
npm install        # raz, ściąga jsdom
npm test           # wszystkie zestawy
npm run test:mutacje
```

Testy ładują **całe `index.html`** do sztucznej przeglądarki i wywołują
prawdziwe funkcje aplikacji. Nie ma przepisanej logiki — jeśli test przechodzi,
działa kod, który trafia na urządzenie.

| Zestaw | Czego pilnuje |
|---|---|
| `test-obrysy.js` | rozpoznawanie obrysów i liczenie powierzchni przy drżącej ręce |
| `test-korekty.js` | poprawianie tego, co już wstawione, bez cofania całej pracy |
| `test-grubosc.js` | grubość ścian i zapis/odczyt projektu |
| `test-kontrola.js` | zakresy, sprzeczności i braki w pomiarach |
| `test-opisy.js` | czytelność podpisów, granice eksportu, kolory przeszkód |
| `test-zdjecia.js` | zdjęcia, kalibracja, wyłączenie narzędzi rysunkowych |
| `test-skala.js` | dopasowanie rysunku do wymiarów, przeszkody, tabela przeszkód, powierzchnia w świetle |
| `test-projekty.js` | magazyn projektów (obie drogi), wydruk, warstwy, odbicie i obrót, ciągi |
| `mutacje.py` | czy testy w ogóle coś łapią — psuje kod celowo i sprawdza reakcję |

Testy mutacyjne są tu nie dla ozdoby. Pierwsza wersja zestawu kontroli
przepuszczała podmianę limitu długości ściany z 30 m na 3 m — bez tej
weryfikacji miałbym testy zawsze na zielono i zero pewności.

---

## Na co uważać przy dalszych zmianach

**Klucze odcinków liczą się ze współrzędnych** (`środekX_środekY_długość`).
Cokolwiek przesuwa ściany, musi przepisać klucze wpisanych wymiarów, inaczej
wszystkie pomiary zostaną po cichu porzucone, a pomieszczenia pokażą „Wymaga
pomiaru!" mimo zmierzenia wszystkiego. Tym zajmuje się `anchorCustomDims`
i `rekeyCustomDims` — nie omijaj ich.

**Prostowanie ma pierwszeństwo przed przyciąganiem do węzła.** W odwrotnej
kolejności koniec ściany przykleja się ukośnie do dowolnego węzła w promieniu
30 px i nie da się linii wyprostować.

**Klasyfikacja ścian idzie po kącie, nie po pikselach.** Tolerancja 3°.
Krzywizna 2 px potrafiła zrobić z prostokąta skos i pole wychodziło 24,95
zamiast 25,00.

**Węzły scalają się po odległości, nie przez zaokrąglanie do siatki.**
Zaokrąglanie nie działa — pomieszczenia o pięciu i więcej ścianach czasem się
nie domykają.

**Narysowana linia jest linią odniesienia.** Wymiary, obrysy, powierzchnie,
przyciąganie i domykanie narożników liczą się po niej i tylko po niej. Wybór
strony pasa przesuwa wyłącznie to, co namalowane — geometrii nie rusza, więc
klucze odcinków zostają te same, a pomiary nie wędrują.

**Prostowanie ma pierwszeństwo przed wszystkim, co przesuwa punkt w poprzek.**
Zarówno przyciąganie do węzła, jak i prowadnice wyrównujące potrafiły przechylić
wyprostowaną ścianę: pierwsze o 12 px, drugie o 20. Dociąganie bierze więc
wyłącznie składową wzdłuż linii, a prowadnice dostają blokadę na współrzędną,
którą trzyma prostowanie. Niedomknięty narożnik i tak sklei GAP_TOL.

**Powierzchnia liczy się po osiach ścian.** Grubość i dopasowanie rysunku są
warstwą wizualną i nie mają prawa ruszyć ani jednej liczby w tabeli. Powierzchnia
w świetle jest osobną, drugą liczbą. Zmiana tego założenia oznacza przepisanie
rozpoznawania obrysu i całego wymiarowania — i unieważnienie testów, które je
pilnują.

**Cokolwiek rusza współrzędne, przechodzi przez `anchorCustomDims`.**
Dotyczy to dopasowania skali, odbicia i obrotu. Nowa funkcja przesuwająca
rysunek bez tego kroku wygląda na działającą do chwili, gdy ktoś zajrzy
w tabelę i zobaczy „Wymaga pomiaru!" na zmierzonym pomieszczeniu.

**Magazyn ma dwie drogi i obie trzeba testować.** IndexedDB oraz zapas na
`localStorage`, który włącza się w prywatnym oknie i na starszych
przeglądarkach — czyli dokładnie tam, gdzie nie sprawdzisz tego ręcznie.
`test-projekty.js` przechodzi cały scenariusz dwa razy, raz na każdej drodze.

**Wydruk rysuje na podmienionym płótnie.** `renderSketchToDataURL` przestawia
globalne `ctx`, `objects` i `currentMode`, po czym przywraca je w `finally`.
Gdyby przywracanie zawiodło, aplikacja zostaje w trybie `export` i przestaje
reagować normalnie. Test tego pilnuje.

---

## Stałe i tolerancje

```js
PIXELS_PER_METER = 50      // 1 m = 50 px, płótno 3000×3000 = 60×60 m
SNAP_RADIUS = 30           // px - przyciąganie do istniejących punktów
ORTHO_ANGLE_TOLERANCE = 10 // stopnie - prostowanie linii przy rysowaniu
DIAG_ANGLE_TOLERANCE = 6   // stopnie - przyciąganie do 45 stopni (węziej!)
ORTHO_NODE_TOL = 12        // px - dociąganie do węzła PO wyprostowaniu
FACE_TOL = 3.5             // px - scalanie końców w jeden węzeł grafu
GAP_TOL = 12               // px - dociąganie niedomkniętych narożników
KEY_MID_TOL = 8            // px - dopasowanie kluczy: przesunięcie środka
KEY_LEN_TOL = 18           // px - dopasowanie kluczy: różnica długości
FIT_ITERACJE = 400         // kroki relaksacji przy dopasowaniu rysunku
FIT_DOKLADNOSC = 0.25      // px - poniżej tego uznajemy, że rysunek pasuje
CHAIN_ODSTEP = 46          // px - odsunięcie pierwszej linii wymiarowej od obrysu
CHAIN_POZIOM = 30          // px - odstęp między kolejnymi poziomami ciągu
MAX_THICKNESS_CM = 200     // grubość ściany ponad to traktujemy jak pomyłkę
FOTO_MAX_PX = 1600         // dłuższy bok zdjęcia po zmniejszeniu
FOTO_JAKOSC = 0.75         // kompresja JPEG przy wgrywaniu
```

Kontrola pomiarów: tolerancja porównań 2 cm, ściana 0,3–30 m, wysokość
kondygnacji 1,8–5 m, otwory 30–400 cm.

---

## Struktura danych

```js
sketches = [{
  id, name, kind: 'rzut'|'przekroj'|'skosy'|'zdjecie', height: '2.60',
  panX, panY, zoomLevel, showDimensions,
  photo: { src, w, h, opis, skalaPxNaM },          // tylko przy kind: 'zdjecie'
  objects: {
    lines:     [{x1, y1, x2, y2, gr}],           // gr w cm, brak = cienka linia
    rooms:     [{id, num, name, polygon, area, centroid, _spans}],
    openings:  [{x, y, angle, id, width, height}],        // wymiary w cm
    obstacles: [{id, polygon, label, subtract, w, d}],     // w/d w cm
    customDims: { "srodekX_srodekY_dlugosc": {val: '5.00'} },
    labels: [], callouts: [], freehand: [],
    noteLines: [], apexDims: {}, hatches: [], slopes: []
  }
}]
```

Plik projektu (JSON): `{ format: 'szkicownik', wersja, nazwa, zapisano,
domyslnaGrubosc, sketches }`. Projekty bez nowych pól wczytują się normalnie —
brakujące tablice są uzupełniane przy wczytaniu.

W magazynie rekord wygląda tak: `{ id, nazwa, zapisano, dane }`, gdzie `dane`
to dokładnie treść pliku JSON. Dzięki temu plik i wpis w magazynie to ten sam
format — zapis do pliku i odczyt z listy nie mogą się rozjechać.
