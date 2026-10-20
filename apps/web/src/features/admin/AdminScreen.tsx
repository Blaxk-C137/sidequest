import { useState } from 'react';
import { AdminGate } from './AdminGate';
import { AdminDashboard } from './AdminDashboard';

export function AdminScreen() {
  const [authenticated, setAuthenticated] = useState(false);
  return authenticated ? (
    <AdminDashboard onSignedOut={() => setAuthenticated(false)} />
  ) : (
    <AdminGate onAuthenticated={() => setAuthenticated(true)} />
  );
}
