import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ApiError, api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { currentUserId } from "@/features/data/util";
import { getNotificationPermission } from "./permissions";

/**
 * サーバーからのプッシュ通知(オートメーションの結果、予約の追加・キャンセル、通知の張り直しの合図)を
 * 受け取るための、端末のトークンの登録。
 *
 * 次のときは登録しない(エラーにはしない):
 * - 通知が許可されていない
 * - エミュレータ・シミュレータ(トークンが取れない)
 * - Android の Expo Go(SDK 53 以降はプッシュ通知が使えない。development build が要る)
 * - EAS のプロジェクト ID が app.json に無い(`eas init` がまだ)
 */

export type PushRegistration =
  | { status: "registered"; token: string }
  | { status: "skipped"; reason: "no_permission" | "not_device" | "expo_go" | "no_project_id" }
  | { status: "failed"; message: string };

let lastToken: string | null = null;

function projectId(): string | null {
  const id = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof id === "string" && id ? id : null;
}

export async function registerPushToken(): Promise<PushRegistration> {
  if ((await getNotificationPermission()) !== "granted") return { status: "skipped", reason: "no_permission" };
  if (!Device.isDevice) return { status: "skipped", reason: "not_device" };
  if (Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return { status: "skipped", reason: "expo_go" };
  }
  const id = projectId();
  if (!id) return { status: "skipped", reason: "no_project_id" };
  if (Platform.OS !== "ios" && Platform.OS !== "android") return { status: "skipped", reason: "not_device" };

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    const device = {
      expo_push_token: token,
      platform: Platform.OS,
      device_name: Device.deviceName ?? Device.modelName ?? null,
      app_version: Constants.expoConfig?.version ?? null,
    };
    await saveDevice(device);
    lastToken = token;
    return { status: "registered", token };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[push] トークンを登録できませんでした", message);
    return { status: "failed", message };
  }
}

/**
 * 端末の登録は Web の API(POST /api/devices、S4)で行う。
 * API がまだ無い開発中は、自分の行として push_devices に直接書く(行レベルセキュリティで許可されている)。
 */
async function saveDevice(device: {
  expo_push_token: string;
  platform: "ios" | "android";
  device_name: string | null;
  app_version: string | null;
}) {
  try {
    await api.post("/api/devices", device);
  } catch (error) {
    if (!(error instanceof ApiError) || ![404, 405, 501].includes(error.status)) throw error;
    const user_id = await currentUserId();
    const { error: dbError } = await supabase
      .from("push_devices")
      .upsert({ ...device, user_id, last_seen_at: new Date().toISOString() }, { onConflict: "expo_push_token" });
    if (dbError) throw dbError;
  }
}

/** ログアウトの前に呼ぶ。この端末に、ログアウトした人宛ての通知が届かないようにする */
export async function unregisterPushToken(): Promise<void> {
  const token = lastToken;
  if (!token) return;
  lastToken = null;
  try {
    await api.delete("/api/devices", { expo_push_token: token });
  } catch {
    await supabase.from("push_devices").delete().eq("expo_push_token", token);
  }
}
