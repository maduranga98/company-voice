import UnifiedFeed from "./UnifiedFeed";

/**
 * Discussions Feed Page
 * Shows all team discussions from all users in the company
 * Same feed for employees and admins (admins see additional controls)
 */
const DiscussionsFeed = () => {
  const categories = [
    "Improvements",
    "Innovation",
    "Feedback",
    "Teamwork",
    "Culture",
    "Other",
  ];

  return (
    <UnifiedFeed
      feedType="discussions"
      title="Team Discussions"
      description="Engage in conversations about improvements and ideas"
      icon="💬"
      categories={categories}
    />
  );
};

export default DiscussionsFeed;
