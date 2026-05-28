import React, { useMemo, useState } from 'react';

const initialInputs = {
  purchasePrice: 180000,
  refurbCost: 25000,
  monthlyRent: 1250,
  interestRate: 5.75,
  loanToValue: 75,
  refinanceValue: 250000,
  legalFees: 2500,
};

const fields = [
  {
    name: 'purchasePrice',
    label: 'Property purchase price',
    prefix: 'GBP',
    helper: 'What you expect to pay for the property.',
  },
  {
    name: 'refurbCost',
    label: 'Estimated refurb cost',
    prefix: 'GBP',
    helper: 'Works needed before refinance or letting.',
  },
  {
    name: 'monthlyRent',
    label: 'Expected monthly rent',
    prefix: 'GBP',
    helper: 'Gross rent before mortgage and expenses.',
  },
  {
    name: 'interestRate',
    label: 'Mortgage interest rate',
    suffix: '%',
    helper: 'Annual interest rate for an interest-only mortgage.',
  },
  {
    name: 'loanToValue',
    label: 'Loan-to-value',
    suffix: '%',
    helper: 'How much of the refinance value the lender may advance.',
  },
  {
    name: 'refinanceValue',
    label: 'Estimated refinance value',
    prefix: 'GBP',
    helper: 'Expected value once the refurb is complete.',
  },
  {
    name: 'legalFees',
    label: 'Legal fees estimate',
    prefix: 'GBP',
    helper: 'Solicitor, broker, valuation, and other buying costs.',
  },
];

function formatMoney(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;
}

function calculateStampDuty(price) {
  // England and Northern Ireland residential SDLT bands from 1 April 2025.
  // BRRR investors often buy additional properties, so this estimate includes
  // the 5% additional-property surcharge on each band.
  const bands = [
    { threshold: 125000, rate: 0.05 },
    { threshold: 250000, rate: 0.07 },
    { threshold: 925000, rate: 0.1 },
    { threshold: 1500000, rate: 0.15 },
    { threshold: Infinity, rate: 0.17 },
  ];

  let remaining = Math.max(price, 0);
  let previousThreshold = 0;
  let stampDuty = 0;

  for (const band of bands) {
    const taxableAmount = Math.min(remaining, band.threshold - previousThreshold);

    if (taxableAmount <= 0) {
      break;
    }

    stampDuty += taxableAmount * band.rate;
    remaining -= taxableAmount;
    previousThreshold = band.threshold;
  }

  return stampDuty;
}

function getViabilityScore(metrics) {
  // The score is intentionally simple for v1: each useful BRRR signal adds
  // points, giving beginners a quick read without pretending to be advice.
  let score = 0;

  if (metrics.monthlyCashflow > 0) score += 25;
  if (metrics.netYield >= 6) score += 25;
  else if (metrics.netYield >= 4) score += 15;

  if (metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.25) score += 25;
  else if (metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.5) score += 15;

  if (metrics.roi >= 20) score += 25;
  else if (metrics.roi >= 10) score += 15;

  return Math.min(score, 100);
}

function App() {
  const [inputs, setInputs] = useState(initialInputs);

  function updateInput(name, value) {
    setInputs((currentInputs) => ({
      ...currentInputs,
      [name]: Number(value),
    }));
  }

  const metrics = useMemo(() => {
    const stampDuty = calculateStampDuty(inputs.purchasePrice);

    // Total money needed before refinance: purchase, refurb, stamp duty, and legal fees.
    const totalCashInvested = inputs.purchasePrice + inputs.refurbCost + stampDuty + inputs.legalFees;

    // A BRRR refinance is usually based on the new value after works, not the original price.
    const refinanceLoan = inputs.refinanceValue * (inputs.loanToValue / 100);

    // This v1 assumes an interest-only mortgage, which is common for rental deal analysis.
    const monthlyMortgagePayment = (refinanceLoan * (inputs.interestRate / 100)) / 12;
    const monthlyCashflow = inputs.monthlyRent - monthlyMortgagePayment;
    const annualCashflow = monthlyCashflow * 12;

    // Gross yield uses rent compared with purchase price. Net yield here uses cashflow
    // after mortgage interest compared with the total cash invested.
    const grossYield = (inputs.monthlyRent * 12 / inputs.purchasePrice) * 100;
    const netYield = (annualCashflow / totalCashInvested) * 100;

    // If the refinance loan repays all invested cash, cash left is shown as zero.
    const cashLeftInDeal = Math.max(totalCashInvested - refinanceLoan, 0);
    const roi = cashLeftInDeal > 0 ? (annualCashflow / cashLeftInDeal) * 100 : 0;

    const calculatedMetrics = {
      stampDuty,
      totalCashInvested,
      refinanceLoan,
      monthlyMortgagePayment,
      monthlyCashflow,
      annualCashflow,
      grossYield,
      netYield,
      cashLeftInDeal,
      roi,
    };

    return {
      ...calculatedMetrics,
      viabilityScore: getViabilityScore(calculatedMetrics),
    };
  }, [inputs]);

  const viabilityLabel =
    metrics.viabilityScore >= 75 ? 'Strong' : metrics.viabilityScore >= 45 ? 'Possible' : 'Needs work';

  return (
    <main className="app-shell">
      <section className="calculator-panel" aria-label="BRRR deal calculator">
        <div className="intro">
          <p className="eyebrow">UK property investor calculator</p>
          <h1>BRRR Deal Analyzer</h1>
          <p>
            Estimate cashflow, yield, refinance cash left in, and a simple BRRR viability score
            before you spend time on deeper due diligence.
          </p>
        </div>

        <form className="input-grid">
          {fields.map((field) => (
            <label className="input-card" key={field.name}>
              <span>{field.label}</span>
              <div className="input-wrap">
                {field.prefix && <small>{field.prefix}</small>}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={inputs[field.name]}
                  onChange={(event) => updateInput(field.name, event.target.value)}
                />
                {field.suffix && <small>{field.suffix}</small>}
              </div>
              <em>{field.helper}</em>
            </label>
          ))}
        </form>
      </section>

      <aside className="results-panel" aria-label="Deal results">
        <div className="score-card">
          <div>
            <span>BRRR viability score</span>
            <strong>{metrics.viabilityScore}/100</strong>
            <p>{viabilityLabel}</p>
          </div>
          <div
            className="score-ring"
            style={{ '--score': `${metrics.viabilityScore}%` }}
            aria-hidden="true"
          />
        </div>

        <div className="metric-list">
          <Result label="Monthly cashflow" value={formatMoney(metrics.monthlyCashflow)} highlight />
          <Result label="Annual cashflow" value={formatMoney(metrics.annualCashflow)} />
          <Result label="Gross yield" value={formatPercent(metrics.grossYield)} />
          <Result label="Net yield" value={formatPercent(metrics.netYield)} />
          <Result label="Stamp duty estimate" value={formatMoney(metrics.stampDuty)} />
          <Result label="Legal fees estimate" value={formatMoney(inputs.legalFees)} />
          <Result label="Refinance loan estimate" value={formatMoney(metrics.refinanceLoan)} />
          <Result label="Cash left after refinance" value={formatMoney(metrics.cashLeftInDeal)} highlight />
          <Result label="Estimated ROI" value={formatPercent(metrics.roi)} />
        </div>

        <p className="note">
          Stamp duty uses England and Northern Ireland residential rates with the additional-property
          surcharge. This is a rough planning tool, not financial or tax advice.
        </p>
      </aside>
    </main>
  );
}

function Result({ label, value, highlight = false }) {
  return (
    <div className={highlight ? 'metric highlight' : 'metric'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
