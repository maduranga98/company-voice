import UnifiedFeed from "./UnifiedFeed";
import { PostType } from "../../utils/constants";
import { useTranslation } from "react-i18next";

const ProblemsFeed = () => {
  const { t } = useTranslation();

  return (
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
  );
};

export default ProblemsFeed;
