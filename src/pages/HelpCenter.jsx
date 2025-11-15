import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Search, ChevronRight } from 'lucide-react';
import HelpPanel from '../components/help/HelpPanel';
import {
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
} from '../utils/guidanceContent';

const HelpCenter = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('getting-started');

  const sections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: '🚀',
      topics: [
        { id: 'roles', title: 'Understanding Roles & Permissions', content: 'role-definitions' },
        { id: 'navigation', title: 'Navigating the Platform', content: 'navigation' },
      ]
    },
    {
      id: 'posts',
      title: 'Working with Posts',
      icon: '📝',
      topics: [
        { id: 'create-post', title: 'Creating Posts', content: 'post-creation' },
        { id: 'post-status', title: 'Post Status Workflow', content: 'post-status' },
        { id: 'post-priority', title: 'Priority Levels', content: 'priority' },
        { id: 'assigned', title: 'Assigned to Me', content: 'assigned-to-me' },
      ]
    },
    {
      id: 'admin',
      title: 'Admin Features',
      icon: '⚙️',
      topics: [
        { id: 'members', title: 'Member Management', content: 'member-management' },
        { id: 'departments', title: 'Department Management', content: 'departments' },
        { id: 'tags', title: 'User Tags', content: 'tags' },
        { id: 'templates', title: 'Post Templates', content: 'templates' },
        { id: 'moderation', title: 'Content Moderation', content: 'moderation' },
        { id: 'analytics', title: 'Analytics & Reporting', content: 'analytics' },
        { id: 'qr-code', title: 'QR Code Invitations', content: 'qr-code' },
      ]
    },
  ];

  const renderContent = (contentId) => {
    switch (contentId) {
      case 'role-definitions':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Understanding Roles & Permissions</h3>
              <p className="text-gray-600 mb-6">
                Company Voice has four main user roles, each with specific responsibilities and permissions.
              </p>
            </div>

            {Object.entries(ROLE_DEFINITIONS).map(([roleKey, role]) => (
              <div key={roleKey} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{role.icon}</span>
                  <div>
                    <h4 className="text-xl font-semibold text-gray-800">{role.name}</h4>
                    <p className="text-gray-600">{role.description}</p>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-gray-700 mb-2">Key Responsibilities:</p>
                  <ul className="space-y-1">
                    {role.responsibilities.map((resp, idx) => (
                      <li key={idx} className="text-gray-600 flex items-start gap-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm">
                For a complete permissions matrix showing what each role can do, visit the{' '}
                <button
                  onClick={() => navigate('/help/roles')}
                  className="font-semibold underline hover:text-blue-900"
                >
                  Role Definitions page
                </button>
              </p>
            </div>
          </div>
        );

      case 'post-status':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{POST_STATUS_GUIDANCE.title}</h3>
              <p className="text-gray-600 mb-6">{POST_STATUS_GUIDANCE.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(POST_STATUS_GUIDANCE.statuses).map(([key, status]) => (
                <div key={key} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{status.icon}</span>
                    <h4 className="font-semibold text-gray-800">{status.label}</h4>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">{status.description}</p>
                  <p className="text-xs text-gray-500">
                    <strong>When to use:</strong> {status.whenToUse}
                  </p>
                </div>
              ))}
            </div>

            <HelpPanel title="Best Practices" variant="info" defaultExpanded={false}>
              <ul className="space-y-2">
                {POST_STATUS_GUIDANCE.bestPractices.map((practice, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">✓</span>
                    <span className="text-gray-700">{practice}</span>
                  </li>
                ))}
              </ul>
            </HelpPanel>
          </div>
        );

      case 'priority':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{PRIORITY_GUIDANCE.title}</h3>
              <p className="text-gray-600 mb-6">{PRIORITY_GUIDANCE.description}</p>
            </div>

            <div className="space-y-4">
              {Object.entries(PRIORITY_GUIDANCE.levels).map(([key, level]) => (
                <div key={key} className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{level.icon}</span>
                    <h4 className="font-semibold text-gray-800 text-lg">{level.label}</h4>
                  </div>
                  <p className="text-gray-600 mb-3">{level.description}</p>
                  <div>
                    <p className="font-medium text-gray-700 text-sm mb-2">Criteria:</p>
                    <ul className="space-y-1">
                      {level.criteria.map((criterion, idx) => (
                        <li key={idx} className="text-gray-600 text-sm flex items-start gap-2">
                          <span className="text-blue-600 mt-1">•</span>
                          <span>{criterion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            <HelpPanel title="Best Practices" variant="info" defaultExpanded={false}>
              <ul className="space-y-2">
                {PRIORITY_GUIDANCE.bestPractices.map((practice, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">✓</span>
                    <span className="text-gray-700">{practice}</span>
                  </li>
                ))}
              </ul>
            </HelpPanel>
          </div>
        );

      case 'tags':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{TAG_SYSTEM_GUIDANCE.title}</h3>
              <p className="text-gray-600 mb-2">{TAG_SYSTEM_GUIDANCE.description}</p>
              <p className="text-blue-600 bg-blue-50 p-3 rounded-lg text-sm">{TAG_SYSTEM_GUIDANCE.purpose}</p>
            </div>

            <div className="space-y-3">
              {Object.entries(TAG_SYSTEM_GUIDANCE.tags).map(([key, tag]) => (
                <div key={key} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{tag.icon}</span>
                    <h4 className="font-semibold text-gray-800">{tag.label}</h4>
                    <span className="ml-auto text-xs bg-gray-100 px-2 py-1 rounded">Priority: {tag.priority}</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">{tag.description}</p>
                  <p className="text-xs text-gray-500">
                    <strong>Examples:</strong> {tag.examples.join(', ')}
                  </p>
                </div>
              ))}
            </div>

            <HelpPanel title="How to Assign Tags" variant="info" defaultExpanded={false}>
              <ul className="space-y-2">
                {TAG_SYSTEM_GUIDANCE.howToAssign.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span className="text-gray-700">{step}</span>
                  </li>
                ))}
              </ul>
            </HelpPanel>

            <HelpPanel title="Best Practices" variant="success" defaultExpanded={false}>
              <ul className="space-y-2">
                {TAG_SYSTEM_GUIDANCE.bestPractices.map((practice, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">✓</span>
                    <span className="text-gray-700">{practice}</span>
                  </li>
                ))}
              </ul>
            </HelpPanel>
          </div>
        );

      case 'departments':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{DEPARTMENT_GUIDANCE.title}</h3>
              <p className="text-gray-600 mb-4">{DEPARTMENT_GUIDANCE.description}</p>
              <p className="text-gray-700">{DEPARTMENT_GUIDANCE.whatAreDepartments}</p>
            </div>

            <HelpPanel title="How to Create Departments" variant="info" defaultExpanded={true}>
              <ol className="space-y-2">
                {DEPARTMENT_GUIDANCE.howToCreate.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-semibold text-blue-600">{idx + 1}.</span>
                    <span className="text-gray-700">{step}</span>
                  </li>
                ))}
              </ol>
            </HelpPanel>

            <HelpPanel title="Use Cases" variant="success" defaultExpanded={false}>
              <ul className="space-y-2">
                {DEPARTMENT_GUIDANCE.useCases.map((useCase, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">→</span>
                    <span className="text-gray-700">{useCase}</span>
                  </li>
                ))}
              </ul>
            </HelpPanel>

            <HelpPanel title="Best Practices" variant="default" defaultExpanded={false}>
              <ul className="space-y-2">
                {DEPARTMENT_GUIDANCE.bestPractices.map((practice, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-gray-600 mt-1">✓</span>
                    <span className="text-gray-700">{practice}</span>
                  </li>
                ))}
              </ul>
            </HelpPanel>
          </div>
        );

      case 'member-management':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{MEMBER_MANAGEMENT_GUIDANCE.title}</h3>
              <p className="text-gray-600 mb-6">{MEMBER_MANAGEMENT_GUIDANCE.description}</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Member Statuses</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(MEMBER_MANAGEMENT_GUIDANCE.memberStatuses).map(([key, status]) => (
                  <div key={key} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{status.icon}</span>
                      <h5 className="font-semibold text-gray-800">{status.label}</h5>
                    </div>
                    <p className="text-gray-600 text-sm">{status.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <HelpPanel title="How to Manage Members" variant="info" defaultExpanded={false}>
              <ol className="space-y-2">
                {MEMBER_MANAGEMENT_GUIDANCE.howToManage.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-semibold text-blue-600">{idx + 1}.</span>
                    <span className="text-gray-700">{step}</span>
                  </li>
                ))}
              </ol>
            </HelpPanel>

            <HelpPanel title="Role Assignment Guidelines" variant="warning" defaultExpanded={false}>
              <ul className="space-y-2">
                {MEMBER_MANAGEMENT_GUIDANCE.roleAssignment.map((guideline, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-1">⚠</span>
                    <span className="text-gray-700">{guideline}</span>
                  </li>
                ))}
              </ul>
            </HelpPanel>

            <HelpPanel title="Bulk Operations" variant="default" defaultExpanded={false}>
              <ul className="space-y-2">
                {MEMBER_MANAGEMENT_GUIDANCE.bulkOperations.map((operation, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-gray-600 mt-1">•</span>
                    <span className="text-gray-700">{operation}</span>
                  </li>
                ))}
              </ul>
            </HelpPanel>
          </div>
        );

      case 'templates':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{TEMPLATE_GUIDANCE.title}</h3>
              <p className="text-gray-600 mb-4">{TEMPLATE_GUIDANCE.description}</p>
              <p className="text-gray-700">{TEMPLATE_GUIDANCE.whatAreTemplates}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HelpPanel title="How to Create" variant="info" defaultExpanded={true}>
                <ol className="space-y-2">
                  {TEMPLATE_GUIDANCE.howToCreate.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="font-semibold text-blue-600">{idx + 1}.</span>
                      <span className="text-gray-700 text-sm">{step}</span>
                    </li>
                  ))}
                </ol>
              </HelpPanel>

              <HelpPanel title="How to Use" variant="success" defaultExpanded={true}>
                <ol className="space-y-2">
                  {TEMPLATE_GUIDANCE.howToUse.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="font-semibold text-green-600">{idx + 1}.</span>
                      <span className="text-gray-700 text-sm">{step}</span>
                    </li>
                  ))}
                </ol>
              </HelpPanel>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Template Examples</h4>
              <div className="space-y-3">
                {TEMPLATE_GUIDANCE.templateExamples.map((example, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-gray-800">{example.name}</h5>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{example.type}</span>
                    </div>
                    <pre className="bg-gray-50 p-3 rounded text-xs text-gray-700 overflow-x-auto">
                      {example.content}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'post-creation':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{POST_CREATION_GUIDANCE.title}</h3>
              <p className="text-gray-600 mb-6">{POST_CREATION_GUIDANCE.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(POST_CREATION_GUIDANCE.postTypes).map(([key, type]) => (
                <div key={key} className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{type.icon}</span>
                    <h4 className="font-semibold text-gray-800">{type.label}</h4>
                  </div>
                  <p className="text-gray-600 text-sm mb-2">{type.description}</p>
                  <p className="text-xs text-gray-500 mb-3">
                    <strong>When to use:</strong> {type.whenToUse}
                  </p>
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Tips:</p>
                    <ul className="space-y-1">
                      {type.tips.map((tip, idx) => (
                        <li key={idx} className="text-xs text-gray-600 flex items-start gap-1">
                          <span className="text-blue-600">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Privacy Settings</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(POST_CREATION_GUIDANCE.privacySettings).map(([key, privacy]) => (
                  <div key={key} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{privacy.icon}</span>
                      <h5 className="font-semibold text-gray-800 text-sm">{privacy.label}</h5>
                    </div>
                    <p className="text-gray-600 text-xs">{privacy.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <HelpPanel title="Best Practices" variant="success" defaultExpanded={false}>
              <ul className="space-y-2">
                {POST_CREATION_GUIDANCE.bestPractices.map((practice, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">✓</span>
                    <span className="text-gray-700">{practice}</span>
                  </li>
                ))}
              </ul>
            </HelpPanel>
          </div>
        );

      case 'moderation':
      case 'analytics':
      case 'qr-code':
      case 'assigned-to-me':
        const guidanceMap = {
          'moderation': MODERATION_GUIDANCE,
          'analytics': ANALYTICS_GUIDANCE,
          'qr-code': QR_CODE_GUIDANCE,
          'assigned-to-me': ASSIGNED_TO_ME_GUIDANCE
        };
        const guidance = guidanceMap[contentId];

        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{guidance.title}</h3>
              <p className="text-gray-600 mb-6">{guidance.description}</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm text-gray-700">
                {JSON.stringify(guidance, null, 2)}
              </pre>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-12">
            <p className="text-gray-600">Select a topic from the sidebar to view help content.</p>
          </div>
        );
    }
  };

  const [selectedTopic, setSelectedTopic] = useState(sections[0].topics[0]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-800">Help Center</h1>
          </div>
          <p className="text-gray-600">
            Learn how to use Company Voice effectively
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for help topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-6">
              <h3 className="font-semibold text-gray-800 mb-3">Topics</h3>
              <div className="space-y-1">
                {sections.map((section) => (
                  <div key={section.id}>
                    <div className="flex items-center gap-2 px-2 py-2 text-sm font-medium text-gray-700">
                      <span>{section.icon}</span>
                      <span>{section.title}</span>
                    </div>
                    <div className="ml-2 space-y-1">
                      {section.topics.map((topic) => (
                        <button
                          key={topic.id}
                          onClick={() => setSelectedTopic(topic)}
                          className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between ${
                            selectedTopic?.id === topic.id
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span>{topic.title}</span>
                          {selectedTopic?.id === topic.id && (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => navigate('/help/roles')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  View Roles & Permissions
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
              {selectedTopic && renderContent(selectedTopic.content)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
