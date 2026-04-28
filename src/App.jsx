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
  orderBy 
} from "firebase/firestore";

const ADMIN_GUID = 'admin-987654';
const APP_VERSION = '1.01';
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

    // Real-time listener for Firestore
    const q = query(collection(db, "tasks"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = [];
      
      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        const id = change.doc.id;
        
        // Play sound if task was marked done (only if not initial load and user is admin)
        if (change.type === 'modified' && isAdmin && !isMuted && !isInitialLoad.current) {
          if (data.isDone && !prevDoneStatus.current[id]) {
            console.log(`Task "${data.title}" marked as done! Playing alert.`);
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
      
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
      }
    });

    return () => unsubscribe();
  }, [isAdmin, isMuted]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title) return;
    try {
      await addDoc(collection(db, "tasks"), {
        title: newTask.title,
        description: newTask.description,
        assignee: newTask.assignee || 'ללא שיוך',
        isDone: false,
        isVerified: false,
        color: '',
        createdAt: new Date()
      });
      setNewTask({ title: '', description: '', assignee: '' });
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  const resetAllTasks = async () => {
    if (!window.confirm('האם לאפס את כל המשימות ליום חדש? (זה ימחק גם את כל השמות)')) return;
    try {
      const promises = tasks.map(task => {
        const taskRef = doc(db, "tasks", task.id);
        return updateDoc(taskRef, { 
          isDone: false, 
          isVerified: false, 
          assignee: '' 
        });
      });
      await Promise.all(promises);
    } catch (e) {
      console.error("Error resetting tasks: ", e);
      alert('שגיאה באיפוס המשימות');
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

  // Group and sort tasks by assignee
  const groupedTasks = tasks.reduce((acc, task) => {
    const assignee = task.assignee || 'ללא שיוך';
    if (!acc[assignee]) acc[assignee] = [];
    acc[assignee].push(task);
    return acc;
  }, {});

  const sortedAssignees = Object.keys(groupedTasks).sort();
  const allNames = Array.from(new Set(tasks.map(t => t.assignee).filter(Boolean)));

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
          <h1>מנהל משימות</h1>
          <span style={{fontSize:'0.7rem', opacity:0.5}}>v{APP_VERSION}</span>
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
            <span className="status-badge" style={{marginBottom:0, fontSize:'0.7rem', padding:'0.4rem 0.6rem', background:'rgba(99, 102, 241, 0.2)'}}>ניהול</span>
          </div>
        )}
      </header>

      <main className="container">
        {isAdmin && (
          <section className="admin-controls" style={{padding:'0.75rem'}}>
            <details>
              <summary style={{cursor:'pointer', fontSize:'0.9rem', color: 'var(--primary)'}}>+ הוסף תבנית משימה חדשה</summary>
              <form onSubmit={handleAddTask} style={{marginTop:'1rem'}}>
                <input 
                  className="input-field" 
                  placeholder="שם המשימה (למשל: בדיקת מלאי)" 
                  value={newTask.title} 
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                />
                <textarea 
                  className="input-field" 
                  placeholder="תיאור המשימה" 
                  value={newTask.description} 
                  onChange={e => setNewTask({...newTask, description: e.target.value})}
                  rows={3}
                />
                <button className="btn" type="submit">שמור תבנית</button>
              </form>
            </details>
          </section>
        )}

        {isAdmin ? (
          // STABLE SPEED-ASSIGN MODE for ADMIN
          <div className="group-section">
            {tasks.sort((a,b) => a.title.localeCompare(b.title)).map((task, index) => (
              <div key={task.id} className="task-item" style={getTaskStyle(task.color)}>
                <div className="task-content">
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px'}}>
                    <div className="task-title" style={{fontSize:'0.9rem', marginBottom:0}}>{task.title}</div>
                    <div style={{display:'flex', gap:'12px'}}>
                      {['red', 'yellow', 'green'].map(c => (
                        <button
                          key={c}
                          onClick={() => updateTaskColor(task.id, task.color === c ? '' : c)}
                          style={{
                            width:'20px', 
                            height:'20px', 
                            borderRadius:'50%', 
                            background: c === 'red' ? '#ef4444' : c === 'yellow' ? '#f59e0b' : '#10b981',
                            border: task.color === c ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                            cursor:'pointer',
                            padding:0,
                            boxShadow: task.color === c ? '0 0 8px rgba(255,255,255,0.4)' : 'none'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div style={{position:'relative', marginTop:'4px'}}>
                    <input 
                      id={`assignee-${index}`}
                      key={task.id + task.assignee}
                      list="names-list"
                      className="input-field" 
                      style={{marginBottom:0, padding:'10px', paddingLeft:'40px', fontSize:'1rem', background:'rgba(255,255,255,0.05)', color:'var(--text-main)', border:'1px solid var(--glass-border)'}}
                      defaultValue={task.assignee}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateAssignee(task.id, e.target.value);
                          // Focus the NEXT input for rapid-fire assignment
                          const nextInput = document.getElementById(`assignee-${index + 1}`);
                          if (nextInput) nextInput.focus();
                        }
                      }}
                      onFocus={(e) => { if (e.target.value === 'ללא שיוך') e.target.value = ''; }}
                      onBlur={(e) => updateAssignee(task.id, e.target.value)}
                      placeholder="הכנס שם..."
                    />
                    {task.assignee && task.assignee !== 'ללא שיוך' && (
                      <button 
                        onClick={() => updateAssignee(task.id, '')}
                        style={{position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.2rem'}}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                    {task.isVerified ? (
                      <span className="v-mark" style={{fontSize:'1.2rem'}}>V</span>
                    ) : (
                      task.isDone && (
                        <button className="btn-verify" onClick={() => verifyTask(task.id)}>אשר</button>
                      )
                    )}
                    <button className="delete-btn" style={{fontSize:'0.8rem'}} onClick={() => deleteTask(task.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // GROUPED MODE for WORKERS
          sortedAssignees.map(assignee => (
            <div key={assignee} className="group-section">
              <h2 
                className="group-title" 
                style={{ 
                  color: getAssigneeColor(assignee),
                  borderColor: getAssigneeColor(assignee)
                }}
              >
                {assignee}
              </h2>
              {groupedTasks[assignee].map(task => (
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
          ))
        )}

        <datalist id="names-list">
          {allNames.map(name => <option key={name} value={name} />)}
        </datalist>
      </main>
    </div>
  );
};

export default App;
