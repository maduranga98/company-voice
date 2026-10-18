/**
 * Company Billing Page
 * Manages subscription, invoices, payment methods, and usage tracking
 */

import { useState, useEffect } from 'react';
import PageHeader, { PageContainer, PageLoading } from '../../components/PageHeader';
import { CreditCard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { auth, db } from '../../config/firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';
import {
  getSubscription,
  createCheckoutSession,
  syncCheckoutSession,
  cancelSubscription,
  reactivateSubscription,
  getInvoices,
  getPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  updateDeclaredEmployeeCount,
  getPaymentHistory,
  getUsageSummary,
  createPaymentMethod as createPaymentMethodUtil,
  formatCurrency,
  formatDate,
  getStatusColor,
  getPaymentStatusColor,
} from '../../services/billingService';

// Loaded on first render of the billing page, not at import time, so visitors to the
// public report form never contact Stripe.
let stripePromise = null;
const getStripePromise = () => {
  stripePromise ??= loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
  return stripePromise;
};

function CompanyBilling() {
  return (
    <Elements stripe={getStripePromise()}>
      <CompanyBillingContent />
    </Elements>
  );
}

function CompanyBillingContent() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [usageSummary, setUsageSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showEmployeeCountModal, setShowEmployeeCountModal] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeMemberCount, setActiveMemberCount] = useState(null);

  const companyId = currentUser?.companyId;

  // Billing basis: declared count, floored by the verified (policy acknowledgement) count
  const declaredCount = subscription?.declaredUserCount ?? 0;
  const verifiedCount =
    subscription?.liveVerifiedAcknowledgedCount ?? subscription?.verifiedAcknowledgedCount ?? 0;
  const willAutoAdjust = verifiedCount > declaredCount;
  const billedCount = subscription?.currentUserCount ?? Math.max(declaredCount, verifiedCount);
  const pricePerUser = subscription?.pricePerUser || 1.0;

  useEffect(() => {
    if (!companyId) return;

    // Returning from Stripe Checkout: record the subscription, then load the page data
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    const sessionId = params.get('session_id');
    if (checkout) window.history.replaceState({}, '', window.location.pathname);

    (async () => {
      if (checkout === 'success' && sessionId) {
        try {
          await syncCheckoutSession(sessionId);
          setSuccess('Subscription created successfully');
        } catch (err) {
          console.error('Error syncing checkout session:', err);
          setError(err.message);
        }
      } else if (checkout === 'canceled') {
        setError('Checkout was canceled. No subscription was started.');
      }
      loadBillingData();
    })();
  }, [companyId]);

  async function loadBillingData() {
    try {
      setLoading(true);
      setError(null);

      // Ensure Firebase Auth is ready before making API calls
      if (!auth.currentUser) {
        console.error('Cannot load billing data: Firebase Auth user not available');
        setError('Authentication not ready. Please refresh the page.');
        return;
      }

      // Force token refresh to ensure Firebase Functions can authenticate the request
      try {
        await auth.currentUser.getIdToken(true);
      } catch (tokenError) {
        console.error('Error refreshing ID token:', tokenError);
        setError('Authentication token refresh failed. Please refresh the page.');
        return;
      }

      const [subData, invoicesData, methodsData, historyData, usageData] = await Promise.all([
        getSubscription(companyId),
        getInvoices(companyId, { limit: 50 }),
        getPaymentMethods(companyId),
        getPaymentHistory(companyId, { limit: 50 }),
        getUsageSummary(companyId),
      ]);

      setSubscription(subData?.data);
      setInvoices(invoicesData?.data || []);
      setPaymentMethods(methodsData?.data || []);
      setPaymentHistory(historyData?.data || []);
      setUsageSummary(usageData?.data);

      // Fetch active member count directly from Firestore as a reliable fallback
      try {
        const membersQuery = query(
          collection(db, "users"),
          where("companyId", "==", companyId),
          where("status", "==", "active")
        );
        const countSnapshot = await getCountFromServer(membersQuery);
        setActiveMemberCount(countSnapshot.data().count);
      } catch (countErr) {
        console.error('Error fetching active member count:', countErr);
      }
    } catch (err) {
      console.error('Error loading billing data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelSubscription(immediate = false) {
    if (!subscription) return;

    try {
      setLoading(true);
      setError(null);

      // Ensure ID token is fresh before making API call
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }

      await cancelSubscription(subscription.id, immediate);
      setSuccess(`Subscription ${immediate ? 'canceled immediately' : 'will be canceled at period end'}`);
      setShowCancelModal(false);
      await loadBillingData();
    } catch (err) {
      console.error('Error canceling subscription:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEmployeeCount(count) {
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
    }
    await updateDeclaredEmployeeCount(companyId, count);
    setSuccess('Employee count updated successfully');
    setShowEmployeeCountModal(false);
    await loadBillingData();
  }

  async function handleReactivateSubscription() {
    if (!subscription) return;

    try {
      setLoading(true);
      setError(null);

      // Ensure ID token is fresh before making API call
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }

      await reactivateSubscription(subscription.id);
      setSuccess('Subscription reactivated successfully');
      await loadBillingData();
    } catch (err) {
      console.error('Error reactivating subscription:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !subscription) {
    return (
      <PageLoading label="Loading billing information..." />
    );
  }

  return (
    <PageContainer>
        <PageHeader
          icon={CreditCard}
          title="Billing & Subscription"
          subtitle="Manage your subscription, invoices, and payment methods"
        />

        {/* Alert Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{error}</span>
            <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
              <span className="text-xl">&times;</span>
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{success}</span>
            <button onClick={() => setSuccess(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
              <span className="text-xl">&times;</span>
            </button>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Declared Employees */}
          <div className="bg-background-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Declared Employees</p>
              <p className="text-3xl font-bold text-gray-900">{subscription ? declaredCount : '—'}</p>
              {subscription && (
                <button
                  onClick={() => setShowEmployeeCountModal(true)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 mt-0.5"
                >
                  Update
                </button>
              )}
            </div>
          </div>

          {/* Verified (Policy Ack) */}
          <div className="bg-background-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Verified (Policy Ack)</p>
              <p className="text-3xl font-bold text-gray-900">{subscription ? verifiedCount : '—'}</p>
              <p className="text-xs text-gray-400 mt-0.5">Billing floor</p>
            </div>
          </div>

          {/* Monthly Amount */}
          <div className="bg-background-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Monthly Amount</p>
              <p className="text-3xl font-bold text-gray-900">
                {subscription ? formatCurrency((subscription.currentUserCount || 0) * pricePerUser) : '—'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {subscription ? `${subscription.currentUserCount || 0} × ${formatCurrency(pricePerUser)} / month` : 'No subscription'}
              </p>
            </div>
          </div>
        </div>

        {/* Auto-adjust Warning */}
        {subscription && willAutoAdjust && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start justify-between gap-4">
            <p className="text-sm text-yellow-800">
              <span className="font-medium">Verified employees exceed your declared count.</span>{' '}
              {verifiedCount} employees have acknowledged a policy but you declared {declaredCount}. Your declared
              count will be automatically increased to {verifiedCount} (it is never lowered automatically).
            </p>
            <button
              onClick={() => setShowEmployeeCountModal(true)}
              className="text-sm font-medium text-yellow-900 underline whitespace-nowrap"
            >
              Update employee count
            </button>
          </div>
        )}

        {/* Subscription Status Banner */}
        {subscription && (
          <div className="bg-background-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3">
                  <h2 className="text-xl font-semibold text-gray-900">Subscription Status</h2>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription.status)}`}>
                    {subscription.status?.toUpperCase()}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <p>
                    Current Users: <span className="font-medium text-gray-900">{billedCount}</span> billed
                    <span className="text-gray-500"> ({declaredCount} declared, {verifiedCount} verified)</span>
                  </p>
                  <p>Next Billing: <span className="font-medium text-gray-900">{formatDate(subscription.currentPeriodEnd)}</span></p>
                  <p>Amount: <span className="font-medium text-gray-900">{formatCurrency((billedCount || 0) * pricePerUser)}</span></p>
                </div>
              </div>
              <div className="flex space-x-3">
                {subscription.status === 'active' ? (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                  >
                    Cancel Subscription
                  </button>
                ) : subscription.status === 'canceled' ? (
                  <button
                    onClick={handleReactivateSubscription}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    disabled={loading}
                  >
                    Reactivate Subscription
                  </button>
                ) : null}
              </div>
            </div>

            {/* Grace Period Warning */}
            {subscription.gracePeriodEndsAt && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="ml-3 text-sm text-yellow-700">
                    <span className="font-medium">Payment Failed:</span> Your subscription is in grace period until {formatDate(subscription.gracePeriodEndsAt)}. Please update your payment method.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Subscription State */}
        {!subscription && (
          <div className="bg-background-white rounded-lg shadow-sm p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No Active Subscription</h3>
            <p className="mt-1 text-sm text-gray-500">Start a subscription to access all features</p>
            <button
              onClick={() => setShowAddPaymentModal(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Start Subscription
            </button>
          </div>
        )}

        {/* Tabs */}
        {subscription && (
          <div className="mt-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {['overview', 'invoices', 'payment-methods', 'usage', 'history'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`${
                      activeTab === tab
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
                  >
                    {tab.replace('-', ' ')}
                  </button>
                ))}
              </nav>
            </div>

            <div className="mt-6">
              {activeTab === 'overview' && <OverviewTab subscription={subscription} usageSummary={usageSummary} activeMemberCount={activeMemberCount} verifiedCount={verifiedCount} />}
              {activeTab === 'invoices' && <InvoicesTab invoices={invoices} />}
              {activeTab === 'payment-methods' && (
                <PaymentMethodsTab
                  paymentMethods={paymentMethods}
                  onAdd={() => setShowAddPaymentModal(true)}
                  onRemove={async (id) => {
                    try {
                      // Ensure ID token is fresh before making API call
                      if (auth.currentUser) {
                        await auth.currentUser.getIdToken(true);
                      }
                      await removePaymentMethod(id);
                      setSuccess('Payment method removed');
                      loadBillingData();
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                />
              )}
              {activeTab === 'usage' && <UsageTab usageSummary={usageSummary} />}
              {activeTab === 'history' && <PaymentHistoryTab paymentHistory={paymentHistory} />}
            </div>
          </div>
        )}

      {subscription && activeMemberCount !== null && (
        <p className="text-xs text-gray-400">
          Active platform accounts: {activeMemberCount} (informational, not billed)
        </p>
      )}

      {/* Update Employee Count Modal */}
      {showEmployeeCountModal && (
        <UpdateEmployeeCountModal
          currentCount={declaredCount}
          verifiedCount={verifiedCount}
          onClose={() => setShowEmployeeCountModal(false)}
          onSave={handleSaveEmployeeCount}
        />
      )}

      {/* Add Payment Method Modal */}
      {showAddPaymentModal && (
        <AddPaymentMethodModal
          companyId={companyId}
          subscription={subscription}
          onClose={() => setShowAddPaymentModal(false)}
          onSuccess={() => {
            setSuccess(subscription ? 'Payment method added successfully' : 'Subscription created successfully');
            setShowAddPaymentModal(false);
            loadBillingData();
          }}
          onError={setError}
        />
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <CancelSubscriptionModal
          onClose={() => setShowCancelModal(false)}
          onCancel={handleCancelSubscription}
        />
      )}
    </PageContainer>
  );
}

// Tab Components

function OverviewTab({ subscription, usageSummary, activeMemberCount, verifiedCount }) {
  const billedCount = subscription?.currentUserCount ?? 0;
  const declaredCount = subscription?.declaredUserCount ?? 0;
  const pricePerUser = subscription?.pricePerUser || 1.00;
  const monthlyCost = billedCount * pricePerUser;

  const kpiCards = [
    {
      label: "Declared Employees",
      value: declaredCount,
      sub: "Set by company admin",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-100",
    },
    {
      label: "Verified (Policy Ack)",
      value: verifiedCount,
      sub: "Minimum billable seats",
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
    {
      label: "Monthly Cost",
      value: formatCurrency(monthlyCost),
      sub: `${billedCount} × ${formatCurrency(pricePerUser)} per user`,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
    },
    {
      label: "Price Per User",
      value: formatCurrency(pricePerUser),
      sub: "Per seat / month",
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
    },
    {
      label: "Next Billing Date",
      value: subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : "—",
      sub: "Renewal date",
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map(({ label, value, sub, color, bg, border }) => (
          <div key={label} className={`rounded-xl border ${border} ${bg} p-4`}>
            <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${color} leading-tight`}>{value}</p>
            <p className="text-[10px] text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-background-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Current Billing Period</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Period Start:</span>
              <span className="font-medium">{formatDate(subscription.currentPeriodStart)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Period End:</span>
              <span className="font-medium">{formatDate(subscription.currentPeriodEnd)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Declared Employees:</span>
              <span className="font-medium">{declaredCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Verified (Policy Ack):</span>
              <span className="font-medium">{verifiedCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Billed Seats:</span>
              <span className="font-medium">{billedCount}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Active platform accounts (informational, not billed):</span>
              <span>{activeMemberCount != null ? activeMemberCount : "—"}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-3 mt-3">
              <span className="text-gray-600 font-medium">Total Payable:</span>
              <span className="font-bold text-gray-900">{formatCurrency(monthlyCost)}</span>
            </div>
            {usageSummary?.prorationAmount !== 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Proration:</span>
                <span className={`font-medium ${usageSummary.prorationAmount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(usageSummary.prorationAmount))}
                  {usageSummary.prorationAmount > 0 ? ' credit' : ' charge'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-background-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Stats</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Subscription Created</p>
              <p className="text-lg font-semibold">{formatDate(subscription.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Billing Cycle</p>
              <p className="text-lg font-semibold">Monthly</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Price Per User</p>
              <p className="text-lg font-semibold">{formatCurrency(subscription.pricePerUser || 1.00)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoicesTab({ invoices }) {
  return (
    <div className="bg-background-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Invoice History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-background-white divide-y divide-gray-200">
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(invoice.createdAt)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{invoice.invoiceNumber}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatCurrency(invoice.total)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPaymentStatusColor(invoice.status)}`}>
                    {invoice.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {invoice.invoicePdfUrl && (
                    <a href={invoice.invoicePdfUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">
                      Download PDF
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No invoices yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentMethodsTab({ paymentMethods, onAdd, onRemove }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Payment Methods</h3>
        <button onClick={onAdd} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          Add Payment Method
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {paymentMethods.map((method) => (
          <div key={method.id} className="bg-background-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {method.card?.brand?.toUpperCase() || method.bankAccount?.bankName || 'Payment Method'} •••• {method.card?.last4 || method.bankAccount?.last4 || '****'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {method.card && `Expires ${method.card.expiryMonth}/${method.card.expiryYear}`}
                    {method.bankAccount && `Bank Account`}
                  </p>
                </div>
              </div>
              {method.isDefault && (
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">Default</span>
              )}
            </div>
            {!method.isDefault && (
              <button
                onClick={() => onRemove(method.id)}
                className="mt-4 text-sm text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {paymentMethods.length === 0 && (
        <div className="bg-background-white rounded-lg shadow-sm p-12 text-center">
          <p className="text-gray-500">No payment methods added</p>
        </div>
      )}
    </div>
  );
}

function UsageTab({ usageSummary }) {
  if (!usageSummary) {
    return <div className="text-center py-12 text-gray-500">Loading usage data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-background-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Current Period Usage</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Users Added</p>
            <p className="text-2xl font-bold text-green-600">{usageSummary.usersAdded || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Users Removed</p>
            <p className="text-2xl font-bold text-red-600">{usageSummary.usersRemoved || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Net Change</p>
            <p className={`text-2xl font-bold ${(usageSummary.usersAdded - usageSummary.usersRemoved) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {usageSummary.usersAdded - usageSummary.usersRemoved > 0 ? '+' : ''}
              {(usageSummary.usersAdded || 0) - (usageSummary.usersRemoved || 0)}
            </p>
          </div>
        </div>
      </div>

      {usageSummary.usageEvents && usageSummary.usageEvents.length > 0 && (
        <div className="bg-background-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Usage Events</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proration</th>
                </tr>
              </thead>
              <tbody className="bg-background-white divide-y divide-gray-200">
                {usageSummary.usageEvents.map((event, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(event.timestamp)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${event.eventType === 'user_added' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {event.eventType === 'user_added' ? 'Added' : 'Removed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{event.userId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(event.prorationAmount || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentHistoryTab({ paymentHistory }) {
  return (
    <div className="bg-background-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Payment History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
            </tr>
          </thead>
          <tbody className="bg-background-white divide-y divide-gray-200">
            {paymentHistory.map((payment) => (
              <tr key={payment.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(payment.attemptedAt)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatCurrency(payment.amount)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPaymentStatusColor(payment.status)}`}>
                    {payment.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {payment.paymentMethod?.last4 ? `•••• ${payment.paymentMethod.last4}` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {paymentHistory.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No payment history</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Modals

function AddPaymentMethodModal({ companyId, subscription, onClose, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [startTrial, setStartTrial] = useState(false);
  const [employeeCount, setEmployeeCount] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();

    const declaredUserCount = Number(employeeCount);
    if (!subscription && (!Number.isInteger(declaredUserCount) || declaredUserCount <= 0)) {
      onError('Number of employees must be a positive whole number');
      return;
    }
    if (subscription && (!stripe || !elements)) {
      return;
    }

    try {
      setLoading(true);

      // Ensure ID token is fresh before making API call
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }

      // New subscription: card details are entered on Stripe's hosted Checkout page
      if (!subscription) {
        const { url } = await createCheckoutSession({ companyId, declaredUserCount, startTrial });
        window.location.assign(url);
        return; // keep the loading state while the browser navigates
      }

      // Existing subscription: add another card inline
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement),
      });
      if (error) {
        throw new Error(error.message);
      }

      await addPaymentMethod({
        companyId,
        stripePaymentMethodId: paymentMethod.id,
        setAsDefault: true,
      });

      onSuccess();
    } catch (err) {
      console.error('Error adding payment method:', err);
      onError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-background-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {subscription ? 'Add Payment Method' : 'Start Subscription'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {subscription && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Card Information</label>
              <div className="border border-gray-300 rounded-md p-3">
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: '16px',
                        color: '#424770',
                        '::placeholder': {
                          color: '#aab7c4',
                        },
                      },
                      invalid: {
                        color: '#9e2146',
                      },
                    },
                  }}
                />
              </div>
            </div>
          )}

          {!subscription && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Number of Employees</label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={employeeCount}
                onChange={(e) => setEmployeeCount(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g. 50"
              />
              <p className="text-xs text-gray-500 mt-1">Billed at $1 per employee / month. Can be updated later.</p>
            </div>
          )}

          {!subscription && (
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={startTrial}
                  onChange={(e) => setStartTrial(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">Start with 14-day free trial</span>
              </label>
              <p className="text-xs text-gray-500 mt-2">You'll enter your card details securely on Stripe.</p>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (subscription && !stripe)}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : subscription ? 'Add' : 'Continue to Stripe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UpdateEmployeeCountModal({ currentCount, verifiedCount, onClose, onSave }) {
  const [count, setCount] = useState(String(currentCount || ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const parsed = Number(count);
  const isInteger = count !== '' && Number.isInteger(parsed) && parsed > 0;
  const belowMinimum = isInteger && parsed < verifiedCount;
  const validationError = count === '' ? null
    : !isInteger ? 'Enter a positive whole number'
    : belowMinimum ? `Cannot be below the verified count of ${verifiedCount}`
    : null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isInteger || belowMinimum) return;

    try {
      setSaving(true);
      setError(null);
      await onSave(parsed);
    } catch (err) {
      console.error('Error updating employee count:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-background-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Update Employee Count</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Number of Employees</label>
            <input
              type="number"
              min={Math.max(verifiedCount, 1)}
              step="1"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Minimum allowed: {verifiedCount} (employees verified via policy acknowledgement)</p>
            {validationError && <p className="text-xs text-red-600 mt-1">{validationError}</p>}
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
          )}

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !isInteger || belowMinimum}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CancelSubscriptionModal({ onClose, onCancel }) {
  const [immediate, setImmediate] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-background-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Cancel Subscription</h3>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to cancel your subscription? You can choose to cancel immediately or at the end of your current billing period.
        </p>

        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={immediate}
              onChange={(e) => setImmediate(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700">Cancel immediately (prorated refund)</span>
          </label>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Keep Subscription
          </button>
          <button
            onClick={() => onCancel(immediate)}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Cancel Subscription
          </button>
        </div>
      </div>
    </div>
  );
}

export default CompanyBilling;
