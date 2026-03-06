import UnifiedFeed from "./UnifiedFeed";
import { PostType } from "../../utils/constants";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import PolicyAcknowledgementBanner from "../../components/PolicyAcknowledgementBanner";

const ProblemsFeed = () => {
  const { t } = useTranslation();
  const { userData } = useAuth();

  return (
    <>
      {userData?.companyId && userData?.id && (
        <PolicyAcknowledgementBanner
          companyId={userData.companyId}
          userId={userData.id}
        />
      )}
      <UnifiedFeed
        feedType={PostType.PROBLEM_REPORT}
        title={t("feed.problems")}
        description="Report workplace issues and track their resolution"
        colors={{
          gradient: "from-red-600 to-orange-600",
          text: "text-red-900",
          bg: "bg-red-50",
          border: "border-red-200",
        }}
      />
    </>
  );
};

export default ProblemsFeed;
