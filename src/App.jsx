import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  getCurrentUserFromSession,
  getStoredSession,
  sendPasswordReset,
  signInWithEmail,
  signOutSession,
  signUpWithEmail,
  supabaseConfig,
} from './supabaseClient.js';

const STORAGE_KEY = 'brrr-saved-deals';
const VAULT_STORAGE_KEY = 'acquiraiq-deal-vault';
const ACCOUNT_STORAGE_KEY = 'acquiraiq-account';
const UPGRADE_STORAGE_KEY = 'acquiraiq-upgrade-intent';
const SYNC_STATUS_STORAGE_KEY = 'acquiraiq-sync-status';
const PIPELINE_STORAGE_KEY = 'acquiraiq-pipeline';
const PORTFOLIO_STORAGE_KEY = 'acquiraiq-portfolio';
const CONTACTS_STORAGE_KEY = 'acquiraiq-investor-contacts';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const CLOUD_SYNC_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const initialInputs = {
  purchasePrice: '180000',
  currentMarketValue: '200000',
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
  { name: 'currentMarketValue', label: 'Current market value', prefix: '£', helper: 'Optional market value today, used to estimate BMV discount.', group: 'Purchase', max: 10000000 },
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
  purchasePrice: '200000',
  currentMarketValue: '220000',
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
  { name: 'purchasePrice', label: 'Purchase price', prefix: '£', helper: 'Actual acquisition price or expected offer price.', group: 'Property', max: 10000000 },
  { name: 'currentMarketValue', label: 'Current market value', prefix: '£', helper: 'Estimated open market value used for equity and discount checks.', group: 'Property', max: 10000000 },
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

function normalizeAirbnbInputs(inputs = {}) {
  const mergedInputs = {
    ...inputs,
    purchasePrice: inputs.purchasePrice ?? inputs.propertyValue ?? initialAirbnbInputs.purchasePrice,
    currentMarketValue: inputs.currentMarketValue ?? inputs.propertyValue ?? initialAirbnbInputs.currentMarketValue,
    propertyValue: inputs.propertyValue ?? inputs.currentMarketValue ?? initialAirbnbInputs.propertyValue,
  };
  return normalizeInputs(mergedInputs, initialAirbnbInputs);
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

function createDefaultDealName(inputs, strategy = 'BRRR') {
  return `${strategy} ${formatCompactPrice(inputs.purchasePrice)} - ${formatShortDate(new Date())}`;
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
  const cashLeftRatio = metrics.totalCashInvested > 0 ? metrics.cashLeftInDeal / metrics.totalCashInvested : 1;
  const refinanceRecovery = metrics.totalCashInvested > 0 ? metrics.refinanceLoan / metrics.totalCashInvested : 0;
  const returnOnTotalCapitalInvested = metrics.returnOnTotalCapitalInvested ?? metrics.cashOnCashRoi ?? 0;
  let score = 0;

  score += metrics.monthlyCashflow >= 500 ? 24 : metrics.monthlyCashflow >= 250 ? 19 : metrics.monthlyCashflow > 0 ? 13 : 0;
  score += metrics.grossYield >= 8 ? 18 : metrics.grossYield >= 6.5 ? 14 : metrics.grossYield >= 5 ? 9 : 2;
  score += returnOnTotalCapitalInvested >= 8 ? 18 : returnOnTotalCapitalInvested >= 5 ? 13 : returnOnTotalCapitalInvested >= 2.5 ? 8 : 1;
  score += cashLeftRatio <= 0.15 ? 18 : cashLeftRatio <= 0.3 ? 14 : cashLeftRatio <= 0.5 ? 8 : 2;
  score += refinanceRecovery >= 0.9 ? 12 : refinanceRecovery >= 0.75 ? 9 : refinanceRecovery >= 0.6 ? 5 : 1;
  score += metrics.equityCreated > 0 ? 10 : 0;

  if (metrics.monthlyCashflow <= 0) score = Math.min(score, 42);
  if (cashLeftRatio > 0.7) score = Math.min(score, 55);
  if (metrics.grossYield < 4.5) score = Math.min(score, 58);

  if (score >= 82) {
    return { tone: 'excellent', label: 'Excellent', score, feedback: 'Exceptional BRRR characteristics: strong cashflow, return, equity creation and capital recycling.' };
  }
  if (score >= 68) {
    return { tone: 'good', label: 'Good', score, feedback: 'Solid investment opportunity if valuation, rent and finance assumptions are independently verified.' };
  }
  if (score >= 50) {
    return { tone: 'average', label: 'Average', score, feedback: 'Viable but requires careful review of the weaker assumptions before offer stage.' };
  }
  if (score >= 34) {
    return { tone: 'weak', label: 'Weak', score, feedback: 'Marginal returns based on cashflow, yield, capital recycling or equity creation.' };
  }
  return { tone: 'poor', label: 'Poor', score, feedback: 'Fails key investment criteria under the current assumptions.' };
}

function getDealVerdict(metrics) {
  if (metrics.monthlyCashflow <= 0) {
    return 'This deal does not currently produce positive monthly cashflow after finance and operating assumptions. It should not progress unless rent, price or finance terms improve.';
  }

  if (metrics.rating?.label === 'Excellent') {
    return 'This deal combines positive cashflow, strong yield and efficient capital recycling. It may justify deeper diligence if the ARV and lending assumptions are reliable.';
  }

  if (metrics.cashLeftInDeal > metrics.totalCashInvested * 0.45) {
    return 'This deal produces positive cashflow but leaves significant capital tied up after refinance. Review whether the retained capital meets your strategy.';
  }

  return 'This deal produces positive cashflow, but yield, return and refinance efficiency should be reviewed against your target criteria before offer stage.';
}

function migrateOldSavedMetrics(metrics = {}) {
  const returnOnTotalCapitalInvested =
    metrics.returnOnTotalCapitalInvested ?? metrics.cashOnCashRoi ?? (metrics.totalCashInvested > 0 ? (metrics.annualCashflow / metrics.totalCashInvested) * 100 : 0);
  const brrrCashOnCashReturn =
    metrics.brrrCashOnCashReturn ?? (metrics.cashLeftInDeal > 0 ? (metrics.annualCashflow / metrics.cashLeftInDeal) * 100 : null);
  const migratedMetrics = { ...metrics, cashOnCashRoi: returnOnTotalCapitalInvested, returnOnTotalCapitalInvested, brrrCashOnCashReturn };
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

function loadDealVault() {
  try {
    const vaultItems = JSON.parse(localStorage.getItem(VAULT_STORAGE_KEY));
    return Array.isArray(vaultItems) ? vaultItems : [];
  } catch {
    return [];
  }
}

function loadPipelineDeals() {
  try {
    const pipelineDeals = JSON.parse(localStorage.getItem(PIPELINE_STORAGE_KEY));
    return Array.isArray(pipelineDeals) ? pipelineDeals : [];
  } catch {
    return [];
  }
}

function savePipelineDeals(pipelineDeals) {
  localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(pipelineDeals));
}

function loadPortfolioProperties() {
  try {
    const properties = JSON.parse(localStorage.getItem(PORTFOLIO_STORAGE_KEY));
    return Array.isArray(properties) ? properties : [];
  } catch {
    return [];
  }
}

function savePortfolioProperties(properties) {
  localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(properties));
}

function loadInvestorContacts() {
  try {
    const contacts = JSON.parse(localStorage.getItem(CONTACTS_STORAGE_KEY));
    return Array.isArray(contacts) ? contacts : [];
  } catch {
    return [];
  }
}

function saveInvestorContacts(contacts) {
  localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
}

function addDealToPipeline(deal, stage = 'Lead') {
  const pipelineDeals = loadPipelineDeals();
  const title = deal.name || deal.title || 'Untitled opportunity';
  const existingIndex = pipelineDeals.findIndex((item) => item.sourceDealId === deal.id || item.title === title);
  const sourceInputs = deal.inputs || {};
  const pipelineDeal = {
    id: existingIndex >= 0 ? pipelineDeals[existingIndex].id : crypto.randomUUID(),
    sourceDealId: deal.id || deal.dealId || null,
    title,
    stage,
    strategy: deal.strategy || deal.type || 'BRRR',
    askingPrice: deal.askingPrice ?? toNumber(sourceInputs.purchasePrice || sourceInputs.propertyValue),
    source: deal.source || 'Saved analysis',
    notes: deal.notes || deal.copy || '',
    monthlyProfit: deal.metrics?.monthlyCashflow ?? deal.metrics?.monthlyProfit ?? null,
    yield: deal.metrics?.grossYield ?? deal.metrics?.airbnbYield ?? null,
    dateAdded: deal.dateAdded || deal.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const nextPipelineDeals = existingIndex >= 0
    ? pipelineDeals.map((item, index) => (index === existingIndex ? { ...item, ...pipelineDeal } : item))
    : [pipelineDeal, ...pipelineDeals];
  savePipelineDeals(nextPipelineDeals);
  return nextPipelineDeals;
}

function addDealToPortfolio(deal) {
  const properties = loadPortfolioProperties();
  const sourceInputs = deal.inputs || {};
  const property = {
    id: crypto.randomUUID(),
    sourceDealId: deal.id || deal.dealId || null,
    name: deal.name || deal.title || 'Portfolio property',
    purchasePrice: toNumber(sourceInputs.purchasePrice || sourceInputs.propertyValue),
    currentValue: toNumber(sourceInputs.refinanceValue || sourceInputs.currentMarketValue || sourceInputs.propertyValue || sourceInputs.purchasePrice),
    monthlyRent: toNumber(sourceInputs.monthlyRent || sourceInputs.longTermRent),
    mortgageBalance: deal.metrics?.refinanceLoan || 0,
    createdAt: new Date().toISOString(),
  };
  const nextProperties = [property, ...properties];
  savePortfolioProperties(nextProperties);
  return nextProperties;
}

function loadAccount() {
  try {
    const account = JSON.parse(localStorage.getItem(ACCOUNT_STORAGE_KEY));
    return account && typeof account === 'object' ? account : null;
  } catch {
    return null;
  }
}

function saveAccount(account) {
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account));
}

function loadUpgradeIntent() {
  try {
    const intent = JSON.parse(localStorage.getItem(UPGRADE_STORAGE_KEY));
    return intent && typeof intent === 'object' ? intent : null;
  } catch {
    return null;
  }
}

function saveUpgradeIntent(intent) {
  localStorage.setItem(UPGRADE_STORAGE_KEY, JSON.stringify(intent));
}

function loadSyncStatus() {
  try {
    const status = JSON.parse(localStorage.getItem(SYNC_STATUS_STORAGE_KEY));
    return status && typeof status === 'object' ? status : null;
  } catch {
    return null;
  }
}

function saveSyncStatus(status) {
  localStorage.setItem(SYNC_STATUS_STORAGE_KEY, JSON.stringify(status));
}

function getWorkspacePayload() {
  return {
    account: loadAccount(),
    savedDeals: loadSavedDeals(),
    vaultItems: loadDealVault(),
    pipelineDeals: loadPipelineDeals(),
    portfolioProperties: loadPortfolioProperties(),
    investorContacts: loadInvestorContacts(),
    upgradeIntent: loadUpgradeIntent(),
    exportedAt: new Date().toISOString(),
  };
}

async function syncWorkspaceToCloud() {
  if (!CLOUD_SYNC_ENABLED) {
    const status = {
      state: 'local-only',
      message: 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud sync.',
      updatedAt: new Date().toISOString(),
    };
    saveSyncStatus(status);
    return status;
  }

  const account = loadAccount();
  const userEmail = account?.email?.trim();
  if (!userEmail) {
    const status = {
      state: 'needs-account',
      message: 'Create a free account before syncing this workspace.',
      updatedAt: new Date().toISOString(),
    };
    saveSyncStatus(status);
    return status;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/workspaces?on_conflict=email`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        email: userEmail,
        payload: getWorkspacePayload(),
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) throw new Error('Cloud sync request failed');

    const status = {
      state: 'synced',
      message: 'Workspace synced to Supabase.',
      updatedAt: new Date().toISOString(),
    };
    saveSyncStatus(status);
    return status;
  } catch {
    const status = {
      state: 'error',
      message: 'Cloud sync could not complete. Local data is still safe in this browser.',
      updatedAt: new Date().toISOString(),
    };
    saveSyncStatus(status);
    return status;
  }
}

function getDashboardStats() {
  const savedDeals = loadSavedDeals();
  const vaultItems = loadDealVault();
  const pipelineDeals = loadPipelineDeals();
  const portfolioProperties = loadPortfolioProperties();
  const account = loadAccount();
  const upgradeIntent = loadUpgradeIntent();
  const vaultDealItems = vaultItems.filter((item) => item.type === 'Deal');
  const recentAnalyses = [
    ...savedDeals.map((deal) => ({
      id: deal.id,
      name: deal.name,
      metric: deal.metrics?.monthlyCashflow,
      metricLabel: 'monthly cashflow',
      createdAt: deal.createdAt,
    })),
    ...vaultDealItems
      .filter((item) => !item.dealId)
      .map((item) => ({
        id: item.id,
        name: item.title,
        metric: item.metrics?.monthlyProfit ?? item.metrics?.monthlyCashflow,
        metricLabel: item.metrics?.monthlyProfit === undefined ? 'monthly cashflow' : 'monthly profit',
        createdAt: item.createdAt,
      })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const bestRoi = savedDeals.reduce((best, deal) => Math.max(best, deal.metrics?.returnOnTotalCapitalInvested ?? deal.metrics?.cashOnCashRoi ?? 0), 0);
  const bestCashflow = savedDeals.reduce((best, deal) => Math.max(best, deal.metrics?.monthlyCashflow || 0), 0);
  const portfolioTotals = portfolioProperties.reduce(
    (summary, property) => ({
      value: summary.value + toNumber(property.currentValue),
      rent: summary.rent + toNumber(property.monthlyRent),
      equity: summary.equity + Math.max(toNumber(property.currentValue) - toNumber(property.mortgageBalance), 0),
    }),
    { value: 0, rent: 0, equity: 0 },
  );

  return {
    dealsAnalysed: Math.max(savedDeals.length, vaultDealItems.length),
    savedScenarios: savedDeals.length,
    vaultItems: vaultItems.length,
    pipelineDeals: pipelineDeals.length,
    portfolioProperties: portfolioProperties.length,
    portfolioTotals,
    bestRoi,
    bestCashflow,
    account,
    upgradeIntent,
    syncStatus: loadSyncStatus(),
    recentVaultItems: vaultItems.slice(0, 3),
    recentPipelineDeals: pipelineDeals.slice(0, 3),
    recentDeals: recentAnalyses.slice(0, 3),
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

  if (metrics.returnOnTotalCapitalInvested >= 4) strengths.push('Return on total capital invested is supported by annual cashflow rather than refinance uplift.');
  else risks.push('Return on total capital invested is modest relative to total cash invested.');

  if (metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.3) strengths.push('Refinance appears to recycle a meaningful share of invested capital.');
  else risks.push('A significant amount of capital remains tied up after refinance.');

  if (metrics.equityCreated > 0) strengths.push('The model shows equity created between total project cost and estimated post-refurb value.');
  else risks.push('The post-refurb value does not yet show a clear equity margin above project cost.');

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

  if (metrics.compareAgainstBtl) {
    if (metrics.monthlyDifference > 150) strengths.push('Serviced accommodation outperforms the long-term rental baseline on monthly profit.');
    else if (metrics.monthlyDifference < -150) risks.push('Long-term rent appears safer or stronger under these assumptions.');
    else opportunities.push('SA and BTL are close enough that regulation, workload and seasonality may decide the strategy.');
  }

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
      copy: !metrics.compareAgainstBtl
        ? 'BTL comparison is switched off, so review the Airbnb model as a standalone operating business.'
        : metrics.monthlyDifference >= 0
        ? 'Short-term rental may justify the extra operational complexity under these assumptions.'
        : 'The long-term rental baseline may offer a cleaner risk-adjusted outcome.',
    },
    {
      title: 'Occupancy insight',
      copy: `Break-even occupancy is approximately ${formatPercent(metrics.breakEvenOccupancy)}.`,
    },
    {
      title: 'Risk insight',
      copy: 'SA returns are highly sensitive to regulation, seasonality, reviews and operator quality.',
    },
  ];
}

function getAirbnbRecommendation(metrics) {
  if (!metrics.compareAgainstBtl) {
    return {
      label: 'Standalone SA Review',
      tone: 'borderline',
      confidence: metrics.breakEvenOccupancy <= 60 ? 'Medium' : 'Low',
      reasoning: 'BTL comparison is switched off. Review Airbnb profit, occupancy resilience and local regulation as a standalone operating model.',
    };
  }

  const difference = metrics.monthlyDifference;
  const costRatio = metrics.grossMonthlyRevenue > 0 ? metrics.operatingCosts / metrics.grossMonthlyRevenue : 1;
  const occupancyRisk = metrics.occupancy >= 75 || metrics.breakEvenOccupancy >= 70;
  const highCostRisk = costRatio >= 0.72;
  const confidence = occupancyRisk || highCostRisk ? 'Medium' : Math.abs(difference) >= 350 ? 'High' : 'Medium';
  const reasonParts = [];

  if (difference >= 0) reasonParts.push(`SA is ahead by ${formatMoney(difference)} per month before tax.`);
  else reasonParts.push(`BTL is ahead by ${formatMoney(Math.abs(difference))} per month before tax.`);
  if (occupancyRisk) reasonParts.push('The result is sensitive to occupancy, so local demand needs evidence.');
  if (highCostRisk) reasonParts.push('Operating costs absorb a high share of revenue.');
  if (!occupancyRisk && !highCostRisk) reasonParts.push('Occupancy and cost assumptions leave a clearer operating buffer.');

  let label = 'Roughly Equal';
  let tone = 'borderline';
  if (difference >= 500) {
    label = 'Strong SA Advantage';
    tone = 'strong';
  } else if (difference >= 150) {
    label = 'Moderate SA Advantage';
    tone = 'strong';
  } else if (difference <= -500) {
    label = 'Strong BTL Advantage';
    tone = 'risk';
  } else if (difference <= -150) {
    label = 'Moderate BTL Advantage';
    tone = 'borderline';
  }

  return { label, tone, confidence, reasoning: reasonParts.join(' ') };
}

function getBrrrHealthSummary(metrics) {
  return [
    {
      label: 'Cashflow',
      status: metrics.monthlyCashflow >= 300 ? 'Strong' : metrics.monthlyCashflow > 0 ? 'Moderate' : 'Weak',
      explanation: metrics.monthlyCashflow > 0 ? 'The deal remains cashflow-positive after finance and allowances.' : 'The deal currently relies on capital growth or improved terms.',
    },
    {
      label: 'Yield',
      status: metrics.grossYield >= 7 ? 'Strong' : metrics.grossYield >= 5 ? 'Moderate' : 'Weak',
      explanation: 'Gross yield is measured against annual rent and purchase price as a property performance screen.',
    },
    {
      label: 'Refinance Position',
      status: metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.3 ? 'Strong' : metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.55 ? 'Moderate' : 'Weak',
      explanation: 'Assesses how much investor cash remains tied up after the estimated refinance.',
    },
    {
      label: 'Risk Buffer',
      status: metrics.breakEvenRent <= metrics.effectiveMonthlyRent * 0.9 ? 'Strong' : metrics.breakEvenRent <= metrics.effectiveMonthlyRent ? 'Moderate' : 'Weak',
      explanation: 'Compares break-even rent against the rent used in the current scenario.',
    },
  ];
}

function getAirbnbHealthSummary(metrics) {
  return [
    {
      label: 'Cashflow',
      status: metrics.monthlyProfit >= 500 ? 'Strong' : metrics.monthlyProfit > 0 ? 'Moderate' : 'Weak',
      explanation: metrics.monthlyProfit > 0 ? 'The short-term rental model produces surplus monthly profit.' : 'The model does not cover costs under current inputs.',
    },
    {
      label: 'Yield',
      status: metrics.airbnbYield >= 8 ? 'Strong' : metrics.airbnbYield >= 5 ? 'Moderate' : 'Weak',
      explanation: 'Annual profit compared with the property value used in the model.',
    },
    {
      label: 'Refinance Position',
      status: 'Moderate',
      explanation: 'Refinance is not the main driver in this module, so capital recovery should be reviewed separately.',
    },
    {
      label: 'Risk Buffer',
      status: metrics.breakEvenOccupancy <= 55 ? 'Strong' : metrics.breakEvenOccupancy <= 70 ? 'Moderate' : 'Weak',
      explanation: 'Lower break-even occupancy gives more room for seasonality and booking volatility.',
    },
  ];
}

function getSignatureVerdict(strategy, metrics, health) {
  const airbnbRecommendation = strategy === 'Airbnb' ? getAirbnbRecommendation(metrics) : null;
  const mainStrength = health.strengths[0] || 'The model has enough assumptions to support a structured first review.';
  const mainRisk = health.risks[0] || 'The key risk is still assumption quality: validate rent, costs, finance and market demand.';
  const recommendations =
    strategy === 'BRRR'
      ? [
          metrics.cashLeftInDeal > metrics.totalCashInvested * 0.45 ? 'Negotiate purchase price, improve GDV confidence or review LTV before relying on capital recycling.' : 'Validate the refinance valuation with local comparables and broker feedback.',
          metrics.monthlyCashflow <= 0 ? 'Do not progress without improving rent, costs or finance terms.' : 'Stress-test rent and interest rate assumptions before offer stage.',
          metrics.equityCreated <= 0 ? 'Re-check the refurb budget and ARV because the model does not show equity created.' : 'Confirm that the equity created is supported by sold comparables, not asking prices.',
        ]
      : [
          metrics.breakEvenOccupancy > 70 ? 'Validate occupancy with comparable listings before treating this as an investable SA opportunity.' : 'Check local regulation, cleaning logistics and management cost before comparing against BTL.',
          metrics.monthlyDifference < 0 ? 'BTL may be a cleaner baseline unless nightly rate or occupancy can be improved.' : 'Review operational workload against the additional profit over BTL.',
        ];
  const bestStrategy =
    strategy === 'BRRR'
      ? metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.35
        ? 'BRRR, if the post-refurb valuation and lending terms are independently confirmed.'
        : 'BTL or a longer hold may be more appropriate unless the refinance position improves.'
      : !metrics.compareAgainstBtl
        ? 'Serviced accommodation standalone review, because BTL comparison is switched off.'
        : metrics.monthlyDifference >= 150
          ? 'Serviced accommodation, if local demand, regulation and management capacity are validated.'
          : metrics.monthlyDifference <= -150
            ? 'BTL, because the simpler rental baseline currently looks safer.'
            : 'No clear winner; compare operational workload, regulation and financing risk.';
  const investorSuitability =
    strategy === 'BRRR'
      ? metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.35 && metrics.monthlyCashflow > 0
        ? 'Best suited to investors comfortable with refurbishment, valuation risk and refinancing execution.'
        : 'Better suited to investors with patient capital or a lower requirement to recycle cash quickly.'
      : metrics.monthlyDifference >= 0
        ? 'Best suited to investors comfortable with higher operational involvement and occupancy volatility.'
        : 'Better suited to investors who prioritise stable income and simpler management.';

  return {
    overallVerdict:
      strategy === 'BRRR'
        ? `${metrics.rating?.label || 'Reviewed'} BRRR candidate based on current cashflow, yield and refinance assumptions.`
        : `${airbnbRecommendation.label}. ${airbnbRecommendation.reasoning}`,
    mainStrength,
    mainRisk,
    strengths: health.strengths.slice(0, 3),
    risks: health.risks.slice(0, 3),
    opportunities: health.opportunities.slice(0, 3),
    benchmarkInsights: strategy === 'BRRR'
      ? [
          metrics.grossYield >= 6 ? 'Yield is within a more investable screening range for many UK BTL investors.' : 'Yield is below many UK BTL screening ranges and needs a stronger reason to progress.',
          metrics.returnOnTotalCapitalInvested >= 4 ? 'Return on total capital invested is based on income rather than refinance uplift.' : 'Income return is modest relative to total cash deployed.',
        ]
      : [
          metrics.airbnbYield >= 8 ? 'SA yield appears strong, but only if occupancy is achievable.' : 'SA yield is not yet strong enough to ignore the BTL baseline.',
          metrics.breakEvenOccupancy <= 60 ? 'Break-even occupancy gives some operating buffer.' : 'The model depends on sustained occupancy and strong operations.',
        ],
    recommendations,
    bestStrategy,
    investorSuitability,
  };
}

function getStrategyRecommendation(rows) {
  const ranked = rows
    .filter((row) => Number.isFinite(row.score))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.strategy || 'Review assumptions';
}

function getBrrrStrategyComparison(metrics) {
  const btlProfit = metrics.effectiveMonthlyRent - metrics.monthlyRunningCosts - metrics.monthlyMortgage;
  const btlYield = metrics.totalCashInvested > 0 ? ((btlProfit * 12) / metrics.totalCashInvested) * 100 : 0;
  const rows = [
    {
      strategy: 'BRRR',
      monthlyProfit: metrics.monthlyCashflow,
      yield: metrics.grossYield,
      roi: metrics.returnOnTotalCapitalInvested,
      risk: metrics.cashLeftInDeal <= metrics.totalCashInvested * 0.35 ? 'Moderate' : 'Higher',
      capitalLeft: metrics.cashLeftInDeal,
      score: metrics.monthlyCashflow + metrics.returnOnTotalCapitalInvested * 45 - metrics.cashLeftInDeal / 1200,
    },
    {
      strategy: 'SA',
      monthlyProfit: null,
      yield: null,
      roi: null,
      risk: 'Needs SA model',
      capitalLeft: null,
      score: -Infinity,
    },
    {
      strategy: 'BTL',
      monthlyProfit: btlProfit,
      yield: btlYield,
      roi: btlYield,
      risk: 'Lower ops',
      capitalLeft: metrics.totalCashInvested,
      score: btlProfit + btlYield * 35 - metrics.totalCashInvested / 2000,
    },
  ];

  return { rows, recommendation: getStrategyRecommendation(rows) };
}

function getAirbnbStrategyComparison(metrics) {
  const rows = [
    {
      strategy: 'BRRR',
      monthlyProfit: null,
      yield: null,
      roi: null,
      risk: 'Needs ARV model',
      capitalLeft: null,
      score: -Infinity,
    },
    {
      strategy: 'SA',
      monthlyProfit: metrics.monthlyProfit,
      yield: metrics.airbnbYield,
      roi: metrics.airbnbYield,
      risk: metrics.breakEvenOccupancy <= 65 ? 'Moderate' : 'Higher',
      capitalLeft: null,
      score: metrics.monthlyProfit + metrics.airbnbYield * 35 - metrics.breakEvenOccupancy * 4,
    },
    {
      strategy: 'BTL',
      monthlyProfit: metrics.btlProfit,
      yield: null,
      roi: null,
      risk: 'Lower ops',
      capitalLeft: null,
      score: metrics.btlProfit + (metrics.monthlyDifference < 0 ? 250 : 0),
    },
  ];

  return { rows, recommendation: getStrategyRecommendation(rows) };
}

function downloadTextFile(filename, contents, type = 'text/plain') {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createBrrrReport(inputs, metrics, verdict, comparison) {
  return [
    'AcquiraIQ BRRR Investment Report',
    `Generated: ${new Date().toLocaleString('en-GB')}`,
    '',
    'Inputs',
    `Purchase price: ${formatMoney(toNumber(inputs.purchasePrice))}`,
    `Current market value: ${formatMoney(toNumber(inputs.currentMarketValue))}`,
    `Refurb cost: ${formatMoney(toNumber(inputs.refurbCost))}`,
    `Post-refurb value / ARV: ${formatMoney(toNumber(inputs.refinanceValue))}`,
    `Expected monthly rent: ${formatMoney(toNumber(inputs.monthlyRent))}`,
    `Mortgage interest rate: ${formatPercent(toNumber(inputs.interestRate))}`,
    `Loan-to-value: ${formatPercent(toNumber(inputs.loanToValue))}`,
    '',
    'Core Metrics',
    `Total cash invested: ${formatMoney(metrics.totalCashInvested)}`,
    `Refinance loan estimate: ${formatMoney(metrics.refinanceLoan)}`,
    `Cash left in deal: ${formatMoney(metrics.cashLeftInDeal)}`,
    `Monthly mortgage payment: ${formatMoney(metrics.monthlyMortgage)}`,
    `Monthly cashflow: ${formatMoney(metrics.monthlyCashflow)}`,
    `Annual cashflow: ${formatMoney(metrics.annualCashflow)}`,
    `Gross yield: ${formatPercent(metrics.grossYield)}`,
    `Net yield: ${formatPercent(metrics.netYield)}`,
    `Return on total capital invested: ${formatPercent(metrics.returnOnTotalCapitalInvested)}`,
    `BRRR cash-on-cash return: ${metrics.brrrCashOnCashReturn === null ? 'Capital Fully Recycled' : formatPercent(metrics.brrrCashOnCashReturn)}`,
    `Equity created: ${formatMoney(metrics.equityCreated)}`,
    `Discount to market value: ${formatPercent(metrics.discountToMarketValue)}`,
    '',
    'Investor Verdict',
    `Overall verdict: ${verdict.overallVerdict}`,
    `Main strength: ${verdict.mainStrength}`,
    `Main risk: ${verdict.mainRisk}`,
    `Best strategy: ${verdict.bestStrategy}`,
    `Investor suitability: ${verdict.investorSuitability}`,
    '',
    'Strategy Comparison',
    `Recommended strategy: ${comparison.recommendation}`,
    ...comparison.rows.map((row) => `${row.strategy}: monthly profit ${row.monthlyProfit === null ? 'N/A' : formatMoney(row.monthlyProfit)}, yield ${row.yield === null ? 'N/A' : formatPercent(row.yield)}, return ${row.roi === null ? 'N/A' : formatPercent(row.roi)}, risk ${row.risk}, capital left ${row.capitalLeft === null ? 'N/A' : formatMoney(row.capitalLeft)}`),
    '',
    'Important',
    'This report is an underwriting aid, not financial, tax or mortgage advice. Verify rent, GDV/ARV, refurb costs and finance terms independently.',
  ].join('\n');
}

function createBrrrReportHtml(inputs, metrics, verdict, comparison, dealName) {
  const rows = [
    ['Purchase price', formatMoney(toNumber(inputs.purchasePrice))],
    ['Current market value', formatMoney(toNumber(inputs.currentMarketValue))],
    ['Refurb cost', formatMoney(toNumber(inputs.refurbCost))],
    ['Post-refurb value / ARV', formatMoney(toNumber(inputs.refinanceValue))],
    ['Expected monthly rent', formatMoney(toNumber(inputs.monthlyRent))],
    ['Total cash invested', formatMoney(metrics.totalCashInvested)],
    ['Refinance loan estimate', formatMoney(metrics.refinanceLoan)],
    ['Cash left in deal', formatMoney(metrics.cashLeftInDeal)],
    ['Monthly cashflow', formatMoney(metrics.monthlyCashflow)],
    ['Annual cashflow', formatMoney(metrics.annualCashflow)],
    ['Gross yield', formatPercent(metrics.grossYield)],
    ['Return on total capital invested', formatPercent(metrics.returnOnTotalCapitalInvested)],
    ['BRRR cash-on-cash return', metrics.brrrCashOnCashReturn === null ? 'Capital Fully Recycled' : formatPercent(metrics.brrrCashOnCashReturn)],
    ['Equity created', formatMoney(metrics.equityCreated)],
    ['Discount to market value', formatPercent(metrics.discountToMarketValue)],
  ];

  return `<!doctype html>
<html>
  <head>
    <title>${dealName} - AcquiraIQ Report</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; color: #17201d; margin: 40px; line-height: 1.5; }
      h1 { font-size: 34px; margin: 0 0 8px; }
      h2 { margin-top: 28px; border-bottom: 1px solid #d9ded8; padding-bottom: 8px; }
      .muted { color: #65706a; }
      .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .metric { border: 1px solid #d9ded8; border-radius: 8px; padding: 12px; }
      .metric span { display: block; color: #65706a; font-size: 12px; text-transform: uppercase; font-weight: 700; }
      .metric strong { display: block; font-size: 18px; margin-top: 4px; }
      li { margin-bottom: 6px; }
      @media print { body { margin: 22mm; } button { display: none; } }
    </style>
  </head>
  <body>
    <button onclick="window.print()">Print / Save PDF</button>
    <p class="muted">AcquiraIQ investment report · ${new Date().toLocaleString('en-GB')}</p>
    <h1>${dealName}</h1>
    <p class="muted">Underwriting aid only. Not financial, mortgage, tax or legal advice.</p>
    <h2>Key Metrics</h2>
    <div class="grid">${rows.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>
    <h2>Investor Verdict</h2>
    <p><strong>Overall verdict:</strong> ${verdict.overallVerdict}</p>
    <p><strong>Main strength:</strong> ${verdict.mainStrength}</p>
    <p><strong>Main risk:</strong> ${verdict.mainRisk}</p>
    <p><strong>Best strategy:</strong> ${verdict.bestStrategy}</p>
    <p><strong>Investor suitability:</strong> ${verdict.investorSuitability}</p>
    <h2>Recommendations</h2>
    <ul>${(verdict.recommendations || []).map((item) => `<li>${item}</li>`).join('')}</ul>
    <h2>Strategy Comparison</h2>
    <p><strong>Recommended strategy:</strong> ${comparison.recommendation}</p>
    <ul>${comparison.rows.map((row) => `<li>${row.strategy}: monthly profit ${row.monthlyProfit === null ? 'N/A' : formatMoney(row.monthlyProfit)}, yield ${row.yield === null ? 'N/A' : formatPercent(row.yield)}, return ${row.roi === null ? 'N/A' : formatPercent(row.roi)}, risk ${row.risk}, capital left ${row.capitalLeft === null ? 'N/A' : formatMoney(row.capitalLeft)}</li>`).join('')}</ul>
  </body>
</html>`;
}

function getBrrrScenarioComparisonRows(inputs) {
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

  return ['conservative', 'expected', 'optimistic'].map((scenarioName) => {
    const values = applyBrrrScenario(baseValues, scenarioName);
    const stampDuty = inputs.stampDutyEstimate === '' ? calculateStampDuty(values.purchasePrice) : toNumber(inputs.stampDutyEstimate);
    const totalCashInvested = values.purchasePrice + values.refurbCost + stampDuty + values.legalFees;
    const refinanceLoan = values.refinanceValue * (values.loanToValue / 100);
    const monthlyMortgage = (refinanceLoan * (values.interestRate / 100)) / 12;
    const effectiveMonthlyRent = Math.max(values.monthlyRent - values.monthlyRent * (values.voidAllowance / 100), 0);
    const monthlyCashflow = effectiveMonthlyRent - values.monthlyRunningCosts - monthlyMortgage;
    const annualCashflow = monthlyCashflow * 12;
    const cashLeftInDeal = Math.max(totalCashInvested - refinanceLoan, 0);
    const returnOnTotalCapitalInvested = totalCashInvested > 0 ? (annualCashflow / totalCashInvested) * 100 : 0;

    return {
      label: `${scenarioName[0].toUpperCase()}${scenarioName.slice(1)} case`,
      value: `${formatMoney(monthlyCashflow)} cashflow · ${formatMoney(cashLeftInDeal)} left · ${formatPercent(returnOnTotalCapitalInvested)} ROTCI`,
    };
  });
}

function openPrintableReport(html) {
  const reportWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!reportWindow) {
    downloadTextFile('acquiraiq-report.html', html, 'text/html');
    return false;
  }
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
  return true;
}

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [session, setSession] = useState(getStoredSession);
  const user = getCurrentUserFromSession(session);

  async function signUp(email, password) {
    const data = await signUpWithEmail(email, password);
    if (data.access_token) setSession(data);
    return data;
  }

  async function signIn(email, password) {
    const data = await signInWithEmail(email, password);
    setSession(data);
    return data;
  }

  async function signOut() {
    await signOutSession();
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  return useContext(AuthContext);
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Shell />}>
          <Route index element={<LandingPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="brrr" element={<BrrrAnalyzerPage />} />
          <Route path="airbnb" element={<AirbnbAnalyzerPage />} />
          <Route path="platform" element={<PlatformPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="vault" element={<VaultPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="contacts" element={<InvestorContactsPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="signup" element={<SignUpPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="calculations" element={<CalculationsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="cookies" element={<CookiesPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="not-financial-advice" element={<NotFinancialAdvicePage />} />
          <Route path="professional-tools" element={<ProfessionalToolsPage />} />
          <Route path="operating-system" element={<OperatingSystemPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="roadmap" element={<RoadmapPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();

  async function handleLogOut() {
    await signOut();
    setMenuOpen(false);
  }

  return (
    <>
      <nav className="platform-nav">
        <Link className="nav-brand" to="/" onClick={() => setMenuOpen(false)}>
          <span>AcquiraIQ</span>
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
            SA
          </NavLink>
          <NavLink to="/platform" onClick={() => setMenuOpen(false)}>
            Platform
          </NavLink>
          {user ? (
            <>
              <span className="nav-user">{user.email}</span>
              <button className="nav-logout" type="button" onClick={handleLogOut}>
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)}>
                Sign In
              </Link>
              <Link className="nav-cta" to="/signup" onClick={() => setMenuOpen(false)}>
                Create Free Account
              </Link>
            </>
          )}
        </div>
      </nav>
      <ScrollToTop />
      <Outlet />
      <footer className="footer-note">
        <span>AcquiraIQ</span>
        <p>
          Investment analysis software, not financial advice. Review the <Link to="/calculations">calculation guide</Link>, <Link to="/privacy">privacy policy</Link>, <Link to="/terms">terms</Link>, <Link to="/contact">contact</Link> and <Link to="/not-financial-advice">not financial advice</Link>.
        </p>
      </footer>
    </>
  );
}

function LandingPage() {
  return (
    <main className="page landing-page">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Premium property investment software</p>
          <h1>Analyse Property Deals Like a Professional Investor</h1>
          <p className="hero-subtitle">
            Calculate BRRR and serviced accommodation opportunities, compare investments, track your pipeline and manage your growing portfolio from one platform.
          </p>

          <div className="hero-actions">
            <Link className="primary-link" to="/signup">
              Start Free
            </Link>
            <Link className="secondary-link" to="/platform">
              View Pro Features
            </Link>
          </div>
        </div>

        <div className="hero-preview glass-card">
          <div className="preview-header">
            <span>Investor workflow</span>
            <strong>Analyse → Save → Manage</strong>
          </div>
          <div className="preview-metric">
            <small>Monthly cashflow</small>
            <strong>£352</strong>
          </div>
          <div className="preview-grid">
            <span>
              <small>Total capital return</small>
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
          copy="Analyse, compare, save and manage property investment opportunities in one place using clear assumptions and investor-grade return calculations."
        />

        <div className="feature-grid">
          <FeatureCard
            title="BRRR Deal Analysis"
            copy="Analyse purchase, refurb, refinance and cashflow with total capital return and capital-left-in metrics."
          />
          <FeatureCard
            title="Serviced Accommodation Comparison"
            copy="Compare Airbnb, Booking.com and short-term rental profit against long-term rent."
            status="Early Access"
          />
          <FeatureCard
            title="Portfolio Tracking"
            copy="Move opportunities from saved analysis into pipeline stages and track purchased assets as your portfolio grows."
            status="Active"
          />
        </div>
      </section>

      <section className="workflow-section">
        <SectionHeading
          label="Workflow"
          title="Compare strategies before committing capital"
          copy="A simple operating flow designed to help investors move from first review to a retained decision record."
        />
        <div className="workflow-grid">
          <WorkflowStep number="1" title="Enter deal details" copy="Capture purchase, rent, finance and cost assumptions." />
          <WorkflowStep number="2" title="Review investor metrics" copy="Focus on cashflow, yield, cash left in and return on total capital invested." />
          <WorkflowStep number="3" title="Save, pipeline and track" copy="Keep a record of opportunities, move them forward and add purchased assets to your portfolio." />
        </div>
      </section>

      <section className="platform-section glass-card">
        <SectionHeading
          label="Upgrade path"
          title="Built to grow with serious investors"
          copy="Start with free analysis and saved opportunities. Pro and Premium workflows add deeper decision support as your deal flow and portfolio become more demanding."
        />
        <div className="premium-preview-grid">
          <PremiumPreview label="Pro" title="AI Investor Verdicts" copy="Turn metrics into concise strengths, risks and recommended next steps." />
          <PremiumPreview label="Pro" title="HMO Analyzer" copy="A future underwriting module for room-by-room income, licensing risk and operating costs." />
          <PremiumPreview label="Pro" title="Flip Analyzer" copy="A future resale model for refurb margin, holding costs and profit sensitivity." />
          <PremiumPreview label="Pro" title="Advanced Sensitivity Analysis" copy="Stress-test valuation, rent, interest rates and occupancy before offer stage." />
          <PremiumPreview label="Pro" title="Strategy Comparison" copy="Compare BRRR, SA and BTL using return, cashflow, capital and risk." />
          <PremiumPreview label="Pro" title="PDF Reports" copy="Create decision records for your own file, partners, lenders or brokers." />
          <PremiumPreview label="Pro" title="Unlimited Saved Deals" copy="Build a larger deal vault without losing assumptions, notes or scenarios." />
          <PremiumPreview label="Premium" title="Acquisition Pipeline" copy="Manage opportunities from lead to purchased without losing context." />
          <PremiumPreview label="Premium" title="Portfolio Tracking" copy="Track rent, equity and growth once deals become owned assets." />
          <PremiumPreview label="Premium" title="Investor CRM" copy="Manage agents, brokers, solicitors, builders and partners around the acquisition workflow." />
          <PremiumPreview label="Premium" title="Marketplace Access" copy="A future route to data partners, integrations and vetted opportunity sources." />
          <PremiumPreview label="Premium" title="Team Features" copy="Future collaboration tools once accounts, billing and permissions are live." />
        </div>
      </section>

      <section className="trust-section glass-card">
        <SectionHeading
          label="Trust by design"
          title="Conservative underwriting beats optimistic guesswork"
          copy="AcquiraIQ is designed around clear assumptions and decision-ready metrics rather than inflated refinance-based ROI claims."
        />
      </section>

      <section className="upgrade-strip glass-card">
        <div>
          <p className="eyebrow">Launch offer</p>
          <h2>Free underwriting today. Pro decision support when you are ready.</h2>
          <p>Use the analyzers, Deal Vault, Pipeline and Portfolio today. Pro features are positioned for deeper reports, comparisons and scenario workflows later.</p>
        </div>
        <div className="hero-actions">
          <Link className="primary-link" to="/pricing">View Pricing</Link>
          <Link className="secondary-link" to="/calculations">Calculation Guide</Link>
        </div>
      </section>

      <section className="bottom-cta">
        <h2>Start Analysing Deals for Free</h2>
        <p>Open the dashboard and launch an active analysis module in seconds.</p>
        <Link className="primary-link" to="/signup">
          Create Free Account
        </Link>
      </section>
    </main>
  );
}

function SignUpPage() {
  const { user, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const data = await signUp(email.trim(), password);
      if (data.access_token) {
        setMessage('Account created. Redirecting to dashboard...');
        window.setTimeout(() => navigate('/dashboard'), 500);
      } else {
        setMessage('Account created. Check your email to confirm your sign up, then log in.');
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      label="Free account"
      title={user ? 'You are signed in' : 'Create your free investor account'}
      copy={user ? `${user.email} is already signed in.` : 'Use Supabase Auth to create a secure account. Deal data still stays in local storage for now.'}
    >
      {user ? (
        <Link className="primary-link" to="/dashboard">Open Dashboard</Link>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="note-entry"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="investor@example.com" required /></label>
          <label className="note-entry"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" minLength="6" required /></label>
          <button className="primary-btn" type="submit" disabled={busy}>{busy ? 'Creating...' : 'Create Free Account'}</button>
          {message && <p className="status-message">{message}</p>}
          {!supabaseConfig.isConfigured && <p className="auth-warning">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable live authentication.</p>}
          <Link className="panel-link" to="/login">Already have an account? Sign in</Link>
        </form>
      )}
    </AuthLayout>
  );
}

function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await signIn(email.trim(), password);
      navigate('/dashboard');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      label="Sign in"
      title={user ? 'You are signed in' : 'Sign in to AcquiraIQ'}
      copy={user ? `${user.email} is already signed in.` : 'Sign in to save deals, scenarios and notes while the workspace continues using local storage.'}
    >
      {user ? (
        <Link className="primary-link" to="/dashboard">Open Dashboard</Link>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="note-entry"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="investor@example.com" required /></label>
          <label className="note-entry"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" required /></label>
          <button className="primary-btn" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign In'}</button>
          {message && <p className="status-message">{message}</p>}
          {!supabaseConfig.isConfigured && <p className="auth-warning">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable live authentication.</p>}
          <div className="auth-links">
            <Link className="panel-link" to="/forgot-password">Forgot password?</Link>
            <Link className="panel-link" to="/signup">Create free account</Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await sendPasswordReset(email.trim());
      setMessage('Password reset email sent if this account exists.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout label="Password reset" title="Reset your password" copy="Enter your email and Supabase will send a reset link if the account exists.">
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="note-entry"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="investor@example.com" required /></label>
        <button className="primary-btn" type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send Reset Email'}</button>
        {message && <p className="status-message">{message}</p>}
        <Link className="panel-link" to="/login">Back to sign in</Link>
      </form>
    </AuthLayout>
  );
}

function AuthLayout({ label, title, copy, children }) {
  return (
    <main className="page auth-page">
      <section className="auth-card glass-card">
        <p className="eyebrow">{label}</p>
        <h1>{title}</h1>
        <p>{copy}</p>
        {children}
      </section>
    </main>
  );
}

function DashboardPage() {
  const stats = getDashboardStats();
  const [syncStatus, setSyncStatus] = useState(stats.syncStatus);
  const [syncing, setSyncing] = useState(false);
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
      title: 'Serviced Accommodation',
      status: 'Early Access',
      copy: 'Compare Airbnb, Booking.com and short-term rental profit against long-term rent.',
      action: 'Open SA Analyzer',
      to: '/airbnb',
      active: true,
    },
    {
      title: 'Portfolio Tracker',
      status: 'Active',
      copy: 'Track assets, rent, equity and growth forecast.',
      action: 'Open Portfolio',
      to: '/portfolio',
      active: true,
    },
    {
      title: 'Acquisition Pipeline',
      status: 'Active',
      copy: 'Move opportunities from lead to purchased.',
      action: 'Open Pipeline',
      to: '/pipeline',
      active: true,
    },
    {
      title: 'Investor Contacts',
      status: 'Premium Preview',
      copy: 'Track brokers, agents, sourcers and lenders.',
      action: 'Open Contacts',
      to: '/contacts',
      active: true,
    },
  ];

  async function handleSync() {
    setSyncing(true);
    const nextStatus = await syncWorkspaceToCloud();
    setSyncStatus(nextStatus);
    setSyncing(false);
  }

  return (
    <main className="page dashboard-page">
      <section className="page-hero compact">
        <p className="eyebrow">AcquiraIQ workspace</p>
        <h1>Investor Command Centre</h1>
        <p>Analyse opportunities, save decisions, manage acquisition stages and track owned properties from one calm workspace.</p>
      </section>

      <section className="progress-panel glass-card">
        <div>
          <p className="eyebrow">Investor progress</p>
          <h2>Your investment operating view</h2>
          <p>Track the evidence, opportunities and owned assets you are building. Data is stored locally in your browser until cloud sync is connected.</p>
        </div>
        <div className="dashboard-summary">
          <SummaryCard label="Deals Analysed" value={String(stats.dealsAnalysed)} copy="Saved underwriting records." />
          <SummaryCard label="Saved Deals" value={String(stats.vaultItems)} copy="Deal Vault items and notes." />
          <SummaryCard label="Pipeline Opportunities" value={String(stats.pipelineDeals)} copy="Active acquisition stages." />
          <SummaryCard label="Portfolio Properties" value={String(stats.portfolioProperties)} copy="Tracked owned assets." />
          <SummaryCard label="Monthly Rental Income" value={formatMoney(stats.portfolioTotals.rent)} copy="Gross rent from portfolio records." />
          <SummaryCard label="Estimated Portfolio Equity" value={formatMoney(stats.portfolioTotals.equity)} copy="Value less mortgage balances." />
        </div>
      </section>

      <section className="onboarding-panel glass-card">
        <SectionHeading
          label="Next best actions"
          title="Move one opportunity through the workflow"
          copy="The core AcquiraIQ journey is simple: analyse a deal, save the opportunity, move it into Pipeline and add it to Portfolio if purchased."
        />
        <div className="checklist-grid">
          <ChecklistItem done={stats.dealsAnalysed > 0} title="Analyse deal" copy="Use BRRR or serviced accommodation to model the opportunity." />
          <ChecklistItem done={stats.vaultItems > 0} title="Save opportunity" copy="Name the deal and store notes in Deal Vault." />
          <ChecklistItem done={stats.pipelineDeals > 0} title="Move to pipeline" copy="Progress one opportunity through stages." />
          <ChecklistItem done={stats.portfolioProperties > 0} title="Add to portfolio" copy="Track a purchased or live property." />
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
              <span className="module-action muted static">
                {module.action}
              </span>
            )}
          </article>
        ))}
      </section>

      <section className="workspace-panel glass-card">
        <SectionHeading
          label="Workspace"
          title="Return to your investment workflow"
          copy="Recent analyses, saved deals, notes and active opportunities are grouped into one calm operating view."
        />
        <div className="workspace-grid">
          <DashboardPanel title="Recent Analyses" meta="Local browser">
            {stats.recentDeals.length > 0 ? (
              stats.recentDeals.map((deal) => (
                <p key={deal.id}>{deal.name} · {formatMoney(deal.metric)} {deal.metricLabel}</p>
              ))
            ) : (
              <EmptyLine text="No saved deals yet. Analyse your first BRRR or serviced accommodation opportunity to begin building your deal vault." />
            )}
          </DashboardPanel>
          <DashboardPanel title="Deal Vault" meta={`${stats.vaultItems} items`}>
            {stats.recentVaultItems.length > 0 ? (
              stats.recentVaultItems.map((item) => (
                <p key={item.id}>{item.title} · {item.type}</p>
              ))
            ) : (
              <EmptyLine text="Saved scenarios, notes and reports will appear here once added." />
            )}
            <Link className="panel-link" to="/vault">Open vault</Link>
          </DashboardPanel>
          <DashboardPanel title="Pipeline" meta={`${stats.pipelineDeals} opportunities`}>
            {stats.recentPipelineDeals.length > 0 ? (
              stats.recentPipelineDeals.map((deal) => (
                <p key={deal.id}>{deal.title} · {deal.stage}</p>
              ))
            ) : (
              <EmptyLine text="Pipeline opportunities will appear here when deals are moved forward." />
            )}
            <Link className="panel-link" to="/pipeline">Open pipeline</Link>
          </DashboardPanel>
          <DashboardPanel title="Account" meta={stats.account?.plan || 'Free'}>
            <EmptyLine text={stats.account?.email ? `${stats.account.email} is using the local beta workspace.` : 'Create a free local workspace from the homepage.'} />
            {stats.upgradeIntent ? (
              <p>Upgrade interest: {stats.upgradeIntent.plan}</p>
            ) : (
              <Link className="panel-link" to="/pricing">View pricing</Link>
            )}
          </DashboardPanel>
        </div>
      </section>

      <section className="upgrade-strip glass-card">
        <div>
          <p className="eyebrow">Cloud readiness</p>
          <h2>{CLOUD_SYNC_ENABLED ? 'Cloud sync is configured' : 'Cloud sync is ready to connect'}</h2>
          <p>{syncStatus?.message || 'Local data works now. Add Supabase environment variables and the workspace table to enable browser-to-cloud sync.'}</p>
        </div>
        <div className="hero-actions">
          <button className="primary-btn" type="button" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync Workspace'}
          </button>
          <Link className="secondary-link" to="/account">Account</Link>
        </div>
      </section>

      <section className="upgrade-strip glass-card">
        <div>
          <p className="eyebrow">Platform</p>
          <h2>Free analysis today. Pro and Premium workflows next.</h2>
          <p>AcquiraIQ is structured around a Free / Pro / Premium ecosystem without blocking the core analyzers.</p>
        </div>
        <div className="hero-actions">
          <Link className="primary-link" to="/platform">View Platform</Link>
          <Link className="secondary-link" to="/pricing">Pricing</Link>
        </div>
      </section>
    </main>
  );
}

function BrrrAnalyzerPage() {
  const { user } = useAuth();
  const [inputs, setInputs] = useState(initialInputs);
  const [scenario, setScenario] = useState('expected');
  const [activeTab, setActiveTab] = useState('overview');
  const [dealName, setDealName] = useState(createDefaultDealName(initialInputs, 'BRRR'));
  const [dealNote, setDealNote] = useState('');
  const [savedDeals, setSavedDeals] = useState(loadSavedDeals);
  const [vaultItems, setVaultItems] = useState(loadDealVault);
  const [noteDraft, setNoteDraft] = useState('');
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
      currentMarketValue: toNumber(inputs.currentMarketValue),
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
    const { purchasePrice, currentMarketValue, refurbCost, monthlyRent, interestRate, loanToValue, refinanceValue, legalFees } = adjustedValues;
    const calculatedStampDuty = calculateStampDuty(purchasePrice);
    const stampDuty = inputs.stampDutyEstimate === '' ? calculatedStampDuty : toNumber(inputs.stampDutyEstimate);
    const monthlyRunningCosts = adjustedValues.monthlyRunningCosts;
    const voidAllowance = adjustedValues.voidAllowance;
    const voidLoss = monthlyRent * (voidAllowance / 100);
    const effectiveMonthlyRent = Math.max(monthlyRent - voidLoss, 0);

    const totalCashInvested = purchasePrice + refurbCost + stampDuty + legalFees;
    const totalProjectCost = purchasePrice + refurbCost + stampDuty + legalFees;
    const refinanceLoan = refinanceValue * (loanToValue / 100);
    const monthlyMortgage = (refinanceLoan * (interestRate / 100)) / 12;
    const monthlyCashflow = effectiveMonthlyRent - monthlyRunningCosts - monthlyMortgage;
    const annualCashflow = monthlyCashflow * 12;
    const grossYield = purchasePrice > 0 ? ((monthlyRent * 12) / purchasePrice) * 100 : 0;
    const annualNetOperatingIncome = (effectiveMonthlyRent - monthlyRunningCosts) * 12;
    const netYield = totalCashInvested > 0 ? (annualNetOperatingIncome / totalCashInvested) * 100 : 0;
    const cashLeftInDeal = Math.max(totalCashInvested - refinanceLoan, 0);
    const returnOnTotalCapitalInvested = totalCashInvested > 0 ? (annualCashflow / totalCashInvested) * 100 : 0;
    const brrrCashOnCashReturn = cashLeftInDeal > 0 ? (annualCashflow / cashLeftInDeal) * 100 : null;
    const equityCreated = refinanceValue - totalProjectCost;
    const marketValueForDiscount = currentMarketValue || purchasePrice;
    const discountToMarketValue = marketValueForDiscount > 0 ? ((marketValueForDiscount - purchasePrice) / marketValueForDiscount) * 100 : 0;
    const refinanceStrength = totalCashInvested > 0 ? (refinanceLoan / totalCashInvested) * 100 : 0;
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
    const gdvSensitivity = [0.9, 1, 1.1].map((multiplier) => {
      const gdv = refinanceValue * multiplier;
      const loan = gdv * (loanToValue / 100);
      return { label: `${formatMoney(gdv)} GDV`, value: `${formatMoney(Math.max(totalCashInvested - loan, 0))} left in deal` };
    });

    const calculatedMetrics = {
      scenario,
      stampDuty,
      calculatedStampDuty,
      currentMarketValue: marketValueForDiscount,
      totalCashInvested,
      totalProjectCost,
      refinanceLoan,
      monthlyMortgage,
      monthlyCashflow,
      annualCashflow,
      annualNetOperatingIncome,
      grossYield,
      netYield,
      cashLeftInDeal,
      cashOnCashRoi: returnOnTotalCapitalInvested,
      returnOnTotalCapitalInvested,
      brrrCashOnCashReturn,
      equityCreated,
      discountToMarketValue,
      refinanceStrength,
      monthlyRunningCosts,
      voidLoss,
      effectiveMonthlyRent,
      breakEvenRent,
      breakEvenRefinanceValue,
      breakEvenInterestRate,
      interestSensitivity,
      rentSensitivity,
      gdvSensitivity,
    };

    const rating = getDealRating(calculatedMetrics);

    return {
      ...calculatedMetrics,
      rating,
      verdict: getDealVerdict({ ...calculatedMetrics, rating }),
      healthSummary: getBrrrHealthSummary(calculatedMetrics),
    };
  }, [inputs, scenario]);

  function saveDeals(nextDeals) {
    setSavedDeals(nextDeals);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDeals));
  }

  function saveVault(nextVaultItems) {
    setVaultItems(nextVaultItems);
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(nextVaultItems));
  }

  function addVaultItem(type, title, copy) {
    if (!user) {
      setSaveMessage('Sign in to save deals, scenarios and notes.');
      return;
    }
    const item = {
      id: crypto.randomUUID(),
      type,
      title,
      copy,
      createdAt: new Date().toISOString(),
      route: '/brrr',
      scenario,
      dealName,
    };
    saveVault([item, ...vaultItems]);
    setSaveMessage(`${title} added to Deal Vault`);
  }

  function saveCurrentDeal() {
    if (!user) {
      setSaveMessage('Sign in to save this opportunity.');
      return;
    }
    const cleanName = dealName.trim() || createDefaultDealName(inputs, 'BRRR');
    const deal = {
      id: crypto.randomUUID(),
      name: cleanName,
      createdAt: new Date().toISOString(),
      inputs: { ...inputs },
      metrics: { ...metrics },
      scenario,
      notes: dealNote.trim(),
      strategy: 'BRRR',
    };

    saveDeals([deal, ...savedDeals]);
    saveVault([
      {
        id: crypto.randomUUID(),
        type: 'Deal',
        title: deal.name,
        copy: deal.notes || `${formatMoney(metrics.monthlyCashflow)} monthly cashflow · ${formatPercent(metrics.returnOnTotalCapitalInvested)} return on total capital`,
        createdAt: deal.createdAt,
        route: '/brrr',
        scenario,
        dealId: deal.id,
        name: deal.name,
        notes: deal.notes,
        inputs: deal.inputs,
        metrics: deal.metrics,
        strategy: 'BRRR',
      },
      ...vaultItems,
    ]);
    setActiveDealId(deal.id);
    setSaveMessage(`${deal.name} saved`);
  }

  function saveScenario() {
    if (!user) {
      setSaveMessage('Sign in to save scenarios.');
      return;
    }
    addVaultItem(
      'Scenario',
      `${dealName.trim() || createDefaultDealName(inputs, 'BRRR')} · ${scenario[0].toUpperCase()}${scenario.slice(1)}`,
      `${formatMoney(metrics.cashLeftInDeal)} left in deal · ${formatMoney(metrics.monthlyCashflow)} monthly cashflow`,
    );
  }

  function addNote() {
    if (!user) {
      setSaveMessage('Sign in to save notes.');
      return;
    }
    const note = noteDraft.trim();
    if (!note) return;
    addVaultItem('Note', 'Investor note', note);
    setNoteDraft('');
  }

  function deleteVaultItem(itemId) {
    saveVault(vaultItems.filter((item) => item.id !== itemId));
  }

  function exportVault() {
    downloadTextFile('acquiraiq-deal-vault.json', JSON.stringify(vaultItems, null, 2), 'application/json');
    setSaveMessage('Deal Vault exported');
  }

  function exportReport() {
    const cleanName = dealName.trim() || createDefaultDealName(inputs, 'BRRR');
    const opened = openPrintableReport(createBrrrReportHtml(inputs, metrics, signatureVerdict, strategyComparison, cleanName));
    if (!opened) {
      downloadTextFile(
        `${cleanName.toLowerCase().replaceAll(' ', '-')}-report.txt`,
        createBrrrReport(inputs, metrics, signatureVerdict, strategyComparison),
      );
    }
    setSaveMessage(opened ? 'PDF report opened' : 'Report downloaded as backup');
  }

  function loadDeal(deal) {
    setInputs(normalizeInputs(deal.inputs));
    setScenario(deal.scenario || deal.metrics?.scenario || 'expected');
    setDealName(deal.name || createDefaultDealName(deal.inputs || inputs, 'BRRR'));
    setDealNote(deal.notes || '');
    setActiveDealId(deal.id);
    setSaveMessage(`${deal.name} loaded`);
  }

  function renameDeal(dealId, nextName) {
    const cleanName = nextName.trim();
    if (!cleanName) return;
    const nextDeals = savedDeals.map((deal) => (deal.id === dealId ? { ...deal, name: cleanName } : deal));
    saveDeals(nextDeals);
    saveVault(vaultItems.map((item) => (item.dealId === dealId ? { ...item, title: cleanName, name: cleanName } : item)));
    if (activeDealId === dealId) setDealName(cleanName);
  }

  function addDealNote(dealId, note) {
    const cleanNote = note.trim();
    if (!cleanNote) return;
    saveDeals(savedDeals.map((deal) => (deal.id === dealId ? { ...deal, notes: cleanNote } : deal)));
    const deal = savedDeals.find((item) => item.id === dealId);
    if (deal) addVaultItem('Note', `${deal.name} note`, cleanNote);
  }

  function moveSavedDealToPipeline(deal) {
    addDealToPipeline(deal, 'Analysing');
    setSaveMessage(`${deal.name} moved to pipeline`);
  }

  function moveSavedDealToPortfolio(deal) {
    addDealToPortfolio(deal);
    setSaveMessage(`${deal.name} added to portfolio`);
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
  const strategyComparison = getBrrrStrategyComparison(metrics);

  return (
    <main className="page analyzer-page">
      <section className="module-header">
        <div>
          <p className="eyebrow">Analysis</p>
          <h1>BRRR Analyzer</h1>
          <p>Analyse purchase, refinance and cashflow assumptions before committing capital.</p>
          <Breadcrumbs items={['Dashboard', 'BRRR']} />
        </div>
        <div className="module-header-actions">
          {saveMessage && <span>{saveMessage}</span>}
          {!user && <Link className="secondary-link" to="/login">Sign In</Link>}
          <button className="secondary-btn" type="button" onClick={exportReport}>
            Generate PDF Report
          </button>
          <button className="primary-btn" type="button" onClick={saveCurrentDeal}>
            Save Opportunity
          </button>
        </div>
      </section>

      <section className="summary-strip" aria-label="Deal summary">
        <SummaryCard label="Monthly Cashflow" value={formatMoney(metrics.monthlyCashflow)} copy="After mortgage, running costs and void allowance." />
        <SummaryCard label="Return on Total Capital Invested" value={formatPercent(metrics.returnOnTotalCapitalInvested)} copy="Annual cashflow compared with total capital invested." />
        <SummaryCard label="Cash Left in Deal" value={formatMoney(metrics.cashLeftInDeal)} copy="Total cash invested less estimated refinance proceeds." />
      </section>

      <section className="analyzer-grid">
        <div className="panel input-panel">
          <PanelHeading label="Inputs" title="Deal Assumptions" meta={activeDealId ? 'Saved deal loaded' : 'Unsaved scenario'} />
          <DealIdentityForm dealName={dealName} setDealName={setDealName} dealNote={dealNote} setDealNote={setDealNote} />
          <ScenarioToggle scenario={scenario} setScenario={setScenario} />
          <InputSections groupedFields={groupedFields} inputs={inputs} updateInput={updateInput} />
        </div>

        <div className="panel analysis-workspace">
          <PanelHeading label="Analysis" title="Decision Workspace" meta={metrics.rating.label} />
          <AnalysisTabs activeTab={activeTab} setActiveTab={setActiveTab} />

          {activeTab === 'overview' && (
            <div className="tab-panel">
              <div className={`rating-card ${metrics.rating.tone}`}>
                <span>Deal summary</span>
                <strong>{metrics.rating.label}</strong>
                <p>{metrics.verdict}</p>
              </div>
              <div className="metric-list compact">
                <Result label="Total Cash Invested" value={formatMoney(metrics.totalCashInvested)} />
                <Result label="Current Market Value" value={formatMoney(metrics.currentMarketValue)} note="Optional market value today, before refurbishment." />
                <Result label="Refinance Loan Estimate" value={formatMoney(metrics.refinanceLoan)} />
                <Result label="Total Capital Left In Deal" value={formatMoney(metrics.cashLeftInDeal)} note="Capital still tied up after estimated refinance proceeds." highlight />
                <Result label="Monthly Mortgage Payment" value={formatMoney(metrics.monthlyMortgage)} />
                <Result label="Monthly Cashflow" value={formatMoney(metrics.monthlyCashflow)} highlight />
                <Result label="Annual Cashflow" value={formatMoney(metrics.annualCashflow)} />
                <Result label="Gross Yield" value={formatPercent(metrics.grossYield)} note="Annual gross rent divided by purchase price." />
                <Result label="Net Yield" value={formatPercent(metrics.netYield)} note="Annual net operating income divided by total capital invested. Mortgage is excluded." />
                <Result label="Return on Total Capital Invested" value={formatPercent(metrics.returnOnTotalCapitalInvested)} note="Annual cashflow divided by purchase, refurb, stamp duty and buying costs." highlight />
                <Result label="BRRR Cash-on-Cash Return" value={metrics.brrrCashOnCashReturn === null ? 'Capital Fully Recycled' : formatPercent(metrics.brrrCashOnCashReturn)} note="Annual cashflow divided by cash left in the deal after refinance." />
                <Result label="Equity Created" value={formatMoney(metrics.equityCreated)} note="Post-refurb value less total project cost." />
                <Result label="Discount To Market Value" value={formatPercent(metrics.discountToMarketValue)} note="Current market value less purchase price, divided by current market value." />
                <Result label="Refinance Strength" value={formatPercent(metrics.refinanceStrength)} note="Estimated refinance loan compared with total capital invested." />
              </div>
            </div>
          )}

          {activeTab === 'verdict' && (
            <div className="tab-panel">
              <AIVerdictPanel verdict={signatureVerdict} />
              <DecisionPanel health={health} healthSummary={metrics.healthSummary} verdict={metrics.verdict} benchmarks={benchmarks} insights={insightCards} />
            </div>
          )}

          {activeTab === 'sensitivity' && (
            <div className="tab-panel">
              <MiniTable title="Interest rate sensitivity" rows={metrics.interestSensitivity} />
              <MiniTable title="Rent sensitivity" rows={metrics.rentSensitivity} />
              <MiniTable title="GDV sensitivity" rows={metrics.gdvSensitivity} />
              <MiniTable title="Scenario comparison" rows={getBrrrScenarioComparisonRows(inputs)} />
              <MiniTable
                title="Break-even analysis"
                rows={[
                  { label: 'Break-even rent', value: formatMoney(metrics.breakEvenRent) },
                  { label: 'Break-even refinance value', value: formatMoney(metrics.breakEvenRefinanceValue) },
                  { label: 'Break-even interest rate', value: formatPercent(metrics.breakEvenInterestRate) },
                ]}
              />
            </div>
          )}

          {activeTab === 'comparison' && (
            <div className="tab-panel">
              <StrategyComparisonPanel comparison={strategyComparison} />
              <div className="panel assumptions-panel nested-panel">
                <PanelHeading label="Transparency" title="Assumptions" meta="Estimate" />
                <ul>
                  <li>Rent, GDV/ARV, refurb cost and lending terms should be independently verified.</li>
                  <li>Stamp duty is an estimate unless you enter your own figure.</li>
                  <li>Running costs and void allowance are included to avoid marketing-style ROI claims.</li>
                  <li>This is an underwriting aid, not financial, tax or mortgage advice.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'saved' && (
            <div className="tab-panel">
              <DealVaultPanel
                vaultItems={vaultItems}
                saveScenario={saveScenario}
                noteDraft={noteDraft}
                setNoteDraft={setNoteDraft}
                addNote={addNote}
                deleteVaultItem={deleteVaultItem}
                exportVault={exportVault}
              />
              <SaveCompareFramework />
              <SavedDealsList
                savedDeals={savedDeals}
                activeDealId={activeDealId}
                loadDeal={loadDeal}
                deleteDeal={deleteDeal}
                renameDeal={renameDeal}
                addDealNote={addDealNote}
                moveToPipeline={moveSavedDealToPipeline}
                moveToPortfolio={moveSavedDealToPortfolio}
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function AirbnbAnalyzerPage() {
  const { user } = useAuth();
  const [inputs, setInputs] = useState(initialAirbnbInputs);
  const [scenario, setScenario] = useState('expected');
  const [activeTab, setActiveTab] = useState('overview');
  const [compareAgainstBtl, setCompareAgainstBtl] = useState(true);
  const [dealName, setDealName] = useState(createDefaultDealName({ purchasePrice: initialAirbnbInputs.purchasePrice }, 'SA'));
  const [dealNote, setDealNote] = useState('');
  const [vaultItems, setVaultItems] = useState(loadDealVault);
  const [noteDraft, setNoteDraft] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  function updateInput(name, value) {
    setInputs((currentInputs) => ({ ...currentInputs, [name]: value }));
    setSaveMessage('');
  }

  const metrics = useMemo(() => {
    const baseValues = {
      purchasePrice: toNumber(inputs.purchasePrice),
      currentMarketValue: toNumber(inputs.currentMarketValue || inputs.propertyValue),
      propertyValue: toNumber(inputs.currentMarketValue || inputs.propertyValue || inputs.purchasePrice),
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
      purchasePrice,
      currentMarketValue,
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
    const marketValue = currentMarketValue || propertyValue || purchasePrice;
    const airbnbYield = marketValue > 0 ? (annualProfit / marketValue) * 100 : 0;
    const paybackMonths = monthlyProfit > 0 ? setupCost / monthlyProfit : 0;
    const btlProfit = longTermRent - monthlyMortgage;
    const monthlyDifference = monthlyProfit - btlProfit;
    const instantEquity = Math.max(marketValue - purchasePrice, 0);
    const discountToMarketValue = marketValue > 0 ? ((marketValue - purchasePrice) / marketValue) * 100 : 0;
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
      compareAgainstBtl,
      purchasePrice,
      currentMarketValue: marketValue,
      occupancy,
      grossMonthlyRevenue,
      operatingCosts,
      monthlyProfit,
      annualProfit,
      airbnbYield,
      paybackMonths,
      btlProfit,
      monthlyDifference,
      instantEquity,
      discountToMarketValue,
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
  }, [inputs, scenario, compareAgainstBtl]);

  const health = getAirbnbHealth(metrics);
  const insights = getAirbnbInsights(metrics);
  const airbnbRecommendation = getAirbnbRecommendation(metrics);
  const signatureVerdict = getSignatureVerdict('Airbnb', metrics, health);
  const strategyComparison = getAirbnbStrategyComparison(metrics);

  function saveVault(nextVaultItems) {
    setVaultItems(nextVaultItems);
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(nextVaultItems));
  }

  function addVaultItem(type, title, copy) {
    if (!user) {
      setSaveMessage('Sign in to save deals, scenarios and notes.');
      return;
    }
    const item = {
      id: crypto.randomUUID(),
      type,
      title,
      copy,
      createdAt: new Date().toISOString(),
      route: '/airbnb',
      scenario,
      dealName,
      strategy: 'Serviced Accommodation',
      inputs: { ...inputs },
      metrics: { ...metrics },
    };
    saveVault([item, ...vaultItems]);
    setSaveMessage(`${title} added to Deal Vault`);
  }

  function saveCurrentDeal() {
    if (!user) {
      setSaveMessage('Sign in to save this opportunity.');
      return;
    }
    const cleanName = dealName.trim() || createDefaultDealName({ purchasePrice: inputs.purchasePrice }, 'SA');
    saveVault([
      {
        id: crypto.randomUUID(),
        type: 'Deal',
        title: cleanName,
        copy: dealNote.trim() || `${formatMoney(metrics.monthlyProfit)} monthly profit · ${formatMoney(metrics.monthlyDifference)} versus BTL`,
        createdAt: new Date().toISOString(),
        route: '/airbnb',
        scenario,
        name: cleanName,
        notes: dealNote.trim(),
        inputs: { ...inputs },
        metrics: { ...metrics },
        strategy: 'Serviced Accommodation',
      },
      ...vaultItems,
    ]);
    setSaveMessage(`${cleanName} saved`);
  }

  function saveScenario() {
    if (!user) {
      setSaveMessage('Sign in to save scenarios.');
      return;
    }
    addVaultItem(
      'Scenario',
      `${dealName.trim() || createDefaultDealName({ purchasePrice: inputs.purchasePrice }, 'SA')} · ${scenario[0].toUpperCase()}${scenario.slice(1)}`,
      `${formatMoney(metrics.monthlyProfit)} monthly profit · ${formatPercent(metrics.airbnbYield)} SA yield`,
    );
  }

  function addNote() {
    if (!user) {
      setSaveMessage('Sign in to save notes.');
      return;
    }
    const note = noteDraft.trim();
    if (!note) return;
    addVaultItem('Note', 'SA investor note', note);
    setNoteDraft('');
  }

  function deleteVaultItem(itemId) {
    saveVault(vaultItems.filter((item) => item.id !== itemId));
  }

  function exportVault() {
    downloadTextFile('acquiraiq-deal-vault.json', JSON.stringify(vaultItems, null, 2), 'application/json');
    setSaveMessage('Deal Vault exported');
  }

  return (
    <main className="page analyzer-page">
      <section className="module-header">
        <div>
          <p className="eyebrow">Analysis</p>
          <h1>Serviced Accommodation Analyzer</h1>
          <p>Analyse Airbnb, Booking.com and short-term rental opportunities against long-term rental performance.</p>
          <Breadcrumbs items={['Dashboard', 'Serviced Accommodation']} />
        </div>
        <div className="module-header-actions">
          {saveMessage && <span>{saveMessage}</span>}
          {!user && <Link className="secondary-link" to="/login">Sign In</Link>}
          <button className="primary-btn" type="button" onClick={saveCurrentDeal}>
            Save Opportunity
          </button>
        </div>
      </section>

      <section className="summary-strip" aria-label="Serviced accommodation summary">
        <SummaryCard label="Monthly Profit" value={formatMoney(metrics.monthlyProfit)} copy="After platform, management, bills, cleaning and finance costs." />
        <SummaryCard label="SA Yield" value={formatPercent(metrics.airbnbYield)} copy="Annual profit compared with current market value." />
        <SummaryCard label="Monthly Difference vs BTL" value={compareAgainstBtl ? formatMoney(metrics.monthlyDifference) : 'Off'} copy="Difference versus long-term rental profit when comparison is enabled." />
      </section>

      <section className="analyzer-grid">
        <div className="panel input-panel">
          <PanelHeading label="Inputs" title="Serviced Accommodation Assumptions" meta="Early access" />
          <DealIdentityForm dealName={dealName} setDealName={setDealName} dealNote={dealNote} setDealNote={setDealNote} />
          <label className="comparison-checkbox">
            <input type="checkbox" checked={compareAgainstBtl} onChange={(event) => setCompareAgainstBtl(event.target.checked)} />
            <span>Compare Against Long-Term Rental</span>
          </label>
          <ScenarioToggle scenario={scenario} setScenario={setScenario} />
          <InputSections groupedFields={groupFields(airbnbFields)} inputs={inputs} updateInput={updateInput} />
        </div>

        <div className="panel analysis-workspace">
          <PanelHeading label="Analysis" title="SA Decision Workspace" meta="Estimate" />
          <AnalysisTabs activeTab={activeTab} setActiveTab={setActiveTab} />

          {activeTab === 'overview' && (
            <div className="tab-panel">
              <div className={`rating-card ${airbnbRecommendation.tone}`}>
                <span>Strategy comparison</span>
                <strong>{airbnbRecommendation.label}</strong>
                <p>{airbnbRecommendation.reasoning} Confidence: {airbnbRecommendation.confidence}. Results depend heavily on occupancy, nightly rate and operating costs.</p>
              </div>
              <div className="metric-list compact">
                <Result label="Purchase Price" value={formatMoney(metrics.purchasePrice)} />
                <Result label="Current Market Value" value={formatMoney(metrics.currentMarketValue)} />
                <Result label="Instant Equity" value={formatMoney(metrics.instantEquity)} note="Current market value less purchase price." />
                <Result label="Discount to Market Value" value={formatPercent(metrics.discountToMarketValue)} note="Discount created by buying below estimated market value." />
                <Result label="Estimated Gross Monthly SA Revenue" value={formatMoney(metrics.grossMonthlyRevenue)} highlight />
                <Result label="Estimated Operating Costs" value={formatMoney(metrics.operatingCosts)} />
                <Result label="Estimated Monthly Profit" value={formatMoney(metrics.monthlyProfit)} highlight />
                <Result label="Estimated Annual Profit" value={formatMoney(metrics.annualProfit)} />
                <Result label="SA Yield" value={formatPercent(metrics.airbnbYield)} />
                <Result label="Payback Period on Setup Cost" value={formatMonths(metrics.paybackMonths)} />
                {compareAgainstBtl && <Result label="Long-Term Rental Profit" value={formatMoney(metrics.btlProfit)} />}
                {compareAgainstBtl && <Result label="Expected Monthly Difference" value={formatMoney(metrics.monthlyDifference)} highlight />}
              </div>
            </div>
          )}

          {activeTab === 'verdict' && (
            <div className="tab-panel">
              <AIVerdictPanel verdict={signatureVerdict} />
              <DecisionPanel
                health={health}
                healthSummary={metrics.healthSummary}
                verdict={airbnbRecommendation.reasoning}
                benchmarks={[
                  'Short-term rental performance depends heavily on local demand, regulation and operational standards.',
                  !compareAgainstBtl
                    ? 'BTL comparison is switched off, so the verdict focuses on standalone Airbnb operating risk.'
                    : metrics.monthlyDifference >= 0
                    ? 'The SA scenario outperforms the BTL baseline on profit, before considering extra workload and volatility.'
                    : 'The BTL baseline currently offers a stronger or safer monthly position.',
                ]}
                insights={insights}
              />
            </div>
          )}

          {activeTab === 'sensitivity' && (
            <div className="tab-panel">
              <MiniTable title="Monthly profit by occupancy" rows={metrics.occupancySensitivity} />
              <MiniTable
                title="Break-even analysis"
                rows={[
                  { label: 'Break-even occupancy', value: formatPercent(metrics.breakEvenOccupancy) },
                  { label: 'Break-even nightly rate', value: formatMoney(metrics.breakEvenNightlyRate) },
                  { label: 'Break-even monthly revenue', value: formatMoney(metrics.breakEvenMonthlyRevenue) },
                ]}
              />
            </div>
          )}

          {activeTab === 'comparison' && (
            <div className="tab-panel">
              <StrategyComparisonPanel comparison={strategyComparison} />
              <div className="assumption-note">
                <strong>Assumption note</strong>
                <p>Short-term rental returns are sensitive to occupancy, regulation, seasonality, cleaning costs and management quality. Treat this as an early comparison, not a forecast.</p>
              </div>
            </div>
          )}

          {activeTab === 'saved' && (
            <div className="tab-panel">
              <DealVaultPanel
                vaultItems={vaultItems}
                saveScenario={saveScenario}
                noteDraft={noteDraft}
                setNoteDraft={setNoteDraft}
                addNote={addNote}
                deleteVaultItem={deleteVaultItem}
                exportVault={exportVault}
              />
              <SaveCompareFramework />
            </div>
          )}
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
    { title: 'Advanced Deal Comparison', tier: 'Pro Preview', copy: 'Compare Deal A and Deal B across cashflow, yield, return, risk and capital left in.' },
  ];

  return (
    <main className="page roadmap-page">
      <section className="page-hero compact">
        <p className="eyebrow">Free / Pro ecosystem</p>
        <h1>Professional Investor Tools</h1>
        <p>Visible upgrade pathways for serious investors without blocking the active free analysis tools.</p>
      </section>

      <section className="membership-grid">
        <MembershipTier title="Free" badge="Current" items={['BRRR Analyzer', 'SA Early Access', 'Saved deals in browser']} />
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
        <p className="eyebrow">AcquiraIQ Platform</p>
        <h1>The Investor Operating System</h1>
        <p>A calm, professional workspace for analysing opportunities, comparing strategies, storing deal evidence and preparing for portfolio growth.</p>
      </section>

      <section className="platform-section glass-card">
        <div>
          <p className="eyebrow">Pro</p>
          <h2>Become a Better Investor</h2>
          <p>Professional decision tools designed to sharpen judgement, challenge assumptions and support faster go/no-go decisions.</p>
        </div>
        <div className="premium-preview-grid">
          <PremiumPreview label="Pro preview" title="Advanced Investor Verdict" copy="A second-opinion layer that explains cashflow, refinance risk, suitability and next actions in plain investor language." />
          <PremiumPreview label="Pro preview" title="Scenario Testing" copy="Stress-test conservative, expected and optimistic cases before relying on a headline return." />
          <PremiumPreview label="Pro preview" title="Advanced Sensitivity Analysis" copy="See how rent, rates, GDV and occupancy changes affect the decision before offer stage." />
          <PremiumPreview label="Pro preview" title="Strategy Comparison" copy="Compare BRRR, SA and BTL side by side with a recommended strategy and risk context." />
          <PremiumPreview label="Pro preview" title="PDF Investment Reports" copy="Create a clean browser print report that can be saved as a PDF for partners, lenders or your own file." />
          <PremiumPreview label="Pro preview" title="Unlimited Saved Deals" copy="Build a larger acquisition pipeline without losing scenarios, notes or assumptions." />
        </div>
        <div className="conversion-actions">
          <Link className="primary-link" to="/pricing">Upgrade to Pro</Link>
          <Link className="secondary-link" to="/brrr">Analyse Deal</Link>
        </div>
      </section>

      <section className="platform-section glass-card">
        <div>
          <p className="eyebrow">Premium</p>
          <h2>Build Your Investment Operating System</h2>
          <p>Scale from individual deal analysis into a repeatable system for acquisitions, owned assets, relationships and growth.</p>
        </div>
        <div className="premium-preview-grid">
          <PremiumPreview label="Working beta" title="Portfolio Tracking" copy="Monitor property values, rent, debt and equity from one simple workspace." />
          <PremiumPreview label="Working beta" title="Deal Pipeline" copy="Move opportunities from lead to analysing, offered, under offer and purchased." />
          <PremiumPreview label="Premium preview" title="Growth Forecasting" copy="Model portfolio value, rent growth and equity movement as your assets mature." />
          <PremiumPreview label="Working beta" title="Deal Vault" copy="Store the evidence behind each decision: assumptions, notes, scenarios and reports." />
          <PremiumPreview label="Premium preview" title="Investor CRM" copy="Keep brokers, agents, sourcers, lenders and partners close to the acquisition workflow." />
          <PremiumPreview label="Roadmap" title="Marketplace Access" copy="A future route to vetted opportunities, data partners and deal-flow integrations." />
          <PremiumPreview label="Roadmap" title="Team Features" copy="Future collaboration for partners and teams once accounts, billing and permissions are live." />
          <PremiumPreview label="Premium preview" title="Advanced Reporting" copy="Portfolio-level reporting for capital, income, equity and acquisition progress." />
        </div>
        <div className="conversion-actions">
          <Link className="primary-link" to="/pricing">Unlock Premium</Link>
          <Link className="secondary-link" to="/portfolio">Open Portfolio</Link>
        </div>
      </section>

      <RoadmapBlock />
      <StrategyComparisonPreview />
      <DealVaultPreview />

      <section className="upgrade-strip glass-card">
        <div>
          <p className="eyebrow">Beta pricing</p>
          <h2>Prepare the paid plan without adding payment risk too early.</h2>
          <p>Pricing captures upgrade intent today and is ready to connect to Stripe Checkout when backend billing is added.</p>
        </div>
        <div className="hero-actions">
          <Link className="primary-link" to="/pricing">View Pricing</Link>
          <Link className="secondary-link" to="/vault">Open Deal Vault</Link>
        </div>
      </section>
    </main>
  );
}

function PricingPage() {
  const [account, setAccount] = useState(loadAccount);
  const [upgradeIntent, setUpgradeIntent] = useState(loadUpgradeIntent);
  const plans = [
    {
      name: 'Free',
      price: '£0',
      badge: 'Current',
      copy: 'For testing the core underwriting workflow.',
      items: ['BRRR Analyzer', 'SA Analyzer', 'Local saved deals', 'Basic Deal Vault'],
    },
    {
      name: 'Pro',
      price: '£12/mo',
      badge: 'Recommended',
      copy: 'For investors who want faster analysis, clearer risks and better decision records.',
      items: ['Advanced Investor Verdict', 'Scenario Testing', 'Advanced Sensitivity Analysis', 'Strategy Comparison', 'PDF Investment Reports', 'Unlimited Saved Deals'],
    },
    {
      name: 'Premium',
      price: '£29/mo',
      badge: 'Future',
      copy: 'For portfolio builders who want a full operating system around acquisitions and assets.',
      items: ['Portfolio Tracking', 'Deal Pipeline', 'Growth Forecasting', 'Investor CRM', 'Marketplace Access', 'Team Features', 'Advanced Reporting'],
    },
  ];

  function choosePlan(plan) {
    const nextIntent = {
      plan: plan.name,
      price: plan.price,
      createdAt: new Date().toISOString(),
    };
    const nextAccount = {
      ...(account || {}),
      plan: account?.plan || 'Free',
      requestedPlan: plan.name,
      updatedAt: new Date().toISOString(),
    };
    saveUpgradeIntent(nextIntent);
    saveAccount(nextAccount);
    setUpgradeIntent(nextIntent);
    setAccount(nextAccount);
  }

  return (
    <main className="page pricing-page">
      <section className="page-hero compact">
        <p className="eyebrow">Pricing</p>
        <h1>Simple pricing for serious deal analysis</h1>
        <p>Payment processing is intentionally not connected yet. This page validates upgrade demand and provides a clean Stripe-ready pricing structure.</p>
      </section>

      <section className="pricing-grid">
        {plans.map((plan) => (
          <article className={plan.name === 'Pro' ? 'pricing-card featured glass-card' : 'pricing-card glass-card'} key={plan.name}>
            <span>{plan.badge}</span>
            <h2>{plan.name}</h2>
            <strong>{plan.price}</strong>
            <p>{plan.copy}</p>
            <ul>
              {plan.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <button className={plan.name === 'Pro' ? 'primary-btn' : 'secondary-btn'} type="button" onClick={() => choosePlan(plan)}>
              {plan.name === 'Free' ? 'Start Free' : plan.name === 'Pro' ? 'Upgrade to Pro' : 'Unlock Premium'}
            </button>
          </article>
        ))}
      </section>

      <section className="upgrade-strip glass-card">
        <div>
          <p className="eyebrow">Billing readiness</p>
          <h2>{upgradeIntent ? `${upgradeIntent.plan} interest saved` : 'Ready for Stripe Checkout next'}</h2>
          <p>
            {upgradeIntent
              ? `Your upgrade preference is saved locally. The next implementation step is connecting this plan to Stripe Checkout and webhook-managed subscription status.`
              : 'The pricing structure is live in the product. Backend auth, Stripe Checkout and subscription webhooks should be connected before charging users.'}
          </p>
        </div>
        <Link className="primary-link" to="/dashboard">Back to Dashboard</Link>
      </section>
    </main>
  );
}

function VaultPage() {
  const [vaultItems, setVaultItems] = useState(loadDealVault);
  const [message, setMessage] = useState('');

  function saveVault(nextVaultItems) {
    setVaultItems(nextVaultItems);
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(nextVaultItems));
  }

  function deleteVaultItem(itemId) {
    saveVault(vaultItems.filter((item) => item.id !== itemId));
  }

  function exportVault() {
    downloadTextFile('acquiraiq-deal-vault.json', JSON.stringify(vaultItems, null, 2), 'application/json');
  }

  function moveVaultItemToPipeline(item) {
    addDealToPipeline(item, 'Analysing');
    setMessage(`${item.title} moved to pipeline`);
  }

  function moveVaultItemToPortfolio(item) {
    addDealToPortfolio(item);
    setMessage(`${item.title} added to portfolio`);
  }

  return (
    <main className="page vault-page">
      <section className="page-hero compact">
        <p className="eyebrow">Deal Vault</p>
        <h1>Your investment evidence</h1>
        <p>Saved deals, notes and scenarios from your local workspace. This becomes the foundation for account-based storage later.</p>
      </section>

      <section className="upgrade-strip glass-card">
        <div>
          <p className="eyebrow">Local vault</p>
          <h2>{vaultItems.length} saved items</h2>
          <p>Export your vault before clearing browser data. Cloud sync should be the next backend milestone.</p>
          {message && <p className="status-message">{message}</p>}
        </div>
        <div className="hero-actions">
          <button className="primary-btn" type="button" onClick={exportVault}>Export Vault</button>
          <Link className="secondary-link" to="/brrr">Add BRRR Deal</Link>
          <Link className="secondary-link" to="/airbnb">Add SA Deal</Link>
        </div>
      </section>

      {vaultItems.length === 0 ? (
        <section className="empty-state">
          <strong>No vault items yet</strong>
          <p>Save a BRRR or serviced accommodation opportunity to start building your investment opportunity database.</p>
        </section>
      ) : (
        <section className="vault-page-grid">
          {vaultItems.map((item) => (
            <article className="vault-record glass-card" key={item.id}>
              <span>{item.type}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
              <div className="vault-record-footer">
                <small>{formatShortDate(new Date(item.createdAt))} · {item.scenario || 'saved'}</small>
                <div className="inline-action-row">
                  <button className="inline-action" type="button" onClick={() => moveVaultItemToPipeline(item)}>Pipeline</button>
                  <button className="inline-action" type="button" onClick={() => moveVaultItemToPortfolio(item)}>Portfolio</button>
                  <button className="inline-danger" type="button" onClick={() => deleteVaultItem(item.id)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function AccountPage() {
  const [account, setAccount] = useState(loadAccount);
  const [email, setEmail] = useState(account?.email || '');
  const [name, setName] = useState(account?.name || '');
  const [syncStatus, setSyncStatus] = useState(loadSyncStatus);
  const [message, setMessage] = useState('');
  const [syncing, setSyncing] = useState(false);

  function saveProfile() {
    const nextAccount = {
      ...(account || {}),
      email: email.trim(),
      name: name.trim(),
      plan: account?.plan || 'Free',
      createdAt: account?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveAccount(nextAccount);
    setAccount(nextAccount);
    setMessage('Account saved');
  }

  async function handleSync() {
    setSyncing(true);
    const nextStatus = await syncWorkspaceToCloud();
    setSyncStatus(nextStatus);
    setSyncing(false);
  }

  function exportWorkspace() {
    downloadTextFile('acquiraiq-workspace-export.json', JSON.stringify(getWorkspacePayload(), null, 2), 'application/json');
    setMessage('Workspace exported');
  }

function clearLocalWorkspace() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(VAULT_STORAGE_KEY);
    localStorage.removeItem(PIPELINE_STORAGE_KEY);
    localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
    localStorage.removeItem(CONTACTS_STORAGE_KEY);
    localStorage.removeItem(UPGRADE_STORAGE_KEY);
    localStorage.removeItem(SYNC_STATUS_STORAGE_KEY);
    setSyncStatus(null);
    setMessage('Local deals, vault items and upgrade intent cleared');
  }

  return (
    <main className="page account-page">
      <section className="page-hero compact">
        <p className="eyebrow">Account</p>
        <h1>Your workspace settings</h1>
        <p>Manage the local beta account, prepare cloud sync and export your workspace data before live authentication is connected.</p>
      </section>

      <section className="account-grid">
        <div className="panel">
          <PanelHeading label="Profile" title="Local Account" meta={account?.plan || 'Free'} />
          <label className="note-entry">
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
          </label>
          <label className="note-entry">
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="investor@example.com" />
          </label>
          <button className="primary-btn" type="button" onClick={saveProfile}>Save Account</button>
          {message && <p className="status-message">{message}</p>}
        </div>

        <div className="panel">
          <PanelHeading label="Cloud sync" title="Supabase Ready" meta={CLOUD_SYNC_ENABLED ? 'Configured' : 'Local only'} />
          <div className="verdict-box">
            <span>Status</span>
            <p>{syncStatus?.message || 'Add Supabase environment variables to sync this workspace to a cloud table.'}</p>
          </div>
          <MiniTable
            title="Required environment"
            rows={[
              { label: 'VITE_SUPABASE_URL', value: SUPABASE_URL ? 'Set' : 'Missing' },
              { label: 'VITE_SUPABASE_ANON_KEY', value: SUPABASE_ANON_KEY ? 'Set' : 'Missing' },
              { label: 'Table', value: 'workspaces' },
            ]}
          />
          <button className="primary-btn" type="button" onClick={handleSync} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync Workspace'}</button>
        </div>

        <div className="panel">
          <PanelHeading label="Data" title="Export and Control" meta="Beta" />
          <p>Export your full workspace as JSON. This supports migration to a real account database later.</p>
          <div className="stacked-actions">
            <button className="secondary-btn" type="button" onClick={exportWorkspace}>Export Workspace</button>
            <button className="danger-btn" type="button" onClick={clearLocalWorkspace}>Clear Local Workspace</button>
          </div>
        </div>
      </section>
    </main>
  );
}

function CalculationsPage() {
  return (
    <main className="page legal-page">
      <section className="page-hero compact">
        <p className="eyebrow">Calculation guide</p>
        <h1>How AcquiraIQ calculates deal metrics</h1>
        <p>Transparent formulas help users understand what the software is showing before they rely on the numbers.</p>
      </section>

      <section className="legal-grid">
        <InfoCard title="Return on total capital invested" copy="Annual cashflow divided by total capital invested, multiplied by 100. This avoids inflated refinance-based ROI." />
        <InfoCard title="BRRR cash-on-cash return" copy="Annual cashflow divided by the cash left in the deal after refinance. If all capital is recovered, AcquiraIQ displays Capital Fully Recycled." />
        <InfoCard title="Gross yield" copy="Annual gross rent divided by purchase price. This is a property performance screen, not investor return." />
        <InfoCard title="Net yield" copy="Annual net operating income divided by total capital invested. Mortgage is excluded so yield remains separate from investor cashflow return." />
        <InfoCard title="Cash left in deal" copy="Total cash invested less the estimated refinance loan. This shows capital still tied up after refinance." />
        <InfoCard title="Equity created" copy="Post-refurb value less total project cost. This is an estimate and should be supported by sold comparables." />
        <InfoCard title="Serviced accommodation profit" copy="Gross monthly revenue minus platform fees, management fees, finance, utilities and cleaning costs." />
        <InfoCard title="Sensitivity analysis" copy="Stress tests show how results change when rent, rates, GDV or occupancy move away from the expected case." />
      </section>

      <section className="trust-section glass-card">
        <SectionHeading
          label="Important"
          title="Estimates, not advice"
          copy="AcquiraIQ is an underwriting aid. Verify rent, GDV, refurb costs, lending terms, tax and local regulation with qualified professionals before committing capital."
        />
      </section>
    </main>
  );
}

function PrivacyPage() {
  return (
    <LegalPage
      label="Privacy"
      title="Privacy Policy"
      copy="This beta version stores workspace data locally in your browser unless cloud sync is configured."
      sections={[
        ['Data we store', 'Email, local account details, saved deals, notes, scenarios, upgrade interest and exported workspace data.'],
        ['Where it is stored', 'By default, data is stored in browser localStorage. If Supabase sync is configured, workspace data can be sent to the configured Supabase project.'],
        ['Payments', 'Stripe or payment processing is not connected yet. Do not enter payment details into AcquiraIQ at this stage.'],
        ['Your controls', 'You can export workspace data from Account or Deal Vault and clear local workspace data from Account.'],
      ]}
    />
  );
}

function TermsPage() {
  return (
    <LegalPage
      label="Terms"
      title="Terms of Use"
      copy="Use AcquiraIQ as decision-support software, not as a substitute for professional advice."
      sections={[
        ['No financial advice', 'AcquiraIQ provides calculations and analysis prompts only. It does not recommend that you buy, sell, refinance or operate any property.'],
        ['User responsibility', 'You are responsible for verifying assumptions, market data, lending terms, tax position and legal obligations.'],
        ['Beta software', 'Features may change while the platform is being prepared for paid subscriptions. Export important data regularly.'],
        ['Future payments', 'Paid plans are shown for product validation. Payment processing is not active until Stripe or another processor is connected.'],
      ]}
    />
  );
}

function NotFinancialAdvicePage() {
  return (
    <LegalPage
      label="Important"
      title="Not Financial Advice"
      copy="AcquiraIQ provides estimates for educational and planning purposes only and does not provide financial advice."
      sections={[
        ['Decision support only', 'The platform helps organise assumptions, calculations and investor notes. It does not decide whether a property is suitable for you.'],
        ['Verify assumptions', 'Rent, GDV/ARV, refurb budgets, finance terms, tax, licensing and local regulation should be checked with appropriate professionals.'],
        ['Your responsibility', 'You remain responsible for investment decisions, due diligence, lender discussions and legal or tax obligations.'],
        ['Why this matters', 'Conservative estimates and transparent assumptions are more useful than marketing-style ROI claims when assessing property risk.'],
      ]}
    />
  );
}

function CookiesPage() {
  return (
    <LegalPage
      label="Cookies"
      title="Cookie Notice"
      copy="The current app uses local browser storage to keep the workspace usable between visits."
      sections={[
        ['Essential storage', 'AcquiraIQ stores account, deals, vault items and upgrade interest locally so the product works without a backend.'],
        ['Analytics', 'No third-party analytics are connected in this build. If analytics are added later, this notice should be updated.'],
        ['Control', 'You can clear local workspace data from the Account page or by clearing browser site data.'],
      ]}
    />
  );
}

function ContactPage() {
  return (
    <main className="page legal-page">
      <section className="page-hero compact">
        <p className="eyebrow">Contact</p>
        <h1>Support and beta feedback</h1>
        <p>Use this page as the public support destination until a dedicated helpdesk is connected.</p>
      </section>

      <section className="account-grid">
        <div className="panel">
          <PanelHeading label="Support" title="Contact Email" meta="Beta" />
          <p>Set up a dedicated inbox such as support@acquiraiq.co.uk before launch and update this page.</p>
          <a className="primary-link" href="mailto:support@acquiraiq.co.uk">Email Support</a>
        </div>
        <div className="panel">
          <PanelHeading label="Feedback" title="What to ask beta users" meta="Useful" />
          <ul className="legal-list">
            <li>Which metric helped you make a decision fastest?</li>
            <li>What would make this worth paying for monthly?</li>
            <li>Which report or export would you send to a broker, partner or lender?</li>
          </ul>
        </div>
      </section>
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
    { title: 'Investor Contacts', copy: 'Manage agents, brokers, sourcers, partners and lender relationships.' },
  ];

  return (
    <main className="page roadmap-page">
      <section className="page-hero compact">
        <p className="eyebrow">Premium roadmap</p>
        <h1>Investor Operating System</h1>
        <p>A roadmap for turning AcquiraIQ from analysis software into a full investment workflow platform.</p>
      </section>

      <section className="module-grid">
        {features.map((feature) => (
          <RoadmapCard key={feature.title} title={feature.title} badge="Premium" copy={feature.copy} />
        ))}
      </section>
    </main>
  );
}

function PortfolioPage() {
  const [properties, setProperties] = useState(loadPortfolioProperties);
  const [forecast, setForecast] = useState({ years: '5', valueGrowth: '3', rentGrowth: '2' });
  const [form, setForm] = useState({
    name: '',
    purchasePrice: '',
    currentValue: '',
    monthlyRent: '',
    mortgageBalance: '',
  });

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function saveProperties(nextProperties) {
    setProperties(nextProperties);
    savePortfolioProperties(nextProperties);
  }

  function addProperty() {
    const propertyName = form.name.trim();
    if (!propertyName) return;
    const property = {
      id: crypto.randomUUID(),
      name: propertyName,
      purchasePrice: toNumber(form.purchasePrice),
      currentValue: toNumber(form.currentValue),
      monthlyRent: toNumber(form.monthlyRent),
      mortgageBalance: toNumber(form.mortgageBalance),
      createdAt: new Date().toISOString(),
    };
    saveProperties([property, ...properties]);
    setForm({ name: '', purchasePrice: '', currentValue: '', monthlyRent: '', mortgageBalance: '' });
  }

  function deleteProperty(propertyId) {
    saveProperties(properties.filter((property) => property.id !== propertyId));
  }

  const totals = properties.reduce(
    (summary, property) => ({
      value: summary.value + toNumber(property.currentValue),
      rent: summary.rent + toNumber(property.monthlyRent),
      equity: summary.equity + Math.max(toNumber(property.currentValue) - toNumber(property.mortgageBalance), 0),
    }),
    { value: 0, rent: 0, equity: 0 },
  );
  const forecastYears = Math.max(toNumber(forecast.years), 0);
  const forecastValue = totals.value * ((1 + toNumber(forecast.valueGrowth) / 100) ** forecastYears);
  const forecastRent = totals.rent * ((1 + toNumber(forecast.rentGrowth) / 100) ** forecastYears);
  const forecastEquity = Math.max(forecastValue - properties.reduce((sum, property) => sum + toNumber(property.mortgageBalance), 0), 0);
  const valueGrowthGained = Math.max(forecastValue - totals.value, 0);
  const rentGrowthGained = Math.max(forecastRent - totals.rent, 0);

  return (
    <main className="page portfolio-page">
      <section className="page-hero compact">
        <p className="eyebrow">Portfolio</p>
        <h1>Portfolio Tracker</h1>
        <p>Track properties, equity, rent and portfolio growth in one workspace.</p>
        <Breadcrumbs items={['Platform', 'Portfolio']} />
      </section>

      <section className="summary-strip">
        <SummaryCard label="Total Portfolio Value" value={formatMoney(totals.value)} copy="Current estimated value across tracked properties." />
        <SummaryCard label="Total Monthly Rent" value={formatMoney(totals.rent)} copy="Gross rent across tracked properties." />
        <SummaryCard label="Estimated Equity" value={formatMoney(totals.equity)} copy="Current value less mortgage balance." />
      </section>

      <section className="workspace-layout">
        <div className="panel">
          <PanelHeading label="Add property" title="Property Details" meta="Local" />
          <label className="note-entry"><span>Name / address</span><input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="12 High Street, Birmingham" /></label>
          <label className="note-entry"><span>Purchase price</span><input type="number" value={form.purchasePrice} onChange={(event) => updateForm('purchasePrice', event.target.value)} /></label>
          <label className="note-entry"><span>Current value</span><input type="number" value={form.currentValue} onChange={(event) => updateForm('currentValue', event.target.value)} /></label>
          <label className="note-entry"><span>Monthly rent</span><input type="number" value={form.monthlyRent} onChange={(event) => updateForm('monthlyRent', event.target.value)} /></label>
          <label className="note-entry"><span>Mortgage balance</span><input type="number" value={form.mortgageBalance} onChange={(event) => updateForm('mortgageBalance', event.target.value)} /><em>Outstanding loan secured against the property, used to estimate equity.</em></label>
          <button className="primary-btn" type="button" onClick={addProperty}>Add Property</button>
        </div>

        <div className="panel">
          <PanelHeading label="Tracked properties" title="Portfolio" meta={`${properties.length} properties`} />
          {properties.length === 0 ? (
            <div className="empty-state">
              <strong>No properties tracked yet</strong>
              <p>Add a property manually or move a saved deal into the portfolio from the Deal Vault.</p>
            </div>
          ) : (
            <div className="vault-list">
              {properties.map((property) => (
                <article className="vault-record" key={property.id}>
                  <span>Property</span>
                  <strong>{property.name}</strong>
                  <div className="record-metrics">
                    <span><small>Current Value</small>{formatMoney(property.currentValue)}</span>
                    <span><small>Monthly Rent</small>{formatMoney(property.monthlyRent)}</span>
                    <span><small>Equity</small>{formatMoney(Math.max(property.currentValue - property.mortgageBalance, 0))}</span>
                    <span><small>Purchase Price</small>{formatMoney(property.purchasePrice)}</span>
                    <span><small>Equity Created</small>{formatMoney(Math.max(property.currentValue - property.purchasePrice, 0))}</span>
                    <span><small>Discount to Market</small>{property.currentValue > 0 ? formatPercent(((property.currentValue - property.purchasePrice) / property.currentValue) * 100) : 'N/A'}</span>
                  </div>
                  <div className="vault-record-footer">
                    <small>{formatShortDate(new Date(property.createdAt))}</small>
                    <button className="inline-danger" type="button" onClick={() => deleteProperty(property.id)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="workspace-layout forecast-layout">
        <div className="panel">
          <PanelHeading label="Growth forecasting" title="Portfolio Forecast" meta="Premium" />
          <label className="note-entry"><span>Forecast years</span><input type="number" value={forecast.years} onChange={(event) => setForecast((current) => ({ ...current, years: event.target.value }))} /></label>
          <label className="note-entry"><span>Annual value growth %</span><input type="number" value={forecast.valueGrowth} onChange={(event) => setForecast((current) => ({ ...current, valueGrowth: event.target.value }))} /></label>
          <label className="note-entry"><span>Annual rent growth %</span><input type="number" value={forecast.rentGrowth} onChange={(event) => setForecast((current) => ({ ...current, rentGrowth: event.target.value }))} /></label>
        </div>
        <div className="summary-strip forecast-summary">
          <SummaryCard label="Forecast Value" value={formatMoney(forecastValue)} copy={`${forecastYears} year estimate based on value growth.`} />
          <SummaryCard label="Forecast Monthly Rent" value={formatMoney(forecastRent)} copy="Projected gross monthly rent." />
          <SummaryCard label="Forecast Equity" value={formatMoney(forecastEquity)} copy="Forecast value less current mortgage balance." />
          <SummaryCard label="Value Growth Gained" value={formatMoney(valueGrowthGained)} copy="Forecast value increase above current portfolio value." />
          <SummaryCard label="Rent Growth Gained" value={formatMoney(rentGrowthGained)} copy="Forecast monthly rent increase above current rent." />
        </div>
      </section>
    </main>
  );
}

function InvestorContactsPage() {
  const [contacts, setContacts] = useState(loadInvestorContacts);
  const [form, setForm] = useState({ name: '', role: 'Agent', email: '', phone: '', notes: '' });

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function saveContacts(nextContacts) {
    setContacts(nextContacts);
    saveInvestorContacts(nextContacts);
  }

  function addContact() {
    if (!form.name.trim()) return;
    saveContacts([{ ...form, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...contacts]);
    setForm({ name: '', role: 'Agent', email: '', phone: '', notes: '' });
  }

  function deleteContact(contactId) {
    saveContacts(contacts.filter((contact) => contact.id !== contactId));
  }

  return (
    <main className="page contacts-page">
      <section className="page-hero compact">
        <p className="eyebrow">Relationships</p>
        <h1>Investor Contacts</h1>
        <p>Keep brokers, agents, sourcers and professional partners connected to your acquisition workflow.</p>
        <Breadcrumbs items={['Platform', 'Investor CRM']} />
      </section>

      <section className="trust-section glass-card">
        <SectionHeading
          label="Investor network"
          title="Relationships support acquisitions and portfolio growth"
          copy="This lightweight CRM is a Premium Preview. It helps you keep deal sources, finance contacts and delivery partners connected to the opportunities you are analysing."
        />
      </section>

      <section className="workspace-layout">
        <div className="panel">
          <PanelHeading label="Add contact" title="Relationship Details" meta="Premium" />
          <label className="note-entry"><span>Name</span><input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="Jane Smith" /></label>
          <label className="note-entry"><span>Role</span><select className="stage-select" value={form.role} onChange={(event) => updateForm('role', event.target.value)}><option>Agent</option><option>Broker</option><option>Sourcer</option><option>Lender</option><option>Solicitor</option><option>Builder</option><option>JV Partner</option></select></label>
          <label className="note-entry"><span>Email</span><input value={form.email} onChange={(event) => updateForm('email', event.target.value)} placeholder="name@example.com" /></label>
          <label className="note-entry"><span>Phone</span><input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="07123 456789" /></label>
          <label className="note-entry"><span>Notes</span><textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} rows="3" placeholder="Area, relationship, recent deal feedback." /></label>
          <button className="primary-btn" type="button" onClick={addContact}>Add Contact</button>
        </div>

        <div className="panel">
          <PanelHeading label="Contacts" title="Relationship List" meta={`${contacts.length} saved`} />
          {contacts.length === 0 ? (
            <div className="empty-state">
              <strong>No contacts yet</strong>
              <p>Add estate agents, sourcers, mortgage brokers, solicitors, builders or joint venture partners to start building an acquisition network.</p>
            </div>
          ) : (
            <div className="vault-list">
              {contacts.map((contact) => (
                <article className="vault-record" key={contact.id}>
                  <span className="role-badge">{contact.role}</span>
                  <strong>{contact.name}</strong>
                  <div className="record-metrics">
                    <span><small>Email</small>{contact.email || 'No email'}</span>
                    <span><small>Phone</small>{contact.phone || 'No phone'}</span>
                  </div>
                  {contact.notes && <p className="saved-note">{contact.notes}</p>}
                  <div className="vault-record-footer">
                    <small>{formatShortDate(new Date(contact.createdAt))}</small>
                    <button className="inline-danger" type="button" onClick={() => deleteContact(contact.id)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function PipelinePage() {
  const stages = ['Lead', 'Analysing', 'Offered', 'Under Offer', 'Purchased'];
  const stageDescriptions = {
    Lead: 'New opportunities identified.',
    Analysing: 'Deals being reviewed.',
    Offered: 'Offers submitted.',
    'Under Offer': 'Deals progressing through due diligence.',
    Purchased: 'Completed acquisitions ready for Portfolio.',
  };
  const [pipelineDeals, setPipelineDeals] = useState(loadPipelineDeals);
  const [form, setForm] = useState({ title: '', askingPrice: '', source: '', notes: '' });

  function updateForm(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function savePipeline(nextDeals) {
    setPipelineDeals(nextDeals);
    savePipelineDeals(nextDeals);
  }

  function addPipelineDeal() {
    const cleanTitle = form.title.trim();
    if (!cleanTitle) return;
    const now = new Date().toISOString();
    savePipeline([
      {
        id: crypto.randomUUID(),
        title: cleanTitle,
        askingPrice: toNumber(form.askingPrice),
        source: form.source.trim(),
        notes: form.notes.trim(),
        stage: 'Lead',
        strategy: 'Manual',
        dateAdded: now,
        updatedAt: now,
      },
      ...pipelineDeals,
    ]);
    setForm({ title: '', askingPrice: '', source: '', notes: '' });
  }

  function updateStage(dealId, stage) {
    savePipeline(pipelineDeals.map((deal) => (deal.id === dealId ? { ...deal, stage, updatedAt: new Date().toISOString() } : deal)));
  }

  function deletePipelineDeal(dealId) {
    savePipeline(pipelineDeals.filter((deal) => deal.id !== dealId));
  }

  function movePipelineDealToPortfolio(deal) {
    addDealToPortfolio({
      id: deal.sourceDealId || deal.id,
      name: deal.title,
      metrics: { refinanceLoan: 0 },
      inputs: { purchasePrice: deal.askingPrice },
    });
    updateStage(deal.id, 'Purchased');
  }

  const pipelineSummary = pipelineDeals.reduce(
    (summary, deal) => ({
      active: summary.active + (deal.stage !== 'Purchased' ? 1 : 0),
      offered: summary.offered + (deal.stage === 'Offered' ? 1 : 0),
      underOffer: summary.underOffer + (deal.stage === 'Under Offer' ? 1 : 0),
      purchased: summary.purchased + (deal.stage === 'Purchased' ? 1 : 0),
      value: summary.value + toNumber(deal.askingPrice),
    }),
    { active: 0, offered: 0, underOffer: 0, purchased: 0, value: 0 },
  );

  return (
    <main className="page pipeline-page">
      <section className="page-hero compact">
        <p className="eyebrow">Acquisition Workflow</p>
        <h1>Deal Pipeline</h1>
        <p>Move opportunities from lead to purchased through a structured acquisition process.</p>
        <Breadcrumbs items={['Platform', 'Pipeline']} />
      </section>

      <section className="summary-strip">
        <SummaryCard label="Active Opportunities" value={String(pipelineSummary.active)} copy="Deals not yet marked as purchased." />
        <SummaryCard label="Offers Submitted" value={String(pipelineSummary.offered)} copy="Deals currently at offer submitted stage." />
        <SummaryCard label="Under Offer" value={String(pipelineSummary.underOffer)} copy="Deals progressing through due diligence." />
        <SummaryCard label="Purchased" value={String(pipelineSummary.purchased)} copy="Completed acquisitions ready for Portfolio." />
        <SummaryCard label="Estimated Pipeline Value" value={formatMoney(pipelineSummary.value)} copy="Total asking price across pipeline records." />
      </section>

      <section className="upgrade-strip glass-card">
        <div>
          <p className="eyebrow">Add lead</p>
          <h2>Capture an opportunity quickly</h2>
          <p>Add sourced opportunities here, or move saved analyzer deals from BRRR, SA or Deal Vault.</p>
        </div>
        <div className="pipeline-form">
          <label className="note-entry"><span>Property Name / Address</span><input className="pipeline-input" value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="Liverpool SA Opportunity" /></label>
          <label className="note-entry"><span>Asking price</span><input className="pipeline-input" type="number" value={form.askingPrice} onChange={(event) => updateForm('askingPrice', event.target.value)} placeholder="200000" /></label>
          <label className="note-entry"><span>Source</span><input className="pipeline-input" value={form.source} onChange={(event) => updateForm('source', event.target.value)} placeholder="Agent, sourcer, auction, Rightmove" /></label>
          <label className="note-entry"><span>Notes</span><textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} rows="3" placeholder="Initial view, risks, follow-up actions." /></label>
          <button className="primary-btn" type="button" onClick={addPipelineDeal}>Add Lead</button>
        </div>
      </section>

      <section className="pipeline-board">
        {stages.map((stage) => (
          <div className="pipeline-column panel" key={stage}>
            <PanelHeading label="Stage" title={stage} meta={`${pipelineDeals.filter((deal) => deal.stage === stage).length}`} />
            <p className="stage-description">{stageDescriptions[stage]}</p>
            <div className="vault-list">
              {pipelineDeals.filter((deal) => deal.stage === stage).length === 0 ? (
                <div className="empty-state compact-empty">
                  <strong>No {stage.toLowerCase()} deals</strong>
                  <p>Move an opportunity here when it reaches this stage.</p>
                </div>
              ) : pipelineDeals.filter((deal) => deal.stage === stage).map((deal) => (
                <article className="vault-record" key={deal.id}>
                  <span>{deal.strategy || 'Deal'}</span>
                  <strong>{deal.title}</strong>
                  <p>{deal.monthlyProfit === null || deal.monthlyProfit === undefined ? 'No profit model attached yet.' : `${formatMoney(deal.monthlyProfit)} monthly profit`}</p>
                  <div className="record-metrics">
                    <span><small>Asking price</small>{deal.askingPrice ? formatMoney(toNumber(deal.askingPrice)) : 'Not set'}</span>
                    <span><small>Source</small>{deal.source || 'Not set'}</span>
                    <span><small>Date added</small>{formatShortDate(new Date(deal.dateAdded || deal.updatedAt))}</span>
                  </div>
                  {deal.notes && <p className="saved-note">{deal.notes}</p>}
                  <select className="stage-select" value={deal.stage} onChange={(event) => updateStage(deal.id, event.target.value)}>
                    {stages.map((option) => <option value={option} key={option}>{option}</option>)}
                  </select>
                  <div className="vault-record-footer">
                    <button className="inline-danger" type="button" onClick={() => deletePipelineDeal(deal.id)}>Delete</button>
                    {deal.stage === 'Purchased' ? (
                      <button className="inline-action" type="button" onClick={() => movePipelineDealToPortfolio(deal)}>Move To Portfolio</button>
                    ) : (
                      <small>{formatShortDate(new Date(deal.updatedAt))}</small>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function InputSections({ groupedFields, inputs, updateInput }) {
  function handleNumericChange(field, value) {
    if (value === '') {
      updateInput(field.name, '');
      return;
    }

    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) return;
    if (nextValue > field.max) {
      updateInput(field.name, String(field.max));
      return;
    }
    if (nextValue < 0) {
      updateInput(field.name, '0');
      return;
    }
    updateInput(field.name, value);
  }

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
                inputMode="decimal"
                value={inputs[field.name]}
                onChange={(event) => handleNumericChange(field, event.target.value)}
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

function DealIdentityForm({ dealName, setDealName, dealNote, setDealNote }) {
  return (
    <div className="deal-identity">
      <label className="note-entry">
        <span>Deal name</span>
        <input
          value={dealName}
          onChange={(event) => setDealName(event.target.value)}
          placeholder="12 High Street, Birmingham"
        />
      </label>
      <label className="note-entry">
        <span>Deal notes</span>
        <textarea
          value={dealNote}
          onChange={(event) => setDealNote(event.target.value)}
          placeholder="Add source, viewing notes, assumptions or broker feedback."
          rows="3"
        />
      </label>
    </div>
  );
}

function AnalysisTabs({ activeTab, setActiveTab, hideSaved = false }) {
  const tabs = [
    ['overview', 'Overview'],
    ['verdict', 'Investor Verdict'],
    ['sensitivity', 'Sensitivity'],
    ['comparison', 'Comparison'],
    ['saved', 'Saved Deal'],
  ].filter(([key]) => !(hideSaved && key === 'saved'));

  return (
    <div className="analysis-tabs" role="tablist" aria-label="Analysis sections">
      {tabs.map(([key, label]) => (
        <button
          className={activeTab === key ? 'analysis-tab active' : 'analysis-tab'}
          type="button"
          key={key}
          onClick={() => setActiveTab(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
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
      <PanelHeading label="Investor Verdict Engine" title="Decision Summary" meta="Live" />
      <div className="verdict-box">
        <span>Overall Verdict</span>
        <p>{verdict.overallVerdict}</p>
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
          <span>Best Strategy</span>
          <p>{verdict.bestStrategy}</p>
        </div>
        <div>
          <span>Investor Suitability</span>
          <p>{verdict.investorSuitability}</p>
        </div>
      </div>
      <div className="verdict-sections">
        <HealthColumn title="Strengths" items={verdict.strengths || []} empty="No clear strengths identified yet." />
        <HealthColumn title="Risks" items={verdict.risks || []} empty="No major risks flagged from current inputs." />
        <HealthColumn title="Opportunities" items={verdict.opportunities || []} empty="No opportunities flagged yet." />
        <HealthColumn title="Benchmark Insights" items={verdict.benchmarkInsights || []} empty="Add more assumptions to unlock benchmarks." />
        <HealthColumn title="Recommendations" items={verdict.recommendations || []} empty="No recommendations available yet." />
      </div>
    </div>
  );
}

function StrategyComparisonPanel({ comparison }) {
  return (
    <div className="panel strategy-panel">
      <PanelHeading label="Strategy Comparison" title="BRRR vs SA vs BTL" meta="Decision view" />
      <div className="recommendation-card">
        <span>Recommended Strategy</span>
        <strong>{comparison.recommendation}</strong>
        <p>Recommendation is based on the available metrics in this module. Complete the other analyzers before making a final investment decision.</p>
      </div>
      <div className="strategy-compare-list">
        {comparison.rows.map((row) => (
          <div className={row.strategy === comparison.recommendation ? 'strategy-row recommended' : 'strategy-row'} key={row.strategy}>
            <strong>{row.strategy}</strong>
            <span>Monthly Profit: {row.monthlyProfit === null ? 'Model separately' : formatMoney(row.monthlyProfit)}</span>
            <span>Yield: {row.yield === null ? 'N/A' : formatPercent(row.yield)}</span>
            <span>Return: {row.roi === null ? 'N/A' : formatPercent(row.roi)}</span>
            <span>Risk: {row.risk}</span>
            <span>Capital Left: {row.capitalLeft === null ? 'N/A' : formatMoney(row.capitalLeft)}</span>
          </div>
        ))}
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
            <div>
              <span>{item.label}</span>
              <p>{item.explanation}</p>
            </div>
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
      <p>Saved scenarios, notes and print-ready PDF reports form the decision record for this opportunity.</p>
      <div>
        <small>Advanced scenario analysis · Pro</small>
        <small>PDF investment reports · Pro</small>
      </div>
    </div>
  );
}

function PremiumPreview({ title, copy, label = 'Future upgrade' }) {
  return (
    <article className="premium-preview-card">
      <span>{label}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}

function RoadmapBlock() {
  return (
    <section className="roadmap-block glass-card">
      <SectionHeading
        label="Workflow"
        title="Investor workflow"
        copy="AcquiraIQ connects analysis, saved evidence, acquisition stages and portfolio tracking in one operating system."
      />
      <div className="roadmap-columns">
        <RoadmapColumn title="Analyse Deal" items={['BRRR Analyzer', 'SA Analyzer', 'Investor Verdict', 'Sensitivity testing']} />
        <RoadmapColumn title="Manage Opportunity" items={['Named saved deals', 'Deal Vault', 'Acquisition Pipeline', 'Notes and scenarios']} />
        <RoadmapColumn title="Track Portfolio" items={['Portfolio Tracker', 'Growth forecast', 'Investor contacts', 'Property records']} />
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
        copy="A flagship decision layer for comparing BRRR, SA and BTL using profit, yield, return, capital position and risk."
      />
      <div className="recommendation-card platform-recommendation">
        <span>Recommended Strategy</span>
        <strong>Generated from analyzer outputs</strong>
        <p>As users complete each module, AcquiraIQ can recommend the strategy with the strongest risk-adjusted profile.</p>
      </div>
      <div className="strategy-table">
        <div><strong>Strategy</strong><strong>Monthly Profit</strong><strong>Yield</strong><strong>Return</strong><strong>Capital Left In</strong><strong>Risk Level</strong></div>
        <div><span>BRRR</span><span>From analyzer</span><span>Live</span><span>Live</span><span>Live</span><span>Moderate</span></div>
        <div><span>SA</span><span>From analyzer</span><span>Live</span><span>Estimate</span><span>N/A</span><span>Higher ops</span></div>
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
        copy="The first Deal Vault now stores saved deals, scenarios and investor notes locally, ready to evolve into a full diligence record."
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

function DealVaultPanel({ vaultItems, saveScenario, noteDraft, setNoteDraft, addNote, deleteVaultItem, exportVault }) {
  return (
    <div className="deal-vault-panel">
      <div className="vault-actions">
        <button className="secondary-btn" type="button" onClick={saveScenario}>
          Save Scenario
        </button>
        <button className="secondary-btn" type="button" onClick={exportVault}>
          Export Vault
        </button>
      </div>
      <label className="note-entry">
        <span>Add Notes</span>
        <textarea
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          placeholder="Add viewing notes, valuation assumptions, broker feedback or due-diligence questions."
          rows="4"
        />
      </label>
      <button className="secondary-btn" type="button" onClick={addNote}>
        Add Note
      </button>

      {vaultItems.length === 0 ? (
        <div className="empty-state">
          <strong>Deal Vault is empty</strong>
          <p>Save a deal, save a scenario or add an investor note to build a decision record.</p>
        </div>
      ) : (
        <div className="vault-list">
          {vaultItems.slice(0, 5).map((item) => (
            <article className="vault-record" key={item.id}>
              <span>{item.type}</span>
              <strong>{item.title}</strong>
              <p>{item.copy}</p>
              <div className="vault-record-footer">
                <small>{formatShortDate(new Date(item.createdAt))} · {item.scenario || 'saved'}</small>
                <button className="inline-danger" type="button" onClick={() => deleteVaultItem(item.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function SavedDealsList({ savedDeals, activeDealId, loadDeal, deleteDeal, renameDeal, addDealNote, moveToPipeline, moveToPortfolio }) {
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
          <SavedDealCard
            key={deal.id}
            deal={deal}
            active={deal.id === activeDealId}
            savedMetrics={savedMetrics}
            rating={rating}
            loadDeal={loadDeal}
            deleteDeal={deleteDeal}
            renameDeal={renameDeal}
            addDealNote={addDealNote}
            moveToPipeline={moveToPipeline}
            moveToPortfolio={moveToPortfolio}
          />
        );
      })}
    </div>
  );
}

function SavedDealCard({ deal, active, savedMetrics, rating, loadDeal, deleteDeal, renameDeal, addDealNote, moveToPipeline, moveToPortfolio }) {
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(deal.name || '');
  const [noteDraft, setNoteDraft] = useState(deal.notes || '');

  function saveRename() {
    renameDeal?.(deal.id, nameDraft);
    setEditing(false);
  }

  function saveNote() {
    addDealNote?.(deal.id, noteDraft);
  }

  return (
    <article className={active ? 'saved-deal active' : 'saved-deal'}>
            <div className="saved-main">
              <div>
          {editing ? (
            <input className="inline-edit" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} />
          ) : (
            <h3>{deal.name}</h3>
          )}
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
                <small>Total Capital Return</small>
                {formatPercent(savedMetrics.returnOnTotalCapitalInvested ?? savedMetrics.cashOnCashRoi)}
              </span>
            </div>

      {deal.notes && <p className="saved-note">{deal.notes}</p>}

      {editing && (
        <label className="note-entry">
          <span>Deal note</span>
          <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows="3" />
        </label>
      )}

            <div className="saved-actions">
              <button className="secondary-btn" type="button" onClick={() => loadDeal(deal)}>
                Load
              </button>
        {editing ? (
          <button className="secondary-btn" type="button" onClick={saveRename}>
            Save Name
          </button>
        ) : (
          <button className="secondary-btn" type="button" onClick={() => setEditing(true)}>
            Rename
          </button>
        )}
        <button className="secondary-btn" type="button" onClick={() => moveToPipeline?.(deal)}>
          Move To Pipeline
        </button>
        <button className="secondary-btn" type="button" onClick={() => moveToPortfolio?.(deal)}>
          Add To Portfolio
        </button>
        {editing && (
          <button className="secondary-btn" type="button" onClick={saveNote}>
            Save Note
          </button>
        )}
              <button className="danger-btn" type="button" onClick={() => deleteDeal(deal.id)}>
                Delete
              </button>
            </div>
          </article>
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

function InfoCard({ title, copy }) {
  return (
    <article className="info-card glass-card">
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}

function LegalPage({ label, title, copy, sections }) {
  return (
    <main className="page legal-page">
      <section className="page-hero compact">
        <p className="eyebrow">{label}</p>
        <h1>{title}</h1>
        <p>{copy}</p>
      </section>
      <section className="legal-grid">
        {sections.map(([sectionTitle, sectionCopy]) => (
          <InfoCard title={sectionTitle} copy={sectionCopy} key={sectionTitle} />
        ))}
      </section>
    </main>
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

function ChecklistItem({ done, title, copy }) {
  return (
    <article className={done ? 'checklist-item done' : 'checklist-item'}>
      <span>{done ? 'Done' : 'Next'}</span>
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

function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={item}>
          {index > 0 && <i>/</i>}
          {item}
        </span>
      ))}
    </nav>
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
      <span className="module-action muted static">Roadmap preview</span>
    </article>
  );
}

function DealComparisonPreview() {
  const rows = ['Cashflow', 'Yield', 'Return', 'Risk', 'Capital Left In'];

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
    <div className="summary-card" title={copy}>
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
    <div className={highlight ? 'metric highlight' : 'metric'} title={note || label}>
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
