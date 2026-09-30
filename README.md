# SelimTwoday.github.io — Astro-varianten

En statisk, serverlös variant av Selim Hjorthalls personliga sida, byggd med
[Astro](https://astro.build) + TypeScript. Ingen backend, inget API, ingen
körande server — allt renderas till statisk HTML/CSS/JS vid build-tid och
eventuell interaktivitet körs helt i webbläsaren.

> Det här är ett fristående experiment på en egen branch
> (`selimtwoday-astro-version`) parallellt med andra implementationer av
> samma sida. Se avsnittet [Deploy till GitHub Pages](#deploy-till-github-pages)
> för viktig information om att bara **en** deployment kan vara aktiv åt gången.

## Innehåll

- [`/`](src/pages/index.astro) — visitkort/intro + ett responsivt rutnät med verktyg.
- [`/verktyg/pert/`](src/pages/verktyg/pert/index.astro) — nya PERT-kalkylatorn: Gruppestimat, PERT Pro och Enterprise.
- [`/verktyg/pert_old/`](src/pages/verktyg/pert_old/index.astro) — den tidigare PERT-sidan, orörd och kvar som reserv (`noindex`, canonical pekar på `/verktyg/pert/`).
- [`/verktyg/kodfilosofi/`](src/pages/verktyg/kodfilosofi/index.astro) — samlad kodfilosofi i stigande svårighetsgrad.

## Kom igång

Kräver Node.js 22+ och npm.

```sh
npm install
```

### Utveckling

```sh
npm run dev
```

Startar en lokal dev-server (default `http://localhost:4321`).

### Tester

```sh
npm test
```

Kör [Vitest](https://vitest.dev) mot PERT-domänlogiken i `src/lib/pert/`
(formel, svensk decimalparsing, validering och URL-rundtur). Använd
`npm run test:watch` för att köra testerna i bevakningsläge under utveckling.

### Produktionsbygge

```sh
npm run build
```

Bygger den statiska sajten till `./dist/`. `npm run preview` serverar den
byggda sajten lokalt för en sista koll innan deploy.

## PERT-kalkylatorn (`/verktyg/pert/`)

Sidan har tre lägen som delar skal, tabellkomponent och resultatpanel.
Lägesväljaren skriver `mode` i adressfältet.

| Läge | `mode` i URL | Internt läge | Idé |
| --- | --- | --- | --- |
| Gruppestimat | `group` | `participants` | Varje deltagare uppskattar hela uppgiften; värdena vägs ihop och mötestid läggs på. |
| PERT Pro | `tasks` | `tasks` | Deluppgifter summeras; osäkerheten vägs ihop och "Var sitter osäkerheten?" visar varje deluppgifts andel av variansen. |
| Enterprise | `grouptasks` | `grouptasks` | Se nästa avsnitt. |

**Delningslänkar.** Nya Gruppestimat-länkar skrivs som
`?mode=group&e=O,M,P[,namn]&e=…`, där namnet är valfritt, procentkodat och
högst 200 tecken. `m=` (mötestimmar per person) och `h=` (timmar per
arbetsdag) tas bara med när de avviker från standard. `h=` delas mellan
alla lägen. Äldre länkar utan `mode` (`?e=6,14,34&e=8,16,28`) läses som
Gruppestimat och skrivs om till det nya formatet första gången formuläret
är giltigt; adressfältet ändras aldrig medan formuläret är ogiltigt.
Länkar över gränserna (50 personer, 200 deluppgifter per person, 100
deltagare, 200 tecken per namn/titel, 32 000 tecken totalt) avvisas med ett
felmeddelande i stället för att tolkas delvis.

**Gemensam resultatpanel.** Alla tre lägen visar samma komponenter: stort tal
med arbetsdagar (`h=` delas mellan lägena) och ± σ, ett estimeringsmöte,
konfidensstapeln med 68 / 95 / 99,7 %-intervall (skrivs "a – b h"),
optimistiskt / mest troligt / pessimistiskt och en fällbar "Hur räknas det?".
PERT Pro och Enterprise har dessutom en fällbar **Var sitter osäkerheten?**
(öppen som standard). I Enterprise delas varje deluppgifts varians på antalet
personer, deluppgifter med samma titel slås ihop, och oenigheten mellan
personerna redovisas som en egen rad; andelarna summerar till 100 %.

**Estimeringsmöte.** I Gruppestimat räknas mötet alltid (deltagare × timmar per
person). I PERT Pro och Enterprise läggs det till med "Lägg till
estimeringsmöte" och tas bort med ×. Mötestiden är en fast kostnad som skjuter
estimat och intervall uppåt utan att göra dem bredare. PERT Pro anger antal
deltagare själv; Enterprise räknar sina personer. I länken skrivs `m=` (timmar
per person, alltid med när ett möte lagts till) och för PERT Pro `n=` (antal
deltagare). Länkar utan `m=` i dessa lägen har inget möte, så äldre länkar ger
samma resultat som förut.

**Preliminära resultat.** Medan formuläret är ofullständigt räknas de rader
som är giltiga och resultatet märks "Preliminärt · N rader räknas inte".
Delning, PNG och adressuppdatering kräver ett fullständigt, giltigt formulär.

**Gamla sidan.** `/verktyg/pert_old/` är en ren kopia av föregående
version med eget klientskript (`src/scripts/pert-client-old.ts`). Den delar
`src/lib/pert/`, som därför bara ändrats additivt: `mode=group` tolkas som
`participants` även där, så nya länkar öppnas också i gamla sidan.

**Typsnitt.** IBM Plex Sans och Mono är självhostade som subsettade
`woff2`-filer i `src/assets/fonts/` (licens: `OFL.txt`); inget laddas från
Google Fonts. Färger kommer från `--pert-*`-tokens i `global.css`, med
mörkt och ljust tema.

**Säkerhet.** Namn och titlar från länkar sätts bara via `textContent` eller
`value`; ett test i `src/scripts/pert/__tests__/` misslyckas om `innerHTML`,
`insertAdjacentHTML`, `outerHTML` eller `document.write` förekommer i
`src/scripts/pert/`. Produktionsbygget har en `Content-Security-Policy` via
`<meta>` på PERT-sidan. Länkar i Gruppestimat och Enterprise varnar för att
de innehåller namn och estimat, och länkar över 2 000 tecken varnar för att
kunna klippas av i vissa appar.

## PERT Pro Enterprise

Tredje läget (`?mode=grouptasks`) jämför namngivna användares uppskattningar
av **samma projektomfattning**. Varje användare kan ha sin egen uppdelning
i deluppgifter: sju mindre deluppgifter och fyra större deluppgifter går
att jämföra utan att någon får större vikt på grund av antalet rader.

Inom varje användare summeras deluppgifternas PERT-tider och varianser,
precis som i PERT Pro. Gruppens förväntade tid är sedan medelvärdet av
användarnas totaler, **inte summan av alla användares arbete**. Gruppens
varians är medelvärdet av användarnas PERT-varianser plus
populationsvariansen mellan deras förväntade totaler. Båda komponenterna,
användarnas avvikelser och varningar för osäkerhet/oenighet visas separat.
Samma varningströsklar som i gruppestimat används: över 30 % relativ
total standardavvikelse respektive över 40 % relativ spridning mellan
användarnas förväntade totaler.

Resultatpanelen visar en konfidensstapel med 68 / 95 / 99,7 %-intervall (samma
som i PERT Pro), genomsnittligt O, M och P, ett prickdiagram över
**Personernas totaler** med avvikelse från medelvärdet och spridning i
procent, samt varningar för oenighet och stort spann. Personerna väljs med
chips ovanför tabellen; en ny person får den valda personens titlar med
tomma värden. Om en person saknar deluppgifter som andra har med visas en
omfattningsvarning med en knapp som lägger till dem.

Intervall för en, två och tre standardavvikelser använder en
**normalapproximation**; procentsatserna är inte garanterade och är inte
konfidensintervall för medelvärdet. Fler användare minskar inte automatiskt
projektets osäkerhet. Negativa nedre gränser begränsas till noll. Modellen
antar oberoende deluppgifter inom varje användare; gemensamma risker och
olika detaljnivåer kan påverka uppskattad osäkerhet. Arbetsdagens längd är
inställbar, och mötestid ingår inte i detta läge.

Användare matas in lokalt utan konton eller backend. Det går att återanvända
en användares deluppgiftstitlar för en ny användare, med tomma O/M/P-värden.
Importera en `mode=tasks`-länk som en ny användare eller en
`mode=grouptasks`-länk som flera nya användare. Importen läser endast URL:ens
data, hämtar aldrig adressen och avvisar hela importen om någon del är
ogiltig. Befintliga estimat bevaras; bara ett orört startkort ersätts.
Knappen **Importera estimat** öppnar ett inbäddat fält för länken.
Vid lyckad import stängs fältet, den första importerade personen väljs och en
statusrad ("2 personer importerade. Befintliga estimat behålls.") visar
**Ångra**, som tar bort exakt de importerade personerna och återställer ett
ersatt startkort och arbetsdagen. Ogiltiga länkar lämnar fältet öppet med ett
felmeddelande; Gruppestimat-länkar avvisas. Tider importeras i timmar och
befintlig arbetsdagsinställning behålls (ett orört startkort tar över länkens
inställning).

Giltiga Enterprise-estimat delas som upprepade `g=`-parametrar med JSON
`[användarnamn, [[titel, O, M, P], …]]`; `h=` anger en icke-standardiserad
arbetsdag. Kopiera länk, PNG och bild + länk fungerar i alla tre lägen.
Namnen och estimaten ligger i delningslänken – dela därför inte länkar
med uppgifter som inte bör spridas. Som i PERT Pro kan endast ett
fullständigt, giltigt estimat delas; ofullständiga formulär är inte sparade
utkast och kan försvinna vid omladdning.

Första gången Enterprise öppnas visas en skämtsam köpmodal. Båda
köpknapparna sparar `pert-pro-enterprise-gag-dismissed=1` i `localStorage`
och visar en animerad **låtsasdebitering** för en användare: 12 månader
à 4 990 kr, totalt 59 880 kr. Inga betalningar, konton eller nätverksanrop
ingår i skämtet. Flaggan gäller den aktuella webbläsaren och webbplatsens
origin; radera den för att visa skämtet igen. Escape stänger modalen utan
att sätta flaggan. Reducerad rörelse visar kvittot direkt; blockerad
lagring ger en tydlig varning om att engångsflaggan inte kan sparas.

## Struktur och designbeslut

```text
src/
├── components/       Header, Footer, ToolCard — delade UI-block; pert/ har Astro-delar för PERT-sidan
├── content/          Statisk innehållsdata (t.ex. kodfilosofi.ts)
├── layouts/          BaseLayout.astro — delad <head>, nav, footer, hoppa-till-innehåll-länk
├── lib/pert/         Ren domänlogik för PERT: types, calculate, format, validate, url, scope
│                     (100 % separerad från DOM/UI — enkel att enhetstesta, se __tests__/)
├── pages/            Filbaserad routing: /, /verktyg/pert/, /verktyg/pert_old/, /verktyg/kodfilosofi/
├── scripts/          Klient-TypeScript som progressivt förbättrar statiska sidor
│                     (pert/ för nya kalkylatorn, pert-client-old.ts för pert_old).
│                     Ligger *utanför* src/pages så Astro inte av misstag
│                     exponerar dem som egna routes.
└── styles/           global.css — design tokens (CSS custom properties), mörkt
                       nedtonat tema som standard, ljust tema via prefers-color-scheme
```

Viktiga val:

- **Domänlogik separerad från UI.** All PERT-matematik, validering och
  URL-kodning/avkodning i `src/lib/pert/` är rena funktioner utan DOM-beroenden.
  UI-lagret (`src/scripts/pert/`) importerar och binder dem till
  formuläret. Det gör logiken snabb och enkel att testa med Vitest
  utan en headless browser.
- **Inget UI-ramverk.** PERT-sidans interaktivitet (lägg till/ta bort rader,
  validering, dela länk, PNG-export) är skriven i vanlig TypeScript som
  körs som en modul-`<script>`. Det håller beroenden minimala och undviker
  hydreringskostnad för en såpass liten mängd interaktivitet.
- **Kompakt verktygsnavigation.** Verktygssidorna har ingen separat
  tillbaka-rad; länken **SelimTwoday** i sidhuvudet leder till startsidan.
- **Design tokens via CSS custom properties.** Mörkt, nedtonat tema är
  standard; ett mjukt, icke-bländande ljust tema aktiveras automatiskt via
  `prefers-color-scheme: light`. Fokusringar, semantisk HTML och tillräcklig
  kontrast är genomgående.
- **URL som delningsformat.** PERT-resultat kan delas exakt via URL:en
  (`?mode=group&e=6,14,34&e=8,16,28&...` plus kompakta `m=`/`h=`-parametrar när
  mötestid eller arbetsdag avviker från standardvärdena; äldre länkar utan
  `mode` läses fortfarande). Sidan
  synkroniserar automatiskt adressfältet (`history.replaceState`) så en
  bokmärkt eller uppdaterad sida återskapar exakt samma resultat.
- **PNG-export utan tunga beroenden.** `html-to-image` (litet, fokuserat
  bibliotek) används för att rendera resultatpanelen till en PNG-blob
  client-side, som sedan kopieras via `navigator.clipboard.write` eller,
  om det inte stöds/tillåts, laddas ner direkt — med tydlig, tillgänglig
  återkoppling i båda fallen.

## Deploy till GitHub Pages

Workflown i [`.github/workflows/deploy-astro-pages.yml`](.github/workflows/deploy-astro-pages.yml)
är **enbart manuell** (`workflow_dispatch`) och har ett hårt branch-skydd:
jobbet avbryts direkt om `github.ref_name` inte är exakt
`selimtwoday-astro-version`. Den bygger med Node 22, kör testerna, kör
`astro build` och publicerar `./dist` med de officiella
`configure-pages` / `upload-pages-artifact` / `deploy-pages`-actionsen.
`base` är satt till `/` i `astro.config.mjs` eftersom repot är ett
användarsite (`SelimTwoday.github.io`).

**Viktigt:** GitHub Pages har bara **en** aktiv deployment per repo. Om fler
branches (t.ex. en SvelteKit-variant) också har en Pages-workflow, ersätter
den senast körda workflown vad som är publicerat — de konkurrerar om samma
Pages-miljö. Kör bara den här workflown när Astro-varianten faktiskt ska
vara den som är live.

## Astro DX-observationer

Kortfattade, faktabaserade iakttagelser från det här bygget:

- **Filbaserad routing är väldigt förutsägbar.** `src/pages/verktyg/pert/index.astro`
  blir `/verktyg/pert/` utan konfiguration — enkelt att resonera om structure ↔ URL.
- **`.astro`-komponenter blandar frontmatter (TS), markup och scoped CSS i en fil**,
  vilket är bekvämt för sidor men gör det extra viktigt att lägga *ren logik*
  i vanliga `.ts`-moduler (som `src/lib/pert/`) för att kunna enhetstesta den
  utan att gå via komponentrendering.
- **`<script>`-taggar i `.astro`-filer bearbetas av Vite** och kan importera
  vanliga TS-moduler rakt av — bra DX, men filer med klientlogik måste
  medvetet placeras *utanför* `src/pages/` (t.ex. `src/scripts/`), annars
  behandlar Astro dem som egna sidor och försöker serverrendera dem, vilket
  kraschar bygget med `ReferenceError: document is not defined`. Detta
  upptäcktes under arbetet och löstes genom att flytta klientkoden till
  `src/scripts/`.
- **Typescript-ekosystemet ligger just nu steget före `@astrojs/check`.**
  Vid det här bygget var senaste stabila `typescript` `7.0.2`, men
  `@astrojs/check` deklarerar ett peer-beroende på `^5.0.0 || ^6.0.0` och
  kunde därför inte installeras utan att nedgradera TypeScript. Astros
  egen build (`astro build`) fungerar utmärkt även utan `astro check`,
  men den separata typkontrollen är alltså tillfälligt otillgänglig med
  den allra senaste TypeScript-versionen.
- **Statisk export (`output: 'static'`) kräver ingen adapter** och ger en
  ren `./dist`-mapp med bara HTML/CSS/JS/favicon — perfekt för GitHub Pages
  utan någon körande server.

## Kända begränsningar / sådant som inte kan verifieras automatiskt

Följande beteenden är beroende av en riktig webbläsare och kunde inte
exercisas i den här icke-interaktiva miljön (endast `npm run build` +
`npm test` + statisk inspektion av `dist/` har körts):

- Faktisk `navigator.clipboard.writeText`/`.write(...)`-kopiering (både
  lyckad kopiering och den tillgängliga felhanteringen/nedladdningsfallbacken)
  för dela-länk- och PNG-knapparna.
- Det visuella resultatet av `html-to-image`s rendering av resultatpanelen
  (avrundade hörn, typsnitt, färger) i en riktig canvas/PNG.
- `prefers-color-scheme`-växlingen mellan mörkt och ljust tema i en riktig
  webbläsare (CSS:en är skriven och granskad manuellt, men aldrig
  screenshot-testad).
- Tangentbordsnavigering och skärmläsarupplevelse (fokusringar, `aria-live`-
  meddelanden) är implementerade enligt best practice men har inte körts
  igenom en faktisk skärmläsare.
