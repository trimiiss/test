import React, { useEffect, useState, useRef } from 'react';
import { 
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform 
} from 'react-native';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

export default function ChatScreen({ route }) {
  const roomId = route.params?.roomId;
  const roomName = route.params?.roomName;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [image, setImage] = useState(null);

  const flatListRef = useRef();

  // --- FETCH USER ---
  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) setUser(data.user);
    };
    fetchUser();
  }, []);

  // --- FETCH MESSAGES & SUBSCRIBE ---
  useEffect(() => {
    if (!roomId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      if (!error) setMessages(data);
      setLoading(false);
    };

    fetchMessages();

    const channel = supabase.channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, payload => {
        if (payload.eventType === 'INSERT') setMessages(prev => [...prev, payload.new]);
        if (payload.eventType === 'DELETE') setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [roomId]);

  // --- MARK SEEN ---
  const markSeen = async (message) => {
    if (!message || !message.id || !user || !user.id) return;
    await supabase.from('message_status').upsert({
      message_id: message.id,
      user_id: user.id,
      seen: true
    });
  };

  // --- SEND MESSAGE ---
  // --- SEND MESSAGE ---ss

  const sendMessage = async () => {
    if (!newMessage.trim() && !image) return;
    if (!roomId || !user?.id) return;

    let imageUrl = null;
    if (image) {
      setUploading(true);
      const fileName = `${Date.now()}-${image.uri.split('/').pop()}`;
      const { data, error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, await fetch(image.uri).then(r => r.blob()));
      if (uploadError) { 
        console.log(uploadError); 
        setUploading(false);
        return; 
      }
      imageUrl = supabase.storage.from('chat-images').getPublicUrl(fileName).data.publicUrl;
      setImage(null);
      setUploading(false);
    }

    const { error } = await supabase.from('messages').insert([{
      room_id: roomId,
      user_id: user.id,
      content: newMessage,
      image_url: imageUrl
    }]);

    if (error) console.log("Send message error:", error.message);
    else setNewMessage('');
  };

  // --- PICK IMAGE ---
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  if (loading) return <ActivityIndicator size="large" style={styles.center} />;

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.header}>{roomName}</Text>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <TouchableOpacity style={item.user_id === user?.id ? styles.myMessage : styles.message} onPress={() => markSeen(item)}>
              {item.image_url && <Image source={{ uri: item.image_url }} style={styles.image} />}
              {item.content ? <Text>{item.content}</Text> : null}
              <Text style={styles.status}>
                {item.user_id === user?.id ? (item.seen ? '✅ Seen' : '📩 Sent') : ''}
              </Text>
            </TouchableOpacity>
          )}
        />

        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={pickImage}><Ionicons name="image-outline" size={28} color="#007AFF" /></TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type a message"
            value={newMessage}
            onChangeText={setNewMessage}
          />
          <TouchableOpacity onPress={sendMessage}>
            {uploading ? <ActivityIndicator /> : <Ionicons name="send" size={28} color="#007AFF" />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 15, fontSize: 18, fontWeight: 'bold', borderBottomWidth: 1, borderColor: '#eee' },
  message: { backgroundColor: '#f1f1f1', margin: 8, padding: 10, borderRadius: 10, maxWidth: '80%' },
  myMessage: { backgroundColor: '#007AFF', margin: 8, padding: 10, borderRadius: 10, maxWidth: '80%', alignSelf: 'flex-end', color: 'white' },
  inputContainer: { flexDirection: 'row', padding: 10, alignItems: 'center', borderTopWidth: 1, borderColor: '#eee' },
  input: { flex: 1, marginHorizontal: 10, padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 20 },
  image: { width: 150, height: 150, borderRadius: 10, marginBottom: 5 },
  status: { fontSize: 10, color: '#555', marginTop: 3 }
});
