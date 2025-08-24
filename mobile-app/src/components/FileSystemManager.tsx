import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { fileSystemManager, LocalAudioFile, FileSystemStats } from '../utils/fileSystem';
import { useLocalAuth } from '../hooks/useLocalAuth';

interface FileSystemManagerProps {
  isVisible: boolean;
  onClose: () => void;
  onFileSelect?: (file: LocalAudioFile) => void;
}

export default function FileSystemManager({ 
  isVisible, 
  onClose, 
  onFileSelect 
}: FileSystemManagerProps) {
  const { user } = useLocalAuth();
  const [audioFiles, setAudioFiles] = useState<LocalAudioFile[]>([]);
  const [stats, setStats] = useState<FileSystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (isVisible) {
      loadFiles();
      loadStats();
    }
  }, [isVisible]);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      await fileSystemManager.initialize();
      const files = await fileSystemManager.getAllAudioFiles();
      setAudioFiles(files);
    } catch (error) {
      console.error('❌ Failed to load files:', error);
      Alert.alert('Error', 'Failed to load audio files');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const fileStats = await fileSystemManager.getFileSystemStats();
      setStats(fileStats);
    } catch (error) {
      console.error('❌ Failed to load stats:', error);
    }
  };

  const handleAddFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setIsLoading(true);
      const addedFiles: LocalAudioFile[] = [];

      for (const asset of result.assets) {
        if (fileSystemManager.isAudioFile(asset.name)) {
          try {
            const savedFile = await fileSystemManager.saveAudioFile(asset.uri, asset.name);
            addedFiles.push(savedFile);
          } catch (error) {
            console.error(`❌ Failed to save ${asset.name}:`, error);
          }
        }
      }

      if (addedFiles.length > 0) {
        await loadFiles();
        await loadStats();
        Alert.alert('Success', `Added ${addedFiles.length} audio file(s)`);
      } else {
        Alert.alert('Error', 'No valid audio files were added');
      }
    } catch (error) {
      console.error('❌ Failed to add files:', error);
      Alert.alert('Error', 'Failed to add audio files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    Alert.alert(
      'Delete File',
      'Are you sure you want to delete this audio file? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await fileSystemManager.deleteAudioFile(fileId);
            if (success) {
              await loadFiles();
              await loadStats();
            }
          }
        }
      ]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;

    Alert.alert(
      'Delete Files',
      `Are you sure you want to delete ${selectedFiles.size} audio file(s)? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            let deletedCount = 0;
            for (const fileId of selectedFiles) {
              const success = await fileSystemManager.deleteAudioFile(fileId);
              if (success) deletedCount++;
            }
            setSelectedFiles(new Set());
            await loadFiles();
            await loadStats();
            Alert.alert('Success', `Deleted ${deletedCount} file(s)`);
            setIsLoading(false);
          }
        }
      ]
    );
  };

  const handleCleanupOldFiles = async () => {
    Alert.alert(
      'Cleanup Old Files',
      'This will delete audio files that haven\'t been accessed in 30 days. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cleanup',
          onPress: async () => {
            setIsLoading(true);
            const deletedCount = await fileSystemManager.cleanupOldFiles();
            await loadFiles();
            await loadStats();
            Alert.alert('Cleanup Complete', `Deleted ${deletedCount} old file(s)`);
            setIsLoading(false);
          }
        }
      ]
    );
  };

  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <Modal visible={isVisible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Audio Files</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.statsButton}
              onPress={() => setShowStats(!showStats)}
            >
              <Text style={styles.statsButtonText}>📊</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Panel */}
        {showStats && stats && (
          <View style={styles.statsPanel}>
            <Text style={styles.statsTitle}>Storage Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.totalFiles}</Text>
                <Text style={styles.statLabel}>Files</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {fileSystemManager.formatFileSize(stats.totalSize)}
                </Text>
                <Text style={styles.statLabel}>Used</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {fileSystemManager.formatFileSize(stats.availableSpace)}
                </Text>
                <Text style={styles.statLabel}>Available</Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddFiles}
            disabled={isLoading}
          >
            <Text style={styles.addButtonText}>
              {isLoading ? '⏳' : '📁'} Add Files
            </Text>
          </TouchableOpacity>

          {selectedFiles.size > 0 && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteSelected}
            >
              <Text style={styles.deleteButtonText}>
                🗑️ Delete ({selectedFiles.size})
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.cleanupButton}
            onPress={handleCleanupOldFiles}
          >
            <Text style={styles.cleanupButtonText}>🧹 Cleanup</Text>
          </TouchableOpacity>
        </View>

        {/* File List */}
        <ScrollView style={styles.fileList}>
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading files...</Text>
            </View>
          )}

          {!isLoading && audioFiles.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No audio files found</Text>
              <Text style={styles.emptySubtext}>
                Tap "Add Files" to import audio files
              </Text>
            </View>
          )}

          {!isLoading && audioFiles.map((file) => (
            <TouchableOpacity
              key={file.id}
              style={[
                styles.fileItem,
                selectedFiles.has(file.id) && styles.fileItemSelected
              ]}
              onPress={() => onFileSelect ? onFileSelect(file) : toggleFileSelection(file.id)}
              onLongPress={() => toggleFileSelection(file.id)}
            >
              <View style={styles.fileIcon}>
                <Text style={styles.fileIconText}>🎵</Text>
              </View>
              
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.originalName}
                </Text>
                <View style={styles.fileDetails}>
                  <Text style={styles.fileDetail}>
                    {fileSystemManager.formatFileSize(file.size)}
                  </Text>
                  <Text style={styles.fileDetail}>•</Text>
                  <Text style={styles.fileDetail}>
                    {formatDuration(file.duration)}
                  </Text>
                  <Text style={styles.fileDetail}>•</Text>
                  <Text style={styles.fileDetail}>
                    {formatDate(file.createdAt)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.deleteIconButton}
                onPress={() => handleDeleteFile(file.id)}
              >
                <Text style={styles.deleteIcon}>🗑️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {/* Bottom padding */}
          <View style={{ height: 50 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  statsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsButtonText: {
    fontSize: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  statsPanel: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  addButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#F44336',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  cleanupButton: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cleanupButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  fileList: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#aaa',
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  fileItemSelected: {
    backgroundColor: '#333',
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileIconText: {
    fontSize: 18,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  fileDetails: {
    flexDirection: 'row',
    gap: 8,
  },
  fileDetail: {
    fontSize: 12,
    color: '#aaa',
  },
  deleteIconButton: {
    padding: 8,
  },
  deleteIcon: {
    fontSize: 16,
  },
});