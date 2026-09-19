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
- [`/verktyg/pert/`](src/pages/verktyg/pert/index.astro) — PERT-kalkylator för gruppestimat.
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

## Struktur och designbeslut

```text
src/
├── components/       Header, Footer, ToolCard — delade, återanvändbara UI-block
├── content/          Statisk innehållsdata (t.ex. kodfilosofi.ts)
├── layouts/          BaseLayout.astro — delad <head>, nav, footer, hoppa-till-innehåll-länk
├── lib/pert/         Ren domänlogik för PERT: types, calculate, format, validate, url
│                     (100 % separerad från DOM/UI — enkel att enhetstesta, se __tests__/)
├── pages/            Filbaserad routing: /, /verktyg/pert/, /verktyg/kodfilosofi/
├── scripts/          Klient-TypeScript som progressivt förbättrar statiska sidor
│                     (t.ex. pert-client.ts). Ligger *utanför* src/pages så Astro
│                     inte av misstag exponerar dem som egna routes.
└── styles/           global.css — design tokens (CSS custom properties), mörkt
                       nedtonat tema som standard, ljust tema via prefers-color-scheme
```

Viktiga val:

- **Domänlogik separerad från UI.** All PERT-matematik, validering och
  URL-kodning/avkodning i `src/lib/pert/` är rena funktioner utan DOM-beroenden.
  UI-lagret (`src/scripts/pert-client.ts`) importerar och binder dem till
  formuläret. Det gör logiken snabb och enkel att testa (41 Vitest-tester)
  utan en headless browser.
- **Inget UI-ramverk.** PERT-sidans interaktivitet (lägg till/ta bort rader,
  validering, dela länk, PNG-export) är skriven i vanlig TypeScript som
  körs som en modul-`<script>`. Det håller beroenden minimala och undviker
  hydreringskostnad för en såpass liten mängd interaktivitet.
- **Design tokens via CSS custom properties.** Mörkt, nedtonat tema är
  standard; ett mjukt, icke-bländande ljust tema aktiveras automatiskt via
  `prefers-color-scheme: light`. Fokusringar, semantisk HTML och tillräcklig
  kontrast är genomgående.
- **URL som delningsformat.** PERT-resultat kan delas exakt via URL:en
  (`?e=6,14,34&e=8,16,28&...` plus kompakta `m=`/`h=`-parametrar när
  mötestid eller arbetsdag avviker från standardvärdena). Sidan
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
