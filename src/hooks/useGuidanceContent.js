import { useTranslation } from 'react-i18next';

/**
 * Hook that returns all guidance/help content translated to the current language.
 * Mirrors the structure of guidanceContent.js but uses i18n translations.
 */
const useGuidanceContent = () => {
  const { t } = useTranslation();

  const ROLE_DEFINITIONS = {
    super_admin: {
      name: t('guidance.roles.superAdmin.name'),
      description: t('guidance.roles.superAdmin.description'),
      responsibilities: t('guidance.roles.superAdmin.responsibilities', { returnObjects: true }),
      icon: '👑'
    },
    company_admin: {
      name: t('guidance.roles.companyAdmin.name'),
      description: t('guidance.roles.companyAdmin.description'),
      responsibilities: t('guidance.roles.companyAdmin.responsibilities', { returnObjects: true }),
      icon: '⚙️'
    },
    hr: {
      name: t('guidance.roles.hr.name'),
      description: t('guidance.roles.hr.description'),
      responsibilities: t('guidance.roles.hr.responsibilities', { returnObjects: true }),
      icon: '👥'
    },
    employee: {
      name: t('guidance.roles.employee.name'),
      description: t('guidance.roles.employee.description'),
      responsibilities: t('guidance.roles.employee.responsibilities', { returnObjects: true }),
      icon: '👤'
    }
  };

  const POST_STATUS_GUIDANCE = {
    title: t('guidance.postStatus.title'),
    description: t('guidance.postStatus.description'),
    statuses: {
      OPEN: { label: t('guidance.postStatus.statuses.OPEN.label'), description: t('guidance.postStatus.statuses.OPEN.description'), whenToUse: t('guidance.postStatus.statuses.OPEN.whenToUse'), color: 'blue', icon: '📬' },
      ACKNOWLEDGED: { label: t('guidance.postStatus.statuses.ACKNOWLEDGED.label'), description: t('guidance.postStatus.statuses.ACKNOWLEDGED.description'), whenToUse: t('guidance.postStatus.statuses.ACKNOWLEDGED.whenToUse'), color: 'purple', icon: '👁️' },
      IN_PROGRESS: { label: t('guidance.postStatus.statuses.IN_PROGRESS.label'), description: t('guidance.postStatus.statuses.IN_PROGRESS.description'), whenToUse: t('guidance.postStatus.statuses.IN_PROGRESS.whenToUse'), color: 'yellow', icon: '🔄' },
      UNDER_REVIEW: { label: t('guidance.postStatus.statuses.UNDER_REVIEW.label'), description: t('guidance.postStatus.statuses.UNDER_REVIEW.description'), whenToUse: t('guidance.postStatus.statuses.UNDER_REVIEW.whenToUse'), color: 'orange', icon: '🔍' },
      WORKING_ON: { label: t('guidance.postStatus.statuses.WORKING_ON.label'), description: t('guidance.postStatus.statuses.WORKING_ON.description'), whenToUse: t('guidance.postStatus.statuses.WORKING_ON.whenToUse'), color: 'indigo', icon: '📤' },
      RESOLVED: { label: t('guidance.postStatus.statuses.RESOLVED.label'), description: t('guidance.postStatus.statuses.RESOLVED.description'), whenToUse: t('guidance.postStatus.statuses.RESOLVED.whenToUse'), color: 'green', icon: '✅' },
      CLOSED: { label: t('guidance.postStatus.statuses.CLOSED.label'), description: t('guidance.postStatus.statuses.CLOSED.description'), whenToUse: t('guidance.postStatus.statuses.CLOSED.whenToUse'), color: 'gray', icon: '🔒' },
      REJECTED: { label: t('guidance.postStatus.statuses.REJECTED.label'), description: t('guidance.postStatus.statuses.REJECTED.description'), whenToUse: t('guidance.postStatus.statuses.REJECTED.whenToUse'), color: 'red', icon: '❌' },
      NOT_A_PROBLEM: { label: t('guidance.postStatus.statuses.NOT_A_PROBLEM.label'), description: t('guidance.postStatus.statuses.NOT_A_PROBLEM.description'), whenToUse: t('guidance.postStatus.statuses.NOT_A_PROBLEM.whenToUse'), color: 'slate', icon: 'ℹ️' }
    },
    bestPractices: t('guidance.postStatus.bestPractices', { returnObjects: true })
  };

  const PRIORITY_GUIDANCE = {
    title: t('guidance.priority.title'),
    description: t('guidance.priority.description'),
    levels: {
      CRITICAL: { label: t('guidance.priority.levels.CRITICAL.label'), description: t('guidance.priority.levels.CRITICAL.description'), criteria: t('guidance.priority.levels.CRITICAL.criteria', { returnObjects: true }), color: 'red', icon: '🚨' },
      HIGH: { label: t('guidance.priority.levels.HIGH.label'), description: t('guidance.priority.levels.HIGH.description'), criteria: t('guidance.priority.levels.HIGH.criteria', { returnObjects: true }), color: 'orange', icon: '⚡' },
      MEDIUM: { label: t('guidance.priority.levels.MEDIUM.label'), description: t('guidance.priority.levels.MEDIUM.description'), criteria: t('guidance.priority.levels.MEDIUM.criteria', { returnObjects: true }), color: 'yellow', icon: '📊' },
      LOW: { label: t('guidance.priority.levels.LOW.label'), description: t('guidance.priority.levels.LOW.description'), criteria: t('guidance.priority.levels.LOW.criteria', { returnObjects: true }), color: 'green', icon: '💡' }
    },
    bestPractices: t('guidance.priority.bestPractices', { returnObjects: true })
  };

  const TAG_SYSTEM_GUIDANCE = {
    title: t('guidance.tags.title'),
    description: t('guidance.tags.description'),
    purpose: t('guidance.tags.purpose'),
    tags: {
      EXECUTIVE: { label: t('guidance.tags.items.EXECUTIVE.label'), description: t('guidance.tags.items.EXECUTIVE.description'), examples: t('guidance.tags.items.EXECUTIVE.examples', { returnObjects: true }), priority: 5, color: 'purple', icon: '🎯' },
      SENIOR_MANAGER: { label: t('guidance.tags.items.SENIOR_MANAGER.label'), description: t('guidance.tags.items.SENIOR_MANAGER.description'), examples: t('guidance.tags.items.SENIOR_MANAGER.examples', { returnObjects: true }), priority: 4, color: 'blue', icon: '🎯' },
      MANAGER: { label: t('guidance.tags.items.MANAGER.label'), description: t('guidance.tags.items.MANAGER.description'), examples: t('guidance.tags.items.MANAGER.examples', { returnObjects: true }), priority: 3, color: 'indigo', icon: '📊' },
      SPECIALIST: { label: t('guidance.tags.items.SPECIALIST.label'), description: t('guidance.tags.items.SPECIALIST.description'), examples: t('guidance.tags.items.SPECIALIST.examples', { returnObjects: true }), priority: 2, color: 'green', icon: '🔧' },
      STAFF: { label: t('guidance.tags.items.STAFF.label'), description: t('guidance.tags.items.STAFF.description'), examples: t('guidance.tags.items.STAFF.examples', { returnObjects: true }), priority: 1, color: 'gray', icon: '👤' }
    },
    howToAssign: t('guidance.tags.howToAssign', { returnObjects: true }),
    bestPractices: t('guidance.tags.bestPractices', { returnObjects: true })
  };

  const DEPARTMENT_GUIDANCE = {
    title: t('guidance.departments.title'),
    description: t('guidance.departments.description'),
    whatAreDepartments: t('guidance.departments.whatAreDepartments'),
    howToCreate: t('guidance.departments.howToCreate', { returnObjects: true }),
    bestPractices: t('guidance.departments.bestPractices', { returnObjects: true }),
    useCases: t('guidance.departments.useCases', { returnObjects: true })
  };

  const MEMBER_MANAGEMENT_GUIDANCE = {
    title: t('guidance.memberManagement.title'),
    description: t('guidance.memberManagement.description'),
    memberStatuses: {
      ACTIVE: { label: t('guidance.memberManagement.statuses.ACTIVE.label'), description: t('guidance.memberManagement.statuses.ACTIVE.description'), icon: '✅' },
      PENDING: { label: t('guidance.memberManagement.statuses.PENDING.label'), description: t('guidance.memberManagement.statuses.PENDING.description'), icon: '⏳' },
      SUSPENDED: { label: t('guidance.memberManagement.statuses.SUSPENDED.label'), description: t('guidance.memberManagement.statuses.SUSPENDED.description'), icon: '⛔' }
    },
    howToManage: t('guidance.memberManagement.howToManage', { returnObjects: true }),
    roleAssignment: t('guidance.memberManagement.roleAssignment', { returnObjects: true }),
    bulkOperations: t('guidance.memberManagement.bulkOperations', { returnObjects: true }),
    bestPractices: t('guidance.memberManagement.bestPractices', { returnObjects: true })
  };

  const TEMPLATE_GUIDANCE = {
    title: t('guidance.templates.title'),
    description: t('guidance.templates.description'),
    whatAreTemplates: t('guidance.templates.whatAreTemplates'),
    howToCreate: t('guidance.templates.howToCreate', { returnObjects: true }),
    howToUse: t('guidance.templates.howToUse', { returnObjects: true }),
    templateExamples: [
      {
        name: 'Bug Report Template',
        type: 'Problem Report',
        content: 'Steps to reproduce:\n1. \n2. \n3. \n\nExpected behavior:\n\nActual behavior:\n\nScreenshots/Evidence:'
      },
      {
        name: 'Feature Request Template',
        type: 'Idea Suggestion',
        content: 'Problem:\n\nProposed Solution:\n\nExpected Benefits:\n\nAlternatives Considered:'
      },
      {
        name: 'Team Update Template',
        type: 'Team Discussion',
        content: 'What we accomplished:\n\nWhat\'s next:\n\nBlockers/Concerns:\n\nShout-outs:'
      }
    ],
    bestPractices: t('guidance.templates.bestPractices', { returnObjects: true })
  };

  const ANALYTICS_GUIDANCE = {
    title: t('guidance.analytics.title'),
    description: t('guidance.analytics.description'),
    keyMetrics: {
      postsByType: { label: t('guidance.analytics.metrics.postsByType.label'), description: t('guidance.analytics.metrics.postsByType.description'), useCase: t('guidance.analytics.metrics.postsByType.useCase') },
      postsByStatus: { label: t('guidance.analytics.metrics.postsByStatus.label'), description: t('guidance.analytics.metrics.postsByStatus.description'), useCase: t('guidance.analytics.metrics.postsByStatus.useCase') },
      postsByPriority: { label: t('guidance.analytics.metrics.postsByPriority.label'), description: t('guidance.analytics.metrics.postsByPriority.description'), useCase: t('guidance.analytics.metrics.postsByPriority.useCase') },
      engagementMetrics: { label: t('guidance.analytics.metrics.engagementMetrics.label'), description: t('guidance.analytics.metrics.engagementMetrics.description'), useCase: t('guidance.analytics.metrics.engagementMetrics.useCase') },
      responseTime: { label: t('guidance.analytics.metrics.responseTime.label'), description: t('guidance.analytics.metrics.responseTime.description'), useCase: t('guidance.analytics.metrics.responseTime.useCase') },
      departmentPerformance: { label: t('guidance.analytics.metrics.departmentPerformance.label'), description: t('guidance.analytics.metrics.departmentPerformance.description'), useCase: t('guidance.analytics.metrics.departmentPerformance.useCase') }
    },
    howToUse: t('guidance.analytics.howToUse', { returnObjects: true }),
    bestPractices: t('guidance.analytics.bestPractices', { returnObjects: true })
  };

  const MODERATION_GUIDANCE = {
    title: t('guidance.moderation.title'),
    description: t('guidance.moderation.description'),
    reportStatuses: {
      PENDING: { label: t('guidance.moderation.reportStatuses.PENDING.label'), description: t('guidance.moderation.reportStatuses.PENDING.description'), action: t('guidance.moderation.reportStatuses.PENDING.action'), icon: '🔔' },
      UNDER_REVIEW: { label: t('guidance.moderation.reportStatuses.UNDER_REVIEW.label'), description: t('guidance.moderation.reportStatuses.UNDER_REVIEW.description'), action: t('guidance.moderation.reportStatuses.UNDER_REVIEW.action'), icon: '🔍' },
      RESOLVED: { label: t('guidance.moderation.reportStatuses.RESOLVED.label'), description: t('guidance.moderation.reportStatuses.RESOLVED.description'), action: t('guidance.moderation.reportStatuses.RESOLVED.action'), icon: '✅' },
      DISMISSED: { label: t('guidance.moderation.reportStatuses.DISMISSED.label'), description: t('guidance.moderation.reportStatuses.DISMISSED.description'), action: t('guidance.moderation.reportStatuses.DISMISSED.action'), icon: '✖️' }
    },
    moderationActions: (t('guidance.moderation.actions', { returnObjects: true }) || []).map((a, i) => ({
      ...a,
      icon: ['👍', '⚠️', '🗑️', '🚫'][i]
    })),
    reviewProcess: t('guidance.moderation.reviewProcess', { returnObjects: true }),
    bestPractices: t('guidance.moderation.bestPractices', { returnObjects: true })
  };

  const POST_CREATION_GUIDANCE = {
    title: t('guidance.postCreation.title'),
    description: t('guidance.postCreation.description'),
    postTypes: {
      problem_report: { label: t('guidance.postCreation.postTypes.problem_report.label'), description: t('guidance.postCreation.postTypes.problem_report.description'), whenToUse: t('guidance.postCreation.postTypes.problem_report.whenToUse'), tips: t('guidance.postCreation.postTypes.problem_report.tips', { returnObjects: true }), icon: '🐛' },
      idea_suggestion: { label: t('guidance.postCreation.postTypes.idea_suggestion.label'), description: t('guidance.postCreation.postTypes.idea_suggestion.description'), whenToUse: t('guidance.postCreation.postTypes.idea_suggestion.whenToUse'), tips: t('guidance.postCreation.postTypes.idea_suggestion.tips', { returnObjects: true }), icon: '💡' },
      creative_content: { label: t('guidance.postCreation.postTypes.creative_content.label'), description: t('guidance.postCreation.postTypes.creative_content.description'), whenToUse: t('guidance.postCreation.postTypes.creative_content.whenToUse'), tips: t('guidance.postCreation.postTypes.creative_content.tips', { returnObjects: true }), icon: '🎨' },
      team_discussion: { label: t('guidance.postCreation.postTypes.team_discussion.label'), description: t('guidance.postCreation.postTypes.team_discussion.description'), whenToUse: t('guidance.postCreation.postTypes.team_discussion.whenToUse'), tips: t('guidance.postCreation.postTypes.team_discussion.tips', { returnObjects: true }), icon: '💬' }
    },
    privacySettings: {
      COMPANY_PUBLIC: { label: t('guidance.postCreation.privacySettings.COMPANY_PUBLIC.label'), description: t('guidance.postCreation.privacySettings.COMPANY_PUBLIC.description'), icon: '🌐' },
      DEPARTMENT_ONLY: { label: t('guidance.postCreation.privacySettings.DEPARTMENT_ONLY.label'), description: t('guidance.postCreation.privacySettings.DEPARTMENT_ONLY.description'), icon: '👥' },
      HR_ONLY: { label: t('guidance.postCreation.privacySettings.HR_ONLY.label'), description: t('guidance.postCreation.privacySettings.HR_ONLY.description'), icon: '🔒' }
    },
    bestPractices: t('guidance.postCreation.bestPractices', { returnObjects: true })
  };

  const QR_CODE_GUIDANCE = {
    title: t('guidance.qrCode.title'),
    description: t('guidance.qrCode.description'),
    howItWorks: t('guidance.qrCode.howItWorks', { returnObjects: true }),
    howToGenerate: t('guidance.qrCode.howToGenerate', { returnObjects: true }),
    distributionMethods: t('guidance.qrCode.distributionMethods', { returnObjects: true }),
    bestPractices: t('guidance.qrCode.bestPractices', { returnObjects: true })
  };

  const ASSIGNED_TO_ME_GUIDANCE = {
    title: t('guidance.assignedToMe.title'),
    description: t('guidance.assignedToMe.description'),
    howItWorks: t('guidance.assignedToMe.howItWorks', { returnObjects: true }),
    whatToExpect: t('guidance.assignedToMe.whatToExpect', { returnObjects: true }),
    howToManage: t('guidance.assignedToMe.howToManage', { returnObjects: true }),
    bestPractices: t('guidance.assignedToMe.bestPractices', { returnObjects: true })
  };

  return {
    ROLE_DEFINITIONS,
    POST_STATUS_GUIDANCE,
    PRIORITY_GUIDANCE,
    TAG_SYSTEM_GUIDANCE,
    DEPARTMENT_GUIDANCE,
    MEMBER_MANAGEMENT_GUIDANCE,
    TEMPLATE_GUIDANCE,
    ANALYTICS_GUIDANCE,
    MODERATION_GUIDANCE,
    POST_CREATION_GUIDANCE,
    QR_CODE_GUIDANCE,
    ASSIGNED_TO_ME_GUIDANCE
  };
};

export default useGuidanceContent;
