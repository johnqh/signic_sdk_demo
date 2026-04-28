# Send Email Feature

## Overview

Add email composition and sending to the Signic SDK demo app. Users enter a receiver wallet address (EVM or Solana), subject, and plain-text body. The wallet address is appended with `@signic.email` to form the recipient email address.

## Architecture

### New App State

Add `compose` to the existing `AppState` union type:

```ts
type AppState = 'connecting' | 'list' | 'detail' | 'compose';
```

### Navigation

- **List view**: Add a "Compose" button alongside the existing "Send me an email" and "Refresh" buttons.
- **Compose view**: "Back" button returns to list without sending.
- **After send**: Auto-navigate back to list view on success.

### Compose View

A new rendering branch in `App()` for `state === 'compose'`, following the same pattern as the `detail` state.

**Form fields:**
1. **To** (`walletAddress`) — text input with `@signic.email` suffix displayed inline
2. **Subject** — text input
3. **Body** — textarea, plain text

**Buttons:**
- "Back" (secondary) — returns to list
- "Send" (primary) — submits the email, disabled while sending or if validation fails

### Wallet Address Validation

Validate on change, show inline error below the input:

- **EVM**: regex `/^0x[0-9a-fA-F]{40}$/`
- **Solana**: regex `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`
- If empty: no error shown (pristine state)
- If non-empty and invalid: show "Enter a valid EVM (0x...) or Solana wallet address"

### SDK Integration

```ts
await client.sendEmail({
  to: `${walletAddress}@signic.email`,
  subject,
  html: `<pre>${escapeHtml(body)}</pre>`,
  text: body,
});
```

HTML-escape the body text (`<`, `>`, `&`, `"`, `'`) before wrapping in `<pre>` to prevent injection.

### State Management

New state variables:

```ts
const [composeTo, setComposeTo] = useState('');
const [composeSubject, setComposeSubject] = useState('');
const [composeBody, setComposeBody] = useState('');
const [sending, setSending] = useState(false);
```

These reset when navigating to compose view.

### Error Handling

- Network/SDK errors display in the existing `.error` div
- Validation errors display inline below the wallet address input
- On success: brief success message, then navigate to list

### Styling

Reuse existing CSS classes (`.card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.error`, `.info-row`).

New CSS additions:
- `.compose-form` — flex column layout with gap
- `.compose-field` — label + input wrapper
- `.compose-field input, .compose-field textarea` — full-width styling
- `.compose-to-wrapper` — input + `@signic.email` suffix layout
- `.validation-error` — small red text below input
- `.success` — green text for send confirmation

## Testing

- Verify EVM address validation accepts `0x` + 40 hex chars
- Verify Solana address validation accepts 32-44 base58 chars
- Verify invalid addresses show error and disable Send
- Verify successful send calls `client.sendEmail()` with correct params
- Verify navigation: list -> compose -> back, list -> compose -> send -> list
