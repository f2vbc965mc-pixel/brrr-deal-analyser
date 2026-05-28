import React, { useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'brrr-saved-deals';

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
  return `£${Math.round(toNumber(value) / 1000)}k`;
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

function getDealRating(metrics) {
  const hasPositiveCashflow = metrics.monthlyCashflow > 0;

  if (hasPositiveCashflow && metrics.grossYield >= 8 && metrics.cashOnCashRoi >= 6) {
    return {
      tone: 'strong',
      label: 'Excellent',
      feedback: 'High-performing deal based on cashflow, yield, and investor return.',
    };
  }

  if (hasPositiveCashflow && metrics.grossYield >= 6 && metrics.cashOnCashRoi >= 4) {
    return {
      tone: 'strong',
      label: 'Strong',
      feedback: 'Solid fundamentals with positive cashflow and acceptable return on cash.',
    };
  }

  if (hasPositiveCashflow && (metrics.grossYield >= 4 || metrics.cashOnCashRoi >= 2)) {
    return {
      tone: 'borderline',
      label: 'Average',
      feedback: 'Viable on headline numbers, but review costs, valuation, and downside risk.',
    };
  }

  return {
    tone: 'risk',
    label: 'Weak',
    feedback: 'Weak cashflow or low return. This deal needs further scrutiny.',
  };
}

function migrateOldSavedMetrics(metrics = {}) {
  const cashOnCashRoi =
    metrics.cashOnCashRoi ?? (metrics.totalCashInvested > 0 ? (metrics.annualCashflow / metrics.totalCashInvested) * 100 : 0);

  const migratedMetrics = {
    ...metrics,
    cashOnCashRoi,
  };

  return {
    ...migratedMetrics,
    rating: metrics.rating || getDealRating(migratedMetrics),
  };
}

function loadSavedDeals() {
  try {
    const savedDeals = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(savedDeals)
      ? savedDeals.map((deal) => ({
          ...deal,
          inputs: normalizeInputs(deal.inputs),
          metrics: migrateOldSavedMetrics(deal.metrics),
        }))
      : [];
  } catch {
    return [];
  }
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Shell />}>
        <Route index element={<LandingPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="brrr" element={<BrrrAnalyzerPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav className="platform-nav">
        <Link className="nav-brand" to="/" onClick={() => setMenuOpen(false)}>
          <span>PropertyIQ</span>
          <small>Deal intelligence</small>
        </Link>

        <button
          className="menu-toggle"
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((isOpen) => !isOpen)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={menuOpen ? 'nav-links open' : 'nav-links'}>
          <NavLink to="/dashboard" onClick={() => setMenuOpen(false)}>
            Dashboard
          </NavLink>
          <NavLink to="/brrr" onClick={() => setMenuOpen(false)}>
            BRRR Analyzer
          </NavLink>
          <a href="/dashboard#modules" onClick={() => setMenuOpen(false)}>
            Future Modules
          </a>
          <Link className="nav-cta" to="/" onClick={() => setMenuOpen(false)}>
            Start Free
          </Link>
        </div>
      </nav>
      <Outlet />
    </>
  );
}

function LandingPage() {
  const authRef = useRef(null);
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);

  function startFree() {
    setShowAuth(true);
    window.setTimeout(() => authRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }

  return (
    <main className="page landing-page">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Premium property investment software</p>
          <h1>Analyse Property Deals Like a Professional Investor</h1>
          <p className="hero-subtitle">
            Compare BRRR, Buy-to-Let, Airbnb and Flip strategies in seconds with realistic investment analysis tools.
          </p>

          <div className="hero-actions">
            <button className="primary-btn" type="button" onClick={startFree}>
              Start Free
            </button>
            <Link className="secondary-link" to="/dashboard">
              View Demo
            </Link>
          </div>
        </div>

        <div className="hero-preview glass-card">
          <div className="preview-header">
            <span>BRRR analysis</span>
            <strong>Live model</strong>
          </div>
          <div className="preview-metric">
            <small>Monthly cashflow</small>
            <strong>£352</strong>
          </div>
          <div className="preview-grid">
            <span>
              <small>Gross yield</small>
              8.3%
            </span>
            <span>
              <small>Cash left</small>
              £30k
            </span>
          </div>
          <div className="preview-bar">
            <i />
          </div>
        </div>
      </section>

      <section className="feature-section">
        <SectionHeading
          label="Platform modules"
          title="Analyse the strategy, not just the property"
          copy="A focused suite of underwriting tools for investors who want clean numbers before committing time or capital."
        />

        <div className="feature-grid">
          <FeatureCard
            title="BRRR Deal Analysis"
            copy="Calculate cashflow, ROI and refinance position with investor-focused metrics and conservative real-world assumptions."
          />
          <FeatureCard
            title="Airbnb Comparison"
            copy="Compare short-term rental income vs long-term lets with occupancy modelling and strategy comparison tools."
            status="Coming Soon"
          />
          <FeatureCard
            title="Portfolio Tracking"
            copy="Save and compare deals, monitor your pipeline, and build a structured investment workflow."
            status="Coming Soon"
          />
        </div>
      </section>

      <section className="trust-section glass-card">
        <SectionHeading
          label="Built for serious property investors"
          title="Professional analysis without misleading marketing numbers"
          copy="Designed to help investors analyse deals with realistic assumptions, clear return metrics, and a disciplined underwriting workflow."
        />
      </section>

      <section ref={authRef} className={showAuth ? 'auth-section visible' : 'auth-section'}>
        <div className="auth-card glass-card">
          <p className="eyebrow">Free account</p>
          <h2>Create your free investor account</h2>
          <p>Use a lightweight frontend sign-up flow for now. Authentication can be connected when the platform is ready.</p>
          <label>
            Email
            <input type="email" placeholder="investor@example.com" />
          </label>
          <label>
            Password
            <input type="password" placeholder="Create a password" />
          </label>
          <button className="primary-btn" type="button" onClick={() => navigate('/dashboard')}>
            Continue
          </button>
        </div>
      </section>

      <section className="bottom-cta">
        <h2>Start Analysing Deals for Free</h2>
        <p>Open the dashboard and launch the BRRR analyzer module in seconds.</p>
        <Link className="primary-link" to="/dashboard">
          Open Dashboard
        </Link>
      </section>
    </main>
  );
}

function DashboardPage() {
  const modules = [
    {
      title: 'BRRR Analyzer',
      status: 'Active',
      copy: 'Model purchase, refurb, refinance position, cashflow, yield and cash-on-cash ROI.',
      action: 'Open Analyzer',
      to: '/brrr',
      active: true,
    },
    {
      title: 'Airbnb Analyzer',
      status: 'Coming Soon',
      copy: 'Compare short-term rental income, occupancy and operating assumptions.',
      action: 'Notify Me',
    },
    {
      title: 'Flip Analyzer',
      status: 'Coming Soon',
      copy: 'Estimate resale margin, works budget, holding costs and projected profit.',
      action: 'Notify Me',
    },
    {
      title: 'Portfolio Tracker',
      status: 'Coming Soon',
      copy: 'Track saved deals, pipeline stages and portfolio-level performance.',
      action: 'Notify Me',
    },
  ];

  return (
    <main className="page dashboard-page">
      <section className="page-hero compact">
        <p className="eyebrow">DealFlow workspace</p>
        <h1>Investment Dashboard</h1>
        <p>Choose a module to analyse your next opportunity.</p>
      </section>

      <section id="modules" className="module-grid">
        {modules.map((module) => (
          <article className={module.active ? 'module-card active' : 'module-card'} key={module.title}>
            <div>
              <span>{module.status}</span>
              <h2>{module.title}</h2>
              <p>{module.copy}</p>
            </div>
            {module.to ? (
              <Link className="module-action" to={module.to}>
                {module.action}
              </Link>
            ) : (
              <button className="module-action muted" type="button">
                {module.action}
              </button>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}

function BrrrAnalyzerPage() {
  const [inputs, setInputs] = useState(initialInputs);
  const [savedDeals, setSavedDeals] = useState(loadSavedDeals);
  const [activeDealId, setActiveDealId] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');

  function updateInput(name, value) {
    setInputs((currentInputs) => ({
      ...currentInputs,
      [name]: value,
    }));

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
    const stampDuty = calculateStampDuty(purchasePrice);

    const totalCashInvested = purchasePrice + refurbCost + stampDuty + legalFees;
    const refinanceLoan = refinanceValue * (loanToValue / 100);
    const monthlyMortgage = (refinanceLoan * (interestRate / 100)) / 12;
    const monthlyCashflow = monthlyRent - monthlyMortgage;
    const annualCashflow = monthlyCashflow * 12;
    const grossYield = purchasePrice > 0 ? ((monthlyRent * 12) / purchasePrice) * 100 : 0;
    const netYield = totalCashInvested > 0 ? (annualCashflow / totalCashInvested) * 100 : 0;
    const cashLeftInDeal = Math.max(totalCashInvested - refinanceLoan, 0);
    const cashOnCashRoi = totalCashInvested > 0 ? (annualCashflow / totalCashInvested) * 100 : 0;

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
      cashOnCashRoi,
    };

    return {
      ...calculatedMetrics,
      rating: getDealRating(calculatedMetrics),
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
    setInputs(normalizeInputs(deal.inputs));
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

  const groupedFields = fields.reduce((groups, field) => {
    groups[field.group] = groups[field.group] || [];
    groups[field.group].push(field);
    return groups;
  }, {});

  return (
    <main className="page analyzer-page">
      <section className="module-header">
        <div>
          <p className="eyebrow">Active module</p>
          <h1>BRRR Analyzer</h1>
          <p>Underwrite purchase, refurb, refinance position, cashflow, yield and cash-on-cash return.</p>
        </div>
        <div className="module-header-actions">
          {saveMessage && <span>{saveMessage}</span>}
          <button className="primary-btn" type="button" onClick={saveCurrentDeal}>
            Save Deal
          </button>
        </div>
      </section>

      <section className="summary-strip" aria-label="Deal summary">
        <SummaryCard label="Monthly Cashflow" value={formatMoney(metrics.monthlyCashflow)} copy="Estimated rent less interest-only finance." />
        <SummaryCard label="Cash-on-Cash ROI" value={formatPercent(metrics.cashOnCashRoi)} copy="Annual cashflow compared with total cash invested." />
        <SummaryCard label="Cash Left in Deal" value={formatMoney(metrics.cashLeftInDeal)} copy="Total cash invested less estimated refinance proceeds." />
      </section>

      <section className="analyzer-grid">
        <div className="panel input-panel">
          <PanelHeading label="Inputs" title="Deal Assumptions" meta={activeDealId ? 'Saved deal loaded' : 'Unsaved scenario'} />

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
        </div>

        <div className="panel results-panel">
          <PanelHeading label="Analysis" title="Underwriting Summary" meta={metrics.rating.label} />
          <div className={`rating-card ${metrics.rating.tone}`}>
            <span>Deal rating</span>
            <strong>{metrics.rating.label}</strong>
            <p>{metrics.rating.feedback}</p>
          </div>

          <div className="metric-list">
            <Result label="Monthly Cashflow" value={formatMoney(metrics.monthlyCashflow)} highlight />
            <Result label="Annual Cashflow" value={formatMoney(metrics.annualCashflow)} />
            <Result label="Gross Yield" value={formatPercent(metrics.grossYield)} note="Property performance based on purchase price and rent." />
            <Result label="Net Yield" value={formatPercent(metrics.netYield)} note="Cashflow return relative to total cash invested." />
            <Result label="Cash-on-Cash ROI" value={formatPercent(metrics.cashOnCashRoi)} note="Annual cashflow compared with total cash invested." highlight />
            <Result label="Total Cash Invested" value={formatMoney(metrics.totalCashInvested)} />
            <Result label="Cash Left in Deal" value={formatMoney(metrics.cashLeftInDeal)} />
            <Result label="Refinance Estimate" value={formatMoney(metrics.refinanceLoan)} />
          </div>
        </div>

        <div className="panel saved-panel">
          <PanelHeading label="Portfolio" title="Saved Deals" meta={`${savedDeals.length} saved`} />

          {savedDeals.length === 0 ? (
            <div className="empty-state">
              <strong>No saved deals yet</strong>
              <p>Save this analysis to keep a clear record of deals you want to review.</p>
            </div>
          ) : (
            <div className="saved-list">
              {savedDeals.map((deal) => {
                const savedMetrics = migrateOldSavedMetrics(deal.metrics);
                const rating = savedMetrics.rating;

                return (
                  <article className={deal.id === activeDealId ? 'saved-deal active' : 'saved-deal'} key={deal.id}>
                    <div className="saved-main">
                      <div>
                        <h3>{deal.name}</h3>
                        <p>{formatMoney(toNumber(deal.inputs.purchasePrice))} purchase price</p>
                      </div>
                      <div className={`saved-rating ${rating.tone}`}>{rating.label}</div>
                    </div>

                    <div className="saved-metrics">
                      <span>
                        <small>Cashflow</small>
                        {formatMoney(savedMetrics.monthlyCashflow)}
                      </span>
                      <span>
                        <small>Cash-on-Cash ROI</small>
                        {formatPercent(savedMetrics.cashOnCashRoi)}
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
        </div>
      </section>
    </main>
  );
}

function SectionHeading({ label, title, copy }) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{label}</p>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}

function FeatureCard({ title, copy, status }) {
  return (
    <article className="feature-card glass-card">
      {status && <span>{status}</span>}
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}

function SummaryCard({ label, value, copy }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{copy}</p>
    </div>
  );
}

function PanelHeading({ label, title, meta }) {
  return (
    <div className="panel-heading">
      <div>
        <span>{label}</span>
        <h2>{title}</h2>
      </div>
      <p>{meta}</p>
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

function NotFoundPage() {
  return (
    <main className="page not-found-page">
      <div className="glass-card">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist.</p>
        <Link className="primary-link" to="/dashboard">
          Back to Dashboard
        </Link>
      </div>
    </main>
  );
}

export default App;
