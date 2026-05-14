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
const APP_VERSION = '1.05';
const NOTIFICATION_SOUND = `${import.meta.env.BASE_URL}notification.mp3`;

const SortableTask = ({ task, isAdmin, isSelected, onToggleSelect, onVerify, onDelete }) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localDesc, setLocalDesc] = useState(task.description || '');
  const [editingField, setEditingField] = useState(null);
  const titleRef = useRef(null);
  const descRef = useRef(null);
  const pointerStartX = useRef(0);

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

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({id: task.id, disabled: isEditing});

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
    touchAction: isEditing ? 'auto' : 'pan-y'
  };

  const handlePointerDown = (e) => {
    if (isEditing) return;
    if (e.target.closest('.btn-verify')) return;
    pointerStartX.current = e.clientX;
    setIsSwiping(true);
  };

  const handlePointerMove = (e) => {
    if (!isSwiping || isEditing || isDragging) return;
    const currentX = e.clientX;
    const diff = currentX - pointerStartX.current;
    if (Math.abs(diff) > 10) {
       if (diff < 0) setSwipeOffset(Math.max(diff, -80));
       else setSwipeOffset(0);
    }
  };

  const handlePointerUp = () => {
    setIsSwiping(false);
    if (swipeOffset < -40) setSwipeOffset(-80);
    else setSwipeOffset(0);
  };

  const handleBlur = (e) => {
    // If focus is moving to another element within the same task item, don't save/close yet
    if (e.relatedTarget && e.currentTarget.closest('.task-item')?.contains(e.relatedTarget)) {
      return;
    }
    handleSave();
  };

  const handleSave = async () => {
    if (localTitle !== task.title || localDesc !== (task.description || '')) {
      try {
        await updateDoc(doc(db, "tasks", task.id), { title: localTitle, description: localDesc });
      } catch (err) { console.error("Error updating task:", err); }
    }
    setIsEditing(false);
    setEditingField(null);
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
      ref={setNodeRef} 
      style={style} 
      className={`task-item admin-task ${isSelected ? 'active-task' : ''} ${isDragging ? 'dragging' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={() => !isEditing && onToggleSelect()}
      {...attributes}
      {...listeners}
    >
      <div 
        className="delete-swipe-bg" 
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: '80px',
          background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: '1.2rem', zIndex: 0,
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
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s',
        }}
      >
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
              <div className="task-title" onClick={(e) => { e.stopPropagation(); setEditingField('title'); setIsEditing(true); }}>{task.title}</div>
            )}
            {isAdmin && (
              <div className="drag-handle" style={{opacity:0.4, fontSize:'0.8rem'}}>☰</div>
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

          <div className="task-assignees-row">
            {task.assignees?.length > 0 ? (
              task.assignees.map(name => ( <span key={name} className="assignee-tag">{name}</span> ))
            ) : (
              <span style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>ללא שיוך</span>
            )}
          </div>
        </div>
        <div className="task-actions" style={{display:'flex', alignItems:'center'}}>
          {task.isVerified ? (
            <span className="v-mark" style={{fontSize:'1.2rem'}}>V</span>
          ) : (
            task.isDone && isAdmin && (
              <button className="btn-verify" onClick={(e) => { e.stopPropagation(); onVerify(task.id); }}>אשר</button>
            )
          )}
          {!isAdmin && !task.isVerified && (
             <div className={`custom-checkbox ${task.isDone ? 'checked' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
               {task.isDone && <span style={{color:'white', fontSize:'14px'}}>✓</span>}
             </div>
          )}
        </div>
      </div>
    </div>
  );
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
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [registrationName, setRegistrationName] = useState(localStorage.getItem('workerName') || '');
  const [registrationTeam, setRegistrationTeam] = useState('');
  
  const isInitialLoad = useRef(true);
  const prevDoneStatus = useRef({});
  const audioRef = useRef(null);
  const swipeStartX = useRef(0);

  useEffect(() => {
    document.body.className = `theme-${viewTime}`;
  }, [viewTime]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 15 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
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
        if (change.type === 'modified' && isAdmin && !isMuted && !isInitialLoad.current) {
          if (data.isDone && !prevDoneStatus.current[id]) playNotification();
        }
        prevDoneStatus.current[id] = data.isDone;
      });
      snapshot.forEach((doc) => taskList.push({ id: doc.id, ...doc.data() }));
      setTasks(taskList);
      setLoading(false);
      if (isInitialLoad.current) isInitialLoad.current = false;
    });
    
    const workersUnsubscribe = onSnapshot(collection(db, "workers"), (snapshot) => {
      const workersList = [];
      snapshot.forEach((doc) => workersList.push({ id: doc.id, ...doc.data() }));
      setRegisteredWorkers(workersList);
    });

    return () => { unsubscribe(); workersUnsubscribe(); };
  }, [isAdmin, isMuted]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title) return;
    try {
      await addDoc(collection(db, "tasks"), {
        title: newTask.title, description: newTask.description, assignees: [],
        timeOfDay: viewTime, isDone: false, isVerified: false,
        order: tasks.length, createdAt: new Date()
      });
      setNewTask({ title: '', description: '', assignee: '' });
      setIsFormOpen(false);
    } catch (e) { console.error("Error saving: ", e); }
  };

  const handleDragEnd = async (event) => {
    const {active, over} = event;
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

  const toggleDone = async (task) => {
    if (task.isVerified) return;
    try { await updateDoc(doc(db, "tasks", task.id), { isDone: !task.isDone }); } 
    catch (e) { console.error("Error updating: ", e); }
  };

  const verifyTask = async (id) => {
    try { await updateDoc(doc(db, "tasks", id), { isVerified: true, isDone: true }); } 
    catch (e) { console.error("Error verifying: ", e); }
  };

  const deleteTask = async (id) => {
    if (!window.confirm('למחוק את המשימה?')) return;
    try { await deleteDoc(doc(db, "tasks", id)); } 
    catch (e) { console.error("Error deleting: ", e); }
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

  const handleSwipeStart = (e) => { swipeStartX.current = e.touches[0].clientX; };
  const handleSwipeEnd = (e) => {
    const endX = e.changedTouches[0].clientX;
    const diff = swipeStartX.current - endX;
    if (Math.abs(diff) > 50) {
      const times = ['morning', 'noon', 'evening'];
      const currentIndex = times.indexOf(viewTime);
      if (diff > 0 && currentIndex < 2) setViewTime(times[currentIndex + 1]);
      else if (diff < 0 && currentIndex > 0) setViewTime(times[currentIndex - 1]);
    }
  };

  const getFilteredTasks = (time) => tasks.filter(t => t.timeOfDay === time || (!t.timeOfDay && time === 'morning'));

  if (loading) return <div className="container" style={{textAlign:'center', marginTop:'4rem'}}>טוען משימות...</div>;

  return (
    <div className="app-shell" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
      
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

      <main className="container">
        {activeTab === 'tasks' ? (
          <div className="swipe-viewport" style={{overflow:'hidden'}}>
            <div className="swipe-container" style={{transform: `translateX(${viewTime === 'morning' ? '0' : viewTime === 'noon' ? '-33.333%' : '-66.666%'})`}}>
              {['morning', 'noon', 'evening'].map(time => (
                <section key={time} className="swipe-screen">
                  <div className="glass-card">
                    <h2 style={{marginBottom:'1rem', fontSize:'1.4rem'}}>{time === 'morning' ? 'משימות בוקר' : time === 'noon' ? 'משימות צהריים' : 'משימות ערב'}</h2>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={getFilteredTasks(time).map(t => t.id)} strategy={verticalListSortingStrategy}>
                        {getFilteredTasks(time).map(task => (
                          <SortableTask key={task.id} task={task} isAdmin={isAdmin}
                            isSelected={selectedTaskId === task.id}
                            onToggleSelect={() => isAdmin ? setSelectedTaskId(selectedTaskId === task.id ? null : task.id) : toggleDone(task)}
                            onVerify={verifyTask} onDelete={deleteTask} />
                        ))}
                      </SortableContext>
                    </DndContext>
                    {getFilteredTasks(time).length === 0 && <p style={{textAlign:'center', opacity:0.6}}>אין משימות לזמן זה</p>}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="people-view glass-card">
            <h2 style={{marginBottom:'1.5rem'}}>צוות ומשימות - {viewTime === 'morning' ? 'בוקר' : viewTime === 'noon' ? 'צהריים' : 'ערב'}</h2>
            <div className="people-list">
              {registeredWorkers.map(worker => {
                const workerTasks = tasks.filter(t => t.assignees?.includes(worker.name) && (t.timeOfDay === viewTime || (!t.timeOfDay && viewTime === 'morning')));
                const doneCount = workerTasks.filter(t => t.isDone).length;
                return (
                  <div key={worker.id} className="person-card">
                    <div className="person-header">
                      <div className="person-avatar">{worker.name.charAt(0)}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700}}>{worker.name} <span style={{fontSize:'0.8rem', fontWeight:400, opacity:0.6}}>- {worker.team}</span></div>
                        <div className="status-badges">
                          <span className="status-badge pending">{workerTasks.length - doneCount} בביצוע</span>
                          <span className="status-badge done">{doneCount} הושלמו</span>
                        </div>
                      </div>
                    </div>
                    
                    {workerTasks.length > 0 && (
                      <div className="person-tasks">
                        {workerTasks.map(task => (
                          <div key={task.id} className={`worker-task-item ${task.isDone ? 'done' : ''}`}>
                            <div className={`status-dot ${task.isVerified ? 'verified' : task.isDone ? 'done' : 'pending'}`} />
                            <span className="task-mini-title">{task.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {registeredWorkers.length === 0 && <p>אין עובדים רשומים כרגע</p>}
            </div>
          </div>
        )}
      </main>

      {isAdmin && activeTab === 'tasks' && selectedTaskId && (
        <div className="admin-assignment-overlay" style={{position:'fixed', bottom:'80px', left:0, right:0, padding:'1rem', zIndex:500}}>
          <div className="glass-card" style={{padding:'1rem'}}>
            <p style={{fontSize:'0.8rem', marginBottom:'0.5rem'}}>שייך ל:</p>
            <div style={{display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'4px'}}>
              {registeredWorkers.map(w => (
                <div key={w.id} className={`worker-chip ${tasks.find(t=>t.id===selectedTaskId)?.assignees?.includes(w.name) ? 'assigned' : ''}`}
                  onClick={() => toggleAssignment(selectedTaskId, w.name)} style={{whiteSpace:'nowrap'}}>
                  {w.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isAdmin && <button className="add-task-fab" onClick={() => setIsFormOpen(true)}>+</button>}

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

      <nav className="bottom-nav">
        <div className={`nav-tab ${activeTab === 'people' ? 'active' : ''}`} onClick={() => setActiveTab('people')}>
          <i style={{fontSize:'1.5rem'}}>👤</i> <span>אנשים</span>
        </div>
        <div className={`nav-tab ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
          <i style={{fontSize:'1.5rem'}}>📋</i> <span>משימות</span>
        </div>
      </nav>

      {!isAdmin && (!userName || !workerTeam) && (
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
    </div>
  );
};

export default App;
