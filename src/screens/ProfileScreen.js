import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  LogBox
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseClient';

// Ignore the specific deprecation warning for now so it doesn't annoy you
LogBox.ignoreLogs(['MediaTypeOptions have been deprecated']);

export default function ProfileScreen() {
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // --- USERNAME EDITING STATE ---
  const [username, setUsername] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        setAvatarUrl(user.user_metadata?.avatar_url || null);
        setUsername(user.user_metadata?.username || 'No Username');
        setNewUsername(user.user_metadata?.username || '');
      }
    };
    getProfile();
  }, []);

  // --- 1. HANDLE USERNAME UPDATE ---
  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) return;
    setSavingName(true);

    const { error } = await supabase.auth.updateUser({
      data: { username: newUsername }
    });

    setSavingName(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setUsername(newUsername);
      setIsEditingName(false);
      Alert.alert('Success', 'Username updated!');
    }
  };

  // --- 2. FIXED IMAGE UPLOAD ---
  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        // REVERTED TO MediaTypeOptions to fix the crash
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (result.canceled) return;

      setUploading(true);
      const asset = result.assets[0];

      // --- FIX FOR FILE EXTENSION (WEB VS MOBILE) ---
      // We default to 'png' on Web because blob URLs don't have extensions
      let ext = 'png'; 
      if (Platform.OS !== 'web') {
         const uriParts = asset.uri.split('.');
         ext = uriParts[uriParts.length - 1];
      } 

      const fileName = `avatar_${Date.now()}.${ext}`;

      // --- PREPARE FILE ---
      let fileBody;
      if (Platform.OS === 'web') {
        const res = await fetch(asset.uri);
        fileBody = await res.blob();
      } else {
        const formData = new FormData();
        formData.append('file', { 
          uri: asset.uri, 
          name: fileName, 
          type: `image/${ext}` 
        });
        fileBody = formData;
      }

      // --- UPLOAD ---
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, fileBody, { 
          contentType: `image/${ext}`,
          upsert: true 
        });

      if (uploadError) throw uploadError;

      // --- GET URL ---
      const { data } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      
      // --- SAVE TO PROFILE ---
      await supabase.auth.updateUser({
        data: { avatar_url: data.publicUrl }
      });

      setAvatarUrl(data.publicUrl);
      Alert.alert("Success", "Profile picture updated!");

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to upload image. Check console.");
    } finally {
      setUploading(false);
    }
  };

  if (!user) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      
      {/* --- AVATAR SECTION --- */}
      <View style={styles.avatarWrapper}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholder]}>
            <Ionicons name="person" size={80} color="#ccc" />
          </View>
        )}
        
        <TouchableOpacity style={styles.editButton} onPress={pickImage} disabled={uploading}>
          {uploading ? <ActivityIndicator size="small" color="#fff"/> : <Ionicons name="camera" size={22} color="#fff" />}
        </TouchableOpacity>
      </View>

      <Text style={styles.emailLabel}>Email: {user.email}</Text>

      {/* --- EDITABLE USERNAME SECTION --- */}
      <Text style={styles.label}>Username</Text>
      
      {isEditingName ? (
        // EDIT MODE
        <View style={styles.editContainer}>
          <TextInput 
            style={styles.input}
            value={newUsername}
            onChangeText={setNewUsername}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={handleUpdateUsername} disabled={savingName} style={styles.saveBtn}>
            {savingName ? <ActivityIndicator color="white" /> : <Ionicons name="checkmark" size={24} color="white" />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsEditingName(false)} style={styles.cancelBtn}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>
      ) : (
        // DISPLAY MODE
        <View style={styles.displayContainer}>
          {/* REMOVED THE @ SYMBOL HERE */}
          <Text style={styles.infoText}>{username}</Text>
          <TouchableOpacity onPress={() => setIsEditingName(true)} style={styles.pencilBtn}>
             <Text style={styles.editText}>Edit</Text>
             <Ionicons name="pencil" size={16} color="#007AFF" />
          </TouchableOpacity>
        </View>
      )}

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { 
    flex: 1, 
    backgroundColor: '#fff', 
    alignItems: 'center', 
    paddingTop: 50 
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  avatar: { 
    width: 150, 
    height: 150, 
    borderRadius: 75,
    borderWidth: 2,
    borderColor: '#f0f0f0' 
  },
  placeholder: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center'
  },
  editButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff'
  },
  emailLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 1,
    alignSelf: 'flex-start',
    marginLeft: '10%'
  },
  // Display Mode Styles
  displayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  infoText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
  },
  pencilBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: 8,
    borderRadius: 15
  },
  editText: {
    color: '#007AFF',
    marginRight: 5,
    fontWeight: '600'
  },
  // Edit Mode Styles
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
  },
  input: {
    flex: 1,
    fontSize: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#007AFF',
    paddingVertical: 5,
    color: '#333'
  },
  saveBtn: {
    backgroundColor: '#34c759', // Green
    padding: 8,
    borderRadius: 5,
    marginLeft: 10
  },
  cancelBtn: {
    backgroundColor: '#ff3b30', // Red
    padding: 8,
    borderRadius: 5,
    marginLeft: 10
  }
});