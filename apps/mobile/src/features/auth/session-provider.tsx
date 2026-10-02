import type { Session } from "@supabase/supabase-js";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface SessionState {
  session: Session | null;
  /** 保存済みのセッションを読み込み中 */
  isLoading: boolean;
}

const SessionContext = createContext<SessionState>({ session: null, isLoading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, isLoading: true });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, isLoading: false });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, isLoading: false });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <SessionContext value={state}>{children}</SessionContext>;
}

export function useSession(): SessionState {
  return use(SessionContext);
}

/** ログイン中のユーザーの ID。ログアウトの途中など、未ログインのときは null */
export function useUserId(): string | null {
  return useSession().session?.user.id ?? null;
}
