/**
 * Analytics Helper Functions
 * Provides utility functions for calculating various analytics metrics
 */

/**
 * Calculate average response time from post creation to first status change
 * @param {Array} posts - Array of post objects
 * @param {Array} postActivities - Array of post activity objects
 * @returns {number} Average response time in hours
 */
export const calculateAverageResponseTime = (posts, postActivities) => {
  let totalResponseTime = 0;
  let postsWithResponse = 0;

  posts.forEach((post) => {
    // Find first activity that changed status from 'open'
    const postActivitiesForPost = postActivities.filter(
      (activity) => activity.postId === post.id && activity.type === "status_changed"
    );

    if (postActivitiesForPost.length > 0 && post.createdAt) {
      // Sort by timestamp and get the first one
      const firstResponse = postActivitiesForPost.sort(
        (a, b) => (a.timestamp?.toDate?.() || new Date(a.timestamp)) -
                  (b.timestamp?.toDate?.() || new Date(b.timestamp))
      )[0];

      const createdAt = post.createdAt.toDate ? post.createdAt.toDate() : new Date(post.createdAt);
      const respondedAt = firstResponse.timestamp?.toDate?.() || new Date(firstResponse.timestamp);

      const responseTime = (respondedAt - createdAt) / (1000 * 60 * 60); // Convert to hours

      if (responseTime >= 0) {
        totalResponseTime += responseTime;
        postsWithResponse++;
      }
    }
  });

  return postsWithResponse > 0 ? totalResponseTime / postsWithResponse : 0;
};

/**
 * Calculate user engagement statistics
 * @param {Array} posts - Array of post objects
 * @param {Array} comments - Array of comment objects
 * @param {Array} users - Array of user objects
 * @returns {Object} User engagement statistics
 */
export const calculateUserEngagement = (posts, comments, users) => {
  const userStats = users.map((user) => {
    const userPosts = posts.filter((p) => p.authorId === user.id);
    const userComments = comments.filter((c) => c.authorId === user.id);
    const userLikes = posts.reduce((sum, post) => {
      return sum + (post.likes?.includes(user.id) ? 1 : 0);
    }, 0);

    return {
      userId: user.id,
      displayName: user.displayName || "Unknown",
      email: user.email,
      postsCount: userPosts.length,
      commentsCount: userComments.length,
      likesGiven: userLikes,
      totalEngagement: userPosts.length + userComments.length + userLikes,
    };
  });

  // Sort by total engagement
  userStats.sort((a, b) => b.totalEngagement - a.totalEngagement);

  // Calculate engagement rates
  const totalUsers = users.filter(u => u.status === "active").length;
  const activeEngagers = userStats.filter(u => u.totalEngagement > 0).length;
  const engagementRate = totalUsers > 0 ? (activeEngagers / totalUsers) * 100 : 0;

  return {
    topUsers: userStats.slice(0, 10), // Top 10 most engaged users
    engagementRate: engagementRate.toFixed(1),
    averagePostsPerUser: totalUsers > 0 ? (posts.length / totalUsers).toFixed(2) : 0,
    averageCommentsPerUser: totalUsers > 0 ? (comments.length / totalUsers).toFixed(2) : 0,
  };
};

/**
 * Calculate department performance metrics
 * @param {Array} posts - Array of post objects
 * @param {Array} departments - Array of department objects
 * @param {Array} postActivities - Array of post activity objects
 * @returns {Array} Department performance metrics
 */
export const calculateDepartmentPerformance = (posts, departments, postActivities) => {
  return departments.map((dept) => {
    // Posts assigned to this department
    const deptPosts = posts.filter(
      (p) => p.assignedTo?.type === "department" && p.assignedTo?.id === dept.id
    );

    // Resolved posts
    const resolvedPosts = deptPosts.filter(
      (p) => p.status === "resolved" || p.status === "closed"
    );

    // Calculate average resolution time
    let totalResolutionTime = 0;
    let postsWithResolutionTime = 0;

    resolvedPosts.forEach((post) => {
      if (post.createdAt) {
        // Find when it was resolved
        const resolutionActivity = postActivities
          .filter(
            (activity) =>
              activity.postId === post.id &&
              activity.type === "status_changed" &&
              (activity.newStatus === "resolved" || activity.newStatus === "closed")
          )
          .sort(
            (a, b) =>
              (a.timestamp?.toDate?.() || new Date(a.timestamp)) -
              (b.timestamp?.toDate?.() || new Date(b.timestamp))
          )[0];

        if (resolutionActivity) {
          const createdAt = post.createdAt.toDate
            ? post.createdAt.toDate()
            : new Date(post.createdAt);
          const resolvedAt = resolutionActivity.timestamp?.toDate?.()
            ? resolutionActivity.timestamp.toDate()
            : new Date(resolutionActivity.timestamp);

          const resolutionTime = (resolvedAt - createdAt) / (1000 * 60 * 60); // Hours

          if (resolutionTime >= 0) {
            totalResolutionTime += resolutionTime;
            postsWithResolutionTime++;
          }
        }
      }
    });

    const avgResolutionTime =
      postsWithResolutionTime > 0
        ? totalResolutionTime / postsWithResolutionTime
        : 0;

    const resolutionRate =
      deptPosts.length > 0 ? (resolvedPosts.length / deptPosts.length) * 100 : 0;

    return {
      id: dept.id,
      name: dept.name,
      icon: dept.icon,
      totalAssigned: deptPosts.length,
      resolved: resolvedPosts.length,
      inProgress: deptPosts.filter(
        (p) => p.status === "in_progress" || p.status === "working_on"
      ).length,
      open: deptPosts.filter((p) => p.status === "open").length,
      resolutionRate: resolutionRate.toFixed(1),
      avgResolutionTime: avgResolutionTime.toFixed(1),
    };
  });
};

/**
 * Filter posts by date range
 * @param {Array} posts - Array of post objects
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Filtered posts
 */
export const filterPostsByDateRange = (posts, startDate, endDate) => {
  return posts.filter((post) => {
    if (!post.createdAt) return false;

    const postDate = post.createdAt.toDate
      ? post.createdAt.toDate()
      : new Date(post.createdAt);

    return postDate >= startDate && postDate <= endDate;
  });
};

/**
 * Export analytics data to CSV format
 * @param {Object} analyticsData - Analytics data object
 * @param {string} reportType - Type of report (overview, engagement, departments)
 * @returns {string} CSV string
 */
export const exportToCSV = (analyticsData, reportType) => {
  let csvContent = "";

  switch (reportType) {
    case "overview":
      csvContent = "Metric,Value\n";
      csvContent += `Total Posts,${analyticsData.overview.totalPosts}\n`;
      csvContent += `Total Comments,${analyticsData.overview.totalComments}\n`;
      csvContent += `Total Users,${analyticsData.overview.totalUsers}\n`;
      csvContent += `Active Users,${analyticsData.overview.activeUsers}\n`;
      csvContent += `Pending Users,${analyticsData.overview.pendingUsers}\n`;
      csvContent += `Average Response Time (hours),${analyticsData.responseTimeAvg}\n`;
      csvContent += `Resolution Rate (%),${analyticsData.resolutionRate}\n`;
      break;

    case "engagement":
      csvContent = "User,Email,Posts,Comments,Likes Given,Total Engagement\n";
      analyticsData.userEngagement.topUsers?.forEach((user) => {
        csvContent += `"${user.displayName}","${user.email}",${user.postsCount},${user.commentsCount},${user.likesGiven},${user.totalEngagement}\n`;
      });
      break;

    case "departments":
      csvContent =
        "Department,Total Assigned,Resolved,In Progress,Open,Resolution Rate (%),Avg Resolution Time (hours)\n";
      analyticsData.departmentStats?.forEach((dept) => {
        csvContent += `"${dept.name}",${dept.totalAssigned},${dept.resolved},${dept.inProgress},${dept.open},${dept.resolutionRate},${dept.avgResolutionTime}\n`;
      });
      break;

    case "full":
      // Combined export with all data
      csvContent = "===== OVERVIEW =====\n";
      csvContent += "Metric,Value\n";
      csvContent += `Total Posts,${analyticsData.overview.totalPosts}\n`;
      csvContent += `Total Comments,${analyticsData.overview.totalComments}\n`;
      csvContent += `Total Users,${analyticsData.overview.totalUsers}\n`;
      csvContent += `Active Users,${analyticsData.overview.activeUsers}\n`;
      csvContent += `Average Response Time (hours),${analyticsData.responseTimeAvg}\n\n`;

      csvContent += "===== USER ENGAGEMENT =====\n";
      csvContent += "User,Email,Posts,Comments,Likes Given,Total Engagement\n";
      analyticsData.userEngagement.topUsers?.forEach((user) => {
        csvContent += `"${user.displayName}","${user.email}",${user.postsCount},${user.commentsCount},${user.likesGiven},${user.totalEngagement}\n`;
      });

      csvContent += "\n===== DEPARTMENT PERFORMANCE =====\n";
      csvContent +=
        "Department,Total Assigned,Resolved,In Progress,Open,Resolution Rate (%),Avg Resolution Time (hours)\n";
      analyticsData.departmentStats?.forEach((dept) => {
        csvContent += `"${dept.name}",${dept.totalAssigned},${dept.resolved},${dept.inProgress},${dept.open},${dept.resolutionRate},${dept.avgResolutionTime}\n`;
      });
      break;

    default:
      csvContent = "Invalid report type";
  }

  return csvContent;
};

/**
 * Download CSV file
 * @param {string} csvContent - CSV content string
 * @param {string} filename - Filename for download
 */
export const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
