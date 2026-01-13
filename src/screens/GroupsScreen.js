import React, { useEffect, useState } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Alert, Modal, TextInput 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseClient';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function GroupsScreen({ navigation }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  // ---------------------------
  // 1. FETCH + REALTIME LISTEN
  // ---------------------------
  useEffect(() => {
    fetchGroups();

    const channel = supabase
      .channel('rooms-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setGroups(cur => [payload.new, ...cur]);
          }
          if (payload.eventType === 'DELETE') {
            setGroups(cur => cur.filter(r => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchGroups = async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setGroups(data || []);
    setLoading(false);
  };

  // ---------------------------
  // 2. CREATE GROUP
  // ---------------------------
  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;

    const { error } = await supabase
      .from('rooms')
      .insert({ name: newRoomName.trim() });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setNewRoomName('');
    setModalVisible(false);
  };

  // ---------------------------
  // 3. DELETE GROUP (SWIPE)
  // ---------------------------
  const handleDelete = (id) => {
    Alert.alert('Delete Chat', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('rooms')
            .delete()
            .eq('id', id);

          if (error) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const renderRightActions = (_, __, id) => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => handleDelete(id)}
    >
      <Ionicons name="trash" size={24} color="white" />
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return <ActivityIndicator size="large" style={styles.center} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <Swipeable
              renderRightActions={(p, d) =>
                renderRightActions(p, d, item.id)
              }
            >
              <TouchableOpacity
                style={styles.groupItem}
                onPress={() =>
                  navigation.navigate('Chat', {
                    roomId: item.id,
                    roomName: item.name,
                  })
                }
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.name?.[0]?.toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.groupName}>{item.name}</Text>
                  <Text style={styles.subtext}>Swipe left to delete</Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            </Swipeable>
          )}
        />

        {/* Floating Add Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>

        {/* Add Group Modal */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Group</Text>

              <TextInput
                style={styles.input}
                placeholder="Group Name"
                value={newRoomName}
                onChangeText={setNewRoomName}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleCreateRoom}>
                  <Text style={styles.createText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

// ---------------------------
// STYLES (UNCHANGED)
// ---------------------------
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#fff' },
  groupItem: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: { fontSize: 20, fontWeight: 'bold' },
  groupName: { fontSize: 16, fontWeight: 'bold' },
  subtext: { fontSize: 12, color: '#888' },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#007AFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  deleteButton: {
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  deleteText: { color: 'white', fontWeight: 'bold' },

  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  input: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
  },
  cancelText: { color: 'red', fontSize: 16 },
  createText: { color: '#007AFF', fontSize: 16, fontWeight: 'bold' },
});
