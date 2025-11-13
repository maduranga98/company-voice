/**
 * Company Billing Page
 * Manages subscription, invoices, payment methods, and usage tracking
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import {
  getSubscription,
  createSubscription,
  cancelSubscription,
  reactivateSubscription,
  getInvoices,
  getPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  getPaymentHistory,
  getUsageSummary,
  createPaymentMethod as createPaymentMethodUtil,
  formatCurrency,
  formatDate,
  getStatusColor,
  getPaymentStatusColor,
} from '../../services/billingService';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function CompanyBilling() {
  return (
    <Elements stripe={stripePromise}>
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
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const companyId = currentUser?.companyId;

  useEffect(() => {
    if (companyId) {
      loadBillingData();
    }
  }, [companyId]);

  async function loadBillingData() {
    try {
      setLoading(true);
      setError(null);

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

  async function handleReactivateSubscription() {
    if (!subscription) return;

    try {
      setLoading(true);
      setError(null);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading billing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => window.history.back()}
              className="text-gray-600 hover:text-gray-900 transition"
              title="Back"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
          </div>
          <p className="text-gray-600">Manage your subscription, invoices, and payment methods</p>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{error}</span>
            <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
              <span className="text-xl">&times;</span>
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{success}</span>
            <button onClick={() => setSuccess(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
              <span className="text-xl">&times;</span>
            </button>
          </div>
        )}

        {/* Subscription Status Banner */}
        {subscription && (
          <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3">
                  <h2 className="text-xl font-semibold text-gray-900">Subscription Status</h2>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription.status)}`}>
                    {subscription.status?.toUpperCase()}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <p>Current Users: <span className="font-medium text-gray-900">{subscription.currentUserCount}</span></p>
                  <p>Next Billing: <span className="font-medium text-gray-900">{formatDate(subscription.currentPeriodEnd)}</span></p>
                  <p>Amount: <span className="font-medium text-gray-900">{formatCurrency(subscription.amount)}</span></p>
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
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
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
              {activeTab === 'overview' && <OverviewTab subscription={subscription} usageSummary={usageSummary} />}
              {activeTab === 'invoices' && <InvoicesTab invoices={invoices} />}
              {activeTab === 'payment-methods' && (
                <PaymentMethodsTab
                  paymentMethods={paymentMethods}
                  onAdd={() => setShowAddPaymentModal(true)}
                  onRemove={async (id) => {
                    try {
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
      </div>

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
    </div>
  );
}

// Tab Components

function OverviewTab({ subscription, usageSummary }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
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
            <span className="text-gray-600">Current Users:</span>
            <span className="font-medium">{subscription.currentUserCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Base Amount:</span>
            <span className="font-medium">{formatCurrency(subscription.amount)}</span>
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

      <div className="bg-white rounded-lg shadow-sm p-6">
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
  );
}

function InvoicesTab({ invoices }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
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
          <tbody className="bg-white divide-y divide-gray-200">
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
                  {invoice.pdfUrl && (
                    <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">
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
          <div key={method.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {method.brand?.toUpperCase()} •••• {method.last4}
                  </p>
                  <p className="text-sm text-gray-500">
                    Expires {method.expMonth}/{method.expYear}
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
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
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
      <div className="bg-white rounded-lg shadow-sm p-6">
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
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
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
              <tbody className="bg-white divide-y divide-gray-200">
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
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
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
          <tbody className="bg-white divide-y divide-gray-200">
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
                  {payment.paymentMethodLast4 ? `•••• ${payment.paymentMethodLast4}` : '-'}
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

  async function handleSubmit(e) {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    try {
      setLoading(true);
      const cardElement = elements.getElement(CardElement);

      // Create payment method
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (subscription) {
        // Add to existing subscription
        await addPaymentMethod({
          companyId,
          stripePaymentMethodId: paymentMethod.id,
          setAsDefault: true,
        });
      } else {
        // Create new subscription
        await createSubscription({
          companyId,
          paymentMethodId: paymentMethod.id,
          startTrial,
        });
      }

      onSuccess();
    } catch (err) {
      console.error('Error adding payment method:', err);
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {subscription ? 'Add Payment Method' : 'Start Subscription'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
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

          {!subscription && (
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={startTrial}
                  onChange={(e) => setStartTrial(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">Start with 7-day free trial</span>
              </label>
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
              disabled={loading || !stripe}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : subscription ? 'Add' : 'Subscribe'}
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
      <div className="bg-white rounded-lg max-w-md w-full p-6">
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
