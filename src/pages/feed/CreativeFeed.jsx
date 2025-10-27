import UnifiedFeed from "./UnifiedFeed";
import { PostType } from "../../utils/constants";

/**
 * Creative Feed Page
 * Shows all creative content from all users in the company
 * Same feed for employees and admins (admins see additional controls)
 */
const CreativeFeed = () => {
  console.log("CreativeFeed rendered!");

  return (
    <UnifiedFeed
      feedType={PostType.CREATIVE_CONTENT}
      title="Creative Feed"
      description="Share your creative ideas, designs, and innovations"
      colors={{
        gradient: "from-purple-600 to-pink-600",
        text: "text-purple-900",
        bg: "bg-purple-50",
        border: "border-purple-200",
      }}
    />
  );
};

export default CreativeFeed;
