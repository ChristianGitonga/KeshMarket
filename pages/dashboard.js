export default function Dashboard() {
  return (
    <div style={styles.container}>
      <h1>Welcome to KeshMarket Dashboard</h1>
      <p>This is a placeholder for the main dashboard.</p>
      <p>Features coming soon:</p>
      <ul>
        <li>View active markets</li>
        <li>Create new predictions</li>
        <li>Track your bets</li>
        <li>View results</li>
      </ul>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: '40px',
    background: '#f5f5f5',
    fontFamily: 'Arial, sans-serif'
  }
};