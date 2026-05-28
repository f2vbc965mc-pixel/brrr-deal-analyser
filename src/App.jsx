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
    label: 'Purchase price',
    prefix: '£',
    helper: 'Price you expect to pay for the property.',
    group: 'Purchase',
  },
  {
    name: 'refurbCost',
    label: 'Refurbishment cost',
    prefix: '£',
    helper: 'Works needed before refinance or letting.',
    group: 'Purchase',
  },
  {
    name: 'legalFees',
    label: 'Purchase costs (legal etc.)',
    prefix: '£',
    helper: 'Solicitor, broker, valuation, and fees.',
    group: 'Purchase',
  },
  {
    name: 'monthlyRent',
    label: 'Monthly rent',
    prefix: '£',
    helper: 'Expected gross rental income.',
    group: 'Income',
  },
  {
    name: 'interestRate',
    label: 'Interest rate',
    suffix: '%',
    helper: 'Interest-only mortgage rate.',
    group: 'Finance',
  },
  {
    name: 'loanToValue',
    label: 'Loan-to-value',
    suffix: '%',
    helper: 'Percentage lender will lend on refinance value.',
    group: 'Finance',
  },
  {
    name: 'refinanceValue',
    label: 'Refinance value (ARV)',
    prefix: '£',
    helper: 'Expected value after refurb (After Repair Value).',
    group: 'Exit',
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
  const bands = [
    { threshold: 125000, rate: 0.05 },
    { threshold: 250000, rate: 0.07 },
    { threshold: 925000, rate: 0.1 },
    { threshold: 1500000, rate: 0.15 },
    { threshold: Infinity, rate: 0.17 },
  ];

  let remaining = Math.max(price, 0);
  let previous = 0;
  let duty = 0;

  for (const band of bands) {
    const taxable = Math.min(remaining, band.threshold - previous);
    if (taxable <= 0) break;

    duty += taxable * band.rate;
    remaining -= taxable;
    previous = band.threshold;
  }

  return duty;
}

function getViabilityScore(m) {
  let score = 0;

  if (m.monthlyCashflow > 0) score += 25;
  if (m.netYield >= 6) score += 25;
  else if (m.netYield >= 4) score += 15;

  if (m.cashLeftInDeal <= m.totalCashInvested * 0.25) score += 25;
  else if (m.cashLeftInDeal <= m.totalCashInvested * 0.5) score += 15;

  if (m.roi >= 20) score += 25;
  else if (m.roi >= 10) score += 15;

  return Math.min(score, 100);
}

function App() {
  const [inputs, setInputs] = useState(initialInputs);

  function updateInput(name, value) {
    setInputs((prev) => ({
      ...prev,
      [name]: Number(value),
    }));
  }

  function loadExampleDeal() {
    setInputs({
      purchasePrice: 180000,
      refurbCost: 25000,
      monthlyRent: 1450,
      interestRate: 5.5,
      loanToValue: 75,
      refinanceValue: 240000,
      legalFees: 2500,
    });
  }

  const metrics = useMemo(() => {
    const stampDuty = calculateStampDuty(inputs.purchasePrice);

    const totalCashInvested =
      inputs.purchasePrice +
      inputs.refurbCost +
      stampDuty +
      inputs.legalFees;

    const refinanceLoan =
      inputs.refinanceValue * (inputs.loanToValue / 100);

    const monthlyMortgage =
      (refinanceLoan * (inputs.interestRate / 100)) / 12;

    const monthlyCashflow = inputs.monthlyRent - monthlyMortgage;
    const annualCashflow = monthlyCashflow * 12;

    const grossYield =
      (inputs.monthlyRent * 12 / inputs.purchasePrice) * 100;

    const netYield =
      (annualCashflow / totalCashInvested) * 100;

    const cashLeftInDeal = Math.max(totalCashInvested - refinanceLoan, 0);

    const roi =
      cashLeftInDeal > 0 ? (annualCashflow / cashLeftInDeal) * 100 : 0;

    const m = {
      stampDuty,
      totalCashInvested,
      refinanceLoan,
      monthlyMortgage,
      monthlyCashflow,
      annualCashflow,
      grossYield,
      netYield,
      cashLeftInDeal,
      roi,
    };

    return {
      ...m,
      viabilityScore: getViabilityScore(m),
    };
  }, [inputs]);

  const viabilityLabel =
    metrics.viabilityScore >= 75
      ? 'Strong Deal'
      : metrics.viabilityScore >= 45
      ? 'Borderline Deal'
      : 'High Risk Deal';

  const groupedFields = fields.reduce((acc, f) => {
    acc[f.group] = acc[f.group] || [];
    acc[f.group].push(f);
    return acc;
  }, {});

  return (
    <div className="app-shell">

      <header className="top-bar">
        <h2>DealScope</h2>
        <div className="top-actions">
          <button onClick={loadExampleDeal} className="secondary-btn">
            Load Example
          </button>
          <button className="primary-btn">
            Save Deal
          </button>
        </div>
      </header>

      <main className="layout">

        {/* INPUT SIDE */}
        <section className="panel">
          <h3>Deal Inputs</h3>

          {Object.entries(groupedFields).map(([group, items]) => (
            <div key={group}>
              <h4 className="section-title">{group}</h4>

              {items.map((field) => (
                <label key={field.name} className="input-card">
                  <span>{field.label}</span>

                  <div className="input-wrap">
                    {field.prefix && <small>{field.prefix}</small>}
                    <input
                      type="number"
                      value={inputs[field.name]}
                      onChange={(e) =>
                        updateInput(field.name, e.target.value)
                      }
                    />
                    {field.suffix && <small>{field.suffix}</small>}
                  </div>

                  <em>{field.helper}</em>
                </label>
              ))}
            </div>
          ))}
        </section>

        {/* RESULTS SIDE */}
        <aside className="panel results">

          <div className="score-card">
            <div>
              <span>Deal Score</span>
              <strong>{metrics.viabilityScore}/100</strong>
              <p className={
                viabilityLabel.includes("Strong")
                  ? "good"
                  : viabilityLabel.includes("Borderline")
                  ? "warn"
                  : "bad"
              }>
                {viabilityLabel}
              </p>
            </div>

            <div
              className="score-ring"
              style={{ '--score': `${metrics.viabilityScore}%` }}
            />
          </div>

          <h3>Analysis</h3>

          <div className="metric-list">
            <Result label="Monthly cashflow" value={formatMoney(metrics.monthlyCashflow)} highlight />
            <Result label="Annual cashflow" value={formatMoney(metrics.annualCashflow)} />
            <Result label="Gross yield" value={formatPercent(metrics.grossYield)} />
            <Result label="Net yield" value={formatPercent(metrics.netYield)} />
            <Result label="Total cash in deal" value={formatMoney(metrics.totalCashInvested)} />
            <Result label="Refinance loan" value={formatMoney(metrics.refinanceLoan)} />
            <Result label="Cash left in deal" value={formatMoney(metrics.cashLeftInDeal)} highlight />
            <Result label="ROI" value={formatPercent(metrics.roi)} />
          </div>

          <p className="note">
            This is a planning tool for early-stage deal screening only.
          </p>

        </aside>

      </main>
    </div>
  );
}

function Result({ label, value, highlight }) {
  return (
    <div className={highlight ? 'metric highlight' : 'metric'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;