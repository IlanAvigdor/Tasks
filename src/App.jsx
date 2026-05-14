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

const SortableTask = ({ task, isAdmin, isSelected, onToggleSelect, onVerify, onDelete, registeredWorkers, onToggleAssignment, onToggleStatus }) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localDesc, setLocalDesc] = useState(task.description || '');
  const [isAssigning, setIsAssigning] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const titleRef = useRef(null);
  const descRef = useRef(null);
  const dropdownRef = useRef(null);
  const containerRef = useRef(null);
  const pointerStartX = useRef(0);

  // Sync local state when DB updates (only when not actively editing)
  useEffect(() => {
    if (!isEditing) {
      setLocalTitle(task.title);
      setLocalDesc(task.description || '');
    }
  }, [task.title, task.description, isEditing]);

  const getStatusClass = () => {
    if (task.isVerified) return 'status-verified';
    if (task.isDone) return 'status-done';
    if (task.isInProgress) return 'status-in-progress';
    if (!task.assignees || task.assignees.length === 0) return 'status-unassigned';
    return 'status-pending';
  };

  const getStatusButton = () => {
    if (isAdmin) {
      if (task.isVerified) {
        return <button className="status-btn btn-reset" onClick={(e) => { e.stopPropagation(); onToggleStatus(task); }}>איפוס</button>;
      }
      if (task.isDone) {
        return <button className="status-btn btn-verify" onClick={(e) => { e.stopPropagation(); onToggleStatus(task); }}>בוצע</button>;
      }
      return null;
    } else {
      if (task.isVerified) return null;
      if (!task.isInProgress && !task.isDone) {
        return <button className="status-btn btn-pending" onClick={(e) => { e.stopPropagation(); onToggleStatus(task); }}>על זה</button>;
      } else if (task.isInProgress) {
        return <button className="status-btn btn-in-progress" onClick={(e) => { e.stopPropagation(); onToggleStatus(task); }}>סיימתי</button>;
      } else if (task.isDone) {
        return <button className="status-btn btn-done" onClick={(e) => { e.stopPropagation(); onToggleStatus(task); }}>איפוס</button>;
      }
    }
    return null;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && !event.target.closest('.add-assignee-btn')) {
        setIsAssigning(false);
      }
    };
    if (isAssigning) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAssigning]);

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
    zIndex: (isDragging || isAssigning) ? 1000 : 1,
    touchAction: isEditing ? 'auto' : 'pan-y'
  };

  const handlePointerDown = (e) => {
    if (!isAdmin || isEditing) return;
    if (e.target.closest('.btn-verify')) return;
    pointerStartX.current = e.clientX;
    setIsSwiping(true);
  };

  const handlePointerMove = (e) => {
    if (!isSwiping || isEditing || isDragging || !isAdmin) return;
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
      className={`task-item ${getStatusClass()} ${isSelected ? 'active-task' : ''} ${isDragging ? 'dragging' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={() => isAdmin && !isEditing && onToggleSelect()}
      {...attributes}
      {...listeners}
    >
      {isAdmin && (
        <div 
          className="delete-swipe-bg" 
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: '80px',
            background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '1.2rem', zIndex: 0,
            transform: `translateX(${80 + swipeOffset}px)`,
            transition: isSwiping ? 'none' : 'transform 0.2s',
            cursor: 'pointer',
            visibility: swipeOffset < -5 ? 'visible' : 'hidden'
          }}
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        >
          🗑️
        </div>
      )}

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
                setIsAssigning(!isAssigning); 
              }}>👤</button>
            )}
            {!task.assignees?.length && !isAdmin && (
              <span style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>ללא שיוך</span>
            )}

            {isAssigning && (
              <div className="assignment-dropdown" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
                <div style={{maxHeight:'200px', overflowY:'auto'}}>
                  {registeredWorkers.map(worker => (
                    <div key={worker.id} className="worker-option" onClick={() => onToggleAssignment(task.id, worker.name)}>
                      <div className={`custom-checkbox ${task.assignees?.includes(worker.name) ? 'checked' : ''}`} style={{width:'18px', height:'18px'}}>
                        {task.assignees?.includes(worker.name) && <span style={{fontSize:'10px'}}>✓</span>}
                      </div>
                      <span>{worker.name} <span className="team-tag">({worker.team})</span></span>
                    </div>
                  ))}
                </div>
                <button className="dropdown-finish-btn" onClick={() => setIsAssigning(false)}>סיום</button>
              </div>
            )}
          </div>
        </div>
        <div className="task-actions" style={{display:'flex', alignItems:'center'}}>
          {getStatusButton()}
          {isAdmin && (
            <button 
              className="delete-task-btn" 
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              style={{background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', padding:'0.5rem', marginRight:'auto'}}
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const WorkerCard = ({ worker, tasks, isAdmin, viewTime, onToggleAssignment }) => {
  const [isAssigning, setIsAssigning] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && !event.target.closest('.add-task-btn')) {
        setIsAssigning(false);
      }
    };
    if (isAssigning) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAssigning]);

  const workerTasks = tasks.filter(t => t.assignees?.includes(worker.name) && (t.timeOfDay === viewTime || (!t.timeOfDay && viewTime === 'morning')));
  const doneCount = workerTasks.filter(t => t.isDone).length;
  const availableTasks = tasks.filter(t => t.timeOfDay === viewTime || (!t.timeOfDay && viewTime === 'morning'));

  return (
    <div className="person-card" style={{ position: 'relative', zIndex: isAssigning ? 1000 : 1 }}>
      <div className="person-header">
        <div className="person-avatar">{worker.name.charAt(0)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>
            {worker.name} <span style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.6 }}>- {worker.team}</span>
          </div>
          <div className="status-badges">
            <span className="status-badge pending">{workerTasks.length - doneCount} בביצוע</span>
            <span className="status-badge done">{doneCount} הושלמו</span>
          </div>
        </div>
        {isAdmin && (
          <button className="add-task-btn" onClick={() => setIsAssigning(!isAssigning)}>📋</button>
        )}
      </div>

      {isAssigning && (
        <div className="assignment-dropdown" ref={dropdownRef} style={{ top: '50px', right: '10px' }}>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {availableTasks.map(task => (
              <div key={task.id} className="worker-option" onClick={() => onToggleAssignment(task.id, worker.name)}>
                <div className={`custom-checkbox ${task.assignees?.includes(worker.name) ? 'checked' : ''}`} style={{ width: '18px', height: '18px' }}>
                  {task.assignees?.includes(worker.name) && <span style={{ fontSize: '10px' }}>✓</span>}
                </div>
                <span>{task.title}</span>
              </div>
            ))}
            {availableTasks.length === 0 && <p style={{ fontSize: '0.8rem', opacity: 0.5, padding: '8px' }}>אין משימות לזמן זה</p>}
          </div>
          <button className="dropdown-finish-btn" onClick={() => setIsAssigning(false)}>סיום</button>
        </div>
      )}

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
        timeOfDay: viewTime, isDone: false, isInProgress: false, isVerified: false,
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

  const toggleStatus = async (task) => {
    if (task.isVerified && !isAdmin) return;
    playNotification();
    let updates = {};
    
    if (isAdmin) {
      if (task.isVerified) {
        updates = { isVerified: false, isDone: false, isInProgress: false };
      } else if (task.isDone) {
        updates = { isVerified: true, isDone: true, isInProgress: false };
      }
    } else {
      if (!task.isInProgress && !task.isDone) {
        updates = { isInProgress: true, isDone: false };
      } else if (task.isInProgress) {
        updates = { isInProgress: false, isDone: true };
      } else {
        updates = { isInProgress: false, isDone: false };
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

  const getFilteredTasks = (time) => {
    const timeFiltered = tasks.filter(t => t.timeOfDay === time || (!t.timeOfDay && time === 'morning'));
    if (isAdmin) return timeFiltered;
    return timeFiltered.filter(t => t.assignees?.includes(userName));
  };

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
          <div className="swipe-viewport" style={{overflow:'hidden', width: '100%'}}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                      <div className="glass-card">
                        <h2 style={{marginBottom:'1rem', fontSize:'1.4rem'}}>
                          {time === 'morning' ? 'משימות בוקר' : time === 'noon' ? 'משימות צהריים' : 'משימות ערב'}
                        </h2>
                        <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                          {filteredTasks.map(task => (
                            <SortableTask key={task.id} task={task} isAdmin={isAdmin}
                              isSelected={selectedTaskId === task.id}
                              onToggleSelect={() => isAdmin ? setSelectedTaskId(selectedTaskId === task.id ? null : task.id) : null}
                            onVerify={verifyTask} onDelete={deleteTask}
                            registeredWorkers={registeredWorkers} onToggleAssignment={toggleAssignment}
                            onToggleStatus={toggleStatus} />
                          ))}
                        </SortableContext>
                        {filteredTasks.length === 0 && <p style={{textAlign:'center', opacity:0.6}}>אין משימות לזמן זה</p>}
                      </div>
                    </section>
                  );
                })}
              </div>
            </DndContext>
          </div>
        ) : (
          <div className="people-view glass-card">
            <h2 style={{marginBottom:'1.5rem'}}>צוות ומשימות - {viewTime === 'morning' ? 'בוקר' : viewTime === 'noon' ? 'צהריים' : 'ערב'}</h2>
            <div className="people-list">
              {registeredWorkers.map(worker => (
                <WorkerCard 
                  key={worker.id} 
                  worker={worker} 
                  tasks={tasks} 
                  isAdmin={isAdmin} 
                  viewTime={viewTime} 
                  onToggleAssignment={toggleAssignment} 
                />
              ))}
              {registeredWorkers.length === 0 && <p>אין עובדים רשומים כרגע</p>}
            </div>
          </div>
        )}
      </main>



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

      {isAdmin && (
        <nav className="bottom-nav">
          <div className={`nav-tab ${activeTab === 'people' ? 'active' : ''}`} onClick={() => setActiveTab('people')}>
            <i style={{fontSize:'1.5rem'}}>👤</i> <span>אנשים</span>
          </div>
          <div className={`nav-tab ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
            <i style={{fontSize:'1.5rem'}}>📋</i> <span>משימות</span>
          </div>
        </nav>
      )}

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
