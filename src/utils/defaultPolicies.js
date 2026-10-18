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
- Account data: your name or username, work role, department and the company you belong to.
- Activity data: posts, comments, reactions and notifications you create or receive.
- Technical data: sign-in times and basic device information, used for security and audit purposes.
- Policy acknowledgements: your name or employee ID, the policy and version you acknowledged, and the date and time.

2. WHY WE USE IT
- To run the platform and keep your account secure.
- To route reports and cases to the right people in your company.
- To keep a verifiable record that company policies were shared with and acknowledged by employees.
- To meet legal obligations and respond to lawful requests.

3. WHO CAN SEE IT
Your company's administrators and HR team can see account data and acknowledgement records for your company. Data from other companies is never visible to them. VoxWel staff access data only to operate and support the service.

4. HOW LONG WE KEEP IT
Data is kept for as long as your company uses VoxWel, or as required by law. Acknowledgement records are retained as evidence of compliance. When your company ends its subscription its data is deleted or returned according to its agreement with VoxWel.

5. SECURITY
Data is encrypted in transit and at rest. Access is limited by role and company, and sensitive actions are recorded in an audit log.

6. YOUR RIGHTS
Depending on where you live, you may ask to access, correct or delete your personal data, or to object to how it is used. Contact your HR team or company administrator, who will coordinate the request with VoxWel.

By acknowledging this notice you confirm you have read and understood how your data is handled.`,
  },
  {
    key: "anonymous_reporting_confidentiality",
    title: "Anonymous Reporting & Confidentiality Policy",
    category: "whistleblower",
    version: "1.0",
    content: `VoxWel gives every employee a safe way to raise concerns. This policy explains how reports are handled and what protections apply.

1. YOUR IDENTITY IS PROTECTED
When you submit a report anonymously, your name and account are not attached to it. Reports made through the public reporting line do not require you to sign in. Do not include details in the report that would identify you if you want to stay anonymous.

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

1. USE IT FOR WORK PURPOSES
Use VoxWel to share feedback, raise concerns and follow company policy. Keep posts and comments professional and respectful.

2. NOT ACCEPTABLE
- Harassment, discrimination, threats or abusive language.
- Sharing confidential business information or other people's personal data without permission.
- Posting false or misleading information on purpose.
- Attempting to identify anonymous authors or to access data you are not authorised to see.
- Trying to bypass security controls or interfering with the service.

3. PROTECT YOUR ACCOUNT
Keep your credentials private, do not share your account, and tell your administrator straight away if you think it has been compromised.

4. MODERATION
Content that breaks this policy may be hidden or removed, and repeated violations may lead to account suspension or further action under your company's disciplinary procedures.

5. QUESTIONS
Ask your HR team or company administrator if you are unsure whether something is acceptable.

By acknowledging this policy you agree to follow these rules when using VoxWel.`,
  },
];
