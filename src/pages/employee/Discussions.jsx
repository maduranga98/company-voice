import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  doc,
  updateDoc,
  increment,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";

const Discussions = () => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [discussions, setDiscussions] = useState([]);
  const [filteredDiscussions, setFilteredDiscussions] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newDiscussion, setNewDiscussion] = useState({
    title: "",
    description: "",
    topic: "improvement",
  });

  const topics = [
    { id: "all", name: "All Topics", color: "gray" },
    { id: "improvement", name: "Improvements", color: "blue" },
    { id: "innovation", name: "Innovation", color: "purple" },
    { id: "feedback", name: "Feedback", color: "green" },
    { id: "teamwork", name: "Teamwork", color: "yellow" },
    { id: "culture", name: "Culture", color: "pink" },
    { id: "other", name: "Other", color: "gray" },
  ];

  useEffect(() => {
    loadDiscussions();
  }, [userData]);

  useEffect(() => {
    filterDiscussions();
  }, [discussions, selectedTopic, searchQuery]);

  const loadDiscussions = async () => {
    try {
      setLoading(true);
      const discussionsRef = collection(db, "discussions");
      const q = query(
        discussionsRef,
        where("companyId", "==", userData.companyId),
        orderBy("createdAt", "desc"),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const discussionsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      }));

      setDiscussions(discussionsData);
    } catch (error) {
      console.error("Error loading discussions:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterDiscussions = () => {
    let filtered = [...discussions];

    if (selectedTopic !== "all") {
      filtered = filtered.filter((disc) => disc.topic === selectedTopic);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (disc) =>
          disc.title.toLowerCase().includes(query) ||
          disc.description.toLowerCase().includes(query)
      );
    }

    setFilteredDiscussions(filtered);
  };

  const handleCreateDiscussion = async () => {
    if (!newDiscussion.title.trim() || !newDiscussion.description.trim())
      return;

    try {
      await addDoc(collection(db, "discussions"), {
        ...newDiscussion,
        companyId: userData.companyId,
        authorId: userData.uid,
        authorName: userData.displayName,
        likes: 0,
        comments: 0,
        createdAt: serverTimestamp(),
      });

      setShowCreateModal(false);
      setNewDiscussion({ title: "", description: "", topic: "improvement" });
      loadDiscussions();
    } catch (error) {
      console.error("Error creating discussion:", error);
    }
  };

  const handleLike = async (discussionId, currentLikes) => {
    try {
      const discussionRef = doc(db, "discussions", discussionId);
      await updateDoc(discussionRef, {
        likes: increment(1),
      });

      setDiscussions((prev) =>
        prev.map((disc) =>
          disc.id === discussionId ? { ...disc, likes: currentLikes + 1 } : disc
        )
      );
    } catch (error) {
      console.error("Error liking discussion:", error);
    }
  };

  const getTimeAgo = (date) => {
    if (!date) return "Just now";
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "Just now";
  };

  const getTopicColor = (topicId) => {
    const topic = topics.find((t) => t.id === topicId);
    const colors = {
      blue: "bg-blue-100 text-blue-800",
      purple: "bg-purple-100 text-purple-800",
      green: "bg-green-100 text-green-800",
      yellow: "bg-yellow-100 text-yellow-800",
      pink: "bg-pink-100 text-pink-800",
      gray: "bg-gray-100 text-gray-800",
    };
    return colors[topic?.color] || colors.gray;
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* Hero Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Team Discussions
            </h1>
            <p className="text-sm text-gray-600">
              Share ideas and collaborate on improvements
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition shadow-lg"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Start Discussion
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search discussions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg
            className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Topics Filter */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2">
          {topics.map((topic) => (
            <button
              key={topic.id}
              onClick={() => setSelectedTopic(topic.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                selectedTopic === topic.id
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {topic.name}
            </button>
          ))}
        </div>
      </div>

      {/* Discussions List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredDiscussions.length === 0 ? (
        <div className="text-center py-20">
          <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No discussions yet
          </h3>
          <p className="text-gray-600">
            Start a conversation and share your ideas
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDiscussions.map((discussion) => (
            <div
              key={discussion.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${getTopicColor(
                    discussion.topic
                  )}`}
                >
                  {topics.find((t) => t.id === discussion.topic)?.name}
                </span>
                <span className="text-xs text-gray-500">
                  {getTimeAgo(discussion.createdAt)}
                </span>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {discussion.title}
              </h3>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {discussion.description}
              </p>

              <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                <div className="flex items-center space-x-4 text-sm">
                  <button
                    onClick={() =>
                      handleLike(discussion.id, discussion.likes || 0)
                    }
                    className="flex items-center text-gray-600 hover:text-blue-600 transition"
                  >
                    <svg
                      className="w-5 h-5 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                      />
                    </svg>
                    <span>{discussion.likes || 0}</span>
                  </button>

                  <button className="flex items-center text-gray-600 hover:text-blue-600 transition">
                    <svg
                      className="w-5 h-5 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    <span>{discussion.comments || 0}</span>
                  </button>
                </div>

                <span className="text-xs text-gray-600">
                  by {discussion.authorName}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Discussion Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Start a Discussion
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Topic
                  </label>
                  <select
                    value={newDiscussion.topic}
                    onChange={(e) =>
                      setNewDiscussion({
                        ...newDiscussion,
                        topic: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {topics.slice(1).map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newDiscussion.title}
                    onChange={(e) =>
                      setNewDiscussion({
                        ...newDiscussion,
                        title: e.target.value,
                      })
                    }
                    placeholder="What would you like to discuss?"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newDiscussion.description}
                    onChange={(e) =>
                      setNewDiscussion({
                        ...newDiscussion,
                        description: e.target.value,
                      })
                    }
                    placeholder="Share your thoughts and ideas..."
                    rows="4"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateDiscussion}
                    disabled={
                      !newDiscussion.title.trim() ||
                      !newDiscussion.description.trim()
                    }
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Post Discussion
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Discussions;
