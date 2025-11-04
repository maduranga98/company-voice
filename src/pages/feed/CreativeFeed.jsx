import UnifiedFeed from "./UnifiedFeed";
import { PostType } from "../../utils/constants";
import { useTranslation } from "react-i18next";

const CreativeFeed = () => {
  const { t } = useTranslation();

  return (
    <UnifiedFeed
      feedType={PostType.CREATIVE_CONTENT}
      title={t("feed.creative")}
      description={t("feed.creativeDescriptiom")}
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
