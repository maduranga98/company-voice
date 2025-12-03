import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, orderBy, doc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import SuperAdminNav from "../../components/SuperAdminNav";

const DeletedPosts = () => {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const [deletedPosts, setDeletedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [comments, setComments] = useState([]);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (userData?.role !== "super_admin") {
      navigate("/dashboard");
      return;
    }
    loadDeletedPosts();
  }, [userData, navigate]);

  const loadDeletedPosts = async () => {
    try {
      setLoading(true);
      const deletedPostsQuery = query(
        collection(db, "deletedPosts"),
        orderBy("deletedAt", "desc")
      );
      const snapshot = await getDocs(deletedPostsQuery);
      const posts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDeletedPosts(posts);
    } catch (error) {
      console.error("Error loading deleted posts:", error);
      setError("Failed to load deleted posts");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (post) => {
    setSelectedPost(post);
    setShowDetailsModal(true);

    // Load comments for this deleted post
    try {
      const commentsQuery = query(
        collection(db, `deletedPosts/${post.id}/comments`),
        orderBy("createdAt", "desc")
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      const commentsData = commentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setComments(commentsData);
    } catch (error) {
      console.error("Error loading comments:", error);
    }
  };

  const handlePermanentDelete = async (postId) => {
    if (!confirm("Are you sure you want to permanently delete this post? This action cannot be undone!")) {
      return;
    }

    try {
      setLoading(true);

      // Delete the post and all subcollections
      await deleteDoc(doc(db, "deletedPosts", postId));

      // Delete comments
      const commentsQuery = collection(db, `deletedPosts/${postId}/comments`);
      const commentsSnapshot = await getDocs(commentsQuery);
      const deletePromises = commentsSnapshot.docs.map((commentDoc) =>
        deleteDoc(doc(db, `deletedPosts/${postId}/comments`, commentDoc.id))
      );
      await Promise.all(deletePromises);

      // Delete likes
      const likesQuery = collection(db, `deletedPosts/${postId}/likes`);
      const likesSnapshot = await getDocs(likesQuery);
      const likesDeletePromises = likesSnapshot.docs.map((likeDoc) =>
        deleteDoc(doc(db, `deletedPosts/${postId}/likes`, likeDoc.id))
      );
      await Promise.all(likesDeletePromises);

      // Delete reactions
      const reactionsQuery = collection(db, `deletedPosts/${postId}/reactions`);
      const reactionsSnapshot = await getDocs(reactionsQuery);
      const reactionsDeletePromises = reactionsSnapshot.docs.map((reactionDoc) =>
        deleteDoc(doc(db, `deletedPosts/${postId}/reactions`, reactionDoc.id))
      );
      await Promise.all(reactionsDeletePromises);

      setSuccess("Post permanently deleted successfully!");
      setShowDetailsModal(false);
      loadDeletedPosts();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error permanently deleting post:", error);
      setError("Failed to permanently delete post");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      return "Invalid date";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Super Admin Panel</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">
                {userData?.displayName || userData?.username}
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                SUPER ADMIN
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <SuperAdminNav />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Deleted Posts Review</h2>
          <p className="text-gray-600">
            Review and manage posts that have been deleted by users
          </p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Deleted Posts List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-purple-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading deleted posts...</p>
          </div>
        ) : deletedPosts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No deleted posts</h3>
            <p className="mt-1 text-gray-500">There are no deleted posts to review.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Post Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Author
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deleted By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deleted At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deletedPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {post.title || "Untitled"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{post.authorName || "Unknown"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {post.deletedBy?.name || "Unknown"}
                      </div>
                      <div className="text-xs text-gray-500">{post.deletedBy?.role || ""}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(post.deletedAt)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {post.type || "Unknown"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleViewDetails(post)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(post.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete Permanently
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Details Modal */}
      {showDetailsModal && selectedPost && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Post Details</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4">
              {/* Post Information */}
              <div className="mb-6">
                <h4 className="text-xl font-semibold text-gray-900 mb-4">
                  {selectedPost.title || "Untitled"}
                </h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Author</p>
                    <p className="text-sm text-gray-900">{selectedPost.authorName || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Created At</p>
                    <p className="text-sm text-gray-900">{formatDate(selectedPost.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Deleted By</p>
                    <p className="text-sm text-gray-900">
                      {selectedPost.deletedBy?.name || "Unknown"} ({selectedPost.deletedBy?.role || ""})
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Deleted At</p>
                    <p className="text-sm text-gray-900">{formatDate(selectedPost.deletedAt)}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-500 mb-2">Content</p>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-900 whitespace-pre-wrap">
                    {selectedPost.content || "No content"}
                  </div>
                </div>
              </div>

              {/* Comments Section */}
              {comments.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <h5 className="text-md font-semibold text-gray-900 mb-3">
                    Comments ({comments.length})
                  </h5>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-medium text-gray-900">
                            {comment.authorName || "Unknown"}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(comment.createdAt)}</p>
                        </div>
                        <p className="text-sm text-gray-700">{comment.content || comment.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
              <button
                onClick={() => handlePermanentDelete(selectedPost.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeletedPosts;
