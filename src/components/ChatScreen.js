import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert 
} from 'react-native';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';

export default function ChatScreen({ route, navigation }) {
  const { roomId, roomName } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  
  // User Info
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUsername, setCurrentUsername] = useState('User');

  // Edit Mode
  const [editingMessage, setEditingMessage] = useState(null); 

  // --- TYPING INDICATOR STATE ---
  const [typingText, setTypingText] = useState(''); 
  const typingTimeoutRef = useRef(null); 
  const lastTypedTime = useRef(0); 
  
  // --- FIX: Store the active channel here ---
  const channelRef = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle();
        setCurrentUsername(profile?.username || user.email);
      }
    };
    fetchUser();

    if (!roomId) return;
    navigation.setOptions({ title: roomName || 'Chat' });
    fetchMessages();

    // --- REALTIME CHANNEL SETUP ---
    // We assign it to channelRef.current so we can use it later to SEND signals
    channelRef.current = supabase.channel(`room:${roomId}`)
      // 1. Listen for Database Changes (Messages)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => handleRealtimeEvent(payload)
      )
      // 2. Listen for "Typing" Broadcasts
      .on('broadcast', { event: 'typing' }, (payload) => {
        // Only show if it's NOT me typing
        if (payload.payload.userId !== currentUserId) {
          setTypingText(`${payload.payload.username} is typing...`);
          
          // Clear the text after 3 seconds of silence
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setTypingText('');
          }, 3000);
        }
      })
      .subscribe();

    // Cleanup: Remove channel when leaving screen
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [roomId, currentUserId]); 

  const handleRealtimeEvent = (payload) => {
    if (payload.eventType === 'INSERT') {
      setMessages((prev) => [payload.new, ...prev]);
    } else if (payload.eventType === 'DELETE') {
      setMessages((prev) => prev.filter(msg => msg.id !== payload.old.id));
    } else if (payload.eventType === 'UPDATE') {
      setMessages((prev) => prev.map(msg => msg.id === payload.new.id ? payload.new : msg));
    }
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });
    if (!error) setMessages(data || []);
    setLoading(false);
  };

  // --- SEND TYPING EVENT (FIXED) ---
  const handleInputChange = (text) => {
    setInputText(text);

    const now = Date.now();
    // Only send if 2 seconds passed since last check
    if (now - lastTypedTime.current > 2000) {
      
      // FIX: Use channelRef.current to send
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { username: currentUsername, userId: currentUserId }
        });
      }
      
      lastTypedTime.current = now;
    }
  };

  const handleSendOrUpdate = async () => {
    if (!inputText.trim()) return;
    const textToSend = inputText.trim();
    setInputText(''); 

    if (editingMessage) {
      const { error } = await supabase.from('messages').update({ content: textToSend }).eq('id', editingMessage.id);
      if (error) Alert.alert("Error", "Update failed");
      setEditingMessage(null);
    } else {
      const { error } = await supabase.from('messages').insert({
        room_id: roomId,
        content: textToSend,
        sender_id: currentUserId,
        sender_name: currentUsername
      });
      if (error) Alert.alert("Error", "Send failed");
    }
  };

  const deleteMessage = async (messageId) => {
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) Alert.alert("Error", "Delete failed");
  };

  const handleLongPress = (item) => {
    if (item.sender_id !== currentUserId) return;
    Alert.alert("Options", "Choose action", [
      { text: "Cancel", style: "cancel" },
      { text: "Edit", onPress: () => { setEditingMessage(item); setInputText(item.content); } },
      { text: "Delete", style: "destructive", onPress: () => deleteMessage(item.id) },
    ]);
  };

  const cancelEdit = () => { setEditingMessage(null); setInputText(''); };

  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === currentUserId;
    const date = new Date(item.created_at);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.messageContainer, isMe ? styles.myMessageContainer : styles.theirMessageContainer]}>
        {!isMe && <Text style={styles.senderName}>{item.sender_name || 'Unknown'}</Text>}
        <TouchableOpacity onLongPress={() => handleLongPress(item)} activeOpacity={0.8}>
          <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
            <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>{item.content}</Text>
            <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText]}>{timeString}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) return <ActivityIndicator size="large" style={styles.center} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        inverted
        contentContainerStyle={styles.listContent}
        renderItem={renderMessage}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={90}>
        
        {/* --- TYPING INDICATOR UI --- */}
        {typingText !== '' && (
          <View style={styles.typingContainer}>
            <Text style={styles.typingText}>{typingText}</Text>
          </View>
        )}

        {editingMessage && (
          <View style={styles.editBar}>
            <Text style={styles.editText}>Editing message...</Text>
            <TouchableOpacity onPress={cancelEdit}><Ionicons name="close-circle" size={24} color="red" /></TouchableOpacity>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#888"
            value={inputText}
            onChangeText={handleInputChange} 
            multiline
          />
          <TouchableOpacity onPress={handleSendOrUpdate} style={styles.sendButton}>
            <Ionicons name={editingMessage ? "checkmark" : "send"} size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 15, paddingBottom: 20 },
  messageContainer: { marginBottom: 10, maxWidth: '80%' },
  myMessageContainer: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirMessageContainer: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderName: { fontSize: 12, color: '#666', marginBottom: 4, marginLeft: 4 },
  bubble: { padding: 12, borderRadius: 20 },
  myBubble: { backgroundColor: '#007AFF', borderBottomRightRadius: 2 },
  theirBubble: { backgroundColor: '#E5E5EA', borderBottomLeftRadius: 2 },
  messageText: { fontSize: 16 },
  myText: { color: '#fff' },
  theirText: { color: '#000' },
  timeText: { fontSize: 10, marginTop: 5, textAlign: 'right' },
  myTimeText: { color: 'rgba(255, 255, 255, 0.7)' },
  theirTimeText: { color: 'rgba(0, 0, 0, 0.4)' },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', alignItems: 'center', borderTopWidth: 1, borderColor: '#eee' },
  input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, fontSize: 16, maxHeight: 100, marginRight: 10 },
  sendButton: { backgroundColor: '#007AFF', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' },
  editBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#eee', borderTopWidth: 1, borderColor: '#ccc' },
  editText: { color: '#555', fontStyle: 'italic' },
  
  typingContainer: { paddingHorizontal: 20, paddingBottom: 5, backgroundColor: '#f5f5f5' },
  typingText: { fontSize: 12, color: '#888', fontStyle: 'italic' }
});