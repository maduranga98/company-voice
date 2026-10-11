import AnonymousThread from "./AnonymousThread";
import CaseHandlingPanel from "./case/CaseHandlingPanel";
import { CaseType } from "../utils/caseTypes";

// Post-specific wrapper around the shared case-handling panel: the generic controls
// live in CaseHandlingPanel; only the anonymous reporter thread is post-only.
const AdminActionPanel = ({ post, currentUser, onUpdate }) => (
  <CaseHandlingPanel caseType={CaseType.POST} caseData={post} currentUser={currentUser} onUpdate={onUpdate}>
    {post.isAnonymous && (
      <AnonymousThread
        postId={post.id}
        companyId={post.companyId || currentUser.companyId}
        currentUserRole={currentUser.role}
        isAnonymousPost={post.isAnonymous}
      />
    )}
  </CaseHandlingPanel>
);

export default AdminActionPanel;
