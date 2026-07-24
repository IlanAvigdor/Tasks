import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, auth } from './firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  getDocs,
  writeBatch,
  getDoc,
  setDoc
} from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

const ADMIN_GUID = 'admin-987654';
const APP_VERSION = '1.04';
const NOTIFICATION_SOUND = `${import.meta.env.BASE_URL}notification.mp3`;
const AVAILABLE_TEAMS = ['תקשוב', 'לוגיסטיקה', 'רכב וניוד', 'רפואה', 'טנ"א (חימוש)', 'מטבח', 'שלישות', 'מפקדה'];
const PLATOON_SERGEANTS = ["מעיין ישראלי", "מעיין נקאש", "דביר אגסי", "דמקה אייזנאו", "דמקה אזנאו"];

const KNOWN_TEAM_ROLES = {
  // Super Admins
  "אילן אביגדור": { team: "מפקדה", role: "super_admin" },
  "לירי אביגדור": { team: "לוגיסטיקה", role: "super_admin" },
  "תמר ביליה": { team: "מפקדה", role: "commander" },

  // תקשוב - סגל (Commanders)
  "דביר הרמן": { team: "תקשוב", role: "commander" },
  "אור חממה": { team: "תקשוב", role: "commander" },
  "אורין": { team: "תקשוב", role: "commander" },
  "אמיתי בהדני": { team: "תקשוב", role: "commander" },
  "תמי מזרחי": { team: "תקשוב", role: "commander" },
  "מישל פיוטרובסקי": { team: "תקשוב", role: "commander" },

  // תקשוב - חיילים (Soldiers)
  "אוראל חביב": { team: "תקשוב", role: "soldier" },
  "נגה שי": { team: "תקשוב", role: "soldier" },
  "דביר אגסי": { team: "תקשוב", role: "soldier" },
  "עדי כרמי": { team: "תקשוב", role: "soldier" },
  "שוהם פאר": { team: "תקשוב", role: "soldier" },
  "קסם סוויסה": { team: "תקשוב", role: "soldier" },
  "גרשון מירל": { team: "תקשוב", role: "soldier" },
  "אלה לידור": { team: "תקשוב", role: "soldier" },

  // לוגיסטיקה - סגל (Commanders)
  "ליאל רוטנברג": { team: "לוגיסטיקה", role: "commander" },
  "חסין סלותי": { team: "לוגיסטיקה", role: "commander" },
  "מתן לוי": { team: "לוגיסטיקה", role: "commander" },
  "פאר זנגאני": { team: "לוגיסטיקה", role: "commander" },
  "שליו פאבון": { team: "לוגיסטיקה", role: "commander" },

  // לוגיסטיקה - חיילים (Soldiers)
  "מעיין ישראלי": { team: "לוגיסטיקה", role: "soldier" },
  "ירין תורג׳מן": { team: "לוגיסטיקה", role: "soldier" },
  "גיל זיו": { team: "לוגיסטיקה", role: "soldier" },
  "אליאב ביטון": { team: "לוגיסטיקה", role: "soldier" },
  "ארטיום": { team: "לוגיסטיקה", role: "soldier" },
  "אליה עמר": { team: "לוגיסטיקה", role: "soldier" },
  "אייל הרשקוביץ": { team: "לוגיסטיקה", role: "soldier" },

  // רכב וניוד - סגל (Commanders)
  "סמי יגודייב": { team: "רכב וניוד", role: "commander" },
  "ליאן קריסטופר": { team: "רכב וניוד", role: "commander" },

  // רכב וניוד - חיילים (Soldiers)
  "אלון אופיר": { team: "רכב וניוד", role: "soldier" },
  "ליאב ביטון": { team: "רכב וניוד", role: "soldier" },
  "לירון שטרן": { team: "רכב וניוד", role: "soldier" },
  "ולריה סטלמק": { team: "רכב וניוד", role: "soldier" },
  "שי וינד": { team: "רכב וניוד", role: "soldier" },
  "עידו כהן": { team: "רכב וניוד", role: "soldier" },
  "אלון מעוז": { team: "רכב וניוד", role: "soldier" },
  "עדן בן דוד": { team: "רכב וניוד", role: "soldier" },
  "מתן ביטון": { team: "רכב וניוד", role: "soldier" },
  "יניב חנוך": { team: "רכב וניוד", role: "soldier" },
  "קים פלג": { team: "רכב וניוד", role: "soldier" },
  "רואי עמדי": { team: "רכב וניוד", role: "soldier" },
  "אושר חכמון": { team: "רכב וניוד", role: "soldier" },
  "טל זדורייב": { team: "רכב וניוד", role: "soldier" },
  "עידן יוסף": { team: "רכב וניוד", role: "soldier" },
  "דניאל אלימוב": { team: "רכב וניוד", role: "soldier" },
  "חיים גבריאלוב": { team: "רכב וניוד", role: "soldier" },

  // רפואה - סגל (Commanders)
  "בן פורמן": { team: "רפואה", role: "commander" },
  "שחף בכר": { team: "רפואה", role: "commander" },

  // רפואה - חיילים (Soldiers)
  "אושר אלמקייס": { team: "רפואה", role: "soldier" },
  "סתו גיטר": { team: "רפואה", role: "soldier" },
  "יוסף חי סרוסי": { team: "רפואה", role: "soldier" },
  "תכלת זליג": { team: "רפואה", role: "soldier" },
  "ירדן חכמון": { team: "רפואה", role: "soldier" },
  "שליו סלדינגר": { team: "רפואה", role: "soldier" },
  "רז חורי": { team: "רפואה", role: "soldier" },
  "בני וייס": { team: "רפואה", role: "soldier" },

  // טנ"א (חימוש) - סגל (Commanders)
  "עומר גלבר": { team: "טנ\"א (חימוש)", role: "commander" },
  "עדי טאוב": { team: "טנ\"א (חימוש)", role: "commander" },
  "דודו דריי": { team: "טנ\"א (חימוש)", role: "commander" },
  "מרק דלוב": { team: "טנ\"א (חימוש)", role: "commander" },
  "אמיר לוי": { team: "טנ\"א (חימוש)", role: "commander" },
  "אביב אמסלם": { team: "טנ\"א (חימוש)", role: "commander" },
  "אור טויטו": { team: "טנ\"א (חימוש)", role: "commander" },
  "סרגיי מטיצין": { team: "טנ\"א (חימוש)", role: "commander" },
  "רון אברהם": { team: "טנ\"א (חימוש)", role: "commander" },
  "אבישג סמואל": { team: "טנ\"א (חימוש)", role: "commander" },
  "אור סוקוליק": { team: "טנ\"א (חימוש)", role: "commander" },
  "תאיר חביב": { team: "טנ\"א (חימוש)", role: "commander" },

  // טנ"א (חימוש) - חיילים (Soldiers)
  "מאור מנחם": { team: "טנ\"א (חימוש)", role: "soldier" },
  "אליה אוחיון": { team: "טנ\"א (חימוש)", role: "soldier" },
  "דמקה אזנאו": { team: "טנ\"א (חימוש)", role: "soldier" },
  "עידו בן טל": { team: "טנ\"א (חימוש)", role: "soldier" },
  "עדן לגריסי": { team: "טנ\"א (חימוש)", role: "soldier" },
  "בן עוז": { team: "טנ\"א (חימוש)", role: "soldier" },
  "ליהי ביטון": { team: "טנ\"א (חימוש)", role: "soldier" },
  "אורי מנטל": { team: "טנ\"א (חימוש)", role: "soldier" },
  "אביאל יעקוב": { team: "טנ\"א (חימוש)", role: "soldier" },
  "אורי פינטו": { team: "טנ\"א (חימוש)", role: "soldier" }
};

const TASK_BANK_TEMPLATES = {
  'לוגיסטיקה': [
    { title: 'בדיקת מלאי ציוד יומית', description: 'ספירת מלאי במחסני אספקה וציוד אישי' },
    { title: 'חלוקת אספקה וציוד', description: 'ניפוק ציוד ודלק ליחידות' },
    { title: 'סידור מחסנים ונעילה', description: 'ארגון המחסנים, סגירת רישומים ונעילה' },
    { title: 'בדיקת תקינות מלגזה/מנגנוני שינוע', description: 'בדיקת שמן, דלק ובטיחות כלי שינוע' },
    { title: 'קליטת משלוח ציוד חדש', description: 'רישום, בחינה ופריקת משלוחי ציוד נכנסים' },
    { title: 'סקר בלאי וציוד תקול', description: 'איסוף דיווחים על ציוד בלאי והעברה לתיקון' }
  ],
  'מפקדה': [
    { title: 'תדריך בוקר מפקדה', description: 'הערכת מצב וסנכרון משימות יומי' },
    { title: 'מעקב סטטוס גדודי', description: 'סקירת ביצוע משימות בכלל הצוותים' },
    { title: 'סיכום יום ופקודות למחר', description: 'סיכום הישגים יומי והפצת דגשים' },
    { title: 'עדכון לוח זמנים גדודי', description: 'סנכרון לו"ז אימונים, סיורים ומשימות' },
    { title: 'בדיקת כוננות חמ"ל', description: 'וידוא מוכנות אמצעי תקשורת ודיווח חמ"ל' }
  ],
  'תקשוב': [
    { title: 'בדיקת קשר גדודית', description: 'בדיקת מופע תדרים ומכשירי קשר צוותיים' },
    { title: 'סריקת מוצבי קשר ותשתיות', description: 'בדיקת אנטנות, כבלים וממירי מתח' },
    { title: 'טעינת סוללות מכשירי קשר', description: 'איסוף, טעינה וחלוקת סוללות גיבוי' }
  ],
  'רכב וניוד': [
    { title: 'מסדר טיפול שבועי/יומי (טפ"ש)', description: 'בדיקת שמן, מים, לחץ אוויר ומערכות בלמים' },
    { title: 'ניפוק ותדלוק כלים', description: 'רישום ותדלוק רכבי סיור ומנהלה' },
    { title: 'בדיקת רישיונות ויומני רכב', description: 'וידוא יומני נסיעה חתומים ועדכניים' }
  ],
  'רפואה': [
    { title: 'בדיקת תרופות וציוד עזרה ראשונה', description: 'ספירת מלאי ותוקף ציוד רפואי' },
    { title: 'בדיקת כוננות אמבולנס/תאג"ד', description: 'וידוא ציוד החייאה וציוד מילוט תקין' },
    { title: 'מסדר תברואה וחיטוי', description: 'חיטוי ציוד רפואי ובדיקת ניקיון התחנה' }
  ],
  'טנ"א (חימוש)': [
    { title: 'מסדר בחינת נשק וציוד טכני', description: 'בדיקת תקינות נשקייה וחלפים טכניים' },
    { title: 'תיקון מכלולים ודיווח תקלות', description: 'מענה לתקלות נשק וכלים טכניים' },
    { title: 'שימון ותחזוקת ציוד טכני', description: 'שימון תקופתי לכלים ומערכות ירי' }
  ],
  'מטבח': [
    { title: 'הכנת ארוחת בוקר', description: 'בישול, עריכת שולחנות וחלוקת מזון' },
    { title: 'נקיון וחיטוי מטבח', description: 'שטיפת כלים, ניקוי משטחי עבודה וריענון' },
    { title: 'ספירת מלאי מצרכים', description: 'בדיקת ירקות, מוצרי יבוא וקירור' }
  ],
  'שלישות': [
    { title: 'עדכון דוח 1 (נוכחות חיילים)', description: 'ספירת נוכחות, ימי חופשה וגימלים' },
    { title: 'טיפול בטפסים ובקשות חיילים', description: 'אישור בקשות חופשה, היתרים ואישורים' },
    { title: 'ראיונות קליטה ושיחות מעקב', description: 'שיחות אישיות ועדכון תיקי חיילים' }
  ]
};

const DEFAULT_BUNDLES = {
  'לוגיסטיקה': [
    {
      name: '📦 ערכת בוקר לוגיסטי',
      description: 'בדיקת מחסנים, ספירת ציוד וניפוק ראשוני',
      tasks: [
        { title: 'בדיקת מלאי ציוד יומית', description: 'ספירת מלאי במחסני אספקה וציוד אישי' },
        { title: 'חלוקת אספקה וציוד', description: 'ניפוק ציוד ודלק ליחידות' },
        { title: 'בדיקת תקינות מלגזה/מנגנוני שינוע', description: 'בדיקת שמן, דלק ובטיחות כלי שינוע' }
      ]
    },
    {
      name: '🔒 ערכת סגירת יום לוגיסטיקה',
      description: 'ארגון מחסנים, ספירת בלאי ונעילת ציוד',
      tasks: [
        { title: 'סידור מחסנים ונעילה', description: 'ארגון המחסנים, סגירת רישומים ונעילה' },
        { title: 'סקר בלאי וציוד תקול', description: 'איסוף דיווחים על ציוד בלאי והעברה לתיקון' }
      ]
    }
  ],
  'מפקדה': [
    {
      name: '🎖️ ערכת פתיחת יום מפקדה',
      description: 'תדריך בוקר, סנכרון לו"ז ובדיקת חמ"ל',
      tasks: [
        { title: 'תדריך בוקר מפקדה', description: 'הערכת מצב וסנכרון משימות יומי' },
        { title: 'בדיקת כוננות חמ"ל', description: 'וידוא מוכנות אמצעי תקשורת ודיווח חמ"ל' }
      ]
    }
  ]
};

const getTaskStatusClass = (task) => {
  if (task.isVerified) return 'status-verified';
  if (task.isDone) return 'status-done';
  if (task.isInProgress) return 'status-in-progress';
  if (!task.assignees || task.assignees.length === 0) return 'status-unassigned';
  return 'status-pending';
};

const getTaskStatusButton = (task, isAdmin, currentUserName) => {
  if (isAdmin) {
    if (task.isVerified) {
      return <button className="status-btn btn-reset">איפוס</button>;
    }
    if (task.isDone) {
      return <button className="status-btn btn-verify">בוצע</button>;
    }
    return null;
  } else {
    if (task.isVerified) return null;
    if (!task.isInProgress && !task.isDone) {
      const hasAccepted = task.acceptedBy?.includes(currentUserName);
      if (hasAccepted) {
        return <button className="status-btn btn-accepted" disabled>✓ נרשם (ממתין...)</button>;
      }
      return <button className="status-btn btn-pending">על זה</button>;
    } else if (task.isInProgress) {
      return <button className="status-btn btn-in-progress">סיימתי</button>;
    } else if (task.isDone) {
      return <button className="status-btn btn-done">איפוס</button>;
    }
  }
  return null;
};

const TaskDragPreview = ({ task, isAdmin, isOverTrash, currentUserName }) => {
  if (!task) return null;

  const statusClass = getTaskStatusClass(task);
  const statusButton = getTaskStatusButton(task, isAdmin, currentUserName);

  const style = {
    opacity: 0.85,
    transform: 'none',
    transition: 'scale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
    scale: isOverTrash ? 0.6 : 0.9,
    transformOrigin: 'center center',
    pointerEvents: 'none',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
  };

  return (
    <div className={`task-item ${statusClass} dragging`} style={style}>
      <div className="task-inner-content">
        <div className="task-content">
          <div className="task-header-row">
            <div className="task-title">{task.title}</div>
          </div>
          {task.description && <div className="task-desc">{task.description}</div>}
          <div className="task-assignees-row">
            {task.assignees?.length > 0 && (
              <span className="occupied-badge">משויך ({task.assignees.length})</span>
            )}
          </div>
        </div>
        <div className="task-actions" style={{display:'flex', alignItems:'center'}}>
          {statusButton}
        </div>
      </div>
    </div>
  );
};

const TrashBin = ({ isAdmin, onLongPress }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'trash-bin',
  });
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef(null);

  const startPress = (e) => {
    // We only trigger long press for admins
    if (!isAdmin) return;
    
    // Clear any existing timer to avoid leaks or double-activation on touch devices
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setIsPressing(true);
    timerRef.current = setTimeout(() => {
      setIsPressing(false);
      timerRef.current = null;
      // Delay the blocking prompt to allow the UI to update first and prevent flicker
      setTimeout(() => {
        onLongPress();
      }, 50);
    }, 1500);
  };

  const endPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressing(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!isAdmin) return null;

  return (
    <div 
      ref={setNodeRef} 
      className={`trash-bin-fab ${isOver ? 'active' : ''} ${isPressing ? 'pressing' : ''}`}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchCancel={endPress}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none'
      }}
    >
      {isPressing ? (
        <svg 
          className="red-clock-svg" 
          viewBox="0 0 24 24" 
          width="28" 
          height="28" 
          fill="none" 
          stroke="#ef4444" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      ) : (
        '🗑️'
      )}
    </div>
  );
};

const SortableTask = ({ task, isAdmin, isSelected, onToggleSelect, onVerify, onDelete, onOpenAssignment, onToggleStatus, currentUserName }) => {
  const [isPressing, setIsPressing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localDesc, setLocalDesc] = useState(task.description || '');
  const [editingField, setEditingField] = useState(null);
  const [showDesc, setShowDesc] = useState(false);
  const titleRef = useRef(null);
  const descRef = useRef(null);
  const containerRef = useRef(null);

  // Sync local state when DB updates (only when not actively editing)
  useEffect(() => {
    if (!isEditing) {
      setLocalTitle(task.title);
      setLocalDesc(task.description || '');
    }
  }, [task.title, task.description, isEditing]);

  const statusButton = getTaskStatusButton(task, isAdmin, currentUserName);
  const renderedStatusButton = statusButton ? React.cloneElement(statusButton, {
    onClick: (e) => {
      e.stopPropagation();
      onToggleStatus(task);
    }
  }) : null;


  useEffect(() => {
    if (isEditing && editingField) {
      const el = editingField === 'title' ? titleRef.current : descRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }
  }, [isEditing, editingField]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isAdmin || isEditing) return;

    let longPressTimer = null;
    let isLongPressActive = false;
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e) => {
      isLongPressActive = false;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      longPressTimer = setTimeout(() => {
        isLongPressActive = true;
        setIsPressing(true);
        if (navigator.vibrate) navigator.vibrate(40);
      }, 250);
    };

    const handleTouchMove = (e) => {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY);

      if (isLongPressActive) {
        if (e.cancelable) e.preventDefault();
      } else if (deltaX > 8 || deltaY > 8) {
        clearTimeout(longPressTimer);
        setIsPressing(false);
      }
    };

    const handleTouchEnd = () => {
      clearTimeout(longPressTimer);
      isLongPressActive = false;
      setIsPressing(false);
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isAdmin, isEditing]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({id: task.id, disabled: isEditing});

  const style = {
    transform: isDragging ? null : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : isPressing ? 0.8 : 1,
    scale: isDragging ? 1 : isPressing ? 0.94 : 1,
    zIndex: (isDragging || isPressing) ? 1000 : 1,
    touchAction: (isDragging || isPressing) ? 'none' : 'pan-y',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    pointerEvents: isDragging ? 'none' : 'auto'
  };


  const handleBlur = (e) => {
    // Check if the new focus target is still inside this task card
    if (e.relatedTarget && containerRef.current?.contains(e.relatedTarget)) {
      return;
    }
    handleSave();
  };

  const handleSave = async () => {
    const titleToSave = localTitle.trim();
    const descToSave = localDesc.trim();
    
    setIsEditing(false);
    setEditingField(null);
    setShowDesc(false);

    if (titleToSave !== task.title || descToSave !== (task.description || '')) {
      try {
        await updateDoc(doc(db, "tasks", task.id), { 
          title: titleToSave, 
          description: descToSave 
        });
        console.log("Task updated successfully:", task.id);
      } catch (err) { 
        console.error("Error updating task in Firestore:", err); 
        // Revert on error
        setLocalTitle(task.title);
        setLocalDesc(task.description || '');
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { 
      setLocalTitle(task.title); 
      setLocalDesc(task.description || ''); 
      setIsEditing(false); 
      setEditingField(null);
      setShowDesc(false);
    }
  };

  return (
    <div 
      ref={(node) => { setNodeRef(node); containerRef.current = node; }} 
      style={style} 
      className={`task-item ${getTaskStatusClass(task)} ${isSelected ? 'active-task' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={() => isAdmin && !isEditing && onToggleSelect()}
      onContextMenu={(e) => isAdmin && e.preventDefault()}
      {...attributes}
      {...listeners}
    >
      <div className="task-inner-content">
        <div className="task-content" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: '8px', flex: 1, minWidth: 0 }}>
          {isEditing && editingField === 'title' ? (
            <input
              ref={titleRef}
              className="inline-edit-input"
              style={{ flex: '1 1 100px', margin: 0, padding: '2px 6px' }}
              value={localTitle} onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleBlur} onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="task-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={(e) => { 
              if (!isAdmin) return;
              e.stopPropagation(); 
              setEditingField('title'); 
              setIsEditing(true); 
            }}>{task.title}</div>
          )}

          <div className="task-assignees-row" style={{position:'relative', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '4px'}}>
            {task.assignees?.length > 0 && (
              <span className="occupied-badge">משויך ({task.assignees.length})</span>
            )}
            {isAdmin && (
              <button className="add-assignee-btn" onClick={(e) => { 
                e.stopPropagation(); 
                onOpenAssignment(task.id); 
              }}>👤</button>
            )}
            {!task.assignees?.length && !isAdmin && (
              <span style={{fontSize:'0.65rem', color:'var(--text-muted)'}}>ללא שיוך</span>
            )}
          </div>

          {(showDesc || (isEditing && editingField === 'description')) && (
            <div style={{ width: '100%', flexBasis: '100%', marginTop: '4px' }}>
              {isEditing && editingField === 'description' ? (
                <textarea
                  ref={descRef}
                  className="inline-edit-textarea"
                  style={{ width: '100%', minHeight: '30px', margin: 0, padding: '2px 6px' }}
                  value={localDesc}
                  onChange={(e) => setLocalDesc(e.target.value)}
                  onBlur={handleBlur} onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()} placeholder="תיאור..."
                />
              ) : (
                task.description && (
                  <div 
                    className="task-desc" 
                    style={{ cursor: isAdmin ? 'text' : 'default', fontSize: '0.78rem', opacity: 0.85, background: 'rgba(0,0,0,0.04)', padding: '4px 8px', borderRadius: '4px', width: '100%' }}
                    onClick={(e) => { 
                      if (!isAdmin) return;
                      e.stopPropagation(); 
                      setEditingField('description'); 
                      setIsEditing(true); 
                    }}
                  >
                    {task.description}
                  </div>
                )
              )}
            </div>
          )}
        </div>
        <div className="task-actions" style={{display:'flex', alignItems:'center', gap: '8px'}}>
          {(task.description || isAdmin) && !isEditing && (
            <span 
              className="info-badge"
              onClick={(e) => { 
                e.stopPropagation(); 
                if (!task.description && isAdmin) {
                  setEditingField('description'); 
                  setIsEditing(true); 
                } else {
                  setShowDesc(!showDesc); 
                }
              }}
              title={task.description ? "תיאור משימה" : "הוסף תיאור"}
            >
              ?
            </span>
          )}
          {renderedStatusButton}
        </div>
      </div>
    </div>
  );
};

const WorkerDragPreview = ({ worker, tasks, viewTime, isOverTrash }) => {
  if (!worker) return null;

  const workerTasks = tasks.filter(t => t.assignees?.includes(worker.name) && (t.timeOfDay === viewTime || (!t.timeOfDay && viewTime === 'morning')));
  const doneCount = workerTasks.filter(t => t.isDone).length;

  const style = {
    opacity: 0.85,
    transform: 'none',
    transition: 'scale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
    scale: isOverTrash ? 0.6 : 0.9,
    transformOrigin: 'center center',
    pointerEvents: 'none',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
  };

  return (
    <div className="person-card dragging" style={style}>
      <div className="person-header">
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>
            {worker.name} <span style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.6 }}>- {worker.team}</span>
          </div>
          <div className="status-badges">
            <span className="status-badge pending">{workerTasks.length - doneCount} בביצוע</span>
            <span className="status-badge done">{doneCount} הושלמו</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const WorkerCard = ({ worker, tasks, isAdmin, viewTime, onOpenAssignment }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({id: worker.id, disabled: !isAdmin});

  const style = {
    transform: isDragging ? null : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 1000 : 1,
    touchAction: isDragging ? 'none' : 'pan-y',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    pointerEvents: isDragging ? 'none' : 'auto',
    position: 'relative',
    cursor: 'pointer'
  };

  const activeTasks = tasks.filter(t => t.assignees?.includes(worker.name) && (t.timeOfDay === viewTime || (!t.timeOfDay && viewTime === 'morning')));
  
  const inProgressTasks = activeTasks.filter(t => t.isInProgress && !t.isDone && !t.isVerified);
  const pendingTasks = activeTasks.filter(t => !t.isInProgress && !t.isDone && !t.isVerified);
  const completedTasks = activeTasks.filter(t => t.isDone || t.isVerified);
  
  const isBusy = activeTasks.some(t => !t.isDone && !t.isVerified);

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`person-card ${isDragging ? 'dragging' : ''} ${isExpanded ? 'expanded' : ''}`}
      {...attributes}
      {...listeners}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="person-header">
        <div className="person-header-info">
          <span className="person-header-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {worker.name}
            {worker.role === 'super_admin' && (
              <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(245, 158, 11, 0.2)', color: '#d97706', borderRadius: '4px', fontWeight: 600 }}>👑 מנהל</span>
            )}
            {worker.role === 'commander' && (
              <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(59, 130, 246, 0.2)', color: '#2563eb', borderRadius: '4px', fontWeight: 600 }}>🎖️ מפקד</span>
            )}
            {worker.role === 'soldier' && (
              PLATOON_SERGEANTS.includes(worker.name) ? (
                <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', borderRadius: '4px', fontWeight: 600 }}>⚡ סמל</span>
              ) : (
                <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(107, 114, 128, 0.15)', color: '#4b5563', borderRadius: '4px', fontWeight: 500 }}>🪖 חייל</span>
              )
            )}
          </span>
          <span className="person-header-subtitle">{worker.team}</span>
        </div>
        <div className="person-header-meta">
          <span className={`availability-badge ${isBusy ? 'busy' : 'available'}`}>
            {isBusy ? 'בביצוע' : 'פנוי'}
          </span>
          <span className="caret-icon">▼</span>
        </div>
      </div>

      {isExpanded && (
        <div className="person-details" onClick={(e) => e.stopPropagation()}>
          {inProgressTasks.length > 0 && (
            <div className="task-group">
              <span className="task-group-title">🔥 בביצוע:</span>
              <div className="task-group-list">
                {inProgressTasks.map(task => (
                  <div key={task.id} className="worker-task-item">
                    <div className="status-dot pending" />
                    <span className="task-mini-title">{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingTasks.length > 0 && (
            <div className="task-group">
              <span className="task-group-title">⏳ טרם בוצע:</span>
              <div className="task-group-list">
                {pendingTasks.map(task => (
                  <div key={task.id} className="worker-task-item">
                    <div className="status-dot pending" style={{ background: '#94a3b8', boxShadow: 'none' }} />
                    <span className="task-mini-title">{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedTasks.length > 0 && (
            <div className="task-group">
              <span className="task-group-title">✅ הושלמו:</span>
              <div className="task-group-list">
                {completedTasks.map(task => (
                  <div key={task.id} className="worker-task-item done">
                    <div className={`status-dot ${task.isVerified ? 'verified' : 'done'}`} />
                    <span className="task-mini-title">{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTasks.length === 0 && (
            <p style={{ fontSize: '0.85rem', opacity: 0.6, textAlign: 'center', margin: '4px 0' }}>אין משימות משויכות לזמן זה</p>
          )}

          {isAdmin && (
            <button 
              className="btn btn-save" 
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenAssignment(worker.id);
              }}
            >
              👤 שיוך משימות לעובד
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const AssignmentModal = ({ isOpen, type, targetId, onClose, tasks, registeredWorkers, onToggleAssignment, viewTime }) => {
  if (!isOpen) return null;

  if (type === 'task') {
    const task = tasks.find(t => t.id === targetId);
    if (!task) return null;

    return (
      <div className="assignment-modal-overlay" onClick={onClose}>
        <div className="assignment-modal" onClick={e => e.stopPropagation()}>
          <h3>שיוך עובדים למשימה</h3>
          <p style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--primary)' }}>{task.title}</p>
          {task.description && <p style={{ fontSize: '0.85rem' }}>{task.description}</p>}
          
          <div className="assignment-list">
            {registeredWorkers.map(worker => {
              const isAssigned = task.assignees?.includes(worker.name);
              return (
                <div 
                  key={worker.id} 
                  className={`assignment-item ${isAssigned ? 'selected' : ''}`}
                  onClick={() => onToggleAssignment(task.id, worker.name)}
                >
                  <div className={`custom-checkbox ${isAssigned ? 'checked' : ''}`}>
                    {isAssigned && <span>✓</span>}
                  </div>
                  <div className="assignment-item-text">
                    <span className="assignment-item-title">{worker.name}</span>
                    <span className="assignment-item-subtitle">צוות: {worker.team}</span>
                  </div>
                </div>
              );
            })}
            {registeredWorkers.length === 0 && (
              <p style={{ textAlign: 'center', opacity: 0.5, padding: '1rem' }}>אין עובדים רשומים במערכת</p>
            )}
          </div>

          <button className="btn btn-save" style={{ width: '100%', marginTop: '1rem' }} onClick={onClose}>סיום</button>
        </div>
      </div>
    );
  } else {
    // Worker type
    const worker = registeredWorkers.find(w => w.id === targetId);
    if (!worker) return null;

    const availableTasks = tasks.filter(t => t.timeOfDay === viewTime || (!t.timeOfDay && viewTime === 'morning'));

    return (
      <div className="assignment-modal-overlay" onClick={onClose}>
        <div className="assignment-modal" onClick={e => e.stopPropagation()}>
          <h3>שיוך משימות לעובד</h3>
          <p style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--primary)' }}>{worker.name} ({worker.team})</p>
          <p style={{ fontSize: '0.85rem' }}>בחר את המשימות לביצוע בזמן: <strong>{viewTime === 'morning' ? 'בוקר' : viewTime === 'noon' ? 'צהריים' : 'ערב'}</strong></p>

          <div className="assignment-list">
            {availableTasks.map(task => {
              const isAssigned = task.assignees?.includes(worker.name);
              return (
                <div 
                  key={task.id} 
                  className={`assignment-item ${isAssigned ? 'selected' : ''}`}
                  onClick={() => onToggleAssignment(task.id, worker.name)}
                >
                  <div className={`custom-checkbox ${isAssigned ? 'checked' : ''}`}>
                    {isAssigned && <span>✓</span>}
                  </div>
                  <div className="assignment-item-text">
                    <span className="assignment-item-title">{task.title}</span>
                    {task.description && <span className="assignment-item-subtitle">{task.description}</span>}
                  </div>
                </div>
              );
            })}
            {availableTasks.length === 0 && (
              <p style={{ textAlign: 'center', opacity: 0.5, padding: '1rem' }}>אין משימות להצגה בזמן זה</p>
            )}
          </div>

          <button className="btn btn-save" style={{ width: '100%', marginTop: '1rem' }} onClick={onClose}>סיום</button>
        </div>
      </div>
    );
  }
};

const TaskBankModal = ({ isOpen, onClose, activeTeam, onDeployTasks, onSaveCustomBundle, customBundles = [] }) => {
  const [modalTab, setModalTab] = useState('bundles'); // 'bundles' | 'bank' | 'create'
  const bankTasks = TASK_BANK_TEMPLATES[activeTeam] || TASK_BANK_TEMPLATES['לוגיסטיקה'] || [];
  const defaultBundles = DEFAULT_BUNDLES[activeTeam] || DEFAULT_BUNDLES['לוגיסטיקה'] || [];
  const teamCustomBundles = customBundles.filter(b => !b.team || b.team === activeTeam);
  const allBundles = [...defaultBundles, ...teamCustomBundles];

  const [selectedBankIndexes, setSelectedBankIndexes] = useState([]);
  const [newBundleName, setNewBundleName] = useState('');
  const [newBundleDescription, setNewBundleDescription] = useState('');
  const [newBundleTasks, setNewBundleTasks] = useState([{ title: '', description: '' }]);

  if (!isOpen) return null;

  const toggleSelectBankTask = (idx) => {
    setSelectedBankIndexes(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleSelectAllBank = () => {
    if (selectedBankIndexes.length === bankTasks.length) {
      setSelectedBankIndexes([]);
    } else {
      setSelectedBankIndexes(bankTasks.map((_, i) => i));
    }
  };

  const handleDeploySelectedBank = () => {
    const tasksToDeploy = selectedBankIndexes.map(i => bankTasks[i]);
    if (tasksToDeploy.length > 0) {
      onDeployTasks(tasksToDeploy);
      setSelectedBankIndexes([]);
      onClose();
    }
  };

  const handleAddField = () => {
    setNewBundleTasks(prev => [...prev, { title: '', description: '' }]);
  };

  const handleSaveBundleSubmit = (e) => {
    e.preventDefault();
    const validTasks = newBundleTasks.filter(t => t.title.trim().length > 0);
    if (!newBundleName || validTasks.length === 0) return;
    onSaveCustomBundle({
      name: newBundleName,
      description: newBundleDescription,
      team: activeTeam,
      tasks: validTasks
    });
    setNewBundleName('');
    setNewBundleDescription('');
    setNewBundleTasks([{ title: '', description: '' }]);
    setModalTab('bundles');
  };

  return (
    <div className="compact-form-overlay" onClick={onClose}>
      <div 
        className="glass-card task-bank-modal" 
        onClick={e => e.stopPropagation()}
        style={{ width: '92%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem', borderRadius: '20px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📦</span>
            <span>בנק משימות & ערכות ({activeTeam})</span>
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✖</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.2rem', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '0.6rem' }}>
          <button 
            className={`btn-filter ${modalTab === 'bundles' ? 'active' : ''}`}
            onClick={() => setModalTab('bundles')}
          >
            📦 ערכות ({allBundles.length})
          </button>
          <button 
            className={`btn-filter ${modalTab === 'bank' ? 'active' : ''}`}
            onClick={() => setModalTab('bank')}
          >
            ⚡ בנק משימות ({bankTasks.length})
          </button>
          <button 
            className={`btn-filter ${modalTab === 'create' ? 'active' : ''}`}
            onClick={() => setModalTab('create')}
            style={{ color: '#3b82f6' }}
          >
            ➕ יצור ערכה
          </button>
        </div>

        {modalTab === 'bundles' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {allBundles.map((bundle, idx) => (
              <div key={idx} style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px' }}>{bundle.name}</div>
                {bundle.description && <div style={{ fontSize: '0.85rem', opacity: 0.75, marginBottom: '8px' }}>{bundle.description}</div>}
                
                <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '10px' }}>
                  <strong>משימות בערכה ({bundle.tasks.length}):</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingRight: '1.2rem' }}>
                    {bundle.tasks.map((t, i) => (
                      <li key={i}>{t.title}</li>
                    ))}
                  </ul>
                </div>

                <button 
                  className="btn btn-save" 
                  style={{ width: '100%', padding: '0.6rem', fontSize: '0.95rem' }}
                  onClick={() => {
                    onDeployTasks(bundle.tasks);
                    onClose();
                  }}
                >
                  🚀 הפעל ערכה במרחב ({bundle.tasks.length} משימות)
                </button>
              </div>
            ))}
          </div>
        )}

        {modalTab === 'bank' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
              <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>בחר משימות להוספה מהירה:</span>
              <button onClick={handleSelectAllBank} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                {selectedBankIndexes.length === bankTasks.length ? 'בטל הכל' : 'בחר הכל'}
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.2rem' }}>
              {bankTasks.map((t, idx) => {
                const isChecked = selectedBankIndexes.includes(idx);
                return (
                  <div 
                    key={idx}
                    onClick={() => toggleSelectBankTask(idx)}
                    style={{
                      background: isChecked ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0,0,0,0.03)',
                      border: isChecked ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(0,0,0,0.08)',
                      borderRadius: '10px', padding: '0.7rem 0.9rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '10px'
                    }}
                  >
                    <input type="checkbox" checked={isChecked} onChange={() => {}} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t.title}</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{t.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              className="btn btn-save" 
              style={{ width: '100%', padding: '0.7rem', fontSize: '1rem' }}
              disabled={selectedBankIndexes.length === 0}
              onClick={handleDeploySelectedBank}
            >
              ⚡ הוסף {selectedBankIndexes.length} משימות שנבחרו
            </button>
          </div>
        )}

        {modalTab === 'create' && (
          <form onSubmit={handleSaveBundleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>שם הערכה:</label>
              <input 
                className="inline-edit-input" 
                placeholder="לדוגמה: מסדר בוקר לוגיסטי" 
                value={newBundleName} 
                onChange={e => setNewBundleName(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>תיאור קצר:</label>
              <input 
                className="inline-edit-input" 
                placeholder="לדוגמה: בדיקת מחסנים וציוד" 
                value={newBundleDescription} 
                onChange={e => setNewBundleDescription(e.target.value)} 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>משימות בערכה:</label>
              {newBundleTasks.map((t, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', background: 'rgba(0,0,0,0.02)', padding: '0.6rem', borderRadius: '8px' }}>
                  <input 
                    className="inline-edit-input" 
                    placeholder={`שם משימה ${idx + 1}`} 
                    value={t.title} 
                    onChange={e => {
                      const updated = [...newBundleTasks];
                      updated[idx].title = e.target.value;
                      setNewBundleTasks(updated);
                    }} 
                  />
                  <input 
                    className="inline-edit-input" 
                    placeholder="תיאור משימה" 
                    value={t.description} 
                    onChange={e => {
                      const updated = [...newBundleTasks];
                      updated[idx].description = e.target.value;
                      setNewBundleTasks(updated);
                    }} 
                  />
                </div>
              ))}
              <button 
                type="button" 
                onClick={handleAddField}
                style={{ background: 'none', border: '1px dashed rgba(59,130,246,0.5)', color: '#3b82f6', width: '100%', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                ➕ הוסף משימה לערכה
              </button>
            </div>

            <button className="btn btn-save" type="submit" style={{ marginTop: '0.5rem', padding: '0.7rem' }}>
              💾 שמור ערכה חדשה
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [wallPeriod, setWallPeriod] = useState(new Date().getHours() < 12 ? 'morning' : 'evening');
  const [duties, setDuties] = useState({});
  const [attendanceTimeOfDay, setAttendanceTimeOfDay] = useState(new Date().getHours() < 12 ? 'morning' : 'evening');
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyDuties, setMonthlyDuties] = useState({});
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [dutiesTab, setDutiesTab] = useState('calendar');
  const [kitchenMode, setKitchenMode] = useState('half');
  const [rasarMode, setRasarMode] = useState('half');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!selectedCalendarDay) return;
    const dayData = monthlyDuties[selectedCalendarDay] || {};
    const isKitchenFull = dayData.kitchen_morning && dayData.kitchen_evening && dayData.kitchen_morning === dayData.kitchen_evening;
    setKitchenMode(isKitchenFull ? 'full' : 'half');
    
    const isRasarFull = dayData.rasar_morning && dayData.rasar_evening && dayData.rasar_morning === dayData.rasar_evening;
    setRasarMode(isRasarFull ? 'full' : 'half');
  }, [selectedCalendarDay, monthlyDuties]);
  const [viewTime, setViewTime] = useState('morning');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [registeredWorkers, setRegisteredWorkers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [showNav, setShowNav] = useState(true);
  const [userRole, setUserRole] = useState(localStorage.getItem('workerRole') || 'soldier');
  const [selectedTeam, setSelectedTeam] = useState(localStorage.getItem('workerTeam') || 'מטבח');
  const [userName, setUserName] = useState(localStorage.getItem('workerName') || '');
  const [workerTeam, setWorkerTeam] = useState(localStorage.getItem('workerTeam') || '');

  // Security Whitelist States (Declared before useMemo hooks)
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [whitelistUsers, setWhitelistUsers] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [attendanceTeamFilter, setAttendanceTeamFilter] = useState('הכל');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('הכל');
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
  const [meetingConfig, setMeetingConfig] = useState(null);
  const [meetingAlert, setMeetingAlert] = useState('none');

  // UI & Workspace Modal States
  const [registrationName, setRegistrationName] = useState('');
  const [registrationTeam, setRegistrationTeam] = useState('');
  const [activeTab, setActiveTab] = useState('tasks');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignee: '' });
  const [activeId, setActiveId] = useState(null);
  const [activeWorkerId, setActiveWorkerId] = useState(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [customBundles, setCustomBundles] = useState([]);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', message: '', action: null });
  const [assignmentModal, setAssignmentModal] = useState({ isOpen: false, type: 'task', targetId: null });
  const [hideAssigned, setHideAssigned] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerTeam, setNewWorkerTeam] = useState('מטבח');

  const isSuperAdmin = useMemo(() => {
    return isAuthorized && (userRole === 'super_admin' || userName === 'אילן אביגדור' || userName === 'לירי אביגדור');
  }, [isAuthorized, userName, userRole]);

  const isCommander = useMemo(() => {
    return isAuthorized && userRole === 'commander';
  }, [isAuthorized, userRole]);

  const isAdmin = isSuperAdmin || isCommander;

  const isDutyOrganizer = useMemo(() => {
    return isAuthorized && (userName === 'תמר ביליה' || PLATOON_SERGEANTS.includes(userName));
  }, [isAuthorized, userName]);

  const statsList = useMemo(() => {
    if (!isAuthorized) return [];
    const isTamar = userName === 'תמר ביליה';
    const sergeantTeam = whitelistUsers.find(u => u.name === userName)?.team || KNOWN_TEAM_ROLES[userName]?.team || 'תקשוב';
    
    const allSoldiers = getAllSoldiers();
    const teamSoldiers = allSoldiers.filter(s => s.team === sergeantTeam);
    const targetList = isTamar ? allSoldiers : teamSoldiers;
    
    return targetList.map(soldier => {
      let kitchenCount = 0;
      let rasarCount = 0;
      let shabbatCount = 0;
      
      Object.keys(monthlyDuties).forEach(dateStr => {
        if (dateStr.startsWith(currentCalendarMonth)) {
          const d = monthlyDuties[dateStr];
          if (d.kitchen_morning === soldier.name) kitchenCount += 0.5;
          if (d.kitchen_evening === soldier.name) kitchenCount += 0.5;
          if (d.rasar_morning === soldier.name) rasarCount += 0.5;
          if (d.rasar_evening === soldier.name) rasarCount += 0.5;
          if (d.closed_shabbat === soldier.name) shabbatCount += 1;
        }
      });
      
      return {
        name: soldier.name,
        team: soldier.team,
        kitchen: kitchenCount,
        rasar: rasarCount,
        shabbat: shabbatCount,
        total: kitchenCount + rasarCount
      };
    }).sort((a, b) => a.total - b.total);
  }, [isAuthorized, userName, whitelistUsers, monthlyDuties, currentCalendarMonth]);

  const activeWorkspaceTeam = useMemo(() => {
    if (isSuperAdmin) {
      return selectedTeam || 'לוגיסטיקה';
    }
    return workerTeam || 'לוגיסטיקה';
  }, [isSuperAdmin, selectedTeam, workerTeam]);

  const displayWorkers = useMemo(() => {
    const list = [];
    const seenNames = new Set();

    registeredWorkers.forEach(w => {
      if (w.name) {
        const nameClean = w.name.trim();
        const mapped = KNOWN_TEAM_ROLES[nameClean];
        
        // Filter for commanders: SOLDIERS ONLY
        if (isCommander && !isSuperAdmin) {
          if (mapped && mapped.role !== 'soldier') return;
        }

        const teamName = mapped?.team || w.team || 'לוגיסטיקה';
        const role = mapped?.role || w.role || 'soldier';
        if (!isSuperAdmin || activeWorkspaceTeam !== 'הכל') {
          if (teamName !== activeWorkspaceTeam) return;
        }

        if (!seenNames.has(nameClean.toLowerCase())) {
          seenNames.add(nameClean.toLowerCase());
          list.push({ ...w, team: teamName, role: role });
        }
      }
    });

    // Also include whitelisted soldiers for the active workspace so commanders can assign tasks even before soldiers log in
    Object.keys(KNOWN_TEAM_ROLES).forEach(nameClean => {
      const mapped = KNOWN_TEAM_ROLES[nameClean];
      
      // Filter for commanders: SOLDIERS ONLY
      if (isCommander && !isSuperAdmin) {
        if (mapped.role !== 'soldier') return;
      }

      if (!isSuperAdmin || activeWorkspaceTeam !== 'הכל') {
        if (mapped.team !== activeWorkspaceTeam) return;
      }

      if (!seenNames.has(nameClean.toLowerCase())) {
        seenNames.add(nameClean.toLowerCase());
        list.push({ id: `roster-${nameClean}`, name: nameClean, team: mapped.team, role: mapped.role });
      }
    });

    return list;
  }, [registeredWorkers, isCommander, isSuperAdmin, activeWorkspaceTeam]);

  const handleLogout = () => {
    localStorage.removeItem('workerName');
    localStorage.removeItem('workerRole');
    localStorage.removeItem('workerTeam');
    setUserName('');
    setUserRole('soldier');
    setWorkerTeam('');
    setRegistrationName('');
    setRegistrationTeam('');
    setIsAuthorized(false);
    setAuthError('');
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    if (!newWorkerName.trim()) return;
    try {
      const targetTeam = isSuperAdmin ? newWorkerTeam : (workerTeam || 'לוגיסטיקה');
      await addDoc(collection(db, "workers"), {
        name: newWorkerName.trim(),
        team: targetTeam,
        createdAt: new Date()
      });
      setNewWorkerName('');
      alert(`החייל ${newWorkerName.trim()} נוסף בהצלחה לצוות ${targetTeam}`);
    } catch (err) {
      console.error("Error adding worker:", err);
      alert("שגיאה בהוספת חייל: " + err.message);
    }
  };

  const handleResetUserDevice = async (targetName) => {
    try {
      const docRef = doc(db, "whitelist", targetName);
      await setDoc(docRef, {
        isActivated: false,
        uid: null,
        resetAt: new Date()
      }, { merge: true });
      alert(`נעילת המכשיר של ${targetName} אופסה בהצלחה.`);
    } catch (e) {
      console.error("Error resetting device lock:", e);
      alert("שגיאה באיפוס המכשיר: " + e.message);
    }
  };
  
  const isInitialLoad = useRef(true);
  const prevStates = useRef({});
  const audioRef = useRef(null);
  const swipeStartX = useRef(0);
  const lastScrollY = useRef(0);

  const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSelfCheckin = async (name, status = 'present') => {
    if (!name) return;
    try {
      const today = getTodayDateStr();
      const docId = `${today}_${name}`;
      const docRef = doc(db, "attendance", docId);
      
      const hours = new Date().getHours();
      const isMorning = hours < 12;
      
      // Anti-cheating check: Only allow being marked present if they pre-confirmed on WhatsApp first
      if (status === 'present') {
        const docSnap = await getDoc(docRef);
        const docData = docSnap.exists() ? docSnap.data() : null;
        const preCheck = isMorning ? docData?.morningPreCheck : docData?.eveningPreCheck;
        
        if (preCheck !== 'coming') {
          alert("❌ שגיאה: לא ניתן לדווח נוכחות. עליך לאשר הגעה תחילה בצ'אט עם הבוט בווטסאפ (שלח '1') לפני שתוכל לסרוק את הברקוד!");
          return;
        }
      }
      
      const userDoc = whitelistUsers.find(u => u.name === name);
      const teamVal = userDoc?.team || KNOWN_TEAM_ROLES[name]?.team || 'תקשוב';
      
      const updateData = {
        name: name,
        date: today,
        team: teamVal,
        updatedAt: new Date()
      };
      
      if (isMorning) {
        updateData.morning = status;
        updateData.morningTime = new Date();
      } else {
        updateData.evening = status;
        updateData.eveningTime = new Date();
      }
      
      await setDoc(docRef, updateData, { merge: true });
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.error("Sound error:", e));
      }
      
      const statusNames = {
        'present': 'בבסיס 🟢',
        'sick': 'בגימלים 🤒',
        'leave': 'בחופש 🏖️',
        'duty': 'בתפקיד ⚔️'
      };
      
      alert(`דווחת נוכחות בהצלחה: ${statusNames[status] || 'נוכח'}!`);
    } catch (err) {
      console.error("Self check-in error:", err);
      alert("שגיאה בדיווח נוכחות: " + err.message);
    }
  };

  const resolveWhitelistedName = (inputName) => {
    if (!inputName) return '';
    const clean = inputName.trim();
    if (KNOWN_TEAM_ROLES[clean]) return clean;

    const cleanLower = clean.toLowerCase();
    if (cleanLower === 'לירי' || cleanLower === 'liri') return 'לירי אביגדור';
    if (cleanLower === 'אילן' || cleanLower === 'ilan') return 'אילן אביגדור';

    const match = Object.keys(KNOWN_TEAM_ROLES).find(k => 
      k.toLowerCase() === cleanLower || 
      k.toLowerCase().startsWith(cleanLower) ||
      cleanLower.startsWith(k.toLowerCase())
    );
    return match || clean;
  };

  // Helper: Verify name on whitelist and bind/check UID & role & team
  const verifyUserWhitelist = async (name, uid) => {
    try {
      const nameResolved = resolveWhitelistedName(name);
      const mapped = KNOWN_TEAM_ROLES[nameResolved];
      const isSuper = (nameResolved === 'אילן אביגדור' || nameResolved === 'לירי אביגדור');
      
      let userData = {};
      try {
        const userDocRef = doc(db, "whitelist", nameResolved);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists() && !mapped && !isSuper) {
          setAuthError(`השם "${name}" אינו מופיע ברשימת המורשים.`);
          return false;
        }

        userData = userDocSnap.exists() ? userDocSnap.data() : {};

        // Strict single-device lock enforcement (exempt super admins & localhost testing)
        const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (!isSuper && !isLocalhost && userData.isActivated && userData.uid && userData.uid !== uid) {
          localStorage.removeItem('workerName');
          localStorage.removeItem('workerRole');
          localStorage.removeItem('workerTeam');
          setUserName('');
          setUserRole('soldier');
          setWorkerTeam('');
          setIsAuthorized(false);
          setAuthError('שם זה כבר מופעל במכשיר אחר. פנה למפקד לאיפוס המכשיר.');
          return false;
        }

        // Pair and bind to this device UID
        await setDoc(userDocRef, {
          name: nameResolved,
          isActivated: true,
          uid: uid || null,
          role: mapped?.role || userData.role || (isSuper ? 'super_admin' : 'soldier'),
          team: mapped?.team || userData.team || 'לוגיסטיקה',
          activatedAt: userData.activatedAt || new Date(),
          lastActive: new Date()
        }, { merge: true });

        if (uid) {
          await setDoc(doc(db, "whitelist_uids", uid), {
            name: nameResolved,
            role: mapped?.role || userData.role || (isSuper ? 'super_admin' : 'soldier'),
            team: mapped?.team || userData.team || 'לוגיסטיקה',
            activatedAt: new Date()
          }, { merge: true });
        }
      } catch (firestoreError) {
        console.warn("Firestore sync skipped/failed:", firestoreError);
      }

      const detectedRole = mapped?.role || userData.role || (isSuper ? 'super_admin' : 'soldier');
      const detectedTeam = mapped?.team || userData.team || 'לוגיסטיקה';

      setUserName(nameResolved);
      setUserRole(detectedRole);
      setWorkerTeam(detectedTeam);
      setSelectedTeam(detectedTeam);
      localStorage.setItem('workerName', nameResolved);
      localStorage.setItem('workerRole', detectedRole);
      localStorage.setItem('workerTeam', detectedTeam);
      setAuthError('');
      return true;
    } catch (e) {
      console.error("Error verifying whitelist:", e);
      // Fallback for known team/super admin users
      const nameResolved = resolveWhitelistedName(name);
      const mapped = KNOWN_TEAM_ROLES[nameResolved];
      const isSuper = (nameResolved === 'אילן אביגדור' || nameResolved === 'לירי אביגדור');
      const detectedRole = mapped?.role || (isSuper ? 'super_admin' : 'soldier');
      const detectedTeam = mapped?.team || 'לוגיסטיקה';
      setUserName(nameResolved);
      setUserRole(detectedRole);
      setWorkerTeam(detectedTeam);
      setSelectedTeam(detectedTeam);
      localStorage.setItem('workerName', nameResolved);
      localStorage.setItem('workerRole', detectedRole);
      localStorage.setItem('workerTeam', detectedTeam);
      setAuthError('');
      return true;
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY.current;
      
      if (delta > 5 && currentScrollY > 80) {
        setShowNav(false);
      } else if (delta < -15 || currentScrollY < 50) {
        setShowNav(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.className = `theme-${viewTime}`;
    document.body.setAttribute('data-team', activeWorkspaceTeam || 'לוגיסטיקה');
  }, [viewTime, activeWorkspaceTeam]);

  useEffect(() => {
    if (!loading && !workersLoading && userName && workerTeam && isAuthorized) {
      const exists = registeredWorkers.some(w => w.name && w.name.trim().toLowerCase() === userName.trim().toLowerCase());
      if (!exists) {
        addDoc(collection(db, "workers"), {
          name: userName.trim(),
          team: workerTeam,
          createdAt: new Date()
        }).catch(e => console.error("Error auto-registering worker:", e));
      }
    }
  }, [loading, workersLoading, userName, workerTeam, registeredWorkers, isAuthorized]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 15 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const playNotification = () => {
    if (isMuted || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(e => console.error('Audio play failed:', e));
  };

  // Auth, Whitelist Seeding, and Database Listeners
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);

    // Initial whitelist seeding
    const seedWhitelist = async () => {
      try {
        const liriRef = doc(db, "whitelist", "לירי אביגדור");
        const liriSnap = await getDoc(liriRef);
        
        // If "לירי אביגדור" doc doesn't exist, seed the entire list
        if (!liriSnap.exists()) {
          const names = [
            "לירי אביגדור", "אילן אביגדור",
            "דביר הרמן", "אור חממה", "אורין", "אמיתי בהדני", "תמי מזרחי", "מישל פיוטרובסקי",
            "אוראל חביב", "נגה שי", "דביר אגסי", "עדי כרמי", "שוהם פאר", "קסם סוויסה", "גרשון מירל", "אלה לידור",
            "עמית דן", "מאור פרידר", "תמר ביליה", "נתנאל יובל ערבה", "רוניה אליהו",
            "ליאל רוטנברג", "חסין סלותי", "מתן לוי", "פאר זנגאני", "שליו פאבון", "מעיין ישראלי",
            "ירין תורג׳מן", "גיל זיו", "אליאב ביטון", "ארטיום", "אליה עמר", "אייל הרשקוביץ",
            "סמי יגודייב", "ליאן קריסטופר", "אלון אופיר", "ליאב ביטון", "לירון שטרן", "ולריה סטלמק",
            "שי וינד", "עידו כהן", "אלון מעוז", "עדן בן דוד", "מתן ביטון", "יניב חנוך", "קים פלג",
            "רואי עמדי", "אושר חכמון", "טל זדורייב", "עידן יוסף", "דניאל אלימוב", "חיים גבריאלוב",
            "בן פורמן", "שחף בכר", "אושר אלמקייס", "סתו גיטר", "יוסף חי סרוסי", "תכלת זליג",
            "ירדן חכמון", "שליו סלדינגר", "רז חורי", "בני וייס",
            "עומר גלבר", "עדי טאוב", "דודו דריי", "מרק דלוב", "אמיר לוי", "אביב אמסלם", "אור טויטו",
            "סרגיי מטיצין", "רון אברהם", "אבישג סמואל", "אור סוקוליק", "תאיר חביב", "מאור מנחם",
            "אליה אוחיון", "דמקה אזנאו", "עידו בן טל", "עדן לגריסי", "בן עוז", "ליהי ביטון",
            "אורי מנטל", "אביאל יעקוב", "אורי פינטו"
          ];

          const batch = writeBatch(db);
          names.forEach(name => {
            const cleanName = name.trim();
            const docRef = doc(db, "whitelist", cleanName);
            const mappedInfo = KNOWN_TEAM_ROLES[cleanName];
            const isSuper = (cleanName === 'אילן אביגדור' || cleanName === 'לירי אביגדור');
            
            const role = mappedInfo?.role || (isSuper ? 'super_admin' : 'soldier');
            const team = mappedInfo?.team || (isSuper ? 'מפקדה' : 'תקשוב');

            batch.set(docRef, { 
              name: cleanName, 
              role: role,
              team: team,
              isActivated: false, 
              uid: null 
            }, { merge: true });
          });
          await batch.commit();
          console.log("Successfully seeded whitelist with roles for", names.length, "names.");
        }
      } catch (e) {
        // Seeding will fail silently if rules are already deployed, which is correct
        console.log("Seeding skipped/blocked by rules:", e);
      }
    };
    seedWhitelist();

    // Listen for Auth changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const storedName = localStorage.getItem('workerName');
          if (storedName) {
            const success = await verifyUserWhitelist(storedName, firebaseUser.uid);
            setIsAuthorized(success);
          } else {
            setIsAuthorized(false);
          }
        } else {
          try {
            await signInAnonymously(auth);
          } catch (e) {
            console.error("Anonymous authentication failed:", e);
          }
        }
      } catch (err) {
        console.error("Auth state error:", err);
        setIsAuthorized(false);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Handle URL query parameter for self check-in
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'checkin') {
      const storedName = localStorage.getItem('workerName');
      if (storedName && isAuthorized) {
        handleSelfCheckin(storedName);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        localStorage.setItem('pendingCheckin', 'true');
      }
    }
  }, [isAuthorized]);

  // Monitor scheduled meeting time and trigger alert state
  useEffect(() => {
    if (!meetingConfig?.time) {
      setMeetingAlert('none');
      return;
    }

    const checkMeetingTime = () => {
      const todayStr = getTodayDateStr();
      if (meetingConfig.date !== todayStr) {
        setMeetingAlert('none');
        return;
      }

      const [hours, minutes] = meetingConfig.time.split(':').map(Number);
      const meetingDate = new Date();
      meetingDate.setHours(hours, minutes, 0, 0);

      const now = new Date();
      const diffMs = meetingDate - now;
      const diffMins = diffMs / 1000 / 60;

      if (diffMins > 0 && diffMins <= 10) {
        if (meetingConfig.sendReminder) {
          setMeetingAlert('reminder');
        } else {
          setMeetingAlert('none');
        }
      } else if (diffMins <= 0 && diffMins >= -30) {
        setMeetingAlert('started');
      } else {
        setMeetingAlert('none');
      }
    };

    checkMeetingTime();
    const interval = setInterval(checkMeetingTime, 10000);
    return () => clearInterval(interval);
  }, [meetingConfig]);

  // Firestore listeners (only subscribe if authorized or admin)
  useEffect(() => {
    if (!isAuthorized && !isAdmin) {
      setLoading(false);
      setWorkersLoading(false);
      return;
    }

    setLoading(true);
    setWorkersLoading(true);

    const tasksQuery = query(collection(db, "tasks"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const taskList = [];
      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        const id = change.doc.id;
        
        if (change.type === 'modified' && !isMuted && !isInitialLoad.current) {
          const prevState = prevStates.current[id] || {};
          
          if (isAdmin) {
            const prevAcceptedCount = prevState.acceptedByCount || 0;
            const currentAcceptedCount = data.acceptedBy?.length || 0;
            const totalAssigneesCount = data.assignees?.length || 0;
            const allAcceptedNow = totalAssigneesCount > 0 && currentAcceptedCount === totalAssigneesCount;
            const wasNotAllAccepted = prevAcceptedCount < totalAssigneesCount;
            
            if (allAcceptedNow && wasNotAllAccepted) {
              playNotification();
            }
            
            if (data.isDone && !prevState.isDone) {
              playNotification();
            }
          } else {
            const isMyTask = data.assignees?.includes(userName);
            if (isMyTask && data.isVerified && !prevState.isVerified) {
              playNotification();
            }
          }
        }
      });

      snapshot.forEach((doc) => {
        const d = doc.data();
        taskList.push({ id: doc.id, ...d });
        prevStates.current[doc.id] = {
          isInProgress: d.isInProgress || false,
          isDone: d.isDone || false,
          isVerified: d.isVerified || false,
          acceptedByCount: d.acceptedBy?.length || 0,
          assigneesCount: d.assignees?.length || 0
        };
      });
      setTasks(taskList);
      setLoading(false);
      if (isInitialLoad.current) isInitialLoad.current = false;
    }, (error) => {
      console.error("Firestore tasks query error:", error);
      setLoading(false);
    });
    
    const workersUnsubscribe = onSnapshot(collection(db, "workers"), (snapshot) => {
      const workersList = [];
      snapshot.forEach((doc) => workersList.push({ id: doc.id, ...doc.data() }));
      setRegisteredWorkers(workersList);
      setWorkersLoading(false);
    }, (error) => {
      console.error("Firestore workers query error:", error);
      setWorkersLoading(false);
    });

    const whitelistUnsubscribe = onSnapshot(collection(db, "whitelist"), (snapshot) => {
      const uList = [];
      const currentFirebaseUser = auth.currentUser;
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        uList.push({ id: docSnap.id, name: docSnap.id, ...d });

        // Strict single-device lock enforcement (exempt super admins & localhost testing)
        if (userName && docSnap.id === userName && currentFirebaseUser) {
          const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
          const isSuper = (userName === 'אילן אביגדור' || userName === 'לירי אביגדור');
          if (!isSuper && !isLocalhost && d.isActivated && d.uid && d.uid !== currentFirebaseUser.uid) {
            localStorage.removeItem('workerName');
            localStorage.removeItem('workerRole');
            localStorage.removeItem('workerTeam');
            setUserName('');
            setUserRole('soldier');
            setWorkerTeam('');
            setIsAuthorized(false);
            setAuthError('שם זה כבר מופעל במכשיר אחר. פנה למפקד לאיפוס המכשיר.');
          }
        }
      });
      setWhitelistUsers(uList);
    }, (error) => {
      console.error("Firestore whitelist query error:", error);
    });

    const bundlesUnsubscribe = onSnapshot(collection(db, "task_bundles"), (snapshot) => {
      const bList = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.id === 'meeting') return;
        bList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setCustomBundles(bList);
    }, (error) => {
      console.error("Task bundles subscription error:", error);
    });

    const attendanceUnsubscribe = onSnapshot(collection(db, "attendance"), (snapshot) => {
      const aList = [];
      snapshot.forEach((docSnap) => {
        aList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAttendanceRecords(aList);
    }, (error) => {
      console.error("Attendance query error:", error);
    });

    const meetingUnsubscribe = onSnapshot(doc(db, "task_bundles", "meeting"), (docSnap) => {
      if (docSnap.exists()) {
        setMeetingConfig(docSnap.data());
      } else {
        setMeetingConfig(null);
      }
    }, (error) => {
      console.error("Meeting config query error:", error);
    });

    const dutiesUnsubscribe = onSnapshot(collection(db, "duties"), (snapshot) => {
      const allD = {};
      snapshot.forEach(docSnap => {
        allD[docSnap.id] = docSnap.data();
      });
      setMonthlyDuties(allD);
      const todayStr = getTodayDateStr();
      if (allD[todayStr]) {
        setDuties(allD[todayStr]);
      } else {
        setDuties({});
      }
    }, (error) => {
      console.error("Duties collection query error:", error);
    });

    return () => { unsubscribe(); workersUnsubscribe(); whitelistUnsubscribe(); bundlesUnsubscribe(); attendanceUnsubscribe(); meetingUnsubscribe(); dutiesUnsubscribe(); };
  }, [isAdmin, isMuted, isAuthorized, userName]);

  const handleDeployTasksBatch = async (taskList) => {
    try {
      const batch = writeBatch(db);
      const targetTeam = activeWorkspaceTeam === 'הכל' ? (workerTeam || 'לוגיסטיקה') : activeWorkspaceTeam;
      taskList.forEach((t, idx) => {
        const docRef = doc(collection(db, "tasks"));
        batch.set(docRef, {
          title: t.title,
          description: t.description || '',
          assignees: [],
          team: targetTeam,
          timeOfDay: viewTime,
          isDone: false,
          isInProgress: false,
          isVerified: false,
          order: tasks.length + idx,
          createdAt: new Date()
        });
      });
      await batch.commit();
    } catch (e) {
      console.error("Error deploying task batch:", e);
    }
  };

  const handleSaveCustomBundle = async (bundleData) => {
    try {
      await addDoc(collection(db, "task_bundles"), {
        ...bundleData,
        createdAt: new Date()
      });
    } catch (e) {
      console.error("Error saving custom bundle:", e);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title) return;
    try {
      const targetTeam = activeWorkspaceTeam === 'הכל' ? (workerTeam || 'לוגיסטיקה') : activeWorkspaceTeam;
      await addDoc(collection(db, "tasks"), {
        title: newTask.title, description: newTask.description, assignees: [],
        team: targetTeam,
        timeOfDay: viewTime, isDone: false, isInProgress: false, isVerified: false,
        order: tasks.length, createdAt: new Date()
      });
      setNewTask({ title: '', description: '', assignee: '' });
      setIsFormOpen(false);
    } catch (e) {
      console.error("Error saving task: ", e);
      alert("שגיאה בשמירת המשימה: " + e.message);
    }
  };

  const handleSeedWorkspaceTasks = async (teamName) => {
    const templates = {
      'לוגיסטיקה': [
        { title: 'בדיקת מלאי ציוד יומית', description: 'ספירת מלאי במחסני אספקה וציוד אישי', timeOfDay: 'morning' },
        { title: 'חלוקת אספקה וציוד', description: 'ניפוק ציוד ודלק ליחידות', timeOfDay: 'noon' },
        { title: 'סידור מחסנים ונעילה', description: 'ארגון המחסנים, סגירת רישומים ונעילה', timeOfDay: 'evening' }
      ],
      'מפקדה': [
        { title: 'תדריך בוקר מפקדה', description: 'הערכת מצב וסנכרון משימות יומי', timeOfDay: 'morning' },
        { title: 'מעקב סטטוס גדודי', description: 'סקירת ביצוע משימות בכלל הצוותים', timeOfDay: 'noon' },
        { title: 'סיכום יום ופקודות למחר', description: 'סיכום הישגים יומי והפצת דגשים', timeOfDay: 'evening' }
      ]
    };

    const taskList = templates[teamName];
    if (!taskList || taskList.length === 0) return;

    try {
      const batch = writeBatch(db);
      taskList.forEach((t, idx) => {
        const docRef = doc(collection(db, "tasks"));
        batch.set(docRef, {
          title: t.title,
          description: t.description,
          assignees: [],
          team: teamName,
          timeOfDay: t.timeOfDay,
          isDone: false,
          isInProgress: false,
          isVerified: false,
          order: tasks.length + idx,
          createdAt: new Date()
        });
      });
      await batch.commit();
    } catch (e) {
      console.error("Error seeding workspace tasks:", e);
    }
  };

  useEffect(() => {
    if (showNav) {
      document.body.style.overflow = '';
    } else {
      // Don't lock scroll just because nav is hidden, 
      // but we might want to lock it during an active drag.
    }
  }, [showNav]);

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    if (navigator.vibrate) navigator.vibrate(50);
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  };

  const handleDragOver = (event) => {
    const { over } = event;
    setIsOverTrash(over && over.id === 'trash-bin');
  };

  const handleDragEnd = async (event) => {
    setActiveId(null);
    setIsOverTrash(false);
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    const {active, over} = event;
    
    if (over && over.id === 'trash-bin') {
      await deleteTask(active.id);
      return;
    }

    if (active && over && active.id !== over.id) {
      setTasks((items) => {
        const oldIndex = items.findIndex((t) => t.id === active.id);
        const newIndex = items.findIndex((t) => t.id === over.id);
        const newTasks = arrayMove(items, oldIndex, newIndex);
        const batch = writeBatch(db);
        newTasks.forEach((task, index) => { batch.update(doc(db, "tasks", task.id), { order: index }); });
        batch.commit();
        return newTasks;
      });
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setIsOverTrash(false);
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  };

  const handleWorkerDragStart = (event) => {
    setActiveWorkerId(event.active.id);
    if (navigator.vibrate) navigator.vibrate(50);
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  };

  const handleWorkerDragEnd = async (event) => {
    setActiveWorkerId(event.active.id);
    setIsOverTrash(false);
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    const { active, over } = event;
    
    if (over && over.id === 'trash-bin') {
      const workerToDelete = registeredWorkers.find(w => w.id === active.id);
      if (workerToDelete && window.confirm(`האם אתה בטוח שברצונך למחוק את ${workerToDelete.name}?`)) {
        await deleteWorker(active.id);
      }
      return;
    }
  };

  const handleWorkerDragCancel = () => {
    setActiveWorkerId(null);
    setIsOverTrash(false);
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  };

  const toggleStatus = async (task) => {
    if (task.isVerified && !isAdmin) return;
    let updates = {};
    
    if (isAdmin) {
      if (task.isVerified) {
        updates = { isVerified: false, isDone: false, isInProgress: false, acceptedBy: [] };
      } else if (task.isDone) {
        updates = { isVerified: true, isDone: true, isInProgress: false };
      }
    } else {
      if (!task.isInProgress && !task.isDone) {
        const currentAccepted = task.acceptedBy || [];
        const nextAccepted = currentAccepted.includes(userName) ? currentAccepted : [...currentAccepted, userName];
        const assignees = task.assignees || [];
        const allAccepted = assignees.every(name => nextAccepted.includes(name));
        
        updates = {
          acceptedBy: nextAccepted,
          isInProgress: allAccepted
        };
      } else if (task.isInProgress) {
        updates = { isInProgress: false, isDone: true, acceptedBy: [] };
      } else if (task.isDone) {
        updates = { isInProgress: false, isDone: false, acceptedBy: [] };
      }
    }
    
    if (Object.keys(updates).length > 0) {
      try { await updateDoc(doc(db, "tasks", task.id), updates); } 
      catch (e) { console.error("Error updating status: ", e); }
    }
  };

  const verifyTask = async (id) => {
    try { await updateDoc(doc(db, "tasks", id), { isVerified: true, isDone: true, isInProgress: false }); } 
    catch (e) { console.error("Error verifying: ", e); }
  };

  const deleteTask = async (id) => {
    try { await deleteDoc(doc(db, "tasks", id)); } 
    catch (e) { console.error("Error deleting: ", e); }
  };

  const deleteWorker = async (id) => {
    try { await deleteDoc(doc(db, "workers", id)); } 
    catch (e) { console.error("Error deleting worker: ", e); }
  };

  const handleClearAllTasks = () => {
    setConfirmModal({
      isOpen: true,
      type: 'tasks',
      message: 'האם אתה בטוח שברצונך למחוק את כל המשימות?',
      action: async () => {
        try {
          const batch = writeBatch(db);
          tasks.forEach(task => {
            batch.delete(doc(db, "tasks", task.id));
          });
          await batch.commit();
        } catch (e) {
          console.error("Error clearing all tasks: ", e);
        }
      }
    });
  };

  const handleClearAllWorkers = () => {
    setConfirmModal({
      isOpen: true,
      type: 'workers',
      message: 'האם אתה בטוח שברצונך למחוק את כל האנשים (התורנים) הרשומים?',
      action: async () => {
        try {
          const batch = writeBatch(db);
          registeredWorkers.forEach(worker => {
            batch.delete(doc(db, "workers", worker.id));
          });
          await batch.commit();
        } catch (e) {
          console.error("Error clearing all workers: ", e);
        }
      }
    });
  };


  const toggleAssignment = async (taskId, workerName) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const current = task.assignees || [];
    const isAssigned = current.includes(workerName);
    const next = isAssigned ? current.filter(n => n !== workerName) : [...current, workerName];
    try { await updateDoc(doc(db, "tasks", taskId), { assignees: next }); } 
    catch (e) { console.error("Error toggle: ", e); }
  };


  const getFilteredTasks = (time) => {
    let filtered = tasks.filter(t => {
      const taskTeam = t.team || 'מטבח';
      const matchesTeam = (activeWorkspaceTeam === 'הכל') || (taskTeam === activeWorkspaceTeam);
      if (!matchesTeam) return false;

      // Only apply morning/noon/evening time filtering for Kitchen workspace
      if (activeWorkspaceTeam === 'מטבח') {
        return (t.timeOfDay === time) || (!t.timeOfDay && time === 'morning');
      }

      return true;
    });

    if (isAdmin) {
      if (hideAssigned) {
        return filtered.filter(t => !t.assignees || t.assignees.length === 0);
      }
      return filtered;
    }
    return filtered.filter(t => t.assignees?.includes(userName) && !t.isVerified);
  };

  if (authLoading) return <div className="container" style={{textAlign:'center', marginTop:'4rem'}}>טוען אבטחה...</div>;

  // Fully block unauthorized users from seeing the main layout
  if (!isAuthorized && !isAdmin) {
    if (userName && workerTeam) {
      return (
        <div className="registration-overlay" style={{position:'fixed', inset:0, background:'var(--bg-1)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center'}}>
           <div className="glass-card" style={{width:'90%', maxWidth:'400px', textAlign:'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
              <div className="icon-wrapper" style={{ fontSize: '3rem', background: 'rgba(255,255,255,0.2)', width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>🔒</div>
              <h2 style={{ margin: '0.5rem 0' }}>גישה נדחתה</h2>
              <p style={{ opacity: 0.8, fontSize: '1rem', margin: '0', color: '#ef4444' }}>{authError || 'אינך מורשה לגשת למערכת.'}</p>
              <button 
                className="btn btn-cancel" 
                style={{ width: '100%', marginTop: '1rem', padding: '0.8rem 1.2rem', fontSize: '1.05rem' }} 
                onClick={() => {
                  localStorage.removeItem('workerName');
                  localStorage.removeItem('workerTeam');
                  setUserName('');
                  setWorkerTeam('');
                  setIsAuthorized(false);
                  setAuthError('');
                }}
              >
                התחבר עם שם אחר
              </button>
           </div>
        </div>
      );
    } else {
      return (
        <div className="registration-overlay" style={{position:'fixed', inset:0, background:'var(--bg-1)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center'}}>
           <div className="glass-card" style={{width:'90%', maxWidth:'400px', textAlign:'center'}}>
              <h2>ברוך הבא</h2>
              <p>הכנס את שמך ובחר צוות כדי להתחיל</p>
              
              {authError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.6rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600 }}>
                  {authError}
                </div>
              )}

              <input 
                className="input-field" 
                placeholder="השם שלך (לדוגמה: לירי אביגדור או לירי)" 
                value={registrationName} 
                onChange={e => {
                  setRegistrationName(e.target.value);
                  if (authError) setAuthError('');
                }} 
              />

              <select 
                className="input-field" 
                value={registrationTeam} 
                onChange={e => setRegistrationTeam(e.target.value)}
              >
                <option value="" disabled>בחר צוות (אם לא משויך)...</option>
                {AVAILABLE_TEAMS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <button className="btn btn-save" style={{width:'100%', marginTop:'1rem'}} onClick={async () => {
                if(registrationName) {
                  const resolved = resolveWhitelistedName(registrationName);
                  try {
                    let currentFirebaseUser = auth.currentUser;
                    if (!currentFirebaseUser) {
                      const cred = await signInAnonymously(auth);
                      currentFirebaseUser = cred.user;
                    }
                    
                    const success = await verifyUserWhitelist(resolved, currentFirebaseUser.uid);
                    if (success) {
                      const teamToUse = registrationTeam || localStorage.getItem('workerTeam') || 'מטבח';
                      localStorage.setItem('workerName', resolved);
                      localStorage.setItem('workerTeam', teamToUse);
                      setUserName(resolved);
                      setWorkerTeam(teamToUse);
                      setIsAuthorized(true);
                      if (localStorage.getItem('pendingCheckin') === 'true') {
                        localStorage.removeItem('pendingCheckin');
                        handleSelfCheckin(resolved);
                      }
                    }
                  } catch (e) {
                    console.error("Error registering worker:", e);
                    setAuthError('שגיאה בתקשורת עם השרת.');
                  }
                } else {
                  setAuthError('נא להזין את השם');
                }
              }}>התחל</button>
           </div>
        </div>
      );
    }
  }

  if (loading) return <div className="container" style={{textAlign:'center', marginTop:'4rem'}}>טוען משימות...</div>;

  const workersByTeam = displayWorkers.reduce((acc, worker) => {
    const teamName = worker.team || activeWorkspaceTeam;
    if (!acc[teamName]) acc[teamName] = [];
    acc[teamName].push(worker);
    return acc;
  }, {});

  const todayDateStr = getTodayDateStr();
  const hoursVal = new Date().getHours();
  const isMorningSession = hoursVal < 12;
  const myAttendance = attendanceRecords.find(r => r.date === todayDateStr && r.name === userName);
  const morningChecked = myAttendance?.morning === 'present';
  const eveningChecked = myAttendance?.evening === 'present';
  const isSoldierUser = userRole === 'soldier';
  const isCheckedIn = isMorningSession ? morningChecked : eveningChecked;
  
  const formatTime = (ts) => {
    if (!ts) return '';
    let d = null;
    if (typeof ts.toDate === 'function') d = ts.toDate();
    else if (ts.seconds) d = new Date(ts.seconds * 1000);
    else d = new Date(ts);
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  const renderAttendanceBanner = () => {
    return null;
    
    const today = getTodayDateStr();
    const hours = new Date().getHours();
    const isMorning = hours < 12;
    
    return (
      <div className="glass-card attendance-banner" style={{
        marginBottom: '1rem',
        padding: '1rem',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📅</span>
            <span>דיווח נוכחות יומי ({today.split('-').reverse().join('.')})</span>
          </h3>
          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <span style={{ fontSize: '0.85rem', color: morningChecked ? '#10b981' : '#64748b', fontWeight: 600 }}>
              בוקר: {morningChecked ? `🟢 (דיווח ב-${formatTime(myAttendance?.morningTime)})` : '⚪ טרם דיווח'}
            </span>
            <span style={{ fontSize: '0.85rem', color: eveningChecked ? '#10b981' : '#64748b', fontWeight: 600 }}>
              ערב: {eveningChecked ? `🟢 (דיווח ב-${formatTime(myAttendance?.eveningTime)})` : '⚪ טרם דיווח'}
            </span>
          </div>
        </div>

        {isMorning ? (
          !morningChecked ? (
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', width: '100%' }}>
              <button className="btn" style={{ flex: 1, minWidth: '110px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontWeight: 700, margin: 0, padding: '0.6rem 0.4rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleSelfCheckin(userName, 'present')}>🟢 אני בבסיס</button>
              <button className="btn" style={{ flex: 1, minWidth: '110px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', fontWeight: 700, margin: 0, padding: '0.6rem 0.4rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleSelfCheckin(userName, 'sick')}>🤒 אני בגימלים</button>
              <button className="btn" style={{ flex: 1, minWidth: '110px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontWeight: 700, margin: 0, padding: '0.6rem 0.4rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleSelfCheckin(userName, 'leave')}>🏖️ אני בחופש</button>
              <button className="btn" style={{ flex: 1, minWidth: '110px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white', fontWeight: 700, margin: 0, padding: '0.6rem 0.4rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleSelfCheckin(userName, 'duty')}>⚔️ אני בתפקיד</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '0.4rem', color: '#10b981', fontWeight: 600, fontSize: '0.9rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', width: '100%' }}>
              דיווחת נוכחות בוקר בהצלחה! ☀️ יום מוצלח.
            </div>
          )
        ) : (
          !eveningChecked ? (
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', width: '100%' }}>
              <button className="btn" style={{ flex: 1, minWidth: '110px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontWeight: 700, margin: 0, padding: '0.6rem 0.4rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleSelfCheckin(userName, 'present')}>🟢 אני בבסיס</button>
              <button className="btn" style={{ flex: 1, minWidth: '110px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', fontWeight: 700, margin: 0, padding: '0.6rem 0.4rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleSelfCheckin(userName, 'sick')}>🤒 אני בגימלים</button>
              <button className="btn" style={{ flex: 1, minWidth: '110px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontWeight: 700, margin: 0, padding: '0.6rem 0.4rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleSelfCheckin(userName, 'leave')}>🏖️ אני בחופש</button>
              <button className="btn" style={{ flex: 1, minWidth: '110px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white', fontWeight: 700, margin: 0, padding: '0.6rem 0.4rem', border: 'none', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleSelfCheckin(userName, 'duty')}>⚔️ אני בתפקיד</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '0.4rem', color: '#10b981', fontWeight: 600, fontSize: '0.9rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', width: '100%' }}>
              דיווחת נוכחות ערב בהצלחה! 🌙 לילה טוב.
            </div>
          )
        )}
      </div>
    );
  };

  const renderMeetingReminderBanner = () => {
    if (!isAuthorized || !isSoldierUser || isCheckedIn || meetingAlert !== 'reminder') return null;
    return (
      <div className="glass-card" style={{
        background: 'rgba(245, 158, 11, 0.15)',
        border: '1px solid #f59e0b',
        color: '#f59e0b',
        padding: '0.8rem 1rem',
        borderRadius: '12px',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontWeight: 'bold',
        fontSize: '0.95rem'
      }}>
        <span>⚠️</span>
        <span>תזכורת: מסדר/מפגש גדודי מתוזמן לעוד פחות מ-10 דקות (בשעה {meetingConfig?.time})! נא להישאר זמינים במכשיר.</span>
      </div>
    );
  };

  const renderMeetingPopupModal = () => {
    if (!isAuthorized || !isSoldierUser || isCheckedIn || meetingAlert !== 'started') return null;
    return (
      <div className="registration-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-card" style={{ width: '90%', maxWidth: '400px', textAlign: 'center', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem', border: '2px solid var(--accent-1)' }}>
          <div style={{ fontSize: '3rem' }}>📢</div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>זמן מסדר הגיע!</h2>
          <p style={{ margin: 0, fontSize: '1rem', opacity: 0.9 }}>
            תמר קוראת לכולם למסדר/מפגש גדודי כעת בשעה {meetingConfig?.time}.
          </p>
          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>
            אנא לחץ על כפתור דיווח הנוכחות למטה כדי לאשר הגעה מיידית.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%' }}>
            <button className="btn" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontWeight: 800, padding: '0.8rem', border: 'none', borderRadius: '8px', cursor: 'pointer', margin: 0 }} onClick={() => handleSelfCheckin(userName, 'present')}>🟢 אני בבסיס</button>
            <button className="btn" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', fontWeight: 800, padding: '0.8rem', border: 'none', borderRadius: '8px', cursor: 'pointer', margin: 0 }} onClick={() => handleSelfCheckin(userName, 'sick')}>🤒 אני בגימלים</button>
            <button className="btn" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', fontWeight: 800, padding: '0.8rem', border: 'none', borderRadius: '8px', cursor: 'pointer', margin: 0 }} onClick={() => handleSelfCheckin(userName, 'leave')}>🏖️ אני בחופש</button>
            <button className="btn" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white', fontWeight: 800, padding: '0.8rem', border: 'none', borderRadius: '8px', cursor: 'pointer', margin: 0 }} onClick={() => handleSelfCheckin(userName, 'duty')}>⚔️ אני בתפקיד</button>
          </div>
        </div>
      </div>
    );
  };

  function getAllSoldiers() {
    const list = [];
    const seen = new Set();
    const reserves = ["טל זדורייב", "עידן יוסף", "דניאל אלימוב", "חיים גבריאלוב"];
    
    whitelistUsers.forEach(u => {
      if (reserves.includes(u.name)) return;
      const role = u.role || KNOWN_TEAM_ROLES[u.name]?.role || 'soldier';
      if (role === 'soldier') {
        list.push({
          name: u.name,
          team: u.team || KNOWN_TEAM_ROLES[u.name]?.team || 'תקשוב',
          isActivated: !!u.isActivated,
          role: role
        });
        seen.add(u.name.toLowerCase());
      }
    });

    Object.keys(KNOWN_TEAM_ROLES).forEach(name => {
      if (reserves.includes(name)) return;
      const info = KNOWN_TEAM_ROLES[name];
      if (info.role === 'soldier' && !seen.has(name.toLowerCase())) {
        list.push({
          name: name,
          team: info.team,
          isActivated: false,
          role: 'soldier'
        });
      }
    });

    return list;
  }

  const handleToggleAttendance = async (soldierName, period, currentVal) => {
    try {
      const today = getTodayDateStr();
      const docId = `${today}_${soldierName}`;
      const docRef = doc(db, "attendance", docId);
      
      const nextStatusMap = {
        'present': 'absent',
        'absent': 'sick',
        'sick': 'leave',
        'leave': 'duty',
        'duty': null,
        [null]: 'present',
        'undefined': 'present'
      };
      
      const nextVal = nextStatusMap[currentVal] || 'present';
      
      const userDoc = whitelistUsers.find(u => u.name === soldierName);
      const teamVal = userDoc?.team || KNOWN_TEAM_ROLES[soldierName]?.team || 'תקשוב';
      
      const updateData = {
        name: soldierName,
        date: today,
        team: teamVal,
        updatedAt: new Date()
      };
      
      if (period === 'morning') {
        updateData.morning = nextVal;
        if (nextVal) updateData.morningTime = new Date();
      } else {
        updateData.evening = nextVal;
        if (nextVal) updateData.eveningTime = new Date();
      }
      
      await setDoc(docRef, updateData, { merge: true });
    } catch (err) {
      console.error("Error updating attendance:", err);
      alert("שגיאה בעדכון נוכחות: " + err.message);
    }
  };

  const handleExportWhatsApp = () => {
    const today = getTodayDateStr().split('-').reverse().join('.');
    let msg = `*דוח נוכחות - גדוד 402 - ${today}*\n\n`;
    
    const soldiersOnly = getAllSoldiers();

    const teams = {};
    soldiersOnly.forEach(u => {
      const teamVal = u.team || 'תקשוב';
      if (!teams[teamVal]) teams[teamVal] = [];
      teams[teamVal].push(u);
    });
    
    Object.keys(teams).forEach(teamName => {
      msg += `*צוות ${teamName}:*\n`;
      let presentMorning = 0;
      let presentEvening = 0;
      let details = [];
      
      teams[teamName].forEach(u => {
        const record = attendanceRecords.find(r => r.date === todayDateStr && r.name === u.name);
        const mStatus = record?.morning;
        const eStatus = record?.evening;
        
        if (mStatus === 'present') presentMorning++;
        if (eStatus === 'present') presentEvening++;
        
        let statusStr = '';
        if (mStatus && mStatus !== 'present') {
          const statusHeb = mStatus === 'absent' ? 'נפקד' : mStatus === 'sick' ? 'גימלים' : mStatus === 'leave' ? 'חופש' : mStatus === 'duty' ? 'בתפקיד' : '';
          if (statusHeb) statusStr += `בוקר: ${statusHeb}`;
        }
        if (eStatus && eStatus !== 'present') {
          const statusHeb = eStatus === 'absent' ? 'נפקד' : eStatus === 'sick' ? 'גימלים' : eStatus === 'leave' ? 'חופש' : eStatus === 'duty' ? 'בתפקיד' : '';
          if (statusHeb) {
            statusStr += statusStr ? `, ערב: ${statusHeb}` : `ערב: ${statusHeb}`;
          }
        }
        
        if (statusStr) {
          details.push(`${u.name} (${statusStr})`);
        }
      });
      
      msg += `בוקר: ${presentMorning}/${teams[teamName].length}\n`;
      msg += `ערב: ${presentEvening}/${teams[teamName].length}\n`;
      if (details.length > 0) {
        msg += `חריגים:\n- ${details.join('\n- ')}\n`;
      }
      msg += `\n`;
    });
    
    navigator.clipboard.writeText(msg).then(() => {
      alert("דוח נוכחות הועתק ללוח! ניתן להדביק בווטסאפ.");
    }).catch(err => {
      console.error("Clipboard copy error:", err);
      alert("שגיאה בהעתקת הדוח ללוח.");
    });
  };

  const handleSaveMeeting = async (timeStr, sendRem) => {
    try {
      const today = getTodayDateStr();
      await setDoc(doc(db, "task_bundles", "meeting"), {
        time: timeStr,
        sendReminder: sendRem,
        date: today,
        scheduledBy: userName,
        updatedAt: new Date()
      });
    } catch (err) {
      console.error("Error saving meeting:", err);
      alert("שגיאה בעדכון זמן מסדר: " + err.message);
    }
  };

  const handleClearMeeting = async () => {
    try {
      await deleteDoc(doc(db, "task_bundles", "meeting"));
    } catch (err) {
      console.error("Error clearing meeting:", err);
      alert("שגיאה בביטול מסדר.");
    }
  };

  const renderDutiesDashboard = () => {
    const isTamar = userName === 'תמר ביליה';
    const sergeantTeam = whitelistUsers.find(u => u.name === userName)?.team || KNOWN_TEAM_ROLES[userName]?.team || 'תקשוב';
    
    const allSoldiers = getAllSoldiers();
    const teamSoldiers = allSoldiers.filter(s => s.team === sergeantTeam);

    const TEAM_COLORS = {
      'לוגיסטיקה': '#1d4ed8', // Bolder Blue
      'שלישות': '#db2777',    // Bolder Pink
      'טנ"א (חימוש)': '#ea580c', // Bolder Orange
      'טנ"א': '#ea580c', // Bolder Orange
      'תקשוב': '#d97706' // Bolder Golden Yellow
    };

    const getSoldierTeam = (name) => {
      if (!name) return null;
      const s = allSoldiers.find(x => x.name === name);
      return s ? s.team : null;
    };

    const getTeamColor = (teamName) => {
      return TEAM_COLORS[teamName] || 'rgba(255, 255, 255, 0.08)';
    };
    
    const [yearStr, monthStr] = currentCalendarMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;
    
    const monthNamesHe = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    
    const handlePrevMonth = () => {
      let newM = month - 1;
      let newY = year;
      if (newM < 0) {
        newM = 11;
        newY -= 1;
      }
      setCurrentCalendarMonth(`${newY}-${String(newM + 1).padStart(2, '0')}`);
    };
    
    const handleNextMonth = () => {
      let newM = month + 1;
      let newY = year;
      if (newM > 11) {
        newM = 0;
        newY += 1;
      }
      setCurrentCalendarMonth(`${newY}-${String(newM + 1).padStart(2, '0')}`);
    };
    
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const calendarDays = [];
    
    let prevMonthYear = year;
    let prevMonthNum = month - 1;
    if (prevMonthNum < 0) {
      prevMonthNum = 11;
      prevMonthYear -= 1;
    }
    const prevMonthTotalDays = new Date(prevMonthYear, prevMonthNum + 1, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDayVal = prevMonthTotalDays - i;
      const prevDateStr = `${prevMonthYear}-${String(prevMonthNum + 1).padStart(2, '0')}-${String(prevDayVal).padStart(2, '0')}`;
      calendarDays.push({
        day: prevDayVal,
        dateStr: prevDateStr,
        isCurrentMonth: false
      });
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calendarDays.push({
        day: d,
        dateStr: dateStr,
        isCurrentMonth: true
      });
    }

    let nextMonthYear = year;
    let nextMonthNum = month + 1;
    if (nextMonthNum > 11) {
      nextMonthNum = 0;
      nextMonthYear += 1;
    }
    const remainingSlots = 42 - calendarDays.length;
    for (let d = 1; d <= remainingSlots; d++) {
      const nextDateStr = `${nextMonthYear}-${String(nextMonthNum + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calendarDays.push({
        day: d,
        dateStr: nextDateStr,
        isCurrentMonth: false
      });
    }
    
    const getDayDuties = (dateStr) => {
      return monthlyDuties[dateStr] || {};
    };

    const handleSaveDayDuty = async (dateStr, dutyKey, value) => {
      try {
        const docRef = doc(db, "duties", dateStr);
        await setDoc(docRef, { [dutyKey]: value }, { merge: true });
      } catch (err) {
        console.error("Error saving duty:", err);
        alert("שגיאה בשמירת התורנות: " + err.message);
      }
    };

    const handleSaveFullDayDuty = async (dateStr, dutyPrefix, value) => {
      try {
        const docRef = doc(db, "duties", dateStr);
        await setDoc(docRef, { 
          [`${dutyPrefix}_morning`]: value, 
          [`${dutyPrefix}_evening`]: value 
        }, { merge: true });
      } catch (err) {
        console.error("Error saving full day duty:", err);
        alert("שגיאה בשמירת התורנות: " + err.message);
      }
    };

    // statsList is defined at the top level of the App component to comply with React Rules of Hooks.
    
    return (
      <div className="duties-dashboard" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="glass-card" style={{ padding: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <button className="btn btn-cancel" onClick={handlePrevMonth} style={{ width: 'auto', margin: 0, padding: '0.4rem 0.8rem' }}>◀ חודש קודם</button>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, minWidth: '120px', textAlign: 'center' }}>
              {monthNamesHe[month]} {year}
            </h2>
            <button className="btn btn-cancel" onClick={handleNextMonth} style={{ width: 'auto', margin: 0, padding: '0.4rem 0.8rem' }}>חודש הבא ▶</button>
          </div>

          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '3px' }}>
            <button 
              onClick={() => setDutiesTab('calendar')}
              style={{
                background: dutiesTab === 'calendar' ? 'var(--accent-primary)' : 'none',
                color: dutiesTab === 'calendar' ? '#fff' : 'rgba(255,255,255,0.7)',
                border: 'none', borderRadius: '8px', padding: '0.4rem 1rem', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              📅 לוח שנה חודשי
            </button>
            <button 
              onClick={() => setDutiesTab('stats')}
              style={{
                background: dutiesTab === 'stats' ? 'var(--accent-primary)' : 'none',
                color: dutiesTab === 'stats' ? '#fff' : 'rgba(255,255,255,0.7)',
                border: 'none', borderRadius: '8px', padding: '0.4rem 1rem', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              📊 מדד עומס תורנויות
            </button>
          </div>
        </div>

        {dutiesTab === 'calendar' ? (
          <div className="glass-card" style={{ padding: '1.2rem', overflowX: 'auto' }}>
            <p style={{ opacity: 0.8, fontSize: '0.9rem', marginBottom: '1rem', marginTop: 0 }}>
              {isTamar 
                ? 'לחצי על יום בלוח השנה כדי לשבץ צוותים לתורנות מקלחות ושירותים.'
                : `שלום ${userName} (${sergeantTeam}). לחץ על יום כדי לשבץ את חיילי הצוות שלך למטבח, רס"ר ושבת.`
              }
            </p>

            <div style={{ minWidth: '600px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem', marginBottom: '0.4rem', textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem', opacity: 0.8 }}>
                <div>ראשון</div>
                <div>שני</div>
                <div>שלישי</div>
                <div>רביעי</div>
                <div>חמישי</div>
                <div>שישי</div>
                <div style={{ color: '#f87171' }}>שבת</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem' }}>
                {calendarDays.map((cell, idx) => {
                  const dateStr = cell.dateStr;
                  const dayData = getDayDuties(dateStr);
                  const isToday = dateStr === getTodayDateStr();
                  const isShabbat = idx % 7 === 6;

                  return (
                    <div 
                      key={`day-${idx}-${dateStr}`}
                      onClick={() => setSelectedCalendarDay(dateStr)}
                      style={{
                        background: isToday ? 'rgba(59, 130, 246, 0.15)' : cell.isCurrentMonth ? 'var(--card-bg, #ffffff)' : 'rgba(235, 235, 235, 0.4)',
                        border: isToday ? '2px solid #3b82f6' : '1px solid var(--border-color, rgba(0,0,0,0.12))',
                        borderRadius: '10px',
                        minHeight: '95px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        position: 'relative',
                        opacity: cell.isCurrentMonth ? 1 : 0.85,
                        transition: 'transform 0.2s, background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = isToday ? 'rgba(59, 130, 246, 0.15)' : cell.isCurrentMonth ? 'var(--card-bg, #ffffff)' : 'rgba(150,150,150,0.15)'}
                    >
                      {/* Day number overlay */}
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        zIndex: 10,
                        background: 'rgba(255, 255, 255, 0.75)',
                        border: '1px solid rgba(0, 0, 0, 0.08)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        color: isShabbat ? '#ef4444' : isToday ? '#2563eb' : '#334155',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}>
                        {cell.day}
                      </div>

                      {/* Shabbat Closer indicator */}
                      {dayData.closed_shabbat && (
                        <div style={{
                          position: 'absolute',
                          bottom: '4px',
                          right: '4px',
                          zIndex: 10,
                          background: '#f87171',
                          color: '#fff',
                          padding: '1px 4px',
                          borderRadius: '4px',
                          fontSize: '0.62rem',
                          fontWeight: 'bold'
                        }} title={`סוגר שבת: ${dayData.closed_shabbat}`}>
                          ⚡ {dayData.closed_shabbat.split(' ')[0]}
                        </div>
                      )}

                      {/* Split Rows */}
                      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', flex: 1 }}>
                        {isTamar ? (
                          /* Tamar View: Showers and Toilets */
                          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', flex: 1, padding: '24px 4px 4px 4px', gap: '3px' }}>
                            {dayData.showers && (
                              <div style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 4px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                🧼 {dayData.showers}
                              </div>
                            )}
                            {dayData.toilets && (
                              <div style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '2px 4px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                🚽 {dayData.toilets}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Sergeants View: Kitchen and Rasar split rows with team colors */
                          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', flex: 1, paddingTop: '0' }}>
                            {/* Kitchen Row */}
                            {(() => {
                              const morningSoldier = dayData.kitchen_morning;
                              const eveningSoldier = dayData.kitchen_evening;
                              const morningTeam = getSoldierTeam(morningSoldier);
                              const eveningTeam = getSoldierTeam(eveningSoldier);
                              const isFull = morningSoldier && eveningSoldier && morningSoldier === eveningSoldier;

                              if (!morningSoldier && !eveningSoldier) {
                                return (
                                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', opacity: 0.25, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    🍳
                                  </div>
                                );
                              }

                              if (isFull) {
                                return (
                                  <div style={{
                                    flex: 1,
                                    background: getTeamColor(morningTeam),
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    textOverflow: 'ellipsis',
                                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                                    padding: '0 2px'
                                  }} title={`🍳 מטבח: ${morningSoldier}`}>
                                    🍳 {morningSoldier.split(' ')[0]}
                                  </div>
                                );
                              }

                              return (
                                <div style={{ flex: 1, display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                  <div style={{
                                    flex: 1,
                                    background: morningSoldier ? getTeamColor(morningTeam) : 'transparent',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.65rem',
                                    fontWeight: 'bold',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    textOverflow: 'ellipsis',
                                    borderLeft: '1px solid rgba(255,255,255,0.06)',
                                    padding: '0 2px'
                                  }} title={morningSoldier ? `🍳 בוקר: ${morningSoldier}` : ''}>
                                    {morningSoldier ? morningSoldier.split(' ')[0] : '🍳'}
                                  </div>
                                  <div style={{
                                    flex: 1,
                                    background: eveningSoldier ? getTeamColor(eveningTeam) : 'transparent',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.65rem',
                                    fontWeight: 'bold',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    textOverflow: 'ellipsis',
                                    padding: '0 2px'
                                  }} title={eveningSoldier ? `🍳 ערב: ${eveningSoldier}` : ''}>
                                    {eveningSoldier ? eveningSoldier.split(' ')[0] : '🍳'}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Rasar Row */}
                            {(() => {
                              const morningSoldier = dayData.rasar_morning;
                              const eveningSoldier = dayData.rasar_evening;
                              const morningTeam = getSoldierTeam(morningSoldier);
                              const eveningTeam = getSoldierTeam(eveningSoldier);
                              const isFull = morningSoldier && eveningSoldier && morningSoldier === eveningSoldier;

                              if (!morningSoldier && !eveningSoldier) {
                                return (
                                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', opacity: 0.25 }}>
                                    🛠️
                                  </div>
                                );
                              }

                              if (isFull) {
                                return (
                                  <div style={{
                                    flex: 1,
                                    background: getTeamColor(morningTeam),
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    textOverflow: 'ellipsis',
                                    padding: '0 2px'
                                  }} title={`🛠️ רס"ר: ${morningSoldier}`}>
                                    🛠️ {morningSoldier.split(' ')[0]}
                                  </div>
                                );
                              }

                              return (
                                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                                  <div style={{
                                    flex: 1,
                                    background: morningSoldier ? getTeamColor(morningTeam) : 'transparent',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.65rem',
                                    fontWeight: 'bold',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    textOverflow: 'ellipsis',
                                    borderLeft: '1px solid rgba(255,255,255,0.06)',
                                    padding: '0 2px'
                                  }} title={morningSoldier ? `🛠️ בוקר: ${morningSoldier}` : ''}>
                                    {morningSoldier ? morningSoldier.split(' ')[0] : '🛠️'}
                                  </div>
                                  <div style={{
                                    flex: 1,
                                    background: eveningSoldier ? getTeamColor(eveningTeam) : 'transparent',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.65rem',
                                    fontWeight: 'bold',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    textOverflow: 'ellipsis',
                                    padding: '0 2px'
                                  }} title={eveningSoldier ? `🛠️ ערב: ${eveningSoldier}` : ''}>
                                    {eveningSoldier ? eveningSoldier.split(' ')[0] : '🛠️'}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: '1.2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700 }}>
              📈 טבלת חלוקת עומס תורנויות - {isTamar ? 'כלל הגדוד' : `צוות ${sergeantTeam}`}
            </h3>
            <p style={{ opacity: 0.8, fontSize: '0.9rem', marginBottom: '1.2rem', marginTop: 0 }}>
              החיילים מסודרים מהעומס הנמוך ביותר לגבוה ביותר. השתמש בטבלה כדי לבחור את הבא בתור למשימה.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '0.6rem 0.4rem', fontWeight: 700 }}>שם חייל</th>
                  {isTamar && <th style={{ padding: '0.6rem 0.4rem', fontWeight: 700 }}>צוות</th>}
                  <th style={{ padding: '0.6rem 0.4rem', fontWeight: 700, textAlign: 'center' }}>ימי מטבח (🍳)</th>
                  <th style={{ padding: '0.6rem 0.4rem', fontWeight: 700, textAlign: 'center' }}>ימי רס"ר (🛠️)</th>
                  <th style={{ padding: '0.6rem 0.4rem', fontWeight: 700, textAlign: 'center' }}>שבתות שסגר (⚡)</th>
                  <th style={{ padding: '0.6rem 0.4rem', fontWeight: 700, textAlign: 'center' }}>סך הכל עומס</th>
                </tr>
              </thead>
              <tbody>
                {statsList.map(soldier => (
                  <tr key={soldier.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.6rem 0.4rem', fontWeight: 600 }}>{soldier.name}</td>
                    {isTamar && <td style={{ padding: '0.6rem 0.4rem', opacity: 0.8 }}>{soldier.team}</td>}
                    <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>{soldier.kitchen}</td>
                    <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>{soldier.rasar}</td>
                    <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', fontWeight: soldier.shabbat > 0 ? 'bold' : 'normal', color: soldier.shabbat > 0 ? '#f87171' : 'inherit' }}>
                      {soldier.shabbat}
                    </td>
                    <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>
                      <span style={{
                        background: soldier.total === 0 ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.08)',
                        color: soldier.total === 0 ? '#34d399' : '#fff',
                        padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold'
                      }}>
                        {soldier.total}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedCalendarDay && (() => {
          const dayVal = selectedCalendarDay.split('-').reverse().join('.');
          const dayData = monthlyDuties[selectedCalendarDay] || {};

          return (
            <div className="registration-overlay" style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:2100, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={() => setSelectedCalendarDay(null)}>
              <div className="glass-card" style={{width:'90%', maxWidth:'450px', textAlign:'right', display: 'flex', flexDirection: 'column', gap: '1.2rem', padding: '1.5rem'}} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>🛠️ שיבוץ תורנויות ליום: {dayVal}</h3>
                  <button onClick={() => setSelectedCalendarDay(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#fff' }}>✕</button>
                </div>

                {isTamar ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>🧼 תורנות מקלחות (צוות):</label>
                      <select
                        className="input-field"
                        value={dayData.showers || ''}
                        onChange={(e) => handleSaveDayDuty(selectedCalendarDay, 'showers', e.target.value)}
                        style={{ margin: 0 }}
                      >
                        <option value="">-- בחר צוות --</option>
                        {AVAILABLE_TEAMS.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>🚽 תורנות שירותים (צוות):</label>
                      <select
                        className="input-field"
                        value={dayData.toilets || ''}
                        onChange={(e) => handleSaveDayDuty(selectedCalendarDay, 'toilets', e.target.value)}
                        style={{ margin: 0 }}
                      >
                        <option value="">-- בחר צוות --</option>
                        {AVAILABLE_TEAMS.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.06)', padding: '0.6rem', borderRadius: '8px', opacity: 0.8 }}>
                      שייך חיילים מתוך <strong>צוות {sergeantTeam}</strong> לתורנויות היומיות.
                    </div>

                    {/* Kitchen Section */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>🍳 תורנות מטבח:</span>
                        <select
                          className="input-field"
                          value={kitchenMode}
                          onChange={(e) => setKitchenMode(e.target.value)}
                          style={{ margin: 0, padding: '0.25rem 0.6rem 0.25rem 1.8rem', backgroundPosition: 'left 0.4rem center', fontSize: '0.8rem', width: 'auto' }}
                        >
                          <option value="half">חצי יום</option>
                          <option value="full">יום שלם</option>
                        </select>
                      </div>

                      {kitchenMode === 'full' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <select
                            className="input-field"
                            value={dayData.kitchen_morning || ''}
                            onChange={(e) => handleSaveFullDayDuty(selectedCalendarDay, 'kitchen', e.target.value)}
                            style={{ margin: 0 }}
                          >
                            <option value="">-- בחר חייל ליום שלם --</option>
                            {teamSoldiers.map(s => (
                              <option key={s.name} value={s.name}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.75rem', opacity: 0.8 }}>חלק ראשון (בוקר):</label>
                            <select
                              className="input-field"
                              value={dayData.kitchen_morning || ''}
                              onChange={(e) => handleSaveDayDuty(selectedCalendarDay, 'kitchen_morning', e.target.value)}
                              style={{ margin: 0, fontSize: '0.85rem' }}
                            >
                              <option value="">-- בחר חייל --</option>
                              {teamSoldiers.map(s => (
                                <option key={s.name} value={s.name}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.75rem', opacity: 0.8 }}>חלק שני (ערב):</label>
                            <select
                              className="input-field"
                              value={dayData.kitchen_evening || ''}
                              onChange={(e) => handleSaveDayDuty(selectedCalendarDay, 'kitchen_evening', e.target.value)}
                              style={{ margin: 0, fontSize: '0.85rem' }}
                            >
                              <option value="">-- בחר חייל --</option>
                              {teamSoldiers.map(s => (
                                <option key={s.name} value={s.name}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Rasar Section */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>🛠️ תורנות רס"ר:</span>
                        <select
                          className="input-field"
                          value={rasarMode}
                          onChange={(e) => setRasarMode(e.target.value)}
                          style={{ margin: 0, padding: '0.25rem 0.6rem 0.25rem 1.8rem', backgroundPosition: 'left 0.4rem center', fontSize: '0.8rem', width: 'auto' }}
                        >
                          <option value="half">חצי יום</option>
                          <option value="full">יום שלם</option>
                        </select>
                      </div>

                      {rasarMode === 'full' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <select
                            className="input-field"
                            value={dayData.rasar_morning || ''}
                            onChange={(e) => handleSaveFullDayDuty(selectedCalendarDay, 'rasar', e.target.value)}
                            style={{ margin: 0 }}
                          >
                            <option value="">-- בחר חייל ליום שלם --</option>
                            {teamSoldiers.map(s => (
                              <option key={s.name} value={s.name}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.75rem', opacity: 0.8 }}>חלק ראשון (בוקר):</label>
                            <select
                              className="input-field"
                              value={dayData.rasar_morning || ''}
                              onChange={(e) => handleSaveDayDuty(selectedCalendarDay, 'rasar_morning', e.target.value)}
                              style={{ margin: 0, fontSize: '0.85rem' }}
                            >
                              <option value="">-- בחר חייל --</option>
                              {teamSoldiers.map(s => (
                                <option key={s.name} value={s.name}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.75rem', opacity: 0.8 }}>חלק שני (ערב):</label>
                            <select
                              className="input-field"
                              value={dayData.rasar_evening || ''}
                              onChange={(e) => handleSaveDayDuty(selectedCalendarDay, 'rasar_evening', e.target.value)}
                              style={{ margin: 0, fontSize: '0.85rem' }}
                            >
                              <option value="">-- בחר חייל --</option>
                              {teamSoldiers.map(s => (
                                <option key={s.name} value={s.name}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Shabbat Closer - Only shown on Saturdays */}
                    {new Date(selectedCalendarDay).getDay() === 6 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#f87171' }}>⚡ סוגר שבת (לסופ"ש הקרוב):</label>
                        <select
                          className="input-field"
                          value={dayData.closed_shabbat || ''}
                          onChange={(e) => handleSaveDayDuty(selectedCalendarDay, 'closed_shabbat', e.target.value)}
                          style={{ margin: 0 }}
                        >
                          <option value="">-- בחר חייל לסגירה --</option>
                          {teamSoldiers.map(s => (
                            <option key={s.name} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <button className="btn btn-save" onClick={() => setSelectedCalendarDay(null)} style={{ marginTop: '0.5rem' }}>אישור וסגירה</button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  const renderAttendanceDashboard = () => {
    const allSoldiers = getAllSoldiers();
    const filteredUsers = allSoldiers.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(attendanceSearchQuery.toLowerCase());
      const matchesTeam = attendanceTeamFilter === 'הכל' ? true : u.team === attendanceTeamFilter;
      
      const record = attendanceRecords.find(r => r.date === todayDateStr && r.name === u.name);
      const val = attendanceTimeOfDay === 'morning' ? record?.morning : record?.evening;
      const pre = attendanceTimeOfDay === 'morning' ? record?.morningPreCheck : record?.eveningPreCheck;

      let matchesStatus = true;
      if (attendanceStatusFilter === 'no_morning') {
        matchesStatus = (val !== 'present');
      } else if (attendanceStatusFilter === 'exceptions') {
        matchesStatus = val && val !== 'present';
      } else if (attendanceStatusFilter === 'confirmed_whatsapp') {
        matchesStatus = val !== 'present' && pre === 'coming';
      }

      return matchesSearch && matchesTeam && matchesStatus;
    });

    const totalCount = filteredUsers.length;
    const sessionCount = filteredUsers.filter(u => {
      const rec = attendanceRecords.find(r => r.date === todayDateStr && r.name === u.name);
      const val = attendanceTimeOfDay === 'morning' ? rec?.morning : rec?.evening;
      return val && val !== 'absent';
    }).length;

    const getStatusStyleAndText = (val) => {
      switch (val) {
        case 'present':
          return { text: '🟢 נוכח', style: { color: '#059669', background: 'rgba(16, 185, 129, 0.15)' } };
        case 'absent':
          return { text: '🔴 נפקד', style: { color: '#dc2626', background: 'rgba(220, 38, 38, 0.15)' } };
        case 'sick':
          return { text: '🤒 גימלים', style: { color: '#d97706', background: 'rgba(217, 119, 6, 0.15)' } };
        case 'leave':
          return { text: '🏖️ חופש', style: { color: '#2563eb', background: 'rgba(37, 99, 235, 0.15)' } };
        case 'duty':
          return { text: '⚔️ בתפקיד', style: { color: '#7c3aed', background: 'rgba(124, 58, 237, 0.15)' } };
        default:
          return { text: '⚪ טרם דיווח', style: { color: '#64748b', background: 'rgba(100, 116, 139, 0.1)' } };
      }
    };

    return (
      <div className="attendance-dashboard" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        <div className="glass-card" style={{ padding: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 800 }}>📊 סטטיסטיקת נוכחות ({attendanceTimeOfDay === 'morning' ? 'בוקר' : 'ערב'})</h2>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>נוכחים במסדר: <strong style={{color:'#10b981'}}>{sessionCount}</strong> / {totalCount}</span>
            </div>
          </div>
          
          {/* Morning/Evening Session Selector */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
            <button 
              onClick={() => setAttendanceTimeOfDay('morning')}
              style={{
                border: 'none', background: attendanceTimeOfDay === 'morning' ? 'var(--primary, #3b82f6)' : 'none',
                color: 'white', fontWeight: 700, padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer'
              }}
            >
              🌅 בוקר
            </button>
            <button 
              onClick={() => setAttendanceTimeOfDay('evening')}
              style={{
                border: 'none', background: attendanceTimeOfDay === 'evening' ? 'var(--primary, #3b82f6)' : 'none',
                color: 'white', fontWeight: 700, padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer'
              }}
            >
              🌙 ערב
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button className="btn btn-save" style={{ margin: 0, padding: '0.5rem 1rem', width: 'auto' }} onClick={() => setIsQrModalOpen(true)}>
              📱 ברקוד מהיר
            </button>
            <button className="btn" style={{ margin: 0, padding: '0.5rem 1rem', background: '#2563eb', color: 'white', width: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={handleExportWhatsApp}>
              <span>💬</span> העתק לווטסאפ
            </button>
          </div>
        </div>

        {/* Meeting Scheduler Card */}
        <div className="glass-card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⏰</span>
            <span>קביעת זמן מסדר/מפגש גדודי</span>
          </h3>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontWeight: 600 }}>שעה:</label>
              <input 
                type="time" 
                className="input-field" 
                style={{ width: '130px', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.9rem' }} 
                value={meetingConfig?.time || ''} 
                onChange={(e) => handleSaveMeeting(e.target.value, meetingConfig?.sendReminder ?? true)}
              />
            </div>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none', fontWeight: 600 }}>
              <input 
                type="checkbox" 
                checked={meetingConfig?.sendReminder ?? true} 
                onChange={(e) => {
                  if (meetingConfig?.time) {
                    handleSaveMeeting(meetingConfig.time, e.target.checked);
                  } else {
                    alert("נא לקבוע שעה תחילה.");
                  }
                }}
              />
              <span>שלח תזכורת 10 דקות לפני</span>
            </label>

            {meetingConfig?.time && (
              <button 
                className="btn btn-cancel" 
                style={{ margin: 0, padding: '0.4rem 1rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', width: 'auto' }} 
                onClick={handleClearMeeting}
              >
                🗑️ ביטול מסדר
              </button>
            )}
          </div>
          {meetingConfig?.time && (
            <div style={{ fontSize: '0.85rem', opacity: 0.8, color: '#10b981', fontWeight: 600 }}>
              מסדר מתוזמן להיום בשעה {meetingConfig.time} {meetingConfig.sendReminder ? "(עם תזכורת 10 דק' לפני)" : "(ללא תזכורת לפני)"}
            </div>
          )}
          {meetingConfig?.time && (
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
              <button 
                className="btn" 
                style={{ background: 'rgba(37, 99, 235, 0.15)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.3)', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => {
                  const [hStr] = (meetingConfig?.time || '00:00').split(':');
                  const isMorning = parseInt(hStr, 10) < 14;
                  const gearReminder = isMorning ? '\n*נא לזכור להביא דסקית וחוגר! 🪖*' : '';
                  const msg = `📢 *תזכורת למסדר גדודי* 📢\nהמסדר יתחיל בעוד 10 דקות בשעה *${meetingConfig.time}*.\nנא להיכנס לאפליקציה ולהיות מוכנים לדיווח נוכחות!${gearReminder}`;
                  navigator.clipboard.writeText(msg).then(() => alert("תזכורת הועתקה ללוח!"));
                }}
              >
                💬 העתק תזכורת 10 דק' לווטסאפ
              </button>
              <button 
                className="btn" 
                style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => {
                  const [hStr] = (meetingConfig?.time || '00:00').split(':');
                  const isMorning = parseInt(hStr, 10) < 14;
                  const gearReminder = isMorning ? '\n*נא לזכור להביא דסקית וחוגר! 🪖*' : '';
                  const msg = `🚨 *זמן מסדר הגיע!* 🚨\nהמסדר הגדודי התחיל כעת (*${meetingConfig.time}*).\nנא להיכנס כולם לאפליקציה ולדווח נוכחות ("אני בבסיס/גימלים/חופש") באופן מיידי!${gearReminder}`;
                  navigator.clipboard.writeText(msg).then(() => alert("הודעת תחילת מסדר הועתקה ללוח!"));
                }}
              >
                🚨 העתק הודעת תחילת מסדר לווטסאפ
              </button>
            </div>
          )}
        </div>

        <div className="glass-card" style={{ padding: '1rem', display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600 }}>סנן לפי:</span>
          <input 
            className="input-field" 
            placeholder="חיפוש חייל..." 
            value={attendanceSearchQuery} 
            onChange={e => setAttendanceSearchQuery(e.target.value)} 
            style={{ maxWidth: '200px', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
          />
          <select 
            className="input-field" 
            value={attendanceTeamFilter} 
            onChange={e => setAttendanceTeamFilter(e.target.value)}
            style={{ maxWidth: '150px', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
          >
            <option value="הכל">כל הצוותים</option>
            {AVAILABLE_TEAMS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select 
            className="input-field" 
            value={attendanceStatusFilter} 
            onChange={e => setAttendanceStatusFilter(e.target.value)}
            style={{ maxWidth: '220px', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
          >
            <option value="הכל">כל הסטטוסים</option>
            <option value="no_morning">לא נוכחים במסדר 🔴</option>
            <option value="exceptions">חריגים (גימלים/חופש/תפקיד) ⚠️</option>
            <option value="confirmed_whatsapp">אישרו הגעה בווטסאפ (טרם סרקו) 💬</option>
          </select>
        </div>

        <div className="glass-card" style={{ padding: '1rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '0.8rem 0.5rem', fontWeight: 700 }}>שם חייל</th>
                <th style={{ padding: '0.8rem 0.5rem', fontWeight: 700 }}>צוות</th>
                <th style={{ padding: '0.8rem 0.5rem', fontWeight: 700, textAlign: 'center' }}>במסדר?</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => {
                const record = attendanceRecords.find(r => r.date === todayDateStr && r.name === user.name);
                const val = attendanceTimeOfDay === 'morning' ? record?.morning : record?.evening;
                const pre = attendanceTimeOfDay === 'morning' ? record?.morningPreCheck : record?.eveningPreCheck;
                const info = getStatusStyleAndText(val);

                return (
                  <tr key={user.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.8rem 0.5rem', fontWeight: 600 }}>{user.name}</td>
                    <td style={{ padding: '0.8rem 0.5rem', opacity: 0.8 }}>{user.team || 'תקשוב'}</td>
                    <td style={{ padding: '0.8rem 0.5rem', textAlign: 'center' }}>
                      <button 
                        onClick={() => handleToggleAttendance(user.name, attendanceTimeOfDay, val)}
                        style={{
                          border: 'none',
                          borderRadius: '20px',
                          padding: '0.35rem 0.85rem',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          width: '110px',
                          transition: 'all 0.2s',
                          ...info.style
                        }}
                      >
                        {info.text}
                      </button>
                      {val !== 'present' && pre === 'coming' && (
                        <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                          💬 מגיע (אישר בווטסאפ)
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>לא נמצאו חיילים התואמים את הסינון.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="app-shell">
      
      {/* Multi-Team Header & Role Bar */}
      <header className="app-header">
        <div className="header-top-row">
          <div className="site-brand">
            <span>🛡️</span>
            <h1>ניהול משימות - גדוד 402</h1>
          </div>
          <div className="header-user-info" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {userName && (
              <span className="user-name-display" style={{ fontWeight: 600, fontSize: '0.95rem', background: 'rgba(255,255,255,0.15)', padding: '0.3rem 0.6rem', borderRadius: '8px' }}>
                👤 {userName}
              </span>
            )}
            {isSuperAdmin && (
              <span className="role-badge super-admin">👑 מנהל ראשי</span>
            )}
            {isCommander && !isSuperAdmin && (
              <span className="role-badge commander">🎖️ מפקד צוות ({workerTeam})</span>
            )}
            {!isSuperAdmin && !isCommander && (
              PLATOON_SERGEANTS.includes(userName) ? (
                <span className="role-badge sergeant" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.85rem' }}>⚡ סמל ({workerTeam})</span>
              ) : (
                <span className="role-badge soldier">🪖 חייל ({workerTeam})</span>
              )
            )}
            <button 
              className="btn btn-cancel" 
              style={{ 
                padding: '0.35rem 0.75rem', 
                fontSize: '0.85rem', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.3rem',
                cursor: 'pointer',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                fontWeight: 600
              }}
              onClick={handleLogout}
              title="התנתק והחלף משתמש"
            >
              🚪 התנתק
            </button>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="team-switcher-bar">
            <span className="team-switcher-label">תצוגת צוות:</span>
            <button
              className={`team-pill ${selectedTeam === 'הכל' ? 'active' : ''}`}
              onClick={() => setSelectedTeam('הכל')}
            >
              🌐 הכל
            </button>
            {AVAILABLE_TEAMS.map(team => (
              <button
                key={team}
                className={`team-pill ${selectedTeam === team ? 'active' : ''}`}
                onClick={() => setSelectedTeam(team)}
              >
                {team === 'מטבח' ? '🍳' : team === 'לוגיסטיקה' ? '📦' : team === 'מפקדה' ? '🎖️' : team === 'תקשוב' ? '📡' : team === 'רכב וניוד' ? '🚚' : team === 'רפואה' ? '🩺' : team === 'טנ"א (חימוש)' ? '🛠️' : team === 'שלישות' ? '📋' : '🛡️'} {team}
              </button>
            ))}
          </div>
        )}
      </header>
      
      {activeWorkspaceTeam === 'מטבח' && (
        <nav className="time-nav">
          <div className={`time-icon ${viewTime === 'morning' ? 'active' : ''}`} onClick={() => setViewTime('morning')}>
            🌅 <span>בוקר</span>
          </div>
          <div className={`time-icon ${viewTime === 'noon' ? 'active' : ''}`} onClick={() => setViewTime('noon')}>
            ☀️ <span>צהריים</span>
          </div>
          <div className={`time-icon ${viewTime === 'evening' ? 'active' : ''}`} onClick={() => setViewTime('evening')}>
            🌙 <span>ערב</span>
          </div>
        </nav>
      )}

      {isAdmin && activeTab === 'tasks' && (
        <div className="filter-bar">
          <button 
            className={`btn-filter ${hideAssigned ? 'active' : ''}`}
            onClick={() => setHideAssigned(!hideAssigned)}
          >
            {hideAssigned ? '👁️ הצג משימות משויכות' : '👁️‍🗨️ הסתר משימות משויכות'}
          </button>
          <button
            className="btn-filter"
            style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600 }}
            onClick={() => setIsBankModalOpen(true)}
          >
            📦 ערכות משימות & בנק ({activeWorkspaceTeam})
          </button>
        </div>
      )}

      <main className="container" style={activeTab === 'duties' ? { maxWidth: '1000px', width: '100%' } : undefined}>
        {renderMeetingReminderBanner()}
        {renderAttendanceBanner()}
        {activeTab === 'tasks' ? (
          <div className="swipe-viewport" style={{overflow:'hidden', width: '100%'}}>
            <DndContext 
              sensors={sensors} 
              collisionDetection={closestCenter} 
              onDragStart={handleDragStart} 
              onDragOver={handleDragOver} 
              onDragEnd={handleDragEnd} 
              onDragCancel={handleDragCancel}
            >
              {activeWorkspaceTeam === 'מטבח' ? (
                <div className="swipe-container" style={{
                  transform: `translateX(${viewTime === 'morning' ? '0' : viewTime === 'noon' ? '33.333%' : '66.666%'})`,
                  display: 'flex', 
                  width: '300%',
                  direction: 'rtl'
                }}>
                  {['morning', 'noon', 'evening'].map(time => {
                    const filteredTasks = getFilteredTasks(time);
                    return (
                      <section key={time} className="swipe-screen" style={{width: '33.333%', flexShrink: 0}}>
                        <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                          {filteredTasks.map(task => (
                            <SortableTask key={task.id} task={task} isAdmin={isAdmin}
                              isSelected={selectedTaskId === task.id}
                              onToggleSelect={() => isAdmin ? setSelectedTaskId(selectedTaskId === task.id ? null : task.id) : null}
                            onVerify={verifyTask} onDelete={deleteTask}
                            onOpenAssignment={(taskId) => setAssignmentModal({ isOpen: true, type: 'task', targetId: taskId })}
                            onToggleStatus={toggleStatus}
                            currentUserName={userName} />
                          ))}
                        </SortableContext>
                        {filteredTasks.length === 0 && (
                          <div style={{textAlign:'center', padding: '1.5rem 0', opacity:0.8}}>
                            <p style={{margin: 0}}>אין משימות לזמן זה במרחב {activeWorkspaceTeam}</p>
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="single-workspace-container" style={{ width: '100%', direction: 'rtl' }}>
                  {(() => {
                    const filteredTasks = getFilteredTasks();
                    return (
                      <section className="workspace-screen" style={{ width: '100%' }}>
                        <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                          {filteredTasks.map(task => (
                            <SortableTask key={task.id} task={task} isAdmin={isAdmin}
                              isSelected={selectedTaskId === task.id}
                              onToggleSelect={() => isAdmin ? setSelectedTaskId(selectedTaskId === task.id ? null : task.id) : null}
                            onVerify={verifyTask} onDelete={deleteTask}
                            onOpenAssignment={(taskId) => setAssignmentModal({ isOpen: true, type: 'task', targetId: taskId })}
                            onToggleStatus={toggleStatus}
                            currentUserName={userName} />
                          ))}
                        </SortableContext>
                        {filteredTasks.length === 0 && (
                          <div style={{textAlign:'center', padding: '2rem 0', opacity:0.8}}>
                            <p style={{margin: 0, fontSize: '1.05rem'}}>אין משימות במרחב עבודה {activeWorkspaceTeam}</p>
                          </div>
                        )}
                      </section>
                    );
                  })()}
                </div>
              )}
              <TrashBin isAdmin={isAdmin} onLongPress={handleClearAllTasks} />
              <DragOverlay dropAnimation={null}>
                {activeId ? (
                  <TaskDragPreview 
                    task={tasks.find(t => t.id === activeId)} 
                    isAdmin={isAdmin} 
                    isOverTrash={isOverTrash}
                    currentUserName={userName} 
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        ) : (activeTab === 'devices' && isAdmin) ? (
          <div className="devices-view">
            {isAdmin && (() => {
              const visibleMembers = Object.keys(KNOWN_TEAM_ROLES).filter(memberName => {
                const mapped = KNOWN_TEAM_ROLES[memberName];
                return activeWorkspaceTeam === 'הכל' ? true : mapped.team === activeWorkspaceTeam;
              });

              const activeCount = visibleMembers.filter(name => whitelistUsers.find(u => u.name === name)?.isActivated).length;

              return (
                <div className="glass-card" style={{ padding: '1.2rem' }}>
                  <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                    <span>📱</span>
                    <span>סטטוס חיבור מכשירים ונעילות ({activeWorkspaceTeam})</span>
                    <span style={{ fontSize: '0.85rem', opacity: 0.7, fontWeight: 'normal' }}>
                      ({activeCount} / {visibleMembers.length} מופעלים)
                    </span>
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.8rem' }}>
                    {visibleMembers.map(memberName => {
                      const mapped = KNOWN_TEAM_ROLES[memberName];
                      const dbUser = whitelistUsers.find(u => u.name === memberName);
                      const isAct = !!dbUser?.isActivated;
                      
                      return (
                        <div key={memberName} style={{
                          background: isAct ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                          border: isAct ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(0, 0, 0, 0.08)',
                          padding: '0.6rem 0.8rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{memberName}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{mapped.team} • {mapped.role === 'super_admin' ? 'מנהל ראשי' : mapped.role === 'commander' ? 'מפקד' : 'חייל'}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              fontSize: '0.75rem', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600,
                              background: isAct ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.15)',
                              color: isAct ? '#059669' : '#64748b'
                            }}>
                              {isAct ? '🟢 מופעל' : '⚪ לא התחבר'}
                            </span>
                            {isAct && (
                              <button
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                                title="אפס נעילת מכשיר"
                                onClick={() => handleResetUserDevice(memberName)}
                              >
                                🔄
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (activeTab === 'attendance' && userName === 'תמר ביליה') ? (
          renderAttendanceDashboard()
        ) : (activeTab === 'duties' && isDutyOrganizer) ? (
          renderDutiesDashboard()
        ) : (
          <div className="people-view" style={{ padding: '1rem' }}>
            {isAdmin && (
              <form onSubmit={handleAddWorker} className="glass-card" style={{ display: 'flex', gap: '0.8rem', padding: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>➕ רישום חייל חדש לצוות:</h4>
                <input 
                  className="input-field" 
                  placeholder="שם מלא של החייל" 
                  value={newWorkerName} 
                  onChange={e => setNewWorkerName(e.target.value)} 
                  style={{ maxWidth: '220px', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                />
                {isSuperAdmin && (
                  <select 
                    className="input-field" 
                    value={newWorkerTeam} 
                    onChange={e => setNewWorkerTeam(e.target.value)}
                    style={{ maxWidth: '140px', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                  >
                    {AVAILABLE_TEAMS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                )}
                <button className="btn btn-save" type="submit" style={{ padding: '0.45rem 1rem', fontSize: '0.9rem', width: 'auto', marginTop: 0 }}>רשום חייל</button>
              </form>
            )}
            <DndContext 
              sensors={sensors} 
              collisionDetection={closestCenter} 
              onDragStart={handleWorkerDragStart} 
              onDragOver={handleDragOver} 
              onDragEnd={handleWorkerDragEnd} 
              onDragCancel={handleWorkerDragCancel}
            >
              {Object.keys(workersByTeam).map(teamName => (
                <div key={teamName} className="team-section">
                  <div className="team-title">
                    <span>
                      {teamName === 'סוללה' ? '🔋' : teamName === 'אגם' ? '💧' : teamName === 'פלסם' ? '🛡️' : '🪖'}
                    </span>
                    <span>חיילי צוות {teamName}</span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 'normal', marginRight: '6px' }}>
                      ({workersByTeam[teamName].length} חיילים זמינים)
                    </span>
                  </div>
                  <div className="team-workers-grid">
                    <SortableContext items={workersByTeam[teamName].map(w => w.id)} strategy={verticalListSortingStrategy}>
                      {workersByTeam[teamName].map(worker => (
                        <WorkerCard 
                          key={worker.id} 
                          worker={worker} 
                          tasks={tasks} 
                          isAdmin={isAdmin} 
                          viewTime={viewTime} 
                          onOpenAssignment={(workerId) => setAssignmentModal({ isOpen: true, type: 'worker', targetId: workerId })} 
                        />
                      ))}
                    </SortableContext>
                  </div>
                </div>
              ))}
              {displayWorkers.length === 0 && (
                <div className="team-section" style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <p style={{ opacity: 0.6 }}>אין חיילים משוייכים לצוות זה כרגע</p>
                </div>
              )}
              <TrashBin isAdmin={isAdmin} onLongPress={handleClearAllWorkers} />
              <DragOverlay dropAnimation={null}>
                {activeWorkerId ? (
                  <WorkerDragPreview 
                    worker={displayWorkers.find(w => w.id === activeWorkerId)} 
                    tasks={tasks} 
                    viewTime={viewTime}
                    isOverTrash={isOverTrash} 
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}
      </main>

      <div className="app-version">v{APP_VERSION}</div>

      {isAdmin && activeTab === 'tasks' && <button className="add-task-fab" onClick={() => setIsFormOpen(true)}>+</button>}

      {isFormOpen && (
        <div className="compact-form-overlay" onClick={() => setIsFormOpen(false)}>
          <form className="task-item compact-form" onClick={e => e.stopPropagation()} onSubmit={handleAddTask}>
            <div className="task-inner-content" style={{flexDirection: 'column', alignItems: 'stretch'}}>
              <h3 style={{marginBottom: '0.5rem', fontSize: '1.1rem'}}>משימה חדשה</h3>
              <div className="task-content">
                <div className="task-header-row">
                  <input className="inline-edit-input" placeholder="שם המשימה" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} autoFocus />
                </div>
                <textarea className="inline-edit-textarea" placeholder="תיאור המשימה" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
              </div>
              <div className="task-actions" style={{justifyContent: 'flex-end', marginTop: '1rem'}}>
                <button className="btn btn-save" type="submit">שמור</button>
                <button className="btn btn-cancel" type="button" onClick={() => setIsFormOpen(false)}>ביטול</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {(isAdmin || isDutyOrganizer) && (
        <nav className="bottom-nav">
          {userName === 'תמר ביליה' ? (
            <>
              <div className={`nav-tab ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
                <i style={{fontSize:'1.3rem'}}>📋</i> <span>משימות</span>
              </div>
              <div className={`nav-tab ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => {
                setAttendanceTimeOfDay(new Date().getHours() < 12 ? 'morning' : 'evening');
                setActiveTab('attendance');
              }}>
                <i style={{fontSize:'1.3rem'}}>📅</i> <span>דוח נוכחות</span>
              </div>
              <div className={`nav-tab ${activeTab === 'duties' ? 'active' : ''}`} onClick={() => setActiveTab('duties')}>
                <i style={{fontSize:'1.3rem'}}>📆</i> <span>לוח תורנויות</span>
              </div>
            </>
          ) : PLATOON_SERGEANTS.includes(userName) ? (
            <>
              <div className={`nav-tab ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
                <i style={{fontSize:'1.3rem'}}>📋</i> <span>משימות</span>
              </div>
              <div className={`nav-tab ${activeTab === 'duties' ? 'active' : ''}`} onClick={() => setActiveTab('duties')}>
                <i style={{fontSize:'1.3rem'}}>📆</i> <span>לוח תורנויות</span>
              </div>
            </>
          ) : (
            <>
              <div className={`nav-tab ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
                <i style={{fontSize:'1.3rem'}}>📋</i> <span>משימות</span>
              </div>
              <div className={`nav-tab ${activeTab === 'people' ? 'active' : ''}`} onClick={() => setActiveTab('people')}>
                <i style={{fontSize:'1.3rem'}}>🪖</i> <span>חיילים ושיבוץ</span>
              </div>
              <div className={`nav-tab ${activeTab === 'devices' ? 'active' : ''}`} onClick={() => setActiveTab('devices')}>
                <i style={{fontSize:'1.3rem'}}>📱</i> <span>חיבורי מכשירים</span>
              </div>
            </>
          )}
        </nav>
      )}

      {!isAdmin && showWelcomeBack && isAuthorized && (
        <div className="registration-overlay" style={{position:'fixed', inset:0, background:'var(--bg-1)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center'}}>
           <div className="glass-card" style={{width:'90%', maxWidth:'400px', textAlign:'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'}}>
              <div className="icon-wrapper" style={{ fontSize: '3rem', background: 'rgba(255,255,255,0.2)', width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>👋</div>
              <h2 style={{ margin: '0.5rem 0' }}>ברוך הבא שוב, {userName}!</h2>
              <p style={{ opacity: 0.8, fontSize: '1rem', margin: '0' }}>שמחים לראות אותך שוב בצוות <strong>{workerTeam}</strong>.</p>
              <button 
                className="btn btn-save" 
                style={{ width: '100%', marginTop: '1rem', padding: '0.8rem 1.2rem', fontSize: '1.05rem' }} 
                onClick={() => setShowWelcomeBack(false)}
              >
                המשך למשימות
              </button>
           </div>
        </div>
      )}
      {isQrModalOpen && (
        <div className="registration-overlay" style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={() => setIsQrModalOpen(false)}>
           <div className="glass-card" style={{width:'90%', maxWidth:'400px', textAlign:'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem'}} onClick={e => e.stopPropagation()}>
              <h2 style={{ margin: '0 0 0.5rem 0' }}>סרוק לדיווח נוכחות</h2>
              <p style={{ opacity: 0.8, fontSize: '0.9rem', margin: '0' }}>החיילים יכולים לסרוק את הברקוד כדי להגיע ישירות לעמוד הדיווח העצמי:</p>
              
              <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + window.location.pathname + '?action=checkin')}`} 
                  alt="QR Code" 
                  style={{ width: '200px', height: '200px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
                <button 
                  className="btn btn-save" 
                  onClick={() => {
                    const checkinUrl = window.location.origin + window.location.pathname + '?action=checkin';
                    navigator.clipboard.writeText(checkinUrl).then(() => {
                      alert("הקישור הועתק ללוח!");
                    });
                  }}
                  style={{ width: '100%', marginTop: '0.5rem' }}
                >
                  📋 העתק קישור ישיר
                </button>
                <button 
                  className="btn btn-save" 
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    const checkinUrl = window.location.origin + window.location.pathname + '?action=checkin';
                    printWindow.document.write(`
                      <html lang="he" dir="rtl">
                      <head>
                        <title>הדפסת ברקוד נוכחות</title>
                        <style>
                          body {
                            font-family: Arial, sans-serif;
                            text-align: center;
                            padding: 3rem;
                            direction: rtl;
                          }
                          .qr-container {
                            border: 3px solid black;
                            display: inline-block;
                            padding: 2rem;
                            border-radius: 16px;
                            margin: 2rem 0;
                          }
                          h1 { font-size: 3rem; margin-bottom: 0.5rem; }
                          h2 { font-size: 1.8rem; margin-top: 0; opacity: 0.8; }
                          p { font-size: 1.4rem; font-weight: bold; }
                          .footer { font-size: 1rem; opacity: 0.6; margin-top: 3rem; }
                        </style>
                      </head>
                      <body>
                        <h1>ברקוד דיווח נוכחות עצמי</h1>
                        <h2>גדוד 402</h2>
                        <div class="qr-container">
                          <img src="https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(checkinUrl)}" style="width:350px; height:350px;" />
                        </div>
                        <p>הוראות לחייל:</p>
                        <p>1. פתח מצלמה 📸 ➔ 2. סרוק את הברקוד 📱 ➔ 3. אשר נוכחות בטלפון שלך 🟢</p>
                        <div class="footer">הברקוד הינו קבוע ורב-פעמי. נא לשמור על התקינות שלו.</div>
                        <script>
                          window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                          };
                        </script>
                      </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  style={{ width: '100%', marginTop: '0.2rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}
                >
                  🖨️ הדפס ברקוד לקיר
                </button>
                <button 
                  className="btn btn-cancel" 
                  style={{ width: '100%', marginTop: '0.2rem' }} 
                  onClick={() => setIsQrModalOpen(false)}
                >
                  סגור
                </button>
              </div>
           </div>
        </div>
      )}
      {renderMeetingPopupModal()}
      {confirmModal.isOpen && (
        <div className="compact-form-overlay" onClick={() => setConfirmModal({ isOpen: false, type: '', message: '', action: null })}>
          <div className="task-item compact-form" onClick={e => e.stopPropagation()} style={{ padding: '2rem', textAlign: 'center', borderRadius: '24px', flexDirection: 'column', alignItems: 'stretch' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: '700' }}>אישור מחיקה</h3>
            <p style={{ marginBottom: '2rem', color: 'var(--text-main)', fontSize: '1rem', lineHeight: '1.5' }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="btn btn-save" 
                style={{ background: '#ef4444', color: 'white' }}
                onClick={() => {
                  confirmModal.action();
                  setConfirmModal({ isOpen: false, type: '', message: '', action: null });
                }}
              >
                מחק הכל
              </button>
              <button 
                className="btn btn-cancel" 
                onClick={() => setConfirmModal({ isOpen: false, type: '', message: '', action: null })}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
      {assignmentModal.isOpen && (
        <AssignmentModal 
          isOpen={assignmentModal.isOpen}
          type={assignmentModal.type}
          targetId={assignmentModal.targetId}
          onClose={() => setAssignmentModal({ isOpen: false, type: 'task', targetId: null })}
          tasks={tasks}
          registeredWorkers={displayWorkers}
          onToggleAssignment={toggleAssignment}
          viewTime={viewTime}
        />
      )}
      <TaskBankModal 
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        activeTeam={activeWorkspaceTeam}
        onDeployTasks={handleDeployTasksBatch}
        onSaveCustomBundle={handleSaveCustomBundle}
        customBundles={customBundles}
      />
    </div>
  );
};

export default App;
