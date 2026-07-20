import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/app.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'Assistant, sans-serif', color: '#1e293b', direction: 'rtl', marginTop: '3rem' }}>
          <h2>משהו השתבש בטעינת המערכת</h2>
          <p style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.8rem', borderRadius: '8px', display: 'inline-block', maxWidth: '90%' }}>
            {this.state.error?.toString()}
          </p>
          <div style={{ marginTop: '1.5rem' }}>
            <button 
              style={{ padding: '0.8rem 1.5rem', borderRadius: '8px', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
            >
              🔄 איפוס נתונים וטעינה מחדש
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
