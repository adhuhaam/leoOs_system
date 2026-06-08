import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import {
  fileNameFromUri,
  inferMimeType,
  type PickedFile,
  uploadPassportFile,
} from "@/lib/api";

export default function UploadScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cameraPermission, requestCameraPermission] =
    ImagePicker.useCameraPermissions();

  const isPdf = picked?.mimeType === "application/pdf";

  async function handleTakePhoto() {
    if (Platform.OS !== "web") {
      if (!cameraPermission) return;
      if (!cameraPermission.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          Alert.alert(
            "Camera permission needed",
            "Please grant camera access to capture passports.",
          );
          return;
        }
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPicked({
      uri: asset.uri,
      name: asset.fileName ?? fileNameFromUri(asset.uri),
      mimeType: asset.mimeType ?? inferMimeType(asset.uri, "image/jpeg"),
    });
  }

  async function handlePickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPicked({
      uri: asset.uri,
      name: asset.name ?? fileNameFromUri(asset.uri),
      mimeType:
        asset.mimeType ?? inferMimeType(asset.name ?? asset.uri, "image/jpeg"),
    });
  }

  async function handleUpload() {
    if (!picked || uploading) return;
    setUploading(true);
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const passport = await uploadPassportFile(picked);
      await queryClient.invalidateQueries({ queryKey: ["/api/passports"] });
      setPicked(null);
      router.push(`/passport/${passport.id}`);
    } catch (err) {
      Alert.alert(
        "Upload failed",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.heading, { color: colors.foreground }]}>
        Scan a passport
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Capture a photo or pick a file. We support JPG, PNG, and PDF.
      </Text>

      <View
        style={[
          styles.preview,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {picked ? (
          isPdf ? (
            <View style={styles.pdfPreview}>
              <Feather name="file-text" size={48} color={colors.primary} />
              <Text
                numberOfLines={1}
                style={[styles.pdfName, { color: colors.foreground }]}
              >
                {picked.name}
              </Text>
              <Text style={[styles.pdfMeta, { color: colors.mutedForeground }]}>
                PDF document
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: picked.uri }}
              style={styles.image}
              contentFit="cover"
            />
          )
        ) : (
          <View style={styles.previewPlaceholder}>
            <Feather name="image" size={36} color={colors.mutedForeground} />
            <Text style={[styles.previewText, { color: colors.mutedForeground }]}>
              No file selected
            </Text>
          </View>
        )}
        {picked && (
          <Pressable
            onPress={() => setPicked(null)}
            style={[styles.clearBtn, { backgroundColor: colors.background }]}
            hitSlop={6}
          >
            <Feather name="x" size={16} color={colors.foreground} />
          </Pressable>
        )}
      </View>

      <View style={styles.actions}>
        <ActionButton
          icon="camera"
          label="Take photo"
          onPress={handleTakePhoto}
          primary
          disabled={uploading}
        />
        <ActionButton
          icon="folder"
          label="Choose file"
          onPress={handlePickFile}
          disabled={uploading}
        />
      </View>

      <Pressable
        onPress={handleUpload}
        disabled={!picked || uploading}
        style={({ pressed }) => [
          styles.uploadBtn,
          {
            backgroundColor: colors.primary,
            opacity: !picked || uploading ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {uploading ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Feather
              name="upload-cloud"
              size={18}
              color={colors.primaryForeground}
            />
            <Text
              style={[styles.uploadText, { color: colors.primaryForeground }]}
            >
              Upload & extract
            </Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  primary,
  disabled,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const colors = useColors();
  const bg = primary ? colors.foreground : colors.card;
  const fg = primary ? colors.background : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        {
          backgroundColor: bg,
          borderColor: primary ? colors.foreground : colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Feather name={icon} size={18} color={fg} />
      <Text style={[styles.actionLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  heading: { fontSize: 24, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 4 },
  preview: {
    aspectRatio: 3 / 4,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  pdfPreview: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  pdfName: { fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  pdfMeta: { fontSize: 12, fontFamily: "Inter_500Medium" },
  previewPlaceholder: { alignItems: "center", gap: 10 },
  previewText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  clearBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  uploadText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
