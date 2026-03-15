import UnifiedFeed from "./UnifiedFeed";
import { PostType } from "../../utils/constants";
import { useTranslation } from "react-i18next";

const CreativeFeed = () => {
  const { t } = useTranslation();

  return (
    <UnifiedFeed
      feedType={PostType.CREATIVE_CONTENT}
      title={t("feed.creativeTitle")}
      description={t("feed.creativeDescriptiom")}
      colors={{
        gradient: "from-violet-500 to-fuchsia-500",
        text: "text-violet-900",
        bg: "bg-violet-50",
        border: "border-violet-200",
      }}
    />
  );
};

export default CreativeFeed;
