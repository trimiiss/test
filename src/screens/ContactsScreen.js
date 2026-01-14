import React, { useEffect, useState } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert 
} from 'react-native';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';

export default function ContactsScreen({ navigation }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    // 1. Get the current logged-in user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    // 2. Fetch profiles, but EXCLUDE the current user using .neq()
    const { data, error } = await supabase
      .from('profiles') 
      .select('*')
      .neq('id', user.id); // <--- This means "Not Equal to My ID"

    if (error) {
      console.log('Error fetching contacts:', error.message);
    } else {
      setContacts(data || []);
    }
    setLoading(false);
  };

  const handleContactPress = async (contact) => {
    const contactName = contact.username || contact.email || 'User';
    const roomName = `Chat with ${contactName}`;

    try {
      // Check if room exists
      const { data: existingRooms, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .eq('name', roomName)
        .limit(1);

      if (fetchError) throw fetchError;

      let targetRoomId;

      if (existingRooms && existingRooms.length > 0) {
        targetRoomId = existingRooms[0].id;
      } else {
        // Create new PRIVATE room (is_group: false)
        const { data: newRoom, error: createError } = await supabase
          .from('rooms')
          .insert({ 
            name: roomName,
            is_group: false 
          })
          .select()
          .single();

        if (createError) throw createError;
        targetRoomId = newRoom.id;
      }

      navigation.navigate('ChatScreen', { 
        roomId: targetRoomId, 
        roomName: roomName 
      });

    } catch (error) {
      Alert.alert("Error", "Could not start chat: " + error.message);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;

  return (
    <View style={styles.container}>
      {contacts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No other contacts found.</Text>
          <Text style={styles.subText}>You are the only user so far!</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.item} 
              onPress={() => handleContactPress(item)}
            >
              <View style={styles.avatar}>
                <Ionicons name="person" size={20} color="#fff" />
              </View>
              <Text style={styles.name}>{item.username || item.email}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  item: { 
    flexDirection: 'row', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderColor: '#eee', 
    alignItems: 'center' 
  },
  avatar: {
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#ccc', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 15
  },
  name: { fontSize: 16, fontWeight: 'bold' },
  emptyText: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  subText: { color: '#888', textAlign: 'center' }
});