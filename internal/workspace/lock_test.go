package workspace

import (
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func newTestManager(t *testing.T, ws Workspace) *WorkspaceManager {
	t.Helper()
	wm, err := NewWorkspaceManager([]Workspace{ws}, t.TempDir(), 1<<20, 1<<20, nil, RateLimitConfig{}, nil)
	if err != nil {
		t.Fatalf("failed to create manager: %v", err)
	}
	return wm
}

func TestUnlockWorkspace_PlainPasscode(t *testing.T) {
	wm := newTestManager(t, Workspace{ID: "ws1", Name: "Locked WS", Visibility: "locked", Passcode: "secret123"})

	ok, err := wm.UnlockWorkspace("ws1", "secret123")
	if err != nil || !ok {
		t.Errorf("correct passcode should unlock: ok=%v err=%v", ok, err)
	}
	ok, _ = wm.UnlockWorkspace("ws1", "wrong")
	if ok {
		t.Error("wrong passcode should fail")
	}
	ok, _ = wm.UnlockWorkspace("ws1", " secret123 ")
	if !ok {
		t.Error("whitespace-padded passcode should be trimmed and accepted")
	}
}

func TestUnlockWorkspace_BcryptHash(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("hunter2"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	wm := newTestManager(t, Workspace{ID: "ws2", Passcode: string(hash)})

	if ok, _ := wm.UnlockWorkspace("ws2", "hunter2"); !ok {
		t.Error("bcrypt-hashed passcode should verify")
	}
	if ok, _ := wm.UnlockWorkspace("ws2", "wrong"); ok {
		t.Error("wrong passcode against bcrypt hash should fail")
	}
	// The raw hash must never verify as itself (that would be a trivial bypass).
	if ok, _ := wm.UnlockWorkspace("ws2", string(hash)); ok {
		t.Error("hash string must not be accepted as a passcode")
	}
}

func TestUnlockWorkspace_UnlockedWorkspaceAlwaysAccessible(t *testing.T) {
	wm := newTestManager(t, Workspace{ID: "ws3", Name: "Open"})

	ok, err := wm.UnlockWorkspace("ws3", "")
	if err != nil || !ok {
		t.Errorf("unlocked workspace should be accessible without passcode: %v %v", ok, err)
	}
}

func TestUnlockWorkspace_NotFound(t *testing.T) {
	wm := newTestManager(t, Workspace{ID: "ws4"})
	if _, err := wm.UnlockWorkspace("missing", "x"); err == nil {
		t.Error("unknown workspace should return ErrWorkspaceNotFound")
	}
}

func TestIsWorkspaceUnlocked_SessionList(t *testing.T) {
	wm := newTestManager(t, Workspace{
		ID: "secure", Visibility: "locked", Passcode: "pin",
	})

	// Locked + no unlock grant -> denied.
	if wm.IsWorkspaceUnlocked("secure", nil) {
		t.Error("locked workspace must deny access without unlock grant")
	}
	if wm.IsWorkspaceUnlocked("secure", []string{"other-ws"}) {
		t.Error("locked workspace must deny access with unrelated grant")
	}
	// With the grant -> allowed.
	if !wm.IsWorkspaceUnlocked("secure", []string{"other-ws", "secure"}) {
		t.Error("locked workspace must allow access with matching grant")
	}
	// Unknown workspace -> denied regardless.
	if wm.IsWorkspaceUnlocked("missing", []string{"missing"}) {
		t.Error("unknown workspace must deny access")
	}

	// Unlocked workspace -> always accessible (register one on the fly).
	if err := wm.AddWorkspace(Workspace{ID: "open", Name: "Open WS"}); err != nil {
		t.Fatalf("failed to add open workspace: %v", err)
	}
	if !wm.IsWorkspaceUnlocked("open", nil) {
		t.Error("unlocked workspace should be accessible without grants")
	}
}

func TestListWorkspaces_NeverLeaksPasscode(t *testing.T) {
	wm := newTestManager(t, Workspace{ID: "ws9", Passcode: "supersecret", Visibility: "locked"})
	list := wm.ListWorkspaces()
	if len(list) != 1 {
		t.Fatalf("expected 1 workspace, got %d", len(list))
	}
	if list[0].Passcode != "" {
		t.Error("passcode must never leak in workspace listings")
	}
	if !list[0].IsLocked {
		t.Error("locked workspace must report IsLocked")
	}
}

func TestVerifyPasscode_TimingConsistency(t *testing.T) {
	wm := newTestManager(t, Workspace{ID: "ws-t", Passcode: "pin"})
	// Both branches run a real comparison; smoke-test they behave oppositely.
	if !wm.verifyPasscode("pin", "pin") {
		t.Error("matching plain passcode should verify")
	}
	if wm.verifyPasscode("pin", "different") {
		t.Error("mismatched plain passcode must not verify")
	}
}
