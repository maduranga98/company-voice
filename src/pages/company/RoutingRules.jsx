import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowUp, ArrowDown, Plus, Route, Trash2, Pencil, X, Check } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { PostType, UserRole } from "../../utils/constants";
import { CaseType } from "../../utils/caseTypes";
import {
  ROUTING_CATEGORIES,
  VENDOR_CATEGORIES,
  VENDOR_SEVERITIES,
  emptyRule,
} from "../../utils/routingRules";
import { getAssignableUsers } from "../../services/caseService";
import { getDepartments } from "../../services/departmentservice";
import {
  getRoutingRules,
  createRoutingRule,
  updateRoutingRule,
  setRoutingRuleEnabled,
  deleteRoutingRule,
  moveRoutingRule,
} from "../../services/routingRulesService";
import { showSuccess, showError } from "../../services/toastService";
import PageHeader, { PageContainer } from "../../components/PageHeader";

const POST_TYPE_LABELS = {
  [PostType.PROBLEM_REPORT]: "Problem Report",
  [PostType.IDEA_SUGGESTION]: "Idea / Suggestion",
  [PostType.CREATIVE_CONTENT]: "Creative Content",
  [PostType.TEAM_DISCUSSION]: "Team Discussion",
};

const CATEGORY_LABELS = {
  harassment: "Harassment",
  discrimination: "Discrimination",
  safety: "Safety",
  fraud_ethics: "Fraud / Ethics",
  management: "Management",
  workplace_conditions: "Workplace Conditions",
  pay_benefits: "Pay & Benefits",
  policy_concern: "Policy Concern",
  other: "Other",
};

const VENDOR_CATEGORY_LABELS = {
  labor: "Labor Practices",
  data_privacy: "Data Privacy",
  safety: "Health & Safety",
  fraud: "Fraud / Corruption",
  compliance: "Regulatory Non-Compliance",
  other: "Other",
};

const CARD = "rounded-2xl border border-gray-100 bg-background-white shadow-sm";
const CHIP = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";
const INPUT =
  "w-full rounded-xl border border-gray-200 bg-background-white px-3 py-2 text-sm text-[#2D3E50] focus:border-[#1ABC9C] focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/20";

// Multi-select chip toggle group — used for the postTypes/categories/vendor condition pickers.
const ToggleChips = ({ options, labels, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((opt) => {
      const active = value.includes(opt);
      return (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(active ? value.filter((v) => v !== opt) : [...value, opt])}
          className={`${CHIP} border transition ${
            active
              ? "border-[#1ABC9C] bg-[#1ABC9C]/10 text-[#16A085]"
              : "border-gray-200 bg-background-white text-gray-500 hover:border-gray-300"
          }`}
        >
          {labels[opt] || opt}
        </button>
      );
    })}
  </div>
);

const RuleEditor = ({ initial, users, departments, onCancel, onSave, saving }) => {
  const [rule, setRule] = useState(initial);

  const setField = (patch) => setRule((r) => ({ ...r, ...patch }));
  const setConditions = (patch) => setRule((r) => ({ ...r, conditions: { ...r.conditions, ...patch } }));

  const appliesToPost = rule.appliesTo.includes(CaseType.POST);
  const appliesToVendor = rule.appliesTo.includes(CaseType.VENDOR);

  const toggleAppliesTo = (type) => {
    const has = rule.appliesTo.includes(type);
    const next = has ? rule.appliesTo.filter((t) => t !== type) : [...rule.appliesTo, type];
    setField({ appliesTo: next });
  };

  const actionOptions = rule.action.type === "department" ? departments : users;

  const canSave = rule.name.trim().length > 0 && rule.appliesTo.length > 0 && rule.action.id;

  return (
    <div className={`${CARD} p-4 space-y-4`}>
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">
          Rule name
        </label>
        <input
          className={INPUT}
          placeholder="e.g. Safety reports → Facilities"
          value={rule.name}
          onChange={(e) => setField({ name: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
          Applies to
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => toggleAppliesTo(CaseType.POST)}
            className={`${CHIP} border ${appliesToPost ? "border-[#2D3E50] bg-[#2D3E50] text-white" : "border-gray-200 text-gray-500"}`}
          >
            Reports (posts)
          </button>
          <button
            type="button"
            onClick={() => toggleAppliesTo(CaseType.VENDOR)}
            className={`${CHIP} border ${appliesToVendor ? "border-[#2D3E50] bg-[#2D3E50] text-white" : "border-gray-200 text-gray-500"}`}
          >
            Vendor risk reports
          </button>
        </div>
      </div>

      {appliesToPost && (
        <div className="space-y-3 rounded-xl bg-background-page p-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Report type (leave empty for any)
            </label>
            <ToggleChips
              options={Object.values(PostType)}
              labels={POST_TYPE_LABELS}
              value={rule.conditions.postTypes}
              onChange={(v) => setConditions({ postTypes: v })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Category (leave empty for any)
            </label>
            <ToggleChips
              options={ROUTING_CATEGORIES}
              labels={CATEGORY_LABELS}
              value={rule.conditions.categories}
              onChange={(v) => setConditions({ categories: v })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Involves HR (conflict of interest)
            </label>
            <div className="flex gap-1.5">
              {["any", "yes", "no"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setConditions({ involvesHR: opt })}
                  className={`${CHIP} border ${
                    rule.conditions.involvesHR === opt
                      ? "border-[#1ABC9C] bg-[#1ABC9C]/10 text-[#16A085]"
                      : "border-gray-200 text-gray-500"
                  }`}
                >
                  {opt === "any" ? "Either" : opt === "yes" ? "Involves HR" : "Doesn't involve HR"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {appliesToVendor && (
        <div className="space-y-3 rounded-xl bg-background-page p-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Vendor risk category (leave empty for any)
            </label>
            <ToggleChips
              options={VENDOR_CATEGORIES}
              labels={VENDOR_CATEGORY_LABELS}
              value={rule.conditions.vendorCategories}
              onChange={(v) => setConditions({ vendorCategories: v })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Severity (leave empty for any)
            </label>
            <ToggleChips
              options={VENDOR_SEVERITIES}
              labels={{ low: "Low", medium: "Medium", high: "High" }}
              value={rule.conditions.vendorSeverities}
              onChange={(v) => setConditions({ vendorSeverities: v })}
            />
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
          Assign matching cases to
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className={`${INPUT} sm:w-40`}
            value={rule.action.type}
            onChange={(e) => setField({ action: { type: e.target.value, id: "", name: "" } })}
          >
            <option value="user">A person</option>
            <option value="department">A department</option>
          </select>
          <select
            className={INPUT}
            value={rule.action.id}
            onChange={(e) => {
              const match = actionOptions.find((o) => o.id === e.target.value);
              setField({
                action: {
                  type: rule.action.type,
                  id: e.target.value,
                  name: match ? match.displayName || match.name : "",
                },
              });
            }}
          >
            <option value="">Select…</option>
            {actionOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.displayName || o.name}
              </option>
            ))}
          </select>
        </div>
        {rule.action.type === "user" && users.length === 0 && (
          <p className="mt-1.5 text-xs text-gray-400">
            Only members with a tag (Members → set a tag) can be assigned. Add one first.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-3.5 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSave || saving}
          onClick={() => onSave(rule)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#1ABC9C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#16A085] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check size={15} aria-hidden="true" />
          Save rule
        </button>
      </div>
    </div>
  );
};

const describeConditions = (rule) => {
  const parts = [];
  if (rule.appliesTo.includes(CaseType.POST)) {
    const c = rule.conditions || {};
    const bits = [];
    if (c.postTypes?.length) bits.push(c.postTypes.map((t) => POST_TYPE_LABELS[t] || t).join(", "));
    if (c.categories?.length) bits.push(c.categories.map((t) => CATEGORY_LABELS[t] || t).join(", "));
    if (c.involvesHR && c.involvesHR !== "any") {
      bits.push(c.involvesHR === "yes" ? "involves HR" : "doesn't involve HR");
    }
    parts.push(`Reports${bits.length ? ": " + bits.join(" · ") : " (any)"}`);
  }
  if (rule.appliesTo.includes(CaseType.VENDOR)) {
    const c = rule.conditions || {};
    const bits = [];
    if (c.vendorCategories?.length) bits.push(c.vendorCategories.map((t) => VENDOR_CATEGORY_LABELS[t] || t).join(", "));
    if (c.vendorSeverities?.length) bits.push(c.vendorSeverities.join(", "));
    parts.push(`Vendor risk${bits.length ? ": " + bits.join(" · ") : " (any)"}`);
  }
  return parts.join("  ·  ");
};

const RoutingRules = () => {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [rules, setRules] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null); // ruleId | "new" | null
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userData) return;
    if (userData.role !== UserRole.COMPANY_ADMIN && userData.role !== UserRole.SUPER_ADMIN) {
      navigate("/");
    }
  }, [userData, navigate]);

  const load = async () => {
    if (!userData?.companyId) return;
    setLoading(true);
    try {
      const [ruleList, userList, deptList] = await Promise.all([
        getRoutingRules(userData.companyId),
        getAssignableUsers(userData.companyId),
        getDepartments(userData.companyId),
      ]);
      setRules(ruleList);
      setUsers(userList);
      setDepartments(deptList);
    } catch (error) {
      console.error("Error loading routing rules:", error);
      showError("Failed to load routing rules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.companyId]);

  const editingRule = useMemo(() => {
    if (editingId === "new") return emptyRule(userData.companyId, rules.length);
    return rules.find((r) => r.id === editingId) || null;
  }, [editingId, rules, userData?.companyId]);

  const handleSave = async (rule) => {
    setSaving(true);
    try {
      if (editingId === "new") {
        await createRoutingRule(rule, userData);
        showSuccess("Routing rule created.");
      } else {
        const { id, companyId: _companyId, createdAt: _createdAt, createdBy: _createdBy, createdByName: _createdByName, ...updates } = rule;
        await updateRoutingRule(id, updates, userData);
        showSuccess("Routing rule updated.");
      }
      setEditingId(null);
      await load();
    } catch (error) {
      console.error("Error saving routing rule:", error);
      showError("Failed to save routing rule.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule) => {
    if (!window.confirm(`Delete the rule "${rule.name}"? This can't be undone.`)) return;
    try {
      await deleteRoutingRule(rule.id);
      showSuccess("Routing rule deleted.");
      await load();
    } catch (error) {
      console.error("Error deleting routing rule:", error);
      showError("Failed to delete routing rule.");
    }
  };

  const handleToggle = async (rule) => {
    try {
      await setRoutingRuleEnabled(rule.id, !rule.enabled, userData);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)));
    } catch (error) {
      console.error("Error toggling routing rule:", error);
      showError("Failed to update rule.");
    }
  };

  const handleMove = async (rule, direction) => {
    try {
      await moveRoutingRule(userData.companyId, rule.id, direction);
      await load();
    } catch (error) {
      console.error("Error reordering routing rule:", error);
      showError("Failed to reorder rule.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-9 h-9 rounded-full border-2 border-gray-200 animate-spin" style={{ borderTopColor: "#1ABC9C" }} />
        <p className="mt-3 text-xs text-gray-400">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        icon={Route}
        title="Routing Rules"
        subtitle="Reports are auto-assigned to the first matching rule, in order. Unmatched cases stay unassigned in the Case Queue."
        actions={
          editingId === null && (
            <button
              type="button"
              onClick={() => setEditingId("new")}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-[#1ABC9C] px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#16A085]"
            >
              <Plus size={16} aria-hidden="true" />
              New rule
            </button>
          )
        }
      />

      {editingId === "new" && (
        <RuleEditor
          initial={editingRule}
          users={users}
          departments={departments}
          saving={saving}
          onCancel={() => setEditingId(null)}
          onSave={handleSave}
        />
      )}

      {rules.length === 0 && editingId !== "new" ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-background-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-14 h-14 bg-[#1ABC9C]/10 rounded-2xl flex items-center justify-center mb-4">
            <Route className="w-6 h-6 text-[#1ABC9C]" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold mb-1" style={{ color: "#2D3E50" }}>
            No routing rules yet
          </h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Without a rule, new reports stay unassigned until someone claims them in the Case Queue. Add a
            rule to route specific categories straight to the right person or department.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) =>
            editingId === rule.id ? (
              <RuleEditor
                key={rule.id}
                initial={rule}
                users={users}
                departments={departments}
                saving={saving}
                onCancel={() => setEditingId(null)}
                onSave={handleSave}
              />
            ) : (
              <div key={rule.id} className={`${CARD} p-4`}>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-0.5 pt-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(rule, "up")}
                      className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-25"
                      aria-label="Move up"
                    >
                      <ArrowUp size={14} aria-hidden="true" />
                    </button>
                    <span className="text-[11px] font-semibold text-gray-300">{index + 1}</span>
                    <button
                      type="button"
                      disabled={index === rules.length - 1}
                      onClick={() => handleMove(rule, "down")}
                      className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-25"
                      aria-label="Move down"
                    >
                      <ArrowDown size={14} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#2D3E50]">{rule.name}</h3>
                      <button
                        type="button"
                        onClick={() => handleToggle(rule)}
                        className={`${CHIP} border ${
                          rule.enabled
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-gray-50 text-gray-500"
                        }`}
                      >
                        {rule.enabled ? "On" : "Off"}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{describeConditions(rule)}</p>
                    <p className="mt-2 text-xs font-medium text-[#2D3E50]">
                      → Assign to {rule.action?.type === "department" ? "department" : ""} {rule.action?.name || "—"}
                    </p>
                  </div>

                  <div className="flex flex-shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(rule.id)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-[#2D3E50]"
                      aria-label="Edit rule"
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rule)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="Delete rule"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </PageContainer>
  );
};

export default RoutingRules;
