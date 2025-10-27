import UnifiedFeed from "./UnifiedFeed";
import { PostType } from "../../utils/constants";

/**
 * Discussions Feed Page
 * Shows all team discussions from all users in the company
 * Same feed for employees and admins (admins see additional controls)
 */
const DiscussionsFeed = () => {
  return (
    <UnifiedFeed
      feedType={PostType.TEAM_DISCUSSION}
      title="Team Discussions"
      description="Start conversations and collaborate with your team"
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
