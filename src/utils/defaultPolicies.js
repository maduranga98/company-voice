/**
 * Default policies every company can add in one click and ask employees to acknowledge.
 * They describe how the VoxWel application itself handles employee data and reports.
 *
 * `key` is stored on the policy as `templateKey`, so adding the defaults twice never
 * duplicates them. Bump `version` when the text changes materially.
 */
export const DEFAULT_POLICIES = [
  {
    key: "app_privacy_notice",
    title: "VoxWel Privacy Notice",
    category: "data_privacy",
    version: "1.0",
    content: `This notice explains what personal data the VoxWel application collects about you, why, and how it is protected.

1. WHAT WE COLLECT
You do not need an account to use VoxWel. Depending on what you do, we collect:
- Reports: what you write in a report, any files you attach, and the reference code issued to you so you can check its status. If you report anonymously we do not ask for, or store, your name.
- Policy acknowledgements: your name or employee ID, the policy and version you acknowledged, any concern you raise about a policy, and the date and time.
- Technical data: basic information such as your network address and browser type, used only for security and to prevent abuse of the service.

2. WHY WE USE IT
- To receive reports and route them to the right people in your company.
- To keep a verifiable record that company policies were shared with and acknowledged by employees.
- To keep the service secure and stop spam or misuse.
- To meet legal obligations and respond to lawful requests.

3. WHO CAN SEE IT
Authorised administrators and HR staff of your company can see the reports and acknowledgement records for your company. Data from other companies is never visible to them. VoxWel staff access data only to operate and support the service.

4. HOW LONG WE KEEP IT
Data is kept for as long as your company uses VoxWel, or as required by law. Reports are kept as long as needed to investigate and resolve them. Acknowledgement records are retained as evidence of compliance. When your company ends its subscription its data is deleted or returned according to its agreement with VoxWel.

5. SECURITY
Data is encrypted in transit and at rest. Access is limited by role and company, and sensitive actions are recorded in an audit log.

6. YOUR RIGHTS
Depending on where you live, you may ask to access, correct or delete your personal data, or to object to how it is used. If you gave your name or employee ID, contact your HR team or company administrator, who will coordinate the request with VoxWel.

By acknowledging this notice you confirm you have read and understood how your data is handled.`,
  },
  {
    key: "anonymous_reporting_confidentiality",
    title: "Anonymous Reporting & Confidentiality Policy",
    category: "whistleblower",
    version: "1.0",
    content: `VoxWel gives every employee a safe way to raise concerns. This policy explains how reports are handled and what protections apply.

1. YOUR IDENTITY IS PROTECTED
When you submit a report anonymously, your name is not attached to it. The public reporting line does not require an account or sign-in. Do not include details in the report that would identify you if you want to stay anonymous.

2. WHO HANDLES REPORTS
Reports are routed to authorised HR or compliance staff in your company. Access is limited to people who need it to investigate, and every access is recorded.

3. NO RETALIATION
Retaliation against anyone who raises a concern in good faith, or who helps with an investigation, is strictly prohibited and is itself a violation of company policy.

4. GOOD FAITH
Reports should be made honestly. Knowingly false reports made to harm someone may lead to disciplinary action.

5. FOLLOW-UP
After submitting you receive a reference code. You can use it to check the status of your report and answer follow-up questions without revealing who you are.

6. LIMITS OF CONFIDENTIALITY
Your company may be legally required to share information with authorities. Where possible you will be told beforehand.

By acknowledging this policy you confirm you understand how reports are handled and the protections available to you.`,
  },
  {
    key: "app_acceptable_use",
    title: "VoxWel Acceptable Use Policy",
    category: "code_of_conduct",
    version: "1.0",
    content: `This policy sets out what is expected of everyone who uses VoxWel at work.

1. USE IT FOR ITS PURPOSE
Use VoxWel to raise concerns or give feedback through your company's reporting line, to check the status of a report you made, and to acknowledge company policies. No account is needed for any of these.

2. NOT ACCEPTABLE
- Harassment, discrimination, threats or abusive language in a report.
- Knowingly false or misleading reports, or reports made to harm someone.
- Including other people's personal data or confidential business information that is not needed to explain your concern.
- Acknowledging a policy under another person's name or employee ID.
- Attempting to identify anonymous reporters or to access data you are not authorised to see.
- Spamming the service, trying to bypass security controls or interfering with its operation.

3. KEEP YOUR REFERENCE CODE PRIVATE
Your reference code lets anyone who has it see the status of your report. Keep it somewhere safe and do not share it.

4. STAFF ACCOUNTS
Administrators and HR staff who have an account must keep their credentials private, must not share their account, and must tell their administrator straight away if they think it has been compromised.

5. MISUSE
Submissions that break this policy may be removed or blocked, and misuse may lead to action under your company's disciplinary procedures.

6. QUESTIONS
Ask your HR team or company administrator if you are unsure whether something is acceptable.

By acknowledging this policy you agree to follow these rules when using VoxWel.`,
  },
];
