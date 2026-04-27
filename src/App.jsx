import React, { useState, useEffect } from 'react';

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
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    }
  };

  const saveTasks = async (updatedTasks) => {
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTasks)
      });
      setTasks(updatedTasks);
    } catch (err) {
      console.error('Failed to save tasks', err);
    }
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTask.title || !newTask.assignee) return;
    const task = {
      id: Date.now().toString(),
      ...newTask,
      isDone: false,
      isVerified: false
    };
    saveTasks([...tasks, task]);
    setNewTask({ title: '', description: '', assignee: '' });
  };

  const toggleDone = (id) => {
    const updated = tasks.map(t => {
      if (t.id === id && !t.isVerified) {
        return { ...t, isDone: !t.isDone };
      }
      return t;
    });
    saveTasks(updated);
  };

  const verifyTask = (id) => {
    const updated = tasks.map(t => {
      if (t.id === id) {
        return { ...t, isVerified: true, isDone: true };
      }
      return t;
    });
    saveTasks(updated);
  };

  const deleteTask = (id) => {
    const updated = tasks.filter(t => t.id !== id);
    saveTasks(updated);
  };

  // Group and sort tasks by assignee
  const groupedTasks = tasks.reduce((acc, task) => {
    if (!acc[task.assignee]) acc[task.assignee] = [];
    acc[task.assignee].push(task);
    return acc;
  }, {});

  const sortedAssignees = Object.keys(groupedTasks).sort();

  if (loading) return <div className="container" style={{textAlign:'center', marginTop:'4rem'}}>טוען...</div>;

  return (
    <div>
      <header className="header">
        <h1>מנהל משימות</h1>
        {isAdmin && <span className="status-badge" style={{marginBottom:0, fontSize:'0.7rem', padding:'0.2rem 0.5rem'}}>ניהול</span>}
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
                      onClick={() => toggleDone(task.id)}
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
