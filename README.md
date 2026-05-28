# BRRR Deal Analyzer

A simple React app for UK property investors to estimate BRRR cashflow, yields, refinance cash left in the deal, ROI, and a beginner-friendly viability score.

## What it calculates

- Monthly cashflow
- Annual cashflow
- Gross yield
- Net yield
- Stamp duty estimate
- Legal fees estimate
- Cash left in the deal after refinance
- Estimated ROI
- BRRR viability score

## Stamp duty note

The app estimates Stamp Duty Land Tax for England and Northern Ireland using residential rates from 1 April 2025, plus the 5% additional-property surcharge often relevant to investors. Always check HMRC or a qualified adviser before relying on the numbers.

## Run locally

1. Install Node.js from `https://nodejs.org` if you do not already have it.
2. Open this folder in a terminal.
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

5. Open the local URL shown in the terminal, usually `http://localhost:5173`.

## Project structure

```text
src/App.jsx       Main calculator UI and deal calculations
src/styles.css    Dark mode responsive styling
src/main.jsx      React app entry point
index.html        Page shell used by Vite
package.json      Scripts and dependencies
```
# brrr-deal-analyser
