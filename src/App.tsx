import { useState, useEffect, useCallback, useRef } from 'react';
import { SignicClient, type SignicEmail } from '@sudobility/signic_sdk';

type AppState = 'connecting' | 'list' | 'detail' | 'compose';

function createClient(): SignicClient | null {
  const privateKey = import.meta.env.VITE_PRIVATE_KEY;
  const indexerUrl = import.meta.env.VITE_INDEXER_URL;
  const wildduckUrl = import.meta.env.VITE_WILDDUCK_URL;

  if (!privateKey || !indexerUrl || !wildduckUrl) return null;

  return new SignicClient({
    privateKey: privateKey as `0x${string}`,
    indexerUrl,
    wildduckUrl,
  });
}

// Create client once at module level to avoid StrictMode double-mount races
const sharedClient = createClient();

function App() {
  const clientRef = useRef<SignicClient | null>(sharedClient);
  const [state, setState] = useState<AppState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [emails, setEmails] = useState<SignicEmail[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [selectedEmail, setSelectedEmail] = useState<SignicEmail | null>(null);
  const [loading, setLoading] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);

  const address = useRef(sharedClient?.getAddress() ?? '');
  const emailAddress = useRef(sharedClient?.getEmailAddress() ?? '');

  useEffect(() => {
    const client = clientRef.current;

    if (!client) {
      setError(
        'Missing env vars. Copy .env.example to .env and fill in values.'
      );
      return;
    }

    // Skip if already connected (StrictMode remount)
    if (client.isConnected()) {
      setState('list');
      client.getUnreadEmails().then((result) => {
        setEmails(result.emails);
        setTotalUnread(result.total);
      });
      return;
    }

    let cancelled = false;

    client
      .connect()
      .then(() => {
        if (cancelled) return;
        setState('list');
        return client.getUnreadEmails();
      })
      .then((result) => {
        if (cancelled || !result) return;
        setEmails(result.emails);
        setTotalUnread(result.total);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!clientRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const result = await clientRef.current.getUnreadEmails();
      setEmails(result.emails);
      setTotalUnread(result.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (email: SignicEmail) => {
    if (!clientRef.current) return;
    setLoading(true);
    setError(null);
    try {
      await clientRef.current.markAsRead(email.id, email.mailboxId);
      setEmails((prev) => prev.filter((e) => e.id !== email.id));
      setTotalUnread((prev) => Math.max(0, prev - 1));
      setSelectedEmail(null);
      setState('list');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to mark as read');
    } finally {
      setLoading(false);
    }
  }, []);

  const sendTestEmail = useCallback(() => {
    const mailto = `mailto:${emailAddress.current}?subject=${encodeURIComponent('Test from Signic SDK Demo')}&body=${encodeURIComponent('Hello from the Signic SDK demo app!')}`;
    window.location.href = mailto;
  }, []);

  const viewEmail = useCallback((email: SignicEmail) => {
    setSelectedEmail(email);
    setState('detail');
  }, []);

  const backToList = useCallback(() => {
    setSelectedEmail(null);
    setState('list');
  }, []);

  const goToCompose = useCallback(() => {
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setError(null);
    setState('compose');
  }, []);

  const isValidWalletAddress = (addr: string): boolean => {
    const evmRegex = /^0x[0-9a-fA-F]{40}$/;
    const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return evmRegex.test(addr) || solanaRegex.test(addr);
  };

  const escapeHtml = (text: string): string =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const sendEmail = useCallback(async () => {
    if (!clientRef.current || !isValidWalletAddress(composeTo)) return;
    setSending(true);
    setError(null);
    try {
      await clientRef.current.sendEmail({
        to: `${composeTo}@signic.email`,
        subject: composeSubject,
        html: `<pre>${escapeHtml(composeBody)}</pre>`,
        text: composeBody,
      });
      setState('list');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  }, [composeTo, composeSubject, composeBody]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const formatAddress = (addr: { name: string; address: string }) => {
    return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
  };

  // Connecting state
  if (state === 'connecting') {
    return (
      <div className="app">
        <header className="header">
          <h1>Signic SDK Demo</h1>
        </header>
        <main className="main">
          <div className="card">
            {address.current && (
              <div className="info-row">
                <span className="label">Wallet:</span>
                <code className="value">{address.current}</code>
              </div>
            )}
            {emailAddress.current && (
              <div className="info-row">
                <span className="label">Email:</span>
                <code className="value">{emailAddress.current}</code>
              </div>
            )}
            {error ? (
              <div className="error">{error}</div>
            ) : (
              <div className="spinner-row">
                <div className="spinner" />
                <span>Connecting...</span>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Email detail state
  if (state === 'detail' && selectedEmail) {
    return (
      <div className="app">
        <header className="header">
          <h1>Signic SDK Demo</h1>
          <div className="header-info">
            <code>{emailAddress.current}</code>
          </div>
        </header>
        <main className="main">
          <div className="card">
            <div className="detail-actions">
              <button className="btn btn-secondary" onClick={backToList}>
                &larr; Back
              </button>
              <button
                className="btn btn-primary"
                onClick={() => markAsRead(selectedEmail)}
                disabled={loading}
              >
                {loading ? 'Marking...' : 'Mark as Read'}
              </button>
            </div>
            {error && <div className="error">{error}</div>}
            <h2 className="detail-subject">{selectedEmail.subject}</h2>
            <div className="detail-meta">
              <div className="info-row">
                <span className="label">From:</span>
                <span className="value">
                  {formatAddress(selectedEmail.from)}
                </span>
              </div>
              <div className="info-row">
                <span className="label">To:</span>
                <span className="value">
                  {selectedEmail.to.map(formatAddress).join(', ')}
                </span>
              </div>
              <div className="info-row">
                <span className="label">Date:</span>
                <span className="value">{formatDate(selectedEmail.date)}</span>
              </div>
              {selectedEmail.hasAttachments && (
                <div className="info-row">
                  <span className="label">Attachments:</span>
                  <span className="value">Yes</span>
                </div>
              )}
            </div>
            <div className="detail-body">
              <p>{selectedEmail.intro}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Compose state
  if (state === 'compose') {
    const showValidationError =
      composeTo.length > 0 && !isValidWalletAddress(composeTo);
    const canSend =
      isValidWalletAddress(composeTo) &&
      composeSubject.trim().length > 0 &&
      !sending;

    return (
      <div className="app">
        <header className="header">
          <h1>Signic SDK Demo</h1>
          <div className="header-info">
            <code>{emailAddress.current}</code>
          </div>
        </header>
        <main className="main">
          <div className="card">
            <div className="detail-actions">
              <button className="btn btn-secondary" onClick={backToList}>
                &larr; Back
              </button>
              <button
                className="btn btn-primary"
                onClick={sendEmail}
                disabled={!canSend}
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="compose-form">
              <div className="compose-field">
                <label className="label">To:</label>
                <div className="compose-to-wrapper">
                  <input
                    type="text"
                    placeholder="Wallet address (EVM or Solana)"
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value.trim())}
                  />
                  <span className="compose-to-suffix">@signic.email</span>
                </div>
                {showValidationError && (
                  <div className="validation-error">
                    Enter a valid EVM (0x...) or Solana wallet address
                  </div>
                )}
              </div>
              <div className="compose-field">
                <label className="label">Subject:</label>
                <input
                  type="text"
                  placeholder="Email subject"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                />
              </div>
              <div className="compose-field">
                <label className="label">Body:</label>
                <textarea
                  placeholder="Write your message..."
                  rows={10}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Email list state
  return (
    <div className="app">
      <header className="header">
        <h1>Signic SDK Demo</h1>
        <div className="header-info">
          <code>{emailAddress.current}</code>
        </div>
      </header>
      <main className="main">
        <div className="card">
          <div className="list-actions">
            <span className="unread-count">
              {totalUnread} unread email{totalUnread !== 1 ? 's' : ''}
            </span>
            <div className="action-buttons">
              <button className="btn btn-primary" onClick={goToCompose}>
                Compose
              </button>
              <button className="btn btn-secondary" onClick={sendTestEmail}>
                Send me an email
              </button>
              <button
                className="btn btn-primary"
                onClick={refresh}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
          {error && <div className="error">{error}</div>}
          {emails.length === 0 ? (
            <div className="empty">
              No unread emails. Click &quot;Send me an email&quot; to test!
            </div>
          ) : (
            <ul className="email-list">
              {emails.map((email) => (
                <li
                  key={email.id}
                  className="email-item"
                  onClick={() => viewEmail(email)}
                >
                  <div className="email-from">{formatAddress(email.from)}</div>
                  <div className="email-subject">{email.subject}</div>
                  <div className="email-preview">{email.intro}</div>
                  <div className="email-date">{formatDate(email.date)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
