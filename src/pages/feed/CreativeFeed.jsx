import UnifiedFeed from "./UnifiedFeed";

/**
 * Creative Feed Page
 * Shows all creative content posts from all users in the company
 * Same feed for employees and admins (admins see additional controls)
 */
const CreativeFeed = () => {
  const categories = [
    "Art & Design",
    "Photography",
    "Writing",
    "Music",
    "Video",
    "Innovation",
    "DIY Project",
    "Success Story",
    "Team Achievement",
    "Other",
  ];

  return (
    <UnifiedFeed
      feedType="creative"
      title="Creative Wall"
      description="Share your creative work, achievements, and innovations"
      icon="🎨"
      categories={categories}
    />
  );
};

export default CreativeFeed;
