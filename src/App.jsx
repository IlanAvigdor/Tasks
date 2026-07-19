import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
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
  writeBatch
} from "firebase/firestore";
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
const APP_VERSION = '1.02';
const NOTIFICATION_SOUND = `${import.meta.env.BASE_URL}notification.mp3`;

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
            {task.assignees?.length > 0 && task.assignees.map(name => (
              <span key={name} className="assignee-tag">{name}</span>
            ))}
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
        <div className="task-content">
          <div className="task-header-row">
            {isEditing ? (
              <input
                ref={titleRef}
                className="inline-edit-input"
                value={localTitle} onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleBlur} onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="task-title" onClick={(e) => { 
                if (!isAdmin) return;
                e.stopPropagation(); 
                setEditingField('title'); 
                setIsEditing(true); 
              }}>{task.title}</div>
            )}
          </div>
          
          {isEditing ? (
            <textarea
              ref={descRef}
              className="inline-edit-textarea" value={localDesc}
              onChange={(e) => setLocalDesc(e.target.value)}
              onBlur={handleBlur} onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()} placeholder="תיאור..."
            />
          ) : (
            isAdmin ? (
              <div 
                className="task-desc" 
                style={{ minHeight: !task.description ? '1.2rem' : 'auto', cursor: 'text' }}
                onClick={(e) => { e.stopPropagation(); setEditingField('description'); setIsEditing(true); }}
              >
                {task.description || <span style={{opacity: 0.3, fontSize: '0.8rem'}}>לחץ להוספת תיאור...</span>}
              </div>
            ) : (
              task.description && <div className="task-desc">{task.description}</div>
            )
          )}

          <div className="task-assignees-row" style={{position:'relative'}}>
            {task.assignees?.length > 0 && task.assignees.map(name => ( <span key={name} className="assignee-tag">{name}</span> ))}
            {isAdmin && (
              <button className="add-assignee-btn" onClick={(e) => { 
                e.stopPropagation(); 
                onOpenAssignment(task.id); 
              }}>👤</button>
            )}
            {!task.assignees?.length && !isAdmin && (
              <span style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>ללא שיוך</span>
            )}
          </div>
        </div>
        <div className="task-actions" style={{display:'flex', alignItems:'center'}}>
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

const App = () => {
  const [tasks, setTasks] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewTime, setViewTime] = useState('morning');
  const [activeTab, setActiveTab] = useState('tasks');
  const [newTask, setNewTask] = useState({ title: '', description: '', assignee: '' });
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [registeredWorkers, setRegisteredWorkers] = useState([]);
  const [userName, setUserName] = useState(localStorage.getItem('workerName') || '');
  const [workerTeam, setWorkerTeam] = useState(localStorage.getItem('workerTeam') || '');
  const [showWelcomeBack, setShowWelcomeBack] = useState(!!(localStorage.getItem('workerName') && localStorage.getItem('workerTeam')));
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [registrationName, setRegistrationName] = useState(localStorage.getItem('workerName') || '');
  const [registrationTeam, setRegistrationTeam] = useState('');
  const [showNav, setShowNav] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [activeWorkerId, setActiveWorkerId] = useState(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', message: '', action: null });
  const [assignmentModal, setAssignmentModal] = useState({ isOpen: false, type: 'task', targetId: null });
  const [workersLoading, setWorkersLoading] = useState(true);
  const [hideAssigned, setHideAssigned] = useState(false);
  
  const isInitialLoad = useRef(true);
  const prevStates = useRef({});
  const audioRef = useRef(null);
  const swipeStartX = useRef(0);
  const lastScrollY = useRef(0);

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
  }, [viewTime]);

  useEffect(() => {
    if (!loading && !workersLoading && userName && workerTeam) {
      const exists = registeredWorkers.some(w => w.name && w.name.trim().toLowerCase() === userName.trim().toLowerCase());
      if (!exists) {
        addDoc(collection(db, "workers"), {
          name: userName.trim(),
          team: workerTeam,
          createdAt: new Date()
        }).catch(e => console.error("Error auto-registering worker:", e));
      }
    }
  }, [loading, workersLoading, userName, workerTeam, registeredWorkers]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 15 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const playNotification = () => {
    if (isMuted || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(e => console.error('Audio play failed:', e));
  };

  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);
    const params = new URLSearchParams(window.location.search);
    if (window.location.pathname.includes(ADMIN_GUID) || params.get('admin') === '987654') {
      setIsAdmin(true);
    }

    const tasksQuery = query(collection(db, "tasks"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const taskList = [];
      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        const id = change.doc.id;
        
        if (change.type === 'modified' && !isMuted && !isInitialLoad.current) {
          const prevState = prevStates.current[id] || {};
          
          if (isAdmin) {
            // Check 1: All assignees clicked "on it"
            const prevAcceptedCount = prevState.acceptedByCount || 0;
            const currentAcceptedCount = data.acceptedBy?.length || 0;
            const totalAssigneesCount = data.assignees?.length || 0;
            const allAcceptedNow = totalAssigneesCount > 0 && currentAcceptedCount === totalAssigneesCount;
            const wasNotAllAccepted = prevAcceptedCount < totalAssigneesCount;
            
            if (allAcceptedNow && wasNotAllAccepted) {
              playNotification();
            }
            
            // Check 2: Any assignee clicked finished
            if (data.isDone && !prevState.isDone) {
              playNotification();
            }
          } else {
            // Worker triggers: Play notification when task gets verified by admin
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
    });
    
    const workersUnsubscribe = onSnapshot(collection(db, "workers"), (snapshot) => {
      const workersList = [];
      snapshot.forEach((doc) => workersList.push({ id: doc.id, ...doc.data() }));
      setRegisteredWorkers(workersList);
      setWorkersLoading(false);
    });

    return () => { unsubscribe(); workersUnsubscribe(); };
  }, [isAdmin, isMuted]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title) return;
    try {
      await addDoc(collection(db, "tasks"), {
        title: newTask.title, description: newTask.description, assignees: [],
        timeOfDay: viewTime, isDone: false, isInProgress: false, isVerified: false,
        order: tasks.length, createdAt: new Date()
      });
      setNewTask({ title: '', description: '', assignee: '' });
      setIsFormOpen(false);
    } catch (e) { console.error("Error saving: ", e); }
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
    setActiveWorkerId(null);
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
    let timeFiltered = tasks.filter(t => t.timeOfDay === time || (!t.timeOfDay && time === 'morning'));
    if (isAdmin) {
      if (hideAssigned) {
        return timeFiltered.filter(t => !t.assignees || t.assignees.length === 0);
      }
      return timeFiltered;
    }
    return timeFiltered.filter(t => t.assignees?.includes(userName) && !t.isVerified);
  };

  if (loading) return <div className="container" style={{textAlign:'center', marginTop:'4rem'}}>טוען משימות...</div>;

  const uniqueWorkers = [];
  const seenNames = new Set();
  registeredWorkers.forEach(w => {
    if (w.name) {
      const key = w.name.trim().toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        uniqueWorkers.push(w);
      }
    }
  });

  const workersByTeam = uniqueWorkers.reduce((acc, worker) => {
    const teamName = worker.team || 'צוות כללי';
    if (!acc[teamName]) acc[teamName] = [];
    acc[teamName].push(worker);
    return acc;
  }, {});

  return (
    <div className="app-shell">
      
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

      {isAdmin && activeTab === 'tasks' && (
        <div className="filter-bar">
          <button 
            className={`btn-filter ${hideAssigned ? 'active' : ''}`}
            onClick={() => setHideAssigned(!hideAssigned)}
          >
            {hideAssigned ? '👁️ הצג משימות משויכות' : '👁️‍🗨️ הסתר משימות משויכות'}
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
                      {filteredTasks.length === 0 && <p style={{textAlign:'center', opacity:0.6}}>אין משימות לזמן זה</p>}
                    </section>
                  );
                })}
              </div>
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
                      {teamName === 'סוללה' ? '🔋' : teamName === 'אגם' ? '💧' : teamName === 'פלסם' ? '🛡️' : '👥'}
                    </span>
                    <span>{teamName}</span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 'normal', marginRight: '6px' }}>
                      ({workersByTeam[teamName].length} חברים)
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
              {uniqueWorkers.length === 0 && (
                <div className="team-section" style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <p style={{ opacity: 0.6 }}>אין עובדים רשומים כרגע</p>
                </div>
              )}
              <TrashBin isAdmin={isAdmin} onLongPress={handleClearAllWorkers} />
              <DragOverlay dropAnimation={null}>
                {activeWorkerId ? (
                  <WorkerDragPreview 
                    worker={uniqueWorkers.find(w => w.id === activeWorkerId)} 
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
              <h3 style={{marginBottom: '0.5rem', fontSize: '1.1rem'}}>משימה חדשה ({viewTime === 'morning' ? 'בוקר' : viewTime === 'noon' ? 'צהריים' : 'ערב'})</h3>
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
        <nav 
          className="bottom-nav"
          onTouchStart={(e) => {
            swipeStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const diffX = e.changedTouches[0].clientX - swipeStartX.current;
            if (Math.abs(diffX) > 50) {
              if (diffX > 0) {
                // Swipe Right -> tasks tab (left)
                setActiveTab('tasks');
              } else {
                // Swipe Left -> people tab (right)
                setActiveTab('people');
              }
            }
          }}
        >
          <div className={`nav-slider ${activeTab === 'people' ? 'slide-people' : 'slide-tasks'}`} />
          <div className={`nav-tab ${activeTab === 'people' ? 'active' : ''}`} onClick={() => setActiveTab('people')}>
            <i style={{fontSize:'1.5rem'}}>👤</i> <span>אנשים</span>
          </div>
          <div className={`nav-tab ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
            <i style={{fontSize:'1.5rem'}}>📋</i> <span>משימות</span>
          </div>
        </nav>
      )}

      {!isAdmin && showWelcomeBack && (
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

      {!isAdmin && !showWelcomeBack && (!userName || !workerTeam) && (
        <div className="registration-overlay" style={{position:'fixed', inset:0, background:'var(--bg-1)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center'}}>
           <div className="glass-card" style={{width:'90%', maxWidth:'400px', textAlign:'center'}}>
              <h2>{userName ? 'השלמת פרטים' : 'ברוך הבא'}</h2>
              <p>{userName ? 'אנא בחר את הצוות שלך' : 'הכנס את שמך ובחר צוות כדי להתחיל'}</p>
              
              {!userName && (
                <input 
                  className="input-field" 
                  placeholder="השם שלך" 
                  value={registrationName} 
                  onChange={e => setRegistrationName(e.target.value)} 
                />
              )}

              <select 
                className="input-field" 
                value={registrationTeam} 
                onChange={e => setRegistrationTeam(e.target.value)}
              >
                <option value="" disabled>בחר צוות...</option>
                <option value="סוללה">סוללה</option>
                <option value="אגם">אגם</option>
                <option value="פלסם">פלסם</option>
              </select>

              <button className="btn btn-save" style={{width:'100%', marginTop:'1rem'}} onClick={async () => {
                if(registrationName && registrationTeam) {
                  try {
                    await addDoc(collection(db, "workers"), { 
                      name: registrationName, 
                      team: registrationTeam,
                      createdAt: new Date() 
                    });
                    localStorage.setItem('workerName', registrationName);
                    localStorage.setItem('workerTeam', registrationTeam);
                    setUserName(registrationName);
                    setWorkerTeam(registrationTeam);
                  } catch (e) {
                    console.error("Error registering worker:", e);
                  }
                } else {
                  alert('נא למלא את כל הפרטים');
                }
              }}>התחל</button>
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
          registeredWorkers={uniqueWorkers}
          onToggleAssignment={toggleAssignment}
          viewTime={viewTime}
        />
      )}
    </div>
  );
};

export default App;
