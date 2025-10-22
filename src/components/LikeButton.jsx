import { useState, useEffect } from "react";
import {
  doc,
  updateDoc,
  increment,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../contexts/AuthContext";

const LikeButton = ({ postId, initialLikes = 0 }) => {
  const { userData } = useAuth();
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkIfLiked();
  }, [postId, userData]);

  const checkIfLiked = async () => {
    if (!userData?.id || !postId) return;

    try {
      const likeRef = doc(db, "posts", postId, "likes", userData.id);
      const likeDoc = await getDoc(likeRef);
      setIsLiked(likeDoc.exists());
    } catch (error) {
      console.error("Error checking like status:", error);
    }
  };

  const handleLike = async () => {
    if (loading || !userData?.id) return;

    setLoading(true);

    try {
      const postRef = doc(db, "posts", postId);
      const likeRef = doc(db, "posts", postId, "likes", userData.id);

      if (isLiked) {
        // Unlike
        await deleteDoc(likeRef);
        await updateDoc(postRef, {
          likes: increment(-1),
        });
        setLikes((prev) => Math.max(0, prev - 1));
        setIsLiked(false);
      } else {
        // Like
        await setDoc(likeRef, {
          userId: userData.id,
          userName: userData.displayName,
          createdAt: new Date(),
        });
        await updateDoc(postRef, {
          likes: increment(1),
        });
        setLikes((prev) => prev + 1);
        setIsLiked(true);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLike}
      disabled={loading}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
        isLiked
          ? "text-red-500 bg-red-50 hover:bg-red-100"
          : "text-slate-600 hover:text-red-500 hover:bg-red-50"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <svg
        className={`w-5 h-5 transition-transform ${isLiked ? "scale-110" : ""}`}
        fill={isLiked ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      <span className="text-sm">{likes}</span>
    </button>
  );
};

export default LikeButton;
