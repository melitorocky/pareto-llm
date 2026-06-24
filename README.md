This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Requisiti

- Node.js >= 20.9.0 (Next.js 16 richiede Node >= 20.9)

## Avvio locale

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Se vedi errori legati alla versione di Node, aggiorna Node alla versione indicata sopra.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

Questo progetto usa [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) per caricare [Geist](https://vercel.com/font).

## Funzionalità principali

- Dashboard pubblica (ITA), responsive, con:
  - Tabella modelli con: Nome, $/token in/out, $/1M in/out, Contesto, Tipologia, Peculiarità, Knowledge cutoff
  - Grafico scatter: $/1M input (log) vs Contesto (log), famiglie in evidenza: OpenAI, Anthropic, Grok
  - Card consigli per: Pianificazione, Sviluppo/Build, Modifiche Codice
  - Slider “Bilancia costo e qualità” con persistenza in localStorage
  - Pulsante “Aggiorna” per refetch

## Note dati

La pagina usa la route `/api/models` che fa da proxy a `https://openrouter.ai/api/v1/models` (nessuna chiave richiesta). La cache è di 30 minuti; il pulsante “Aggiorna” invalida la cache client-side.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
