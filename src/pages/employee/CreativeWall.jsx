// import { useState, useEffect } from "react";
// import { useAuth } from "../../contexts/AuthContext";
// import { useNavigate } from "react-router-dom";
// import {
//   collection,
//   query,
//   where,
//   orderBy,
//   getDocs,
//   limit,
// } from "firebase/firestore";
// import { db } from "../../config/firebase";
// import CreatePost from "../../components/CreatePost";
// import Post from "../../components/Post";

// const CreativeWall = () => {
//   const { userData } = useAuth();
//   const navigate = useNavigate();
//   const [loading, setLoading] = useState(true);
//   const [posts, setPosts] = useState([]);
//   const [filteredPosts, setFilteredPosts] = useState([]);
//   const [showCreatePost, setShowCreatePost] = useState(false);
//   const [selectedCategory, setSelectedCategory] = useState("all");
//   const [searchQuery, setSearchQuery] = useState("");

//   const categories = [
//     "All",
//     "Art & Design",
//     "Innovation",
//     "Photography",
//     "Writing",
//     "Music",
//     "Technology",
//     "Ideas",
//     "Projects",
//     "Other",
//   ];

//   useEffect(() => {
//     loadPosts();
//   }, [userData]);

//   useEffect(() => {
//     filterPosts();
//   }, [posts, selectedCategory, searchQuery]);

//   const loadPosts = async () => {
//     try {
//       setLoading(true);
//       const postsRef = collection(db, "posts");
//       const q = query(
//         postsRef,
//         where("companyId", "==", userData.companyId),
//         where("type", "==", "creative_content"),
//         where("status", "==", "published"),
//         orderBy("createdAt", "desc"),
//         limit(50)
//       );

//       const snapshot = await getDocs(q);
//       const postsData = snapshot.docs.map((doc) => ({
//         id: doc.id,
//         ...doc.data(),
//         createdAt: doc.data().createdAt?.toDate(),
//       }));

//       setPosts(postsData);
//     } catch (error) {
//       console.error("Error loading posts:", error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const filterPosts = () => {
//     let filtered = [...posts];

//     if (selectedCategory !== "all") {
//       filtered = filtered.filter((post) => post.category === selectedCategory);
//     }

//     if (searchQuery) {
//       const query = searchQuery.toLowerCase();
//       filtered = filtered.filter(
//         (post) =>
//           post.title.toLowerCase().includes(query) ||
//           post.description.toLowerCase().includes(query) ||
//           post.tags?.some((tag) => tag.toLowerCase().includes(query))
//       );
//     }

//     setFilteredPosts(filtered);
//   };

//   const handlePostSuccess = () => {
//     setShowCreatePost(false);
//     loadPosts();
//   };

//   const getTimeAgo = (date) => {
//     if (!date) return "Just now";

//     const seconds = Math.floor((new Date() - date) / 1000);

//     let interval = seconds / 31536000;
//     if (interval > 1) return Math.floor(interval) + " years ago";

//     interval = seconds / 2592000;
//     if (interval > 1) return Math.floor(interval) + " months ago";

//     interval = seconds / 86400;
//     if (interval > 1) return Math.floor(interval) + " days ago";

//     interval = seconds / 3600;
//     if (interval > 1) return Math.floor(interval) + " hours ago";

//     interval = seconds / 60;
//     if (interval > 1) return Math.floor(interval) + " minutes ago";

//     return "Just now";
//   };

//   return (
//     <div className="min-h-screen bg-slate-50">
//       {/* Header */}
//       <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
//         <div className="max-w-4xl mx-auto px-4 sm:px-6">
//           <div className="flex justify-between items-center h-16">
//             <div className="flex items-center gap-3 sm:gap-4">
//               <button
//                 onClick={() => navigate("/employee/dashboard")}
//                 className="text-slate-600 hover:text-slate-900 transition"
//               >
//                 <svg
//                   className="w-5 h-5"
//                   fill="none"
//                   stroke="currentColor"
//                   viewBox="0 0 24 24"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth="2"
//                     d="M15 19l-7-7 7-7"
//                   />
//                 </svg>
//               </button>
//               <div className="flex items-center gap-2">
//                 <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
//                   <svg
//                     className="w-4 h-4 text-purple-600"
//                     fill="none"
//                     stroke="currentColor"
//                     viewBox="0 0 24 24"
//                   >
//                     <path
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                       strokeWidth="2"
//                       d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
//                     />
//                   </svg>
//                 </div>
//                 <h1 className="text-base sm:text-lg font-semibold text-slate-900">
//                   Creative Wall
//                 </h1>
//               </div>
//             </div>
//             <button
//               onClick={() => setShowCreatePost(true)}
//               className="px-3 sm:px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition"
//             >
//               <span className="hidden sm:inline">Share Creative Work</span>
//               <span className="sm:hidden">Share</span>
//             </button>
//           </div>
//         </div>
//       </header>

//       {/* Main Content */}
//       <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
//         {/* Filters */}
//         <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//             {/* Search */}
//             <div className="relative">
//               <input
//                 type="text"
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 placeholder="Search creative content..."
//                 className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
//               />
//               <svg
//                 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"
//                 fill="none"
//                 stroke="currentColor"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth="2"
//                   d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
//                 />
//               </svg>
//             </div>

//             {/* Category Filter */}
//             <select
//               value={selectedCategory}
//               onChange={(e) => setSelectedCategory(e.target.value)}
//               className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition"
//             >
//               {categories.map((cat) => (
//                 <option key={cat} value={cat === "All" ? "all" : cat}>
//                   {cat}
//                 </option>
//               ))}
//             </select>
//           </div>
//         </div>

//         {/* Posts Feed */}
//         {loading ? (
//           <div className="flex items-center justify-center py-20">
//             <div className="w-8 h-8 border-2 border-slate-200 border-t-purple-600 rounded-full animate-spin" />
//           </div>
//         ) : filteredPosts.length === 0 ? (
//           <div className="bg-white rounded-lg border border-slate-200 p-8 sm:p-12 text-center">
//             <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
//               <svg
//                 className="w-8 h-8 text-purple-600"
//                 fill="none"
//                 stroke="currentColor"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth="2"
//                   d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
//                 />
//               </svg>
//             </div>
//             <h3 className="text-lg font-semibold text-slate-900 mb-2">
//               No creative content found
//             </h3>
//             <p className="text-sm text-slate-600 mb-6">
//               {searchQuery || selectedCategory !== "all"
//                 ? "Try adjusting your filters"
//                 : "Be the first to share your creative work!"}
//             </p>
//             <button
//               onClick={() => setShowCreatePost(true)}
//               className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition"
//             >
//               <svg
//                 className="w-4 h-4"
//                 fill="none"
//                 stroke="currentColor"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth="2"
//                   d="M12 4v16m8-8H4"
//                 />
//               </svg>
//               Share Creative Work
//             </button>
//           </div>
//         ) : (
//           <div className="space-y-4">
//             {filteredPosts.map((post) => (
//               <Post key={post.id} post={post} getTimeAgo={getTimeAgo} />
//             ))}
//           </div>
//         )}
//       </main>

//       {/* Create Post Modal */}
//       {showCreatePost && (
//         <CreatePost
//           type="creative"
//           onClose={() => setShowCreatePost(false)}
//           onSuccess={handlePostSuccess}
//         />
//       )}
//     </div>
//   );
// };

// export default CreativeWall;
