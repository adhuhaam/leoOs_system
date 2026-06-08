import {
  type BillingDocument,
  type BillingDocumentUpdate,
  getGetBillingDocumentQueryKey,
  getListBillingDocumentsQueryKey,
  useGetBillingDocument,
  useUpdateBillingDocument,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, Text, View, StyleSheet } from "react-native";
import { Feather } from "@/components/Icon";

import BillingDocumentForm, {
  type BillingFormState,
} from "@/components/BillingDocumentForm";
import { useColors } from "@/hooks/useColors";

export default function EditBillingDocumentScreen() {
  const colors = useColors();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Number(rawId);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useGetBillingDocument(id, {
    query: {
      enabled: !Number.isNaN(id),
      queryKey: getGetBillingDocumentQueryKey(id),
    },
  });

  const updateMutation = useUpdateBillingDocument();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: "Edit Document" }} />
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: "Edit Document" }} />
        <Feather name="alert-triangle" size={28} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>
          {error instanceof Error ? error.message : "Document not found"}
        </Text>
        <Pressable
          onPress={() => refetch()}
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const doc = data as BillingDocument;

  const initialValues: Partial<BillingFormState> = {
    kind: doc.kind as "invoice" | "quotation",
    companyId: doc.companyId,
    clientId: (doc as any).clientId ?? null,
    customerName: doc.customerName ?? "",
    customerAddress: doc.customerAddress ?? "",
    customerTin: doc.customerTin ?? "",
    issueDate: doc.issueDate ?? "",
    dueDate: doc.dueDate ?? "",
    terms: doc.terms ?? "",
    gstRate: doc.gstRate ?? "0",
    gstInclusive: doc.gstInclusive ?? false,
    notes: doc.notes ?? "",
    status: doc.status ?? "draft",
    items:
      doc.items.length > 0
        ? doc.items.map((it) => ({
            description: it.description,
            detail: it.detail ?? "",
            qty: String(it.qty ?? "1"),
            rate: String(it.rate ?? "0"),
          }))
        : [{ description: "", detail: "", qty: "1", rate: "" }],
  };

  const handleSubmit = async (form: BillingFormState) => {
    const payload: BillingDocumentUpdate = {
      companyId: form.companyId ?? undefined,
      clientId: form.clientId ?? undefined,
      customerName: form.customerName.trim(),
      customerAddress: form.customerAddress.trim() || null,
      customerTin: form.customerTin.trim() || null,
      issueDate: form.issueDate.trim(),
      dueDate: form.dueDate.trim() || null,
      terms: form.terms.trim() || null,
      gstRate: form.gstRate || "0",
      gstInclusive: form.gstInclusive,
      notes: form.notes.trim() || null,
      status: form.status,
      items: form.items.map((it) => ({
        description: it.description.trim(),
        detail: it.detail.trim() || undefined,
        qty: it.qty || "1",
        rate: it.rate || "0",
      })),
    };

    await updateMutation.mutateAsync({ id, data: payload });
    await queryClient.invalidateQueries({ queryKey: getGetBillingDocumentQueryKey(id) });
    await queryClient.invalidateQueries({ queryKey: getListBillingDocumentsQueryKey() });
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: `Edit ${doc.kind === "invoice" ? "Invoice" : "Quote"} ${doc.number}`,
        }}
      />
      <BillingDocumentForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        isSaving={updateMutation.isPending}
        submitLabel="Save Changes"
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  errorText: { fontSize: 14, textAlign: "center", },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 14 },
});
