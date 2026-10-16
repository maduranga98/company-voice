import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Lock } from "lucide-react";
import AssigneePicker from "./AssigneePicker";
import { RoutingBadge } from "./CategoriesTab";
import {
  describeAssignee,
  describeCallableError,
  routingStatus,
  sortCategories,
} from "../../utils/categoryRouting";
import {
  removeCategoryRoutingRule,
  setCategoryRoutingRule,
  setDefaultRoutingAssignee,
} from "../../services/categoryRoutingService";
import { showError } from "../../services/toastService";

const CARD = "rounded-2xl border border-gray-100 bg-background-white shadow-sm";

const RoutingRulesTab = ({ categories, rules, defaultAssignee, staff, mutate, canEditAdvanced }) => {
  const [rowErrors, setRowErrors] = useState({});
  const [defaultError, setDefaultError] = useState("");

  const active = sortCategories(categories).filter((c) => c.isActive || c.isSystemDefined);
  const defaultInfo = describeAssignee(defaultAssignee, staff);

  const changeDefault = async (assignee) => {
    if (!assignee) return;
    setDefaultError("");
    try {
      await mutate(
        ({ setDefaultAssignee }) => setDefaultAssignee(assignee),
        () => setDefaultRoutingAssignee(assignee)
      );
    } catch (error) {
      const { message } = describeCallableError(error);
      setDefaultError(message);
      showError(message);
    }
  };

  const changeRule = async (category, assignee) => {
    setRowErrors((prev) => ({ ...prev, [category.id]: "" }));
    try {
      if (!assignee) {
        await mutate(
          ({ setRules }) => setRules((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== category.id))),
          () => removeCategoryRoutingRule(category.id)
        );
      } else {
        await mutate(
          ({ setRules }) =>
            setRules((prev) => ({
              ...prev,
              [category.id]: { id: category.id, categoryId: category.id, assigneeType: assignee.type, assigneeId: assignee.id, isActive: true },
            })),
          () => setCategoryRoutingRule(category.id, assignee)
        );
      }
    } catch (error) {
      const { message } = describeCallableError(error);
      setRowErrors((prev) => ({ ...prev, [category.id]: message }));
      showError(message);
    }
  };

  return (
    <div className="space-y-4">
      <section className={`${CARD} p-4`} aria-labelledby="default-assignee-title">
        <div className="grid gap-3 sm:grid-cols-[1fr_minmax(0,22rem)] sm:items-start">
          <div>
            <h2 id="default-assignee-title" className="text-sm font-semibold text-[#2D3E50]">
              Default fallback assignee
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Gets any report whose category has no assignee, or whose assignee is no longer active. Required, so
              no report is left without an owner. Reports that involve HR always go to a company admin instead.
            </p>
          </div>
          <div>
            <AssigneePicker
              id="default-assignee"
              label="Default fallback assignee"
              value={defaultAssignee.id ? defaultAssignee : null}
              staff={staff}
              invalid={!defaultInfo.valid}
              onChange={changeDefault}
            />
            <p role="alert" className="mt-1 min-h-[1rem] text-xs text-red-600">{defaultError}</p>
          </div>
        </div>
        {!defaultInfo.valid && (
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {defaultAssignee.id
              ? "The default assignee is no longer available. Until you pick another, reports fall back to the first active company admin."
              : "No default assignee is set. Until you pick one, reports fall back to the first active company admin."}
          </p>
        )}
      </section>

      <section className={CARD} aria-labelledby="rules-title">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 id="rules-title" className="text-sm font-semibold text-[#2D3E50]">Category assignees</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Choose who receives new reports in each category: a specific person, or everyone in a role.
          </p>
        </div>

        {active.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">
            No active categories. Add one in the Categories tab to route it.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {active.map((category) => {
              const status = routingStatus(category, rules, staff);
              const rule = rules[category.id];
              return (
                <li key={category.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_minmax(0,22rem)] sm:items-start sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[#2D3E50]">{category.name}</span>
                      {category.isSystemDefined && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                          <Lock size={11} aria-hidden="true" /> System-defined
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5">
                      {status.state === "assigned" ? (
                        <span className="text-xs text-gray-400">Routed directly</span>
                      ) : (
                        <>
                          <RoutingBadge status={status} />
                          {defaultInfo.valid && <span className="ml-2 text-xs text-gray-400">→ {defaultInfo.label}</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <AssigneePicker
                      id={`rule-${category.id}`}
                      label={`Assignee for ${category.name}`}
                      value={rule ? { type: rule.assigneeType, id: rule.assigneeId } : null}
                      staff={staff}
                      allowNone
                      invalid={status.state !== "assigned"}
                      onChange={(assignee) => changeRule(category, assignee)}
                    />
                    <p role="alert" className="mt-1 min-h-[1rem] text-xs text-red-600">{rowErrors[category.id]}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="px-1 text-xs text-gray-500">
        Need conditions such as "Fraud reports in Finance go to the CFO"?{" "}
        {canEditAdvanced ? (
          <Link to="/company/routing-rules" className="font-medium text-[#16A085] hover:underline">
            Advanced routing rules
          </Link>
        ) : (
          "Company admins can set advanced routing rules."
        )}{" "}
        They are checked first; this page covers everything they don't match.
      </p>
    </div>
  );
};

export default RoutingRulesTab;
