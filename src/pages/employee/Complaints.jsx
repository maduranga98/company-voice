// import { useState, useEffect } from "react";
// import { useAuth } from "../../contexts/AuthContext";
// import {
//   collection,
//   query,
//   where,
//   orderBy,
//   getDocs,
//   limit,
//   doc,
//   updateDoc,
//   increment,
// } from "firebase/firestore";
// import { db } from "../../config/firebase";
// import CreatePost from "../../components/CreatePost";

// const Complaints = () => {
//   const { userData } = useAuth();
//   const [loading, setLoading] = useState(true);
//   const [posts, setPosts] = useState([]);
//   const [filteredPosts, setFilteredPosts] = useState([]);
//   const [showCreatePost, setShowCreatePost] = useState(false);
//   const [selectedCategory, setSelectedCategory] = useState("all");
//   const [searchQuery, setSearchQuery] = useState("");

//   const categories = [
//     "All",
//     "Workplace Safety",
//     "Equipment Issue",
//     "Environment",
//     "Harassment",
//     "Discrimination",
//     "Work Conditions",
//     "Policy Violation",
//     "Management",
//     "Other",
//   ];

//   useEffect(() => {
//     loadPosts();
//   }, [userData]);

//   useEffect(() => {
//     filterAndSortPosts();
//   }, [posts, selectedCategory, searchQuery]);

//   const loadPosts = async () => {
//     try {
//       setLoading(true);
//       const postsRef = collection(db, "posts");
//       const q = query(
//         postsRef,
//         where("companyId", "==", userData.companyId),
//         where("type", "==", "problem_report"),
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

//   const filterAndSortPosts = () => {
//     let filtered = [...posts];

//     if (selectedCategory !== "all") {
//       filtered = filtered.filter((post) => post.category === selectedCategory);
//     }

//     if (searchQuery) {
//       const query = searchQuery.toLowerCase();
//       filtered = filtered.filter(
//         (post) =>
//           post.title.toLowerCase().includes(query) ||
//           post.description.toLowerCase().includes(query)
//       );
//     }

//     setFilteredPosts(filtered);
//   };

//   const handleLike = async (postId) => {
//     try {
//       const postRef = doc(db, "posts", postId);
//       await updateDoc(postRef, {
//         likes: increment(1),
//       });

//       setPosts((prevPosts) =>
//         prevPosts.map((post) =>
//           post.id === postId ? { ...post, likes: post.likes + 1 } : post
//         )
//       );
//     } catch (error) {
//       console.error("Error liking post:", error);
//     }
//   };

//   const handlePostSuccess = () => {
//     setShowCreatePost(false);
//     loadPosts();
//   };

//   const getTimeAgo = (date) => {
//     if (!date) return "Just now";
//     const seconds = Math.floor((new Date() - date) / 1000);
//     let interval = seconds / 86400;
//     if (interval > 1) return Math.floor(interval) + "d ago";
//     interval = seconds / 3600;
//     if (interval > 1) return Math.floor(interval) + "h ago";
//     interval = seconds / 60;
//     if (interval > 1) return Math.floor(interval) + "m ago";
//     return "Just now";
//   };

//   return (
//     <div className="px-4 sm:px-6 lg:px-8 py-6">
//       {/* Hero Section */}
//       <div className="mb-6">
//         <div className="flex items-center justify-between mb-4">
//           <div>
//             <h1 className="text-2xl font-bold text-gray-900 mb-1">
//               Complaints & Reports
//             </h1>
//             <p className="text-sm text-gray-600">
//               Report issues and help improve our workplace
//             </p>
//           </div>
//           <button
//             onClick={() => setShowCreatePost(true)}
//             className="inline-flex items-center px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-lg"
//           >
//             <svg
//               className="w-5 h-5 mr-2"
//               fill="none"
//               stroke="currentColor"
//               viewBox="0 0 24 24"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth="2"
//                 d="M12 4v16m8-8H4"
//               />
//             </svg>
//             Report
//           </button>
//         </div>

//         {/* Search */}
//         <div className="relative mb-4">
//           <input
//             type="text"
//             placeholder="Search complaints..."
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//             className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
//           />
//           <svg
//             className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
//             fill="none"
//             stroke="currentColor"
//             viewBox="0 0 24 24"
//           >
//             <path
//               strokeLinecap="round"
//               strokeLinejoin="round"
//               strokeWidth="2"
//               d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
//             />
//           </svg>
//         </div>

//         {/* Categories */}
//         <div className="flex items-center space-x-2 overflow-x-auto pb-2">
//           {categories.map((category) => (
//             <button
//               key={category}
//               onClick={() =>
//                 setSelectedCategory(category.toLowerCase().replace(/ /g, "_"))
//               }
//               className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
//                 selectedCategory === category.toLowerCase().replace(/ /g, "_")
//                   ? "bg-red-600 text-white"
//                   : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
//               }`}
//             >
//               {category}
//             </button>
//           ))}
//         </div>
//       </div>

//       {/* Posts */}
//       {loading ? (
//         <div className="flex justify-center py-20">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
//         </div>
//       ) : filteredPosts.length === 0 ? (
//         <div className="text-center py-20">
//           <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
//             <svg
//               className="w-8 h-8 text-gray-400"
//               fill="none"
//               stroke="currentColor"
//               viewBox="0 0 24 24"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth="2"
//                 d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
//               />
//             </svg>
//           </div>
//           <h3 className="text-lg font-semibold text-gray-900 mb-2">
//             No complaints yet
//           </h3>
//           <p className="text-gray-600">Be the first to report an issue</p>
//         </div>
//       ) : (
//         <div className="space-y-4">
//           {filteredPosts.map((post) => (
//             <div
//               key={post.id}
//               className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition"
//             >
//               <div className="flex items-start justify-between mb-3">
//                 <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
//                   {post.category}
//                 </span>
//                 <span className="text-xs text-gray-500">
//                   {getTimeAgo(post.createdAt)}
//                 </span>
//               </div>

//               <h3 className="text-lg font-bold text-gray-900 mb-2">
//                 {post.title}
//               </h3>
//               <p className="text-sm text-gray-600 mb-4 line-clamp-2">
//                 {post.description}
//               </p>

//               <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-3">
//                 <div className="flex items-center space-x-4">
//                   <button
//                     onClick={() => handleLike(post.id)}
//                     className="flex items-center text-gray-600 hover:text-red-600 transition"
//                   >
//                     <svg
//                       className="w-5 h-5 mr-1"
//                       fill="none"
//                       stroke="currentColor"
//                       viewBox="0 0 24 24"
//                     >
//                       <path
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                         strokeWidth="2"
//                         d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
//                       />
//                     </svg>
//                     <span>{post.likes || 0}</span>
//                   </button>

//                   <button className="flex items-center text-gray-600 hover:text-red-600 transition">
//                     <svg
//                       className="w-5 h-5 mr-1"
//                       fill="none"
//                       stroke="currentColor"
//                       viewBox="0 0 24 24"
//                     >
//                       <path
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                         strokeWidth="2"
//                         d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
//                       />
//                     </svg>
//                     <span>{post.comments || 0}</span>
//                   </button>
//                 </div>

//                 {post.isAnonymous && (
//                   <span className="text-xs text-gray-500">Anonymous</span>
//                 )}
//               </div>
//             </div>
//           ))}
//         </div>
//       )}

//       {/* Create Post Modal */}
//       {showCreatePost && (
//         <CreatePost
//           type="complaint"
//           onClose={() => setShowCreatePost(false)}
//           onSuccess={handlePostSuccess}
//         />
//       )}
//     </div>
//   );
// };

// export default Complaints;
