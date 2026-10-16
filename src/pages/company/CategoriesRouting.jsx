import { useSearchParams } from "react-router-dom";
import { Layers } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { UserRole } from "../../utils/constants";
import { useCategoryRouting } from "../../hooks/useCategoryRouting";
import PageHeader, { PageContainer, PageLoading } from "../../components/PageHeader";
import CategoriesTab from "../../components/categoryRouting/CategoriesTab";
import RoutingRulesTab from "../../components/categoryRouting/RoutingRulesTab";

const TABS = [
  { id: "categories", label: "Categories" },
  { id: "routing", label: "Routing Rules" },
];

const CategoriesRouting = () => {
  const { userData } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "categories";
  const { categories, rules, defaultAssignee, staff, loading, error, mutate } = useCategoryRouting(userData?.companyId);

  const canConfigure = userData?.role === UserRole.COMPANY_ADMIN || userData?.role === UserRole.HR;

  if (!canConfigure) {
    return (
      <PageContainer>
        <p className="text-sm text-gray-500">Only company admins and HR can manage categories and routing.</p>
      </PageContainer>
    );
  }
  if (loading) return <PageLoading />;

  return (
    <PageContainer>
      <PageHeader
        icon={Layers}
        title="Categories & Routing"
        subtitle="Choose the categories people can report under, and who receives each one."
      />

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn't load everything. Refresh the page; if it keeps happening, contact support.
        </p>
      )}

      <div role="tablist" aria-label="Categories and routing" className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            type="button"
            onClick={() => setParams({ tab: t.id }, { replace: true })}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.id
                ? "border-[#1ABC9C] text-[#2D3E50]"
                : "border-transparent text-gray-500 hover:text-[#2D3E50]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "categories" ? (
          <CategoriesTab categories={categories} rules={rules} staff={staff} mutate={mutate} />
        ) : (
          <RoutingRulesTab
            categories={categories}
            rules={rules}
            defaultAssignee={defaultAssignee}
            staff={staff}
            mutate={mutate}
            canEditAdvanced={userData?.role === UserRole.COMPANY_ADMIN}
          />
        )}
      </div>
    </PageContainer>
  );
};

export default CategoriesRouting;
