import UnifiedFeed from "./UnifiedFeed";

/**
 * Problems Feed Page
 * Shows all problem reports from all users in the company
 * Same feed for employees and admins (admins see additional controls)
 */
const ProblemsFeed = () => {
  const categories = [
    "Workplace Safety",
    "Equipment Issue",
    "Environment",
    "Harassment",
    "Discrimination",
    "Work Conditions",
    "Policy Violation",
    "Management",
    "Other",
  ];

  return (
    <UnifiedFeed
      feedType="problems"
      title="Problems & Reports"
      description="Report workplace issues and track their resolution"
      icon="🚨"
      categories={categories}
    />
  );
};

export default ProblemsFeed;
