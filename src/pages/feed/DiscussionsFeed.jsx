import UnifiedFeed from "./UnifiedFeed";
import { PostType } from "../../utils/constants";
import { useTranslation } from "react-i18next";

const DiscussionsFeed = () => {
  const { t } = useTranslation();

  return (
    <UnifiedFeed
      feedType={PostType.TEAM_DISCUSSION}
      title={t("feed.discussionsTitle")}
      description={t("feed.discussionsDescription")}
      colors={{
        gradient: "from-blue-500 to-cyan-500",
        text: "text-blue-900",
        bg: "bg-blue-50",
        border: "border-blue-200",
      }}
    />
  );
};

export default DiscussionsFeed;
