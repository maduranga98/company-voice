import { useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { db } from "../../config/firebase";
import { caseHref, CaseType } from "../../utils/caseTypes";
import CaseAttachments from "../CaseAttachments";

const TYPE_LABELS = {
  problem_report: "Problem",
  idea_suggestion: "Idea",
  creative_content: "Creative",
  team_discussion: "Discussion",
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Collapsible view of the submission a legal request refers to. Loaded on first expand.
 * Reporter identity is deliberately not shown: it is only released through the disclosure flow.
 */
const RequestedSubmission = ({ reportId }) => {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ status: "idle", post: null });

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || state.status !== "idle") return;
    setState({ status: "loading", post: null });
    try {
      const snap = await getDoc(doc(db, "posts", reportId));
      setState(
        snap.exists()
          ? { status: "ready", post: { id: snap.id, ...snap.data() } }
          : { status: "missing", post: null }
      );
    } catch (err) {
      console.error("Error loading requested submission:", err);
      setState({ status: "error", post: null });
    }
  };

  const { status, post } = state;
  const created = toDate(post?.createdAt);

  return (
    <div className="mb-4 rounded-xl border border-gray-100">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-[#2D3E50]"
        aria-expanded={open}
      >
        Requested submission
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 text-sm">
          {status === "loading" && <p className="text-gray-500">Loading submission...</p>}
          {status === "missing" && (
            <p className="text-gray-500">This submission no longer exists or was deleted.</p>
          )}
          {status === "error" && (
            <p className="text-red-600">Could not load the submission. Check your access and try again.</p>
          )}
          {status === "ready" && (
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-gray-900">{post.title || "(Untitled)"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                    {TYPE_LABELS[post.type] || post.type || "Post"}
                  </span>
                  {post.category && <span>{post.category}</span>}
                  {created && <span>{created.toLocaleString()}</span>}
                  {post.status && <span>Status: {post.status}</span>}
                  <span className="font-mono text-gray-400">{post.id}</span>
                </div>
              </div>

              <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 leading-relaxed text-gray-700">
                {post.description || post.content || "No content."}
              </p>

              <CaseAttachments attachments={post.attachments} />

              <Link
                to={caseHref(CaseType.POST, post.id)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1ABC9C] hover:underline"
              >
                <ExternalLink size={12} />
                Open full case
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RequestedSubmission;
