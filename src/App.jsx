import React, { useState, useEffect } from 'react';
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

const App = () => {
  const [tasks, setTasks] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignee: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if current URL contains the admin GUID (supports both path and ?admin=)
    const params = new URLSearchParams(window.location.search);
    if (window.location.pathname.includes(ADMIN_GUID) || params.get('admin') === '987654') {
      setIsAdmin(true);
    }

    // Real-time listener for Firestore
    const q = query(collection(db, "tasks"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const taskList = [];
      querySnapshot.forEach((doc) => {
        taskList.push({ id: doc.id, ...doc.data() });
      });
      setTasks(taskList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

  if (loading) return <div className="container" style={{textAlign:'center', marginTop:'4rem'}}>טוען משימות...</div>;

  return (
    <div>
      <header className="header">
        <h1>מנהל משימות</h1>
        {isAdmin && (
          <div style={{display:'flex', gap:'10px'}}>
            <button onClick={resetAllTasks} className="btn-verify" style={{background:'rgba(16, 185, 129, 0.1)', borderColor:'var(--accent-success)'}}>איפוס יום</button>
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
              <div key={task.id} className="task-item">
                <div className="task-content">
                  <div className="task-title" style={{fontSize:'0.9rem'}}>{task.title}</div>
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
              <h2 className="group-title">{assignee}</h2>
              {groupedTasks[assignee].map(task => (
                <div key={task.id} className="task-item">
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
