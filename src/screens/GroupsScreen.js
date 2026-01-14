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

  // --- MODAL STATE ---
  const [modalVisible, setModalVisible] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    fetchGroups();

    const channel = supabase
      .channel('public:rooms')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        () => fetchGroups()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchGroups = async () => {
    // 👇 FIX: ONLY FETCH ROWS WHERE is_group IS TRUE
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_group', true) // <--- THIS HIDES PRIVATE CHATS
      .order('created_at', { ascending: false });

    if (!error) setGroups(data || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!inputText.trim()) return;

    if (isRenaming && selectedGroup) {
      // RENAME
      const { error } = await supabase
        .from('rooms')
        .update({ name: inputText.trim() })
        .eq('id', selectedGroup.id);
      if (error) Alert.alert('Error', error.message);
    } else {
      // CREATE NEW GROUP (is_group defaults to TRUE)
      const { error } = await supabase
        .from('rooms')
        .insert({ 
          name: inputText.trim(),
          is_group: true // Explicitly mark as a group
        });
      if (error) Alert.alert('Error', error.message);
    }

    setInputText('');
    setModalVisible(false);
    setIsRenaming(false);
    setSelectedGroup(null);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Group', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('rooms').delete().eq('id', id);
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

  const openEditModal = (group) => {
    setIsRenaming(true);
    setSelectedGroup(group);
    setInputText(group.name);
    setModalVisible(true);
  };

  const openCreateModal = () => {
    setIsRenaming(false);
    setSelectedGroup(null);
    setInputText('');
    setModalVisible(true);
  };

  if (loading) return <ActivityIndicator size="large" style={styles.center} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <Swipeable renderRightActions={(p, d) => renderRightActions(p, d, item.id)}>
              <TouchableOpacity
                style={styles.groupItem}
                onPress={() => navigation.navigate('ChatScreen', { roomId: item.id, roomName: item.name })}
                onLongPress={() => openEditModal(item)}
                delayLongPress={500}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupName}>{item.name}</Text>
                  <Text style={styles.subtext}>Group Chat</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            </Swipeable>
          )}
        />

        <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>

        {/* MODAL (Same as before) */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{isRenaming ? "Rename Group" : "New Group"}</Text>
              <TextInput
                style={styles.input}
                placeholder="Group Name"
                value={inputText}
                onChangeText={setInputText}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSubmit}>
                  <Text style={styles.createText}>{isRenaming ? "Save" : "Create"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#fff' },
  groupItem: { flexDirection: 'row', padding: 15, alignItems: 'center', backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#eee' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontSize: 20, fontWeight: 'bold' },
  groupName: { fontSize: 16, fontWeight: 'bold' },
  subtext: { fontSize: 12, color: '#888' },
  fab: { position: 'absolute', bottom: 30, right: 30, backgroundColor: '#007AFF', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  deleteButton: { backgroundColor: 'red', justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' },
  deleteText: { color: 'white', fontWeight: 'bold' },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '80%', backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  input: { borderBottomWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  cancelText: { color: 'red', fontSize: 16 },
  createText: { color: '#007AFF', fontSize: 16, fontWeight: 'bold' },
});