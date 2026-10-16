import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Lock, Pencil, Plus, X } from "lucide-react";
import {
  CATEGORY_DESCRIPTION_MAX,
  CATEGORY_NAME_MAX,
  MAX_CATEGORIES,
  describeCallableError,
  routingStatus,
  sortCategories,
  validateCategoryName,
} from "../../utils/categoryRouting";
import {
  createCategory,
  reorderCategories,
  updateCategory,
} from "../../services/categoryRoutingService";
import { showError } from "../../services/toastService";

const CARD = "rounded-2xl border border-gray-100 bg-background-white shadow-sm";
const CHIP = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium";
const INPUT =
  "w-full rounded-xl border bg-background-white px-3 py-2 text-sm text-[#2D3E50] focus:outline-none focus:ring-2";
const INPUT_OK = "border-gray-200 focus:border-[#1ABC9C] focus:ring-[#1ABC9C]/20";
const INPUT_BAD = "border-red-300 focus:border-red-400 focus:ring-red-100";
const ICON_BTN =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-[#2D3E50] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent";

export const RoutingBadge = ({ status }) => {
  if (status.state === "assigned") {
    return <span className={`${CHIP} bg-[#1ABC9C]/10 text-[#16A085]`}>→ {status.label}</span>;
  }
  if (status.state === "unavailable") {
    return (
      <span className={`${CHIP} bg-amber-50 text-amber-700`} title={`${status.label} can't receive cases. The default assignee is used.`}>
        Assignee unavailable — using default
      </span>
    );
  }
  return <span className={`${CHIP} bg-amber-50 text-amber-700`}>Unassigned — using default</span>;
};

const AddCategory = ({ categories, mutate, atLimit }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);

  const nameError = touched ? validateCategoryName(name, categories) : "";

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (validateCategoryName(name, categories) || busy) return;
    setBusy(true);
    setServerError("");
    const trimmed = name.replace(/\s+/g, " ").trim();
    const nextOrder = categories.filter((c) => !c.isSystemDefined).reduce((m, c) => Math.max(m, c.order ?? 0), -1) + 1;
    try {
      await mutate(
        ({ setCategories }) =>
          setCategories((prev) => [
            ...prev,
            {
              id: `pending-${Date.now()}`,
              pending: true,
              name: trimmed,
              description: description.trim(),
              isActive: true,
              isSystemDefined: false,
              order: nextOrder,
            },
          ]),
        () => createCategory({ name: trimmed, description: description.trim() })
      );
      setName("");
      setDescription("");
      setTouched(false);
    } catch (error) {
      setServerError(describeCallableError(error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={`${CARD} space-y-3 p-4`} noValidate>
      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-start">
        <div>
          <label htmlFor="new-category-name" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            New category
          </label>
          <input
            id="new-category-name"
            className={`${INPUT} ${nameError ? INPUT_BAD : INPUT_OK}`}
            placeholder="e.g. Remote work"
            value={name}
            maxLength={CATEGORY_NAME_MAX + 20}
            disabled={atLimit}
            aria-invalid={!!nameError}
            aria-describedby="new-category-error"
            onChange={(e) => { setName(e.target.value); setServerError(""); }}
            onBlur={() => name && setTouched(true)}
          />
          <p id="new-category-error" role="alert" className="mt-1 min-h-[1rem] text-xs text-red-600">
            {nameError || serverError}
          </p>
        </div>
        <div>
          <label htmlFor="new-category-desc" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Description <span className="font-normal normal-case text-gray-400">(optional)</span>
          </label>
          <input
            id="new-category-desc"
            className={`${INPUT} ${INPUT_OK}`}
            placeholder="Shown to staff only"
            value={description}
            maxLength={CATEGORY_DESCRIPTION_MAX}
            disabled={atLimit}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={busy || atLimit}
          className="mt-[1.375rem] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2D3E50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2c3a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" /> Add
        </button>
      </div>
      {atLimit && <p className="text-xs text-gray-500">You've reached the limit of {MAX_CATEGORIES} categories.</p>}
    </form>
  );
};

const CategoryRow = ({ category, status, index, count, isLastActive, busy, onRename, onToggle, onMove, categories }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const locked = category.isSystemDefined === true;

  const startEdit = () => {
    setDraft(category.name);
    setError("");
    setEditing(true);
  };

  const save = async () => {
    const problem = validateCategoryName(draft, categories, category.id);
    if (problem) { setError(problem); return; }
    if (draft.replace(/\s+/g, " ").trim() === category.name) { setEditing(false); return; }
    setEditing(false);
    const message = await onRename(category, draft.replace(/\s+/g, " ").trim());
    if (message) { setDraft(category.name); setError(message); setEditing(true); }
  };

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${category.pending ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1 basis-60">
        {editing ? (
          <div>
            <div className="flex items-center gap-1">
              <input
                autoFocus
                aria-label={`Rename ${category.name}`}
                className={`${INPUT} ${error ? INPUT_BAD : INPUT_OK}`}
                value={draft}
                maxLength={CATEGORY_NAME_MAX + 20}
                onChange={(e) => { setDraft(e.target.value); setError(""); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <button type="button" className={ICON_BTN} aria-label="Save name" onClick={save}><Check size={16} /></button>
              <button type="button" className={ICON_BTN} aria-label="Cancel" onClick={() => setEditing(false)}><X size={16} /></button>
            </div>
            <p role="alert" className="mt-1 min-h-[1rem] text-xs text-red-600">{error}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm font-semibold ${category.isActive ? "text-[#2D3E50]" : "text-gray-400 line-through"}`}>
                {category.name}
              </span>
              {locked && (
                <span className={`${CHIP} bg-gray-100 text-gray-600`}>
                  <Lock size={11} aria-hidden="true" /> System-defined
                </span>
              )}
              {!category.isActive && !locked && <span className={`${CHIP} bg-gray-100 text-gray-500`}>Inactive</span>}
            </div>
            {category.description && <p className="mt-0.5 truncate text-xs text-gray-500">{category.description}</p>}
            {locked && (
              <p className="mt-0.5 text-xs text-gray-400">
                A fixed case type with its own structured fields. It can't be renamed, deactivated or reordered.
              </p>
            )}
          </>
        )}
      </div>

      {category.isActive && !editing && <RoutingBadge status={status} />}

      {!locked && !editing && (
        <div className="flex items-center gap-0.5">
          <button type="button" className={ICON_BTN} aria-label={`Move ${category.name} up`} disabled={busy || index === 0} onClick={() => onMove(category, -1)}>
            <ArrowUp size={16} />
          </button>
          <button type="button" className={ICON_BTN} aria-label={`Move ${category.name} down`} disabled={busy || index === count - 1} onClick={() => onMove(category, 1)}>
            <ArrowDown size={16} />
          </button>
          <button type="button" className={ICON_BTN} aria-label={`Rename ${category.name}`} disabled={category.pending} onClick={startEdit}>
            <Pencil size={15} />
          </button>
          <button
            type="button"
            disabled={category.pending || (category.isActive && isLastActive)}
            title={category.isActive && isLastActive ? "At least one category must stay active" : undefined}
            onClick={() => onToggle(category)}
            className="ml-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            {category.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      )}
    </li>
  );
};

const CategoriesTab = ({ categories, rules, staff, mutate }) => {
  const [moving, setMoving] = useState(false);
  const sorted = sortCategories(categories);
  const editable = sorted.filter((c) => !c.isSystemDefined);
  const activeEditable = editable.filter((c) => c.isActive);

  const patch = (id, changes) => ({ setCategories }) =>
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)));

  // Each handler returns an error message (or "") so the row can show it inline; the
  // optimistic change has already been rolled back by `mutate` by then.
  const rename = async (category, name) => {
    try {
      await mutate(patch(category.id, { name, i18nKey: null }), () => updateCategory(category.id, { name }));
      return "";
    } catch (error) {
      return describeCallableError(error).message;
    }
  };

  const toggle = async (category) => {
    try {
      await mutate(patch(category.id, { isActive: !category.isActive }), () =>
        updateCategory(category.id, { isActive: !category.isActive })
      );
    } catch (error) {
      showError(describeCallableError(error).message);
    }
  };

  const move = async (category, delta) => {
    const from = editable.findIndex((c) => c.id === category.id);
    const to = from + delta;
    if (to < 0 || to >= editable.length) return;
    const next = [...editable];
    [next[from], next[to]] = [next[to], next[from]];
    const orderOf = Object.fromEntries(next.map((c, i) => [c.id, i]));
    setMoving(true);
    try {
      await mutate(
        ({ setCategories }) =>
          setCategories((prev) => prev.map((c) => (c.id in orderOf ? { ...c, order: orderOf[c.id] } : c))),
        () => reorderCategories(next.filter((c) => !c.pending).map((c) => c.id))
      );
    } catch (error) {
      showError(describeCallableError(error).message);
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <AddCategory categories={categories} mutate={mutate} atLimit={categories.length >= MAX_CATEGORIES} />

      <div className={CARD}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-[#2D3E50]">Submission categories</h2>
          <span className="text-xs text-gray-400">{activeEditable.length} active</span>
        </div>
        <p className="border-b border-gray-100 bg-background-page px-4 py-2 text-xs text-gray-500">
          These appear, in this order, in the report form. Deactivating hides a category from new reports; existing
          cases keep it.
        </p>
        {sorted.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">No categories yet. Add your first one above.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sorted.map((category) => {
              const index = editable.findIndex((c) => c.id === category.id);
              return (
                <CategoryRow
                  key={category.id}
                  category={category}
                  categories={categories}
                  status={routingStatus(category, rules, staff)}
                  index={index}
                  count={editable.length}
                  isLastActive={category.isActive && activeEditable.length === 1}
                  busy={moving}
                  onRename={rename}
                  onToggle={toggle}
                  onMove={move}
                />
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CategoriesTab;
