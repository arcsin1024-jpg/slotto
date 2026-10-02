import { useMutation } from "@tanstack/react-query";
import { signOut } from "@/features/auth/auth";
import { api } from "@/lib/api";

/** アカウント削除(POST /api/account/delete)。消えたらログアウトする */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      await api.post("/api/account/delete");
      await signOut();
    },
  });
}
