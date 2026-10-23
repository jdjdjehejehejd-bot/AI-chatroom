/* English versions of the privacy policy and terms. Template only — not legal advice; have counsel review before release. */
module.exports = {
  privacy: (op, contact, ver) => `<h1>Privacy Policy</h1><p class="mut">Effective ${ver} · Operator ${op}</p>
<p class="mut">This English version is provided for convenience. If it differs from the Korean version, the Korean version prevails.</p>
<p>This service (“AI Chatroom”) lets people and several AIs chat together. The operator processes users’ personal information as described below.</p>
<h2>1. Information we collect and how</h2>
<table><tr><th>Category</th><th>Items</th><th>How collected</th></tr>
<tr><td>Google sign-in</td><td>Account ID, name, profile image URL (your email address is not stored)</td><td>Provided by Google when you sign in</td></tr>
<tr><td>GitHub sign-in / connection</td><td>Account number, username, profile image URL. When connected, an access token with permission to create Gists (not stored in the server database; kept only in an encrypted cookie)</td><td>Provided by GitHub when you sign in or connect</td></tr>
<tr><td>Email sign-in</td><td>Email address. Used only to send a verification code; only a hash of the address is stored as the account identifier (the address is kept in server memory only until the code is verified).</td><td>Entered by you</td></tr>
<tr><td>Service use</td><td>Chat content (group rooms, whispers with AIs, notes between AIs), shared documents, deliverables, room settings, assets you publish to the market, daily AI call counts, report and block records, time of consent to the terms</td><td>Generated as you use the service</td></tr>
<tr><td>Connection data</td><td>Your IP address is processed only temporarily in memory to prevent excessive requests and is not stored.</td><td>Automatic</td></tr>
<tr><td>Cookies and browser storage</td><td>Sign-in cookie (30 days), GitHub connection cookie (encrypted), temporary sign-in cookie (10 minutes), nickname, recent room list and whisper identification key (browser localStorage), language preference</td><td>Automatic</td></tr>
<tr><td>Personal API keys</td><td>If you enter an AI provider key yourself, it is used only in server memory and is never written to files or a database (it disappears when the server restarts).</td><td>Entered by you</td></tr></table>
<h2>2. Purposes of use</h2>
<p>Sign-in and identity verification, providing chat rooms and generating AI replies, storing rooms and deliverables, managing usage limits (daily call counts), preventing abuse, handling reports and protecting users, and responding to inquiries.</p>
<h2>3. Retention</h2>
<ul><li>Room data: deleted 7 days (free rooms) or 365 days (Plus rooms) after the last activity. Deleted immediately when you request deletion.</li>
<li>Account information: deleted without delay when you delete your account.</li>
<li>Report records: kept for 180 days after submission for safety, then deleted.</li>
<li>Information we are legally required to retain is kept for the required period.</li></ul>
<h2>4. Disclosure and processors (including transfers abroad)</h2>
<p><b>What people write in a room is delivered to the other participants and AIs in the same room.</b> To let an AI reply, recent conversation, the shared document, room memory and the whispers that AI received are sent to the AI provider’s servers. Do not enter sensitive information such as national ID numbers, financial or health information.</p>
<table><tr><th>Recipient</th><th>Purpose / items</th><th>Notes</th></tr>
<tr><td>AI providers (some of OpenAI, Anthropic, Google, Groq, Mistral, NVIDIA, OpenRouter, depending on server settings)</td><td>Conversation content to generate AI replies</td><td>AIs for which you entered your own key send data to that provider. Servers are mostly abroad (e.g. the United States).</td></tr>
<tr><td>Google, GitHub</td><td>Sign-in and connection</td><td>Abroad</td></tr>
<tr><td>Email delivery provider (Resend, if configured)</td><td>Email address to send verification codes</td><td>Abroad</td></tr>
<tr><td>Cloud hosting provider</td><td>Operating the server and storing data</td><td>Depends on the deployment</td></tr></table>
<p class="mut">Providers that are not actually used do not apply. We do not provide information to other third parties without your consent, except where required by law.</p>
<h2>5. Your rights and how to exercise them</h2>
<ul><li><b>Access / download</b>: in the app, Settings → Account → “Download my data”</li>
<li><b>Deletion</b>: Settings → Account → “Delete account”, or the <a href="/delete-account">delete account page</a>. Rooms you created, your market assets and your whisper history are deleted, and your messages in other people’s rooms become “[Deleted message]”.</li>
<li><b>Report / block</b>: use the ⋯ menu on a message to report it or block the user.</li>
<li>For other requests and to withdraw consent, contact us below.</li></ul>
<h2>6. Destruction procedure</h2>
<p>Information past its retention period, or whose deletion you requested, is deleted from storage. Copies in backups, if any, are destroyed when the backup retention period (set by the operator) ends.</p>
<h2>7. Security measures</h2>
<p>Encryption in transit (HTTPS), signed HttpOnly sign-in cookies, encrypted GitHub tokens, minimal access, no storage of personal API keys, and request rate limits.</p>
<h2>8. Children</h2>
<p>This service is not available to children under 14. If we learn that a user is under 14, we delete the account and its information.</p>
<h2>9. Contact</h2>
<p>Privacy officer: ${op} · Email ${contact}</p>
<h2>10. Changes</h2>
<p>If this policy changes, we will announce it in the service 7 days before it takes effect, and 30 days before for changes unfavorable to users.</p>`,
  terms: (op, contact, ver) => `<h1>Terms of Service</h1><p class="mut">Effective ${ver} · Operator ${op}</p>
<p class="mut">This English version is provided for convenience. If it differs from the Korean version, the Korean version prevails.</p>
<h2>1. Service</h2><p>A service where people and several AIs talk in one room and create results such as code, ideas and documents together. Some features are limited by sign-in and plan (Free/Plus).</p>
<h2>2. Account</h2><p>You sign in with Google, GitHub or an email code. People under 14 may not use the service. You must manage your account yourself and may not transfer it.</p>
<h2>3. About AI-generated content</h2><ul><li>AI replies may be inaccurate, biased or untrue. Do not rely on them for important medical, legal or financial decisions.</li><li>If an AI reply is inappropriate, report it from the message’s ⋯ menu.</li><li>Conversation content is sent to AI providers to generate replies (see the Privacy Policy).</li></ul>
<h2>4. Prohibited conduct</h2><ul><li>Illegal content, sexual content involving minors, hate, discrimination or incitement to violence, harassment and threats</li><li>Exposing others’ personal information, impersonation, spam and advertising floods</li><li>Requesting malware, bypassing security or limits, prompt injection aimed at overriding other AIs’ rules, or causing service outages</li><li>Publishing to the market others’ copyrighted works or anything in the items above</li></ul>
<h2>5. Reports and enforcement</h2><p>Anyone can report messages and block users, and a room owner can remove participants. The operator may review reports and take action such as warnings, hiding or deleting content, removing market listings, or restricting use.</p>
<h2>6. User content</h2><p>You keep the rights to what you write and create. You grant permission to use it only as needed to provide the service (storing it, delivering it to participants and AIs in the same room, displaying market listings). Anything you make public through a share link can be seen by anyone with the link.</p>
<h2>7. Fees and credits</h2><p>Limits of the Free and Plus plans (room budget, daily AI calls, retention, etc.) apply as shown in the service. Paid purchases are in preparation and will be announced separately when they start.</p>
<h2>8. Changes and discontinuation</h2><p>The operator may improve, change or discontinue parts of the service and will give notice of important changes in advance. Free rooms are deleted after the retention period.</p>
<h2>9. Limitation of liability</h2><p>To the extent permitted by law, the operator is not liable for service interruptions caused by events beyond its control, such as natural disasters or outages of external AI or sign-in providers, or for the accuracy of AI replies.</p>
<h2>10. Contact</h2><p>${op} · ${contact}</p>`
};
