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
  setDoc,
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

const getAssigneeColor = (name) => {
  const colors = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#f43f5e', // Rose
    '#0ea5e9', // Sky
    '#8b5cf6', // Violet
    '#f97316', // Orange
    '#ec4899', // Pink
  ];
  if (!name || name === 'ללא שיוך') return '#94a3b8'; // Muted for unassigned
  
  // Simple hash to consistently pick a color for a name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const SortableTask = ({ task, isAdmin, isSelected, onToggleSelect, onVerify, onDelete, onUpdateColor, getTaskStyle }) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localDesc, setLocalDesc] = useState(task.description || '');
  const pointerStartX = useRef(0);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({id: task.id});

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...getTaskStyle(task.color),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
    position: 'relative',
    overflow: 'hidden',
    touchAction: isEditing ? 'auto' : 'pan-y'
  };

  const handlePointerDown = (e) => {
    if (isEditing) return;
    if (e.target.closest('.color-dot') || e.target.closest('.btn-verify')) return;
    pointerStartX.current = e.clientX;
    setIsSwiping(true);
  };

  const handlePointerMove = (e) => {
    if (!isSwiping || isEditing || isDragging) return;
    const currentX = e.clientX;
    const diff = currentX - pointerStartX.current;
    
    if (Math.abs(diff) > 10) {
       if (diff < 0) {
         setSwipeOffset(Math.max(diff, -80));
       } else {
         setSwipeOffset(0);
       }
    }
  };

  const handlePointerUp = () => {
    setIsSwiping(false);
    if (swipeOffset < -40) {
      setSwipeOffset(-80);
    } else {
      setSwipeOffset(0);
    }
  };

  const handleTaskTap = (e) => {
    if (isEditing) return;
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      setIsEditing(true);
    } else {
      onToggleSelect();
    }
    lastTap.current = now;
  };

  const handleSave = async () => {
    if (localTitle !== task.title || localDesc !== (task.description || '')) {
      try {
        await updateDoc(doc(db, "tasks", task.id), {
          title: localTitle,
          description: localDesc
        });
      } catch (err) {
        console.error("Error updating task:", err);
      }
    }
    setIsEditing(false);
  };

  const handleTaskDoubleClick = (e) => {
    if (isEditing) return;
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleTaskClick = (e) => {
    if (isEditing) return;
    // Don't trigger selection if double-clicking (though hard to distinguish without delay)
    // For now, let it select.
    onToggleSelect();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setLocalTitle(task.title);
      setLocalDesc(task.description || '');
      setIsEditing(false);
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`task-item admin-task ${isSelected ? 'active-task' : ''} ${isDragging ? 'dragging' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleTaskClick}
      onDoubleClick={handleTaskDoubleClick}
      {...attributes}
      {...listeners}
    >
      <div 
        className="delete-swipe-bg" 
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '80px',
          background: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '1.2rem',
          zIndex: 0,
          transform: `translateX(${80 + swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s',
          cursor: 'pointer'
        }}
        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
      >
        🗑️
      </div>

      <div 
        className="task-inner-content"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          width: '100%',
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s',
          background: 'inherit',
          zIndex: 1,
          position: 'relative',
          padding: '1rem'
        }}
      >
        <div className="task-content" style={{flex:1, minWidth:0}}>
          <div className="task-header-row">
            {isEditing ? (
              <input
                className="inline-edit-input"
                autoFocus
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--primary)',
                  borderRadius: '4px',
                  color: 'white',
                  padding: '2px 4px',
                  fontSize: '0.95rem',
                  width: '100%',
                  outline: 'none'
                }}
              />
            ) : (
              <div 
                className="task-title" 
                style={{fontSize:'0.95rem', fontWeight:'600'}}
              >
                {task.title}
              </div>
            )}
            <div className="color-dots" style={{display:'flex', gap:'6px'}}>
              {['red', 'yellow', 'green'].map(c => (
                <div
                  key={c}
                  onClick={(e) => { e.stopPropagation(); onUpdateColor(task.id, task.color === c ? '' : c); }}
                  className={`color-dot ${c} ${task.color === c ? 'selected' : ''}`}
                />
              ))}
            </div>
          </div>
          
          {isEditing ? (
            <textarea
              className="inline-edit-textarea"
              value={localDesc}
              onChange={(e) => setLocalDesc(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              placeholder="תיאור..."
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--primary)',
                borderRadius: '4px',
                color: 'var(--text-muted)',
                padding: '2px 4px',
                fontSize: '0.85rem',
                width: '100%',
                marginTop: '4px',
                outline: 'none',
                resize: 'none'
              }}
            />
          ) : (
            (task.description || isEditing) && (
              <div 
                className="task-desc" 
                style={{fontSize:'0.85rem', color:'var(--text-muted)', marginTop:'4px'}}
              >
                {task.description || <span style={{opacity:0.5}}>הוסף תיאור...</span>}
              </div>
            )
          )}

          <div className="task-assignees-row" style={{marginTop:'8px', display:'flex', flexWrap:'wrap', gap:'4px'}}>
            {task.assignees?.length > 0 ? (
              task.assignees.map(name => (
                <span key={name} className="assignee-tag" style={{fontSize:'0.7rem'}}>{name}</span>
              ))
            ) : (
              <span style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>ללא שיוך</span>
            )}
          </div>
        </div>
        <div className="task-actions" style={{display:'flex', alignItems:'center'}}>
          {task.isVerified ? (
            <span className="v-mark" style={{fontSize:'1.2rem'}}>V</span>
          ) : (
            task.isDone && (
              <button className="btn-verify" onClick={(e) => { e.stopPropagation(); onVerify(task.id); }}>אשר</button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

const App = () => {

  const [tasks, setTasks] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignee: '' });
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [registeredWorkers, setRegisteredWorkers] = useState([]);
  const [userName, setUserName] = useState(localStorage.getItem('workerName') || '');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [registrationName, setRegistrationName] = useState('');
  
  const isInitialLoad = useRef(true);
  const prevDoneStatus = useRef({});
  const audioRef = useRef(null);
  const lastTap = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15, // Increase distance to allow for double-clicking without starting drag
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300, // Longer delay for touch to allow for scrolling/tapping
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event) => {
    const {active, over} = event;
    
    if (active && over && active.id !== over.id) {
      setTasks((items) => {
        const oldIndex = items.findIndex((t) => t.id === active.id);
        const newIndex = items.findIndex((t) => t.id === over.id);
        const newTasks = arrayMove(items, oldIndex, newIndex);
        
        // Persist to Firestore
        const batch = writeBatch(db);
        newTasks.forEach((task, index) => {
          batch.update(doc(db, "tasks", task.id), { order: index });
        });
        batch.commit().catch(err => console.error("Error updating order:", err));
        
        return newTasks;
      });
    }
  };

  const handleTaskTap = (task) => {
    setSelectedTaskId(selectedTaskId === task.id ? null : task.id);
  };


  // Initialize audio object once
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);
  }, []);

  const playNotification = () => {
    if (isMuted || !audioRef.current) return;
    console.log('Attempting to play sound...');
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(e => console.error('Audio play failed:', e));
  };

  const testNotification = () => {
    console.log('Manual sound test triggered');
    playNotification();
    alert('הצליל אמור להתנגן כעת. אם לא שמעת כלום, בדוק שהטלפון לא על שקט או שהדפדפן לא חוסם אודיו.');
  };

  useEffect(() => {
    // Check if current URL contains the admin GUID (supports both path and ?admin=)
    const params = new URLSearchParams(window.location.search);
    if (window.location.pathname.includes(ADMIN_GUID) || params.get('admin') === '987654') {
      setIsAdmin(true);
    }

    // "Prime" audio on first click for mobile browsers
    const unlockAudio = () => {
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }).catch(() => {});
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    // Real-time listener for Firestore tasks - sorted by order
    const tasksQuery = query(collection(db, "tasks"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {

      const taskList = [];
      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        const id = change.doc.id;
        if (change.type === 'modified' && isAdmin && !isMuted && !isInitialLoad.current) {
          if (data.isDone && !prevDoneStatus.current[id]) {
            playNotification();
          }
        }
        prevDoneStatus.current[id] = data.isDone;
      });

      snapshot.forEach((doc) => {
        taskList.push({ id: doc.id, ...doc.data() });
      });
      // Fallback sort if order field is missing
      taskList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.title || "").localeCompare(b.title || ""));
      setTasks(taskList);
      setLoading(false);

      if (isInitialLoad.current) isInitialLoad.current = false;
    });
    
    // Listener for workers
    const workersUnsubscribe = onSnapshot(collection(db, "workers"), (snapshot) => {
      const workersList = [];
      snapshot.forEach((doc) => workersList.push({ id: doc.id, ...doc.data() }));
      setRegisteredWorkers(workersList);
    });

    return () => {
      unsubscribe();
      workersUnsubscribe();
    };
  }, [isAdmin, isMuted]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title) return;
    try {
      if (editingTaskId) {
        const taskRef = doc(db, "tasks", editingTaskId);
        await updateDoc(taskRef, {
          title: newTask.title,
          description: newTask.description,
          assignee: newTask.assignee || 'ללא שיוך'
        });
        setEditingTaskId(null);
      } else {
        await addDoc(collection(db, "tasks"), {
          title: newTask.title,
          description: newTask.description,
          assignees: [], // New structure: array of names
          isDone: false,
          isVerified: false,
          color: '',
          order: tasks.length,
          createdAt: new Date()
        });

      }
      setNewTask({ title: '', description: '', assignee: '' });
      setIsFormOpen(false);
    } catch (e) {
      console.error("Error saving document: ", e);
    }
  };

  const startEditing = (task) => {
    setEditingTaskId(task.id);
    setNewTask({
      title: task.title,
      description: task.description || '',
      assignee: task.assignee === 'ללא שיוך' ? '' : (task.assignee || '')
    });
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingTaskId(null);
    setNewTask({ title: '', description: '', assignee: '' });
    setIsFormOpen(false);
  };

  const resetAllTasks = async () => {
    if (!window.confirm('האם לאפס את כל המשימות ליום חדש? (זה ימחק גם את כל השמות)')) return;
    try {
      const promises = tasks.map(task => {
        const taskRef = doc(db, "tasks", task.id);
        return updateDoc(taskRef, { 
          isDone: false, 
          isVerified: false, 
          assignees: [] 
        });
      });
      await Promise.all(promises);

      // Clear workers collection
      const workersSnapshot = await getDocs(collection(db, "workers"));
      const batch = writeBatch(db);
      workersSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

    } catch (e) {
      console.error("Error resetting tasks: ", e);
      alert('שגיאה באיפוס המשימות');
    }
  };

  const registerWorker = async (e) => {
    e.preventDefault();
    if (!registrationName) return;
    try {
      await addDoc(collection(db, "workers"), {
        name: registrationName,
        createdAt: new Date()
      });
      localStorage.setItem('workerName', registrationName);
      setUserName(registrationName);
    } catch (e) {
      console.error("Error registering worker: ", e);
    }
  };

  const toggleAssignment = async (taskId, workerName) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const currentAssignees = task.assignees || [];
    const isAssigned = currentAssignees.includes(workerName);
    
    const newAssignees = isAssigned 
      ? currentAssignees.filter(name => name !== workerName)
      : [...currentAssignees, workerName];

    try {
      await updateDoc(doc(db, "tasks", taskId), { assignees: newAssignees });
    } catch (e) {
      console.error("Error toggling assignment: ", e);
    }
  };

  const updateAssignee = async (id, newName) => {
    try {
      const taskRef = doc(db, "tasks", id);
      await updateDoc(taskRef, { assignee: newName });
    } catch (e) {
      console.error("Error updating assignee: ", e);
    }
  };

  const updateTaskColor = async (id, color) => {
    try {
      const taskRef = doc(db, "tasks", id);
      await updateDoc(taskRef, { color: color });
    } catch (e) {
      console.error("Error updating color: ", e);
    }
  };

  const toggleDone = async (task) => {
    if (task.isVerified) return;
    try {
      const taskRef = doc(db, "tasks", task.id);
      await updateDoc(taskRef, {
        isDone: !task.isDone
      });
    } catch (e) {
      console.error("Error updating document: ", e);
    }
  };

  const verifyTask = async (id) => {
    try {
      const taskRef = doc(db, "tasks", id);
      await updateDoc(taskRef, {
        isVerified: true,
        isDone: true
      });
    } catch (e) {
      console.error("Error verifying document: ", e);
    }
  };

  const deleteTask = async (id) => {
    if (!window.confirm('למחוק את המשימה?')) return;
    try {
      await deleteDoc(doc(db, "tasks", id));
    } catch (e) {
      console.error("Error deleting document: ", e);
    }
  };

  // Prepare data for rendering
  const myTasks = tasks.filter(t => t.assignees?.includes(userName));
  const otherTasks = tasks.filter(t => !t.assignees?.includes(userName));
  
  const allNames = Array.from(new Set(tasks.flatMap(t => t.assignees || []).filter(Boolean)));

  const getTaskStyle = (color) => {
    if (!color) return {};
    const palette = {
      red: 'rgba(239, 68, 68, 0.15)',
      yellow: 'rgba(245, 158, 11, 0.15)',
      green: 'rgba(16, 185, 129, 0.15)'
    };
    const borders = {
      red: '#ef4444',
      yellow: '#f59e0b',
      green: '#10b981'
    };
    return { 
      background: palette[color],
      borderRight: `4px solid ${borders[color]}` // Right border for RTL
    };
  };

  if (loading) return <div className="container" style={{textAlign:'center', marginTop:'4rem'}}>טוען משימות...</div>;

  return (
    <div>
      <header className="header">
        <div style={{display:'flex', alignItems:'baseline', gap:'8px'}}>
          <span style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>v{APP_VERSION}</span>
          <h1>מנהל משימות</h1>
        </div>
        {isAdmin && (
          <div style={{display:'flex', gap:'10px'}}>
            <button onClick={resetAllTasks} className="btn-verify" style={{background:'rgba(16, 185, 129, 0.1)', borderColor:'var(--accent-success)'}}>איפוס יום</button>
            <button onClick={testNotification} className="btn-verify" style={{borderColor:'var(--text-muted)', color:'var(--text-muted)'}}>בדיקת צליל</button>
            <button 
              onClick={() => setIsMuted(!isMuted)} 
              className="mute-btn"
              title={isMuted ? "בטל השתקה" : "השתק התראות"}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>
        )}
      </header>

      <main className="container" style={isAdmin ? {maxWidth:'900px'} : {}}>
        {isAdmin && (
          <section className="admin-header-actions" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', padding:'0 0.5rem'}}>
            <button 
              className="add-task-fab" 
              onClick={() => setIsFormOpen(!isFormOpen)}
              title="הוסף משימה"
            >
              {isFormOpen ? '✕' : '+'}
            </button>
            
            {isFormOpen && (
              <div className="compact-form-overlay">
                <form onSubmit={handleAddTask} className="glass-card compact-form">
                  <h3>{editingTaskId ? 'עריכת משימה' : 'משימה חדשה'}</h3>
                  <input 
                    className="input-field" 
                    placeholder="שם המשימה" 
                    value={newTask.title} 
                    onChange={e => setNewTask({...newTask, title: e.target.value})}
                    autoFocus
                  />
                  <textarea 
                    className="input-field" 
                    placeholder="תיאור" 
                    value={newTask.description} 
                    onChange={e => setNewTask({...newTask, description: e.target.value})}
                    rows={2}
                  />
                  <div style={{display:'flex', gap:'10px'}}>
                    <button className="btn" type="submit">שמור</button>
                    <button className="btn secondary" type="button" onClick={cancelEditing}>ביטול</button>
                  </div>
                </form>
              </div>
            )}
          </section>
        )}

        {!isAdmin && !userName && (
          <div className="registration-overlay">
            <div className="glass-card" style={{padding:'2rem', maxWidth:'400px', margin:'2rem auto'}}>
              <h2>ברוך הבא!</h2>
              <form onSubmit={registerWorker} style={{marginTop:'1.5rem'}}>
                <p style={{fontSize:'1rem', marginBottom:'1rem'}}>אנא הכנס את שמך כדי להתחיל:</p>
                <input 
                  className="input-field" 
                  placeholder="השם שלך" 
                  value={registrationName}
                  onChange={(e) => setRegistrationName(e.target.value)}
                  required
                />
                <button className="btn" type="submit">הירשם למשמרת</button>
              </form>
            </div>
          </div>
        )}

        {isAdmin ? (
          <div className="admin-split-view">
            <div className="tasks-column">
              <h3 className="column-title">משימות ({tasks.length})</h3>
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={tasks.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {tasks.map((task) => (
                    <SortableTask
                      key={task.id}
                      task={task}
                      isAdmin={isAdmin}
                      isSelected={selectedTaskId === task.id}
                      onToggleSelect={() => handleTaskTap(task)}
                      onVerify={verifyTask}
                      onDelete={deleteTask}
                      onUpdateColor={updateTaskColor}
                      getTaskStyle={getTaskStyle}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>


            <div className="workers-column">
              <h3 className="column-title">עובדים ({registeredWorkers.length})</h3>
              <div className="worker-list">
                {registeredWorkers.map(worker => (
                  <div 
                    key={worker.id} 
                    className={`worker-chip ${selectedTaskId && tasks.find(t => t.id === selectedTaskId)?.assignees?.includes(worker.name) ? 'assigned' : ''}`}
                    onClick={() => selectedTaskId && toggleAssignment(selectedTaskId, worker.name)}
                    style={{
                      cursor: selectedTaskId ? 'pointer' : 'default',
                      opacity: selectedTaskId ? 1 : 0.7
                    }}
                  >
                    {worker.name}
                    {selectedTaskId && tasks.find(t => t.id === selectedTaskId)?.assignees?.includes(worker.name) && <span style={{marginRight:'8px'}}>✓</span>}
                  </div>
                ))}
                {registeredWorkers.length === 0 && <div style={{color:'var(--text-muted)', fontSize:'0.9rem'}}>אין עובדים רשומים</div>}
              </div>
            </div>
          </div>
        ) : (
          userName && (
            <div className="worker-view">
              <div className="worker-header">
                <h2>שלום, {userName}</h2>
                <div style={{fontSize:'0.9rem', color:'var(--text-muted)'}}>המשימות שלך להיום:</div>
              </div>
              
              {myTasks.length > 0 ? (
                <div className="group-section">
                  {myTasks.map(task => (
                    <div key={task.id} className="task-item" style={getTaskStyle(task.color)}>
                      <div className="check-wrapper">
                        {task.isVerified ? (
                          <span className="v-mark">V</span>
                        ) : (
                          <div 
                            className={`custom-checkbox ${task.isDone ? 'checked' : ''}`} 
                            onClick={() => toggleDone(task)}
                          >
                            {task.isDone && <span style={{color:'white', fontSize:'14px'}}>✓</span>}
                          </div>
                        )}
                      </div>
                      
                      <div className="task-content">
                        <div className="task-title">{task.title}</div>
                        {task.description && <div className="task-desc">{task.description}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card" style={{padding:'2rem', marginTop:'2rem'}}>
                  <p>אין לך משימות משויכות כרגע.</p>
                  <p style={{fontSize:'0.9rem'}}>חכה שהמנהל ישבץ אותך.</p>
                </div>
              )}
            </div>
          )
        )}
      </main>
    </div>
  );
};

export default App;
