import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';

interface HealthStatus {
  status: string;
  service: string;
  version: string;
}

export default function App(): React.JSX.Element {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://10.0.2.2:8000/api/v1/health')
      .then((res: Response) => res.json())
      .then((data: HealthStatus) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError('Python FastAPI backend unreachable');
        setLoading(false);
      });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Freelance Book Mobile</Text>
      <Text style={styles.subtitle}>React Native + Expo App</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Backend Status</Text>
        {loading && <ActivityIndicator color="#10b981" />}
        {error && <Text style={styles.errorText}>{error}</Text>}
        {health && (
          <View>
            <Text style={styles.successText}>Connected: {health.service}</Text>
            <Text style={styles.infoText}>Status: {health.status}</Text>
            <Text style={styles.infoText}>Version: {health.version}</Text>
          </View>
        )}
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 24,
  },
  card: {
    width: '100%',
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 12,
  },
  successText: {
    color: '#34d399',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  infoText: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
  },
});
