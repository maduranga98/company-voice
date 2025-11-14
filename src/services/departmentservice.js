import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";

// ============================================
// DEPARTMENT CRUD OPERATIONS
// ============================================

/**
 * Create a new department
 * @param {object} departmentData - Department information
 * @param {string} companyId - Company ID
 * @returns {Promise<{success: boolean, id: string}>}
 */
export const createDepartment = async (departmentData, companyId) => {
  try {
    // Validate department name is unique
    const existingDepts = await getDepartments(companyId, false);
    const nameExists = existingDepts.some(
      (dept) => dept.name.toLowerCase() === departmentData.name.toLowerCase()
    );

    if (nameExists) {
      throw new Error("A department with this name already exists");
    }

    const department = {
      ...departmentData,
      companyId,
      memberCount: 0,
      activeProjects: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
    };

    const docRef = await addDoc(collection(db, "departments"), department);

    return {
      success: true,
      id: docRef.id,
      message: "Department created successfully",
    };
  } catch (error) {
    console.error("Error creating department:", error);
    throw error;
  }
};

/**
 * Update department information
 * @param {string} departmentId - Department ID
 * @param {object} updates - Fields to update
 * @param {string} companyId - Company ID (for name validation)
 * @returns {Promise<{success: boolean}>}
 */
export const updateDepartment = async (departmentId, updates, companyId) => {
  try {
    // Validate department name is unique if name is being updated
    if (updates.name && companyId) {
      const existingDepts = await getDepartments(companyId, false);
      const nameExists = existingDepts.some(
        (dept) =>
          dept.id !== departmentId &&
          dept.name.toLowerCase() === updates.name.toLowerCase()
      );

      if (nameExists) {
        throw new Error("A department with this name already exists");
      }
    }

    const departmentRef = doc(db, "departments", departmentId);

    await updateDoc(departmentRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    return {
      success: true,
      message: "Department updated successfully",
    };
  } catch (error) {
    console.error("Error updating department:", error);
    throw error;
  }
};

/**
 * Delete a department (soft delete)
 * @param {string} departmentId - Department ID
 * @param {string} reassignToDeptId - Optional department to reassign members to
 * @returns {Promise<{success: boolean}>}
 */
export const deleteDepartment = async (
  departmentId,
  reassignToDeptId = null
) => {
  try {
    const batch = writeBatch(db);

    // If reassigning members, update their department
    if (reassignToDeptId) {
      const usersQuery = query(
        collection(db, "users"),
        where("departmentId", "==", departmentId)
      );
      const usersSnapshot = await getDocs(usersQuery);

      usersSnapshot.forEach((userDoc) => {
        batch.update(userDoc.ref, {
          departmentId: reassignToDeptId,
          updatedAt: serverTimestamp(),
        });
      });
    }

    // Soft delete the department
    const departmentRef = doc(db, "departments", departmentId);
    batch.update(departmentRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    return {
      success: true,
      message: "Department deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting department:", error);
    throw new Error("Failed to delete department");
  }
};

/**
 * Get all departments for a company
 * @param {string} companyId - Company ID
 * @param {boolean} includeInactive - Include inactive departments
 * @returns {Promise<Array>}
 */
export const getDepartments = async (companyId, includeInactive = false) => {
  try {
    const departmentsRef = collection(db, "departments");
    let q = query(
      departmentsRef,
      where("companyId", "==", companyId),
      orderBy("name", "asc")
    );

    if (!includeInactive) {
      q = query(
        departmentsRef,
        where("companyId", "==", companyId),
        where("isActive", "==", true),
        orderBy("name", "asc")
      );
    }

    const snapshot = await getDocs(q);

    // Fetch all users once to avoid N+1 queries
    const usersQuery = query(
      collection(db, "users"),
      where("companyId", "==", companyId),
      where("status", "==", "active")
    );
    const usersSnapshot = await getDocs(usersQuery);

    // Count members per department
    const memberCounts = {};
    usersSnapshot.forEach((userDoc) => {
      const deptId = userDoc.data().departmentId;
      if (deptId) {
        memberCounts[deptId] = (memberCounts[deptId] || 0) + 1;
      }
    });

    // Build departments array with member counts
    const departments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      memberCount: memberCounts[doc.id] || 0,
    }));

    return departments;
  } catch (error) {
    console.error("Error fetching departments:", error);
    throw new Error("Failed to fetch departments");
  }
};

/**
 * Get single department details
 * @param {string} departmentId - Department ID
 * @returns {Promise<object>}
 */
export const getDepartmentById = async (departmentId) => {
  try {
    const departmentRef = doc(db, "departments", departmentId);
    const departmentSnap = await getDoc(departmentRef);

    if (!departmentSnap.exists()) {
      throw new Error("Department not found");
    }

    const department = {
      id: departmentSnap.id,
      ...departmentSnap.data(),
    };

    // Get members
    const membersQuery = query(
      collection(db, "users"),
      where("departmentId", "==", departmentId),
      where("status", "==", "active")
    );
    const membersSnapshot = await getDocs(membersQuery);

    department.members = membersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    department.memberCount = department.members.length;

    // Get department head if exists
    if (department.headUserId) {
      const headRef = doc(db, "users", department.headUserId);
      const headSnap = await getDoc(headRef);
      if (headSnap.exists()) {
        department.head = { id: headSnap.id, ...headSnap.data() };
      }
    }

    return department;
  } catch (error) {
    console.error("Error fetching department:", error);
    throw new Error("Failed to fetch department details");
  }
};

// ============================================
// USER-DEPARTMENT ASSIGNMENT
// ============================================

/**
 * Assign user to department
 * @param {string} userId - User ID
 * @param {string} departmentId - Department ID
 * @returns {Promise<{success: boolean}>}
 */
export const assignUserToDepartment = async (userId, departmentId) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("User not found");
    }

    const oldDepartmentId = userSnap.data().departmentId;

    // Update user's department
    await updateDoc(userRef, {
      departmentId,
      previousDepartmentId: oldDepartmentId,
      departmentChangedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Log the assignment change
    await addDoc(collection(db, "departmentAssignmentLogs"), {
      userId,
      userName: userSnap.data().displayName,
      oldDepartmentId,
      newDepartmentId: departmentId,
      changedAt: serverTimestamp(),
    });

    return {
      success: true,
      message: "User assigned to department successfully",
    };
  } catch (error) {
    console.error("Error assigning user to department:", error);
    throw new Error("Failed to assign user to department");
  }
};

/**
 * Bulk assign users to department
 * @param {Array<string>} userIds - Array of user IDs
 * @param {string} departmentId - Department ID
 * @returns {Promise<{success: boolean, results: Array}>}
 */
export const bulkAssignUsersToDepartment = async (userIds, departmentId) => {
  try {
    const batch = writeBatch(db);
    const results = [];

    for (const userId of userIds) {
      try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          batch.update(userRef, {
            departmentId,
            departmentChangedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          results.push({ userId, success: true });
        } else {
          results.push({ userId, success: false, error: "User not found" });
        }
      } catch (error) {
        results.push({ userId, success: false, error: error.message });
      }
    }

    await batch.commit();

    return {
      success: true,
      results,
      message: `${
        results.filter((r) => r.success).length
      } users assigned successfully`,
    };
  } catch (error) {
    console.error("Error in bulk assignment:", error);
    throw new Error("Failed to complete bulk assignment");
  }
};

/**
 * Remove user from department
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean}>}
 */
export const removeUserFromDepartment = async (userId) => {
  try {
    const userRef = doc(db, "users", userId);

    await updateDoc(userRef, {
      departmentId: null,
      departmentChangedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      success: true,
      message: "User removed from department",
    };
  } catch (error) {
    console.error("Error removing user from department:", error);
    throw new Error("Failed to remove user from department");
  }
};

/**
 * Set department head
 * @param {string} departmentId - Department ID
 * @param {string} userId - User ID to set as head
 * @returns {Promise<{success: boolean}>}
 */
export const setDepartmentHead = async (departmentId, userId) => {
  try {
    const departmentRef = doc(db, "departments", departmentId);

    // First, ensure the user is in this department
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("User not found");
    }

    if (userSnap.data().departmentId !== departmentId) {
      // Assign user to department first
      await updateDoc(userRef, {
        departmentId,
        updatedAt: serverTimestamp(),
      });
    }

    // Update department head
    await updateDoc(departmentRef, {
      headUserId: userId,
      headUserName: userSnap.data().displayName,
      updatedAt: serverTimestamp(),
    });

    // Update user role if needed
    await updateDoc(userRef, {
      isDepartmentHead: true,
      updatedAt: serverTimestamp(),
    });

    return {
      success: true,
      message: "Department head set successfully",
    };
  } catch (error) {
    console.error("Error setting department head:", error);
    throw new Error("Failed to set department head");
  }
};

// ============================================
// DEPARTMENT ANALYTICS
// ============================================

/**
 * Get department statistics
 * @param {string} departmentId - Department ID
 * @returns {Promise<object>}
 */
export const getDepartmentStats = async (departmentId) => {
  try {
    const stats = {
      totalMembers: 0,
      activeMembers: 0,
      totalPosts: 0,
      resolvedIssues: 0,
      pendingIssues: 0,
      avgResponseTime: 0,
    };

    // Get members count
    const membersQuery = query(
      collection(db, "users"),
      where("departmentId", "==", departmentId)
    );
    const membersSnapshot = await getDocs(membersQuery);
    stats.totalMembers = membersSnapshot.size;
    stats.activeMembers = membersSnapshot.docs.filter(
      (doc) => doc.data().status === "active"
    ).length;

    // Get posts assigned to department
    const postsQuery = query(
      collection(db, "posts"),
      where("assignedToDepartment", "==", departmentId)
    );
    const postsSnapshot = await getDocs(postsQuery);
    stats.totalPosts = postsSnapshot.size;

    // Count by status
    postsSnapshot.forEach((doc) => {
      const post = doc.data();
      if (post.status === "resolved" || post.status === "closed") {
        stats.resolvedIssues++;
      } else if (post.status === "open" || post.status === "in_progress") {
        stats.pendingIssues++;
      }
    });

    return stats;
  } catch (error) {
    console.error("Error fetching department stats:", error);
    throw new Error("Failed to fetch department statistics");
  }
};

/**
 * Get departments hierarchy
 * @param {string} companyId - Company ID
 * @returns {Promise<object>}
 */
export const getDepartmentHierarchy = async (companyId) => {
  try {
    const departments = await getDepartments(companyId, false);

    // Build hierarchy tree
    const hierarchy = departments.reduce((tree, dept) => {
      if (!dept.parentDepartmentId) {
        // Root level department
        tree[dept.id] = {
          ...dept,
          children: [],
        };
      }
      return tree;
    }, {});

    // Add child departments
    departments.forEach((dept) => {
      if (dept.parentDepartmentId && hierarchy[dept.parentDepartmentId]) {
        hierarchy[dept.parentDepartmentId].children.push(dept);
      }
    });

    return hierarchy;
  } catch (error) {
    console.error("Error building department hierarchy:", error);
    throw new Error("Failed to build department hierarchy");
  }
};
