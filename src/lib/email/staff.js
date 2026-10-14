// Emails to operator staff about their own account (team invite, password
// reset). Operator-app only, so they live outside content.js/template.js,
// which are kept identical to the website's copies. Same layout via renderEmail.
import { renderEmail, renderText } from './template.js';

const oneLine = (s) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
function build(subject, spec) { return { subject: oneLine(subject), spec, html: renderEmail(spec), text: renderText(spec) }; }

const ROLE = { operator_admin: 'an admin', dispatcher: 'a dispatcher' };

/** Someone was added to the team. `newAccount` = they still need to set a password. */
export function teamInvite({ businessName, inviterName, role, url, newAccount }) {
  const who = inviterName ? `${inviterName} has` : 'You have been';
  return build(`You've been added to ${businessName}`, {
    audience: 'staff', preheader: `${newAccount ? 'Set your password to' : 'Sign in to'} the ${businessName} operator app.`,
    status: { label: 'Team invite', tone: 'gold' }, title: `Join ${businessName}`,
    intro: [
      `${who} added you to ${businessName} as ${ROLE[role] || 'a team member'} on the operator app, where the team manages bookings, drivers and customers.`,
      newAccount ? 'Use the button to choose your password. The link works once; if it has expired, ask for a new invite.'
                 : 'You already have an account, so the button signs you straight in. The link works once.',
    ],
    button: { label: newAccount ? 'Set your password' : 'Open the operator app', url },
  });
}

export function passwordReset({ businessName, url }) {
  return build(`Reset your ${businessName} operator password`, {
    audience: 'staff', preheader: 'Choose a new password for the operator app.',
    status: { label: 'Password reset', tone: 'gold' }, title: 'Choose a new password',
    intro: [
      'Someone asked to reset the password for this email address on the operator app. If it was you, use the button to choose a new one. The link works once.',
      "If it wasn't you, ignore this email; your password hasn't changed.",
    ],
    button: { label: 'Choose a new password', url },
  });
}
