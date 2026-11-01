# Newsy

Newsy is a news and public records website I'm working on for Equal Horizons.

I wanted a way to look up what's happening in a place without jumping between a bunch of news sites and government websites. With Newsy, you can pick a city, explore the globe, read news, and find public documents. The links take you back to the original sources if you want to dig deeper.

It's still a work in progress, especially when it comes to covering smaller places around the world.

## Try it

[Open Newsy](https://newsy-17wetxhhz-mithilesshb-2621s-projects.vercel.app/)

You can also run it on your own computer using the steps below.

## What it can do

- Explore places using an interactive globe or location search.
- Find news from different parts of the world.
- Search government documents and public records from available sources.
- View mapped events like earthquakes and wildfires.
- Save things to come back to later when accounts are set up.

## What I used

The site uses **Next.js, React, TypeScript, and CSS**. The globe runs with **WebGL** and has a Canvas fallback for browsers that can't use it. **Supabase** handles accounts and saved data. News and records come from public feeds and APIs, including GDELT, USGS, NASA, and government sources.

## Run it locally

You'll need Node.js 24 and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Go to [localhost:3000](http://localhost:3000). Some features work without keys, but accounts, saved items, and certain government sources need credentials in `.env.local`.

To check the code, run:

```bash
npm test
npm run typecheck
npm run build
```

## Deploy it

Push the project to GitHub and import it into **Vercel** as a Next.js project. Add the environment variables from `.env.example` in Vercel's settings. If you want accounts and saved records, create a Supabase project and run `sql/INSTALL_ALL.sql` there.

More setup details are in [DEPLOY.md](DEPLOY.md). Don't commit API keys to GitHub.
