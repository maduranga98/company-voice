import UnifiedFeed from "./UnifiedFeed";
import { PostType } from "../../utils/constants";

/**
 * Problems Feed Page
 * Shows all problem reports from all users in the company
 * Same feed for employees and admins (admins see additional controls)
 */
const ProblemsFeed = () => {
  return (
    <UnifiedFeed
      feedType={PostType.PROBLEM_REPORT}
      title="Problems & Reports"
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
