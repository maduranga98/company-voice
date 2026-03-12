import UnifiedFeed from "./UnifiedFeed";
import { PostType } from "../../utils/constants";
import { useTranslation } from "react-i18next";

/**
 * Discussions Feed Page
 * Shows all team discussions from all users in the company
 * Same feed for employees and admins (admins see additional controls)
 */
const DiscussionsFeed = () => {
  const { t } = useTranslation();

  return (
    <UnifiedFeed
      feedType={PostType.TEAM_DISCUSSION}
      title={t("feed.discussionsTitle")}
      description={t("feed.discussionsDescription")}
      colors={{
        gradient: "from-blue-600 to-cyan-600",
        text: "text-blue-900",
        bg: "bg-blue-50",
        border: "border-blue-200",
      }}
    />
  );
};

export default DiscussionsFeed;
