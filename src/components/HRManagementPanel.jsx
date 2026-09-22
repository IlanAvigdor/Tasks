/**
 * HR Management Panel Component
 * Allows commanders to manage their team's personnel:
 * - View team members
 * - Remove employees (not other managers)
 * - Request addition of new employees (requires תמר ב approval)
 * - תמר ב sees pending requests and can approve/reject in real-time
 */

import React, { useState } from 'react';

const DIRECTOR_TEAMS = {
  'ליאל ר': 'לוגיסטיקה',
  'עדי ט': 'אחזקה',
  'תמר ב': 'הנהלה',
  'אור ח': 'תקשוב',
  'סמי י': 'שינוע',
};

export function HRManagementPanel({
  userName,
  userRole,
  workerTeam,
  whitelistUsers,
  pendingApprovals,
  onRemoveEmployee,
  onRequestAddEmployee,
  onApproveRequest,
  onRejectRequest,
}) {
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [addError, setAddError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isTamar = userName === 'תמר ב';
  const isHRManager = userRole === 'director' || isTamar;

  // Determine which team this manager manages
  const managedTeam = DIRECTOR_TEAMS[userName] || workerTeam;

  // Team members for this manager
  const teamMembers = whitelistUsers.filter(u =>
    u.name !== '_reseed_v6' &&
    u.team === managedTeam &&
    u.name !== userName
  );

  // Pending approvals relevant to this manager (for non-Tamar commanders: their own requests)
  const myPendingRequests = pendingApprovals.filter(p =>
    p.requestedBy === userName && p.status === 'pending'
  );
  const myRejections = pendingApprovals.filter(p =>
    p.requestedBy === userName && p.status === 'rejected'
  );

  // All pending approvals (for Tamar)
  const allPending = pendingApprovals.filter(p => p.status === 'pending');

  // Validate Hebrew name format: "שם א" (first name + initial)
  function validateName(name) {
    const trimmed = name.trim();
    // Must be: one or more Hebrew chars, space, exactly one Hebrew char
    const pattern = /^[\u05D0-\u05EA]+(?: [\u05D0-\u05EA]+)*\s[\u05D0-\u05EA]$/;
    return pattern.test(trimmed);
  }

  async function handleSubmitAddRequest(e) {
    e.preventDefault();
    const name = newEmployeeName.trim();
    if (!name) return;

    if (!validateName(name)) {
      setAddError('שם חייב להיות בפורמט: שם פרטי + אות ראשונה (לדוג׳: "ישראל י")');
      return;
    }

    // Check if already exists
    const exists = whitelistUsers.some(u => u.name === name);
    if (exists) {
      setAddError('עובד בשם זה כבר קיים במערכת');
      return;
    }

    setAddError('');
    setSubmitting(true);
    try {
      await onRequestAddEmployee(name, managedTeam);
      setNewEmployeeName('');
    } catch (err) {
      setAddError('שגיאה בשליחת הבקשה, נסה שוב');
    }
    setSubmitting(false);
  }

  if (!isHRManager) return null;

  return (
    <div className="hr-panel" dir="rtl">
      <h2 className="hr-panel__title">
        <span>👥</span> ניהול כוח אדם – {managedTeam}
      </h2>

      {/* === Tamar's approval section === */}
      {isTamar && allPending.length > 0 && (
        <div className="hr-section hr-section--approvals">
          <h3 className="hr-section__title">
            <span className="hr-badge hr-badge--pending">{allPending.length}</span>
            📬 בקשות ממתינות לאישור
          </h3>
          <div className="hr-approvals-list">
            {allPending.map(req => (
              <div key={req.id} className="hr-approval-card">
                <div className="hr-approval-card__info">
                  <span className="hr-approval-card__name">👤 {req.candidateName}</span>
                  <span className="hr-approval-card__meta">
                    {req.team} · בוקש על ידי {req.requestedBy}
                  </span>
                </div>
                <div className="hr-approval-card__actions">
                  <button
                    className="hr-btn hr-btn--approve"
                    onClick={() => onApproveRequest(req.id, req.candidateName, req.team)}
                    title="אשר הוספה"
                  >
                    ✅ אשרי
                  </button>
                  <button
                    className="hr-btn hr-btn--reject"
                    onClick={() => onRejectRequest(req.id, req.candidateName, req.requestedBy)}
                    title="דחי בקשה"
                  >
                    ❌ דחי
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === Rejection notifications for this manager === */}
      {myRejections.length > 0 && (
        <div className="hr-section hr-section--rejections">
          <h3 className="hr-section__title">❌ בקשות שנדחו</h3>
          <div className="hr-rejections-list">
            {myRejections.map(req => (
              <div key={req.id} className="hr-rejection-card">
                <span className="hr-rejection-card__name">👤 {req.candidateName}</span>
                <span className="hr-rejection-card__status">❌ לא אושר</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === Request to add employee === */}
      <div className="hr-section hr-section--add">
        <h3 className="hr-section__title">➕ בקשת הוספת עובד לצוות</h3>
        <p className="hr-section__desc">הבקשה תישלח לאישור תמר ב לפני הוספה</p>
        <form className="hr-add-form" onSubmit={handleSubmitAddRequest}>
          <input
            className="hr-input"
            type="text"
            placeholder='שם + אות (לדוג׳: "ישראל י")'
            value={newEmployeeName}
            onChange={e => { setNewEmployeeName(e.target.value); setAddError(''); }}
            disabled={submitting}
          />
          <button
            className="hr-btn hr-btn--submit"
            type="submit"
            disabled={submitting || !newEmployeeName.trim()}
          >
            {submitting ? '...שולח' : 'שלח לאישור'}
          </button>
        </form>
        {addError && <p className="hr-error">{addError}</p>}

        {/* My pending requests */}
        {myPendingRequests.length > 0 && (
          <div className="hr-pending-mine">
            <p className="hr-pending-mine__label">⏳ ממתין לאישור:</p>
            {myPendingRequests.map(req => (
              <span key={req.id} className="hr-pending-mine__tag">
                {req.candidateName}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* === Team members list === */}
      <div className="hr-section hr-section--members">
        <h3 className="hr-section__title">
          👥 עובדי הצוות ({teamMembers.length})
        </h3>
        {teamMembers.length === 0 ? (
          <p className="hr-empty">אין עובדים רשומים בצוות זה</p>
        ) : (
          <div className="hr-members-list">
            {teamMembers.map(member => (
              <div key={member.name} className="hr-member-card">
                <div className="hr-member-card__info">
                  <span className="hr-member-card__name">{member.name}</span>
                  <span className={`hr-member-card__role hr-role--${member.role}`}>
                    {member.role === 'manager' ? '🔑 מנהל' :
                     member.role === 'director' ? '⭐ מנהל' : '👤 עובד'}
                  </span>
                </div>
                {/* Only allow removing employees (not managers/commanders) */}
                {member.role !== 'manager' && member.role !== 'director' && member.role !== 'super_admin' && (
                  <button
                    className="hr-btn hr-btn--remove"
                    onClick={() => onRemoveEmployee(member.name)}
                    title={`הסר את ${member.name} מהצוות`}
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { DIRECTOR_TEAMS };
