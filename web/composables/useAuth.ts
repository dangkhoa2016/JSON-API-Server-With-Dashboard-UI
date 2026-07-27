import { ref, computed } from "vue";
import { trpc, trpcClient } from "@/providers/trpc";
import { getAuthToken, setAuthToken } from "@/lib/authToken";

const user = ref<{ username: string; role: string } | null>(null);
const authResolved = ref(false);

let lastVerifiedToken: string | null = null;
let verifyPromise: Promise<void> | null = null;

function verifyToken() {
  if (verifyPromise) return verifyPromise;
  const currentToken = getAuthToken();
  if (!currentToken) {
    authResolved.value = true;
    return Promise.resolve();
  }
  verifyPromise = trpcClient
    .query("admin.auth.verify")
    .then(result => {
      const auth = result as { ok: boolean; username?: string; role?: string };
      if (auth.ok && auth.username && auth.role) {
        user.value = { username: auth.username, role: auth.role };
      } else {
        setAuthToken(null);
        user.value = null;
      }
      lastVerifiedToken = currentToken;
    })
    .catch(err => {
      console.warn("[auth] verify failed:", err);
    })
    .finally(() => {
      authResolved.value = true;
      verifyPromise = null;
    });
  return verifyPromise;
}

export function useAuth() {
  const currentToken = getAuthToken();
  if (currentToken && lastVerifiedToken !== currentToken) {
    lastVerifiedToken = currentToken;
    verifyToken();
  } else if (!currentToken) {
    authResolved.value = true;
  }

  const isAuthenticated = computed(() => user.value !== null);
  const isAdmin = computed(() => user.value?.role === "admin");
  const currentUser = computed(() => user.value);

  const loginMutation = trpc.admin.auth.login.useMutation();

  async function login(
    username: string,
    password: string
  ): Promise<{ ok: boolean; message?: string }> {
    try {
      const result = await loginMutation.mutateAsync({ username, password });
      if (result.ok && result.token && result.username && result.role) {
        setAuthToken(result.token);
        user.value = { username: result.username, role: result.role };
        return { ok: true };
      }
      return { ok: false, message: result.message };
    } catch {
      return { ok: false };
    }
  }

  function logout() {
    setAuthToken(null);
    user.value = null;
    lastVerifiedToken = null;
    verifyPromise = null;
  }

  return {
    isAuthenticated,
    isAdmin,
    currentUser,
    login,
    logout,
    authResolved,
    verifyToken,
  };
}
