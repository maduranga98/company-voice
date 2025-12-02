/**
 * Super Admin Billing Dashboard
 * Platform-wide billing management and revenue monitoring
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import {
  getAllSubscriptions,
  getSuperAdminInvoices,
  getRevenueReport,
  getBillingDisputes,
  resolveBillingDispute,
  getAllBillingHistory,
  formatCurrency,
  formatDate,
  getStatusColor,
  getPaymentStatusColor,
} from "../../services/billingService";
import SuperAdminNav from "../../components/SuperAdminNav";

function BillingDashboard() {
  const navigate = useNavigate();
  const { userData, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [subscriptions, setSubscriptions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [revenueReport, setRevenueReport] = useState(null);
  const [billingHistory, setBillingHistory] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filters
  const [subscriptionFilter, setSubscriptionFilter] = useState("all");
  const [invoiceFilter, setInvoiceFilter] = useState("all");
  const [disputeFilter, setDisputeFilter] = useState("open");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      setError(null);

      // Ensure ID token is fresh before making API calls
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }

      const [subsData, invoicesData, disputesData, reportData, historyData] =
        await Promise.all([
          getAllSubscriptions({ limit: 100 }),
          getSuperAdminInvoices({ limit: 100 }),
          getBillingDisputes({ status: "open", limit: 50 }),
          getRevenueReport(new Date().getMonth() + 1, new Date().getFullYear()),
          getAllBillingHistory({ limit: 100 }),
        ]);

      setSubscriptions(subsData?.data || []);
      setInvoices(invoicesData?.data || []);
      setDisputes(disputesData?.data || []);
      setRevenueReport(reportData?.data);
      setBillingHistory(historyData?.data || []);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRevenueReport() {
    try {
      setLoading(true);

      // Ensure ID token is fresh before making API call
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }

      const reportData = await getRevenueReport(selectedMonth, selectedYear);
      setRevenueReport(reportData?.data);
    } catch (err) {
      console.error("Error loading revenue report:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolveDispute(
    disputeId,
    resolution,
    resolutionNotes,
    refundAmount = null
  ) {
    try {
      setLoading(true);

      // Ensure ID token is fresh before making API call
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }

      await resolveBillingDispute({
        disputeId,
        resolution,
        resolutionNotes,
        refundAmount,
      });
      setSuccess("Dispute resolved successfully");
      await loadDashboardData();
    } catch (err) {
      console.error("Error resolving dispute:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredSubscriptions = subscriptions.filter(
    (sub) => subscriptionFilter === "all" || sub.status === subscriptionFilter
  );

  const filteredInvoices = invoices.filter(
    (inv) => invoiceFilter === "all" || inv.status === invoiceFilter
  );

  if (loading && !revenueReport) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading billing dashboard...</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 space-y-3 sm:space-y-0">
            {/* Title */}
            <div className="flex flex-col space-y-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Super Admin Panel
              </h1>
            </div>

            {/* User Info & Actions */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm text-gray-700 truncate max-w-[150px] sm:max-w-none">
                {userData?.displayName || userData?.username}
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded whitespace-nowrap">
                SUPER ADMIN
              </span>
              <button
                onClick={handleLogout}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
        {/* Navigation Tabs */}
        <SuperAdminNav />
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alert Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{error}</span>
            <button
              onClick={() => setError(null)}
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
            >
              <span className="text-xl">&times;</span>
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{success}</span>
            <button
              onClick={() => setSuccess(null)}
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
            >
              <span className="text-xl">&times;</span>
            </button>
          </div>
        )}

        {/* Metrics Cards */}
        {revenueReport && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Monthly Recurring Revenue"
              value={formatCurrency(revenueReport.totalRevenue)}
              subtitle={`${revenueReport.activeCompanies} active companies`}
              icon="💰"
              trend={revenueReport.totalRevenue > 0 ? "up" : "neutral"}
            />
            <MetricCard
              title="Total Active Users"
              value={revenueReport.totalActiveUsers}
              subtitle={`Avg ${revenueReport.averageUsersPerCompany} per company`}
              icon="👥"
              trend="up"
            />
            <MetricCard
              title="Payment Success Rate"
              value={`${revenueReport.paymentSuccessRate}%`}
              subtitle={`${revenueReport.successfulPayments}/${
                revenueReport.successfulPayments + revenueReport.failedPayments
              } successful`}
              icon="✅"
              trend={revenueReport.paymentSuccessRate >= 90 ? "up" : "down"}
            />
            <MetricCard
              title="Outstanding Invoices"
              value={formatCurrency(revenueReport.totalOutstanding)}
              subtitle={`${revenueReport.companiesInGracePeriod} in grace period`}
              icon="⚠️"
              trend={
                revenueReport.companiesInGracePeriod > 0 ? "down" : "neutral"
              }
            />
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              "overview",
              "subscriptions",
              "invoices",
              "disputes",
              "revenue",
              "history",
            ].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`${
                  activeTab === tab
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
              >
                {tab}
                {tab === "disputes" && disputes.length > 0 && (
                  <span className="ml-2 bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs">
                    {disputes.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === "overview" && (
            <OverviewTab revenueReport={revenueReport} />
          )}
          {activeTab === "subscriptions" && (
            <SubscriptionsTab
              subscriptions={filteredSubscriptions}
              filter={subscriptionFilter}
              onFilterChange={setSubscriptionFilter}
            />
          )}
          {activeTab === "invoices" && (
            <InvoicesTab
              invoices={filteredInvoices}
              filter={invoiceFilter}
              onFilterChange={setInvoiceFilter}
            />
          )}
          {activeTab === "disputes" && (
            <DisputesTab
              disputes={disputes.filter(
                (d) => disputeFilter === "all" || d.status === disputeFilter
              )}
              filter={disputeFilter}
              onFilterChange={setDisputeFilter}
              onResolve={handleResolveDispute}
            />
          )}
          {activeTab === "revenue" && (
            <RevenueTab
              report={revenueReport}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onMonthChange={setSelectedMonth}
              onYearChange={setSelectedYear}
              onLoadReport={loadRevenueReport}
            />
          )}
          {activeTab === "history" && <HistoryTab history={billingHistory} />}
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({ title, value, subtitle, icon, trend }) {
  const trendColors = {
    up: "text-green-600",
    down: "text-red-600",
    neutral: "text-gray-600",
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-sm font-medium ${trendColors[trend]}`}>
          {trend === "up" && "↑"}
          {trend === "down" && "↓"}
          {trend === "neutral" && "—"}
        </span>
      </div>
      <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
    </div>
  );
}

// Tab Components

function OverviewTab({ revenueReport }) {
  if (!revenueReport)
    return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Revenue Breakdown */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Revenue Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-600">Total Invoiced</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(revenueReport.totalInvoiced)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(revenueReport.totalPaid)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Outstanding</p>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(revenueReport.totalOutstanding)}
            </p>
          </div>
        </div>
      </div>

      {/* Company Breakdown */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Top Companies by Revenue
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {revenueReport.companyBreakdown
                ?.sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10)
                .map((company, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {company.companyName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {company.userCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(company.revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          company.status
                        )}`}
                      >
                        {company.status}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SubscriptionsTab({ subscriptions, filter, onFilterChange }) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">
          Filter by status:
        </label>
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Canceled</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Billing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {sub.companyName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {sub.currentUserCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(sub.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                        sub.status
                      )}`}
                    >
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(sub.currentPeriodEnd)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(sub.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {subscriptions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No subscriptions found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InvoicesTab({ invoices, filter, onFilterChange }) {
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const paidAmount = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amountPaid, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-600">Total Invoiced</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(totalAmount)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-600">Total Paid</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(paidAmount)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-600">Outstanding</p>
          <p className="text-2xl font-bold text-orange-600">
            {formatCurrency(totalAmount - paidAmount)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">
          Filter by status:
        </label>
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="open">Open</option>
          <option value="void">Void</option>
        </select>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {invoice.companyName || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(invoice.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(invoice.total)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getPaymentStatusColor(
                        invoice.status
                      )}`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No invoices found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DisputesTab({ disputes, filter, onFilterChange, onResolve }) {
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [resolution, setResolution] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  function handleResolve() {
    if (!selectedDispute || !resolution) return;
    onResolve(
      selectedDispute.id,
      resolution,
      resolutionNotes,
      refundAmount ? parseFloat(refundAmount) : null
    );
    setSelectedDispute(null);
    setResolution("");
    setResolutionNotes("");
    setRefundAmount("");
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">
          Filter by status:
        </label>
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Disputes Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Opened
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {disputes.map((dispute) => (
                <tr key={dispute.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {dispute.companyName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(dispute.amount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {dispute.reason}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(dispute.openedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        dispute.status === "open"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {dispute.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {dispute.status === "open" && (
                      <button
                        onClick={() => setSelectedDispute(dispute)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {disputes.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No disputes found</p>
            </div>
          )}
        </div>
      </div>

      {/* Resolve Dispute Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Resolve Dispute
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resolution
                </label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">Select resolution...</option>
                  <option value="refunded">Refund Issued</option>
                  <option value="credited">Credit Applied</option>
                  <option value="rejected">Dispute Rejected</option>
                </select>
              </div>
              {resolution === "refunded" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Refund Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="0.00"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Add resolution notes..."
                />
              </div>
            </div>
            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => setSelectedDispute(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={!resolution}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RevenueTab({
  report,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  onLoadReport,
}) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const years = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - i
  );

  return (
    <div className="space-y-6">
      {/* Report Controls */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange(parseInt(e.target.value))}
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              {months.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => onYearChange(parseInt(e.target.value))}
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="pt-6">
            <button
              onClick={onLoadReport}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Generate Report
            </button>
          </div>
        </div>
      </div>

      {/* Report Display */}
      {report && (
        <div className="space-y-6">
          {/* Revenue Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(report.totalRevenue)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <p className="text-sm text-gray-600">Active Companies</p>
              <p className="text-3xl font-bold text-gray-900">
                {report.activeCompanies}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">
                {report.totalActiveUsers}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <p className="text-sm text-gray-600">Avg Users/Company</p>
              <p className="text-3xl font-bold text-gray-900">
                {report.averageUsersPerCompany}
              </p>
            </div>
          </div>

          {/* Export Options */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Export Report
            </h3>
            <div className="flex space-x-3">
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                Export as CSV
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                Export as PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryTab({ history }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Billing History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {history.map((event) => (
              <tr key={event.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {formatDate(event.timestamp)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {event.companyName || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                    {event.eventType}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {event.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No billing history</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default BillingDashboard;
