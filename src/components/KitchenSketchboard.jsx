import React, { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export default function KitchenSketchboard({ tasks, onBack }) {
  const [rooms, setRooms] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "kitchen_layouts", "current_layout"), (docSnap) => {
      if (docSnap.exists()) {
        setRooms(docSnap.data().rooms || []);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching sketchboard layout:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    try {
      await setDoc(doc(db, "kitchen_layouts", "current_layout"), { rooms });
      setIsEditMode(false);
    } catch (e) {
      console.error("Error saving layout", e);
    }
  };

  const addRoom = () => {
    const newRoom = {
      id: Date.now().toString(),
      name: 'חדר חדש',
      x: 50,
      y: 50,
      width: 150,
      height: 100
    };
    setRooms([...rooms, newRoom]);
  };

  const updateRoomName = (id, newName) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, name: newName } : r));
  };

  const updateRoomPosition = (id, x, y) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, x, y } : r));
  };

  const updateRoomSize = (id, width, height, x, y) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, width, height, x, y } : r));
  };

  const removeRoom = (id) => {
    setRooms(rooms.filter(r => r.id !== id));
  };

  const getRoomBackground = (roomName) => {
    const roomTasks = tasks.filter(t => t.roomName === roomName);
    if (roomTasks.length === 0) return 'rgba(255, 255, 255, 0.1)'; 
    const doneCount = roomTasks.filter(t => t.isDone || t.isVerified).length;
    const percentage = Math.round((doneCount / roomTasks.length) * 100);
    
    if (percentage === 0) return 'rgba(239, 68, 68, 0.4)';
    if (percentage === 100) return 'rgba(16, 185, 129, 0.4)';

    return `linear-gradient(to top, rgba(16, 185, 129, 0.4) ${percentage}%, rgba(239, 68, 68, 0.4) ${percentage}%)`;
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>טוען סקאטצבורד...</div>;

  return (
    <div 
      className="sketchboard-container" 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 9000,
        background: '#0f172a',
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden', 
        overscrollBehavior: 'none',
        touchAction: 'none',
        margin: 0,
        padding: 0
      }}
    >
      <div 
        className="sketchboard-canvas" 
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'relative', 
          overflow: 'hidden', 
          overscrollBehavior: 'none', 
          touchAction: 'none',
          background: 'rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* Top Right Floating Back Button */}
        {onBack && (
          <button 
            className="btn" 
            onClick={onBack} 
            style={{ 
              position: 'absolute', 
              top: '12px', 
              right: '12px', 
              zIndex: 100, 
              padding: '0.4rem 0.9rem', 
              background: 'rgba(15, 23, 42, 0.85)', 
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.25)', 
              color: '#fff',
              fontSize: '0.9rem', 
              fontWeight: 'bold',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              margin: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            🔙 משימות
          </button>
        )}

        {/* Top Center Title Pill */}
        <div 
          style={{ 
            position: 'absolute', 
            top: '12px', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            zIndex: 90, 
            padding: '0.3rem 0.8rem', 
            background: 'rgba(15, 23, 42, 0.6)', 
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.15)', 
            color: 'rgba(255,255,255,0.9)',
            fontSize: '0.85rem', 
            fontWeight: 600,
            borderRadius: '20px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          🗺️ סקאטצבורד מטבח
        </div>

        {/* Bottom Left Floating Actions */}
        <div 
          className="sketchboard-actions"
          style={{ 
            position: 'absolute', 
            bottom: '12px', 
            left: '12px', 
            zIndex: 100, 
            display: 'flex', 
            gap: '0.5rem', 
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          {isEditMode ? (
            <>
              <button className="btn" style={{ background: '#10b981', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', margin: 0 }} onClick={addRoom}>➕ הוסף חדר</button>
              <button className="btn" style={{ background: '#3b82f6', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', margin: 0 }} onClick={handleSave}>💾 שמור פריסה</button>
              <button className="btn" style={{ background: 'rgba(239, 68, 68, 0.85)', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', margin: 0 }} onClick={() => { setIsEditMode(false); setLoading(true); getDoc(doc(db, "kitchen_layouts", "current_layout")).then(d => { if(d.exists()) setRooms(d.data().rooms||[]); setLoading(false); }); }}>ביטול</button>
            </>
          ) : (
            <button 
              className="btn" 
              onClick={() => setIsEditMode(true)}
              style={{ 
                background: 'rgba(15, 23, 42, 0.85)', 
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.25)', 
                color: '#fff', 
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                borderRadius: '8px',
                padding: '0.4rem 0.9rem',
                fontWeight: 'bold',
                fontSize: '0.9rem',
                margin: 0,
                cursor: 'pointer'
              }}
            >
              ✏️ ערוך פריסה
            </button>
          )}
        </div>
        {rooms.map(room => (
          <Rnd
            key={room.id}
            size={{ width: room.width, height: room.height }}
            position={{ x: room.x, y: room.y }}
            onDragStop={(e, d) => updateRoomPosition(room.id, d.x, d.y)}
            onResizeStop={(e, direction, ref, delta, position) => {
              updateRoomSize(room.id, ref.style.width, ref.style.height, position.x, position.y);
            }}
            disableDragging={isEditMode ? false : true}
            enableResizing={isEditMode ? true : false}
            bounds="parent"
            style={{
              pointerEvents: 'auto',
              border: isEditMode ? '2px dashed #9ca3af' : '2px solid rgba(255,255,255,0.2)',
              background: isEditMode ? 'rgba(255,255,255,0.05)' : getRoomBackground(room.name),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'background 0.3s',
              zIndex: isEditMode ? 10 : 1
            }}
          >
            {isEditMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', width: '100%', padding: '0 10px' }}>
                <input 
                  type="text" 
                  value={room.name} 
                  onChange={(e) => updateRoomName(room.id, e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #4b5563', textAlign: 'center', borderRadius: '4px', padding: '4px', width: '100%', fontSize: '0.9rem' }}
                  onMouseDown={(e) => e.stopPropagation()}
                />
                <button 
                  onClick={(e) => { e.stopPropagation(); removeRoom(room.id); }} 
                  style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', opacity: 0.8 }}
                >
                  ✖
                </button>
              </div>
            ) : (
              <>
                <span style={{ fontWeight: 'bold', textShadow: '0 1px 3px rgba(0,0,0,0.8)', fontSize: '1.1rem', textAlign: 'center', padding: '0 8px' }}>
                  {room.name}
                </span>
                <div 
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, cursor: 'pointer', zIndex: 5 }} 
                  onClick={() => setSelectedRoom(room)} 
                />
              </>
            )}
          </Rnd>
        ))}
      </div>

      {selectedRoom && (
        <div className="compact-form-overlay" onClick={() => setSelectedRoom(null)} style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '400px', padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>משימות - {selectedRoom.name}</h3>
              <button onClick={() => setSelectedRoom(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✖</button>
            </div>
            {(() => {
              const roomTasks = tasks.filter(t => t.roomName === selectedRoom.name);
              if (roomTasks.length === 0) return <p style={{ opacity: 0.7, textAlign: 'center', marginTop: '2rem' }}>אין משימות לחדר זה.</p>;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {roomTasks.map(t => (
                    <div key={t.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', borderRight: (t.isDone || t.isVerified) ? '4px solid #10b981' : '4px solid #ef4444' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '1.05rem' }}>{t.title}</div>
                      {t.description && <div style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '8px' }}>{t.description}</div>}
                      <div style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '4px' }}>
                        אחראי: <span style={{ color: t.workerName ? '#fff' : '#fbbf24', fontWeight: t.workerName ? 'bold' : 'normal' }}>{t.workerName || 'לא שובץ'}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: (t.isVerified) ? '#10b981' : t.isDone ? '#3b82f6' : '#ef4444' }}>
                        סטטוס: {(t.isVerified) ? 'מאושר' : t.isDone ? 'בוצע (ממתין לאישור)' : 'לא בוצע'}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
