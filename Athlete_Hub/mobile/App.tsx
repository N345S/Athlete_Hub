import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LineChart } from 'react-native-chart-kit';

const API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5007' : 'http://localhost:5007';
const SESSION_KEY = 'athleteHubSession';

type Session = {
  email: string;
  role: string;
  token: string;
  userId: number;
  firstName: string;
  lastName: string;
  universityId: string;
};

type RootStackParamList = {
  Login: undefined;
  StudentDashboard: { session: Session };
  RoleDashboard: { session: Session };
  PerformanceEntry: { session: Session; athlete: any };
  PerformanceTrend: { session: Session; athlete: any };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/** A message anyone can understand: no-connection and other technical errors become plain sentences. */
function plainError(error: any, fallback: string): string {
  if (error instanceof TypeError || /network request failed/i.test(error?.message ?? '')) {
    return 'We cannot connect right now. Check your internet connection and try again.';
  }
  if (error instanceof SyntaxError) return fallback;
  return error?.message || fallback;
}

async function getStoredSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch (error) {
    console.log('Session read failed', error);
    return null;
  }
}

function LoginScreen({ navigation }: { navigation: any }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getStoredSession().then((session) => {
      if (session) {
        const role = String(session.role || '').toUpperCase();
        if (role === 'ATHLETE' || role === 'STUDENT') {
          navigation.replace('StudentDashboard', { session });
          return;
        }
        navigation.replace('RoleDashboard', { session });
      }
    });
  }, [navigation]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Email and password needed', 'Please enter your email and your password.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/Auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'You could not be signed in. Please try again.');
      }

      const role = String(data.role || '').toUpperCase();
      const session: Session = {
        email: data.email,
        role: data.role,
        token: data.token,
        userId: data.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        universityId: data.universityId,
      };

      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));

      if (role === 'ATHLETE' || role === 'STUDENT') {
        navigation.replace('StudentDashboard', { session });
      } else {
        navigation.replace('RoleDashboard', { session });
      }
    } catch (error: any) {
      Alert.alert('Could not sign in', plainError(error, 'You could not be signed in. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f7fb" />
      <View style={styles.loginCard}>
        <Text style={styles.brand}>Athlete-Hub</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your portal</Text>

        <TextInput
          style={styles.input}
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function StudentDashboardScreen({ route, navigation }: { route: any; navigation: any }) {
  const { session } = route.params;
  const [profile, setProfile] = useState(session);

  useEffect(() => {
    const loadProfile = async () => {
      const saved = await getStoredSession();
      if (saved) setProfile(saved);
    };
    loadProfile();
  }, []);

  const logout = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.dashboardContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Student-Athlete Dashboard</Text>
        <Text style={styles.greeting}>Welcome, {profile.firstName || 'Athlete'}!</Text>
        <Text style={styles.subtle}>Role: {profile.role || 'ATHLETE'}</Text>
        <Text style={styles.subtle}>University ID: {profile.universityId || 'N/A'}</Text>

        <View style={styles.cardGrid}>
          <View style={styles.statCardPrimary}>
            <Text style={styles.cardLabel}>Current GPA</Text>
            <Text style={styles.cardValue}>1.80</Text>
            <Text style={styles.cardMeta}>Eligible</Text>
          </View>

          <View style={styles.statCardBlue}>
            <Text style={styles.cardLabel}>Enrolled Units</Text>
            <Text style={styles.cardValue}>21</Text>
            <Text style={styles.cardMeta}>6 Subjects</Text>
          </View>

          <View style={styles.statCardGreen}>
            <Text style={styles.cardLabel}>Next Game</Text>
            <Text style={styles.cardValueSmall}>Basketball Practice</Text>
            <Text style={styles.cardMeta}>Apr 7 • 4:00 PM</Text>
          </View>
        </View>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>My Grades</Text>
          <Text style={styles.listItem}>PE 101 - 92.5</Text>
          <Text style={styles.listItem}>Math 205 - 88.0</Text>
          <Text style={styles.listItem}>NSTP 102 - 3.00</Text>
        </View>

        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function RoleDashboardScreen({ route, navigation }: { route: any; navigation: any }) {
  const { session } = route.params;
  const role = String(session.role || '').toUpperCase();

  const logout = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    navigation.replace('Login');
  };

  const isCoachOrDirector = role === 'COACH' || role === 'DIRECTOR';

  return (
    <SafeAreaView style={styles.dashboardContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>{role} Dashboard</Text>
        <Text style={styles.greeting}>Welcome, {session.firstName || 'User'}!</Text>
        <Text style={styles.subtle}>This dashboard is connected to the ASP.NET backend.</Text>
        <Text style={styles.subtle}>Database access is handled by the backend API, not directly from React Native.</Text>

        {isCoachOrDirector && (
          <View style={styles.listCard}>
            <Text style={styles.listTitle}>Performance Tracking</Text>
            <Pressable style={styles.button} onPress={() => Alert.alert('Feature', 'Navigate to athlete list to record performance')}>
              <Text style={styles.buttonText}>Record Athlete Performance</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => Alert.alert('Feature', 'Navigate to athlete list to view trends')}>
              <Text style={styles.secondaryButtonText}>View Performance Trends</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Session Info</Text>
          <Text style={styles.listItem}>Email: {session.email}</Text>
          <Text style={styles.listItem}>Role: {session.role}</Text>
          <Text style={styles.listItem}>University ID: {session.universityId}</Text>
        </View>

        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// Performance Entry Screen - for coaches to record athlete performance
function PerformanceEntryScreen({ route, navigation }: { route: any; navigation: any }) {
  const { session, athlete } = route.params;
  const [dataType, setDataType] = useState('PUSH_UP');
  const [value, setValue] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch available metrics
        const metricsRes = await fetch(`${API_BASE_URL}/api/Performance/metrics`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);

        // Fetch training sessions for the coach
        const sessionsRes = await fetch(`${API_BASE_URL}/api/Training/sessions`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };
    fetchData();
  }, [session.token]);

  const handleSubmit = async () => {
    if (!value.trim()) {
      Alert.alert('Result needed', 'Please enter the result first.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/Performance/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          athleteId: athlete.athleteId,
          metricId: metrics[0]?.metricId || 1,
          recordedValue: Number(value),
          recordedDate: new Date().toISOString().slice(0, 10),
          dataType,
          sessionId: Number(sessionId) || 0,
          notes,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || 'The result could not be saved. Please try again.');

      Alert.alert('Success', 'Performance record saved successfully!');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Could not save', plainError(error, 'The result could not be saved. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.dashboardContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Record Performance</Text>
        <Text style={styles.greeting}>Athlete: {athlete.firstName} {athlete.lastName}</Text>

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Performance Details</Text>

          <Text style={styles.fieldLabel}>Data Type</Text>
          <Picker selectedValue={dataType} onValueChange={setDataType} style={styles.picker}>
            <Picker.Item label="Push-ups" value="PUSH_UP" />
            <Picker.Item label="Balance (seconds)" value="BALANCE" />
            <Picker.Item label="Sprint 10m (seconds)" value="SPRINT_10M" />
            <Picker.Item label="Sprint 40m (seconds)" value="SPRINT_40M" />
            <Picker.Item label="Velocity" value="VELOCITY" />
          </Picker>

          <Text style={styles.fieldLabel}>Value</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter value (e.g., 20)"
            value={value}
            onChangeText={setValue}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Session ID (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter session ID"
            value={sessionId}
            onChangeText={setSessionId}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Optional notes"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save Record'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// Performance Trend Screen - for viewing athlete progress
function PerformanceTrendScreen({ route, navigation }: { route: any; navigation: any }) {
  const { session, athlete } = route.params;
  const [timeRange, setTimeRange] = useState<'overall' | 'monthly' | 'weekly'>('overall');
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTrend = async () => {
      try {
        setLoading(true);
        const result = await fetch(`${API_BASE_URL}/api/Performance/athlete/${athlete.athleteId}/trend?timeRange=${timeRange}`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const data = await result.json();
        if (!result.ok) throw new Error(data?.message || 'The progress chart could not be loaded. Please try again.');
        setChartData(data);
      } catch (err: any) {
        setError(plainError(err, 'The progress chart could not be loaded. Please try again.'));
      } finally {
        setLoading(false);
      }
    };
    fetchTrend();
  }, [athlete.athleteId, session.token, timeRange]);

  if (loading) {
    return (
      <SafeAreaView style={styles.dashboardContainer}>
        <View style={styles.scrollContent}>
          <Text style={styles.heading}>Loading trend data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.dashboardContainer}>
        <View style={styles.scrollContent}>
          <Text style={styles.heading}>Error: {error}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const chartConfig = chartData ? {
    data: chartData,
    width: 350,
    height: 300,
    chartConfig: {
      backgroundColor: '#f5f7fb',
      backgroundGradientFrom: '#f5f7fb',
      backgroundGradientTo: '#f5f7fb',
      color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
    },
    bezier: true,
  } : null;

  return (
    <SafeAreaView style={styles.dashboardContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Performance Trend</Text>
        <Text style={styles.greeting}>{athlete.firstName} {athlete.lastName}</Text>

        <View style={styles.timeRangeButtons}>
          <Pressable style={[styles.timeRangeButton, timeRange === 'overall' && styles.timeRangeButtonActive]} onPress={() => setTimeRange('overall')}>
            <Text style={[styles.timeRangeButtonText, timeRange === 'overall' && styles.timeRangeButtonTextActive]}>Overall</Text>
          </Pressable>
          <Pressable style={[styles.timeRangeButton, timeRange === 'monthly' && styles.timeRangeButtonActive]} onPress={() => setTimeRange('monthly')}>
            <Text style={[styles.timeRangeButtonText, timeRange === 'monthly' && styles.timeRangeButtonTextActive]}>Monthly</Text>
          </Pressable>
          <Pressable style={[styles.timeRangeButton, timeRange === 'weekly' && styles.timeRangeButtonActive]} onPress={() => setTimeRange('weekly')}>
            <Text style={[styles.timeRangeButtonText, timeRange === 'weekly' && styles.timeRangeButtonTextActive]}>Weekly</Text>
          </Pressable>
        </View>

        {chartConfig && <LineChart data={chartConfig.data} width={chartConfig.width} height={chartConfig.height} chartConfig={chartConfig.chartConfig} bezier={chartConfig.bezier} />}

        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="StudentDashboard" component={StudentDashboardScreen} />
        <Stack.Screen name="RoleDashboard" component={RoleDashboardScreen} />
        <Stack.Screen name="PerformanceEntry" component={PerformanceEntryScreen} />
        <Stack.Screen name="PerformanceTrend" component={PerformanceTrendScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#edf3ff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#0e172a',
    shadowOpacity: 0.10,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    marginTop: 12,
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dbe3f0',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 16,
  },
  button: {
    marginTop: 10,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  helpText: {
    color: '#475569',
    marginTop: 12,
    fontSize: 13,
  },
  dashboardContainer: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtle: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 10,
  },
  cardGrid: {
    marginTop: 18,
    gap: 12,
  },
  statCardPrimary: {
    backgroundColor: '#f97316',
    borderRadius: 18,
    padding: 18,
  },
  statCardBlue: {
    backgroundColor: '#2563eb',
    borderRadius: 18,
    padding: 18,
  },
  statCardGreen: {
    backgroundColor: '#16a34a',
    borderRadius: 18,
    padding: 18,
  },
  cardLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    marginTop: 8,
  },
  cardValueSmall: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginTop: 8,
  },
  cardMeta: {
    color: '#e2e8f0',
    fontSize: 13,
    marginTop: 8,
  },
  listCard: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#cbd5e1',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  listItem: {
    fontSize: 15,
    color: '#334155',
    marginBottom: 8,
  },
  logoutButton: {
    marginTop: 24,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#dbe3f0',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 16,
  },
  timeRangeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    marginBottom: 16,
  },
  timeRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  timeRangeButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  timeRangeButtonText: {
    color: '#475569',
    fontWeight: '600',
  },
  timeRangeButtonTextActive: {
    color: '#fff',
  },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '700',
  },
});
