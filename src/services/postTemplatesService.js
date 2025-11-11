import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

// ============================================
// POST TEMPLATES
// ============================================

/**
 * Create post template
 * @param {object} templateData - Template data
 * @param {object} creator - User creating the template
 * @returns {Promise<string>} - Template ID
 */
export const createTemplate = async (templateData, creator) => {
  try {
    const template = {
      name: templateData.name,
      description: templateData.description || "",
      type: templateData.type, // creative_content, problem_report, team_discussion
      title: templateData.title,
      content: templateData.content,
      category: templateData.category,
      tags: templateData.tags || [],
      companyId: creator.companyId,
      createdBy: creator.displayName,
      createdById: creator.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
      useCount: 0,
    };

    const docRef = await addDoc(collection(db, "postTemplates"), template);

    return { success: true, templateId: docRef.id };
  } catch (error) {
    console.error("Error creating template:", error);
    throw error;
  }
};

/**
 * Get templates for a company
 * @param {string} companyId - Company ID
 * @param {string} type - Optional: filter by post type
 * @returns {Promise<Array>}
 */
export const getTemplates = async (companyId, type = null) => {
  try {
    const templatesRef = collection(db, "postTemplates");
    let q;

    if (type) {
      q = query(
        templatesRef,
        where("companyId", "==", companyId),
        where("type", "==", type),
        where("isActive", "==", true),
        orderBy("name", "asc")
      );
    } else {
      q = query(
        templatesRef,
        where("companyId", "==", companyId),
        where("isActive", "==", true),
        orderBy("name", "asc")
      );
    }

    const snapshot = await getDocs(q);
    const templates = [];

    snapshot.forEach((doc) => {
      templates.push({ id: doc.id, ...doc.data() });
    });

    return templates;
  } catch (error) {
    console.error("Error fetching templates:", error);
    return [];
  }
};

/**
 * Get single template
 * @param {string} templateId - Template ID
 * @returns {Promise<object>}
 */
export const getTemplate = async (templateId) => {
  try {
    const templateRef = doc(db, "postTemplates", templateId);
    const templateSnap = await getDoc(templateRef);

    if (!templateSnap.exists()) {
      throw new Error("Template not found");
    }

    return { id: templateSnap.id, ...templateSnap.data() };
  } catch (error) {
    console.error("Error fetching template:", error);
    throw error;
  }
};

/**
 * Update template
 * @param {string} templateId - Template ID
 * @param {object} updateData - Updated data
 * @param {object} editor - User editing
 * @returns {Promise<void>}
 */
export const updateTemplate = async (templateId, updateData, editor) => {
  try {
    const templateRef = doc(db, "postTemplates", templateId);
    const templateSnap = await getDoc(templateRef);

    if (!templateSnap.exists()) {
      throw new Error("Template not found");
    }

    // Verify editor has permission
    if (
      templateSnap.data().createdById !== editor.id &&
      editor.role !== "company_admin" &&
      editor.role !== "super_admin"
    ) {
      throw new Error("Unauthorized to edit this template");
    }

    await updateDoc(templateRef, {
      ...updateData,
      updatedAt: serverTimestamp(),
      lastUpdatedBy: editor.displayName,
      lastUpdatedById: editor.id,
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating template:", error);
    throw error;
  }
};

/**
 * Delete template (soft delete by setting isActive = false)
 * @param {string} templateId - Template ID
 * @param {object} user - User deleting
 * @returns {Promise<void>}
 */
export const deleteTemplate = async (templateId, user) => {
  try {
    const templateRef = doc(db, "postTemplates", templateId);
    const templateSnap = await getDoc(templateRef);

    if (!templateSnap.exists()) {
      throw new Error("Template not found");
    }

    // Verify user has permission
    if (
      templateSnap.data().createdById !== user.id &&
      user.role !== "company_admin" &&
      user.role !== "super_admin"
    ) {
      throw new Error("Unauthorized to delete this template");
    }

    await updateDoc(templateRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
      deletedBy: user.displayName,
      deletedById: user.id,
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting template:", error);
    throw error;
  }
};

/**
 * Increment template use count
 * @param {string} templateId - Template ID
 * @returns {Promise<void>}
 */
export const incrementTemplateUseCount = async (templateId) => {
  try {
    const templateRef = doc(db, "postTemplates", templateId);

    await updateDoc(templateRef, {
      useCount: (await getDoc(templateRef)).data().useCount + 1,
      lastUsedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error incrementing template use count:", error);
    // Non-critical, don't throw
    return { success: false };
  }
};

/**
 * Get most used templates
 * @param {string} companyId - Company ID
 * @param {number} limit - Number of templates to return
 * @returns {Promise<Array>}
 */
export const getMostUsedTemplates = async (companyId, limit = 5) => {
  try {
    const templatesRef = collection(db, "postTemplates");
    const q = query(
      templatesRef,
      where("companyId", "==", companyId),
      where("isActive", "==", true),
      orderBy("useCount", "desc"),
      orderBy("name", "asc")
    );

    const snapshot = await getDocs(q);
    const templates = [];

    snapshot.docs.slice(0, limit).forEach((doc) => {
      templates.push({ id: doc.id, ...doc.data() });
    });

    return templates;
  } catch (error) {
    console.error("Error fetching most used templates:", error);
    return [];
  }
};

// ============================================
// DEFAULT TEMPLATES (Pre-defined examples)
// ============================================

export const DEFAULT_TEMPLATES = {
  safety_issue: {
    name: "Safety Issue Report",
    type: "problem_report",
    category: "Safety Issue",
    title: "Safety Concern: [Location/Area]",
    content: `**What is the safety concern?**
[Describe the safety issue]

**Where is it located?**
[Specific location]

**When did you notice it?**
[Date/Time]

**Potential risk level:**
[Low/Medium/High/Critical]

**Immediate action needed?**
[Yes/No - Explain]`,
    tags: ["safety", "urgent"],
  },
  equipment_issue: {
    name: "Equipment Problem Report",
    type: "problem_report",
    category: "Equipment Problem",
    title: "Equipment Issue: [Equipment Name]",
    content: `**Equipment Name/ID:**
[Name and ID]

**Problem Description:**
[What's not working]

**Impact on Work:**
[How this affects productivity]

**When did it start?**
[Date/Time]

**Error messages (if any):**
[Error details]`,
    tags: ["equipment", "maintenance"],
  },
  idea_suggestion: {
    name: "Idea or Suggestion",
    type: "team_discussion",
    category: "Ideas & Suggestions",
    title: "[Brief description of your idea]",
    content: `**The Idea:**
[Explain your idea clearly]

**Why this would help:**
[Benefits and value]

**How it could work:**
[Implementation approach]

**Resources needed:**
[What would be required]

**Potential challenges:**
[Any concerns or obstacles]`,
    tags: ["innovation", "improvement"],
  },
  team_update: {
    name: "Team Update",
    type: "team_discussion",
    category: "Team Updates",
    title: "[Team Name] - [Update Type]",
    content: `**Update Summary:**
[Brief overview]

**Key Points:**
- [Point 1]
- [Point 2]
- [Point 3]

**Action Items:**
- [ ] [Action 1]
- [ ] [Action 2]

**Questions or Feedback:**
[How team members can respond]`,
    tags: ["team", "update"],
  },
  project_success: {
    name: "Project Success Story",
    type: "creative_content",
    category: "Success Story",
    title: "Success: [Project Name]",
    content: `**Project Overview:**
[What was accomplished]

**The Challenge:**
[What problem was solved]

**Our Approach:**
[How we did it]

**Results:**
[Metrics and outcomes]

**Team Recognition:**
[Thank contributors]

**Lessons Learned:**
[Key takeaways]`,
    tags: ["success", "teamwork", "achievement"],
  },
  process_improvement: {
    name: "Process Improvement Suggestion",
    type: "team_discussion",
    category: "Ideas & Suggestions",
    title: "Process Improvement: [Process Name]",
    content: `**Current Process:**
[How it works now]

**Issues with Current Process:**
[Pain points and inefficiencies]

**Proposed Improvement:**
[Suggested changes]

**Expected Benefits:**
- [Benefit 1]
- [Benefit 2]

**Implementation Steps:**
1. [Step 1]
2. [Step 2]
3. [Step 3]`,
    tags: ["process", "improvement", "efficiency"],
  },
};

/**
 * Initialize default templates for a company
 * @param {string} companyId - Company ID
 * @param {object} admin - Admin user
 * @returns {Promise<void>}
 */
export const initializeDefaultTemplates = async (companyId, admin) => {
  try {
    const templates = [];

    for (const [key, templateData] of Object.entries(DEFAULT_TEMPLATES)) {
      templates.push(
        createTemplate(
          {
            ...templateData,
            description: `Pre-defined template for ${templateData.name}`,
          },
          { ...admin, companyId }
        )
      );
    }

    await Promise.all(templates);

    return { success: true, count: templates.length };
  } catch (error) {
    console.error("Error initializing default templates:", error);
    throw error;
  }
};
