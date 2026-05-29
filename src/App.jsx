import React, { useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'brrr-saved-deals';

const initialInputs = {
  purchasePrice: '180000',
  refurbCost: '25000',
  legalFees: '2500',
  stampDutyEstimate: '',
  refinanceValue: '250000',
  monthlyRent: '1250',
  interestRate: '5.75',
  loanToValue: '75',
  monthlyRunningCosts: '125',
  voidAllowance: '5',
};

const brrrFields = [
  { name: 'purchasePrice', label: 'Purchase price', prefix: '£', helper: 'Acquisition price before refurbishment and fees.', group: 'Purchase', max: 10000000 },
  { name: 'refurbCost', label: 'Refurb cost', prefix: '£', helper: 'Estimated works required before refinance.', group: 'Purchase', max: 3000000 },
  { name: 'legalFees', label: 'Legal / buying costs', prefix: '£', helper: 'Solicitor, broker, valuation and transaction costs.', group: 'Purchase', max: 250000 },
  { name: 'stampDutyEstimate', label: 'Stamp duty estimate', prefix: '£', helper: 'Optional override. Leave empty to use the built-in estimate.', group: 'Purchase', max: 2000000 },
  { name: 'refinanceValue', label: 'Post-refurb value / ARV', prefix: '£', helper: 'Expected value after works, also known as GDV or ARV.', group: 'Refinance', max: 10000000 },
  { name: 'loanToValue', label: 'Loan-to-value', suffix: '%', helper: 'Expected refinance lending against the post-refurb value.', group: 'Refinance', max: 100 },
  { name: 'monthlyRent', label: 'Expected monthly rent', prefix: '£', helper: 'Gross rent before finance, voids and operating allowances.', group: 'Income', max: 100000 },
  { name: 'interestRate', label: 'Mortgage interest rate', suffix: '%', helper: 'Interest-only finance rate used for monthly mortgage estimate.', group: 'Income', max: 30 },
  { name: 'monthlyRunningCosts', label: 'Monthly running costs', prefix: '£', helper: 'Management, maintenance, insurance or other recurring allowances.', group: 'Income', max: 50000 },
  { name: 'voidAllowance', label: 'Void allowance', suffix: '%', helper: 'Optional rent loss allowance for vacancies or collection risk.', group: 'Income', max: 100 },
];

const initialAirbnbInputs = {
  propertyValue: '220000',
  longTermRent: '1200',
  nightlyRate: '110',
  occupancy: '65',
  cleaningFee: '45',
  staysPerMonth: '8',
  platformFee: '3',
  monthlyMortgage: '850',
  utilities: '280',
  cleaningCosts: '360',
  managementFee: '15',
  setupCost: '8000',
};

const airbnbFields = [
  { name: 'propertyValue', label: 'Property value / purchase price', prefix: '£', helper: 'Used for yield and return context.', group: 'Property', max: 10000000 },
  { name: 'longTermRent', label: 'Existing long-term monthly rent', prefix: '£', helper: 'Baseline rent for comparison against Airbnb.', group: 'Property', max: 100000 },
  { name: 'nightlyRate', label: 'Expected nightly rate', prefix: '£', helper: 'Average achieved nightly rate before platform costs.', group: 'Revenue', max: 5000 },
  { name: 'occupancy', label: 'Expected occupancy', suffix: '%', helper: 'Estimated average monthly occupancy.', group: 'Revenue', max: 100 },
  { name: 'cleaningFee', label: 'Cleaning fee per stay', prefix: '£', helper: 'Guest-paid cleaning revenue per booking.', group: 'Revenue', max: 1000 },
  { name: 'staysPerMonth', label: 'Average stays per month', helper: 'Estimated monthly bookings or guest stays.', group: 'Revenue', max: 60 },
  { name: 'platformFee', label: 'Platform fee', suffix: '%', helper: 'Airbnb/OTA fee as a percentage of gross revenue.', group: 'Costs', max: 40 },
  { name: 'monthlyMortgage', label: 'Monthly mortgage / finance', prefix: '£', helper: 'Monthly finance cost for the property.', group: 'Costs', max: 100000 },
  { name: 'utilities', label: 'Utilities / bills', prefix: '£', helper: 'Council tax, energy, broadband and recurring bills.', group: 'Costs', max: 50000 },
  { name: 'cleaningCosts', label: 'Cleaning costs', prefix: '£', helper: 'Actual cleaning cost paid to cleaners each month.', group: 'Costs', max: 50000 },
  { name: 'managementFee', label: 'Management fee', suffix: '%', helper: 'Management cost as a percentage of gross revenue.', group: 'Costs', max: 100 },
  { name: 'setupCost', label: 'Furnishing / setup cost', prefix: '£', helper: 'Initial setup budget for furniture and launch costs.', group: 'Setup', max: 500000 },
];

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeInputs(inputs, defaults = initialInputs) {
  return Object.fromEntries(
    Object.entries(defaults).map(([key]) => [key, inputs?.[key] === undefined ? '' : String(inputs[key])]),
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

function formatMonths(value) {
  if (!Number.isFinite(value) || value <= 0) return 'N/A';
  return `${value.toFixed(1)} months`;
}

function formatCompactPrice(value) {
  return `£${Math.round(toNumber(value) / 1000)}k`;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' }).format(date);
}

function createDealName(inputs) {
  return `Deal ${formatCompactPrice(inputs.purchasePrice)} - ${formatShortDate(new Date())}`;
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
  let previousThreshold = 0;
  let stampDuty = 0;

  for (const band of bands) {
    const taxableAmount = Math.min(remaining, band.threshold - previousThreshold);
    if (taxableAmount <= 0) break;
    stampDuty += taxableAmount * band.rate;
    remaining -= taxableAmount;
    previousThreshold = band.threshold;
  }

  return stampDuty;
}

function getDealRating(metrics) {
  const hasPositiveCashflow = metrics.monthlyCashflow > 0;

  if (hasPositiveCashflow && metrics.grossYield >= 8 && metrics.cashOnCashRoi >= 6) {
    return { tone: 'strong', label: 'Excellent', feedback: 'High-performing deal based on cashflow, yield and investor return.' };
  }

  if (hasPositiveCashflow && metrics.grossYield >= 6 && metrics.cashOnCashRoi >= 4) {
    return { tone: 'strong', label: 'Strong', feedback: 'Solid fundamentals with positive cashflow and acceptable return on cash.' };
  }

  if (hasPositiveCashflow && (metrics.grossYield >= 4 || metrics.cashOnCashRoi >= 2)) {
    return { tone: 'borderline', label: 'Average', feedback: 'Viable on headline numbers, but review costs, valuation and downside risk.' };
  }

  return { tone: 'risk', label: 'Weak', feedback: 'Weak cashflow or low return. This deal needs further scrutiny.' };
}

function getDealVerdict(metrics) {
  if (metrics.monthlyCashflow <= 0) {
    return 'This deal does not currently produce positive monthly cashflow after finance and operating assumptions.';
  }

  if (metrics.cashLeftInDeal > metrics.totalCashInvested * 0.45) {
    return 'This deal produces positive cashflow but leaves significant capital in the deal after refinance.';
  }

  if (metrics.cashOnCashRoi >= 6 && metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.3) {
    return 'This deal shows positive cashflow, a reasonable cash-on-cash return and a relatively efficient refinance position.';
  }

  return 'This deal produces positive cashflow, but the return and refinance position should be reviewed against your target criteria.';
}

function migrateOldSavedMetrics(metrics = {}) {
  const cashOnCashRoi =
    metrics.cashOnCashRoi ?? (metrics.totalCashInvested > 0 ? (metrics.annualCashflow / metrics.totalCashInvested) * 100 : 0);
  const migratedMetrics = { ...metrics, cashOnCashRoi };
  return { ...migratedMetrics, rating: metrics.rating || getDealRating(migratedMetrics) };
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

function getDashboardStats() {
  const savedDeals = loadSavedDeals();
  const bestRoi = savedDeals.reduce((best, deal) => Math.max(best, deal.metrics?.cashOnCashRoi || 0), 0);
  const bestCashflow = savedDeals.reduce((best, deal) => Math.max(best, deal.metrics?.monthlyCashflow || 0), 0);

  return {
    dealsAnalysed: savedDeals.length,
    savedScenarios: savedDeals.length,
    bestRoi,
    bestCashflow,
    recentDeals: savedDeals.slice(0, 3),
  };
}

function groupFields(fieldsToGroup) {
  return fieldsToGroup.reduce((groups, field) => {
    groups[field.group] = groups[field.group] || [];
    groups[field.group].push(field);
    return groups;
  }, {});
}

function applyBrrrScenario(values, scenario) {
  if (scenario === 'conservative') {
    return {
      ...values,
      monthlyRent: values.monthlyRent * 0.95,
      refinanceValue: values.refinanceValue * 0.95,
      interestRate: values.interestRate + 0.75,
      monthlyRunningCosts: values.monthlyRunningCosts * 1.15,
      voidAllowance: Math.min(values.voidAllowance + 3, 100),
    };
  }

  if (scenario === 'optimistic') {
    return {
      ...values,
      monthlyRent: values.monthlyRent * 1.05,
      refinanceValue: values.refinanceValue * 1.05,
      interestRate: Math.max(values.interestRate - 0.5, 0),
      monthlyRunningCosts: values.monthlyRunningCosts * 0.9,
      voidAllowance: Math.max(values.voidAllowance - 2, 0),
    };
  }

  return values;
}

function applyAirbnbScenario(values, scenario) {
  if (scenario === 'conservative') {
    return {
      ...values,
      nightlyRate: values.nightlyRate * 0.95,
      occupancy: Math.max(values.occupancy - 10, 0),
      utilities: values.utilities * 1.1,
      cleaningCosts: values.cleaningCosts * 1.1,
      managementFee: values.managementFee + 2,
    };
  }

  if (scenario === 'optimistic') {
    return {
      ...values,
      nightlyRate: values.nightlyRate * 1.05,
      occupancy: Math.min(values.occupancy + 10, 100),
      utilities: values.utilities * 0.95,
      cleaningCosts: values.cleaningCosts * 0.95,
      managementFee: Math.max(values.managementFee - 2, 0),
    };
  }

  return values;
}

function getBrrrHealth(metrics) {
  const strengths = [];
  const risks = [];
  const opportunities = [];

  if (metrics.monthlyCashflow > 0) strengths.push('Positive monthly cashflow after finance, running costs and void allowance.');
  else risks.push('Monthly cashflow is negative under the current assumptions.');

  if (metrics.grossYield >= 6) strengths.push('Gross yield is within or above a typical investable UK BTL range.');
  else risks.push('Gross yield is below many common UK BTL target ranges.');

  if (metrics.cashOnCashRoi >= 4) strengths.push('Cash-on-cash ROI is supported by annual cashflow rather than refinance uplift.');
  else risks.push('Cash-on-cash ROI is modest relative to total cash invested.');

  if (metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.3) strengths.push('Refinance appears to recycle a meaningful share of invested capital.');
  else risks.push('A significant amount of capital remains tied up after refinance.');

  if (metrics.breakEvenRent > metrics.effectiveMonthlyRent) opportunities.push('Improving rent, reducing costs or negotiating finance would strengthen cashflow resilience.');
  if (metrics.breakEvenRefinanceValue > metrics.refinanceValue) opportunities.push('A higher verified post-refurb valuation would improve capital recycling.');
  if (metrics.monthlyRunningCosts > 0) opportunities.push('Review management and maintenance assumptions regularly as the portfolio scales.');

  return { strengths, risks, opportunities };
}

function getBrrrBenchmarks(metrics) {
  const yieldText =
    metrics.grossYield >= 8
      ? 'Gross yield is above many common UK BTL benchmark ranges.'
      : metrics.grossYield >= 5
        ? 'Gross yield sits around a common UK BTL screening range.'
        : 'Gross yield is below many common UK BTL screening targets.';

  const cashflowText =
    metrics.monthlyCashflow >= 300
      ? 'Monthly cashflow appears relatively strong after assumptions.'
      : metrics.monthlyCashflow > 0
        ? 'Monthly cashflow is positive but may be sensitive to rates or voids.'
        : 'Monthly cashflow is negative and needs further review.';

  const refinanceText =
    metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.25
      ? 'Refinance efficiency looks strong based on the current ARV and LTV.'
      : metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.5
        ? 'Refinance efficiency is moderate; capital recycling may still be acceptable.'
        : 'Refinance efficiency is weak; a large amount of cash remains in the deal.';

  return [yieldText, cashflowText, refinanceText];
}

function getBrrrInsightCards(metrics, inputs) {
  const cards = [];

  if (toNumber(inputs.monthlyRent) > 0 && toNumber(inputs.interestRate) > 0) {
    cards.push({
      title: 'Cashflow insight',
      copy: metrics.monthlyCashflow > 0
        ? 'The deal produces surplus monthly income after finance and allowances.'
        : 'The deal currently depends on capital growth or refinance rather than monthly income.',
    });
  }

  if (toNumber(inputs.refinanceValue) > 0 && toNumber(inputs.loanToValue) > 0) {
    cards.push({
      title: 'Refinance insight',
      copy: metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.35
        ? 'The refinance estimate recycles a meaningful amount of invested cash.'
        : 'The refinance leaves a material amount of capital in the deal.',
    });
  }

  if (toNumber(inputs.voidAllowance) > 0 || toNumber(inputs.monthlyRunningCosts) > 0) {
    cards.push({
      title: 'Risk insight',
      copy: 'Void and running-cost allowances are included, making this a more conservative underwriting view.',
    });
  }

  if (cards.length < 3) {
    cards.push({
      title: 'Strategy insight',
      copy: 'Add rent, finance and refinance assumptions to unlock more decision support.',
    });
  }

  return cards;
}

function getAirbnbHealth(metrics) {
  const strengths = [];
  const risks = [];
  const opportunities = [];

  if (metrics.monthlyProfit > 0) strengths.push('Short-term rental assumptions produce positive monthly profit.');
  else risks.push('Short-term rental assumptions do not currently produce positive profit.');

  if (metrics.monthlyDifference > 0) strengths.push('Airbnb outperforms the long-term rental baseline on monthly profit.');
  else risks.push('Long-term rent appears safer or stronger under these assumptions.');

  if (metrics.paybackMonths > 0 && metrics.paybackMonths <= 18) strengths.push('Setup cost payback is within a relatively short operating period.');
  else opportunities.push('Review furnishing/setup costs and pricing to improve payback period.');

  if (metrics.breakEvenOccupancy > 75) risks.push('Break-even occupancy is high, increasing reliance on strong demand and operations.');
  else opportunities.push('Occupancy has some room before break-even, but seasonality should still be tested.');

  opportunities.push('Validate nightly rate and occupancy against comparable local listings before committing capital.');

  return { strengths, risks, opportunities };
}

function getAirbnbInsights(metrics) {
  return [
    {
      title: 'Strategy insight',
      copy: metrics.monthlyDifference >= 0
        ? 'Short-term rental may justify the extra operational complexity under these assumptions.'
        : 'The long-term rental baseline may offer a cleaner risk-adjusted outcome.',
    },
    {
      title: 'Occupancy insight',
      copy: `Break-even occupancy is approximately ${formatPercent(metrics.breakEvenOccupancy)}.`,
    },
    {
      title: 'Risk insight',
      copy: 'Airbnb returns are highly sensitive to regulation, seasonality, reviews and operator quality.',
    },
  ];
}

function getBrrrHealthSummary(metrics) {
  return [
    { label: 'Cashflow', status: metrics.monthlyCashflow >= 300 ? 'Strong' : metrics.monthlyCashflow > 0 ? 'Moderate' : 'Weak' },
    { label: 'Yield', status: metrics.grossYield >= 7 ? 'Strong' : metrics.grossYield >= 5 ? 'Moderate' : 'Weak' },
    { label: 'Refinance Position', status: metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.3 ? 'Strong' : metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.55 ? 'Moderate' : 'Weak' },
    { label: 'Risk Buffer', status: metrics.breakEvenRent <= metrics.effectiveMonthlyRent * 0.9 ? 'Strong' : metrics.breakEvenRent <= metrics.effectiveMonthlyRent ? 'Moderate' : 'Weak' },
  ];
}

function getAirbnbHealthSummary(metrics) {
  return [
    { label: 'Cashflow', status: metrics.monthlyProfit >= 500 ? 'Strong' : metrics.monthlyProfit > 0 ? 'Moderate' : 'Weak' },
    { label: 'Yield', status: metrics.airbnbYield >= 8 ? 'Strong' : metrics.airbnbYield >= 5 ? 'Moderate' : 'Weak' },
    { label: 'Refinance Position', status: 'Moderate' },
    { label: 'Risk Buffer', status: metrics.breakEvenOccupancy <= 55 ? 'Strong' : metrics.breakEvenOccupancy <= 70 ? 'Moderate' : 'Weak' },
  ];
}

function getSignatureVerdict(strategy, metrics, health) {
  const mainStrength = health.strengths[0] || 'The model has enough assumptions to support a structured first review.';
  const mainRisk = health.risks[0] || 'The key risk is still assumption quality: validate rent, costs, finance and market demand.';
  const bestUseCase =
    strategy === 'BRRR'
      ? metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.35
        ? 'Investors focused on recycling capital through a refinance-led BRRR strategy.'
        : 'Investors who are comfortable leaving more capital in the project for longer-term cashflow.'
      : metrics.monthlyDifference >= 0
        ? 'Investors comparing operational upside from short-term rental against a simpler long-term let.'
        : 'Investors prioritising stability and lower operational complexity over maximum revenue.';

  return {
    verdict:
      strategy === 'BRRR'
        ? `${metrics.rating?.label || 'Reviewed'} BRRR candidate based on current cashflow, yield and refinance assumptions.`
        : metrics.monthlyDifference >= 0
          ? 'Airbnb may outperform the BTL baseline under the current assumptions.'
          : 'BTL may be safer based on the current short-term rental assumptions.',
    mainStrength,
    mainRisk,
    bestUseCase,
  };
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Shell />}>
        <Route index element={<LandingPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="brrr" element={<BrrrAnalyzerPage />} />
        <Route path="airbnb" element={<AirbnbAnalyzerPage />} />
        <Route path="platform" element={<PlatformPage />} />
        <Route path="professional-tools" element={<ProfessionalToolsPage />} />
        <Route path="operating-system" element={<OperatingSystemPage />} />
        <Route path="portfolio" element={<PortfolioBlueprintPage />} />
        <Route path="roadmap" element={<RoadmapPage />} />
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
            BRRR
          </NavLink>
          <NavLink to="/airbnb" onClick={() => setMenuOpen(false)}>
            Airbnb
          </NavLink>
          <NavLink to="/platform" onClick={() => setMenuOpen(false)}>
            Platform
          </NavLink>
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
            <span>Investment model</span>
            <strong>Live underwriting</strong>
          </div>
          <div className="preview-metric">
            <small>Monthly cashflow</small>
            <strong>£352</strong>
          </div>
          <div className="preview-grid">
            <span>
              <small>Cash-on-cash ROI</small>
              4.8%
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
          label="Built for serious property investors"
          title="Realistic numbers, not marketing ROI"
          copy="Analyse deals in under 60 seconds using clear assumptions, practical cashflow metrics and investor-grade return calculations."
        />

        <div className="feature-grid">
          <FeatureCard
            title="BRRR Deal Analysis"
            copy="Analyse purchase, refurb, refinance and cashflow with cash-on-cash ROI and capital-left-in metrics."
          />
          <FeatureCard
            title="Airbnb Comparison"
            copy="Compare short-term rental profit against long-term rent with occupancy and operating cost assumptions."
            status="Early Access"
          />
          <FeatureCard
            title="Portfolio Tracking"
            copy="Save and compare deals as you build a disciplined investment pipeline."
            status="Pro Feature"
          />
        </div>
      </section>

      <section className="workflow-section">
        <SectionHeading
          label="Workflow"
          title="Compare strategies before committing capital"
          copy="A simple underwriting process designed to support better investment decisions."
        />
        <div className="workflow-grid">
          <WorkflowStep number="1" title="Enter deal details" copy="Capture purchase, rent, finance and cost assumptions." />
          <WorkflowStep number="2" title="Review investor metrics" copy="Focus on cashflow, yield, cash left in and cash-on-cash ROI." />
          <WorkflowStep number="3" title="Save, compare and decide" copy="Keep a record of opportunities and return to them later." />
        </div>
      </section>

      <section className="trust-section glass-card">
        <SectionHeading
          label="Trust by design"
          title="Conservative underwriting beats optimistic guesswork"
          copy="PropertyIQ is designed around clear assumptions and decision-ready metrics rather than inflated refinance-based ROI claims."
        />
      </section>

      <section ref={authRef} className={showAuth ? 'auth-section visible' : 'auth-section'}>
        <div className="auth-card glass-card">
          <p className="eyebrow">Free account</p>
          <h2>Create your free investor account</h2>
          <p>Frontend-only account flow for now. Authentication can be connected when the platform is ready.</p>
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
        <p>Open the dashboard and launch an active analysis module in seconds.</p>
        <Link className="primary-link" to="/dashboard">
          Open Dashboard
        </Link>
      </section>
    </main>
  );
}

function DashboardPage() {
  const stats = getDashboardStats();
  const modules = [
    {
      title: 'BRRR Analyzer',
      status: 'Active',
      copy: 'Analyse purchase, refurb, refinance and cashflow.',
      action: 'Open Analyzer',
      to: '/brrr',
      active: true,
    },
    {
      title: 'Airbnb Analyzer',
      status: 'Early Access',
      copy: 'Compare short-term rental profit against long-term rent.',
      action: 'Open Airbnb Analyzer',
      to: '/airbnb',
      active: true,
    },
    {
      title: 'Flip Analyzer',
      status: 'Pro Feature',
      copy: 'Estimate resale margin, holding costs and project profit.',
      action: 'Preview',
    },
    {
      title: 'Portfolio Tracker',
      status: 'Pro Feature',
      copy: 'Save, compare and monitor your deal pipeline.',
      action: 'Preview',
      to: '/portfolio',
    },
  ];

  return (
    <main className="page dashboard-page">
      <section className="page-hero compact">
        <p className="eyebrow">PropertyIQ workspace</p>
        <h1>Investment Dashboard</h1>
        <p>The Investor Operating System for analysing opportunities, saving scenarios and building a repeatable property workflow.</p>
      </section>

      <section className="progress-panel glass-card">
        <div>
          <p className="eyebrow">Investor progress</p>
          <h2>Your analysis workspace</h2>
          <p>Track the evidence you are building as you review opportunities. This uses saved scenarios in your browser for now.</p>
        </div>
        <div className="dashboard-summary">
          <SummaryCard label="Deals Analysed" value={String(stats.dealsAnalysed)} copy="Saved BRRR scenarios." />
          <SummaryCard label="Saved Deals" value={String(stats.savedScenarios)} copy="Local saved opportunities." />
          <SummaryCard label="Best ROI Found" value={stats.bestRoi > 0 ? formatPercent(stats.bestRoi) : 'No data'} copy="Best saved cash-on-cash ROI." />
          <SummaryCard label="Potential Monthly Cashflow Identified" value={stats.bestCashflow > 0 ? formatMoney(stats.bestCashflow) : 'No data'} copy="Highest saved cashflow." />
        </div>
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

      <section className="workspace-panel glass-card">
        <SectionHeading
          label="Workspace"
          title="Return to your investment workflow"
          copy="Recent analyses, saved deals, notes and watchlist items are grouped into one calm operating view."
        />
        <div className="workspace-grid">
          <DashboardPanel title="Recent Analyses" meta="Local browser">
            {stats.recentDeals.length > 0 ? (
              stats.recentDeals.map((deal) => (
                <p key={deal.id}>{deal.name} · {formatMoney(deal.metrics.monthlyCashflow)} monthly cashflow</p>
              ))
            ) : (
              <EmptyLine text="No recent saved analyses yet. Open a module and save your first scenario." />
            )}
          </DashboardPanel>
          <DashboardPanel title="Saved Deals" meta={`${stats.savedScenarios} saved`}>
            <EmptyLine text="Saved BRRR scenarios appear inside the analyzer today. Cross-module comparison is prepared for Pro." />
          </DashboardPanel>
          <DashboardPanel title="Watchlist" meta="Future">
            <EmptyLine text="Track target areas, vendors, agents and deals to revisit when pricing changes." />
          </DashboardPanel>
          <DashboardPanel title="Investor Notes" meta="Future">
            <EmptyLine text="Capture assumptions, viewing notes, broker feedback and due-diligence actions." />
          </DashboardPanel>
        </div>
      </section>

      <section className="upgrade-strip glass-card">
        <div>
          <p className="eyebrow">Platform</p>
          <h2>Free analysis today. Pro and Premium workflows next.</h2>
          <p>PropertyIQ is structured around a Free / Pro / Premium ecosystem without blocking the core analyzers.</p>
        </div>
        <div className="hero-actions">
          <Link className="primary-link" to="/platform">View Platform</Link>
          <Link className="secondary-link" to="/roadmap">Roadmap</Link>
        </div>
      </section>
    </main>
  );
}

function BrrrAnalyzerPage() {
  const [inputs, setInputs] = useState(initialInputs);
  const [scenario, setScenario] = useState('expected');
  const [savedDeals, setSavedDeals] = useState(loadSavedDeals);
  const [activeDealId, setActiveDealId] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');

  function updateInput(name, value) {
    setInputs((currentInputs) => ({ ...currentInputs, [name]: value }));
    setActiveDealId(null);
    setSaveMessage('');
  }

  const metrics = useMemo(() => {
    const baseValues = {
      purchasePrice: toNumber(inputs.purchasePrice),
      refurbCost: toNumber(inputs.refurbCost),
      monthlyRent: toNumber(inputs.monthlyRent),
      interestRate: toNumber(inputs.interestRate),
      loanToValue: toNumber(inputs.loanToValue),
      refinanceValue: toNumber(inputs.refinanceValue),
      legalFees: toNumber(inputs.legalFees),
      monthlyRunningCosts: toNumber(inputs.monthlyRunningCosts),
      voidAllowance: toNumber(inputs.voidAllowance),
    };
    const adjustedValues = applyBrrrScenario(baseValues, scenario);
    const { purchasePrice, refurbCost, monthlyRent, interestRate, loanToValue, refinanceValue, legalFees } = adjustedValues;
    const calculatedStampDuty = calculateStampDuty(purchasePrice);
    const stampDuty = inputs.stampDutyEstimate === '' ? calculatedStampDuty : toNumber(inputs.stampDutyEstimate);
    const monthlyRunningCosts = adjustedValues.monthlyRunningCosts;
    const voidAllowance = adjustedValues.voidAllowance;
    const voidLoss = monthlyRent * (voidAllowance / 100);
    const effectiveMonthlyRent = Math.max(monthlyRent - voidLoss, 0);

    const totalCashInvested = purchasePrice + refurbCost + stampDuty + legalFees;
    const refinanceLoan = refinanceValue * (loanToValue / 100);
    const monthlyMortgage = (refinanceLoan * (interestRate / 100)) / 12;
    const monthlyCashflow = effectiveMonthlyRent - monthlyRunningCosts - monthlyMortgage;
    const annualCashflow = monthlyCashflow * 12;
    const grossYield = purchasePrice > 0 ? ((monthlyRent * 12) / purchasePrice) * 100 : 0;
    const netYield = totalCashInvested > 0 ? (annualCashflow / totalCashInvested) * 100 : 0;
    const cashLeftInDeal = Math.max(totalCashInvested - refinanceLoan, 0);
    const cashOnCashRoi = totalCashInvested > 0 ? (annualCashflow / totalCashInvested) * 100 : 0;
    const breakEvenRent = (1 - voidAllowance / 100) > 0 ? (monthlyMortgage + monthlyRunningCosts) / (1 - voidAllowance / 100) : 0;
    const breakEvenRefinanceValue = loanToValue > 0 ? totalCashInvested / (loanToValue / 100) : 0;
    const breakEvenInterestRate = refinanceLoan > 0 ? ((effectiveMonthlyRent - monthlyRunningCosts) * 12 / refinanceLoan) * 100 : 0;
    const interestSensitivity = [-1, 0, 1, 2].map((shift) => {
      const rate = Math.max(interestRate + shift, 0);
      const mortgage = (refinanceLoan * (rate / 100)) / 12;
      return { label: `${formatPercent(rate)} interest`, value: formatMoney(effectiveMonthlyRent - monthlyRunningCosts - mortgage) };
    });
    const rentSensitivity = [0.9, 1, 1.1].map((multiplier) => {
      const rent = monthlyRent * multiplier;
      const adjustedEffectiveRent = Math.max(rent - rent * (voidAllowance / 100), 0);
      return { label: `${formatMoney(rent)} rent`, value: formatMoney(adjustedEffectiveRent - monthlyRunningCosts - monthlyMortgage) };
    });

    const calculatedMetrics = {
      scenario,
      stampDuty,
      calculatedStampDuty,
      totalCashInvested,
      refinanceLoan,
      monthlyMortgage,
      monthlyCashflow,
      annualCashflow,
      grossYield,
      netYield,
      cashLeftInDeal,
      cashOnCashRoi,
      monthlyRunningCosts,
      voidLoss,
      effectiveMonthlyRent,
      breakEvenRent,
      breakEvenRefinanceValue,
      breakEvenInterestRate,
      interestSensitivity,
      rentSensitivity,
    };

    return {
      ...calculatedMetrics,
      rating: getDealRating(calculatedMetrics),
      verdict: getDealVerdict(calculatedMetrics),
      healthSummary: getBrrrHealthSummary(calculatedMetrics),
    };
  }, [inputs, scenario]);

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
      scenario,
    };

    saveDeals([deal, ...savedDeals]);
    setActiveDealId(deal.id);
    setSaveMessage(`${deal.name} saved`);
  }

  function loadDeal(deal) {
    setInputs(normalizeInputs(deal.inputs));
    setScenario(deal.scenario || deal.metrics?.scenario || 'expected');
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

  const groupedFields = groupFields(brrrFields);
  const health = getBrrrHealth(metrics);
  const benchmarks = getBrrrBenchmarks(metrics);
  const insightCards = getBrrrInsightCards(metrics, inputs);
  const signatureVerdict = getSignatureVerdict('BRRR', metrics, health);

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
          <button className="secondary-btn" type="button">
            Export report · Pro
          </button>
          <button className="primary-btn" type="button" onClick={saveCurrentDeal}>
            Save Deal
          </button>
        </div>
      </section>

      <section className="summary-strip" aria-label="Deal summary">
        <SummaryCard label="Monthly Cashflow" value={formatMoney(metrics.monthlyCashflow)} copy="After mortgage, running costs and void allowance." />
        <SummaryCard label="Cash-on-Cash ROI" value={formatPercent(metrics.cashOnCashRoi)} copy="Annual cashflow compared with total cash invested." />
        <SummaryCard label="Cash Left in Deal" value={formatMoney(metrics.cashLeftInDeal)} copy="Total cash invested less estimated refinance proceeds." />
      </section>

      <section className="analyzer-grid">
        <div className="panel input-panel">
          <PanelHeading label="Inputs" title="Deal Assumptions" meta={activeDealId ? 'Saved deal loaded' : 'Unsaved scenario'} />
          <ScenarioToggle scenario={scenario} setScenario={setScenario} />
          <InputSections groupedFields={groupedFields} inputs={inputs} updateInput={updateInput} />
        </div>

        <div className="panel results-panel">
          <PanelHeading label="Analysis" title="Underwriting Summary" meta={metrics.rating.label} />
          <div className={`rating-card ${metrics.rating.tone}`}>
            <span>Deal summary</span>
            <strong>{metrics.rating.label}</strong>
            <p>{metrics.verdict}</p>
          </div>

          <div className="metric-list">
            <Result label="Total Cash Invested" value={formatMoney(metrics.totalCashInvested)} />
            <Result label="Refinance Loan Estimate" value={formatMoney(metrics.refinanceLoan)} />
            <Result label="Cash Left in Deal" value={formatMoney(metrics.cashLeftInDeal)} highlight />
            <Result label="Monthly Mortgage Payment" value={formatMoney(metrics.monthlyMortgage)} />
            <Result label="Monthly Cashflow" value={formatMoney(metrics.monthlyCashflow)} highlight />
            <Result label="Annual Cashflow" value={formatMoney(metrics.annualCashflow)} />
            <Result label="Gross Yield" value={formatPercent(metrics.grossYield)} note="Property performance based on gross rent and purchase price." />
            <Result label="Net Yield" value={formatPercent(metrics.netYield)} note="Annual cashflow relative to total cash invested." />
            <Result label="Cash-on-Cash ROI" value={formatPercent(metrics.cashOnCashRoi)} note="Annual cashflow compared with total cash invested." highlight />
            <Result label="Break-even Rent" value={formatMoney(metrics.breakEvenRent)} note="Rent required to cover mortgage, void allowance and running costs." />
            <Result label="Break-even Refinance Value" value={formatMoney(metrics.breakEvenRefinanceValue)} note="Estimated ARV needed to refinance all invested cash." />
            <Result label="Break-even Interest Rate" value={formatPercent(metrics.breakEvenInterestRate)} note="Approximate rate where monthly cashflow reaches zero." />
          </div>
        </div>

        <div className="side-stack">
          <AIVerdictPanel verdict={signatureVerdict} />
          <DecisionPanel health={health} healthSummary={metrics.healthSummary} verdict={metrics.verdict} benchmarks={benchmarks} insights={insightCards} />
          <div className="panel">
            <PanelHeading label="Sensitivity" title="Rate and Rent Stress Test" meta="Live" />
            <MiniTable title="Interest rate sensitivity" rows={metrics.interestSensitivity} />
            <MiniTable title="Rent sensitivity" rows={metrics.rentSensitivity} />
          </div>
          <div className="panel assumptions-panel">
            <PanelHeading label="Transparency" title="Assumptions" meta="Estimate" />
            <ul>
              <li>Rent, GDV/ARV, refurb cost and lending terms should be independently verified.</li>
              <li>Stamp duty is an estimate unless you enter your own figure.</li>
              <li>Running costs and void allowance are included to avoid marketing-style ROI claims.</li>
              <li>This is an underwriting aid, not financial, tax or mortgage advice.</li>
            </ul>
          </div>

          <div className="panel saved-panel">
            <PanelHeading label="Portfolio" title="Saved Deals" meta={`${savedDeals.length} saved`} />
            <SaveCompareFramework />
            <SavedDealsList
              savedDeals={savedDeals}
              activeDealId={activeDealId}
              loadDeal={loadDeal}
              deleteDeal={deleteDeal}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function AirbnbAnalyzerPage() {
  const [inputs, setInputs] = useState(initialAirbnbInputs);
  const [scenario, setScenario] = useState('expected');

  function updateInput(name, value) {
    setInputs((currentInputs) => ({ ...currentInputs, [name]: value }));
  }

  const metrics = useMemo(() => {
    const baseValues = {
      propertyValue: toNumber(inputs.propertyValue),
      longTermRent: toNumber(inputs.longTermRent),
      nightlyRate: toNumber(inputs.nightlyRate),
      occupancy: toNumber(inputs.occupancy),
      cleaningFee: toNumber(inputs.cleaningFee),
      staysPerMonth: toNumber(inputs.staysPerMonth),
      platformFee: toNumber(inputs.platformFee),
      monthlyMortgage: toNumber(inputs.monthlyMortgage),
      utilities: toNumber(inputs.utilities),
      cleaningCosts: toNumber(inputs.cleaningCosts),
      managementFee: toNumber(inputs.managementFee),
      setupCost: toNumber(inputs.setupCost),
    };
    const adjustedValues = applyAirbnbScenario(baseValues, scenario);
    const {
      propertyValue,
      longTermRent,
      nightlyRate,
      occupancy,
      cleaningFee,
      staysPerMonth,
      platformFee,
      monthlyMortgage,
      utilities,
      cleaningCosts,
      managementFee,
      setupCost,
    } = adjustedValues;

    const bookedNights = 30 * (occupancy / 100);
    const nightlyRevenue = nightlyRate * bookedNights;
    const cleaningRevenue = cleaningFee * staysPerMonth;
    const grossMonthlyRevenue = nightlyRevenue + cleaningRevenue;
    const platformCost = grossMonthlyRevenue * (platformFee / 100);
    const managementCost = grossMonthlyRevenue * (managementFee / 100);
    const operatingCosts = platformCost + managementCost + monthlyMortgage + utilities + cleaningCosts;
    const monthlyProfit = grossMonthlyRevenue - operatingCosts;
    const annualProfit = monthlyProfit * 12;
    const airbnbYield = propertyValue > 0 ? (annualProfit / propertyValue) * 100 : 0;
    const paybackMonths = monthlyProfit > 0 ? setupCost / monthlyProfit : 0;
    const btlProfit = longTermRent - monthlyMortgage;
    const monthlyDifference = monthlyProfit - btlProfit;
    const comparison =
      monthlyDifference >= 0
        ? `Airbnb may outperform BTL by ${formatMoney(monthlyDifference)}/month.`
        : `BTL may be safer based on these assumptions by ${formatMoney(Math.abs(monthlyDifference))}/month.`;
    const variableCostRate = (platformFee + managementFee) / 100;
    const fixedCosts = monthlyMortgage + utilities + cleaningCosts;
    const revenuePerOccupancyPoint = (nightlyRate * 30 + cleaningFee * staysPerMonth) / 100;
    const breakEvenOccupancy =
      revenuePerOccupancyPoint * (1 - variableCostRate) > 0 ? fixedCosts / (revenuePerOccupancyPoint * (1 - variableCostRate)) : 0;
    const breakEvenNightlyRate =
      bookedNights * (1 - variableCostRate) > 0
        ? ((fixedCosts / (1 - variableCostRate)) - cleaningRevenue) / bookedNights
        : 0;
    const breakEvenMonthlyRevenue = variableCostRate < 1 ? fixedCosts / (1 - variableCostRate) : 0;
    const occupancySensitivity = [40, 50, 60, 70, 80].map((level) => {
      const revenue = nightlyRate * 30 * (level / 100) + cleaningRevenue;
      const costs = revenue * variableCostRate + fixedCosts;
      return { label: `${level}% occupancy`, value: formatMoney(revenue - costs) };
    });

    return {
      scenario,
      grossMonthlyRevenue,
      operatingCosts,
      monthlyProfit,
      annualProfit,
      airbnbYield,
      paybackMonths,
      btlProfit,
      monthlyDifference,
      comparison,
      breakEvenOccupancy,
      breakEvenNightlyRate,
      breakEvenMonthlyRevenue,
      occupancySensitivity,
      healthSummary: getAirbnbHealthSummary({
        monthlyProfit,
        airbnbYield,
        breakEvenOccupancy,
      }),
    };
  }, [inputs, scenario]);

  const health = getAirbnbHealth(metrics);
  const insights = getAirbnbInsights(metrics);
  const signatureVerdict = getSignatureVerdict('Airbnb', metrics, health);

  return (
    <main className="page analyzer-page">
      <section className="module-header">
        <div>
          <p className="eyebrow">Early access module</p>
          <h1>Airbnb Analyzer</h1>
          <p>Compare short-term rental performance against a long-term rental baseline using clear occupancy assumptions.</p>
        </div>
      </section>

      <section className="summary-strip" aria-label="Airbnb summary">
        <SummaryCard label="Monthly Profit" value={formatMoney(metrics.monthlyProfit)} copy="After platform, management, bills, cleaning and finance costs." />
        <SummaryCard label="Airbnb Yield" value={formatPercent(metrics.airbnbYield)} copy="Annual profit compared with property value." />
        <SummaryCard label="BTL Comparison" value={formatMoney(metrics.monthlyDifference)} copy="Difference versus long-term rental profit." />
      </section>

      <section className="analyzer-grid two-column">
        <div className="panel input-panel">
          <PanelHeading label="Inputs" title="Serviced Accommodation Assumptions" meta="Early access" />
          <ScenarioToggle scenario={scenario} setScenario={setScenario} />
          <InputSections groupedFields={groupFields(airbnbFields)} inputs={inputs} updateInput={updateInput} />
        </div>

        <div className="panel results-panel">
          <PanelHeading label="Analysis" title="Airbnb vs BTL Summary" meta="Estimate" />
          <div className={metrics.monthlyDifference >= 0 ? 'rating-card strong' : 'rating-card borderline'}>
            <span>Strategy comparison</span>
            <strong>{metrics.monthlyDifference >= 0 ? 'Airbnb leads' : 'BTL may be safer'}</strong>
            <p>{metrics.comparison} Results depend heavily on occupancy, nightly rate and operating costs.</p>
          </div>

          <div className="metric-list">
            <Result label="Estimated Gross Monthly Airbnb Revenue" value={formatMoney(metrics.grossMonthlyRevenue)} highlight />
            <Result label="Estimated Operating Costs" value={formatMoney(metrics.operatingCosts)} />
            <Result label="Estimated Monthly Profit" value={formatMoney(metrics.monthlyProfit)} highlight />
            <Result label="Estimated Annual Profit" value={formatMoney(metrics.annualProfit)} />
            <Result label="Airbnb Yield" value={formatPercent(metrics.airbnbYield)} />
            <Result label="Payback Period on Setup Cost" value={formatMonths(metrics.paybackMonths)} />
            <Result label="Long-Term Rental Profit" value={formatMoney(metrics.btlProfit)} />
            <Result label="Difference in Monthly Profit" value={formatMoney(metrics.monthlyDifference)} />
            <Result label="Break-even Occupancy" value={formatPercent(metrics.breakEvenOccupancy)} />
            <Result label="Break-even Nightly Rate" value={formatMoney(metrics.breakEvenNightlyRate)} />
            <Result label="Break-even Monthly Revenue" value={formatMoney(metrics.breakEvenMonthlyRevenue)} />
          </div>

          <div className="assumption-note">
            <strong>Assumption note</strong>
            <p>Short-term rental returns are sensitive to occupancy, regulation, seasonality, cleaning costs and management quality. Treat this as an early comparison, not a forecast.</p>
          </div>
        </div>

        <div className="side-stack">
          <AIVerdictPanel verdict={signatureVerdict} />
          <DecisionPanel
            health={health}
            healthSummary={metrics.healthSummary}
            verdict={metrics.comparison}
            benchmarks={[
              'Short-term rental performance depends heavily on local demand, regulation and operational standards.',
              metrics.monthlyDifference >= 0
                ? 'The Airbnb scenario outperforms the BTL baseline on profit, before considering extra workload and volatility.'
                : 'The BTL baseline currently offers a stronger or safer monthly position.',
            ]}
            insights={insights}
          />
          <div className="panel">
            <PanelHeading label="Sensitivity" title="Occupancy Stress Test" meta="Profit" />
            <MiniTable title="Monthly profit by occupancy" rows={metrics.occupancySensitivity} />
          </div>
        </div>
      </section>
    </main>
  );
}

function ProfessionalToolsPage() {
  const tools = [
    { title: 'AI Investor Verdict', tier: 'Pro Preview', copy: 'Generate concise professional commentary from the deal metrics and assumptions.' },
    { title: 'Deal Health Check', tier: 'Included', copy: 'Strengths, risks and opportunities based on cashflow, yield and refinance position.' },
    { title: 'Sensitivity Analysis', tier: 'Included', copy: 'Stress-test the main assumptions before committing time or capital.' },
    { title: 'Scenario Testing', tier: 'Included', copy: 'Compare conservative, expected and optimistic views of a deal.' },
    { title: 'Unlimited Saved Deals', tier: 'Pro Preview', copy: 'Build a larger underwriting pipeline without local saved-deal limits.' },
    { title: 'PDF Investment Reports', tier: 'Pro Preview', copy: 'Export clean investor reports for lenders, partners or internal review.' },
    { title: 'Advanced Deal Comparison', tier: 'Pro Preview', copy: 'Compare Deal A and Deal B across cashflow, yield, ROI, risk and capital left in.' },
  ];

  return (
    <main className="page roadmap-page">
      <section className="page-hero compact">
        <p className="eyebrow">Free / Pro ecosystem</p>
        <h1>Professional Investor Tools</h1>
        <p>Visible upgrade pathways for serious investors without blocking the active free analysis tools.</p>
      </section>

      <section className="membership-grid">
        <MembershipTier title="Free" badge="Current" items={['BRRR Analyzer', 'Airbnb Early Access', 'Saved deals in browser']} />
        <MembershipTier title="Pro" badge="Preview" items={['Unlimited saved deals', 'PDF reports', 'Advanced deal comparison']} />
        <MembershipTier title="Premium" badge="Roadmap" items={['Operating system', 'Portfolio tracker', 'Investor CRM']} />
      </section>

      <section className="module-grid">
        {tools.map((tool) => (
          <RoadmapCard key={tool.title} title={tool.title} badge={tool.tier} copy={tool.copy} />
        ))}
      </section>

      <DealComparisonPreview />
    </main>
  );
}

function PlatformPage() {
  return (
    <main className="page platform-page">
      <section className="page-hero compact">
        <p className="eyebrow">PropertyIQ Platform</p>
        <h1>The Investor Operating System</h1>
        <p>A calm, professional workspace for analysing opportunities, comparing strategies, storing deal evidence and preparing for portfolio growth.</p>
      </section>

      <section className="platform-section glass-card">
        <div>
          <p className="eyebrow">Pro</p>
          <h2>Become a Faster Investor</h2>
          <p>Professional decision tools designed to help investors analyse opportunities with greater confidence.</p>
        </div>
        <div className="premium-preview-grid">
          <PremiumPreview title="AI Investor Verdicts" copy="Concise commentary that explains what the numbers mean." />
          <PremiumPreview title="Deal Health Checks" copy="Strengths, risks and opportunities from underwriting outputs." />
          <PremiumPreview title="Sensitivity Analysis" copy="Stress-test key assumptions before committing capital." />
          <PremiumPreview title="Strategy Comparison" copy="Compare BRRR, Airbnb and BTL in a single decision view." />
          <PremiumPreview title="Unlimited Saved Deals" copy="Build a larger pipeline of opportunities and scenarios." />
          <PremiumPreview title="PDF Investment Reports" copy="Prepare lender, partner and internal review packs." />
          <PremiumPreview title="Advanced Scenario Testing" copy="Model downside and upside cases with clean assumptions." />
        </div>
      </section>

      <section className="platform-section glass-card">
        <div>
          <p className="eyebrow">Premium</p>
          <h2>Build Your Investment Operating System</h2>
          <p>Manage opportunities, acquisitions and portfolio performance from a single workspace.</p>
        </div>
        <div className="premium-preview-grid">
          <PremiumPreview title="Portfolio Tracker" copy="Monitor assets, cashflow, equity and yield." />
          <PremiumPreview title="Deal Pipeline" copy="Track acquisition stages from sourced to completed." />
          <PremiumPreview title="Growth Forecasting" copy="Model portfolio expansion and reinvestment capacity." />
          <PremiumPreview title="Deal Vault" copy="Store deals, notes, reports, assumptions and scenarios." />
          <PremiumPreview title="Investor CRM" copy="Manage brokers, agents, sourcers, lenders and partners." />
          <PremiumPreview title="Marketplace Access" copy="Prepare for trusted services and partner tools." />
          <PremiumPreview title="Team Collaboration" copy="Future shared workspaces for teams and partners." />
        </div>
      </section>

      <RoadmapBlock />
      <StrategyComparisonPreview />
      <DealVaultPreview />
    </main>
  );
}

function RoadmapPage() {
  return (
    <main className="page roadmap-page">
      <section className="page-hero compact">
        <p className="eyebrow">Roadmap</p>
        <h1>From calculators to operating system</h1>
        <p>The platform roadmap is structured around the repeat investor workflow: analyse, compare, store, track and grow.</p>
      </section>
      <RoadmapBlock />
    </main>
  );
}

function OperatingSystemPage() {
  const features = [
    { title: 'Portfolio Tracker', copy: 'Monitor properties, cashflow and portfolio yield from one workspace.' },
    { title: 'Deal Pipeline', copy: 'Track leads from sourced to offered, financed, refurbished and refinanced.' },
    { title: 'Growth Forecasting', copy: 'Model acquisition velocity, equity growth and cashflow expansion.' },
    { title: 'Deal Vault', copy: 'Store reports, assumptions, viewing notes and due-diligence documents.' },
    { title: 'Investor CRM', copy: 'Manage agents, brokers, sourcers, partners and lender relationships.' },
    { title: 'Future Marketplace Access', copy: 'Prepare for curated services, reports and deal-support integrations.' },
  ];

  return (
    <main className="page roadmap-page">
      <section className="page-hero compact">
        <p className="eyebrow">Premium roadmap</p>
        <h1>Investor Operating System</h1>
        <p>A roadmap for turning PropertyIQ from analysis software into a full investment workflow platform.</p>
      </section>

      <section className="module-grid">
        {features.map((feature) => (
          <RoadmapCard key={feature.title} title={feature.title} badge="Premium" copy={feature.copy} />
        ))}
      </section>
    </main>
  );
}

function PortfolioBlueprintPage() {
  const sections = [
    { title: 'Properties', copy: 'No properties added yet. Future portfolio records will appear here.' },
    { title: 'Monthly Cashflow', copy: 'Aggregate portfolio income and costs will be summarised here.' },
    { title: 'Equity Estimate', copy: 'Track estimated equity based on valuations and outstanding debt.' },
    { title: 'Portfolio Yield', copy: 'Review income performance across the whole portfolio.' },
    { title: 'Acquisition Pipeline', copy: 'Monitor potential acquisitions from first review to completion.' },
  ];

  return (
    <main className="page roadmap-page">
      <section className="page-hero compact">
        <p className="eyebrow">Premium blueprint</p>
        <h1>Portfolio Tracker</h1>
        <p>A future workspace for monitoring live assets, acquisition pipeline and portfolio-level performance.</p>
      </section>

      <section className="module-grid">
        {sections.map((section) => (
          <RoadmapCard key={section.title} title={section.title} badge="Premium Placeholder" copy={section.copy} />
        ))}
      </section>
    </main>
  );
}

function InputSections({ groupedFields, inputs, updateInput }) {
  return Object.entries(groupedFields).map(([group, items]) => (
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
                max={field.max}
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
  ));
}

function ScenarioToggle({ scenario, setScenario }) {
  return (
    <div className="scenario-toggle" aria-label="Scenario selector">
      {['conservative', 'expected', 'optimistic'].map((option) => (
        <button
          className={scenario === option ? 'scenario-button active' : 'scenario-button'}
          type="button"
          key={option}
          onClick={() => setScenario(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function AIVerdictPanel({ verdict }) {
  return (
    <div className="panel ai-verdict-panel">
      <PanelHeading label="AI Investor Verdict" title="Decision Summary" meta="Preview" />
      <div className="verdict-box">
        <span>Verdict</span>
        <p>{verdict.verdict}</p>
      </div>
      <div className="verdict-grid">
        <div>
          <span>Main Strength</span>
          <p>{verdict.mainStrength}</p>
        </div>
        <div>
          <span>Main Risk</span>
          <p>{verdict.mainRisk}</p>
        </div>
        <div>
          <span>Best Use Case</span>
          <p>{verdict.bestUseCase}</p>
        </div>
      </div>
    </div>
  );
}

function DecisionPanel({ health, healthSummary = [], verdict, benchmarks, insights }) {
  return (
    <div className="panel decision-panel">
      <PanelHeading label="Decision support" title="Deal Health Check" meta="Live insights" />
      <div className="verdict-box">
        <span>Investor verdict</span>
        <p>{verdict}</p>
      </div>

      <div className="health-summary">
        {healthSummary.map((item) => (
          <div className={`health-pill ${item.status.toLowerCase()}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.status}</strong>
          </div>
        ))}
      </div>

      <HealthColumn title="Strengths" items={health.strengths} empty="No clear strengths yet. Add more assumptions or improve the numbers." />
      <HealthColumn title="Risks" items={health.risks} empty="No major risks flagged from the current inputs." />
      <HealthColumn title="Opportunities" items={health.opportunities} empty="No obvious opportunities flagged yet." />

      <div className="benchmark-list">
        <h3>Benchmark insights</h3>
        {benchmarks.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>

      <div className="insight-grid">
        {insights.map((insight) => (
          <article className="insight-card" key={insight.title}>
            <span>{insight.title}</span>
            <p>{insight.copy}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function HealthColumn({ title, items, empty }) {
  return (
    <div className="health-column">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </div>
  );
}

function MiniTable({ title, rows }) {
  return (
    <div className="mini-table">
      <h3>{title}</h3>
      {rows.map((row) => (
        <div className="mini-row" key={row.label}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

function SaveCompareFramework() {
  return (
    <div className="compare-framework">
      <span>Save & compare framework</span>
      <p>Saved scenarios and side-by-side deal comparison are prepared for future portfolio tracking.</p>
      <div>
        <small>Advanced scenario analysis · Pro</small>
        <small>Export report · Pro</small>
      </div>
    </div>
  );
}

function PremiumPreview({ title, copy }) {
  return (
    <article className="premium-preview-card">
      <span>Future upgrade</span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}

function RoadmapBlock() {
  return (
    <section className="roadmap-block glass-card">
      <SectionHeading
        label="Roadmap"
        title="Now, next and future"
        copy="A transparent path from active calculators to a full property investment operating system."
      />
      <div className="roadmap-columns">
        <RoadmapColumn title="Now" items={['BRRR Analyzer', 'Airbnb Analyzer', 'Saved deals', 'Scenario testing']} />
        <RoadmapColumn title="Next" items={['Strategy Comparison', 'AI Verdict', 'Deal Vault', 'PDF Reports']} />
        <RoadmapColumn title="Future" items={['Portfolio Tracker', 'Marketplace', 'CRM', 'Growth Forecasting']} />
      </div>
    </section>
  );
}

function RoadmapColumn({ title, items }) {
  return (
    <article>
      <h3>{title}</h3>
      {items.map((item) => <span key={item}>{item}</span>)}
    </article>
  );
}

function StrategyComparisonPreview() {
  return (
    <section className="comparison-preview glass-card">
      <SectionHeading
        label="Strategy comparison"
        title="Which strategy wins?"
        copy="A future-ready comparison engine for BRRR, Airbnb and BTL using the same investor-grade categories."
      />
      <div className="strategy-table">
        <div><strong>Strategy</strong><strong>Monthly Profit</strong><strong>Yield</strong><strong>ROI</strong><strong>Capital Left In</strong><strong>Risk Level</strong></div>
        <div><span>BRRR</span><span>From analyzer</span><span>Live</span><span>Live</span><span>Live</span><span>Moderate</span></div>
        <div><span>Airbnb</span><span>From analyzer</span><span>Live</span><span>Estimate</span><span>N/A</span><span>Higher ops</span></div>
        <div><span>BTL</span><span>Baseline</span><span>Estimate</span><span>Estimate</span><span>N/A</span><span>Lower ops</span></div>
      </div>
    </section>
  );
}

function DealVaultPreview() {
  return (
    <section className="deal-vault glass-card">
      <SectionHeading
        label="Deal Vault"
        title="Store the investment evidence"
        copy="The Deal Vault is prepared to hold saved deals, investor notes, scenarios and reports as the platform grows."
      />
      <div className="vault-grid">
        <EmptyVaultItem title="Saved Deals" copy="Analyzer saves already create the foundation for this vault." />
        <EmptyVaultItem title="Notes" copy="Future notes will capture assumptions, calls, viewings and diligence." />
        <EmptyVaultItem title="Scenarios" copy="Conservative, expected and optimistic cases will be stored together." />
        <EmptyVaultItem title="Reports" copy="PDF investment reports are planned as a Pro workflow." />
      </div>
    </section>
  );
}

function EmptyVaultItem({ title, copy }) {
  return (
    <article className="vault-item">
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}

function SavedDealsList({ savedDeals, activeDealId, loadDeal, deleteDeal }) {
  if (savedDeals.length === 0) {
    return (
      <div className="empty-state">
        <strong>No saved deals yet</strong>
        <p>Save this analysis to keep a clear record of deals you want to review.</p>
      </div>
    );
  }

  return (
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

function WorkflowStep({ number, title, copy }) {
  return (
    <article className="workflow-step glass-card">
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}

function MembershipTier({ title, badge, items }) {
  return (
    <article className="membership-card glass-card">
      <span>{badge}</span>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function DashboardPanel({ title, meta, children }) {
  return (
    <article className="dashboard-panel glass-card">
      <div className="preview-header">
        <h3>{title}</h3>
        <strong>{meta}</strong>
      </div>
      <div className="dashboard-panel-body">{children}</div>
    </article>
  );
}

function EmptyLine({ text }) {
  return <p className="empty-line">{text}</p>;
}

function RoadmapCard({ title, badge, copy }) {
  return (
    <article className="module-card roadmap-card">
      <div>
        <span>{badge}</span>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      <button className="module-action muted" type="button">
        Preview
      </button>
    </article>
  );
}

function DealComparisonPreview() {
  const rows = ['Cashflow', 'Yield', 'ROI', 'Risk', 'Capital Left In'];

  return (
    <section className="comparison-preview glass-card">
      <SectionHeading
        label="Pro comparison framework"
        title="Advanced Deal Comparison"
        copy="A prepared framework for comparing saved scenarios side by side when Pro comparison tools are enabled."
      />
      <div className="comparison-grid">
        <div>
          <h3>Deal A</h3>
          {rows.map((row) => <span key={row}>{row}</span>)}
        </div>
        <div>
          <h3>Deal B</h3>
          {rows.map((row) => <span key={row}>{row}</span>)}
        </div>
      </div>
    </section>
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
