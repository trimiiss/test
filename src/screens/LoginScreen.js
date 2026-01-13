import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { supabase } from '../supabaseClient';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); // <--- Added Username State
  
  const [loading, setLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // --- TRANSLATOR ---
  const getFriendlyErrorMessage = (errorMsg) => {
    const msg = errorMsg.toLowerCase();
    if (msg.includes('invalid login credentials')) return 'Incorrect email or password.';
    if (msg.includes('user already registered')) return 'Email already in use. Login instead.';
    if (msg.includes('password should be at least 6 characters')) return 'Password must be 6+ characters.';
    if (msg.includes('invalid email') || msg.includes('validation failed')) return 'Please enter a valid email.';
    return errorMsg; 
  };

  // --- LOGIN ---
  const handleLogin = async () => {
    setErrorMessage('');
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });
    setLoading(false);

    if (error) setErrorMessage(getFriendlyErrorMessage(error.message));
  };

  // --- SIGN UP ---
  const handleSignUp = async () => {
    setErrorMessage('');
    
    // Check for Username too
    if (!email || !password || !username) {
      setErrorMessage('Please fill in all fields (Username, Email, Password).');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: { username: username } // <--- Save Username to Supabase
      }
    });
    setLoading(false);

    if (error) {
      setErrorMessage(getFriendlyErrorMessage(error.message));
    } else {
      Alert.alert('Success', 'Account created! You are now logged in.');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      <View style={styles.formContainer}>
        <Text style={styles.title}>{isLoginMode ? 'Welcome Back!' : 'Create Account'}</Text>
        <Text style={styles.subtitle}>
          {isLoginMode ? 'Sign in to continue chatting' : 'Sign up to get started'}
        </Text>

        {/* --- 1. USERNAME INPUT (Only show in Sign Up mode) --- */}
        {!isLoginMode && (
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Pick a username"
              placeholderTextColor="#999"
              autoCapitalize="none"
              value={username}
              onChangeText={(text) => { setUsername(text); setErrorMessage(''); }}
            />
          </View>
        )}

        {/* --- 2. EMAIL INPUT --- */}
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="name@example.com"
            placeholderTextColor="#999"
            autoCapitalize="none"
            value={email}
            onChangeText={(text) => { setEmail(text); setErrorMessage(''); }}
            keyboardType="email-address"
          />
        </View>

        {/* --- 3. PASSWORD INPUT --- */}
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#999"
            secureTextEntry
            value={password}
            onChangeText={(text) => { setPassword(text); setErrorMessage(''); }}
          />
        </View>

        {/* --- ERROR MESSAGE --- */}
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        {/* ACTION BUTTON */}
        <TouchableOpacity 
          style={styles.button} 
          onPress={isLoginMode ? handleLogin : handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isLoginMode ? 'Log In' : 'Sign Up'}</Text>
          )}
        </TouchableOpacity>

        {/* TOGGLE */}
        <TouchableOpacity 
          onPress={() => { setIsLoginMode(!isLoginMode); setErrorMessage(''); }} 
          style={styles.switchButton}
        >
          <Text style={styles.switchText}>
            {isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#fff', justifyContent: 'center', padding: 20,
  },
  formContainer: {
    maxWidth: 400, width: '100%', alignSelf: 'center',
  },
  title: {
    fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 5, textAlign: 'center',
  },
  subtitle: {
    fontSize: 16, color: '#666', marginBottom: 30, textAlign: 'center',
  },
  inputWrapper: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 5, marginLeft: 2,
  },
  input: {
    backgroundColor: '#f5f5f5', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0', fontSize: 16,
  },
  errorText: {
    color: '#ff3b30', fontSize: 14, marginBottom: 10, marginTop: -5, marginLeft: 2, fontWeight: '500'
  },
  button: {
    backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 5,
  },
  buttonText: {
    color: '#fff', fontSize: 18, fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 20, alignItems: 'center',
  },
  switchText: {
    color: '#007AFF', fontSize: 14,
  }
});