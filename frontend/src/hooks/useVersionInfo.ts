import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../constants';

interface VersionInfo {
  version: string;
  git_commit: string;
  build_time: string;
  go_version: string;
}

/**
 * 获取应用版本信息的 Hook
 */
export function useVersionInfo() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/version`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setVersionInfo(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchVersion();
  }, []);

  return { versionInfo, loading, error };
}
