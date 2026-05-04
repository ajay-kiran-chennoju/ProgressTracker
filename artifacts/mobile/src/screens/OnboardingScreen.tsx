import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Lock, User, Sparkles } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useCurrentUser } from '../hooks/useCurrentUser';

type ViewType = 'menu' | 'claim' | 'login';

export default function OnboardingScreen() {
  const { setUser } = useCurrentUser();
  const [view, setView] = useState<ViewType>('menu');
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<any[]>([]);
  const [activeSlot, setActiveSlot] = useState<'A' | 'B' | null>(null);
  
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('participants').select('*');
      if (error) throw error;
      setParticipants(data || []);
    } catch (error) {
      console.error('Error fetching participants:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipants();
  }, []);

  const slotA = participants.find(p => p.slot === 'A');
  const slotB = participants.find(p => p.slot === 'B');

  const isPinValid = (p: string) => /^[0-9]{4,8}$/.test(p);

  const handleClaim = async () => {
    if (!activeSlot || !name.trim() || !isPinValid(pin)) {
      Alert.alert('Invalid Input', 'Please check your name and PIN (4-8 digits).');
      return;
    }
    if (pin !== pinConfirm) {
      Alert.alert('PIN Mismatch', 'The PINs you entered do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('participants')
        .insert([{ slot: activeSlot, name: name.trim(), pin }])
        .select()
        .single();

      if (error) throw error;

      setUser({ slot: data.slot, name: data.name, pin });
    } catch (error: any) {
      if (error.code === '23505') {
        Alert.alert('Already Claimed', 'This spot was just taken by someone else.');
        fetchParticipants();
        setView('menu');
      } else {
        Alert.alert('Error', 'Could not claim this spot. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async () => {
    if (!activeSlot || !isPinValid(pin)) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('slot', activeSlot)
        .eq('pin', pin)
        .single();

      if (error || !data) {
        Alert.alert('Incorrect PIN', 'The PIN you entered is incorrect.');
        return;
      }

      setUser({ slot: data.slot, name: data.name, pin });
    } catch (error) {
      Alert.alert('Error', 'Could not sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderMenu = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Sparkles size={40} color="#000" style={styles.logo} />
        <Text style={styles.cardTitle}>Daily Progress</Text>
        <Text style={styles.cardSubtitle}>A shared space to log your days together.</Text>
      </View>

      <View style={styles.slotList}>
        {(['A', 'B'] as const).map(slot => {
          const p = slot === 'A' ? slotA : slotB;
          const claimed = !!p?.name;
          return (
            <Pressable 
              key={slot} 
              style={styles.slotItem}
              onPress={() => {
                setActiveSlot(slot);
                setName('');
                setPin('');
                setPinConfirm('');
                setView(claimed ? 'login' : 'claim');
              }}
            >
              <View>
                <Text style={styles.slotName}>{claimed ? p.name : `Participant ${slot}`}</Text>
                <Text style={styles.slotStatus}>{claimed ? 'Sign in with PIN' : 'Claim this spot'}</Text>
              </View>
              <ChevronLeft size={20} color="#CCC" style={{ transform: [{ rotate: '180deg' }] }} />
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.footerNote}>Pick your spot to begin.</Text>
    </View>
  );

  const renderClaim = () => (
    <View style={styles.card}>
      <Pressable onPress={() => setView('menu')} style={styles.backBtn}>
        <ChevronLeft size={20} color="#666" />
        <Text style={styles.backBtnText}>Back</Text>
      </Pressable>
      <Text style={styles.viewTitle}>Claim Participant {activeSlot}</Text>
      <Text style={styles.viewSubtitle}>Pick a name and a PIN you'll use to sign in.</Text>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Your name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            value={name}
            onChangeText={setName}
            autoFocus
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Choose a PIN (4-8 digits)</Text>
          <TextInput
            style={styles.input}
            placeholder="••••"
            value={pin}
            onChangeText={setPin}
            keyboardType="numeric"
            secureTextEntry
            maxLength={8}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm PIN</Text>
          <TextInput
            style={styles.input}
            placeholder="••••"
            value={pinConfirm}
            onChangeText={setPinConfirm}
            keyboardType="numeric"
            secureTextEntry
            maxLength={8}
          />
        </View>

        <Pressable 
          style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]} 
          onPress={handleClaim}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Start Tracking</Text>}
        </Pressable>
      </View>
    </View>
  );

  const renderLogin = () => {
    const p = activeSlot === 'A' ? slotA : slotB;
    return (
      <View style={styles.card}>
        <Pressable onPress={() => setView('menu')} style={styles.backBtn}>
          <ChevronLeft size={20} color="#666" />
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
        <Text style={styles.viewTitle}>Welcome back, {p?.name}</Text>
        <Text style={styles.viewSubtitle}>Enter your PIN to continue.</Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>PIN</Text>
            <TextInput
              style={styles.input}
              placeholder="••••"
              value={pin}
              onChangeText={setPin}
              keyboardType="numeric"
              secureTextEntry
              autoFocus
              maxLength={8}
            />
          </View>

          <Pressable 
            style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]} 
            onPress={handleLogin}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#000" />
        ) : (
          <>
            {view === 'menu' && renderMenu()}
            {view === 'claim' && renderClaim()}
            {view === 'login' && renderLogin()}
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  slotList: {
    gap: 12,
  },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  slotName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  slotStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  footerNote: {
    textAlign: 'center',
    marginTop: 24,
    color: '#999',
    fontSize: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginLeft: -10,
  },
  backBtnText: {
    color: '#666',
    fontSize: 16,
  },
  viewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  viewSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  input: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  primaryBtn: {
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
