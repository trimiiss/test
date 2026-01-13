import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../supabaseClient';

export default function ContactsScreen({ navigation }) {
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Fetch everyone EXCEPT me
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id);

    if (!error) setProfiles(data);
  }

  // --- Helper to generate Initials ---
  const getInitials = (item) => {
    // If they have a "full_name", use first letter. Otherwise use email.
    const name = item.full_name || item.email; 
    return name.charAt(0).toUpperCase();
  };

  const getDisplayName = (item) => {
    return item.full_name || item.email;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Contacts</Text>
      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.contactItem} 
            onPress={() => navigation.navigate('Chat', { roomId: null, roomName: getDisplayName(item) })} 
            // Note: In a real app, you'd create a unique room ID for 1-on-1 chats here
          >
            {/* The Avatar Bubble */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item)}</Text>
            </View>
            
            <View>
              <Text style={styles.nameText}>{getDisplayName(item)}</Text>
              <Text style={styles.emailText}>{item.email}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  contactItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#5D3FD3', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  nameText: { fontSize: 16, fontWeight: 'bold' },
  emailText: { fontSize: 12, color: 'gray' }
});