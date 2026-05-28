import React, { useMemo, useState } from 'react';

const STORAGE_KEY = 'brrr-saved-deals';

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
    helper: 'Acquisition price before refurbishment and fees.',
    group: 'Purchase',
  },
  {
    name: 'refurbCost',
    label: 'Refurbishment cost',
    prefix: '£',
    helper: 'Estimated capital works required before refinance.',
    group: 'Purchase',
  },
  {
    name: 'legalFees',
    label: 'Legal fees and buying costs',
    prefix: '£',
    helper: 'Solicitor, broker, valuation, and purchase fees.',
    group: 'Purchase',
  },
  {
    name: 'monthlyRent',
    label: 'Monthly rent',
    prefix: '£',
    helper: 'Expected gross rental income after completion.',
    group: 'Income',
  },
  {
    name: 'interestRate',
    label: 'Interest rate',
    suffix: '%',
    helper: 'Interest-only finance rate used for screening.',
    group: 'Finance',
  },
  {
    name: 'loanToValue',
    label: 'Loan-to-value',
    suffix: '%',
    helper: 'Expected refinance lending against the new value.',
    group: 'Finance',
  },
  {
    name: 'refinanceValue',
    label: 'Refinance value',
    prefix: '£',
    helper: 'Estimated value after refurbishment is complete.',
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

function formatCompactPrice(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `£${Math.round(safeValue / 1000)}k`;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function createDealName(inputs) {
  return `Deal ${formatCompactPrice(inputs.purchasePrice)} - ${formatShortDate(new Date())}`;
}

function calculateStampDuty(price) {
  // England and Northern Ireland residential SDLT bands from 1 April 2025.
  // This estimate includes the 5% additional-property surcharge on each band.
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
  // Simple v1 score: cashflow, yield, cash recycled, and ROI each contribute.
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

function getDealQuality(score) {
  if (score >= 75) {
    return {
      tone: 'strong',
      label: 'Strong Deal',
      feedback: 'Strong investment opportunity',
    };
  }

  if (score >= 45) {
    return {
      tone: 'borderline',
      label: 'Borderline Deal',
      feedback: 'Marginal deal - review carefully',
    };
  }

  return {
    tone: 'risk',
    label: 'High Risk Deal',
    feedback: 'High risk - likely unsuitable',
  };
}

function loadSavedDeals() {
  try {
    const savedDeals = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(savedDeals) ? savedDeals : [];
  } catch {
    return [];
  }
}

function App() {
  const [inputs, setInputs] = useState(initialInputs);
  const [savedDeals, setSavedDeals] = useState(loadSavedDeals);
  const [activeDealId, setActiveDealId] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');

  function updateInput(name, value) {
    setInputs((currentInputs) => ({
      ...currentInputs,
      [name]: Number(value),
    }));

    // Once a user edits a loaded deal, it becomes a new unsaved scenario.
    setActiveDealId(null);
    setSaveMessage('');
  }

  const metrics = useMemo(() => {
    const stampDuty = calculateStampDuty(inputs.purchasePrice);

    // Total money needed before refinance.
    const totalCashInvested =
      inputs.purchasePrice + inputs.refurbCost + stampDuty + inputs.legalFees;

    // BRRR refinance lending is usually based on the new value after works.
    const refinanceLoan = inputs.refinanceValue * (inputs.loanToValue / 100);

    // This v1 assumes an interest-only mortgage for rental deal screening.
    const monthlyMortgage = (refinanceLoan * (inputs.interestRate / 100)) / 12;
    const monthlyCashflow = inputs.monthlyRent - monthlyMortgage;
    const annualCashflow = monthlyCashflow * 12;

    const grossYield =
      inputs.purchasePrice > 0 ? ((inputs.monthlyRent * 12) / inputs.purchasePrice) * 100 : 0;

    const netYield =
      totalCashInvested > 0 ? (annualCashflow / totalCashInvested) * 100 : 0;

    // If the refinance covers all invested cash, cash left is shown as zero.
    const cashLeftInDeal = Math.max(totalCashInvested - refinanceLoan, 0);
    const roi = cashLeftInDeal > 0 ? (annualCashflow / cashLeftInDeal) * 100 : 0;

    const calculatedMetrics = {
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
      ...calculatedMetrics,
      viabilityScore: getViabilityScore(calculatedMetrics),
    };
  }, [inputs]);

  function saveDeals(nextDeals) {
    setSavedDeals(nextDeals);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDeals));
  }

  function saveCurrentDeal() {
    const deal = {
      id: crypto.randomUUID(),
      name: createDealName(inputs),
      createdAt: new Date().toISOString(),
      inputs: { ...inputs },
      metrics: { ...metrics },
    };

    saveDeals([deal, ...savedDeals]);
    setActiveDealId(deal.id);
    setSaveMessage(`${deal.name} saved`);
  }

  function loadDeal(deal) {
    setInputs(deal.inputs);
    setActiveDealId(deal.id);
    setSaveMessage(`${deal.name} loaded`);
  }

  function deleteDeal(dealId) {
    const nextDeals = savedDeals.filter((deal) => deal.id !== dealId);
    saveDeals(nextDeals);

    if (activeDealId === dealId) {
      setActiveDealId(null);
      setSaveMessage('');
    }
  }

  const dealQuality = getDealQuality(metrics.viabilityScore);

  const groupedFields = fields.reduce((groups, field) => {
    groups[field.group] = groups[field.group] || [];
    groups[field.group].push(field);
    return groups;
  }, {});

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <div className="brand-mark">B</div>
          <div>
            <p className="eyebrow">Investor underwriting workspace</p>
            <h1>BRRR Deal Analyzer</h1>
            <p className="tagline">Screen refinance potential, cashflow, and capital left in every deal.</p>
          </div>
        </div>

        <div className="top-actions">
          {saveMessage && <span className="save-message">{saveMessage}</span>}
          <button className="primary-btn" type="button" onClick={saveCurrentDeal}>
            Save Deal
          </button>
        </div>
      </header>

      <section className="summary-strip" aria-label="Deal summary">
        <div className="summary-card primary">
          <span>Monthly cashflow</span>
          <strong>{formatMoney(metrics.monthlyCashflow)}</strong>
          <p>After estimated interest-only finance</p>
        </div>

        <div className="summary-card primary">
          <span>Estimated ROI</span>
          <strong>{formatPercent(metrics.roi)}</strong>
          <p>Based on cash left after refinance</p>
        </div>

        <div className={`summary-card score ${dealQuality.tone}`}>
          <span>Deal score</span>
          <strong>{metrics.viabilityScore}/100</strong>
          <p>{dealQuality.feedback}</p>
        </div>
      </section>

      <main className="dashboard-grid">
        <section className="panel input-panel">
          <div className="panel-heading">
            <div>
              <span>Step 1</span>
              <h2>Deal Inputs</h2>
            </div>
            <p>{activeDealId ? 'Saved deal loaded' : 'Unsaved scenario'}</p>
          </div>

          {Object.entries(groupedFields).map(([group, items]) => (
            <div className="input-section" key={group}>
              <h3>{group}</h3>

              <div className="field-grid">
                {items.map((field) => (
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
              </div>
            </div>
          ))}
        </section>

        <section className="panel score-panel">
          <div className="panel-heading">
            <div>
              <span>Step 2</span>
              <h2>Investment Analysis</h2>
            </div>
            <p>{dealQuality.label}</p>
          </div>

          <div className={`score-card ${dealQuality.tone}`}>
            <div>
              <span>BRRR viability score</span>
              <strong>{metrics.viabilityScore}/100</strong>
              <p>{dealQuality.feedback}</p>
            </div>

            <div
              className="score-ring"
              style={{ '--score': `${metrics.viabilityScore}%` }}
              aria-hidden="true"
            />
          </div>

          <div className="metric-list">
            <Result label="Monthly cashflow" value={formatMoney(metrics.monthlyCashflow)} highlight />
            <Result label="Estimated ROI" value={formatPercent(metrics.roi)} highlight />
            <Result label="Annual cashflow" value={formatMoney(metrics.annualCashflow)} />
            <Result label="Gross yield" value={formatPercent(metrics.grossYield)} />
            <Result label="Net yield" value={formatPercent(metrics.netYield)} />
            <Result label="Total cash invested" value={formatMoney(metrics.totalCashInvested)} />
            <Result label="Stamp duty estimate" value={formatMoney(metrics.stampDuty)} />
            <Result label="Refinance loan" value={formatMoney(metrics.refinanceLoan)} />
            <Result label="Cash left in deal" value={formatMoney(metrics.cashLeftInDeal)} />
          </div>
        </section>

        <section className="panel saved-panel">
          <div className="panel-heading">
            <div>
              <span>Portfolio</span>
              <h2>Saved Deals</h2>
            </div>
            <p>{savedDeals.length} saved</p>
          </div>

          {savedDeals.length === 0 ? (
            <div className="empty-state">
              <strong>No saved deals yet</strong>
              <p>Save this analysis to start building a shortlist of opportunities.</p>
            </div>
          ) : (
            <div className="saved-list">
              {savedDeals.map((deal) => {
                const savedQuality = getDealQuality(deal.metrics.viabilityScore);

                return (
                  <article
                    className={deal.id === activeDealId ? 'saved-deal active' : 'saved-deal'}
                    key={deal.id}
                  >
                    <div className="saved-main">
                      <div>
                        <h3>{deal.name}</h3>
                        <p>{formatMoney(deal.inputs.purchasePrice)} purchase price</p>
                      </div>

                      <div className={`saved-score ${savedQuality.tone}`}>
                        {deal.metrics.viabilityScore}
                      </div>
                    </div>

                    <div className="saved-metrics">
                      <span>
                        <small>Cashflow</small>
                        {formatMoney(deal.metrics.monthlyCashflow)}
                      </span>
                      <span>
                        <small>ROI</small>
                        {formatPercent(deal.metrics.roi)}
                      </span>
                    </div>

                    <div className="saved-actions">
                      <button className="secondary-btn" type="button" onClick={() => loadDeal(deal)}>
                        Load
                      </button>
                      <button className="danger-btn" type="button" onClick={() => deleteDeal(deal.id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="footer-note">
        <span>BRRR Deal Analyzer</span>
        <p>
          For early-stage screening only. Calculations are estimates and do not constitute financial,
          tax, mortgage, or investment advice.
        </p>
      </footer>
    </div>
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
