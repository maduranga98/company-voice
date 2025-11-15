import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Users, Briefcase, User, Check, X } from 'lucide-react';
import { ROLE_DEFINITIONS } from '../utils/guidanceContent';
import { useAuth } from '../contexts/AuthContext';

const RoleDefinitions = () => {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const userRole = userData?.role || 'employee';

  // Helper function to get visible roles based on user's role
  const getVisibleRoles = () => {
    const roleHierarchy = {
      'super_admin': ['super_admin', 'company_admin', 'hr', 'employee'],
      'company_admin': ['company_admin', 'hr', 'employee'],
      'hr': ['hr', 'employee'],
      'employee': ['employee']
    };
    return roleHierarchy[userRole] || ['employee'];
  };

  const visibleRoles = useMemo(() => getVisibleRoles(), [userRole]);
  const filteredRoleDefinitions = useMemo(() => {
    return Object.fromEntries(
      Object.entries(ROLE_DEFINITIONS).filter(([roleKey]) => visibleRoles.includes(roleKey))
    );
  }, [visibleRoles]);

  const [selectedRole, setSelectedRole] = useState(visibleRoles[0] || 'employee');

  // Feature permissions matrix
  const permissions = {
    'Content Creation': {
      'Create Posts': { super_admin: true, company_admin: true, hr: true, employee: true },
      'Comment on Posts': { super_admin: true, company_admin: true, hr: true, employee: true },
      'Edit Own Posts': { super_admin: true, company_admin: true, hr: true, employee: true },
      'Delete Own Posts': { super_admin: true, company_admin: true, hr: true, employee: true },
    },
    'Post Management': {
      'Change Post Status': { super_admin: true, company_admin: true, hr: true, employee: false },
      'Change Post Priority': { super_admin: true, company_admin: true, hr: true, employee: false },
      'Pin/Unpin Posts': { super_admin: true, company_admin: true, hr: true, employee: false },
      'Assign Posts': { super_admin: true, company_admin: true, hr: true, employee: false },
      'Add Admin Comments': { super_admin: true, company_admin: true, hr: true, employee: false },
      'Set Due Dates': { super_admin: true, company_admin: true, hr: true, employee: false },
    },
    'Moderation': {
      'View Reports': { super_admin: true, company_admin: true, hr: true, employee: false },
      'Review Content': { super_admin: true, company_admin: true, hr: true, employee: false },
      'Take Moderation Action': { super_admin: true, company_admin: true, hr: true, employee: false },
      'View Moderation Logs': { super_admin: true, company_admin: true, hr: true, employee: false },
    },
    'Management': {
      'Manage Members': { super_admin: true, company_admin: true, hr: true, employee: false },
      'Assign Tags': { super_admin: true, company_admin: true, hr: true, employee: false },
      'Manage Departments': { super_admin: true, company_admin: true, hr: true, employee: false },
      'Invite Employees': { super_admin: true, company_admin: true, hr: true, employee: false },
    },
    'Templates': {
      'Create Templates': { super_admin: true, company_admin: true, hr: true, employee: false },
      'Edit Templates': { super_admin: true, company_admin: true, hr: true, employee: false },
      'Delete Templates': { super_admin: true, company_admin: true, hr: true, employee: false },
      'Use Templates': { super_admin: true, company_admin: true, hr: true, employee: true },
    },
    'Analytics & Reporting': {
      'View Analytics': { super_admin: true, company_admin: true, hr: true, employee: false },
      'View Audit Logs': { super_admin: true, company_admin: true, hr: true, employee: false },
      'Export Reports': { super_admin: true, company_admin: true, hr: true, employee: false },
    },
    'Company Management': {
      'Manage Companies': { super_admin: true, company_admin: false, hr: false, employee: false },
      'Manage Billing': { super_admin: true, company_admin: true, hr: false, employee: false },
    },
  };

  const roleColors = {
    super_admin: 'bg-red-100 text-red-800 border-red-300',
    company_admin: 'bg-blue-100 text-blue-800 border-blue-300',
    hr: 'bg-purple-100 text-purple-800 border-purple-300',
    employee: 'bg-green-100 text-green-800 border-green-300',
  };

  const roleIcons = {
    super_admin: Shield,
    company_admin: Briefcase,
    hr: Users,
    employee: User,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Role Definitions & Permissions
          </h1>
          <p className="text-gray-600">
            Understand the different user roles and their capabilities in Company Voice
          </p>
        </div>

        {/* Role Selector */}
        <div className={`grid gap-3 mb-8 ${
          visibleRoles.length === 1 ? 'grid-cols-1' :
          visibleRoles.length === 2 ? 'grid-cols-2' :
          'grid-cols-2 sm:grid-cols-4'
        }`}>
          {Object.entries(filteredRoleDefinitions).map(([roleKey, role]) => {
            const IconComponent = roleIcons[roleKey];
            return (
              <button
                key={roleKey}
                onClick={() => setSelectedRole(roleKey)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedRole === roleKey
                    ? roleColors[roleKey]
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <IconComponent className="w-8 h-8" />
                  <span className="font-semibold text-sm">{role.name}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Role Details */}
        {filteredRoleDefinitions[selectedRole] && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex items-start gap-4 mb-4">
              <div className={`p-3 rounded-lg ${roleColors[selectedRole]}`}>
                {React.createElement(roleIcons[selectedRole], { className: 'w-8 h-8' })}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {filteredRoleDefinitions[selectedRole].name}
                </h2>
                <p className="text-gray-600 mb-4">
                  {filteredRoleDefinitions[selectedRole].description}
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Key Responsibilities:</h3>
              <ul className="space-y-2">
                {filteredRoleDefinitions[selectedRole].responsibilities.map((responsibility, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{responsibility}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Permissions Matrix */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-800">Permissions Matrix</h2>
            <p className="text-gray-600 text-sm mt-1">
              Detailed breakdown of what each role can do
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Feature
                  </th>
                  {visibleRoles.includes('super_admin') && (
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Super Admin
                    </th>
                  )}
                  {visibleRoles.includes('company_admin') && (
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Company Admin
                    </th>
                  )}
                  {visibleRoles.includes('hr') && (
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      HR
                    </th>
                  )}
                  {visibleRoles.includes('employee') && (
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Employee
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {Object.entries(permissions).map(([category, features]) => (
                  <React.Fragment key={category}>
                    {/* Category Header */}
                    <tr className="bg-gray-50">
                      <td
                        colSpan={visibleRoles.length + 1}
                        className="px-6 py-3 text-sm font-semibold text-gray-800"
                      >
                        {category}
                      </td>
                    </tr>
                    {/* Features */}
                    {Object.entries(features).map(([feature, roles]) => (
                      <tr key={feature} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {feature}
                        </td>
                        {visibleRoles.includes('super_admin') && (
                          <td className="px-6 py-4 text-center">
                            {roles.super_admin ? (
                              <Check className="w-5 h-5 text-green-600 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-red-400 mx-auto" />
                            )}
                          </td>
                        )}
                        {visibleRoles.includes('company_admin') && (
                          <td className="px-6 py-4 text-center">
                            {roles.company_admin ? (
                              <Check className="w-5 h-5 text-green-600 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-red-400 mx-auto" />
                            )}
                          </td>
                        )}
                        {visibleRoles.includes('hr') && (
                          <td className="px-6 py-4 text-center">
                            {roles.hr ? (
                              <Check className="w-5 h-5 text-green-600 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-red-400 mx-auto" />
                            )}
                          </td>
                        )}
                        {visibleRoles.includes('employee') && (
                          <td className="px-6 py-4 text-center">
                            {roles.employee ? (
                              <Check className="w-5 h-5 text-green-600 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-red-400 mx-auto" />
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Best Practices */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 mt-8">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Best Practices for Role Assignment
          </h3>
          <ul className="space-y-2 text-blue-800 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>Assign the <strong>minimum role necessary</strong> for users to do their job effectively</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>Regularly <strong>review and audit</strong> role assignments, especially for admin roles</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>Use <strong>HR role</strong> specifically for human resources personnel who need admin capabilities</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>Reserve <strong>Company Admin</strong> for trusted individuals who need full company control</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-1">•</span>
              <span>Document role changes in audit logs and communicate changes to affected users</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RoleDefinitions;
