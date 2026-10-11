import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Pencil, Plus, Route, Trash2, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { UserRole } from "../../utils/constants";
import { showError, showSuccess } from "../../services/toastService";
import {
  RoutingActionType,
  ROUTING_CASE_TYPES,
  ROUTING_CATEGORIES,
  ROUTING_PRIORITIES,
  ROUTING_SOURCES,
  createRoutingRule,
  deleteRoutingRule,
  getRoutingRules,
  getRoutingTargets,
  reorderRoutingRules,
  setRoutingRuleEnabled,
  updateRoutingRule,
} from "../../services/routingRulesService";

const EMPTY_RULE = {
  name: "",
  enabled: true,
  conditions: { caseTypes: [], priorities: [], categories: [], sources: [], departmentIds: [] },
  action: { type: RoutingActionType.USER, id: "", name: "" },
};

const humanize = (value) => value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const Toggle = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
      checked ? "bg-[#1ABC9C]" : "bg-gray-200"
    }`}
  >
    <span
      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-4" : "translate-x-0.5"
      }`}
    />
  </button>
);

/** Multi-select as toggle chips. Nothing selected means "any". */
const ChipGroup = ({ legend, options, selected, onChange, anyLabel }) => (
  <fieldset>
    <legend className="mb-1.5 text-xs font-semibold text-[#2D3E50]">
      {legend} <span className="font-normal text-gray-400">· {selected.length === 0 ? anyLabel : selected.length}</span>
    </legend>
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((v) => v !== option.value) : [...selected, option.value])}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              on ? "bg-[#2D3E50] text-white" : "border border-gray-100 bg-background-white text-gray-500 hover:border-gray-200"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  </fieldset>
);

const RuleEditor = ({ initial, targets, onSave, onCancel, saving }) => {
  const { t } = useTranslation();
  const [rule, setRule] = useState(initial);

  const setCondition = (key) => (value) => setRule((r) => ({ ...r, conditions: { ...r.conditions, [key]: value } }));
  const optionsFor = (ns, values) => values.map((v) => ({ value: v, label: t(`routingRules.${ns}.${v}`, humanize(v)) }));

  const targetList = useMemo(() => {
    if (rule.action.type === RoutingActionType.DEPARTMENT) return targets.departments;
    if (rule.action.type === RoutingActionType.USER_TAG) return targets.tags;
    return targets.users;
  }, [rule.action.type, targets]);

  const setActionType = (type) => setRule((r) => ({ ...r, action: { type, id: "", name: "" } }));
  const setTarget = (id) => {
    const picked = targetList.find((x) => x.id === id);
    setRule((r) => ({ ...r, action: { ...r.action, id, name: picked?.name || "" } }));
  };

  const valid = rule.name.trim().length > 0 && rule.action.id;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(rule);
      }}
      className="space-y-5 rounded-2xl border border-gray-100 bg-background-white p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#2D3E50]">
          {initial.id ? t("routingRules.editRule", "Edit rule") : t("routingRules.newRule", "New rule")}
        </h2>
        <button type="button" onClick={onCancel} aria-label={t("common.close", "Close")} className="text-gray-400 hover:text-gray-600">
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-[#2D3E50]">{t("routingRules.name", "Rule name")}</span>
        <input
          value={rule.name}
          maxLength={80}
          onChange={(e) => setRule((r) => ({ ...r, name: e.target.value }))}
          placeholder={t("routingRules.namePlaceholder", "e.g. Safety reports to Legal")}
          className="w-full rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2 text-sm focus:border-[#1ABC9C] focus:outline-none focus:ring-1 focus:ring-[#1ABC9C]/20"
        />
      </label>

      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t("routingRules.when", "When a new case")}</p>
        <ChipGroup legend={t("routingRules.caseTypes", "Case type")} anyLabel={t("routingRules.any", "any")}
          options={optionsFor("caseType", ROUTING_CASE_TYPES)} selected={rule.conditions.caseTypes} onChange={setCondition("caseTypes")} />
        <ChipGroup legend={t("routingRules.priorities", "Priority")} anyLabel={t("routingRules.any", "any")}
          options={optionsFor("priority", ROUTING_PRIORITIES)} selected={rule.conditions.priorities} onChange={setCondition("priorities")} />
        <ChipGroup legend={t("routingRules.categories", "Category")} anyLabel={t("routingRules.any", "any")}
          options={optionsFor("category", ROUTING_CATEGORIES)} selected={rule.conditions.categories} onChange={setCondition("categories")} />
        <ChipGroup legend={t("routingRules.sources", "Source")} anyLabel={t("routingRules.any", "any")}
          options={optionsFor("source", ROUTING_SOURCES)} selected={rule.conditions.sources} onChange={setCondition("sources")} />
        {targets.departments.length > 0 && (
          <ChipGroup legend={t("routingRules.departments", "Department")} anyLabel={t("routingRules.any", "any")}
            options={targets.departments.map((d) => ({ value: d.id, label: d.name }))}
            selected={rule.conditions.departmentIds} onChange={setCondition("departmentIds")} />
        )}
        <p className="text-[11px] text-gray-400">{t("routingRules.conditionHint", "A case must match every group you pick; any one choice inside a group is enough. Leave a group empty to ignore it.")}</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t("routingRules.assignTo", "Assign to")}</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("routingRules.assignTo", "Assign to")}>
          {[RoutingActionType.USER, RoutingActionType.USER_TAG, RoutingActionType.DEPARTMENT].map((type) => (
            <button key={type} type="button" aria-pressed={rule.action.type === type} onClick={() => setActionType(type)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                rule.action.type === type ? "bg-[#2D3E50] text-white" : "border border-gray-100 bg-background-white text-gray-500 hover:border-gray-200"
              }`}>
              {t(`routingRules.action.${type}`, humanize(type))}
            </button>
          ))}
        </div>
        <select
          value={rule.action.id}
          onChange={(e) => setTarget(e.target.value)}
          aria-label={t("routingRules.target", "Target")}
          className="w-full rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2 text-sm focus:border-[#1ABC9C] focus:outline-none focus:ring-1 focus:ring-[#1ABC9C]/20"
        >
          <option value="">{t("routingRules.chooseTarget", "Choose…")}</option>
          {targetList.map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
        <p className="text-[11px] text-gray-400">{t(`routingRules.actionHint.${rule.action.type}`, "")}</p>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-gray-200">
          {t("common.cancel", "Cancel")}
        </button>
        <button type="submit" disabled={!valid || saving}
          className="rounded-lg bg-[#1ABC9C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#16A085] disabled:opacity-50">
          {t("common.save", "Save")}
        </button>
      </div>
    </form>
  );
};

const RuleSummary = ({ rule, targets }) => {
  const { t } = useTranslation();
  const label = (ns, v) => t(`routingRules.${ns}.${v}`, humanize(v));
  const deptName = (id) => targets.departments.find((d) => d.id === id)?.name || id;
  const c = rule.conditions || {};
  const parts = [
    c.caseTypes?.length && c.caseTypes.map((v) => label("caseType", v)).join(" / "),
    c.priorities?.length && c.priorities.map((v) => label("priority", v)).join(" / "),
    c.categories?.length && c.categories.map((v) => label("category", v)).join(" / "),
    c.sources?.length && c.sources.map((v) => label("source", v)).join(" / "),
    c.departmentIds?.length && c.departmentIds.map(deptName).join(" / "),
  ].filter(Boolean);
  return (
    <p className="text-xs text-gray-500">
      {parts.length ? parts.join(" · ") : t("routingRules.everyCase", "Every new case")}
      <span className="mx-1.5 text-gray-300">→</span>
      <span className="font-medium text-[#2D3E50]">
        {t(`routingRules.action.${rule.action.type}`, humanize(rule.action.type))}: {rule.action.name || rule.action.id}
      </span>
    </p>
  );
};

const RoutingRules = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [rules, setRules] = useState([]);
  const [targets, setTargets] = useState({ users: [], tags: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // rule being edited, EMPTY_RULE for new
  const [saving, setSaving] = useState(false);

  const allowed = userData?.role === UserRole.COMPANY_ADMIN;

  useEffect(() => {
    if (userData && !allowed) navigate("/");
  }, [userData, allowed, navigate]);

  const load = useCallback(async () => {
    if (!userData?.companyId || !allowed) return;
    try {
      const [loadedRules, loadedTargets] = await Promise.all([
        getRoutingRules(userData.companyId),
        getRoutingTargets(userData.companyId),
      ]);
      setRules(loadedRules);
      setTargets(loadedTargets);
    } catch (error) {
      console.error("Error loading routing rules:", error);
      showError(t("routingRules.loadFailed", "Could not load routing rules"));
    } finally {
      setLoading(false);
    }
  }, [userData?.companyId, allowed, t]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (rule) => {
    setSaving(true);
    try {
      if (rule.id) await updateRoutingRule(userData.companyId, rule.id, rule);
      else await createRoutingRule(userData.companyId, rule, rules.length + 1, userData);
      showSuccess(t("routingRules.saved", "Rule saved"));
      setEditing(null);
      await load();
    } catch (error) {
      console.error("Error saving routing rule:", error);
      showError(t("routingRules.saveFailed", "Could not save the rule"));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (rule, enabled) => {
    setRules((list) => list.map((r) => (r.id === rule.id ? { ...r, enabled } : r)));
    try {
      await setRoutingRuleEnabled(userData.companyId, rule.id, enabled);
    } catch (error) {
      console.error("Error toggling routing rule:", error);
      showError(t("routingRules.saveFailed", "Could not save the rule"));
      load();
    }
  };

  const move = async (index, delta) => {
    const next = [...rules];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setRules(next);
    try {
      await reorderRoutingRules(userData.companyId, next.map((r) => r.id));
    } catch (error) {
      console.error("Error reordering routing rules:", error);
      showError(t("routingRules.saveFailed", "Could not save the rule"));
      load();
    }
  };

  const remove = async (rule) => {
    if (!window.confirm(t("routingRules.confirmDelete", "Delete this rule? Cases already assigned are not changed."))) return;
    try {
      await deleteRoutingRule(userData.companyId, rule.id);
      showSuccess(t("routingRules.deleted", "Rule deleted"));
      await load();
    } catch (error) {
      console.error("Error deleting routing rule:", error);
      showError(t("routingRules.saveFailed", "Could not save the rule"));
    }
  };

  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#2D3E50]">{t("routingRules.title", "Routing rules")}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("routingRules.subtitle", "Automatically assign new cases. Rules run top to bottom and the first match wins. Anyone can still reassign a case afterwards.")}
          </p>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing(EMPTY_RULE)}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[#1ABC9C] px-3 py-2 text-xs font-semibold text-white hover:bg-[#16A085]">
            <Plus size={14} aria-hidden="true" />
            {t("routingRules.addRule", "Add rule")}
          </button>
        )}
      </div>

      <p className="rounded-xl bg-background-softGray px-4 py-3 text-xs text-gray-500">
        {t("routingRules.privacyNote", "Reports flagged as involving HR are only ever auto-assigned to company admins, never to HR staff.")}
      </p>

      {editing && <RuleEditor initial={editing} targets={targets} onSave={save} onCancel={() => setEditing(null)} saving={saving} />}

      {loading ? (
        <p className="py-10 text-center text-sm text-gray-400">{t("common.loading", "Loading…")}</p>
      ) : rules.length === 0 && !editing ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-14 text-center">
          <Route className="mx-auto mb-2 text-gray-300" size={28} aria-hidden="true" />
          <p className="text-sm font-medium text-[#2D3E50]">{t("routingRules.emptyTitle", "No routing rules yet")}</p>
          <p className="mt-1 text-xs text-gray-400">{t("routingRules.emptyBody", "New cases stay unassigned until someone picks them up.")}</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {rules.map((rule, index) => (
            <li key={rule.id} className={`flex items-start gap-3 rounded-2xl border border-gray-100 bg-background-white p-4 ${rule.enabled === false ? "opacity-60" : ""}`}>
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">{index + 1}</span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-semibold text-[#2D3E50]">{rule.name}</p>
                <RuleSummary rule={rule} targets={targets} />
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t("routingRules.moveUp", "Move up")}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600 disabled:opacity-30"><ArrowUp size={14} aria-hidden="true" /></button>
                <button type="button" disabled={index === rules.length - 1} onClick={() => move(index, 1)} aria-label={t("routingRules.moveDown", "Move down")}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600 disabled:opacity-30"><ArrowDown size={14} aria-hidden="true" /></button>
                <button type="button" onClick={() => setEditing(rule)} aria-label={t("common.edit", "Edit")}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"><Pencil size={14} aria-hidden="true" /></button>
                <button type="button" onClick={() => remove(rule)} aria-label={t("common.delete", "Delete")}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} aria-hidden="true" /></button>
                <Toggle checked={rule.enabled !== false} onChange={(v) => toggle(rule, v)} label={t("routingRules.enabled", "Enabled")} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default RoutingRules;
