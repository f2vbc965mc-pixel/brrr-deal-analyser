import React, { useMemo, useState } from 'react';

const STORAGE_KEY = 'brrr-saved-deals';
const CONSERVATIVE_VOID_RATE = 0.075;
const CONSERVATIVE_MAINTENANCE_RATE = 0.05;

const initialInputs = {
  purchasePrice: '180000',
  refurbCost: '25000',
  monthlyRent: '1250',
  interestRate: '5.75',
  loanToValue: '75',
  refinanceValue: '250000',
  legalFees: '2500',
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

function toNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeInputs(inputs) {
  return Object.fromEntries(
    Object.entries(initialInputs).map(([key]) => [key, inputs?.[key] === undefined ? '' : String(inputs[key])]),
  );
}

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
  const safeValue = toNumber(value);
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
  // Simple v1 score: cashflow, yield, cash recycled, and cash-on-cash ROI each contribute.
  let score = 0;

  if (metrics.monthlyCashflow > 0) score += 25;
  if (metrics.netYield >= 6) score += 25;
  else if (metrics.netYield >= 4) score += 15;

  if (metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.25) score += 25;
  else if (metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.5) score += 15;

  if (metrics.cashOnCashRoi >= 20) score += 25;
  else if (metrics.cashOnCashRoi >= 10) score += 15;

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
  const [analysisMode, setAnalysisMode] = useState('conservative');
  const [savedDeals, setSavedDeals] = useState(loadSavedDeals);
  const [activeDealId, setActiveDealId] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');

  function updateInput(name, value) {
    setInputs((currentInputs) => ({
      ...currentInputs,
      [name]: value,
    }));

    // Once a user edits a loaded deal, it becomes a new unsaved scenario.
    setActiveDealId(null);
    setSaveMessage('');
  }

  const metrics = useMemo(() => {
    const purchasePrice = toNumber(inputs.purchasePrice);
    const refurbCost = toNumber(inputs.refurbCost);
    const monthlyRent = toNumber(inputs.monthlyRent);
    const interestRate = toNumber(inputs.interestRate);
    const loanToValue = toNumber(inputs.loanToValue);
    const refinanceValue = toNumber(inputs.refinanceValue);
    const legalFees = toNumber(inputs.legalFees);
    const isConservative = analysisMode === 'conservative';

    const voidLoss = isConservative ? monthlyRent * CONSERVATIVE_VOID_RATE : 0;
    const maintenanceAllowance = isConservative ? monthlyRent * CONSERVATIVE_MAINTENANCE_RATE : 0;
    const effectiveMonthlyRent = Math.max(monthlyRent - voidLoss, 0);
    const operatingMonthlyIncome = Math.max(effectiveMonthlyRent - maintenanceAllowance, 0);
    const stampDuty = calculateStampDuty(purchasePrice);

    // Total money needed before refinance.
    const totalCashInvested = purchasePrice + refurbCost + stampDuty + legalFees;

    // BRRR refinance lending is usually based on the new value after works.
    const refinanceLoan = refinanceValue * (loanToValue / 100);

    // This v1 assumes an interest-only mortgage for rental deal screening.
    const monthlyMortgage = (refinanceLoan * (interestRate / 100)) / 12;
    const monthlyCashflow = operatingMonthlyIncome - monthlyMortgage;
    const annualCashflow = monthlyCashflow * 12;

    const grossYield =
      purchasePrice > 0 ? ((effectiveMonthlyRent * 12) / purchasePrice) * 100 : 0;

    const netYield =
      totalCashInvested > 0 ? (annualCashflow / totalCashInvested) * 100 : 0;

    // If the refinance covers all invested cash, cash left is shown as zero.
    const cashLeftInDeal = Math.max(totalCashInvested - refinanceLoan, 0);

    // Cash-on-cash ROI measures investor return against total cash used.
    // It deliberately avoids using cash left after refinance, which can be
    // close to zero and create distorted 400%+ ROI outputs.
    const cashOnCashRoi =
      totalCashInvested > 0 ? (annualCashflow / totalCashInvested) * 100 : 0;

    const calculatedMetrics = {
      analysisMode,
      voidLoss,
      maintenanceAllowance,
      effectiveMonthlyRent,
      operatingMonthlyIncome,
      stampDuty,
      totalCashInvested,
      refinanceLoan,
      monthlyMortgage,
      monthlyCashflow,
      annualCashflow,
      grossYield,
      netYield,
      cashLeftInDeal,
      cashOnCashRoi,
    };

    return {
      ...calculatedMetrics,
      viabilityScore: getViabilityScore(calculatedMetrics),
    };
  }, [inputs, analysisMode]);

  function saveDeals(nextDeals) {
    setSavedDeals(nextDeals);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDeals));
  }

  function saveCurrentDeal() {
    const deal = {
      id: crypto.randomUUID(),
      name: createDealName(inputs),
      createdAt: new Date().toISOString(),
      analysisMode,
      inputs: { ...inputs },
      metrics: { ...metrics },
    };

    saveDeals([deal, ...savedDeals]);
    setActiveDealId(deal.id);
    setSaveMessage(`${deal.name} saved`);
  }

  function loadDeal(deal) {
    setInputs(normalizeInputs(deal.inputs));
    setAnalysisMode(deal.analysisMode || deal.metrics?.analysisMode || 'conservative');
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
  const isConservative = analysisMode === 'conservative';

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
          <p>
            {isConservative
              ? 'Includes voids and maintenance allowance'
              : 'Assumes full occupancy and no maintenance deductions'}
          </p>
        </div>

        <div className="summary-card primary">
          <span>Cash-on-cash ROI</span>
          <strong>{formatPercent(metrics.cashOnCashRoi)}</strong>
          <p>Investor return on total cash used</p>
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

          <div className="view-toggle" aria-label="Analysis view">
            <button
              className={isConservative ? 'toggle-option active' : 'toggle-option'}
              type="button"
              onClick={() => setAnalysisMode('conservative')}
            >
              <span>Conservative View</span>
              <small>Conservative (realistic investor view)</small>
            </button>
            <button
              className={!isConservative ? 'toggle-option active' : 'toggle-option'}
              type="button"
              onClick={() => setAnalysisMode('optimistic')}
            >
              <span>Optimistic View</span>
              <small>Optimistic (best-case scenario)</small>
            </button>
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
            <Result
              label="Cash-on-cash ROI"
              value={formatPercent(metrics.cashOnCashRoi)}
              note="Investor return on total cash used"
              highlight
            />
            <Result label="Annual cashflow" value={formatMoney(metrics.annualCashflow)} />
            <Result
              label="Gross yield"
              value={formatPercent(metrics.grossYield)}
              note="Property performance before costs"
            />
            <Result
              label="Net yield"
              value={formatPercent(metrics.netYield)}
              note="Property performance after finance"
            />
            <Result label="Effective monthly rent" value={formatMoney(metrics.effectiveMonthlyRent)} />
            <Result label="Void allowance" value={formatMoney(metrics.voidLoss)} />
            <Result label="Maintenance allowance" value={formatMoney(metrics.maintenanceAllowance)} />
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
                        <p>
                          {formatMoney(toNumber(deal.inputs.purchasePrice))} purchase price ·{' '}
                          {(deal.analysisMode || deal.metrics.analysisMode || 'conservative') === 'conservative'
                            ? 'Conservative'
                            : 'Optimistic'}
                        </p>
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
                        <small>Cash-on-cash ROI</small>
                        {formatPercent(deal.metrics.cashOnCashRoi ?? deal.metrics.roi)}
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

function Result({ label, value, note, highlight = false }) {
  return (
    <div className={highlight ? 'metric highlight' : 'metric'}>
      <span>
        {label}
        {note && <em>{note}</em>}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
