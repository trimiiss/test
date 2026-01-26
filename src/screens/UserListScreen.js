import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';

export default function UserListScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get all profiles except me
    const { data, error } = await supabase
      .from('profiles') // Make sure this matches your table name (profiles vs users)
      .select('*')
      .neq('id', user?.id);

    if (error) {
      console.log(error);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  // 🔥 THE NEW SIMPLE LOGIC
  const onStartChat = async (otherUser) => {
    try {
      // Get My Real Auth ID
      const { data: { user } } = await supabase.auth.getUser();
      const myId = user?.id;

      if (!myId) return Alert.alert("Error", "You are not logged in!");

      // DEBUG ALERT: Show us the IDs being used
      // Remove this alert after it works
      // Alert.alert("Debugging", `Me: ${myId}\nThem: ${otherUser.id}`);

      // Call the SQL Function
      const { data: roomId, error } = await supabase
        .rpc('create_or_find_private_chat', { recipient_id: otherUser.id });

      if (error) {
        console.error(error);
        Alert.alert("SQL Error", error.message);
        return;
      }

      if (roomId) {
        navigation.navigate('ChatScreen', { 
          roomId: roomId, 
          roomName: otherUser.username || "Chat"
        });
      } else {
        Alert.alert("Error", "No Room ID returned from database.");
      }

    } catch (error) {
      Alert.alert("App Error", error.message);
    }
  };

  const renderUser = ({ item }) => (
    <TouchableOpacity style={styles.userCard} onPress={() => onStartChat(item)}>
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <Text style={styles.avatarText}>{item.username?.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={styles.status}>Tap to message</Text>
      </View>
      <Ionicons name="chatbubble-ellipses-outline" size={24} color="#007AFF" />
    </TouchableOpacity>
  );

  if (loading) return <ActivityIndicator style={styles.center} />;

  return (
    <View style={styles.container}>
      <FlatList 
        data={users} 
        keyExtractor={item => item.id} 
        renderItem={renderUser} 
        contentContainerStyle={{ padding: 15 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  userCard: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', 
    padding: 15, marginBottom: 10, borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 
  },
  avatarContainer: { 
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#ddd', 
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden' 
  },
  avatar: { width: 50, height: 50 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#555' },
  info: { flex: 1, marginLeft: 15 },
  username: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  status: { fontSize: 12, color: '#888' },
});