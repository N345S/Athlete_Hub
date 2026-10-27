import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Alert,
  Dimensions,
  Pressable,
  RefreshControl,
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
import {
  apiRequest,
  formatDate,
  formatTimeRange,
  localDateISO,
  setUnauthorizedHandler,
  useApiData,
} from './api';

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

type Athlete = { athleteId: number; firstName: string; lastName: string; teamId?: number };

type RootStackParamList = {
  Login: undefined;
  StudentDashboard: { session: Session };
  RoleDashboard: { session: Session };
  PerformanceEntry: { session: Session; athlete: Athlete };
  PerformanceTrend: { session: Session; athlete: Athlete };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// An expired or revoked token sends the user back to sign in, once, whichever request noticed it.
setUnauthorizedHandler(() => {
  if (!navigationRef.isReady() || navigationRef.getCurrentRoute()?.name === 'Login') return;
  AsyncStorage.removeItem(SESSION_KEY).finally(() => {
    navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
    Alert.alert('Signed out', 'You have been signed out. Please sign in again.');
  });
});

type DataSource = { loading: boolean; error: string; reload: () => Promise<void> };

const isStudentRole = (role?: string) => ['ATHLETE', 'STUDENT'].includes(String(role || '').toUpperCase());
const fullName = (person: { firstName?: string; lastName?: string }) => `${person.firstName || ''} ${person.lastName || ''}`.trim();
const readable = (value?: string | null) => String(value || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

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
      if (session) navigation.replace(isStudentRole(session.role) ? 'StudentDashboard' : 'RoleDashboard', { session });
    });
  }, [navigation]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Email and password needed', 'Please enter your email and your password.');
      return;
    }

    setLoading(true);

    try {
      const data = await apiRequest('/api/Auth/login', {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), password },
      });

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
      navigation.replace(isStudentRole(session.role) ? 'StudentDashboard' : 'RoleDashboard', { session });
    } catch (error: any) {
      Alert.alert('Could not sign in', error?.message || 'You could not be signed in. Please try again.');
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

/** Scrollable dashboard page: pull down to reload every data source, errors shown at the top, log out at the bottom. */
function DashboardShell({ title, subtitle, sources, navigation, children }: {
  title: string;
  subtitle?: string;
  sources: DataSource[];
  navigation: any;
  children: React.ReactNode;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const errors = [...new Set(sources.map((source) => source.error).filter(Boolean))];

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all(sources.map((source) => source.reload()));
    setRefreshing(false);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.dashboardContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Text style={styles.heading}>{title}</Text>
        {subtitle ? <Text style={styles.subtle}>{subtitle}</Text> : null}
        {errors.map((error) => <Text key={error} style={styles.errorText}>{error}</Text>)}
        {children}
        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, meta, style }: { label: string; value: string | number; meta?: string; style: object }) {
  return (
    <View style={style}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={String(value).length > 8 ? styles.cardValueSmall : styles.cardValue}>{value}</Text>
      {meta ? <Text style={styles.cardMeta}>{meta}</Text> : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.listCard}>
      <Text style={styles.listTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** Loading text while the first load runs, the empty message when nothing came back, otherwise the rows. */
function ListBody({ loading, empty, emptyText, children }: { loading: boolean; empty: boolean; emptyText: string; children: React.ReactNode }) {
  if (empty) return <Text style={styles.emptyText}>{loading ? 'Loading...' : emptyText}</Text>;
  return <>{children}</>;
}

function UpdatesSection({ updates }: { updates: ReturnType<typeof useApiData<any[]>> }) {
  const items = (updates.data || []).slice(0, 5);
  return (
    <Section title="Latest updates">
      <ListBody loading={updates.loading} empty={!items.length} emptyText="No updates yet.">
        {items.map((item) => (
          <View key={item.notificationId} style={styles.row}>
            <Text style={[styles.rowTitle, !item.isRead && styles.unread]}>{item.title}</Text>
            <Text style={styles.rowMeta}>{item.message}</Text>
            <Text style={styles.rowSmall}>{formatDate(item.createdAt)}</Text>
          </View>
        ))}
      </ListBody>
    </Section>
  );
}

function StudentDashboardScreen({ route, navigation }: { route: any; navigation: any }) {
  const { session } = route.params as { session: Session };
  const today = localDateISO();
  const profile = useApiData('/api/AthleteProfile/me', session.token);
  const schedule = useApiData<any[]>(`/api/Schedules/athlete?from=${today}`, session.token, []);
  const evaluations = useApiData('/api/CoachEvaluations/me', session.token);
  const portfolio = useApiData<any[]>('/api/Portfolio/me', session.token, []);
  const documents = useApiData<any[]>('/api/Documents/me', session.token, []);
  const updates = useApiData<any[]>('/api/Notifications/me', session.token, []);

  const nextEvents = [...(schedule.data || [])]
    .filter((item) => item.startDate >= today)
    .sort((a, b) => `${a.startDate}${a.startTime || ''}`.localeCompare(`${b.startDate}${b.startTime || ''}`));
  const nextTraining = nextEvents.find((item) => item.type === 'TRAINING' && !item.cancelled);
  const pendingEvaluations = (evaluations.data?.evaluations || []).filter((item: any) => item.status === 'PENDING');
  const verified = (portfolio.data || []).filter((item) => ['VERIFIED', 'APPROVED'].includes(String(item.achievementStatus || item.verificationStatus).toUpperCase())).length;
  const clearanceDocuments = (documents.data || []).filter((item) => item.documentType !== 'Achievement Evidence');
  const hasMedicalClearance = clearanceDocuments.some((item) => item.documentType === 'Medical Clearance');
  const me = profile.data;

  return (
    <DashboardShell
      title="Student-Athlete Dashboard"
      subtitle={me ? [me.course, me.yearLevel && `Year ${me.yearLevel}`, me.studentNumber].filter(Boolean).join(' · ') : undefined}
      sources={[profile, schedule, evaluations, portfolio, documents, updates]}
      navigation={navigation}
    >
      <Text style={styles.greeting}>Welcome, {me?.firstName || session.firstName || 'Athlete'}!</Text>

      <View style={styles.cardGrid}>
        <StatCard
          style={styles.statCardGreen}
          label="Next training"
          value={nextTraining ? formatDate(nextTraining.startDate) : '—'}
          meta={nextTraining ? `${nextTraining.title} · ${formatTimeRange(nextTraining.startTime)}` : 'No upcoming session'}
        />
        <StatCard
          style={styles.statCardPrimary}
          label="Coach evaluation"
          value={pendingEvaluations.length ? `${pendingEvaluations.length} to do` : 'All done'}
          meta={pendingEvaluations.length ? 'Please answer it on the Athlete-Hub website' : 'Nothing to answer right now'}
        />
        <StatCard style={styles.statCardBlue} label="Verified achievements" value={verified} meta={`${(portfolio.data || []).length} submitted`} />
        <StatCard
          style={styles.statCardSlate}
          label="Documents on file"
          value={clearanceDocuments.length}
          meta={hasMedicalClearance ? 'Medical clearance uploaded' : 'Medical clearance not uploaded yet'}
        />
      </View>

      <Pressable
        style={[styles.button, !me && styles.buttonDisabled]}
        disabled={!me}
        onPress={() => navigation.navigate('PerformanceTrend', { session, athlete: { athleteId: me.athleteId, firstName: me.firstName, lastName: me.lastName } })}
      >
        <Text style={styles.buttonText}>My performance</Text>
      </Pressable>

      <Section title="Coming up">
        <ListBody loading={schedule.loading} empty={!nextEvents.length} emptyText="Nothing scheduled. Approved training and events will appear here.">
          {nextEvents.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.rowTitle}>{item.title}{item.cancelled ? ' (cancelled)' : ''}</Text>
              <Text style={styles.rowMeta}>{formatDate(item.startDate)} · {formatTimeRange(item.startTime, item.endTime)}</Text>
              <Text style={styles.rowSmall}>{item.location || 'Location TBA'}{item.teamName ? ` · ${item.teamName}` : ''} · {readable(item.type)}</Text>
              {item.cancellationReason ? <Text style={styles.errorSmall}>Cancelled: {item.cancellationReason}</Text> : null}
            </View>
          ))}
        </ListBody>
      </Section>

      <UpdatesSection updates={updates} />
    </DashboardShell>
  );
}

function RoleDashboardScreen({ route, navigation }: { route: any; navigation: any }) {
  const { session } = route.params as { session: Session };
  const role = String(session.role || '').toUpperCase();
  if (role === 'COACH') return <CoachDashboard session={session} navigation={navigation} />;
  if (role === 'DIRECTOR') return <DirectorDashboard session={session} navigation={navigation} />;
  if (role === 'PARENT') return <ParentDashboard session={session} navigation={navigation} />;
  return <GeneralDashboard session={session} navigation={navigation} />;
}

function AthleteRow({ athlete, detail, onRecord, onProgress }: { athlete: any; detail: string; onRecord?: () => void; onProgress: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{fullName(athlete)}</Text>
      <Text style={styles.rowMeta}>{detail}</Text>
      <View style={styles.rowActions}>
        {onRecord && (
          <Pressable style={styles.smallButton} onPress={onRecord}>
            <Text style={styles.smallButtonText}>Record result</Text>
          </Pressable>
        )}
        <Pressable style={styles.smallButtonOutline} onPress={onProgress}>
          <Text style={styles.smallButtonOutlineText}>Progress</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CoachDashboard({ session, navigation }: { session: Session; navigation: any }) {
  const dashboard = useApiData('/api/CoachDashboard', session.token);
  const updates = useApiData<any[]>('/api/Notifications/me', session.token, []);
  const data = dashboard.data;
  const sessions = data?.upcomingSessions || [];
  const teams = data?.teams || [];

  const toAthlete = (athlete: any, teamId: number): Athlete => ({ athleteId: athlete.athleteId, firstName: athlete.firstName, lastName: athlete.lastName, teamId });

  return (
    <DashboardShell title="Coach Dashboard" subtitle={`Welcome, ${session.firstName || 'Coach'}!`} sources={[dashboard, updates]} navigation={navigation}>
      {data?.message ? <Text style={styles.subtle}>{data.message}</Text> : null}
      <View style={styles.cardGrid}>
        <StatCard style={styles.statCardBlue} label="Teams" value={data ? data.teamCount : '—'} />
        <StatCard style={styles.statCardGreen} label="Athletes" value={data ? data.athleteCount : '—'} />
      </View>

      <Section title="Upcoming training">
        <ListBody loading={dashboard.loading} empty={!sessions.length} emptyText="No upcoming training.">
          {sessions.map((item: any) => (
            <View key={item.trainingSessionId} style={styles.row}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowMeta}>{formatDate(item.trainingDate)} · {formatTimeRange(item.startTime, item.endTime)}</Text>
              <Text style={styles.rowSmall}>{item.location || 'Location TBA'} · {readable(item.approvalStatus || 'APPROVED')}</Text>
            </View>
          ))}
        </ListBody>
      </Section>

      {teams.map((team: any) => (
        <Section key={team.teamId} title={`${team.teamName} · ${team.sport}`}>
          <ListBody loading={false} empty={!team.athletes.length} emptyText="No athletes on this team yet.">
            {team.athletes.map((athlete: any) => (
              <AthleteRow
                key={athlete.athleteId}
                athlete={athlete}
                detail={[athlete.course, athlete.attendanceRate != null && `Attendance ${athlete.attendanceRate}%`].filter(Boolean).join(' · ') || athlete.studentNumber}
                onRecord={() => navigation.navigate('PerformanceEntry', { session, athlete: toAthlete(athlete, team.teamId) })}
                onProgress={() => navigation.navigate('PerformanceTrend', { session, athlete: toAthlete(athlete, team.teamId) })}
              />
            ))}
          </ListBody>
        </Section>
      ))}

      <UpdatesSection updates={updates} />
    </DashboardShell>
  );
}

function DirectorDashboard({ session, navigation }: { session: Session; navigation: any }) {
  const dashboard = useApiData('/api/DirectorDashboard', session.token);
  const pending = useApiData<any[]>('/api/Training/pending', session.token, []);
  const [search, setSearch] = useState('');
  const athletes: any[] = dashboard.data?.athletes || [];
  const query = search.trim().toLowerCase();
  const shown = athletes
    .filter((athlete) => !query || `${fullName(athlete)} ${athlete.studentNumber || ''}`.toLowerCase().includes(query))
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));

  return (
    <DashboardShell title="Director Dashboard" subtitle={`Welcome, ${session.firstName || 'Director'}!`} sources={[dashboard, pending]} navigation={navigation}>
      <View style={styles.cardGrid}>
        <StatCard style={styles.statCardBlue} label="Student-athletes" value={dashboard.data ? dashboard.data.athleteCount : '—'} />
        <StatCard style={styles.statCardPrimary} label="Training to approve" value={pending.data?.length ?? '—'} meta="Approve them on the Athlete-Hub website" />
      </View>

      <Section title="Student-athletes">
        <TextInput style={styles.input} placeholder="Search by name or student number" value={search} onChangeText={setSearch} autoCapitalize="none" />
        <ListBody loading={dashboard.loading} empty={!shown.length} emptyText={query ? 'No one matches that search.' : 'No student-athletes yet.'}>
          {shown.slice(0, 30).map((athlete) => (
            <AthleteRow
              key={athlete.athleteId}
              athlete={athlete}
              detail={[athlete.teams?.map((team: any) => team.teamName).join(', ') || 'No team', athlete.attendanceRate != null && `Attendance ${athlete.attendanceRate}%`].filter(Boolean).join(' · ')}
              onProgress={() => navigation.navigate('PerformanceTrend', { session, athlete: { athleteId: athlete.athleteId, firstName: athlete.firstName, lastName: athlete.lastName } })}
            />
          ))}
          {shown.length > 30 ? <Text style={styles.emptyText}>Showing 30 of {shown.length}. Search to find someone else.</Text> : null}
        </ListBody>
      </Section>
    </DashboardShell>
  );
}

function ParentDashboard({ session, navigation }: { session: Session; navigation: any }) {
  const children = useApiData<any[]>('/api/Parent/children', session.token, []);
  const training = useApiData<any[]>(`/api/Parent/training?from=${localDateISO()}`, session.token, []);
  const updates = useApiData<any[]>('/api/Notifications/me', session.token, []);
  const kids = children.data || [];
  const sessions = (training.data || []).slice(0, 8);

  return (
    <DashboardShell title="Parent Dashboard" subtitle={`Welcome, ${session.firstName || 'Parent'}!`} sources={[children, training, updates]} navigation={navigation}>
      <Section title={kids.length > 1 ? 'My children' : 'My child'}>
        <ListBody loading={children.loading} empty={!kids.length} emptyText="No student-athlete is linked to your account yet. Please contact the school.">
          {kids.map((child) => (
            <View key={child.athleteId} style={styles.row}>
              <Text style={styles.rowTitle}>{fullName(child)}</Text>
              <Text style={styles.rowMeta}>{child.teams?.map((team: any) => `${team.teamName} (${team.sport})`).join(', ') || 'Not on a team yet'}</Text>
            </View>
          ))}
        </ListBody>
      </Section>

      <Section title="Upcoming training">
        <ListBody loading={training.loading} empty={!sessions.length} emptyText="No upcoming training.">
          {sessions.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowMeta}>{formatDate(item.startDate)} · {formatTimeRange(item.startTime, item.endTime)}</Text>
              <Text style={styles.rowSmall}>{item.location || 'Location TBA'} · {item.teamName} · Coach {item.coachName}</Text>
              {kids.length > 1 && <Text style={styles.rowSmall}>For {item.children?.map((child: any) => child.firstName).join(', ')}</Text>}
            </View>
          ))}
        </ListBody>
      </Section>

      <UpdatesSection updates={updates} />
    </DashboardShell>
  );
}

function GeneralDashboard({ session, navigation }: { session: Session; navigation: any }) {
  const updates = useApiData<any[]>('/api/Notifications/me', session.token, []);
  const role = String(session.role || '').toUpperCase();

  return (
    <DashboardShell title={`${readable(role)} Dashboard`} subtitle={`Welcome, ${session.firstName || 'User'}! The full tools for your role are on the Athlete-Hub website.`} sources={[updates]} navigation={navigation}>
      <UpdatesSection updates={updates} />
      <Section title="Account">
        <Text style={styles.listItem}>Email: {session.email}</Text>
        <Text style={styles.listItem}>University ID: {session.universityId}</Text>
      </Section>
    </DashboardShell>
  );
}

// Performance Entry Screen - for coaches to record athlete performance
function PerformanceEntryScreen({ route, navigation }: { route: any; navigation: any }) {
  const { session, athlete } = route.params as { session: Session; athlete: Athlete };
  const [dataType, setDataType] = useState('PUSH_UP');
  const [value, setValue] = useState('');
  const [sessionId, setSessionId] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const metrics = useApiData<any[]>('/api/Performance/metrics', session.token, []);
  const trainingSessions = useApiData<any[]>('/api/Training/sessions', session.token, []);

  // Results can only be recorded for approved training on this athlete's team that has already ended.
  const finished = useMemo(() => {
    const now = new Date();
    const today = localDateISO(now);
    const clock = now.toTimeString().slice(0, 8);
    return (trainingSessions.data || [])
      .filter((item) => item.approvalStatus === 'APPROVED')
      .filter((item) => !athlete.teamId || item.teamId === athlete.teamId)
      .filter((item) => item.trainingDate < today || (item.trainingDate === today && item.endTime && item.endTime <= clock))
      .sort((a, b) => b.trainingDate.localeCompare(a.trainingDate));
  }, [trainingSessions.data, athlete.teamId]);

  useEffect(() => {
    if (!sessionId && finished.length) setSessionId(finished[0].trainingSessionId);
  }, [finished, sessionId]);

  const handleSubmit = async () => {
    if (!value.trim() || Number.isNaN(Number(value))) {
      Alert.alert('Result needed', 'Please enter the result as a number.');
      return;
    }
    if (!sessionId) {
      Alert.alert('Training needed', 'Please choose the training session this result is from.');
      return;
    }

    setLoading(true);
    try {
      await apiRequest('/api/Performance/record', {
        method: 'POST',
        token: session.token,
        body: {
          athleteId: athlete.athleteId,
          metricId: metrics.data?.[0]?.metricId || 0,
          recordedValue: Number(value),
          recordedDate: localDateISO(),
          dataType,
          sessionId,
          notes,
        },
      });

      Alert.alert('Saved', 'The result was saved.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Could not save', error?.message || 'The result could not be saved. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.dashboardContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Record Performance</Text>
        <Text style={styles.greeting}>Athlete: {fullName(athlete)}</Text>
        {trainingSessions.error ? <Text style={styles.errorText}>{trainingSessions.error}</Text> : null}

        <View style={styles.listCard}>
          <Text style={styles.listTitle}>Performance Details</Text>

          <Text style={styles.fieldLabel}>Training session</Text>
          {finished.length ? (
            <Picker selectedValue={sessionId} onValueChange={(id) => setSessionId(Number(id))} style={styles.picker}>
              {finished.map((item) => (
                <Picker.Item key={item.trainingSessionId} label={`${formatDate(item.trainingDate)} · ${item.title}`} value={item.trainingSessionId} />
              ))}
            </Picker>
          ) : (
            <Text style={styles.emptyText}>
              {trainingSessions.loading ? 'Loading...' : 'No finished, approved training for this athlete yet. Results can be recorded after a session ends.'}
            </Text>
          )}

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

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Optional notes"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        <Pressable style={[styles.button, (loading || !finished.length) && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading || !finished.length}>
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
  const { session, athlete } = route.params as { session: Session; athlete: Athlete };
  const [timeRange, setTimeRange] = useState<'overall' | 'monthly' | 'weekly'>('overall');
  const [seriesIndex, setSeriesIndex] = useState(0);
  const trend = useApiData(`/api/Performance/athlete/${athlete.athleteId}/trend?timeRange=${timeRange}`, session.token);
  const records = useApiData(`/api/Performance/athlete/${athlete.athleteId}`, session.token);

  const datasets: any[] = trend.data?.datasets || [];
  const series = datasets[Math.min(seriesIndex, datasets.length - 1)];
  // The API leaves gaps (null) for sessions without this workout; the chart needs only real points.
  const points = series
    ? (series.data as (number | null)[])
        .map((value, index) => ({ value, label: String(trend.data.labels[index] ?? '') }))
        .filter((point): point is { value: number; label: string } => point.value != null)
    : [];
  const recent = (records.data?.records || []).slice(0, 10);

  return (
    <SafeAreaView style={styles.dashboardContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.heading}>Performance Trend</Text>
        <Text style={styles.greeting}>{fullName(athlete)}</Text>
        {[trend.error, records.error].filter(Boolean).map((error) => <Text key={error} style={styles.errorText}>{error}</Text>)}

        <View style={styles.timeRangeButtons}>
          {(['overall', 'monthly', 'weekly'] as const).map((range) => (
            <Pressable key={range} style={[styles.timeRangeButton, timeRange === range && styles.timeRangeButtonActive]} onPress={() => setTimeRange(range)}>
              <Text style={[styles.timeRangeButtonText, timeRange === range && styles.timeRangeButtonTextActive]}>{readable(range)}</Text>
            </Pressable>
          ))}
        </View>

        {datasets.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {datasets.map((item, index) => (
              <Pressable key={item.label} style={[styles.timeRangeButton, item === series && styles.timeRangeButtonActive]} onPress={() => setSeriesIndex(index)}>
                <Text style={[styles.timeRangeButtonText, item === series && styles.timeRangeButtonTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {trend.loading && !trend.data ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : points.length ? (
          <>
            <Text style={styles.listTitle}>{series.label}</Text>
            <LineChart
              data={{ labels: points.map((point) => point.label.slice(0, 10)), datasets: [{ data: points.map((point) => point.value) }] }}
              width={Dimensions.get('window').width - 40}
              height={260}
              verticalLabelRotation={points.length > 4 ? 30 : 0}
              chartConfig={{
                backgroundColor: '#f5f7fb',
                backgroundGradientFrom: '#f5f7fb',
                backgroundGradientTo: '#f5f7fb',
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
              }}
              bezier
            />
          </>
        ) : (
          <Text style={styles.emptyText}>No results recorded for this time range yet.</Text>
        )}

        <Section title="Recent results">
          <ListBody loading={records.loading} empty={!recent.length} emptyText="No results recorded yet.">
            {recent.map((record: any) => (
              <View key={record.performanceRecordId} style={styles.row}>
                <Text style={styles.rowTitle}>{readable(record.dataType)}: {record.recordedValue}{record.unit ? ` ${readable(record.unit).toLowerCase()}` : ''}</Text>
                <Text style={styles.rowMeta}>{formatDate(record.recordedDate)}{record.sessionTitle ? ` · ${record.sessionTitle}` : ''}</Text>
                {record.notes ? <Text style={styles.rowSmall}>{record.notes}</Text> : null}
              </View>
            ))}
          </ListBody>
        </Section>

        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <NavigationContainer ref={navigationRef}>
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
  errorText: {
    fontSize: 14,
    color: '#b91c1c',
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  cardGrid: {
    marginTop: 18,
    marginBottom: 8,
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
  statCardSlate: {
    backgroundColor: '#475569',
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
  row: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  unread: {
    color: '#2563eb',
  },
  rowMeta: {
    fontSize: 14,
    color: '#334155',
    marginTop: 2,
  },
  rowSmall: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  errorSmall: {
    fontSize: 12,
    color: '#b91c1c',
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  smallButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  smallButtonOutline: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonOutlineText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    paddingVertical: 6,
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
  chipRow: {
    gap: 8,
    paddingBottom: 16,
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
