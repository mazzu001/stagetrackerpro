import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { UserType, useLocalAuth } from '../hooks/useLocalAuth';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const { login } = useLocalAuth();

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    try {
      // Determine user type based on email for demo purposes
      let userType: UserType = 'free';
      if (email.includes('professional')) {
        userType = 'professional';
      } else if (email.includes('paid') || email.includes('premium')) {
        userType = 'paid';
      }

      await login(userType, email.trim());
      onLoginSuccess?.();
    } catch (error) {
      Alert.alert('Error', 'Failed to sign in. Please try again.');
    }
  };

  const handleDemoLogin = async (userType: UserType, demoEmail: string) => {
    try {
      await login(userType, demoEmail);
      onLoginSuccess?.();
    } catch (error) {
      Alert.alert('Error', 'Failed to sign in. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🎵 StageTracker Pro</Text>
            <Text style={styles.subtitle}>
              Professional live music performance application
            </Text>
          </View>

          {/* Features */}
          <View style={styles.featuresContainer}>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>🎚️</Text>
              <Text style={styles.featureTitle}>Multi-Track Audio</Text>
              <Text style={styles.featureDescription}>
                Mix up to 6 audio tracks with individual controls
              </Text>
            </View>

            <View style={styles.feature}>
              <Text style={styles.featureIcon}>🎹</Text>
              <Text style={styles.featureTitle}>MIDI Integration</Text>
              <Text style={styles.featureDescription}>
                Timed MIDI events embedded in lyrics for device control
              </Text>
            </View>

            <View style={styles.feature}>
              <Text style={styles.featureIcon}>🔒</Text>
              <Text style={styles.featureTitle}>Offline First</Text>
              <Text style={styles.featureDescription}>
                Complete local storage for reliable live performance
              </Text>
            </View>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
              <Text style={styles.primaryButtonText}>
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.switchButton}
              onPress={() => setIsSignUp(!isSignUp)}
            >
              <Text style={styles.switchButtonText}>
                {isSignUp 
                  ? 'Already have an account? Sign In' 
                  : "Don't have an account? Sign Up"
                }
              </Text>
            </TouchableOpacity>
          </View>

          {/* Demo Logins */}
          <View style={styles.demoContainer}>
            <Text style={styles.demoTitle}>Quick Demo Access:</Text>
            
            <TouchableOpacity 
              style={styles.demoButton}
              onPress={() => handleDemoLogin('free', 'demo@free.com')}
            >
              <Text style={styles.demoButtonText}>Free Account (2 songs)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.demoButton}
              onPress={() => handleDemoLogin('paid', 'demo@paid.com')}
            >
              <Text style={styles.demoButtonText}>Paid Account (Unlimited songs)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.demoButton}
              onPress={() => handleDemoLogin('professional', 'demo@professional.com')}
            >
              <Text style={styles.demoButtonText}>Professional (Full MIDI)</Text>
            </TouchableOpacity>
          </View>

          {/* Pricing Info */}
          <View style={styles.pricingContainer}>
            <Text style={styles.pricingText}>
              Start with 2 free songs • $4.99/month for unlimited songs
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    marginBottom: 40,
  },
  feature: {
    backgroundColor: '#1f1f37',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
  },
  formContainer: {
    backgroundColor: '#1f1f37',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  primaryButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#a855f7',
    fontSize: 14,
  },
  demoContainer: {
    marginBottom: 24,
  },
  demoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  demoButton: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  demoButtonText: {
    color: '#d1d5db',
    textAlign: 'center',
    fontSize: 14,
  },
  pricingContainer: {
    alignItems: 'center',
  },
  pricingText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
  },
});