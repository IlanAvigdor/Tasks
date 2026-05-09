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

    // Real-time listener for Firestore tasks
    const tasksQuery = query(collection(db, "tasks"));
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
              {tasks.sort((a,b) => a.title.localeCompare(b.title)).map((task) => (
                <div 
                  key={task.id} 
                  className={`task-item admin-task ${selectedTaskId === task.id ? 'active-task' : ''}`} 
                  onClick={() => setSelectedTaskId(selectedTaskId === task.id ? null : task.id)}
                  style={{...getTaskStyle(task.color), cursor:'pointer'}}
                >
                  <div className="task-content">
                    <div className="task-header-row">
                      <div className="task-title" style={{fontSize:'0.95rem'}}>{task.title}</div>
                      <div className="color-dots">
                        {['red', 'yellow', 'green'].map(c => (
                          <div
                            key={c}
                            onClick={(e) => { e.stopPropagation(); updateTaskColor(task.id, task.color === c ? '' : c); }}
                            className={`color-dot ${c} ${task.color === c ? 'selected' : ''}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="task-assignees-row">
                      {task.assignees?.length > 0 ? (
                        task.assignees.map(name => (
                          <span key={name} className="assignee-tag">{name}</span>
                        ))
                      ) : (
                        <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>ללא שיוך</span>
                      )}
                    </div>
                  </div>
                  <div className="task-actions">
                    {task.isVerified ? (
                      <span className="v-mark">V</span>
                    ) : (
                      task.isDone && (
                        <button className="btn-verify" onClick={(e) => { e.stopPropagation(); verifyTask(task.id); }}>אשר</button>
                      )
                    )}
                    <button className="edit-btn" onClick={(e) => { e.stopPropagation(); startEditing(task); }}>✏️</button>
                    <button className="delete-btn" onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}>🗑️</button>
                  </div>
                </div>
              ))}
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
