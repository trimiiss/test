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
  ScrollView,
  LogBox
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseClient';
import { BlurView } from 'expo-blur'; // Optional, but if not installed, we fallback to standard views

LogBox.ignoreLogs(['MediaTypeOptions have been deprecated']);

export default function ProfileScreen() {
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Edit States
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  
  // We will track "draft" states for editing
  const [editMode, setEditMode] = useState(false); 
  const [draftUsername, setDraftUsername] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) {
      const meta = user.user_metadata || {};
      setAvatarUrl(meta.avatar_url || null);
      setUsername(meta.username || 'No Username');
      setBio(meta.bio || '');
      // Initialize drafts
      setDraftUsername(meta.username || '');
      setDraftBio(meta.bio || '');
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    // Update both fields at once
    const { error } = await supabase.auth.updateUser({
      data: { 
        username: draftUsername,
        bio: draftBio
      }
    });

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setUsername(draftUsername);
      setBio(draftBio);
      setEditMode(false);
      Alert.alert('Success', 'Profile updated!');
    }
  };

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (result.canceled) return;
      setUploading(true);
      const asset = result.assets[0];

      // Prepare file upload
      let ext = 'png'; 
      if (Platform.OS !== 'web') {
         const uriParts = asset.uri.split('.');
         ext = uriParts[uriParts.length - 1];
      } 
      const fileName = `avatar_${Date.now()}.${ext}`;
      
      let fileBody;
      if (Platform.OS === 'web') {
        const res = await fetch(asset.uri);
        fileBody = await res.blob();
      } else {
        const formData = new FormData();
        formData.append('file', { uri: asset.uri, name: fileName, type: `image/${ext}` });
        fileBody = formData;
      }

      const { error: uploadError } = await supabase.storage.from('chat-images').upload(fileName, fileBody, { contentType: `image/${ext}`, upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } });
      
      setAvatarUrl(data.publicUrl);
      
    } catch (error) {
      Alert.alert("Error", "Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };

  if (!user) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* --- HEADER (Avatar + Email) --- */}
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={pickImage} disabled={uploading} style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.placeholder]}>
                <Text style={styles.placeholderText}>{username.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
               {uploading ? <ActivityIndicator size="small" color="#fff"/> : <Ionicons name="camera" size={16} color="#fff" />}
            </View>
          </TouchableOpacity>
          
          <Text style={styles.emailText}>{user.email}</Text>
        </View>

        {/* --- INFO CARD --- */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
             <Text style={styles.cardTitle}>Profile Details</Text>
             {/* EDIT TOGGLE BUTTON */}
             {!editMode ? (
               <TouchableOpacity onPress={() => setEditMode(true)}>
                 <Text style={styles.editActionText}>Edit</Text>
               </TouchableOpacity>
             ) : (
               <TouchableOpacity onPress={() => setEditMode(false)}>
                 <Text style={styles.cancelActionText}>Cancel</Text>
               </TouchableOpacity>
             )}
          </View>

          {/* USERNAME ROW */}
          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Ionicons name="person-outline" size={20} color="#007AFF" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.label}>Username</Text>
              {editMode ? (
                <TextInput 
                  style={styles.input} 
                  value={draftUsername} 
                  onChangeText={setDraftUsername}
                  placeholder="Enter username"
                  autoCapitalize="none"
                />
              ) : (
                <Text style={styles.valueText}>{username}</Text>
              )}
            </View>
          </View>
          
          <View style={styles.divider} />

          {/* BIO ROW */}
          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Ionicons name="document-text-outline" size={20} color="#007AFF" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.label}>Bio</Text>
              {editMode ? (
                <TextInput 
                  style={[styles.input, styles.bioInput]} 
                  value={draftBio} 
                  onChangeText={setDraftBio}
                  placeholder="Tell us about yourself..."
                  multiline={true}
                  textAlignVertical="top" // Android fix
                />
              ) : (
                <Text style={styles.valueText}>{bio || "No bio set."}</Text>
              )}
            </View>
          </View>
        </View>

        {/* --- SAVE BUTTON (Only in Edit Mode) --- */}
        {editMode && (
          <TouchableOpacity 
            style={styles.saveButton} 
            onPress={saveChanges}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
          </TouchableOpacity>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f2f2f7' }, // Light Grey "System" Background
  scrollContent: { alignItems: 'center', paddingBottom: 40 },
  
  // --- HEADER STYLES ---
  headerContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    width: '100%',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: {height: 5, width: 0},
    elevation: 5,
    marginBottom: 20,
  },
  avatarContainer: { position: 'relative', marginBottom: 15 },
  avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: '#fff' },
  placeholder: { backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { fontSize: 40, color: '#888', fontWeight: 'bold' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#007AFF', padding: 8, borderRadius: 20,
    borderWidth: 3, borderColor: '#fff'
  },
  emailText: { fontSize: 16, color: '#888', fontWeight: '500' },

  // --- CARD STYLES ---
  card: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { height: 2, width: 0 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  editActionText: { color: '#007AFF', fontWeight: '600', fontSize: 16 },
  cancelActionText: { color: '#FF3B30', fontWeight: '600', fontSize: 16 },

  // --- ROW STYLES ---
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBox: {
    width: 40, height: 40,
    backgroundColor: '#EFF6FF', // Very light blue
    borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 15
  },
  rowContent: { flex: 1, justifyContent: 'center', minHeight: 40 },
  label: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, fontWeight: '600' },
  valueText: { fontSize: 17, color: '#333', fontWeight: '400', lineHeight: 24 },
  
  // --- INPUT STYLES ---
  input: {
    fontSize: 17, color: '#333',
    borderBottomWidth: 1, borderBottomColor: '#007AFF',
    paddingVertical: 5,
  },
  bioInput: { minHeight: 60, textAlignVertical: 'top' }, // Make bio taller

  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 15, marginLeft: 55 }, // Indented divider

  // --- SAVE BUTTON ---
  saveButton: {
    marginTop: 25,
    backgroundColor: '#007AFF',
    width: '90%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#007AFF', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { height: 4, width: 0 },
  },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' }
});