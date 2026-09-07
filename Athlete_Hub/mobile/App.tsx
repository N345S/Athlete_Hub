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
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
  const [email, setEmail] = useState('testathlete@example.com');
  const [password, setPassword] = useState('Password123!');
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
      Alert.alert('Missing login data', 'Please enter both email and password.');
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
        throw new Error(data?.message || 'Login failed.');
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
      Alert.alert('Login error', error.message || 'Unable to sign in.');
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

        <Text style={styles.helpText}>Student test account: testathlete@example.com</Text>
        <Text style={styles.helpText}>Password: Password123!</Text>
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

  const logout = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.dashboardContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>{String(session.role || 'Role').toUpperCase()} Dashboard</Text>
        <Text style={styles.greeting}>Welcome, {session.firstName || 'User'}!</Text>
        <Text style={styles.subtle}>This dashboard is connected to the ASP.NET backend.</Text>
        <Text style={styles.subtle}>Database access is handled by the backend API, not directly from React Native.</Text>

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

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="StudentDashboard" component={StudentDashboardScreen} />
        <Stack.Screen name="RoleDashboard" component={RoleDashboardScreen} />
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
});
