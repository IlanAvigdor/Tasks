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

const KNOWN_TEAM_ROLES = {
  // Super Admins
  "אילן אביגדור": { team: "מפקדה", role: "super_admin" },
  "לירי אביגדור": { team: "לוגיסטיקה", role: "super_admin" },

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
          <span className="person-header-title">{worker.name}</span>
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

  const isSuperAdmin = useMemo(() => {
    return isAuthorized && (userRole === 'super_admin' || userName === 'אילן אביגדור' || userName === 'לירי אביגדור');
  }, [isAuthorized, userName, userRole]);

  const isCommander = useMemo(() => {
    return isAuthorized && userRole === 'commander';
  }, [isAuthorized, userRole]);

  const isAdmin = isSuperAdmin || isCommander;

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
        if (!isSuperAdmin || activeWorkspaceTeam !== 'הכל') {
          if (teamName !== activeWorkspaceTeam) return;
        }

        if (!seenNames.has(nameClean.toLowerCase())) {
          seenNames.add(nameClean.toLowerCase());
          list.push({ ...w, team: teamName });
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
        list.push({ id: `roster-${nameClean}`, name: nameClean, team: mapped.team });
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

  const handleResetUserDevice = async (targetName) => {
    try {
      const docRef = doc(db, "whitelist", targetName);
      await updateDoc(docRef, {
        isActivated: false,
        uid: null,
        resetAt: new Date()
      });
      alert(`נעילת המכשיר של ${targetName} אופסה בהצלחה.`);
    } catch (e) {
      console.error("Error resetting device lock:", e);
      alert("שגיאה באיפוס המכשיר.");
    }
  };
  
  const isInitialLoad = useRef(true);
  const prevStates = useRef({});
  const audioRef = useRef(null);
  const swipeStartX = useRef(0);
  const lastScrollY = useRef(0);

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

        // Single-device lock enforcement temporarily disabled to allow unblocked testing

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

        // Device lock check in snapshot disabled for development testing
      });
      setWhitelistUsers(uList);
    }, (error) => {
      console.error("Firestore whitelist query error:", error);
    });

    const bundlesUnsubscribe = onSnapshot(collection(db, "task_bundles"), (snapshot) => {
      const bList = [];
      snapshot.forEach((docSnap) => {
        bList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setCustomBundles(bList);
    }, (error) => {
      console.error("Task bundles subscription error:", error);
    });

    return () => { unsubscribe(); workersUnsubscribe(); whitelistUnsubscribe(); bundlesUnsubscribe(); };
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
    } catch (e) { console.error("Error saving: ", e); }
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
              <span className="role-badge soldier">🪖 חייל ({workerTeam})</span>
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

      <main className="container">
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
        ) : (activeTab === 'devices' && isSuperAdmin) ? (
          <div className="devices-view">
            {isSuperAdmin && (() => {
              const visibleMembers = Object.keys(KNOWN_TEAM_ROLES).filter(memberName => {
                const mapped = KNOWN_TEAM_ROLES[memberName];
                return activeWorkspaceTeam === 'הכל' ? true : mapped.team === activeWorkspaceTeam;
              });

              const activeCount = visibleMembers.filter(name => whitelistUsers.find(u => u.name === name)?.isActivated || registeredWorkers.some(w => w.name?.trim().toLowerCase() === name.toLowerCase())).length;

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
                      const isAct = dbUser?.isActivated || registeredWorkers.some(w => w.name?.trim().toLowerCase() === memberName.toLowerCase());
                      
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
        ) : (
          <div className="people-view">
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

      {isAdmin && (
        <nav className="bottom-nav">
          <div className={`nav-tab ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
            <i style={{fontSize:'1.3rem'}}>📋</i> <span>משימות</span>
          </div>
          <div className={`nav-tab ${activeTab === 'people' ? 'active' : ''}`} onClick={() => setActiveTab('people')}>
            <i style={{fontSize:'1.3rem'}}>🪖</i> <span>חיילים ושיבוץ</span>
          </div>
          {isSuperAdmin && (
            <div className={`nav-tab ${activeTab === 'devices' ? 'active' : ''}`} onClick={() => setActiveTab('devices')}>
              <i style={{fontSize:'1.3rem'}}>📱</i> <span>חיבורי מכשירים</span>
            </div>
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
