export default function TestApp() {
  return (
    <div style={{ padding: '20px', background: '#1a1a1a', color: 'white', minHeight: '100vh' }}>
      <h1 style={{ color: '#0079F2' }}>✅ React is Working!</h1>
      <p>If you can see this, React and Vite are functioning correctly.</p>
      <p>Time: {new Date().toLocaleString()}</p>
      <button 
        onClick={() => {
          localStorage.clear();
          window.location.href = '/';
        }}
        style={{ 
          padding: '10px 20px', 
          background: '#0079F2', 
          color: 'white', 
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Clear Storage & Reload Main App
      </button>
    </div>
  );
}