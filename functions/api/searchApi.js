/**
 * Advanced Search API
 * Provides full-text search, filtering, and search analytics
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getUserIdFromAuthSession } = require('../utils/helpers');

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Advanced search across posts and comments
 * Supports filters: date range, department, type, status, search in comments
 */
exports.advancedSearch = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const {
      query,
      searchInComments = false,
      filters = {},
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = data;

    // Get actual user ID from auth session
    const userId = await getUserIdFromAuthSession(context.auth.uid);

    if (!userId) {
      throw new functions.https.HttpsError('unauthenticated', 'User session not found');
    }

    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();
    const companyId = userData.companyId;

    // Log search analytics
    await db.collection('searchAnalytics').add({
      userId,
      companyId,
      query,
      filters,
      searchInComments,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Build posts query
    let postsQuery = db.collection('posts')
      .where('companyId', '==', companyId);

    // Apply filters
    if (filters.department) {
      postsQuery = postsQuery.where('department', '==', filters.department);
    }
    if (filters.type) {
      postsQuery = postsQuery.where('type', '==', filters.type);
    }
    if (filters.status) {
      postsQuery = postsQuery.where('status', '==', filters.status);
    }
    if (filters.priority) {
      postsQuery = postsQuery.where('priority', '==', filters.priority);
    }
    if (filters.isAnonymous !== undefined) {
      postsQuery = postsQuery.where('isAnonymous', '==', filters.isAnonymous);
    }

    // Execute query
    const postsSnapshot = await postsQuery.get();
    let posts = [];

    postsSnapshot.forEach(doc => {
      posts.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Client-side filtering for text search and date range
    if (query && query.trim() !== '') {
      const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 0);

      posts = posts.filter(post => {
        const title = (post.title || '').toLowerCase();
        const content = (post.content || '').toLowerCase();
        const tags = (post.tags || []).map(t => t.toLowerCase()).join(' ');
        const searchableText = `${title} ${content} ${tags}`;

        return searchTerms.some(term => searchableText.includes(term));
      });
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      posts = posts.filter(post => {
        const postDate = post.createdAt?.toDate?.() || new Date(post.createdAt);

        if (filters.startDate) {
          const startDate = new Date(filters.startDate);
          if (postDate < startDate) return false;
        }

        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999); // End of day
          if (postDate > endDate) return false;
        }

        return true;
      });
    }

    // Search in comments if requested
    let commentResults = [];
    if (searchInComments && query && query.trim() !== '') {
      const commentsSnapshot = await db.collection('comments')
        .where('companyId', '==', companyId)
        .get();

      const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 0);

      commentsSnapshot.forEach(doc => {
        const comment = doc.data();
        const commentText = (comment.content || '').toLowerCase();

        if (searchTerms.some(term => commentText.includes(term))) {
          commentResults.push({
            id: doc.id,
            ...comment,
            type: 'comment',
          });
        }
      });

      // Add posts that have matching comments
      const postIdsWithComments = [...new Set(commentResults.map(c => c.postId))];
      const postsWithComments = posts.filter(p => postIdsWithComments.includes(p.id));

      // Merge results (avoid duplicates)
      const existingPostIds = new Set(posts.map(p => p.id));
      postsWithComments.forEach(post => {
        if (!existingPostIds.has(post.id)) {
          posts.push(post);
        }
      });
    }

    // Sort results
    posts.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      // Handle Firestore timestamps
      if (aVal?.toDate) aVal = aVal.toDate();
      if (bVal?.toDate) bVal = bVal.toDate();

      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : -1;
      } else {
        return aVal > bVal ? 1 : -1;
      }
    });

    // Paginate
    const total = posts.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedPosts = posts.slice(startIndex, endIndex);

    return {
      success: true,
      results: paginatedPosts,
      commentResults: searchInComments ? commentResults : [],
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: endIndex < total,
      },
    };
  } catch (error) {
    console.error('Error in advancedSearch:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Save a search for quick access
 */
exports.saveSearch = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Get actual user ID from auth session
    const userId = await getUserIdFromAuthSession(context.auth.uid);

    if (!userId) {
      throw new functions.https.HttpsError('unauthenticated', 'User session not found');
    }

    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();

    // Check if user has admin privileges
    if (!['super_admin', 'company_admin', 'hr'].includes(userData.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can save searches');
    }

    const { name, query, filters, searchInComments } = data;

    if (!name || !name.trim()) {
      throw new functions.https.HttpsError('invalid-argument', 'Search name is required');
    }

    const savedSearchRef = await db.collection('savedSearches').add({
      userId,
      companyId: userData.companyId,
      name: name.trim(),
      query: query || '',
      filters: filters || {},
      searchInComments: searchInComments || false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUsed: admin.firestore.FieldValue.serverTimestamp(),
      useCount: 0,
    });

    return {
      success: true,
      searchId: savedSearchRef.id,
      message: 'Search saved successfully',
    };
  } catch (error) {
    console.error('Error in saveSearch:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Get user's saved searches
 */
exports.getSavedSearches = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Get actual user ID from auth session
    const userId = await getUserIdFromAuthSession(context.auth.uid);

    if (!userId) {
      throw new functions.https.HttpsError('unauthenticated', 'User session not found');
    }

    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();
    const companyId = userData.companyId;

    // Get saved searches for this user or company (if admin)
    let query = db.collection('savedSearches');

    if (['super_admin', 'company_admin', 'hr'].includes(userData.role)) {
      // Admins can see all company searches
      query = query.where('companyId', '==', companyId);
    } else {
      // Regular users see only their own
      query = query.where('userId', '==', userId);
    }

    const snapshot = await query.orderBy('lastUsed', 'desc').get();
    const searches = [];

    snapshot.forEach(doc => {
      searches.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return {
      success: true,
      searches,
    };
  } catch (error) {
    console.error('Error in getSavedSearches:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Delete a saved search
 */
exports.deleteSavedSearch = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { searchId } = data;

    // Get actual user ID from auth session
    const userId = await getUserIdFromAuthSession(context.auth.uid);

    if (!userId) {
      throw new functions.https.HttpsError('unauthenticated', 'User session not found');
    }

    const searchDoc = await db.collection('savedSearches').doc(searchId).get();

    if (!searchDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Search not found');
    }

    const searchData = searchDoc.data();

    // Only the creator can delete
    if (searchData.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'You can only delete your own searches');
    }

    await db.collection('savedSearches').doc(searchId).delete();

    return {
      success: true,
      message: 'Search deleted successfully',
    };
  } catch (error) {
    console.error('Error in deleteSavedSearch:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Update last used timestamp for saved search
 */
exports.useSavedSearch = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { searchId } = data;

    await db.collection('savedSearches').doc(searchId).update({
      lastUsed: admin.firestore.FieldValue.serverTimestamp(),
      useCount: admin.firestore.FieldValue.increment(1),
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error in useSavedSearch:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Get search analytics (admin only)
 */
exports.getSearchAnalytics = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Get actual user ID from auth session
    const userId = await getUserIdFromAuthSession(context.auth.uid);

    if (!userId) {
      throw new functions.https.HttpsError('unauthenticated', 'User session not found');
    }

    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();

    // Check if user has admin privileges
    if (!['super_admin', 'company_admin', 'hr'].includes(userData.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can view search analytics');
    }

    const { startDate, endDate, limit = 100 } = data;
    const companyId = userData.companyId;

    let query = db.collection('searchAnalytics')
      .where('companyId', '==', companyId);

    if (startDate) {
      query = query.where('timestamp', '>=', new Date(startDate));
    }
    if (endDate) {
      query = query.where('timestamp', '<=', new Date(endDate));
    }

    const snapshot = await query
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const analytics = [];
    const queryStats = {};
    const filterStats = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      analytics.push({
        id: doc.id,
        ...data,
      });

      // Aggregate stats
      if (data.query) {
        queryStats[data.query] = (queryStats[data.query] || 0) + 1;
      }

      if (data.filters) {
        Object.keys(data.filters).forEach(key => {
          if (!filterStats[key]) filterStats[key] = {};
          const value = data.filters[key];
          filterStats[key][value] = (filterStats[key][value] || 0) + 1;
        });
      }
    });

    // Get top queries
    const topQueries = Object.entries(queryStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    return {
      success: true,
      analytics,
      topQueries,
      filterStats,
      totalSearches: analytics.length,
    };
  } catch (error) {
    console.error('Error in getSearchAnalytics:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
