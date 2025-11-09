# Audit History & Compliance Documentation

## Overview

The Company Voice Platform includes a comprehensive audit history system that tracks all actions performed by users, administrators, and the system. This documentation describes the audit features, compliance capabilities, and how to use the system for regulatory and security purposes.

## Table of Contents

1. [Audit System Architecture](#audit-system-architecture)
2. [What Gets Audited](#what-gets-audited)
3. [Audit Data Structure](#audit-data-structure)
4. [Compliance Features](#compliance-features)
5. [Accessing Audit Logs](#accessing-audit-logs)
6. [Search and Filtering](#search-and-filtering)
7. [Export Capabilities](#export-capabilities)
8. [Data Retention](#data-retention)
9. [Security and Immutability](#security-and-immutability)
10. [Compliance Standards](#compliance-standards)

---

## Audit System Architecture

The audit system consists of two main collections in Firestore:

### 1. Post Activities (`postActivities`)
Tracks all actions related to posts, including:
- Status changes
- Priority updates
- Assignments
- Comments
- Due date modifications

### 2. System Audit Logs (`systemAuditLogs`)
Tracks system-level actions, including:
- User login/logout
- User creation, updates, deletion
- Role changes
- Department management
- Password changes
- Profile updates

Both collections are **immutable** - records cannot be modified or deleted once created, ensuring audit trail integrity.

---

## What Gets Audited

### Post-Related Actions

| Action | Type | Metadata Captured |
|--------|------|-------------------|
| Post Created | `created` | Creator ID, name, timestamp |
| Status Changed | `status_changed` | Admin ID, old status, new status, comment |
| Priority Changed | `priority_changed` | Admin ID, old priority, new priority |
| Post Assigned | `assigned` | Admin ID, assignee ID/name, assignment type |
| Post Unassigned | `unassigned` | Admin ID, previous assignee |
| Due Date Set | `due_date_set` | Admin ID, due date |
| Due Date Changed | `due_date_changed` | Admin ID, old date, new date |
| Admin Comment | `admin_comment` | Admin ID, comment text |
| Post Resolved | `resolved` | Admin ID, resolution details |
| Post Reopened | `reopened` | Admin ID, reason |

### System-Level Actions

| Action | Type | Metadata Captured |
|--------|------|-------------------|
| User Login | `user_login` | User ID, username, role, timestamp |
| User Logout | `user_logout` | User ID, username, timestamp |
| User Created | `user_created` | New user details, creator ID/name |
| User Updated | `user_updated` | User ID, changes made, updater ID |
| User Deleted | `user_deleted` | User details, deleter ID/name |
| User Suspended | `user_suspended` | User ID, suspender ID, reason |
| User Activated | `user_activated` | User ID, activator ID |
| Role Changed | `role_changed` | User ID, old role, new role, changer ID |
| Department Created | `department_created` | Department details, creator ID |
| Department Updated | `department_updated` | Department ID, changes, updater ID |
| Department Deleted | `department_deleted` | Department details, deleter ID |
| Password Changed | `password_changed` | User ID, changer ID, self-change flag |
| Profile Updated | `profile_updated` | User ID, changes made |

---

## Audit Data Structure

### Post Activity Record Structure

```json
{
  "id": "unique-activity-id",
  "postId": "post-document-id",
  "type": "status_changed",
  "metadata": {
    "companyId": "company-id",
    "adminId": "admin-user-id",
    "adminName": "Admin Display Name",
    "oldStatus": "open",
    "newStatus": "in_progress",
    "comment": "Starting work on this issue"
  },
  "createdAt": "2025-11-09T10:30:00Z"
}
```

### System Activity Record Structure

```json
{
  "id": "unique-activity-id",
  "companyId": "company-id",
  "type": "user_login",
  "metadata": {
    "userId": "user-id",
    "userName": "John Doe",
    "userRole": "company_admin",
    "timestamp": "2025-11-09T10:30:00Z"
  },
  "createdAt": "2025-11-09T10:30:00Z"
}
```

---

## Compliance Features

### 1. Immutability
- **All audit records are immutable** - they cannot be modified or deleted after creation
- Enforced at the database level through Firestore security rules
- Ensures tamper-proof audit trail

### 2. Chronological Integrity
- All records timestamped with server timestamp (not client time)
- Prevents time manipulation
- Provides accurate chronological history

### 3. Complete Attribution
- Every action tracks **who** performed it (user ID and display name)
- Admin actions clearly attributed to specific administrators
- Distinguishes between self-service actions and admin-initiated actions

### 4. Change History
- Before/after values captured for all modifications
- Complete audit trail of what changed
- Enables reconstruction of historical state

### 5. Compliance-Ready Exports
- Export to JSON for detailed analysis
- Export to CSV for spreadsheet review
- Includes all metadata for comprehensive auditing

### 6. Role-Based Access
- Only administrators can view audit logs
- Company isolation - each company can only see their own logs
- Prevents unauthorized access to sensitive audit data

---

## Accessing Audit Logs

### Via Web Interface

1. **Login as Admin**
   - Must have `company_admin`, `hr`, or `super_admin` role

2. **Navigate to Audit Log**
   - From Company Dashboard, click "Audit Log" card
   - Or navigate directly to `/company/audit-log`

3. **View Dashboard**
   - See total activities count
   - View breakdown by post vs system activities
   - See active users count

### Via API

Use the audit service functions:

```javascript
import {
  getCompanyAuditLog,
  searchAuditLogs,
  getAuditLogStats
} from './services/auditService';

// Get all activities
const activities = await getCompanyAuditLog(companyId, {
  limit: 100,
  includePostActivities: true,
  includeSystemActivities: true
});

// Search activities
const results = await searchAuditLogs(companyId, 'login', 50);

// Get statistics
const stats = await getAuditLogStats(companyId);
```

---

## Search and Filtering

### Available Filters

1. **Activity Type**
   - Filter by specific action type (e.g., "Status Changed", "User Login")
   - Dropdown includes all post and system activity types

2. **User**
   - Filter by specific user who performed actions
   - Shows all users in the company

3. **Activity Source**
   - Post Activities
   - System Activities
   - All Activities

4. **Date Range**
   - Start date
   - End date
   - Filter activities within specific time period

5. **Text Search**
   - Search within activity metadata
   - Finds activities containing specific text

### Using Filters

1. **Apply Single Filter**
   - Select filter criteria
   - Click "Apply Filters"

2. **Combine Multiple Filters**
   - Select multiple criteria
   - System applies AND logic (all criteria must match)

3. **Clear Filters**
   - Click "Clear Filters" to reset all filters

4. **Search**
   - Enter search term
   - Click "Search" to find matching activities

---

## Export Capabilities

### JSON Export

**Use Case**: Detailed analysis, programmatic processing, backup

**Features**:
- Complete metadata included
- Structured format
- Easy to parse programmatically

**Process**:
1. Apply desired filters
2. Click "Export JSON"
3. File downloads with timestamp: `audit-log-2025-11-09T10-30-00.json`

**Format**:
```json
{
  "exportDate": "2025-11-09T10:30:00Z",
  "companyId": "company-id",
  "totalActivities": 250,
  "activities": [...]
}
```

### CSV Export

**Use Case**: Spreadsheet analysis, reporting, compliance reviews

**Features**:
- Tabular format
- Opens in Excel, Google Sheets
- Easy to sort and filter

**Process**:
1. Apply desired filters
2. Click "Export CSV"
3. File downloads with timestamp: `audit-log-2025-11-09T10-30-00.csv`

**Columns**:
- Timestamp
- Type
- Source (Post/System)
- User ID
- User Name
- Details (JSON metadata)

---

## Data Retention

### Current Implementation

- **No automatic deletion** - all audit logs retained indefinitely
- Ensures complete historical record
- Complies with most regulatory requirements

### Recommended Retention Policies

Depending on your compliance requirements, consider:

1. **Financial Services**: 7 years minimum
2. **Healthcare (HIPAA)**: 6 years minimum
3. **General Business**: 3-5 years typical
4. **GDPR Compliance**:
   - Retain as long as necessary for the purpose
   - Document retention justification
   - Implement deletion upon user request (right to be forgotten)

### Implementing Retention Policy

To implement automatic retention:

1. Create Firebase Cloud Function
2. Schedule periodic cleanup job
3. Delete records older than retention period
4. Maintain deletion audit log

Example:
```javascript
// Cloud Function (not included in current implementation)
exports.cleanupOldAuditLogs = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const retentionDays = 2555; // 7 years
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete old records
    // Log deletion for compliance
  });
```

---

## Security and Immutability

### Firestore Security Rules

Audit collections are protected by strict security rules:

```javascript
// postActivities collection
match /postActivities/{activityId} {
  // Read: Only authenticated users in the same company
  allow read: if isAuthenticated() && isSameCompany();

  // Create: Only admins can create
  allow create: if isAdmin() && isSameCompany();

  // Update/Delete: NEVER allowed (immutable)
  allow update, delete: if false;
}

// systemAuditLogs collection
match /systemAuditLogs/{logId} {
  // Read: Only admins in the same company
  allow read: if isAdmin() &&
                 resource.data.companyId == request.auth.token.companyId;

  // Create: Only admins
  allow create: if isAdmin();

  // Update/Delete: NEVER allowed (immutable)
  allow update, delete: if false;
}
```

### Key Security Features

1. **Immutability Enforcement**
   - Database rules prevent updates and deletions
   - Even system administrators cannot modify audit logs
   - Ensures tamper-proof audit trail

2. **Company Isolation**
   - Each company can only access their own logs
   - Enforced at database level
   - Multi-tenant security

3. **Role-Based Access**
   - Only administrators can view logs
   - Regular employees cannot access audit history
   - Prevents unauthorized surveillance

4. **Authentication Required**
   - All audit operations require authentication
   - Anonymous access blocked
   - Session-based security

---

## Compliance Standards

### Supported Compliance Frameworks

#### 1. SOC 2 (Service Organization Control 2)
**Requirements Met**:
- ✅ Logical access controls (role-based access)
- ✅ Change management tracking
- ✅ Security event logging
- ✅ Data integrity protection (immutability)

**Audit Evidence**: Export audit logs showing user access and system changes

#### 2. ISO 27001 (Information Security Management)
**Requirements Met**:
- ✅ A.9.4.1: Information access restriction
- ✅ A.12.4.1: Event logging
- ✅ A.12.4.3: Administrator and operator logs
- ✅ A.12.4.4: Clock synchronization (server timestamps)

**Audit Evidence**: Comprehensive activity logs with timestamp accuracy

#### 3. GDPR (General Data Protection Regulation)
**Requirements Met**:
- ✅ Article 5(1)(f): Integrity and confidentiality
- ✅ Article 32: Security of processing
- ✅ Article 30: Records of processing activities
- ✅ Right to be informed (transparent logging)

**Note**: Implement data retention and right to erasure policies as needed

#### 4. HIPAA (Health Insurance Portability and Accountability Act)
**If Handling Health Data**:
- ✅ 164.308(a)(1): Security management process
- ✅ 164.308(a)(5): Log-in monitoring
- ✅ 164.312(b): Audit controls
- ✅ 164.312(d): Person or entity authentication

**Audit Evidence**: User authentication logs, access logs, modification logs

#### 5. PCI DSS (Payment Card Industry Data Security Standard)
**If Processing Payments**:
- ✅ Requirement 10: Track and monitor all access
- ✅ Requirement 10.2: Implement automated audit trails
- ✅ Requirement 10.3: Record audit trail entries
- ✅ Requirement 10.5: Secure audit trails

**Audit Evidence**: Complete access and change logs with immutability

---

## Audit Log Use Cases

### 1. Security Incident Investigation
**Scenario**: Unauthorized access suspected
**Process**:
1. Navigate to Audit Log
2. Filter by "User Login" type
3. Set date range around incident
4. Review login activities for suspicious patterns
5. Export CSV for detailed analysis

### 2. Compliance Audit
**Scenario**: Annual SOC 2 audit
**Process**:
1. Export all audit logs for the year
2. Provide to auditors
3. Demonstrate immutability (show failed modification attempts)
4. Show role-based access controls
5. Prove complete activity tracking

### 3. Employee Dispute Resolution
**Scenario**: Dispute over who changed post status
**Process**:
1. Navigate to Audit Log
2. Search for specific post ID
3. Review "Status Changed" activities
4. See exact user, timestamp, and before/after values
5. Export as evidence

### 4. Performance Review
**Scenario**: Review admin activity for performance evaluation
**Process**:
1. Filter by specific user
2. Set date range for review period
3. Review activity types and frequency
4. Export to CSV for reporting

### 5. Data Breach Response
**Scenario**: Potential data breach detected
**Process**:
1. Immediately export all recent audit logs
2. Filter by suspicious activity types
3. Identify affected users and data
4. Provide logs to incident response team
5. Use for forensic analysis

---

## Best Practices

### For Administrators

1. **Regular Reviews**
   - Review audit logs weekly
   - Look for unusual patterns
   - Investigate anomalies promptly

2. **Access Control**
   - Limit admin access to necessary personnel
   - Use least privilege principle
   - Review admin list regularly

3. **Documentation**
   - Document any significant actions
   - Use comment fields when available
   - Maintain supplementary notes if needed

4. **Export Regularly**
   - Schedule monthly exports
   - Store securely offline
   - Maintain backup audit trails

### For Compliance Officers

1. **Define Retention Policy**
   - Document retention requirements
   - Implement automated cleanup if needed
   - Balance compliance with storage costs

2. **Training**
   - Train admins on audit system
   - Emphasize importance of accurate logging
   - Review procedures annually

3. **Audit the Audits**
   - Periodically verify audit completeness
   - Test immutability controls
   - Validate timestamp accuracy

4. **Incident Response Plan**
   - Define process for audit log review during incidents
   - Establish escalation procedures
   - Practice with tabletop exercises

---

## Technical Details

### Database Collections

**Collection**: `postActivities`
- **Purpose**: Track post-related actions
- **Indexes Required**:
  - `metadata.companyId` + `createdAt` (descending)
  - `type` + `metadata.companyId` + `createdAt` (descending)
  - `metadata.adminId` + `createdAt` (descending)

**Collection**: `systemAuditLogs`
- **Purpose**: Track system-level actions
- **Indexes Required**:
  - `companyId` + `createdAt` (descending)
  - `type` + `companyId` + `createdAt` (descending)
  - `metadata.userId` + `createdAt` (descending)

### Performance Considerations

- **Pagination**: Default limit of 50-500 records
- **Indexing**: Composite indexes required for efficient queries
- **Caching**: Consider implementing Redis cache for frequently accessed logs
- **Storage**: Monitor Firestore usage as logs grow

### API Rate Limits

- **Read Operations**: Standard Firestore limits apply
- **Export Operations**: No built-in limit, but consider implementing rate limiting for large exports

---

## Support and Maintenance

### Monitoring

Monitor these metrics:
- Audit log creation rate
- Query performance
- Storage growth
- Failed logging attempts

### Troubleshooting

**Problem**: Audit logs not appearing
- Check admin role permissions
- Verify company isolation
- Review Firestore security rules
- Check browser console for errors

**Problem**: Export fails
- Check query limit (max 10,000 records)
- Try smaller date range
- Check browser storage quota

**Problem**: Slow query performance
- Verify indexes are created
- Reduce query limit
- Use more specific filters

---

## Changelog

### Version 1.0 (2025-11-09)
- Initial implementation
- Post activity tracking
- System activity tracking
- Audit log UI with filters
- JSON/CSV export
- Compliance documentation

### Future Enhancements

Planned features:
- Real-time audit log streaming
- Automated compliance reports
- Advanced analytics dashboard
- IP address tracking
- Session tracking
- Scheduled exports
- Retention policy automation

---

## Contact

For questions or issues related to the audit system:
- Technical Support: [Your support contact]
- Compliance Questions: [Your compliance contact]
- Security Concerns: [Your security contact]

---

## Legal Disclaimer

This audit system is provided as-is. Organizations are responsible for:
- Configuring retention policies to meet their compliance requirements
- Implementing additional controls as needed for their specific regulations
- Regularly reviewing and validating audit log completeness
- Maintaining offline backups as required by their industry
- Conducting regular compliance assessments

The audit system provides the technical foundation for compliance, but ultimate compliance responsibility rests with the organization.
