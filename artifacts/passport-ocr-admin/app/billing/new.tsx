import {
  type BillingDocumentInput,
  getListBillingDocumentsQueryKey,
  getListSalaryRecordsQueryKey,
  useCreateBillingDocument,
  useUpdateSalaryRecord,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import React from "react";

import BillingDocumentForm, {
  type BillingFormState,
} from "@/components/BillingDocumentForm";

export default function NewBillingDocumentScreen() {
  const queryClient = useQueryClient();
  const createMutation = useCreateBillingDocument();
  const updateSalaryMutation = useUpdateSalaryRecord();

  const handleSubmit = async (form: BillingFormState) => {
    const payload: BillingDocumentInput = {
      kind: form.kind,
      companyId: form.companyId!,
      ...(form.clientId != null && { clientId: form.clientId }),
      customerName: form.customerName.trim(),
      issueDate: form.issueDate.trim(),
      items: form.items.map((it) => ({
        description: it.description.trim(),
        detail: it.detail.trim() || undefined,
        qty: it.qty || "1",
        rate: it.rate || "0",
      })),
      ...(form.customerAddress.trim() && { customerAddress: form.customerAddress.trim() }),
      ...(form.customerTin.trim() && { customerTin: form.customerTin.trim() }),
      ...(form.dueDate.trim() && { dueDate: form.dueDate.trim() }),
      ...(form.terms.trim() && { terms: form.terms.trim() }),
      gstRate: form.gstRate || "0",
      gstInclusive: form.gstInclusive,
      ...(form.notes.trim() && { notes: form.notes.trim() }),
      status: form.status,
    };

    const result = await createMutation.mutateAsync({ data: payload });

    // Link selected salary records to this invoice
    if (form.linkedSalaryIds?.length) {
      await Promise.all(
        form.linkedSalaryIds.map((sid) =>
          updateSalaryMutation.mutateAsync({ id: sid, data: { invoiceId: result.id } }),
        ),
      );
      await queryClient.invalidateQueries({ queryKey: getListSalaryRecordsQueryKey() });
    }

    await queryClient.invalidateQueries({ queryKey: getListBillingDocumentsQueryKey() });
    router.replace(`/billing/${result.id}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: "New Document" }} />
      <BillingDocumentForm
        onSubmit={handleSubmit}
        isSaving={createMutation.isPending}
        submitLabel="Create Document"
      />
    </>
  );
}
