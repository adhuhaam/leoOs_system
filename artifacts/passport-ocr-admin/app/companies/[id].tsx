import { Feather } from "@/components/Icon";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListCompaniesQueryKey,
  type Company,
  useListCompanies,
  useUpdateCompany,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useColors } from "@/hooks/useColors";

// ─── Branding upload ──────────────────────────────────────────────────────────

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";
const TOKEN_KEY = "leo_admin_session_token";

type EditableField =
  | "name"
  | "address"
  | "email"
  | "phone"
  | "country"
  | "registrationNumber"
  | "signatoryName"
  | "signatoryDesignation"
  | "bankName"
  | "bankAccountHolder"
  | "bankAccountNumber"
  | "bankSwiftCode";

const FIELDS: { key: EditableField; label: string; multiline?: boolean; keyboard?: "email-address" | "phone-pad" }[] = [
  { key: "name", label: "Company name" },
  { key: "address", label: "Address", multiline: true },
  { key: "email", label: "Email", keyboard: "email-address" },
  { key: "phone", label: "Phone", keyboard: "phone-pad" },
  { key: "country", label: "Country" },
  { key: "registrationNumber", label: "Registration number" },
  { key: "signatoryName", label: "Signatory name" },
  { key: "signatoryDesignation", label: "Signatory designation" },
  { key: "bankName", label: "Bank name" },
  { key: "bankAccountHolder", label: "Account holder" },
  { key: "bankAccountNumber", label: "Account number" },
  { key: "bankSwiftCode", label: "SWIFT / BIC code" },
];

type FormState = Record<EditableField, string>;

const EMPTY_FORM: FormState = {
  name: "",
  address: "",
  email: "",
  phone: "",
  country: "",
  registrationNumber: "",
  signatoryName: "",
  signatoryDesignation: "",
  bankName: "",
  bankAccountHolder: "",
  bankAccountNumber: "",
  bankSwiftCode: "",
};

function toForm(c: Company): FormState {
  return {
    name: c.name ?? "",
    address: c.address ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    country: c.country ?? "",
    registrationNumber: c.registrationNumber ?? "",
    signatoryName: c.signatoryName ?? "",
    signatoryDesignation: c.signatoryDesignation ?? "",
    bankName: c.bankName ?? "",
    bankAccountHolder: c.bankAccountHolder ?? "",
    bankAccountNumber: c.bankAccountNumber ?? "",
    bankSwiftCode: c.bankSwiftCode ?? "",
  };
}

export default function CompanyEditScreen() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const companyId = Number(rawId);

  const { data: companies = [], isLoading, isError, refetch } = useListCompanies(undefined, {
    query: { queryKey: getListCompaniesQueryKey() },
  });

  const { data: brandedCompanies = [] } = useListCompanies(
    { withBranding: true },
    { query: { enabled: !isLoading, queryKey: getListCompaniesQueryKey({ withBranding: true }) } },
  );

  const company = useMemo(
    () => (companies as Company[]).find((c) => c.id === companyId) ?? null,
    [companies, companyId],
  );

  const brandingData = useMemo(
    () => (brandedCompanies as Company[]).find((c) => c.id === companyId) ?? null,
    [brandedCompanies, companyId],
  );

  const updateMutation = useUpdateCompany();
  const brandingMutation = useUpdateCompany();
  const [brandingUploading, setBrandingUploading] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (company && !dirty) setForm(toForm(company));
  }, [company, dirty]);

  function setField(key: EditableField, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function handlePickImage(kind: "letterheadImage" | "signatureImage") {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Allow access to your photo library to upload images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setBrandingUploading(true);
    try {
      // Compress to JPEG binary (no base64) — multipart bypasses proxy JSON limits
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
      );
      const fieldName = kind === "letterheadImage" ? "letterhead" : "signature";
      const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      const fd = new FormData();
      fd.append(fieldName, { uri: compressed.uri, name: "image.jpg", type: "image/jpeg" } as unknown as Blob);
      const res = await fetch(`${BASE_URL}/api/companies/${companyId}/branding`, {
        method: "POST",
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "Upload failed");
        throw new Error(text);
      }
      await queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey({ withBranding: true }) });
      Alert.alert("Saved", kind === "letterheadImage" ? "Letterhead saved." : "Signature saved.");
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBrandingUploading(false);
    }
  }

  function handleClearImage(kind: "letterheadImage" | "signatureImage") {
    Alert.alert(
      "Remove image",
      `Remove ${kind === "letterheadImage" ? "letterhead" : "signature"} image?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await brandingMutation.mutateAsync({
                id: companyId,
                data: { [kind]: null } as Parameters<typeof brandingMutation.mutateAsync>[0]["data"],
              });
              await queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey({ withBranding: true }) });
            } catch (err) {
              Alert.alert("Failed", err instanceof Error ? err.message : "Please try again.");
            }
          },
        },
      ],
    );
  }

  async function handleSave() {
    if (!company || !dirty) return;
    if (!form.name.trim()) {
      Alert.alert("Required", "Company name is required.");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: companyId,
        data: {
          name: form.name.trim(),
          address: form.address.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          country: form.country.trim() || undefined,
          registrationNumber: form.registrationNumber.trim() || undefined,
          signatoryName: form.signatoryName.trim() || undefined,
          signatoryDesignation: form.signatoryDesignation.trim() || undefined,
          bankName: form.bankName.trim() || null,
          bankAccountHolder: form.bankAccountHolder.trim() || null,
          bankAccountNumber: form.bankAccountNumber.trim() || null,
          bankSwiftCode: form.bankSwiftCode.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
      setDirty(false);
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Saved", "Company updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Please try again.");
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: "Company" }} />
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !company) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: "Company" }} />
        <Feather name="alert-triangle" size={28} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>Company not found</Text>
        <Pressable
          onPress={() => refetch()}
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: company.name ?? "Company" }} />

      {FIELDS.map((field) => (
        <View key={field.key} style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            {field.label.toUpperCase()}
          </Text>
          <TextInput
            value={form[field.key]}
            onChangeText={(v) => setField(field.key, v)}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            placeholderTextColor={colors.mutedForeground}
            multiline={field.multiline}
            keyboardType={field.keyboard ?? "default"}
            autoCapitalize={field.keyboard === "email-address" ? "none" : "words"}
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                color: colors.foreground,
                borderColor: colors.border,
                minHeight: field.multiline ? 80 : 48,
                textAlignVertical: field.multiline ? "top" : "center",
              },
            ]}
          />
        </View>
      ))}

      {/* ─── Branding section ─── */}
      <View style={[styles.brandingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.brandingHeader}>
          <Feather name="image" size={16} color={colors.mutedForeground} />
          <Text style={[styles.brandingSectionTitle, { color: colors.foreground }]}>
            Branding
          </Text>
          {(brandingMutation.isPending || brandingUploading) && (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 4 }} />
          )}
        </View>
        <Text style={[styles.brandingHint, { color: colors.mutedForeground }]}>
          Images save immediately when selected. Used on LOA prints.
        </Text>

        {(["letterheadImage", "signatureImage"] as const).map((kind) => {
          const label = kind === "letterheadImage" ? "Letterhead" : "Signature";
          const hint =
            kind === "letterheadImage"
              ? "Appears at top of LOA prints"
              : "Printed above signatory name";
          const current = brandingData?.[kind] ?? null;
          return (
            <View key={kind} style={styles.imageSlot}>
              <View style={styles.imageSlotHeader}>
                <Text style={[styles.imageSlotLabel, { color: colors.mutedForeground }]}>
                  {label.toUpperCase()}
                </Text>
                <Text style={[styles.imageSlotHint, { color: colors.mutedForeground }]}>
                  {hint}
                </Text>
              </View>
              {current ? (
                <View style={[styles.imagePreviewWrap, { borderColor: colors.border }]}>
                  <Image
                    source={{ uri: current }}
                    style={styles.imagePreview}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <View
                  style={[
                    styles.imagePlaceholder,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                  ]}
                >
                  <Feather name="image" size={24} color={colors.mutedForeground} />
                  <Text style={[styles.imagePlaceholderText, { color: colors.mutedForeground }]}>
                    No image
                  </Text>
                </View>
              )}
              <View style={styles.imageActions}>
                <Pressable
                  onPress={() => handlePickImage(kind)}
                  disabled={brandingMutation.isPending || brandingUploading}
                  style={({ pressed }) => [
                    styles.imageBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: (brandingMutation.isPending || brandingUploading) ? 0.5 : pressed ? 0.8 : 1,
                      flex: 1,
                    },
                  ]}
                >
                  <Feather name="upload" size={14} color={colors.primaryForeground} />
                  <Text style={[styles.imageBtnText, { color: colors.primaryForeground }]}>
                    {current ? "Replace" : "Upload"}
                  </Text>
                </Pressable>
                {current && (
                  <Pressable
                    onPress={() => handleClearImage(kind)}
                    disabled={brandingMutation.isPending || brandingUploading}
                    style={({ pressed }) => [
                      styles.imageBtn,
                      {
                        backgroundColor: colors.destructive + "18",
                        borderColor: colors.destructive + "40",
                        borderWidth: 1,
                        opacity: (brandingMutation.isPending || brandingUploading) ? 0.5 : pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <Pressable
        onPress={handleSave}
        disabled={!dirty || updateMutation.isPending}
        style={({ pressed }) => [
          styles.primaryBtn,
          {
            backgroundColor: colors.primary,
            opacity: !dirty || updateMutation.isPending ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {updateMutation.isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Feather name="save" size={18} color={colors.primaryForeground} />
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
              Save changes
            </Text>
          </>
        )}
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 11, letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  primaryBtnText: { fontSize: 15, },
  errorText: { fontSize: 14, textAlign: "center", },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 14 },
  // branding
  brandingCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginTop: 4,
  },
  brandingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandingSectionTitle: { fontSize: 15, },
  brandingHint: { fontSize: 11, marginTop: -4 },
  imageSlot: { gap: 8 },
  imageSlotHeader: { gap: 2 },
  imageSlotLabel: { fontSize: 10, letterSpacing: 0.5 },
  imageSlotHint: { fontSize: 11, },
  imagePreviewWrap: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreview: { width: "100%", height: 110 },
  imagePlaceholder: {
    height: 110,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  imagePlaceholderText: { fontSize: 12, },
  imageActions: { flexDirection: "row", gap: 8 },
  imageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  imageBtnText: { fontSize: 13, },
});
