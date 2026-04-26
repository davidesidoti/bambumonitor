import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { JobDetail, SendJobBody, SendJobResult } from "@/types/jobs";

export function useUploadJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiFetch<JobDetail>("/jobs/upload", {
        method: "POST",
        body: fd,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useJob(id: number | null) {
  return useQuery({
    queryKey: ["jobs", id],
    queryFn: () => apiFetch<JobDetail>(`/jobs/${id}`),
    enabled: id != null,
  });
}

export function useSendJob(jobId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SendJobBody) =>
      apiFetch<SendJobResult>(`/jobs/${jobId}/send`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs", jobId] });
    },
  });
}
