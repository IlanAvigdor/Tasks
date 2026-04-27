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
    if (!window.confirm('האם לאפס את כל המשימות ליום חדש?')) return;
    try {
      const promises = tasks.map(task => {
        const taskRef = doc(db, "tasks", task.id);
        return updateDoc(taskRef, { isDone: false, isVerified: false });
      });
      await Promise.all(promises);
    } catch (e) {
      console.error("Error resetting tasks: ", e);
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
                <input 
                  className="input-field" 
                  placeholder="תיאור קצר" 
                  value={newTask.description} 
                  onChange={e => setNewTask({...newTask, description: e.target.value})}
                />
                <button className="btn" type="submit">שמור תבנית</button>
              </form>
            </details>
          </section>
        )}

        {sortedAssignees.length === 0 && <p style={{textAlign:'center', color:'var(--text-muted)', marginTop:'2rem'}}>אין משימות במערכת</p>}

        {sortedAssignees.map(assignee => (
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
                  {isAdmin ? (
                    <div style={{position:'relative', marginTop:'8px'}}>
                      <input 
                        list="names-list"
                        className="input-field" 
                        style={{marginBottom:0, padding:'12px', paddingLeft:'40px', fontSize:'1.1rem', background:'rgba(255,255,255,0.05)', color:'var(--text-main)', border:'1px solid var(--glass-border)'}}
                        defaultValue={task.assignee}
                        onBlur={(e) => updateAssignee(task.id, e.target.value)}
                        placeholder="הכנס שם..."
                      />
                      {task.assignee && (
                        <button 
                          onClick={() => updateAssignee(task.id, '')}
                          style={{position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.2rem', padding:'5px'}}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ) : (
                    task.description && <div className="task-desc">{task.description}</div>
                  )}
                </div>

                {isAdmin && (
                  <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                    {!task.isVerified && task.isDone && (
                      <button className="btn-verify" onClick={() => verifyTask(task.id)}>אשר</button>
                    )}
                    <button className="delete-btn" style={{fontSize:'0.8rem'}} onClick={() => deleteTask(task.id)}>🗑️</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        <datalist id="names-list">
          {allNames.map(name => <option key={name} value={name} />)}
        </datalist>
      </main>
    </div>
  );
};

export default App;
