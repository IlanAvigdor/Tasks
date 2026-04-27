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
    // Check if current URL contains the admin GUID
    if (window.location.pathname.includes(ADMIN_GUID)) {
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
    if (!newTask.title || !newTask.assignee) return;
    try {
      await addDoc(collection(db, "tasks"), {
        title: newTask.title,
        description: newTask.description,
        assignee: newTask.assignee,
        isDone: false,
        isVerified: false,
        createdAt: new Date()
      });
      setNewTask({ title: '', description: '', assignee: '' });
    } catch (e) {
      console.error("Error adding document: ", e);
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

  if (loading) return <div className="container" style={{textAlign:'center', marginTop:'4rem'}}>טוען משימות...</div>;

  return (
    <div>
      <header className="header">
        <h1>מנהל משימות</h1>
        {isAdmin && <span className="status-badge" style={{marginBottom:0, fontSize:'0.7rem', padding:'0.2rem 0.5rem', background:'rgba(99, 102, 241, 0.2)'}}>ניהול</span>}
      </header>

      <main className="container">
        {isAdmin && (
          <section className="admin-controls">
            <h2 style={{fontSize:'1rem', marginBottom:'1rem'}}>הוספת משימה חדשה</h2>
            <form onSubmit={handleAddTask}>
              <input 
                className="input-field" 
                placeholder="שם המשימה" 
                value={newTask.title} 
                onChange={e => setNewTask({...newTask, title: e.target.value})}
              />
              <input 
                className="input-field" 
                placeholder="תיאור (אופציונלי)" 
                value={newTask.description} 
                onChange={e => setNewTask({...newTask, description: e.target.value})}
              />
              <input 
                className="input-field" 
                placeholder="שם האחראי" 
                value={newTask.assignee} 
                onChange={e => setNewTask({...newTask, assignee: e.target.value})}
              />
              <button className="btn" type="submit">הוסף משימה</button>
            </form>
          </section>
        )}

        {sortedAssignees.length === 0 && <p style={{textAlign:'center', color:'var(--text-muted)'}}>אין משימות כרגע</p>}

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
                  {task.description && <div className="task-desc">{task.description}</div>}
                </div>

                {isAdmin && (
                  <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                    {!task.isVerified && task.isDone && (
                      <button className="btn-verify" onClick={() => verifyTask(task.id)}>אשר</button>
                    )}
                    <button className="delete-btn" onClick={() => deleteTask(task.id)}>
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </main>
    </div>
  );
};

export default App;
