export default function TestApp() {
  return (
    <div style={{ 
      padding: '40px', 
      textAlign: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>✅ React is Working!</h1>
      <p style={{ fontSize: '18px' }}>If you can see this, React is rendering correctly.</p>
      <p style={{ marginTop: '20px' }}>Time: {new Date().toLocaleString()}</p>
      <button 
        onClick={() => {
          localStorage.clear();
          window.location.reload();
        }}
        style={{ 
          padding: '12px 24px', 
          fontSize: '16px',
          background: 'white', 
          color: '#764ba2', 
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          marginTop: '20px'
        }}
      >
        Clear Storage & Reload
      </button>
      <div style={{ marginTop: '40px' }}>
        <h3>Debug Info:</h3>
        <pre style={{ 
          background: 'rgba(0,0,0,0.3)', 
          padding: '20px', 
          borderRadius: '10px',
          textAlign: 'left',
          maxWidth: '600px',
          margin: '20px auto'
        }}>
{`Browser: ${navigator.userAgent.substring(0, 50)}...
LocalStorage: ${typeof(Storage) !== "undefined" ? '✅ Available' : '❌ Not Available'}
Fetch API: ${typeof(fetch) !== "undefined" ? '✅ Available' : '❌ Not Available'}
Location: ${window.location.href}`}
        </pre>
      </div>
    </div>
  );
}