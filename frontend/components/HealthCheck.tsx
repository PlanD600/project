import React, { useEffect, useState } from 'react';

const HealthCheck: React.FC = () => {
  const [status, setStatus] = useState<string>('Checking...');

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setStatus(data.status === 'ok' ? 'Backend is healthy!' : 'Backend error!'))
      .catch(() => setStatus('Backend unreachable!'));
  }, []);

  return <div>Health Check: {status}</div>;
};

export default HealthCheck; 